'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PublicUser } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { usersApi } from '@/lib/services';
import { Avatar, Badge, Button } from '@/components/ui';

export function UserCard({
  person,
  onChanged,
  showFollow = true,
}: {
  person: PublicUser;
  onChanged?: (u: PublicUser) => void;
  showFollow?: boolean;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const isMe = user?.id === person.id;
  const following = !!person.isFollowing;

  async function toggleFollow() {
    setBusy(true);
    try {
      if (following) {
        await usersApi.unfollow(person.id);
        onChanged?.({ ...person, isFollowing: false, followersCount: Math.max(0, person.followersCount - 1) });
      } else {
        await usersApi.follow(person.id);
        onChanged?.({ ...person, isFollowing: true, followersCount: person.followersCount + 1 });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass flex items-start gap-3 rounded-3xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glass">
      <Link href={`/u/${person.username}`}>
        <Avatar src={person.avatarUrl} alt={person.displayName} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${person.username}`} className="flex items-center gap-2">
          <span className="truncate font-semibold hover:underline">{person.displayName}</span>
          {person.tier && person.tier !== 'FREE' && <Badge color="accent">{person.tier}</Badge>}
        </Link>
        <div className="truncate text-sm text-content-muted">@{person.username}</div>
        {person.bio && <p className="mt-1 line-clamp-2 text-sm text-content-muted">{person.bio}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-content-muted">
          <span>
            <b className="text-content">{person.followersCount}</b> {t.profile.followers}
          </span>
          <span>
            <b className="text-content">{person.followingCount}</b> {t.profile.following}
          </span>
          {person.city && <span>{person.city}</span>}
        </div>
        {person.interests?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {person.interests.slice(0, 4).map((i) => (
              <Badge key={i} color="gray">
                {i}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {showFollow && !isMe && (
        <Button
          size="sm"
          variant={following ? 'secondary' : 'primary'}
          loading={busy}
          onClick={toggleFollow}
        >
          {following ? t.common.unfollow : t.common.follow}
        </Button>
      )}
    </div>
  );
}
