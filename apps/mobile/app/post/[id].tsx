/**
 * Post detail: full post + threaded-ish comment list + add-comment box.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Comment, Post } from '@mehfil/shared';
import { postsApi } from '@/lib/services';
import { PostCard } from '@/components/PostCard';
import { Avatar, Button, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { timeAgo } from '@/lib/format';
import { useI18n } from '@/i18n';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, c] = await Promise.all([postsApi.get(id), postsApi.comments(id, 100)]);
      setPost(p);
      setComments(c);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!draft.trim() || !id) return;
    setSending(true);
    try {
      const c = await postsApi.addComment(id, draft.trim());
      setComments((prev) => [c, ...prev]);
      setDraft('');
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading label={t.common.loading} />;
  if (!post) return <EmptyState title={t.common.error} />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<PostCard post={post} />}
        ListEmptyComponent={<EmptyState title={t.feed.writeComment} />}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size={34} />
            <View style={styles.commentBody}>
              <Text style={styles.commentHead}>
                {item.author.displayName}
                <Text style={styles.commentTime}>  ·  {timeAgo(item.createdAt, locale)}</Text>
              </Text>
              <Text style={styles.commentText}>{item.content}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t.feed.writeComment}
          placeholderTextColor={colors.contentMuted}
          value={draft}
          onChangeText={setDraft}
        />
        <Button label={t.messages.send} size="sm" onPress={send} loading={sending} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surfaceMuted },
  list: { padding: spacing.md },
  comment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  commentBody: { flex: 1 },
  commentHead: { fontSize: 13, fontWeight: '700', color: colors.content },
  commentTime: { fontSize: 11, fontWeight: '400', color: colors.contentMuted },
  commentText: { fontSize: 14, color: colors.content, marginTop: 2, lineHeight: 19 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.content,
  },
});
