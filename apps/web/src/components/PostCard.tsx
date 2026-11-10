'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import type { Comment, Post } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { postsApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { cn, timeAgo } from '@/lib/cn';
import { Avatar, Badge, Button, Spinner, Textarea } from '@/components/ui';

export function PostCard({
  post,
  onChanged,
  onRemove,
}: {
  post: Post;
  onChanged?: (post: Post) => void;
  onRemove?: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [reacting, setReacting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liked = !!post.myReaction;

  async function toggleLike() {
    setReacting(true);
    try {
      const next = { ...post } as Post;
      if (liked) {
        await postsApi.unreact(post.id);
        next.myReaction = null;
        next.likeCount = Math.max(0, post.likeCount - 1);
      } else {
        await postsApi.react(post.id, 'LIKE');
        next.myReaction = 'LIKE' as Post['myReaction'];
        next.likeCount = post.likeCount + 1;
      }
      onChanged?.(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setReacting(false);
    }
  }

  async function toggleBookmark() {
    try {
      await postsApi.bookmark(post.id);
      setBookmarked((b) => !b);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    }
  }

  async function loadComments() {
    setShowComments(true);
    if (comments) return;
    setLoadingComments(true);
    try {
      const list = await postsApi.comments(post.id);
      setComments(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitComment() {
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    try {
      const c = await postsApi.addComment(post.id, content);
      setComments((prev) => [...(prev ?? []), c]);
      setDraft('');
      const next = { ...post, commentCount: post.commentCount + 1 } as Post;
      onChanged?.(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setPosting(false);
    }
  }

  async function votePoll(optionId: string) {
    try {
      await postsApi.votePoll(optionId);
      const fresh = await postsApi.get(post.id);
      onChanged?.(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    }
  }

  const totalVotes = post.poll?.options.reduce((s, o) => s + o.votes, 0) ?? 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-3xl p-5 transition-shadow duration-300 hover:shadow-glass"
    >
      <header className="flex items-start gap-3">
        <Link href={`/u/${post.author.username}`}>
          <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <Link href={`/u/${post.author.username}`} className="font-semibold hover:underline">
              {post.author.displayName}
            </Link>
            <span className="text-xs text-content-muted">@{post.author.username}</span>
            <span className="text-xs text-content-muted">· {timeAgo(post.createdAt, locale)}</span>
          </div>
          {post.community && (
            <Link
              href={`/communities/${post.community.slug}`}
              className="text-xs text-brand-300 hover:text-brand-200 hover:underline"
            >
              {post.community.name}
            </Link>
          )}
        </div>
        {post.canDelete && onRemove && user?.id === post.author.id && (
          <Button variant="ghost" size="sm" onClick={() => onRemove(post.id)}>
            {t.common.delete}
          </Button>
        )}
      </header>

      {post.content && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
      )}

      {post.hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {post.hashtags.map((h) => (
            <Link key={h} href={`/feed?tag=${encodeURIComponent(h)}`}>
              <Badge color="brand">#{h.replace(/^#/, '')}</Badge>
            </Link>
          ))}
        </div>
      )}

      {post.media.length > 0 && (
        <div className="mt-3 grid gap-2 overflow-hidden rounded-xl">
          {post.media.map((m) =>
            m.kind === 'IMAGE' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="" className="max-h-96 w-full rounded-xl object-cover" />
            ) : (
              <a key={m.id} href={m.url} className="text-sm text-brand-300 hover:text-brand-200 hover:underline">
                {m.kind === 'VIDEO' ? 'Video attachment' : 'File attachment'}
              </a>
            ),
          )}
        </div>
      )}

      {post.poll && (
        <div className="mt-4 space-y-2">
          <p className="font-semibold">{post.poll.question}</p>
          {post.poll.options.map((o) => {
            const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
            return (
              <button
                key={o.id}
                onClick={() => !o.votedByMe && votePoll(o.id)}
                disabled={!!o.votedByMe}
                className={cn(
                  'relative w-full overflow-hidden rounded-lg border border-white/10 px-3 py-2 text-start text-sm transition-colors',
                  o.votedByMe ? 'border-brand-400/60' : 'hover:bg-white/5',
                )}
              >
                <span
                  className="absolute inset-y-0 start-0 bg-brand-500/25"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between">
                  <span className="font-medium">{o.text}</span>
                  <span className="text-xs text-content-muted">{pct}%</span>
                </span>
              </button>
            );
          })}
          <p className="text-xs text-content-muted">{totalVotes} votes</p>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}

      <div className="mt-4 flex items-center gap-1 border-t border-white/10 pt-3">
        <button
          onClick={toggleLike}
          disabled={reacting}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            liked ? 'text-rose-400' : 'text-content-muted hover:bg-white/5',
          )}
        >
          <motion.span whileTap={{ scale: 0.7 }} className="grid place-items-center">
            <Heart className={cn('h-5 w-5', liked && 'fill-current')} />
          </motion.span>
          {post.likeCount > 0 && post.likeCount}
          <span className="hidden sm:inline">{t.feed.like}</span>
        </button>
        <button
          onClick={loadComments}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-content-muted transition-colors hover:bg-white/5"
        >
          <MessageCircle className="h-5 w-5" />
          {post.commentCount > 0 && post.commentCount}
          <span className="hidden sm:inline">{t.feed.comment}</span>
        </button>
        <button
          onClick={() => postsApi.share(post.id).catch(() => undefined)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-content-muted transition-colors hover:bg-white/5"
        >
          <Share2 className="h-5 w-5" />
          <span className="hidden sm:inline">{t.common.share}</span>
        </button>
        <button
          onClick={toggleBookmark}
          className={cn(
            'ms-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            bookmarked ? 'text-brand-300' : 'text-content-muted hover:bg-white/5',
          )}
        >
          <Bookmark className={cn('h-5 w-5', bookmarked && 'fill-current')} />
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {loadingComments ? (
            <Spinner className="h-5 w-5 text-brand-400" />
          ) : (
            comments?.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Link href={`/u/${c.author.username}`}>
                  <Avatar src={c.author.avatarUrl} alt={c.author.displayName} size={32} />
                </Link>
                <div className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.author.displayName}</span>
                    <span className="text-xs text-content-muted">{timeAgo(c.createdAt, locale)}</span>
                  </div>
                  <p className="text-sm">{c.content}</p>
                </div>
              </div>
            ))
          )}
          {comments && comments.length === 0 && !loadingComments && (
            <p className="text-sm text-content-muted">{t.common.noResults}</p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.feed.writeComment}
              className="min-h-[42px] flex-1"
            />
            <Button size="sm" onClick={submitComment} loading={posting} disabled={!draft.trim()}>
              {t.common.submit}
            </Button>
          </div>
        </div>
      )}
    </motion.article>
  );
}
