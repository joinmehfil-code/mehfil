import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  TicketStatus,
  CheckInMethod,
  RefundStatus,
  DiscountType,
  EventStatus,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import {
  TICKET_HOLD_SECONDS,
  PLATFORM_FEE_PERCENT,
  NotificationType,
  CheckInResult,
} from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { money } from '../common/utils/serialize.util';
import { CheckoutDto } from './dto/event.dto';
import { toOrderApi, toETicketApi, OrderRow } from './event.mapper';

const ORDER_INCLUDE = {
  lines: true,
  tickets: true,
  event: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class TicketingService {
  private readonly logger = new Logger(TicketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  private isPlatformStaff(role?: string | null): boolean {
    return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
  }

  private orderCode(): string {
    return `ORD-${nanoid(10).toUpperCase()}`;
  }

  private ticketCode(): string {
    return `MF-${nanoid(4).toUpperCase()}-${nanoid(4).toUpperCase()}`;
  }

  // ------------------------------- Checkout --------------------------------

  async checkout(
    userId: string,
    eventId: string,
    dto: CheckoutDto,
  ): Promise<ReturnType<typeof toOrderApi>> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, title: true, status: true, startsAt: true, currency: true, organizerId: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === EventStatus.DRAFT || event.status === EventStatus.CANCELLED)
      throw new BadRequestException('This event is not available for booking');
    if (event.status === EventStatus.COMPLETED || event.startsAt < new Date())
      throw new BadRequestException('This event has already started');
    if (!dto.items?.length) throw new BadRequestException('No tickets selected');

    // Load and validate tiers.
    const tierIds = dto.items.map((i) => i.ticketTierId);
    const tiers = await this.prisma.ticketTier.findMany({ where: { id: { in: tierIds }, eventId } });
    const tierMap = new Map(tiers.map((t) => [t.id, t]));

    let subtotal = 0;
    const lines: {
      ticketTierId: string;
      ticketTierName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];

    for (const item of dto.items) {
      const tier = tierMap.get(item.ticketTierId);
      if (!tier) throw new BadRequestException(`Invalid ticket tier: ${item.ticketTierId}`);
      if (!tier.isVisible) throw new BadRequestException(`Ticket not available: ${tier.name}`);
      if (tier.saleStartsAt && tier.saleStartsAt > new Date())
        throw new BadRequestException(`Sales for ${tier.name} have not started`);
      if (tier.saleEndsAt && tier.saleEndsAt < new Date())
        throw new BadRequestException(`Sales for ${tier.name} have ended`);
      if (item.quantity < tier.minPerOrder || item.quantity > tier.maxPerOrder)
        throw new BadRequestException(
          `Quantity for ${tier.name} must be between ${tier.minPerOrder} and ${tier.maxPerOrder}`,
        );
      const available = tier.quantityTotal - tier.quantitySold;
      if (item.quantity > available)
        throw new BadRequestException(`Only ${available} ticket(s) left for ${tier.name}`);

      const unitPrice = Number(tier.price.toString());
      const lineTotal = money(unitPrice * item.quantity);
      subtotal += lineTotal;
      lines.push({
        ticketTierId: tier.id,
        ticketTierName: tier.name,
        quantity: item.quantity,
        unitPrice,
        total: lineTotal,
      });
    }

    subtotal = money(subtotal);

    // Promo code.
    let discount = 0;
    let promo: { code: string; id: string } | null = null;
    if (dto.promoCode) {
      const p = await this.prisma.promoCode.findFirst({
        where: {
          code: { equals: dto.promoCode, mode: 'insensitive' },
          active: true,
          OR: [{ eventId: null }, { eventId }],
        },
      });
      if (!p) throw new BadRequestException('Invalid promo code');
      if (p.startsAt && p.startsAt > new Date()) throw new BadRequestException('Promo code not active yet');
      if (p.endsAt && p.endsAt < new Date()) throw new BadRequestException('Promo code expired');
      if (p.maxUses && p.usedCount >= p.maxUses) throw new BadRequestException('Promo code fully redeemed');
      if (p.minOrderAmount && subtotal < Number(p.minOrderAmount.toString()))
        throw new BadRequestException(`Minimum order amount not met for this promo code`);
      discount =
        p.type === DiscountType.PERCENT
          ? money((subtotal * Number(p.value.toString())) / 100)
          : Math.min(money(Number(p.value.toString())), subtotal);
      discount = Math.min(discount, subtotal);
      promo = { code: p.code, id: p.id };
    }

    const net = money(subtotal - discount);
    const platformFee = money((net * PLATFORM_FEE_PERCENT) / 100);
    const total = money(net + platformFee);
    const isFree = total <= 0;

    const method = isFree
      ? PaymentMethod.FREE
      : (dto.paymentMethod as PaymentMethod);
    if (!isFree && dto.paymentMethod === PaymentMethod.FREE)
      throw new BadRequestException('Invalid payment method for a paid order');

    // Manual methods await approval; mock card / free settle instantly.
    const autoSettle = isFree || method === PaymentMethod.MOCK_CARD;
    const holdExpiresAt = autoSettle
      ? null
      : new Date(Date.now() + TICKET_HOLD_SECONDS * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      // Reserve inventory atomically (guard against overselling).
      for (const line of lines) {
        const tier = tierMap.get(line.ticketTierId)!;
        const updated = await tx.ticketTier.updateMany({
          where: {
            id: line.ticketTierId,
            quantitySold: { lte: tier.quantityTotal - line.quantity },
          },
          data: { quantitySold: { increment: line.quantity } },
        });
        if (updated.count !== 1)
          throw new BadRequestException(`Tickets just sold out for ${line.ticketTierName}`);
      }

      const created = await tx.order.create({
        data: {
          code: this.orderCode(),
          eventId,
          buyerId: userId,
          status: autoSettle ? OrderStatus.PAID : OrderStatus.HELD,
          paymentMethod: method,
          paymentStatus: autoSettle ? PaymentStatus.APPROVED : PaymentStatus.AWAITING_APPROVAL,
          subtotal,
          discount,
          platformFee,
          total,
          currency: event.currency,
          promoCode: promo?.code ?? null,
          holdExpiresAt,
          paidAt: autoSettle ? new Date() : null,
          attendeeInfo: (dto.attendees ?? []) as object,
          lines: { create: lines },
          payment: {
            create: {
              provider: autoSettle ? 'mock' : 'manual',
              method,
              status: autoSettle ? PaymentStatus.APPROVED : PaymentStatus.AWAITING_APPROVAL,
              amount: total,
              currency: event.currency,
              approvedAt: autoSettle ? new Date() : null,
            },
          },
        },
        include: ORDER_INCLUDE,
      });

      if (promo) {
        await tx.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      return created;
    });

    // Generate tickets for auto-settled orders.
    let finalOrder = order;
    if (autoSettle) {
      await this.generateTickets(order.id);
      finalOrder = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      });
      await this.afterPaid(finalOrder as OrderRow);
    }

    return toOrderApi(finalOrder as OrderRow);
  }

  /** Create individual e-tickets (with unique codes + QR payloads) for an order. */
  private async generateTickets(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true, event: { select: { id: true } } },
    });
    const attendees = (order.attendeeInfo as { name?: string; email?: string }[]) ?? [];

    const existing = await this.prisma.eTicket.count({ where: { orderId } });
    if (existing > 0) return; // idempotent

    let attendeeIdx = 0;
    const creates: Prisma.ETicketCreateManyInput[] = [];
    for (const line of order.lines) {
      for (let i = 0; i < line.quantity; i++) {
        const code = this.ticketCode();
        const att = attendees[attendeeIdx++];
        creates.push({
          code,
          qrPayload: code,
          orderId,
          eventId: order.eventId,
          ticketTierId: line.ticketTierId,
          ticketTierName: line.ticketTierName,
          status: TicketStatus.VALID,
          attendeeName: att?.name ?? null,
          attendeeEmail: att?.email ?? null,
        });
      }
    }
    await this.prisma.eTicket.createMany({ data: creates });
  }

  private async afterPaid(order: OrderRow): Promise<void> {
    // Bump event ticket sales + attendee count.
    const soldTickets = await this.prisma.eTicket.count({
      where: { eventId: order.eventId, status: { in: [TicketStatus.VALID, TicketStatus.USED] } },
    });
    await this.prisma.event.update({
      where: { id: order.eventId },
      data: { attendeeCount: soldTickets },
    });

    await this.notifications.create({
      userId: order.buyerId,
      type: NotificationType.TICKET_PURCHASED,
      title: 'Tickets confirmed',
      body: `Your tickets for ${order.event.title} are ready`,
      targetType: 'ORDER',
      targetId: order.id,
      deepLink: `/orders/${order.id}`,
    });

    const buyer = await this.prisma.user.findUnique({
      where: { id: order.buyerId },
      select: { email: true },
    });
    if (buyer?.email) {
      await this.mail.send({
        to: buyer.email,
        subject: `Your tickets for ${order.event.title}`,
        text: `Order ${order.code} confirmed. Total: ${order.currency} ${Number(order.total.toString()).toFixed(2)}. View your tickets in the Mehfil app.`,
      });
    }
  }

  // --------------------------- Manual approval -----------------------------

  async approvePayment(
    actorId: string,
    actorRole: string | undefined,
    orderId: string,
    note?: string,
  ): Promise<ReturnType<typeof toOrderApi>> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { event: { select: { organizerId: true } }, payment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.event.organizerId !== actorId && !this.isPlatformStaff(actorRole))
      throw new ForbiddenException('Only the organizer or staff can approve this payment');
    if (order.paymentStatus === PaymentStatus.APPROVED)
      throw new BadRequestException('Payment already approved');
    if (order.status === OrderStatus.CANCELLED)
      throw new BadRequestException('Order was cancelled');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.APPROVED,
          approvedById: actorId,
          approvedAt: new Date(),
          note: note ?? null,
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.APPROVED,
          paidAt: new Date(),
          holdExpiresAt: null,
        },
        include: ORDER_INCLUDE,
      });
    });

    await this.generateTickets(orderId);
    const finalOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    await this.afterPaid(finalOrder as OrderRow);
    void updated;
    return toOrderApi(finalOrder as OrderRow);
  }

  async rejectPayment(
    actorId: string,
    actorRole: string | undefined,
    orderId: string,
    note?: string,
  ): Promise<{ success: boolean }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { event: { select: { organizerId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.event.organizerId !== actorId && !this.isPlatformStaff(actorRole))
      throw new ForbiddenException('Only the organizer or staff can reject this payment');
    if (order.paymentStatus === PaymentStatus.APPROVED)
      throw new BadRequestException('Cannot reject an approved payment');

    await this.releaseOrder(orderId, OrderStatus.FAILED, PaymentStatus.REJECTED, note);
    return { success: true };
  }

  // --------------------------------- Read ----------------------------------

  async getMyOrders(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toOrderApi>>> {
    const where = { buyerId: userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows.map((o) => toOrderApi(o as OrderRow)), total, page, limit);
  }

  async getOrder(
    userId: string,
    userRole: string | undefined,
    orderId: string,
  ): Promise<ReturnType<typeof toOrderApi>> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ...ORDER_INCLUDE, event: { select: { id: true, title: true, slug: true, organizerId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.buyerId !== userId &&
      order.event.organizerId !== userId &&
      !this.isPlatformStaff(userRole)
    )
      throw new ForbiddenException('You cannot view this order');
    return toOrderApi(order as OrderRow);
  }

  async getEventOrders(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResult<ReturnType<typeof toOrderApi>>> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId }, select: { organizerId: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== actorId && !this.isPlatformStaff(actorRole))
      throw new ForbiddenException('Only the organizer can view sales');

    const where = { eventId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows.map((o) => toOrderApi(o as OrderRow)), total, page, limit);
  }

  /** The buyer's ticket wallet (all events). */
  async getMyTickets(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReturnType<typeof toETicketApi>>> {
    const where = { order: { buyerId: userId } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.eTicket.findMany({
        where,
        include: { event: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.eTicket.count({ where }),
    ]);
    return paginate(
      rows.map((t) => toETicketApi(t, t.event.title)),
      total,
      page,
      limit,
    );
  }

  async getEventTickets(
    actorId: string,
    actorRole: string | undefined,
    eventId: string,
    page = 1,
    limit = 50,
  ) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId }, select: { organizerId: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== actorId && !this.isPlatformStaff(actorRole))
      throw new ForbiddenException('Only the organizer can view tickets');

    const where = { eventId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.eTicket.findMany({
        where,
        include: { event: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.eTicket.count({ where }),
    ]);
    return paginate(rows.map((t) => toETicketApi(t, t.event.title)), total, page, limit);
  }

  /** Generate (on demand) a QR data URL for a ticket the user owns. */
  async getTicketQr(
    userId: string,
    userRole: string | undefined,
    ticketId: string,
  ): Promise<{ qrPayload: string; qrDataUrl: string; code: string }> {
    const ticket = await this.prisma.eTicket.findUnique({
      where: { id: ticketId },
      include: { order: { select: { buyerId: true } }, event: { select: { organizerId: true, title: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (
      ticket.order.buyerId !== userId &&
      ticket.event.organizerId !== userId &&
      !this.isPlatformStaff(userRole)
    )
      throw new ForbiddenException('You cannot access this ticket');

    const qrDataUrl = await QRCode.toDataURL(ticket.qrPayload, { margin: 1, width: 480 });
    return { qrPayload: ticket.qrPayload, qrDataUrl, code: ticket.code };
  }

  // -------------------------------- Check-in -------------------------------

  async checkIn(
    scannerId: string,
    scannerRole: string | undefined,
    eventId: string,
    rawCode: string,
    method: CheckInMethod = CheckInMethod.QR,
  ): Promise<CheckInResult> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, title: true, organizerId: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== scannerId && !this.isPlatformStaff(scannerRole))
      throw new ForbiddenException('Only the organizer or staff can check in attendees');

    const code = rawCode.trim();
    const ticket = await this.prisma.eTicket.findFirst({
      where: { OR: [{ code }, { qrPayload: code }], eventId },
      include: { event: { select: { title: true } } },
    });

    if (!ticket) {
      return { success: false, message: 'Ticket not found', eventTitle: event.title };
    }

    const api = toETicketApi(ticket, ticket.event.title);

    if (ticket.status === TicketStatus.USED) {
      await this.prisma.checkIn.create({
        data: { ticketId: ticket.id, eventId, scannedById: scannerId, method, success: false, note: 'Already checked in' },
      });
      return {
        success: false,
        alreadyUsed: true,
        message: 'Ticket already used',
        ticket: api,
        eventTitle: event.title,
      };
    }

    if (ticket.status !== TicketStatus.VALID) {
      return {
        success: false,
        message: `Ticket is ${ticket.status.toLowerCase()}`,
        ticket: api,
        eventTitle: event.title,
      };
    }

    await this.prisma.$transaction([
      this.prisma.eTicket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.USED, checkedInAt: new Date(), checkInById: scannerId },
      }),
      this.prisma.checkIn.create({
        data: { ticketId: ticket.id, eventId, scannedById: scannerId, method, success: true },
      }),
    ]);

    return {
      success: true,
      message: 'Checked in',
      ticket: { ...api, status: 'USED' as never, checkedInAt: new Date().toISOString() },
      eventTitle: event.title,
    };
  }

  // -------------------------------- Refunds --------------------------------

  async requestRefund(
    userId: string,
    orderId: string,
    reason?: string,
  ): Promise<{ status: RefundStatus }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refund: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId) throw new ForbiddenException('You can only refund your own order');
    if (order.status !== OrderStatus.PAID)
      throw new BadRequestException('Only paid orders can be refunded');
    if (order.refund)
      throw new BadRequestException(`Refund already ${order.refund.status.toLowerCase()}`);

    await this.prisma.refund.create({
      data: {
        orderId,
        amount: order.total,
        reason: reason ?? null,
        status: RefundStatus.REQUESTED,
        requestedById: userId,
      },
    });
    return { status: RefundStatus.REQUESTED };
  }

  async processRefund(
    actorId: string,
    actorRole: string | undefined,
    orderId: string,
    approve: boolean,
  ): Promise<{ status: RefundStatus }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refund: true, event: { select: { organizerId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.event.organizerId !== actorId && !this.isPlatformStaff(actorRole))
      throw new ForbiddenException('Only the organizer or staff can process refunds');
    if (!order.refund) throw new NotFoundException('No refund request for this order');
    if (order.refund.status !== RefundStatus.REQUESTED)
      throw new BadRequestException('Refund already processed');

    if (!approve) {
      await this.prisma.refund.update({
        where: { orderId },
        data: { status: RefundStatus.REJECTED, processedById: actorId, processedAt: new Date() },
      });
      return { status: RefundStatus.REJECTED };
    }

    // Approve + process (mock settlement): refund money, cancel tickets, restock.
    await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { orderId },
        data: { status: RefundStatus.PROCESSED, processedById: actorId, processedAt: new Date() },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDED, paymentStatus: PaymentStatus.REFUNDED },
      });
      const tickets = await tx.eTicket.findMany({ where: { orderId }, select: { id: true, ticketTierId: true } });
      await tx.eTicket.updateMany({
        where: { orderId },
        data: { status: TicketStatus.REFUNDED },
      });
      // Restock each tier.
      const perTier = new Map<string, number>();
      for (const t of tickets) perTier.set(t.ticketTierId, (perTier.get(t.ticketTierId) ?? 0) + 1);
      for (const [tierId, count] of perTier) {
        await tx.ticketTier.update({
          where: { id: tierId },
          data: { quantitySold: { decrement: count } },
        });
      }
    });

    await this.notifications.create({
      userId: order.buyerId,
      type: NotificationType.SYSTEM,
      title: 'Refund processed',
      body: `Your refund for order ${order.code} has been processed`,
      actorId,
      targetType: 'ORDER',
      targetId: orderId,
      deepLink: `/orders/${orderId}`,
    });

    return { status: RefundStatus.PROCESSED };
  }

  // ------------------------------ Hold cleanup -----------------------------

  async cancelOrder(userId: string, orderId: string): Promise<{ success: boolean }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId) throw new ForbiddenException('You can only cancel your own order');
    if (order.status === OrderStatus.PAID)
      throw new BadRequestException('Paid orders must be refunded, not cancelled');
    if (order.status === OrderStatus.CANCELLED)
      throw new BadRequestException('Order already cancelled');
    await this.releaseOrder(orderId, OrderStatus.CANCELLED, order.paymentStatus);
    return { success: true };
  }

  /** Restock tiers + mark order/payment status when an order is released. */
  private async releaseOrder(
    orderId: string,
    status: OrderStatus,
    paymentStatus: PaymentStatus,
    note?: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) return;
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.REFUNDED) return;

    await this.prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        await tx.ticketTier.update({
          where: { id: line.ticketTierId },
          data: { quantitySold: { decrement: line.quantity } },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status, paymentStatus, holdExpiresAt: null },
      });
      if (note) {
        await tx.payment.update({ where: { orderId }, data: { note } }).catch(() => undefined);
      }
      await tx.eTicket.updateMany({
        where: { orderId },
        data: { status: TicketStatus.CANCELLED },
      });
    });
  }

  /** Cron: release orders whose hold window has expired. */
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredHolds(): Promise<void> {
    const expired = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.HELD, OrderStatus.PENDING] },
        holdExpiresAt: { lt: new Date() },
      },
      select: { id: true },
      take: 200,
    });
    for (const o of expired) {
      await this.releaseOrder(o.id, OrderStatus.CANCELLED, PaymentStatus.PENDING).catch((e) =>
        this.logger.warn(`Failed to release order ${o.id}: ${(e as Error).message}`),
      );
    }
    if (expired.length) this.logger.log(`Released ${expired.length} expired ticket hold(s)`);
  }

  // ------------------------------- Sales summary ---------------------------

  async eventSalesSummary(actorId: string, actorRole: string | undefined, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId }, select: { organizerId: true, currency: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== actorId && !this.isPlatformStaff(actorRole))
      throw new ForbiddenException('Only the organizer can view sales');

    const [paidAgg, ticketAgg, checkedIn, pendingApproval] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { eventId, status: OrderStatus.PAID },
        _sum: { total: true, platformFee: true, discount: true },
        _count: { _all: true },
      }),
      this.prisma.eTicket.aggregate({
        where: { eventId, status: { in: [TicketStatus.VALID, TicketStatus.USED] } },
        _count: { _all: true },
      }),
      this.prisma.eTicket.count({ where: { eventId, status: TicketStatus.USED } }),
      this.prisma.order.count({ where: { eventId, paymentStatus: PaymentStatus.AWAITING_APPROVAL } }),
    ]);

    const gross = Number(paidAgg._sum.total?.toString() ?? 0);
    const fees = Number(paidAgg._sum.platformFee?.toString() ?? 0);
    return {
      currency: event.currency,
      orders: paidAgg._count._all,
      ticketsSold: ticketAgg._count._all,
      checkedIn,
      pendingApproval,
      gross: money(gross),
      platformFee: money(fees),
      netPayout: money(gross - fees),
    };
  }
}
