import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, SOCKET_EVENTS } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { toAuthor } from '../users/user.mapper';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  body: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  deepLink?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Create + push a notification. Respects the user's in-app preference. */
  async create(input: CreateNotificationInput) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId: input.userId },
    });
    // If the user disabled in-app notifications, skip (except SYSTEM/critical).
    if (pref && pref.inApp === false && input.type !== 'SYSTEM') {
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type as NotificationType,
        title: input.title,
        body: input.body,
        actorId: input.actorId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        deepLink: input.deepLink ?? null,
        data: (input.data ?? undefined) as object | undefined,
      },
      include: { user: false },
    });

    const actor = input.actorId
      ? await this.prisma.user.findUnique({
          where: { id: input.actorId },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : null;

    const payload = this.toApi(notification, actor ?? undefined);
    this.realtime.emitToUser(input.userId, SOCKET_EVENTS.NOTIFICATION_NEW, payload);
    return payload;
  }

  /** Fan-out a notification to many users (e.g. community activity). */
  async createMany(userIds: string[], base: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
    const unique = Array.from(new Set(userIds)).filter((id) => id !== base.actorId);
    await Promise.all(unique.map((userId) => this.create({ ...base, userId })));
  }

  async list(userId: string, page = 1, limit = 20, unreadOnly = false): Promise<PaginatedResult<unknown>> {
    const where = { userId, ...(unreadOnly ? { read: false } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const actorIds = Array.from(new Set(rows.map((r) => r.actorId).filter(Boolean) as string[]));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const items = rows.map((r) =>
      this.toApi(r, r.actorId ? actorMap.get(r.actorId) : undefined),
    );
    return paginate(items, total, page, limit);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    this.realtime.emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_READ, { id });
    return this.toApi(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { updated: res.count };
  }

  async deleteNotification(userId: string, id: string): Promise<{ success: boolean }> {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { success: true };
  }

  async getPreferences(userId: string) {
    let pref = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!pref) pref = await this.prisma.notificationPreference.create({ data: { userId } });
    return pref;
  }

  async updatePreferences(
    userId: string,
    data: { push?: boolean; email?: boolean; inApp?: boolean },
  ) {
    await this.getPreferences(userId);
    return this.prisma.notificationPreference.update({ where: { userId }, data });
  }

  private toApi(
    n: {
      id: string;
      type: NotificationType | string;
      title: string;
      body: string;
      read: boolean;
      actorId: string | null;
      targetType: string | null;
      targetId: string | null;
      deepLink: string | null;
      data: unknown;
      createdAt: Date;
      updatedAt?: Date;
    },
    actor?: { id: string; username: string; displayName: string; avatarUrl: string | null },
  ) {
    return {
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      read: n.read,
      actor: actor ? toAuthor(actor) : null,
      targetType: n.targetType,
      targetId: n.targetId,
      deepLink: n.deepLink,
      data: (n.data as Record<string, unknown>) ?? undefined,
      createdAt: n.createdAt.toISOString(),
      updatedAt: (n.updatedAt ?? n.createdAt).toISOString(),
    };
  }
}
