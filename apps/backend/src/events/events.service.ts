import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RsvpStatus, EventStatus, EventType, TicketType, OrderStatus } from '@prisma/client';
import { EventRsvpStatus, NotificationType } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/serialize.util';
import {
  CreateEventDto,
  UpdateEventDto,
  EventQueryDto,
  TicketTierDto,
} from './dto/event.dto';
import {
  EVENT_INCLUDE,
  EventWithRelations,
  toEventSummary,
  toEventDetail,
  toTicketTierApi,
} from './event.mapper';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private isPlatformStaff(role?: string | null): boolean {
    return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
  }

  private async assertCanManage(
    actorId: string,
    actorRole: string | undefined,
    organizerId: string,
  ): Promise<void> {
    if (actorId === organizerId || this.isPlatformStaff(actorRole)) return;
    throw new ForbiddenException('Only the event organizer can manage this event');
  }

  private async uniqueEventSlug(base: string): Promise<string> {
    const slug = slugify(base);
    let candidate = slug;
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.event.findUnique({ where: { slug: candidate } });
      if (!exists) return candidate;
      i += 1;
      candidate = `${slug}-${i}`;
    }
  }

  private tierCreateData(dto: TicketTierDto, currency: string) {
    const price = dto.type === TicketType.FREE ? 0 : dto.price ?? 0;
    return {
      name: dto.name,
      description: dto.description ?? null,
      type: (dto.type ?? (price > 0 ? TicketType.PAID : TicketType.FREE)) as TicketType,
      price,
      currency: dto.currency ?? currency,
      quantityTotal: dto.quantityTotal,
      saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : null,
      saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null,
      minPerOrder: dto.minPerOrder ?? 1,
      maxPerOrder: dto.maxPerOrder ?? 10,
      isVisible: dto.isVisible ?? true,
      isInviteOnly: dto.isInviteOnly ?? false,
      order: dto.order ?? 0,
    };
  }

  private computePriceMin(tiers: { price: number; type?: string }[]): number {
    const paid = tiers
      .map((t) => Number(t.price))
      .filter((p) => p > 0);
    return paid.length ? Math.min(...paid) : 0;
  }

  // -------------------------------- Create ---------------------------------

  async createEvent(
    organizerId: string,
    dto: CreateEventDto,
  ): Promise<ReturnType<typeof toEventDetail>> {
    if (dto.endsAt && new Date(dto.endsAt) < new Date(dto.startsAt))
      throw new BadRequestException('endsAt must be after startsAt');

    const slug = await this.uniqueEventSlug(dto.slug ?? dto.title);
    const currency = dto.currency ?? 'PKR';
    const tiers = dto.ticketTiers ?? [];
    const priceMin = this.computePriceMin(
      tiers.map((t) => ({ price: t.type === TicketType.FREE ? 0 : t.price ?? 0 })),
    );

    const event = await this.prisma.event.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description ?? null,
        coverUrl: dto.coverUrl ?? null,
        type: (dto.type ?? EventType.IN_PERSON) as EventType,
        status: EventStatus.DRAFT,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        timezone: dto.timezone ?? 'Asia/Karachi',
        isOnline: dto.isOnline ?? dto.type === EventType.ONLINE,
        onlineUrl: dto.onlineUrl ?? null,
        venueName: dto.venueName ?? null,
        venueAddress: dto.venueAddress ?? null,
        venueCity: dto.venueCity ?? null,
        venueCountry: dto.venueCountry ?? null,
        venueLat: dto.venueLat ?? null,
        venueLng: dto.venueLng ?? null,
        venueMapUrl: dto.venueMapUrl ?? null,
        communityId: dto.communityId ?? null,
        organizerId,
        currency,
        priceMin,
        refundPolicy: dto.refundPolicy ?? null,
        hasWaitlist: dto.hasWaitlist ?? true,
        ticketCount: tiers.reduce((s, t) => s + t.quantityTotal, 0),
        ticketTiers: tiers.length
          ? { create: tiers.map((t) => this.tierCreateData(t, currency)) }
          : undefined,
      },
      include: { ...EVENT_INCLUDE, ticketTiers: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });

    return toEventDetail(
      event as EventWithRelations,
      event.ticketTiers.map((t) => toTicketTierApi(t)),
      null,
    );
  }

  // -------------------------------- Update ---------------------------------

  async updateEvent(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    dto: UpdateEventDto,
  ): Promise<ReturnType<typeof toEventDetail>> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanManage(actorId, actorRole, event.organizerId);

    const statusChanged = dto.status !== undefined && dto.status !== event.status;

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
        ...(dto.type !== undefined ? { type: dto.type as EventType } : {}),
        ...(dto.status !== undefined ? { status: dto.status as EventStatus } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.isOnline !== undefined ? { isOnline: dto.isOnline } : {}),
        ...(dto.onlineUrl !== undefined ? { onlineUrl: dto.onlineUrl } : {}),
        ...(dto.venueName !== undefined ? { venueName: dto.venueName } : {}),
        ...(dto.venueAddress !== undefined ? { venueAddress: dto.venueAddress } : {}),
        ...(dto.venueCity !== undefined ? { venueCity: dto.venueCity } : {}),
        ...(dto.venueCountry !== undefined ? { venueCountry: dto.venueCountry } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.refundPolicy !== undefined ? { refundPolicy: dto.refundPolicy } : {}),
        ...(dto.hasWaitlist !== undefined ? { hasWaitlist: dto.hasWaitlist } : {}),
        ...(dto.checkInOpen !== undefined ? { checkInOpen: dto.checkInOpen } : {}),
      },
      include: { ...EVENT_INCLUDE, ticketTiers: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });

    // Notify RSVP'd users about cancellation or schedule change.
    if (statusChanged && dto.status === EventStatus.CANCELLED) {
      await this.notifyAttendees(eventId, actorId, 'Event cancelled', `${event.title} has been cancelled`);
    } else if (dto.startsAt !== undefined && dto.startsAt !== event.startsAt.toISOString()) {
      await this.notifyAttendees(eventId, actorId, 'Event rescheduled', `${event.title} start time changed`);
    }

    return toEventDetail(
      updated as EventWithRelations,
      updated.ticketTiers.map((t) => toTicketTierApi(t)),
      null,
    );
  }

  private async notifyAttendees(eventId: string, actorId: string, title: string, body: string) {
    const rsvps = await this.prisma.eventRsvp.findMany({
      where: { eventId, status: { in: [RsvpStatus.GOING, RsvpStatus.INTERESTED] } },
      select: { userId: true },
    });
    const orderBuyers = await this.prisma.order.findMany({
      where: { eventId, status: { in: [OrderStatus.PAID, OrderStatus.HELD, OrderStatus.PENDING] } },
      select: { buyerId: true },
    });
    const userIds = Array.from(
      new Set([...rsvps.map((r) => r.userId), ...orderBuyers.map((o) => o.buyerId)]),
    );
    await this.notifications.createMany(userIds, {
      type: NotificationType.EVENT_UPDATE,
      title,
      body,
      actorId,
      targetType: 'EVENT',
      targetId: eventId,
      deepLink: `/events/${eventId}`,
    });
  }

  async deleteEvent(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
  ): Promise<{ success: boolean }> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanManage(actorId, actorRole, event.organizerId);
    await this.prisma.event.update({ where: { id: eventId }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  // --------------------------------- Read ----------------------------------

  async getEvent(
    viewerId: string | undefined,
    identifier: string,
  ): Promise<ReturnType<typeof toEventDetail>> {
    const event = await this.prisma.event.findFirst({
      where: { deletedAt: null, OR: [{ id: identifier }, { slug: identifier }] },
      include: { ...EVENT_INCLUDE, ticketTiers: { where: { isVisible: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Drafts are only visible to the organizer/staff.
    if (event.status === EventStatus.DRAFT && viewerId !== event.organizerId) {
      const u = viewerId
        ? await this.prisma.user.findUnique({ where: { id: viewerId }, select: { role: true } })
        : null;
      if (!this.isPlatformStaff(u?.role)) throw new NotFoundException('Event not found');
    }

    const myRsvp = viewerId
      ? await this.prisma.eventRsvp.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: viewerId } },
          select: { status: true },
        })
      : null;

    return toEventDetail(
      event as EventWithRelations,
      event.ticketTiers.map((t) => toTicketTierApi(t)),
      myRsvp?.status as EventRsvpStatus | null,
    );
  }

  async discover(
    viewerId: string | undefined,
    query: EventQueryDto,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toEventSummary>>> {
    const now = new Date();
    const when = query.when ?? 'upcoming';
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      status: { in: [EventStatus.PUBLISHED, EventStatus.ONGOING] },
      ...(when === 'upcoming' ? { startsAt: { gte: now } } : {}),
      ...(when === 'past' ? { startsAt: { lt: now } } : {}),
      ...(query.type ? { type: query.type as EventType } : {}),
      ...(query.city ? { venueCity: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.communityId ? { communityId: query.communityId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy: when === 'past' ? { startsAt: 'desc' } : { startsAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    const rsvps = viewerId
      ? await this.prisma.eventRsvp.findMany({
          where: { userId: viewerId, eventId: { in: rows.map((r) => r.id) } },
          select: { eventId: true, status: true },
        })
      : [];
    const rsvpMap = new Map(rsvps.map((r) => [r.eventId, r.status]));

    const items = rows.map((e) =>
      toEventSummary(e as EventWithRelations, (rsvpMap.get(e.id) as EventRsvpStatus) ?? null),
    );
    return paginate(items, total, page, limit);
  }

  async myEvents(
    organizerId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toEventSummary>>> {
    const where = { organizerId, deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy: { startsAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);
    return paginate(rows.map((e) => toEventSummary(e as EventWithRelations, null)), total, page, limit);
  }

  async attendingEvents(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toEventSummary>>> {
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      OR: [
        { rsvps: { some: { userId, status: { in: [RsvpStatus.GOING, RsvpStatus.INTERESTED] } } } },
        { orders: { some: { buyerId: userId, status: OrderStatus.PAID } } },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy: { startsAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);
    return paginate(rows.map((e) => toEventSummary(e as EventWithRelations, null)), total, page, limit);
  }

  // --------------------------------- RSVP ----------------------------------

  async setRsvp(
    userId: string,
    eventId: string,
    status: EventRsvpStatus,
  ): Promise<{ status: EventRsvpStatus }> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, status: true, hasWaitlist: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === EventStatus.DRAFT || event.status === EventStatus.CANCELLED)
      throw new BadRequestException('This event is not accepting RSVPs');

    await this.prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: status as RsvpStatus },
      update: { status: status as RsvpStatus },
    });

    // Maintain attendeeCount for GOING.
    await this.recountAttendees(eventId);
    return { status };
  }

  private async recountAttendees(eventId: string): Promise<void> {
    const going = await this.prisma.eventRsvp.count({
      where: { eventId, status: RsvpStatus.GOING },
    });
    const paidTickets = await this.prisma.eTicket.count({
      where: { eventId, status: { in: ['VALID', 'USED'] } },
    });
    await this.prisma.event.update({
      where: { id: eventId },
      data: { attendeeCount: Math.max(going, paidTickets) },
    });
  }

  async listAttendees(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    page = 1,
    limit = 50,
  ) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId }, select: { organizerId: true } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanManage(actorId, actorRole, event.organizerId);

    const where = { eventId, status: { in: [RsvpStatus.GOING, RsvpStatus.INTERESTED] } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.eventRsvp.findMany({
        where,
        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.eventRsvp.count({ where }),
    ]);
    return paginate(
      rows.map((r) => ({ user: r.user, status: r.status as EventRsvpStatus, createdAt: r.createdAt.toISOString() })),
      total,
      page,
      limit,
    );
  }

  // ------------------------------ Ticket tiers -----------------------------

  async addTier(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    dto: TicketTierDto,
  ): Promise<ReturnType<typeof toTicketTierApi>> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanManage(actorId, actorRole, event.organizerId);

    const tier = await this.prisma.ticketTier.create({
      data: { eventId, ...this.tierCreateData(dto, event.currency) },
    });
    await this.recomputeEventTotals(eventId);
    return toTicketTierApi(tier);
  }

  async updateTier(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    tierId: string,
    dto: Partial<TicketTierDto>,
  ): Promise<ReturnType<typeof toTicketTierApi>> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanManage(actorId, actorRole, event.organizerId);
    const tier = await this.prisma.ticketTier.findFirst({ where: { id: tierId, eventId } });
    if (!tier) throw new NotFoundException('Ticket tier not found');

    const updated = await this.prisma.ticketTier.update({
      where: { id: tierId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type as TicketType } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.quantityTotal !== undefined ? { quantityTotal: dto.quantityTotal } : {}),
        ...(dto.saleStartsAt !== undefined ? { saleStartsAt: new Date(dto.saleStartsAt) } : {}),
        ...(dto.saleEndsAt !== undefined ? { saleEndsAt: new Date(dto.saleEndsAt) } : {}),
        ...(dto.minPerOrder !== undefined ? { minPerOrder: dto.minPerOrder } : {}),
        ...(dto.maxPerOrder !== undefined ? { maxPerOrder: dto.maxPerOrder } : {}),
        ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
        ...(dto.isInviteOnly !== undefined ? { isInviteOnly: dto.isInviteOnly } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
    await this.recomputeEventTotals(eventId);
    return toTicketTierApi(updated);
  }

  async deleteTier(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    tierId: string,
  ): Promise<{ success: boolean }> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertCanManage(actorId, actorRole, event.organizerId);
    const tier = await this.prisma.ticketTier.findFirst({
      where: { id: tierId, eventId },
      select: { id: true, quantitySold: true },
    });
    if (!tier) throw new NotFoundException('Ticket tier not found');
    if (tier.quantitySold > 0)
      throw new BadRequestException('Cannot delete a tier that has sold tickets');
    await this.prisma.ticketTier.delete({ where: { id: tierId } });
    await this.recomputeEventTotals(eventId);
    return { success: true };
  }

  /** Recompute event.ticketCount and event.priceMin from its tiers. */
  async recomputeEventTotals(eventId: string): Promise<void> {
    const tiers = await this.prisma.ticketTier.findMany({ where: { eventId } });
    const ticketCount = tiers.reduce((s, t) => s + t.quantityTotal, 0);
    const priceMin = this.computePriceMin(
      tiers.map((t) => ({ price: Number(t.price.toString()) })),
    );
    await this.prisma.event.update({ where: { id: eventId }, data: { ticketCount, priceMin } });
  }
}
