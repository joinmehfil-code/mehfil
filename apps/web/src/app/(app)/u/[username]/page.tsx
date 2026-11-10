'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Post, PublicUser, UserProfile } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { postsApi, usersApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { cn, timeAgo } from '@/lib/cn';
import { Avatar, Badge, Button, EmptyState, Spinner } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { UserCard } from '@/components/UserCard';

type Tab = 'posts' | 'followers' | 'following';

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMe = me?.username === username;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    usersApi
      .profile(username)
      .then((p) => !cancelled && setProfile(p))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : t.common.error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [username, t.common.error]);

  const loadTab = useCallback(async (active: Tab) => {
    if (!profile) return;
    setListLoading(true);
    try {
      if (active === 'posts') {
        const res = await postsApi.byUser(profile.id, 1, 20);
        setPosts(res.items);
      } else {
        const res =
          active === 'followers'
            ? await usersApi.followers(profile.id, 1, 30)
            : await usersApi.following(profile.id, 1, 30);
        setPeople(res.items);
      }
    } catch {
      /* ignore */
    } finally {
      setListLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) void loadTab(tab);
  }, [profile, tab, loadTab]);

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.isFollowing) {
        await usersApi.unfollow(profile.id);
        setProfile({ ...profile, isFollowing: false, followersCount: Math.max(0, profile.followersCount - 1) });
      } else {
        await usersApi.follow(profile.id);
        setProfile({ ...profile, isFollowing: true, followersCount: profile.followersCount + 1 });
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.connectionStatus === 'BLOCKED') {
        await usersApi.unblock(profile.id);
        setProfile({ ...profile, connectionStatus: profile.connectionStatus });
      } else {
        await usersApi.block(profile.id);
        setProfile({ ...profile, connectionStatus: 'BLOCKED' as UserProfile['connectionStatus'] });
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
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    );
  }

  if (error || !profile) {
    return <EmptyState title={error ?? t.common.noResults} />;
  }

  const blocked = profile.connectionStatus === 'BLOCKED';

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden !p-0">
        <div className="h-32 bg-gradient-to-r from-brand-500 to-accent-500" />
        <div className="p-4">
          <div className="-mt-16 flex items-end justify-between">
            <Avatar
              src={profile.avatarUrl}
              alt={profile.displayName}
              size={96}
              className="ring-4 ring-surface"
            />
            <div className="flex gap-2 pb-2">
              {isMe ? (
                <Link href="/settings">
                  <Button variant="secondary" size="sm">
                    {t.profile.editProfile}
                  </Button>
                </Link>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant={profile.isFollowing ? 'secondary' : 'primary'}
                    loading={busy}
                    onClick={toggleFollow}
                  >
                    {profile.isFollowing ? t.common.unfollow : t.common.follow}
                  </Button>
                  <Button size="sm" variant="ghost" loading={busy} onClick={toggleBlock}>
                    {blocked ? t.common.unblock : t.common.block}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="gradient-text text-xl font-extrabold tracking-tight">{profile.displayName}</h1>
              {profile.isVerified && <Badge color="brand">✓</Badge>}
              {profile.role && profile.role !== 'USER' && <Badge color="accent">{profile.role}</Badge>}
            </div>
            <div className="text-sm text-content-muted">@{profile.username}</div>
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
            {profile.aboutMe && <p className="mt-1 text-sm text-content-muted">{profile.aboutMe}</p>}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span>
                <b>{profile.followersCount}</b> {t.profile.followers}
              </span>
              <span>
                <b>{profile.followingCount}</b> {t.profile.following}
              </span>
              {profile.city && <span className="text-content-muted">{profile.city}</span>}
              <span className="text-content-muted">
                {t.profile.memberSince} {timeAgo(profile.memberSince, locale)}
              </span>
            </div>

            {(profile.skillsOffered.length > 0 || profile.skillsWanted.length > 0) && (
              <div className="mt-3 space-y-2">
                {profile.skillsOffered.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold text-content-muted">
                      {t.profile.skillsOffered}:
                    </span>
                    {profile.skillsOffered.map((s) => (
                      <Badge key={s} color="green">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                {profile.skillsWanted.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold text-content-muted">
                      {t.profile.skillsWanted}:
                    </span>
                    {profile.skillsWanted.map((s) => (
                      <Badge key={s} color="gray">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(
          [
            { id: 'posts', label: t.profile.posts },
            { id: 'followers', label: t.profile.followers },
            { id: 'following', label: t.profile.following },
          ] as { id: Tab; label: string }[]
        ).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              tab === tb.id ? 'bg-brand-600 text-white' : 'text-content-muted hover:text-content',
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {listLoading ? (
        <div className="grid place-items-center py-12">
          <Spinner className="h-7 w-7 text-brand-600" />
        </div>
      ) : tab === 'posts' ? (
        posts.length === 0 ? (
          <EmptyState title={t.feed.noPosts} />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onChanged={patchPost} />
            ))}
          </div>
        )
      ) : people.length === 0 ? (
        <EmptyState title={t.common.noResults} />
      ) : (
        <div className="space-y-3">
          {people.map((p) => (
            <UserCard key={p.id} person={p} showFollow={!isMe} />
          ))}
        </div>
      )}
    </div>
  );
}
