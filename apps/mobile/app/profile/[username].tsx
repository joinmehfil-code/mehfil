/**
 * Public profile screen for any user: header, stats, follow/block/message and
 * a list of their posts.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Post, UserProfile } from '@mehfil/shared';
import { messagesApi, postsApi, usersApi } from '@/lib/services';
import { PostCard } from '@/components/PostCard';
import { Avatar, Badge, Button, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const p = await usersApi.profile(username);
      setProfile(p);
      setFollowing(!!p.isFollowing);
      const res = await postsApi.byUser(p.id, 1, 30);
      setPosts(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    const next = !following;
    setFollowing(next);
    try {
      if (next) await usersApi.follow(profile.id);
      else await usersApi.unfollow(profile.id);
    } catch {
      setFollowing(!next);
    }
  }

  async function toggleBlock() {
    if (!profile) return;
    try {
      await usersApi.block(profile.id);
      router.back();
    } catch {
      /* ignore */
    }
  }

  async function startChat() {
    if (!profile) return;
    try {
      const conv = await messagesApi.start({ type: 'DIRECT', recipientId: profile.id });
      router.push(`/messages/${conv.id}`);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <Loading label={t.common.loading} />;
  if (!profile) return <EmptyState title={t.common.error} />;

  const isMe = me?.id === profile.id;

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState title={t.feed.noPosts} />}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.top}>
            <Avatar uri={profile.avatarUrl} name={profile.displayName} size={72} />
            <View style={styles.topText}>
              <Text style={styles.name}>{profile.displayName}</Text>
              <Text style={styles.handle}>@{profile.username}</Text>
              {profile.isVerified ? <Badge label="✓ Verified" tone="brand" /> : null}
            </View>
          </View>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <View style={styles.stats}>
            <Text style={styles.stat}>{compactNumber(profile.followersCount)} {t.profile.followers}</Text>
            <Text style={styles.stat}>{compactNumber(profile.followingCount)} {t.profile.following}</Text>
          </View>
          {!isMe ? (
            <View style={styles.actions}>
              <Button label={following ? t.common.unfollow : t.common.follow} variant={following ? 'secondary' : 'primary'} onPress={toggleFollow} style={styles.actionBtn} />
              <Button label={t.nav.messages} variant="secondary" onPress={startChat} style={styles.actionBtn} />
              <Pressable onPress={toggleBlock}>
                <Text style={styles.block}>{t.common.block}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, backgroundColor: colors.surfaceMuted },
  header: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  topText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '800', color: colors.content },
  handle: { fontSize: 14, color: colors.contentMuted },
  bio: { fontSize: 14, color: colors.content, marginTop: spacing.md, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  stat: { fontSize: 13, color: colors.contentMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  block: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.sm },
});
