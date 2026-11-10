'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { EventDetail, Order } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { eventsApi, ticketingApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { cn, formatMoney } from '@/lib/cn';
import { Avatar, Badge, Button, EmptyState, Spinner } from '@/components/ui';

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === 'ur' ? 'ur-PK' : 'en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function EventDetailPage() {
  const { t, locale } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    eventsApi
      .get(slug)
      .then((e) => !cancelled && setEvent(e))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : t.common.error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, t.common.error]);

  async function rsvp(status: string) {
    if (!event) return;
    setBusy(true);
    try {
      await eventsApi.rsvp(event.id, status);
      setEvent({ ...event, myRsvp: status as EventDetail['myRsvp'] });
    } finally {
      setBusy(false);
    }
  }

  const selectedItems = event?.tickets
    .map((tier) => ({ ticketTierId: tier.id, quantity: qty[tier.id] ?? 0 }))
    .filter((i) => i.quantity > 0) ?? [];

  const total = event?.tickets.reduce(
    (sum, tier) => sum + (qty[tier.id] ?? 0) * tier.price,
    0,
  ) ?? 0;

  async function checkout(paymentMethod: string) {
    if (!event || selectedItems.length === 0) return;
    setBusy(true);
    setCheckoutError(null);
    try {
      const res = await ticketingApi.checkout(event.id, { items: selectedItems, paymentMethod });
      setOrder(res);
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="h-8 w-8 text-brand-300" />
      </div>
    );
  }
  if (error || !event) return <EmptyState title={error ?? t.common.noResults} />;

  const isOrganizer = event.organizer.id === user?.id;

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden !p-0">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt="" className="h-52 w-full object-cover" />
        ) : (
          <div className="h-32 w-full bg-gradient-to-r from-brand-500 to-accent-500" />
        )}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="gradient-text text-2xl font-extrabold tracking-tight">{event.title}</h1>
            <Badge color={event.isSoldOut ? 'red' : 'green'}>
              {event.isSoldOut ? t.events.soldOut : event.status}
            </Badge>
          </div>
          {event.description && <p className="text-sm">{event.description}</p>}

          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="font-semibold">{t.events.when}: </span>
              <span className="text-content-muted">{formatDate(event.startsAt, locale)}</span>
            </div>
            {event.venue && (
              <div>
                <span className="font-semibold">{t.events.venue}: </span>
                <span className="text-content-muted">
                  {[event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(', ') ||
                    (event.isOnline ? 'Online' : '—')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t.events.organizer}: </span>
              <Avatar src={event.organizer.avatarUrl} alt={event.organizer.displayName} size={22} />
              <Link href={`/u/${event.organizer.username}`} className="text-brand-300 hover:underline">
                {event.organizer.displayName}
              </Link>
            </div>
            <div>
              <span className="font-semibold">{t.events.attending}: </span>
              <span className="text-content-muted">{event.attendeeCount}</span>
            </div>
          </div>

          {!isOrganizer && (
            <div className="flex flex-wrap gap-2 border-t border-surface-border pt-3">
              <Button
                size="sm"
                variant={event.myRsvp === 'GOING' ? 'primary' : 'secondary'}
                loading={busy}
                onClick={() => rsvp('GOING')}
              >
                {t.events.going}
              </Button>
              <Button
                size="sm"
                variant={event.myRsvp === 'INTERESTED' ? 'primary' : 'secondary'}
                loading={busy}
                onClick={() => rsvp('INTERESTED')}
              >
                {t.events.interested}
              </Button>
            </div>
          )}
        </div>
      </div>

      {order ? (
        <div className="card space-y-3">
          <Badge color="green">{order.status}</Badge>
          <p className="text-sm">
            Order <b>{order.code}</b> · {formatMoney(order.total, order.currency)}
          </p>
          <p className="text-sm text-content-muted">
            Payment: {order.paymentMethod} ({order.paymentStatus})
          </p>
          <div className="flex gap-2">
            <Link href="/tickets" className="flex-1">
              <Button className="w-full">{t.events.myTickets}</Button>
            </Link>
            <Button variant="secondary" onClick={() => router.push('/tickets')}>
              {t.common.viewAll}
            </Button>
          </div>
        </div>
      ) : (
        <div className="card space-y-3">
          <h2 className="font-bold">{t.events.tickets}</h2>
          {event.tickets.length === 0 ? (
            <p className="text-sm text-content-muted">{t.events.free}</p>
          ) : (
            event.tickets.map((tier) => (
              <div key={tier.id} className="flex items-center gap-3 rounded-xl border border-surface-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{tier.name}</span>
                    <Badge color={tier.price > 0 ? 'accent' : 'green'}>
                      {tier.price > 0 ? formatMoney(tier.price, tier.currency) : t.events.free}
                    </Badge>
                  </div>
                  {tier.description && <p className="text-xs text-content-muted">{tier.description}</p>}
                  <p className="text-xs text-content-muted">
                    {tier.quantityAvailable} / {tier.quantityTotal} left
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-lg"
                    onClick={() => setQty((q) => ({ ...q, [tier.id]: Math.max(0, (q[tier.id] ?? 0) - 1) }))}
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold">{qty[tier.id] ?? 0}</span>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-lg"
                    disabled={tier.quantityAvailable <= 0}
                    onClick={() =>
                      setQty((q) => ({
                        ...q,
                        [tier.id]: Math.min(tier.quantityAvailable, (q[tier.id] ?? 0) + 1),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}

          {selectedItems.length > 0 && (
            <div className="space-y-2 border-t border-surface-border pt-3">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatMoney(total, event.currency)}</span>
              </div>
              {checkoutError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{checkoutError}</p>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" loading={busy} onClick={() => checkout(total > 0 ? 'CASH' : 'FREE')}>
                  {total > 0 ? `${t.events.checkout} (Cash on site)` : t.events.getTickets}
                </Button>
                {total > 0 && (
                  <Button variant="secondary" loading={busy} onClick={() => checkout('BANK_TRANSFER')}>
                    Bank transfer
                  </Button>
                )}
              </div>
              <p className={cn('text-xs text-content-muted')}>
                Phase 1 payments are mock/manual. Online gateways arrive in a later phase.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
