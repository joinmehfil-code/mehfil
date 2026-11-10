import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EventStatus as PrismaEventStatus,
  OrderStatus as PrismaOrderStatus,
  ReportStatus as PrismaReportStatus,
  TicketStatus as PrismaTicketStatus,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '@prisma/client';
import { AdminStats, UserRole, UserStatus } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { toNumber } from '../common/utils/serialize.util';
import { AdminUserQueryDto } from './dto/admin.dto';

const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  avatarUrl: true,
  city: true,
  country: true,
  role: true,
  status: true,
  isVerified: true,
  createdAt: true,
  _count: {
    select: { followsReceived: true, followsInitiated: true, posts: true },
  },
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aggregate the top-level dashboard metrics. */
  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      usersActive,
      usersNewToday,
      usersNewWeek,
      communitiesTotal,
      communitiesNewWeek,
      eventsTotal,
      eventsUpcoming,
      eventsCompleted,
      postsTotal,
      postsNewToday,
      ordersTotal,
      ordersPaid,
      revenueAgg,
      ticketsSold,
      ticketsCheckedIn,
      reportsOpen,
      reportsResolved,
      messagesTotal,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, status: PrismaUserStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfToday } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: weekAgo } },
      }),
      this.prisma.community.count({ where: { deletedAt: null } }),
      this.prisma.community.count({
        where: { deletedAt: null, createdAt: { gte: weekAgo } },
      }),
      this.prisma.event.count({ where: { deletedAt: null } }),
      this.prisma.event.count({
        where: {
          deletedAt: null,
          status: PrismaEventStatus.PUBLISHED,
          startsAt: { gte: now },
        },
      }),
      this.prisma.event.count({
        where: {
          deletedAt: null,
          status: {
            in: [PrismaEventStatus.COMPLETED, PrismaEventStatus.ONGOING],
          },
        },
      }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.post.count({
        where: { deletedAt: null, createdAt: { gte: startOfToday } },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: PrismaOrderStatus.PAID } }),
      this.prisma.order.aggregate({
        where: { status: PrismaOrderStatus.PAID },
        _sum: { total: true },
      }),
      this.prisma.eTicket.count({
        where: {
          status: {
            in: [PrismaTicketStatus.VALID, PrismaTicketStatus.USED],
          },
        },
      }),
      this.prisma.eTicket.count({ where: { status: PrismaTicketStatus.USED } }),
      this.prisma.report.count({
        where: {
          status: {
            in: [PrismaReportStatus.OPEN, PrismaReportStatus.IN_REVIEW],
          },
        },
      }),
      this.prisma.report.count({
        where: {
          status: {
            in: [PrismaReportStatus.RESOLVED, PrismaReportStatus.DISMISSED],
          },
        },
      }),
      this.prisma.message.count({ where: { deletedAt: null } }),
    ]);

    return {
      users: {
        total: usersTotal,
        active: usersActive,
        newToday: usersNewToday,
        newThisWeek: usersNewWeek,
      },
      communities: { total: communitiesTotal, newThisWeek: communitiesNewWeek },
      events: {
        total: eventsTotal,
        upcoming: eventsUpcoming,
        completed: eventsCompleted,
      },
      posts: { total: postsTotal, newToday: postsNewToday },
      orders: {
        total: ordersTotal,
        paid: ordersPaid,
        revenue: toNumber(revenueAgg._sum.total ?? 0),
        currency: 'PKR',
      },
      tickets: { sold: ticketsSold, checkedIn: ticketsCheckedIn },
      reports: { open: reportsOpen, resolved: reportsResolved },
      messages: { total: messagesTotal },
    };
  }

  /** Staff: paginated user directory with search + status/role filters. */
  async listUsers(query: AdminUserQueryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status
        ? { status: query.status as unknown as PrismaUserStatus }
        : {}),
      ...(query.role ? { role: query.role as unknown as PrismaUserRole } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(
      rows.map((u) => this.toAdminUser(u)),
      total,
      query.page,
      query.limit,
    );
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: ADMIN_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toAdminUser(user);
  }

  /** Change a user's moderation status (suspend/ban/activate). */
  async setUserStatus(id: string, status: UserStatus) {
    await this.getUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: status as unknown as PrismaUserStatus },
      select: ADMIN_USER_SELECT,
    });
    return this.toAdminUser(updated);
  }

  /** Change a user's platform role. */
  async setUserRole(id: string, role: UserRole) {
    await this.getUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: role as unknown as PrismaUserRole },
      select: ADMIN_USER_SELECT,
    });
    return this.toAdminUser(updated);
  }

  /** Daily signups over the last N days for a growth chart. */
  async userGrowth(days: number) {
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return this.bucketByDay(rows.map((r) => r.createdAt), days);
  }

  /** Daily paid revenue over the last N days. */
  async revenueGrowth(days: number) {
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    const orders = await this.prisma.order.findMany({
      where: { status: PrismaOrderStatus.PAID, paidAt: { gte: since } },
      select: { paidAt: true, total: true },
    });
    const buckets = this.bucketByDay(
      orders.map((o) => o.paidAt ?? new Date()),
      days,
    );
    const totals = new Map(buckets.map((b) => [b.date, 0]));
    for (const o of orders) {
      const key = this.dayKey(o.paidAt ?? new Date());
      totals.set(key, (totals.get(key) ?? 0) + toNumber(o.total));
    }
    return buckets.map((b) => ({ date: b.date, count: b.count, revenue: totals.get(b.date) ?? 0 }));
  }

  /** Build contiguous daily buckets ending today. */
  private bucketByDay(dates: Date[], days: number) {
    const counts = new Map<string, number>();
    for (const d of dates) {
      const key = this.dayKey(d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const out: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = this.dayKey(day);
      out.push({ date: key, count: counts.get(key) ?? 0 });
    }
    return out;
  }

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private toAdminUser(u: AdminUserRow) {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      avatarUrl: u.avatarUrl,
      city: u.city,
      country: u.country,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      isVerified: u.isVerified,
      followersCount: u._count.followsReceived,
      followingCount: u._count.followsInitiated,
      postsCount: u._count.posts,
      memberSince: u.createdAt.toISOString(),
    };
  }
}
