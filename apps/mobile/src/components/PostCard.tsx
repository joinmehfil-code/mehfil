/**
 * Mobile post card — reactions, comments count, poll voting, bookmark and
 * share. Tapping the body navigates to the post detail (comments) screen.
 */
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '@mehfil/shared';
import { postsApi } from '@/lib/services';
import { Avatar, Badge, GlassCard } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber, timeAgo } from '@/lib/format';
import { useI18n } from '@/i18n';

export function PostCard({ post, onChanged }: { post: Post; onChanged?: (p: Post) => void }) {
  const router = useRouter();
  const { locale } = useI18n();

  const [liked, setLiked] = useState(!!post.myReaction);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(false);
  const [votes, setVotes] = useState(post.poll?.options ?? []);
  const [voted, setVoted] = useState(post.poll?.options.some((o) => o.votedByMe) ?? false);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await postsApi.react(post.id);
      else await postsApi.unreact(post.id);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  async function toggleBookmark() {
    setSaved((s) => !s);
    try {
      await postsApi.bookmark(post.id);
    } catch {
      /* ignore */
    }
  }

  async function vote(optionId: string) {
    if (voted) return;
    setVotes((vs) => vs.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)));
    setVoted(true);
    try {
      await postsApi.votePoll(optionId);
    } catch {
      /* ignore */
    }
  }

  const totalVotes = votes.reduce((s, o) => s + o.votes, 0) || 1;

  return (
    <GlassCard>
      <Pressable style={styles.head} onPress={() => router.push(`/profile/${post.author.username}`)}>
        <Avatar uri={post.author.avatarUrl} name={post.author.displayName} size={40} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{post.author.displayName}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            @{post.author.username} · {timeAgo(post.createdAt, locale)}
          </Text>
        </View>
        {post.community ? <Badge label={post.community.name} /> : null}
      </Pressable>

      {post.content ? (
        <Pressable onPress={() => router.push(`/post/${post.id}`)}>
          <Text style={styles.content}>{post.content}</Text>
        </Pressable>
      ) : null}

      {post.hashtags?.length ? (
        <Text style={styles.tags}>{post.hashtags.map((h) => `#${h}`).join('  ')}</Text>
      ) : null}

      {post.media?.map((m) =>
        m.kind === 'IMAGE' ? (
          <Image key={m.id} source={{ uri: m.url }} style={styles.media} resizeMode="cover" />
        ) : null,
      )}

      {post.poll ? (
        <View style={styles.poll}>
          <Text style={styles.pollQ}>{post.poll.question}</Text>
          {votes.map((o) => {
            const pct = Math.round((o.votes / totalVotes) * 100);
            return (
              <Pressable key={o.id} style={styles.pollOpt} onPress={() => vote(o.id)} disabled={voted}>
                <View style={[styles.pollBar, { width: `${voted ? pct : 0}%` }]} />
                <Text style={styles.pollText}>
                  {o.text}
                  {voted ? `  ·  ${pct}%` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={toggleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.danger : colors.contentMuted} />
          <Text style={styles.actionText}>{compactNumber(likeCount)}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => router.push(`/post/${post.id}`)}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.contentMuted} />
          <Text style={styles.actionText}>{compactNumber(post.commentCount)}</Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={async () => {
            await postsApi.share(post.id).catch(() => {});
            onChanged?.(post);
          }}
        >
          <Ionicons name="share-outline" size={18} color={colors.contentMuted} />
          <Text style={styles.actionText}>{compactNumber(post.shareCount)}</Text>
        </Pressable>
        <Pressable style={[styles.action, { marginLeft: 'auto' }]} onPress={toggleBookmark}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.brand[400] : colors.contentMuted} />
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.content },
  meta: { fontSize: 12, color: colors.contentMuted },
  content: { fontSize: 15, color: colors.content, lineHeight: 21 },
  tags: { fontSize: 13, color: colors.brand[300], marginTop: spacing.xs },
  media: { width: '100%', height: 200, borderRadius: 12, marginTop: spacing.sm },
  poll: { marginTop: spacing.sm, gap: spacing.xs },
  pollQ: { fontSize: 14, fontWeight: '700', color: colors.content, marginBottom: spacing.xs },
  pollOpt: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.brand[600] },
  pollText: { fontSize: 14, color: colors.content },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: 13, color: colors.contentMuted },
});
