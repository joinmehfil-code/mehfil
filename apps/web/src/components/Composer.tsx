'use client';

import { useState } from 'react';
import type { Post } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { postsApi, type CreatePostInput } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { Avatar, Button, Textarea } from '@/components/ui';

export function Composer({
  onCreated,
  communityId,
  spaceId,
  eventId,
  compact,
}: {
  onCreated?: (post: Post) => void;
  communityId?: string;
  spaceId?: string;
  eventId?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = content.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      const input: CreatePostInput = { content: text };
      if (communityId) input.communityId = communityId;
      if (spaceId) input.spaceId = spaceId;
      if (eventId) input.eventId = eventId;
      const post = await postsApi.create(input);
      setContent('');
      onCreated?.(post);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-start gap-3">
        <Avatar src={user?.avatarUrl} alt={user?.displayName} size={40} />
        <div className="min-w-0 flex-1">
          <Textarea
            rows={compact ? 2 : 3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.feed.whatsHappening}
          />
          {error && <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <div className="mt-2 flex items-center justify-end">
            <Button size="sm" onClick={submit} loading={posting} disabled={!content.trim()}>
              {t.feed.post}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
