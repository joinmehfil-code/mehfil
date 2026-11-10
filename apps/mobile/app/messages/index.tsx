/**
 * Conversations list. Shows direct + group threads with last message preview
 * and unread badges; tapping opens the realtime thread.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SOCKET_EVENTS, type Conversation } from '@mehfil/shared';
import { messagesApi } from '@/lib/services';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { Avatar, Badge, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { timeAgo } from '@/lib/format';

export default function MessagesList() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const socket = useSocket(true);

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await messagesApi.conversations(1, 50);
      setConvs(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live update: bump the conversation on a new message.
  useEffect(() => {
    if (!socket) return;
    const onNew = (payload: { conversationId: string; message: unknown }) => {
      setConvs((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) {
          void load();
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(idx, 1);
        next.unshift(moved);
        return next;
      });
    };
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    };
  }, [socket, load]);

  function title(c: Conversation): string {
    if (c.title) return c.title;
    const other = c.participants.find((p) => p.user.id !== user?.id);
    return other?.user.displayName || c.participants[0]?.user.displayName || 'Chat';
  }

  function avatarOf(c: Conversation): { uri?: string | null; name?: string } {
    const other = c.participants.find((p) => p.user.id !== user?.id) || c.participants[0];
    return { uri: other?.user.avatarUrl, name: other?.user.displayName };
  }

  if (loading) return <Loading label={t.common.loading} />;

  return (
    <FlatList
      data={convs}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      style={styles.wrap}
      ListEmptyComponent={<EmptyState title={t.messages.noConversations} />}
      renderItem={({ item }) => {
        const av = avatarOf(item);
        return (
          <Pressable style={styles.row} onPress={() => router.push(`/messages/${item.id}`)}>
            <Avatar uri={av.uri} name={av.name} size={48} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>{title(item)}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage?.body || '—'}
              </Text>
            </View>
            <View style={styles.rowRight}>
              {item.lastMessage ? (
                <Text style={styles.time}>{timeAgo(item.lastMessage.createdAt, locale)}</Text>
              ) : null}
              {item.unreadCount > 0 ? <Badge label={String(item.unreadCount)} tone="brand" /> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceMuted },
  list: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.content },
  preview: { fontSize: 13, color: colors.contentMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  time: { fontSize: 11, color: colors.contentMuted },
});
