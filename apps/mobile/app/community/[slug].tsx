/**
 * Community detail: header + join/leave, spaces list, composer and posts.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Community, CommunitySpace, Post } from '@mehfil/shared';
import { communitiesApi, postsApi } from '@/lib/services';
import { PostCard } from '@/components/PostCard';
import { Avatar, Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

export default function CommunityDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useI18n();

  const [community, setCommunity] = useState<Community | null>(null);
  const [spaces, setSpaces] = useState<CommunitySpace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const c = await communitiesApi.get(slug);
      setCommunity(c);
      const [sp, ps] = await Promise.all([
        communitiesApi.spaces(c.id).catch(() => [] as CommunitySpace[]),
        postsApi.byCommunity(c.id, 1, 30),
      ]);
      setSpaces(sp);
      setPosts(ps.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleJoin() {
    if (!community) return;
    const member = community.isMember;
    setCommunity({ ...community, isMember: !member });
    try {
      if (member) await communitiesApi.leave(community.id);
      else await communitiesApi.join(community.id);
    } catch {
      setCommunity({ ...community, isMember: member });
    }
  }

  async function createPost() {
    if (!draft.trim() || !community) return;
    setPosting(true);
    try {
      const p = await postsApi.create({ content: draft.trim(), communityId: community.id });
      setPosts((prev) => [p, ...prev]);
      setDraft('');
    } catch {
      /* ignore */
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <Loading label={t.common.loading} />;
  if (!community) return <EmptyState title={t.common.error} />;

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState title={t.feed.noPosts} />}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={
        <View>
          <Card>
            <View style={styles.head}>
              <Avatar uri={community.avatarUrl} name={community.name} size={56} />
              <View style={styles.headText}>
                <Text style={styles.name}>{community.name}</Text>
                <Text style={styles.meta}>
                  {compactNumber(community.memberCount)} {t.communities.members}
                </Text>
              </View>
            </View>
            {community.description ? <Text style={styles.desc}>{community.description}</Text> : null}
            <View style={styles.joinRow}>
              <Button
                label={community.isMember ? t.common.leave : t.common.join}
                variant={community.isMember ? 'secondary' : 'primary'}
                onPress={toggleJoin}
                style={styles.joinBtn}
              />
            </View>
          </Card>

          {spaces.length ? (
            <Card>
              <Text style={styles.sectionTitle}>{t.communities.spaces}</Text>
              {spaces.map((s) => (
                <View key={s.id} style={styles.spaceRow}>
                  <Badge label={s.type} tone={s.isPrivate ? 'accent' : 'muted'} />
                  <Text style={styles.spaceName}>{s.name}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {community.isMember ? (
            <Card>
              <TextInput
                style={styles.input}
                placeholder={t.feed.whatsHappening}
                placeholderTextColor={colors.contentMuted}
                value={draft}
                onChangeText={setDraft}
                multiline
              />
              <Button label={t.feed.post} size="sm" onPress={createPost} loading={posting} disabled={!draft.trim()} style={styles.postBtn} />
            </Card>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, backgroundColor: colors.surfaceMuted },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headText: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: colors.content },
  meta: { fontSize: 13, color: colors.contentMuted },
  desc: { fontSize: 14, color: colors.content, marginTop: spacing.md, lineHeight: 20 },
  joinRow: { flexDirection: 'row', marginTop: spacing.md },
  joinBtn: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.content, marginBottom: spacing.sm },
  spaceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  spaceName: { fontSize: 14, color: colors.content },
  input: { fontSize: 15, color: colors.content, minHeight: 44, textAlignVertical: 'top' },
  postBtn: { alignSelf: 'flex-end', marginTop: spacing.sm },
});
