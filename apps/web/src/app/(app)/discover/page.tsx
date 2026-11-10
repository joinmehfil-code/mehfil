'use client';

import { useEffect, useState } from 'react';
import type { PublicUser } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { usersApi } from '@/lib/services';
import { Button, CardSkeleton, EmptyState, Input } from '@/components/ui';
import { Stagger, StaggerItem } from '@/components/motion';
import { UserCard } from '@/components/UserCard';

export default function DiscoverPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    usersApi
      .suggestions(20)
      .then((list) => !cancelled && setPeople(list))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await usersApi.search({ q: term, limit: 30 });
      setPeople(res.items);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  function patch(u: PublicUser) {
    setPeople((list) => list.map((p) => (p.id === u.id ? u : p)));
  }

  return (
    <div className="space-y-4">
      <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.nav.discover}</h1>

      <form onSubmit={search} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.common.search}
          className="flex-1"
        />
        <Button type="submit">{t.common.search}</Button>
      </form>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState title={t.common.noResults} />
      ) : (
        <div className="space-y-3">
          {!searched && (
            <p className="text-sm font-semibold text-content-muted">{t.communities.discover}</p>
          )}
          <Stagger className="space-y-3">
            {people.map((p) => (
              <StaggerItem key={p.id}>
                <UserCard person={p} onChanged={patch} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      )}
    </div>
  );
}
