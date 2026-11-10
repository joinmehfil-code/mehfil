'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Community, CommunitySpace, Post } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { communitiesApi, postsApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Button, EmptyState, Spinner } from '@/components/ui';
import { Composer } from '@/components/Composer';
import { PostCard } from '@/components/PostCard';

export default function CommunityDetailPage() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [spaces, setSpaces] = useState<CommunitySpace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [spaceId, setSpaceId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<'posts' | 'spaces'>('posts');
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    communitiesApi
      .get(slug)
      .then(async (c) => {
        if (cancelled) return;
        setCommunity(c);
        try {
          const sp = await communitiesApi.spaces(c.id);
          if (!cancelled) setSpaces(sp);
        } catch {
          /* spaces optional */
        }
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : t.common.error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, t.common.error]);

  const loadPosts = useCallback(
    async (activeSpace?: string) => {
      if (!community) return;
      setListLoading(true);
      try {
        const res = await postsApi.byCommunity(community.id, 1, 30, activeSpace);
        setPosts(res.items);
      } catch {
        setPosts([]);
      } finally {
        setListLoading(false);
      }
    },
    [community],
  );

  useEffect(() => {
    if (community && tab === 'posts') void loadPosts(spaceId);
  }, [community, tab, spaceId, loadPosts]);

  async function toggleJoin() {
    if (!community) return;
    setBusy(true);
    try {
      if (community.isMember) {
        await communitiesApi.leave(community.id);
        setCommunity({ ...community, isMember: false, memberCount: Math.max(0, community.memberCount - 1) });
      } else {
        await communitiesApi.join(community.id);
        setCommunity({ ...community, isMember: true, memberCount: community.memberCount + 1 });
      }
    } finally {
      setBusy(false);
    }
  }

  function patchPost(updated: Post) {
    setPosts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="h-8 w-8 text-brand-300" />
      </div>
    );
  }
  if (error || !community) return <EmptyState title={error ?? t.common.noResults} />;

  const isOwner = community.owner?.id === user?.id;
  const canPost = community.isMember || community.access === 'PUBLIC';

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden !p-0">
        <div className="h-28 bg-gradient-to-r from-brand-500 to-accent-500" />
        <div className="p-4">
          <div className="-mt-14 flex items-end justify-between">
            <Avatar
              src={community.avatarUrl}
              alt={community.name}
              size={80}
              className="rounded-xl ring-4 ring-surface"
            />
            <Button
              size="sm"
              variant={community.isMember ? 'secondary' : 'primary'}
              loading={busy}
              onClick={toggleJoin}
              className="mb-2"
            >
              {community.isMember ? t.common.leave : t.common.join}
            </Button>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="gradient-text text-xl font-extrabold tracking-tight">{community.name}</h1>
              <Badge color={community.access === 'PUBLIC' ? 'green' : 'amber'}>{community.access}</Badge>
            </div>
            {community.description && <p className="mt-1 text-sm text-content-muted">{community.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-content-muted">
              <span>
                <b className="text-content">{community.memberCount}</b> {t.communities.members}
              </span>
              {community.category && <span>{community.category}</span>}
              {community.city && <span>{community.city}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(
          [
            { id: 'posts', label: t.profile.posts },
            { id: 'spaces', label: t.communities.spaces },
          ] as { id: 'posts' | 'spaces'; label: string }[]
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

      {tab === 'posts' ? (
        <>
          {spaces.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSpaceId(undefined)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  !spaceId ? 'bg-brand-gradient text-ink-900 shadow-glow' : 'bg-surface text-content-muted',
                )}
              >
                {t.common.viewAll}
              </button>
              {spaces.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSpaceId(s.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    spaceId === s.id ? 'bg-brand-gradient text-ink-900 shadow-glow' : 'bg-surface text-content-muted',
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {canPost && (
            <Composer
              communityId={community.id}
              spaceId={spaceId}
              onCreated={(p) => setPosts((l) => [p, ...l])}
            />
          )}
          {listLoading ? (
            <div className="grid place-items-center py-12">
              <Spinner className="h-7 w-7 text-brand-300" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState title={t.feed.noPosts} />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} onChanged={patchPost} />
              ))}
            </div>
          )}
        </>
      ) : spaces.length === 0 ? (
        <EmptyState title={t.common.noResults} description={isOwner ? undefined : undefined} />
      ) : (
        <div className="space-y-3">
          {spaces.map((s) => (
            <div key={s.id} className="card flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <Badge color="gray">{s.type}</Badge>
                  {s.isPrivate && <Badge color="amber">{t.communities.private}</Badge>}
                </div>
                {s.description && <p className="text-sm text-content-muted">{s.description}</p>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setTab('posts'); setSpaceId(s.id); }}>
                {t.common.viewAll}
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-content-muted">
        <Link href="/communities" className="hover:underline">
          {t.communities.title}
        </Link>
      </p>
    </div>
  );
}
