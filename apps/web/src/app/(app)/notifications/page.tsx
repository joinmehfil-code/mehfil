'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AppNotification } from '@mehfil/shared';
import { SOCKET_EVENTS } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { notificationsApi } from '@/lib/services';
import { getSocket } from '@/lib/socket';
import { cn, timeAgo } from '@/lib/cn';
import { Avatar, Button, EmptyState, Spinner } from '@/components/ui';

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async (unreadOnlyFlag: boolean) => {
    setLoading(true);
    try {
      const res = await notificationsApi.list(1, 40, unreadOnlyFlag);
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(unreadOnly);
  }, [unreadOnly, load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    function onNew(n: AppNotification) {
      setItems((list) => (list.some((x) => x.id === n.id) ? list : [n, ...list]));
    }
    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, []);

  async function markAll() {
    await notificationsApi.markAllRead();
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  }

  async function markOne(n: AppNotification) {
    if (n.read) return;
    await notificationsApi.markRead(n.id).catch(() => undefined);
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.notifications.title}</h1>
        <Button size="sm" variant="secondary" onClick={markAll}>
          {t.notifications.markAllRead}
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-content-muted">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-surface-border text-brand-600"
          checked={unreadOnly}
          onChange={(e) => setUnreadOnly(e.target.checked)}
        />
        Unread only
      </label>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Spinner className="h-7 w-7 text-brand-600" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t.notifications.empty} />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const inner = (
              <div
                className={cn(
                  'card flex items-start gap-3',
                  !n.read && 'border-brand-300 bg-brand-50/40',
                )}
              >
                <Avatar src={n.actor?.avatarUrl} alt={n.actor?.displayName ?? n.type} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-content-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-content-muted">{timeAgo(n.createdAt, locale)}</p>
                </div>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
              </div>
            );
            return n.deepLink ? (
              <Link key={n.id} href={n.deepLink} onClick={() => markOne(n)} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id} onClick={() => markOne(n)}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
