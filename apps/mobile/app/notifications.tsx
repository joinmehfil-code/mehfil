/**
 * Notifications list with realtime updates via NOTIFICATION_NEW socket events.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SOCKET_EVENTS, type AppNotification } from '@mehfil/shared';
import { notificationsApi } from '@/lib/services';
import { useSocket } from '@/lib/socket';
import { useI18n } from '@/i18n';
import { Avatar, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { timeAgo } from '@/lib/format';

export default function Notifications() {
  const { t, locale } = useI18n();
  const socket = useSocket(true);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list(1, 50);
      setItems(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (n: AppNotification) => {
      setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
    };
    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, [socket]);

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      /* ignore */
    }
  }

  async function tapItem(n: AppNotification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await notificationsApi.markRead(n.id).catch(() => {});
    }
  }

  if (loading) return <Loading label={t.common.loading} />;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.notifications.title}</Text>
        <Pressable onPress={markAll}>
          <Text style={styles.markAll}>{t.notifications.markAllRead}</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title={t.notifications.empty} />}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, !item.read && styles.rowUnread]} onPress={() => tapItem(item)}>
            <Avatar uri={item.actor?.avatarUrl} name={item.actor?.displayName || item.title} size={40} />
            <View style={styles.rowText}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt, locale)}</Text>
            </View>
            {!item.read ? <View style={styles.dot} /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.content },
  markAll: { fontSize: 13, color: colors.brand[600], fontWeight: '600' },
  list: { padding: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, alignItems: 'center' },
  rowUnread: { backgroundColor: 'rgba(0,229,160,0.10)' },
  rowText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.content },
  body: { fontSize: 13, color: colors.contentMuted, marginTop: 2 },
  time: { fontSize: 11, color: colors.contentMuted, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
});
