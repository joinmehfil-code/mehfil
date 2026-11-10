'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminStats } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { adminApi } from '@/lib/services';
import { formatMoney } from '@/lib/cn';
import { Avatar, Badge, Button, EmptyState, Input, Spinner } from '@/components/ui';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
  counts?: { followers: number; following: number; posts: number };
}

const statusColor: Record<string, 'green' | 'red' | 'amber' | 'gray' | 'brand'> = {
  ACTIVE: 'green',
  SUSPENDED: 'amber',
  BANNED: 'red',
  PENDING: 'gray',
  DEACTIVATED: 'gray',
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs text-content-muted">{sub}</p>}
    </div>
  );
}

function Bars({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={`w-full rounded-t ${color}`}
            style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
            title={`${d.date}: ${d.count}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [growth, setGrowth] = useState<{ date: string; count: number }[]>([]);
  const [revenue, setRevenue] = useState<{ date: string; count: number; revenue: number }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);

  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!isStaff) return;
    setLoading(true);
    Promise.all([adminApi.stats(), adminApi.userGrowth(14), adminApi.revenue(14)])
      .then(([s, g, r]) => {
        setStats(s);
        setGrowth(g);
        setRevenue(r);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [isStaff]);

  const loadUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    try {
      const res = await adminApi.users({ search: q || undefined, limit: 30 });
      setUsers(res.items as AdminUser[]);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStaff) void loadUsers('');
  }, [isStaff, loadUsers]);

  async function setStatus(id: string, status: string) {
    await adminApi.setStatus(id, status);
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, status } : u)));
  }
  async function setRole(id: string, role: string) {
    await adminApi.setRole(id, role);
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  if (!isStaff) {
    return <EmptyState title="Admins only" />;
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.admin.title}</h1>

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t.admin.users} value={stats.users.total} sub={`+${stats.users.newToday} today`} />
            <StatCard label={t.admin.communities} value={stats.communities.total} sub={`+${stats.communities.newThisWeek} this week`} />
            <StatCard label={t.admin.events} value={stats.events.total} sub={`${stats.events.upcoming} upcoming`} />
            <StatCard label={t.admin.posts} value={stats.posts.total} sub={`+${stats.posts.newToday} today`} />
            <StatCard label={t.admin.orders} value={stats.orders.total} sub={`${stats.orders.paid} paid`} />
            <StatCard
              label={t.admin.revenue}
              value={formatMoney(stats.orders.revenue, stats.orders.currency)}
              sub={t.admin.orders}
            />
            <StatCard label={t.admin.ticketsSold} value={stats.tickets.sold} sub={`${stats.tickets.checkedIn} ${t.admin.checkedIn}`} />
            <StatCard label={t.admin.openReports} value={stats.reports.open} sub={`${stats.reports.resolved} ${t.admin.resolvedReports}`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <p className="mb-3 text-sm font-semibold">{t.admin.growth} · {t.admin.users} (14d)</p>
              <Bars data={growth} color="bg-brand-500" />
            </div>
            <div className="card">
              <p className="mb-3 text-sm font-semibold">{t.admin.revenue} (14d)</p>
              <Bars data={revenue} color="bg-accent-500" />
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers(search)}
            placeholder={t.common.search}
            className="flex-1"
          />
          <Button onClick={() => loadUsers(search)}>{t.common.search}</Button>
        </div>

        {usersLoading ? (
          <div className="grid place-items-center py-8">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState title={t.common.noResults} />
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-border p-3">
                <Avatar src={u.avatarUrl} alt={u.displayName} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{u.displayName}</span>
                    <Badge color={statusColor[u.status] ?? 'brand'}>{u.status}</Badge>
                    <Badge color="gray">{u.role}</Badge>
                  </div>
                  <div className="truncate text-xs text-content-muted">
                    @{u.username} · {u.email}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {u.status === 'ACTIVE' ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setStatus(u.id, 'SUSPENDED')}>
                        {t.admin.suspend}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setStatus(u.id, 'BANNED')}>
                        {t.admin.ban}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setStatus(u.id, 'ACTIVE')}>
                      {t.admin.activate}
                    </Button>
                  )}
                  {u.role !== 'ADMIN' && (
                    <Button size="sm" variant="ghost" onClick={() => setRole(u.id, 'ADMIN')}>
                      {t.admin.makeAdmin}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
