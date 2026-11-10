'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Post } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { postsApi } from '@/lib/services';
import { cn } from '@/lib/cn';
import { Composer } from '@/components/Composer';
import { PostCard } from '@/components/PostCard';
import { Button, CardSkeleton, EmptyState } from '@/components/ui';
import { Reveal } from '@/components/motion';

type Tab = 'foryou' | 'trending' | 'bookmarks';

export default function FeedPage() {
  const { t } = useI18n();
  const params = useSearchParams();
  const tag = params.get('tag');
  const [tab, setTab] = useState<Tab>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (nextPage: number, activeTab: Tab, activeTag: string | null) => {
      if (activeTag) return postsApi.byHashtag(activeTag, nextPage);
      if (activeTab === 'trending') return postsApi.trending(nextPage);
      if (activeTab === 'bookmarks') return postsApi.bookmarks(nextPage);
      return postsApi.feed(nextPage);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    load(1, tab, tag)
      .then((res) => {
        if (cancelled) return;
        setPosts(res.items);
        setHasNext(res.hasNext);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, tag, load]);

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const res = await load(next, tab, tag);
      setPosts((p) => [...p, ...res.items]);
      setPage(next);
      setHasNext(res.hasNext);
    } finally {
      setLoadingMore(false);
    }
  }

  function patch(updated: Post) {
    setPosts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  }
  function remove(id: string) {
    postsApi.remove(id).then(() => setPosts((list) => list.filter((p) => p.id !== id)));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'foryou', label: t.feed.forYou },
    { id: 'trending', label: t.feed.trending },
    { id: 'bookmarks', label: t.feed.bookmarks },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="gradient-text text-xl font-extrabold tracking-tight">
          {tag ? `#${tag}` : t.feed.title}
        </h1>
      </div>

      {!tag && (
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          {tabs.map((tb) => (
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
      )}

      {tab === 'foryou' && !tag && <Composer onCreated={(p) => setPosts((l) => [p, ...l])} />}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState title={t.feed.noPosts} />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChanged={patch} onRemove={remove} />
          ))}
          {hasNext && (
            <Reveal className="flex justify-center pt-2">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                {t.common.seeMore}
              </Button>
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
}
