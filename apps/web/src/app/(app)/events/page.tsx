'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { EventSummary } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { eventsApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { cn, formatMoney } from '@/lib/cn';
import { Avatar, Badge, Button, EmptyState, Field, Input, Spinner, Textarea } from '@/components/ui';

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === 'ur' ? 'ur-PK' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function EventCard({ event, locale }: { event: EventSummary; locale: string }) {
  const { t } = useI18n();
  const free = event.priceMin === null || event.priceMin === 0;
  return (
    <Link href={`/events/${event.slug}`} className="card block transition-shadow hover:shadow-lg">
      {event.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverUrl} alt="" className="h-40 w-full rounded-t-xl object-cover" />
      ) : (
        <div className="h-24 w-full rounded-t-xl bg-gradient-to-r from-brand-500 to-accent-500" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-tight">{event.title}</h3>
          <Badge color={free ? 'green' : 'accent'}>
            {free ? t.events.free : formatMoney(event.priceMin ?? 0, event.currency)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-content-muted">{formatDate(event.startsAt, locale)}</p>
        {event.venue?.city && <p className="text-sm text-content-muted">{event.venue.city}</p>}
        <div className="mt-3 flex items-center gap-2">
          <Avatar src={event.organizer.avatarUrl} alt={event.organizer.displayName} size={24} />
          <span className="text-xs text-content-muted">{event.organizer.displayName}</span>
          <span className="ms-auto text-xs text-content-muted">
            {event.attendeeCount} {t.events.going}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<'discover' | 'attending' | 'mine'>('discover');
  const [items, setItems] = useState<EventSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startsAt: '',
    venueName: '',
    city: '',
    isOnline: false,
    free: true,
    price: '',
    quantity: '100',
  });

  const load = useCallback(async (active: typeof tab, q: string) => {
    setLoading(true);
    try {
      const res =
        active === 'attending'
          ? await eventsApi.attending(1, 30)
          : active === 'mine'
            ? await eventsApi.mine(1, 30)
            : await eventsApi.discover({ search: q || undefined, limit: 30 });
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab, search);
  }, [tab, load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        isOnline: form.isOnline,
        venue: form.venueName || form.city ? { name: form.venueName, city: form.city } : undefined,
      };
      const created = await eventsApi.create(payload);
      if (!form.free && form.price) {
        await eventsApi.addTier(created.id, {
          name: 'General',
          type: 'PAID',
          price: Number(form.price),
          currency: 'PKR',
          quantityTotal: Number(form.quantity),
        });
      } else {
        await eventsApi.addTier(created.id, {
          name: 'Free',
          type: 'FREE',
          price: 0,
          currency: 'PKR',
          quantityTotal: Number(form.quantity),
        });
      }
      setShowCreate(false);
      setTab('mine');
      await load('mine', '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.events.title}</h1>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          {t.events.create}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="card space-y-3">
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <Field label={t.communities.description}>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.events.when}>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </Field>
            <Field label={t.profile.city}>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
          </div>
          <Field label={t.events.venue}>
            <Input value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-surface-border text-brand-300"
              checked={form.isOnline}
              onChange={(e) => setForm({ ...form, isOnline: e.target.checked })}
            />
            Online event
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-surface-border text-brand-300"
                checked={form.free}
                onChange={(e) => setForm({ ...form, free: e.target.checked })}
              />
              {t.events.free}
            </label>
            {!form.free && (
              <Field label={t.events.price}>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="Ticket quantity">
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={creating} disabled={!form.title.trim() || !form.startsAt}>
              {t.common.create}
            </Button>
          </div>
        </form>
      )}

      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(
          [
            { id: 'discover', label: t.events.discover },
            { id: 'attending', label: t.events.attending },
            { id: 'mine', label: t.events.myEvents },
          ] as { id: typeof tab; label: string }[]
        ).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              tab === tb.id ? 'bg-brand-gradient text-ink-900 shadow-glow' : 'text-content-muted hover:text-content',
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'discover' && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load('discover', search)}
          placeholder={t.common.search}
        />
      )}

      {loading ? (
        <div className="grid place-items-center py-12">
          <Spinner className="h-7 w-7 text-brand-300" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t.events.noEvents} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((ev) => (
            <EventCard key={ev.id} event={ev} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
