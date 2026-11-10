/**
 * Discover people: search + suggestions, with inline follow/unfollow.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PublicUser } from '@mehfil/shared';
import { usersApi } from '@/lib/services';
import { Avatar, Button, EmptyState, Field, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';

export default function Discover() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

  const [q, setQ] = useState('');
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      if (query.trim()) {
        const res = await usersApi.search({ q: query.trim(), limit: 30 });
        setPeople(res.items);
      } else {
        setPeople(await usersApi.suggestions(30));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  async function toggleFollow(p: PublicUser) {
    const following = p.isFollowing;
    setPeople((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, isFollowing: !following, followersCount: x.followersCount + (following ? -1 : 1) }
          : x,
      ),
    );
    try {
      if (following) await usersApi.unfollow(p.id);
      else await usersApi.follow(p.id);
    } catch {
      /* revert */
      setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, isFollowing: following } : x)));
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <Field
          value={q}
          onChangeText={(v) => {
            setQ(v);
            void load(v);
          }}
          placeholder={t.common.search}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <Loading label={t.common.loading} />
      ) : (
        <FlatList
          data={people.filter((p) => p.id !== user?.id)}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t.common.noResults} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/profile/${item.username}`)}>
              <Avatar uri={item.avatarUrl} name={item.displayName} size={48} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{item.username}
                  {item.city ? ` · ${item.city}` : ''}
                </Text>
                {item.bio ? <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text> : null}
                <Text style={styles.counts}>
                  {compactNumber(item.followersCount)} {t.profile.followers}
                </Text>
              </View>
              <Button
                label={item.isFollowing ? t.common.unfollow : t.common.follow}
                variant={item.isFollowing ? 'secondary' : 'primary'}
                size="sm"
                onPress={() => toggleFollow(item)}
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceMuted },
  search: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  list: { padding: spacing.md, paddingBottom: 130 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.content },
  handle: { fontSize: 12, color: colors.contentMuted },
  bio: { fontSize: 13, color: colors.content, marginTop: 2 },
  counts: { fontSize: 12, color: colors.contentMuted, marginTop: 2 },
});
