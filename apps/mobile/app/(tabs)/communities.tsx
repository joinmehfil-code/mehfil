/**
 * Communities: Discover / Your communities tabs, search, join/leave and a
 * simple create sheet. Tapping a community opens its detail screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Community } from '@mehfil/shared';
import { communitiesApi } from '@/lib/services';
import { Avatar, Badge, Button, EmptyState, Field, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

type Tab = 'discover' | 'mine';

export default function Communities() {
  const router = useRouter();
  const { t } = useI18n();

  const [tab, setTab] = useState<Tab>('discover');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [access, setAccess] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (which: Tab, query: string) => {
    setLoading(true);
    try {
      const res =
        which === 'mine'
          ? await communitiesApi.mine(1, 30)
          : await communitiesApi.discover({ search: query.trim() || undefined, limit: 30 });
      setItems(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, load]);

  async function toggleJoin(c: Community) {
    const member = c.isMember;
    setItems((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, isMember: !member, memberCount: x.memberCount + (member ? -1 : 1) }
          : x,
      ),
    );
    try {
      if (member) await communitiesApi.leave(c.id);
      else await communitiesApi.join(c.id);
    } catch {
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, isMember: member } : x)));
    }
  }

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await communitiesApi.create({ name: name.trim(), description: desc.trim() || undefined, access });
      setName('');
      setDesc('');
      setCreateOpen(false);
      setTab('mine');
      await load('mine', '');
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'discover', label: t.communities.discover },
    { key: 'mine', label: t.communities.yourCommunities },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tb) => (
          <Pressable key={tb.key} style={[styles.tab, tab === tb.key && styles.tabActive]} onPress={() => setTab(tb.key)}>
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{tb.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={24} color={colors.white} />
        </Pressable>
      </View>

      {tab === 'discover' ? (
        <View style={styles.search}>
          <Field
            value={q}
            onChangeText={(v) => {
              setQ(v);
              void load('discover', v);
            }}
            placeholder={t.common.search}
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {loading ? (
        <Loading label={t.common.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t.common.noResults} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/community/${item.slug}`)}>
              <Avatar uri={item.avatarUrl} name={item.name} size={48} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.rowMeta}>
                  <Text style={styles.meta}>
                    {compactNumber(item.memberCount)} {t.communities.members}
                  </Text>
                  {item.access !== 'PUBLIC' ? <Badge label={item.access} tone="muted" /> : null}
                </View>
              </View>
              <Button
                label={item.isMember ? t.common.leave : t.common.join}
                variant={item.isMember ? 'secondary' : 'primary'}
                size="sm"
                onPress={() => toggleJoin(item)}
              />
            </Pressable>
          )}
        />
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t.communities.create}</Text>
            <Field label={t.communities.name} value={name} onChangeText={setName} placeholder="Karachi Book Club" />
            <Field label={t.communities.description} value={desc} onChangeText={setDesc} multiline placeholder="…" />
            <View style={styles.accessRow}>
              {(['PUBLIC', 'PRIVATE'] as const).map((a) => (
                <Pressable key={a} style={[styles.accessBtn, access === a && styles.accessBtnActive]} onPress={() => setAccess(a)}>
                  <Text style={[styles.accessText, access === a && styles.accessTextActive]}>
                    {a === 'PUBLIC' ? t.communities.public : t.communities.private}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Button label={t.common.cancel} variant="ghost" onPress={() => setCreateOpen(false)} />
              <Button label={t.common.create} onPress={create} loading={creating} disabled={!name.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceMuted },
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand[600] },
  tabText: { fontSize: 14, color: colors.contentMuted, fontWeight: '600' },
  tabTextActive: { color: colors.brand[600] },
  fab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  search: { backgroundColor: colors.surface, paddingHorizontal: spacing.md },
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
  desc: { fontSize: 13, color: colors.contentMuted, marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  meta: { fontSize: 12, color: colors.contentMuted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.content, marginBottom: spacing.md },
  accessRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  accessBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  accessBtnActive: { borderColor: colors.brand[600], backgroundColor: 'rgba(0,229,160,0.16)' },
  accessText: { fontSize: 14, color: colors.contentMuted, fontWeight: '600' },
  accessTextActive: { color: colors.brand[300] },
  modalActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
