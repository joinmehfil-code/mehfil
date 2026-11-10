/**
 * Realtime message thread. Loads history, sends via HTTP, and listens for
 * MESSAGE_NEW socket events scoped to this conversation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SOCKET_EVENTS, type Message } from '@mehfil/shared';
import { messagesApi } from '@/lib/services';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { Button, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';

export default function MessageThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { user } = useAuth();
  const socket = useSocket(true);
  const listRef = useRef<FlatList<Message>>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await messagesApi.messages(id, 1, 100);
      const sorted = [...res.items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(sorted);
      await messagesApi.markRead(id).catch(() => {});
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket || !id) return;
    const onNew = (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId !== id) return;
      setMessages((prev) =>
        prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message],
      );
      void messagesApi.markRead(id).catch(() => {});
    };
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    };
  }, [socket, id]);

  async function send() {
    const body = draft.trim();
    if (!body || !id) return;
    setSending(true);
    setDraft('');
    try {
      const msg = await messagesApi.send(id, body);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  // Inverted list expects newest-first.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  if (loading) return <Loading label={t.common.loading} />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        inverted
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t.messages.typeMessage}
          placeholderTextColor={colors.contentMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Button label={t.messages.send} size="sm" onPress={send} loading={sending} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surfaceMuted },
  list: { padding: spacing.md, gap: spacing.xs },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.brand[600], borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder },
  bubbleText: { fontSize: 15, color: colors.content, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  input: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.content, maxHeight: 100 },
});
