import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PostStatus as PrismaPostStatus,
  ReportStatus as PrismaReportStatus,
  ReportTargetType as PrismaReportTargetType,
  UserStatus as PrismaUserStatus,
} from '@prisma/client';
import {
  ReportTargetType,
  ReportStatus,
  NotificationType,
} from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { toAuthor } from '../users/user.mapper';
import { CreateReportDto, ResolveReportDto, ReportQueryDto } from './dto/report.dto';

/** Minimal user fields embedded in report payloads. */
const REPORTER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export const REPORT_INCLUDE = {
  reporter: { select: REPORTER_SELECT },
  reviewedBy: { select: REPORTER_SELECT },
} satisfies Prisma.ReportInclude;

export type ReportWithRelations = Prisma.ReportGetPayload<{
  include: typeof REPORT_INCLUDE;
}>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** File a report against a target. Prevents duplicate open reports. */
  async createReport(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType as unknown as PrismaReportTargetType,
        targetId: dto.targetId,
        status: { in: [PrismaReportStatus.OPEN, PrismaReportStatus.IN_REVIEW] },
      },
    });
    if (existing) {
      throw new BadRequestException('You have already reported this item');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType as unknown as PrismaReportTargetType,
        targetId: dto.targetId,
        reason: dto.reason as never,
        details: dto.details ?? null,
      },
      include: REPORT_INCLUDE,
    });

    return this.toApi(report);
  }

  /** Staff: list all reports with optional status/targetType filters. */
  async listReports(
    query: ReportQueryDto,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ReportWhereInput = {
      ...(query.status
        ? { status: query.status as unknown as PrismaReportStatus }
        : {}),
      ...(query.targetType
        ? {
            targetType:
              query.targetType as unknown as PrismaReportTargetType,
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return paginate(rows.map((r) => this.toApi(r)), total, page, limit);
  }

  /** Staff: fetch a single report. */
  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: REPORT_INCLUDE,
    });
    if (!report) throw new NotFoundException('Report not found');
    return this.toApi(report);
  }

  /** Reporter: list my own reports. */
  async myReports(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ReportWhereInput = { reporterId: userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toApi(r)), total, page, limit);
  }

  /** Staff: resolve a report and optionally apply a moderation action. */
  async resolveReport(reviewerId: string, id: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    if (dto.action && dto.action !== 'NONE') {
      await this.applyAction(
        report.targetType as unknown as ReportTargetType,
        report.targetId,
        dto.action,
      );
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status as unknown as PrismaReportStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        resolutionNote: dto.resolutionNote ?? null,
      },
      include: REPORT_INCLUDE,
    });

    // Notify the reporter that their report has been actioned.
    await this.notifications.create({
      userId: report.reporterId,
      type: NotificationType.SYSTEM,
      title: 'Report reviewed',
      body: `Your report has been marked as ${dto.status
        .toString()
        .toLowerCase()}.`,
      targetType: report.targetType as string,
      targetId: report.targetId,
    });

    return this.toApi(updated);
  }

  /** Apply a concrete moderation action against the offending content/user. */
  private async applyAction(
    targetType: ReportTargetType,
    targetId: string,
    action: string,
  ): Promise<void> {
    if (action === 'REMOVE_CONTENT') {
      if (targetType === ReportTargetType.POST) {
        await this.prisma.post.updateMany({
          where: { id: targetId },
          data: { status: PrismaPostStatus.REMOVED },
        });
        return;
      }
      if (targetType === ReportTargetType.COMMENT) {
        await this.prisma.comment.updateMany({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });
        return;
      }
      throw new BadRequestException(
        'REMOVE_CONTENT is only supported for posts and comments',
      );
    }

    if (action === 'SUSPEND_USER' || action === 'BAN_USER') {
      const offenderId = await this.resolveOffenderId(targetType, targetId);
      if (!offenderId) {
        throw new BadRequestException('Could not resolve the user to moderate');
      }
      const status =
        action === 'BAN_USER'
          ? PrismaUserStatus.BANNED
          : PrismaUserStatus.SUSPENDED;
      await this.prisma.user.updateMany({
        where: { id: offenderId },
        data: { status },
      });
      return;
    }
  }

  /** Map a report target to the responsible user's id. */
  private async resolveOffenderId(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<string | null> {
    switch (targetType) {
      case ReportTargetType.USER:
        return targetId;
      case ReportTargetType.POST: {
        const post = await this.prisma.post.findUnique({
          where: { id: targetId },
          select: { authorId: true },
        });
        return post?.authorId ?? null;
      }
      case ReportTargetType.COMMENT: {
        const comment = await this.prisma.comment.findUnique({
          where: { id: targetId },
          select: { authorId: true },
        });
        return comment?.authorId ?? null;
      }
      default:
        return null;
    }
  }

  /** Ensure the reported entity actually exists (best-effort validation). */
  private async assertTargetExists(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<void> {
    let found: unknown = null;
    switch (targetType) {
      case ReportTargetType.USER:
        found = await this.prisma.user.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        break;
      case ReportTargetType.POST:
        found = await this.prisma.post.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        break;
      case ReportTargetType.COMMENT:
        found = await this.prisma.comment.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        break;
      case ReportTargetType.COMMUNITY:
        found = await this.prisma.community.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        break;
      case ReportTargetType.EVENT:
        found = await this.prisma.event.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        break;
      case ReportTargetType.MESSAGE:
        found = await this.prisma.message.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        break;
      default:
        found = { id: targetId };
    }
    if (!found) {
      throw new NotFoundException('Reported item not found');
    }
  }

  private toApi(r: ReportWithRelations) {
    return {
      id: r.id,
      targetType: r.targetType as unknown as ReportTargetType,
      targetId: r.targetId,
      reason: r.reason as string,
      details: r.details,
      status: r.status as unknown as ReportStatus,
      resolutionNote: r.resolutionNote,
      reporter: r.reporter ? toAuthor(r.reporter) : null,
      reviewedBy: r.reviewedBy ? toAuthor(r.reviewedBy) : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
