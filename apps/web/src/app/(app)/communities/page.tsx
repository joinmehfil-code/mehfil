'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Community } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { communitiesApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Button, EmptyState, Field, Input, Spinner, Textarea } from '@/components/ui';

function CommunityCard({
  community,
  onChanged,
}: {
  community: Community;
  onChanged?: (c: Community) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function toggleJoin() {
    setBusy(true);
    try {
      if (community.isMember) {
        await communitiesApi.leave(community.id);
        onChanged?.({ ...community, isMember: false, memberCount: Math.max(0, community.memberCount - 1) });
      } else {
        await communitiesApi.join(community.id);
        onChanged?.({ ...community, isMember: true, memberCount: community.memberCount + 1 });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex items-start gap-3">
      <Link href={`/communities/${community.slug}`}>
        <Avatar src={community.avatarUrl} alt={community.name} size={48} className="rounded-xl" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/communities/${community.slug}`} className="flex items-center gap-2">
          <span className="truncate font-semibold hover:underline">{community.name}</span>
          <Badge color={community.access === 'PUBLIC' ? 'green' : 'amber'}>{community.access}</Badge>
        </Link>
        {community.description && (
          <p className="mt-1 line-clamp-2 text-sm text-content-muted">{community.description}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-content-muted">
          <span>
            <b className="text-content">{community.memberCount}</b> {t.communities.members}
          </span>
          {community.category && <span>{community.category}</span>}
          {community.city && <span>{community.city}</span>}
        </div>
      </div>
      <Button
        size="sm"
        variant={community.isMember ? 'secondary' : 'primary'}
        loading={busy}
        onClick={toggleJoin}
      >
        {community.isMember ? t.common.leave : t.common.join}
      </Button>
    </div>
  );
}

export default function CommunitiesPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'mine' | 'discover'>('discover');
  const [items, setItems] = useState<Community[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', access: 'PUBLIC', category: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: 'mine' | 'discover', q: string) => {
    setLoading(true);
    try {
      const res =
        active === 'mine'
          ? await communitiesApi.mine(1, 30)
          : await communitiesApi.discover({ search: q || undefined, limit: 30 });
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

  function patch(c: Community) {
    setItems((list) => list.map((x) => (x.id === c.id ? c : x)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await communitiesApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        access: form.access,
        category: form.category.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ name: '', description: '', access: 'PUBLIC', category: '' });
      setTab('mine');
      await load('mine', '');
      setItems((list) => (list.some((c) => c.id === created.id) ? list : [created, ...list]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.communities.title}</h1>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          {t.communities.create}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="card space-y-3">
          <Field label={t.communities.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t.communities.description}>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.communities.access}>
              <select
                className="input"
                value={form.access}
                onChange={(e) => setForm({ ...form, access: e.target.value })}
              >
                <option value="PUBLIC">{t.communities.public}</option>
                <option value="PRIVATE">{t.communities.private}</option>
                <option value="SECRET">{t.communities.secret}</option>
              </select>
            </Field>
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={creating} disabled={!form.name.trim()}>
              {t.common.create}
            </Button>
          </div>
        </form>
      )}

      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(
          [
            { id: 'discover', label: t.communities.discover },
            { id: 'mine', label: t.communities.yourCommunities },
          ] as { id: 'mine' | 'discover'; label: string }[]
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
        <EmptyState title={t.common.noResults} />
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <CommunityCard key={c.id} community={c} onChanged={patch} />
          ))}
        </div>
      )}
    </div>
  );
}
