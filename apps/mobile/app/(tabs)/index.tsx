/**
 * Home feed. Composer + segmented tabs (For you / Trending / Bookmarks) over a
 * paginated FlatList with pull-to-refresh and infinite scroll.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '@mehfil/shared';
import { postsApi } from '@/lib/services';
import { PostCard } from '@/components/PostCard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';

type Tab = 'foryou' | 'trending' | 'bookmarks';

export default function Feed() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(
    async (p: number, which: Tab, append: boolean) => {
      try {
        const res =
          which === 'trending'
            ? await postsApi.trending(p, 20)
            : which === 'bookmarks'
              ? await postsApi.bookmarks(p, 20)
              : await postsApi.feed(p, 20);
        setPosts((prev) => (append ? [...prev, ...res.items] : res.items));
        setHasNext(res.hasNext);
        setPage(p);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    void load(1, tab, false);
  }, [tab, load]);

  async function createPost() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await postsApi.create({ content: draft.trim() });
      setDraft('');
      await load(1, tab, false);
    } catch {
      /* ignore */
    } finally {
      setPosting(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'foryou', label: t.feed.forYou },
    { key: 'trending', label: t.feed.trending },
    { key: 'bookmarks', label: t.feed.bookmarks },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder={t.feed.whatsHappening}
          placeholderTextColor={colors.contentMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <View style={styles.composerActions}>
          <Pressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.contentMuted} />
          </Pressable>
          <Pressable onPress={() => router.push('/tickets')} style={styles.iconBtn}>
            <Ionicons name="ticket-outline" size={22} color={colors.contentMuted} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Button label={t.feed.post} size="sm" onPress={createPost} loading={posting} disabled={!draft.trim()} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map((tb) => (
          <Pressable key={tb.key} style={[styles.tab, tab === tb.key && styles.tabActive]} onPress={() => setTab(tb.key)}>
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{tb.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loading label={t.common.loading} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(1, tab, false);
          }}
          onEndReached={() => {
            if (hasNext && !loading) void load(page + 1, tab, true);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState title={t.feed.noPosts} />}
          ListHeaderComponent={
            user ? (
              <Text style={styles.greeting}>
                {t.common.appName} · @{user.username}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  composer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  composerInput: {
    fontSize: 15,
    color: colors.content,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  iconBtn: { padding: spacing.xs },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: spacing.sm, gap: spacing.xs },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand[400] },
  tabText: { fontSize: 14, color: colors.contentMuted, fontWeight: '600' },
  tabTextActive: { color: colors.brand[400] },
  list: { padding: spacing.md, paddingBottom: 130 },
  greeting: { fontSize: 12, color: colors.contentMuted, marginBottom: spacing.sm },
});
