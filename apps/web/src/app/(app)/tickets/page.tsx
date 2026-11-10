'use client';

import { useEffect, useState } from 'react';
import type { ETicket } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { ticketsApi } from '@/lib/services';
import { cn } from '@/lib/cn';
import { Badge, Button, EmptyState, Spinner } from '@/components/ui';

const statusColor: Record<string, 'green' | 'gray' | 'red' | 'amber' | 'brand'> = {
  VALID: 'green',
  USED: 'gray',
  CANCELLED: 'red',
  REFUNDED: 'amber',
  EXPIRED: 'red',
};

export default function TicketsPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<ETicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ticketsApi
      .mine(1, 50)
      .then((res) => !cancelled && setTickets(res.items))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleQr(ticket: ETicket) {
    if (openId === ticket.id) {
      setOpenId(null);
      return;
    }
    setOpenId(ticket.id);
    if (qrMap[ticket.id]) return;
    setQrLoading(true);
    try {
      const res = await ticketsApi.qr(ticket.id);
      setQrMap((m) => ({ ...m, [ticket.id]: res.qr }));
    } catch {
      /* ignore */
    } finally {
      setQrLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.events.myTickets}</h1>

      {tickets.length === 0 ? (
        <EmptyState title={t.common.noResults} description={t.events.noEvents} />
      ) : (
        <div className="space-y-3">
          {tickets.map((tk) => (
            <div key={tk.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{tk.eventTitle}</h3>
                  <p className="text-sm text-content-muted">{tk.ticketTierName}</p>
                  <p className="mt-1 font-mono text-xs text-content-muted">{tk.code}</p>
                  {tk.checkedInAt && (
                    <p className="text-xs text-content-muted">Checked in</p>
                  )}
                </div>
                <Badge color={statusColor[tk.status] ?? 'brand'}>{tk.status}</Badge>
              </div>
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => toggleQr(tk)}>
                  {openId === tk.id ? t.common.close : 'Show QR'}
                </Button>
              </div>
              {openId === tk.id && (
                <div className="mt-3 grid place-items-center rounded-xl bg-white p-4">
                  {qrLoading && !qrMap[tk.id] ? (
                    <Spinner className="h-8 w-8 text-brand-600" />
                  ) : qrMap[tk.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrMap[tk.id]} alt="ticket QR" className={cn('h-48 w-48')} />
                  ) : (
                    <p className="text-sm text-content-muted">{t.common.error}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
