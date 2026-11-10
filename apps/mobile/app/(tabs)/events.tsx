/**
 * Events: Discover / My events / Attending tabs, search and a create sheet.
 * Creating also adds a default ticket tier (free or paid) like the web app.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EventSummary } from '@mehfil/shared';
import { eventsApi } from '@/lib/services';
import { Badge, Button, EmptyState, Field, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber, formatDate, formatMoney } from '@/lib/format';
import { useI18n } from '@/i18n';

type Tab = 'discover' | 'mine' | 'attending';

export default function Events() {
  const router = useRouter();
  const { t, locale } = useI18n();

  const [tab, setTab] = useState<Tab>('discover');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startsAt: '', city: '', price: '', quantity: '100' });
  const [free, setFree] = useState(true);

  const load = useCallback(async (which: Tab, query: string) => {
    setLoading(true);
    try {
      const res =
        which === 'mine'
          ? await eventsApi.mine(1, 30)
          : which === 'attending'
            ? await eventsApi.attending(1, 30)
            : await eventsApi.discover({ search: query.trim() || undefined, limit: 30 });
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

  async function create() {
    if (!form.title.trim() || !form.startsAt.trim()) return;
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        venueCity: form.city.trim() || undefined,
        isOnline: false,
      };
      const created = await eventsApi.create(payload);
      await eventsApi.addTier(created.id, {
        name: free ? 'Free' : 'General',
        type: free ? 'FREE' : 'PAID',
        price: free ? 0 : Number(form.price) || 0,
        currency: 'PKR',
        quantityTotal: Number(form.quantity) || 100,
      });
      setCreateOpen(false);
      setForm({ title: '', description: '', startsAt: '', city: '', price: '', quantity: '100' });
      setTab('mine');
      await load('mine', '');
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'discover', label: t.events.discover },
    { key: 'mine', label: t.events.myEvents },
    { key: 'attending', label: t.events.attending },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tb) => (
          <Pressable key={tb.key} style={[styles.tab, tab === tb.key && styles.tabActive]} onPress={() => setTab(tb.key)}>
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]} numberOfLines={1}>{tb.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={24} color={colors.white} />
        </Pressable>
      </View>

      {tab === 'discover' ? (
        <View style={styles.search}>
          <Field value={q} onChangeText={(v) => { setQ(v); void load('discover', v); }} placeholder={t.common.search} autoCapitalize="none" />
        </View>
      ) : null}

      {loading ? (
        <Loading label={t.common.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t.events.noEvents} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/event/${item.slug}`)}>
              <View style={styles.cardTop}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{new Date(item.startsAt).getDate()}</Text>
                  <Text style={styles.dateMon}>
                    {new Date(item.startsAt).toLocaleString(locale === 'ur' ? 'ur-PK' : 'en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.meta}>{formatDate(item.startsAt, locale)}</Text>
                  <Text style={styles.meta}>
                    {item.venue?.city || (item.isOnline ? 'Online' : '')}
                  </Text>
                </View>
              </View>
              <View style={styles.cardFoot}>
                <Badge
                  label={item.priceMin && item.priceMin > 0 ? formatMoney(item.priceMin, item.currency) : t.events.free}
                  tone={item.priceMin && item.priceMin > 0 ? 'accent' : 'brand'}
                />
                <Text style={styles.meta}>{compactNumber(item.attendeeCount)} {t.events.going}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t.events.create}</Text>
            <Field label="Title" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Mehfil Night" />
            <Field label={t.communities.description} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />
            <Field label={t.events.when} value={form.startsAt} onChangeText={(v) => setForm({ ...form, startsAt: v })} placeholder="2026-12-01T19:00" hint="YYYY-MM-DDTHH:mm" />
            <Field label={t.profile.city} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} placeholder="Karachi" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t.events.free}</Text>
              <Switch value={free} onValueChange={setFree} trackColor={{ true: colors.brand[500] }} />
            </View>
            {!free ? (
              <>
                <Field label={t.events.price} value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="numeric" placeholder="1500" />
                <Field label={t.events.tickets} value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} keyboardType="numeric" />
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Button label={t.common.cancel} variant="ghost" onPress={() => setCreateOpen(false)} />
              <Button label={t.common.create} onPress={create} loading={creating} disabled={!form.title.trim() || !form.startsAt.trim()} />
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
  tabText: { fontSize: 13, color: colors.contentMuted, fontWeight: '600' },
  tabTextActive: { color: colors.brand[600] },
  fab: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand[600], alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  search: { backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  list: { padding: spacing.md, paddingBottom: 130 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  dateBox: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,160,0.16)', borderRadius: 10, paddingVertical: spacing.sm },
  dateDay: { fontSize: 20, fontWeight: '800', color: colors.brand[300] },
  dateMon: { fontSize: 12, color: colors.brand[300], fontWeight: '600' },
  cardText: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.content },
  meta: { fontSize: 12, color: colors.contentMuted, marginTop: 2 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.content, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  switchLabel: { fontSize: 14, color: colors.content, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
