import { Prisma } from '@prisma/client';
import {
  EventSummary,
  EventDetail,
  TicketTier as TicketTierApi,
  Order as OrderApi,
  OrderLine as OrderLineApi,
  ETicket as ETicketApi,
  Venue,
  EventType,
  EventStatus,
  EventRsvpStatus,
  TicketType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  TicketStatus,
} from '@mehfil/shared';
import { toAuthor } from '../users/user.mapper';
import { toNumber, toIso } from '../common/utils/serialize.util';

/** Canonical include for event queries — the API type derives from it. */
export const EVENT_INCLUDE = {
  organizer: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  community: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

type EventRow = Prisma.EventGetPayload<Record<string, never>>;

function buildVenue(e: EventRow): Venue | null {
  if (!e.venueName && !e.venueAddress && !e.venueCity && !e.isOnline) return null;
  return {
    name: e.venueName,
    address: e.venueAddress,
    city: e.venueCity,
    country: e.venueCountry,
    location:
      e.venueLat != null && e.venueLng != null ? { lat: e.venueLat, lng: e.venueLng } : null,
    mapUrl: e.venueMapUrl,
  };
}

export function toEventSummary(
  e: EventWithRelations,
  myRsvp?: EventRsvpStatus | string | null,
): EventSummary {
  return {
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    title: e.title,
    slug: e.slug,
    description: e.description,
    coverUrl: e.coverUrl,
    type: e.type as EventType,
    status: e.status as EventStatus,
    startsAt: e.startsAt.toISOString(),
    endsAt: toIso(e.endsAt),
    timezone: e.timezone,
    isOnline: e.isOnline,
    venue: buildVenue(e),
    communityId: e.communityId,
    organizer: toAuthor(e.organizer),
    attendeeCount: e.attendeeCount,
    ticketCount: e.ticketCount,
    priceMin: toNumber(e.priceMin, 0) || null,
    currency: e.currency,
    myRsvp: (myRsvp as EventRsvpStatus) ?? null,
  };
}

export function toTicketTierApi(t: {
  id: string;
  name: string;
  description: string | null;
  type: TicketType | string;
  price: Prisma.Decimal | number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  minPerOrder: number;
  maxPerOrder: number;
}): TicketTierApi {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type as TicketType,
    price: toNumber(t.price),
    currency: t.currency,
    quantityTotal: t.quantityTotal,
    quantitySold: t.quantitySold,
    quantityAvailable: Math.max(0, t.quantityTotal - t.quantitySold),
    saleStartsAt: toIso(t.saleStartsAt),
    saleEndsAt: toIso(t.saleEndsAt),
    minPerOrder: t.minPerOrder,
    maxPerOrder: t.maxPerOrder,
  };
}

export function toEventDetail(
  e: EventWithRelations,
  tiers: ReturnType<typeof toTicketTierApi>[],
  myRsvp?: EventRsvpStatus | string | null,
): EventDetail {
  const totalQty = tiers.reduce((s, t) => s + t.quantityTotal, 0);
  const soldQty = tiers.reduce((s, t) => s + t.quantitySold, 0);
  return {
    ...toEventSummary(e, myRsvp),
    tickets: tiers,
    isSoldOut: totalQty > 0 && soldQty >= totalQty,
    hasWaitlist: e.hasWaitlist,
    onlineUrl: e.onlineUrl,
    refundPolicy: e.refundPolicy,
  };
}

export function toETicketApi(
  t: {
    id: string;
    orderId: string;
    eventId: string;
    ticketTierName: string;
    code: string;
    qrPayload: string;
    status: TicketStatus | string;
    attendeeName: string | null;
    attendeeEmail: string | null;
    checkedInAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  eventTitle: string,
): ETicketApi {
  return {
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    orderId: t.orderId,
    eventId: t.eventId,
    eventTitle,
    ticketTierName: t.ticketTierName,
    code: t.code,
    qrPayload: t.qrPayload,
    status: t.status as TicketStatus,
    attendeeName: t.attendeeName,
    attendeeEmail: t.attendeeEmail,
    checkedInAt: toIso(t.checkedInAt),
  };
}

type OrderRow = Prisma.OrderGetPayload<{
  include: { lines: true; tickets: true; event: { select: { id: true; title: true; slug: true } } };
}>;

export function toOrderApi(o: OrderRow): OrderApi {
  const lines: OrderLineApi[] = o.lines.map((l) => ({
    id: l.id,
    ticketTierId: l.ticketTierId,
    ticketTierName: l.ticketTierName,
    quantity: l.quantity,
    unitPrice: toNumber(l.unitPrice),
    total: toNumber(l.total),
  }));
  return {
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    code: o.code,
    eventId: o.eventId,
    eventTitle: o.event.title,
    buyerId: o.buyerId,
    status: o.status as OrderStatus,
    paymentMethod: o.paymentMethod as PaymentMethod,
    paymentStatus: o.paymentStatus as PaymentStatus,
    subtotal: toNumber(o.subtotal),
    discount: toNumber(o.discount),
    platformFee: toNumber(o.platformFee),
    total: toNumber(o.total),
    currency: o.currency,
    promoCode: o.promoCode,
    lines,
    tickets: o.tickets.map((t) => toETicketApi(t, o.event.title)),
  };
}

export type { OrderRow };
