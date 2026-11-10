/**
 * Event detail: cover, when/where, organizer, ticket tiers with quantity
 * selection, RSVP and a mock checkout (Phase 1). On success → tickets wallet.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EventRsvpStatus, type EventDetail as EventDetailType, type TicketTier } from '@mehfil/shared';
import { eventsApi, ticketingApi } from '@/lib/services';
import { Avatar, Badge, Button, Card, EmptyState, Loading, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber, formatDate, formatMoney } from '@/lib/format';
import { useI18n } from '@/i18n';

export default function EventDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();

  const [event, setEvent] = useState<EventDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      setEvent(await eventsApi.get(slug));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  function bump(tier: TicketTier, delta: number) {
    setQty((prev) => {
      const cur = prev[tier.id] ?? 0;
      const next = Math.min(tier.maxPerOrder || 10, Math.max(0, cur + delta));
      return { ...prev, [tier.id]: next };
    });
  }

  const selectedItems = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([ticketTierId, quantity]) => ({ ticketTierId, quantity }));

  const total = selectedItems.reduce((sum, it) => {
    const tier = event?.tickets.find((x) => x.id === it.ticketTierId);
    return sum + (tier ? tier.price * it.quantity : 0);
  }, 0);

  async function checkout() {
    if (!event || selectedItems.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const isFree = total === 0;
      await ticketingApi.checkout(event.id, {
        items: selectedItems,
        paymentMethod: isFree ? 'FREE' : 'MOCK_CARD',
      });
      router.push('/tickets');
    } catch (e) {
      setError((e as Error)?.message || t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function rsvp(status: EventRsvpStatus) {
    if (!event) return;
    try {
      await eventsApi.rsvp(event.id, status);
      setEvent({ ...event, myRsvp: status, attendeeCount: event.attendeeCount + 1 });
    } catch {
      /* ignore */
    }
  }

  if (loading) return <Loading label={t.common.loading} />;
  if (!event) return <EmptyState title={t.common.error} />;

  const priceLabel = event.priceMin && event.priceMin > 0 ? formatMoney(event.priceMin, event.currency) : t.events.free;

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.badgeRow}>
          <Badge label={priceLabel} tone={event.priceMin && event.priceMin > 0 ? 'accent' : 'brand'} />
          {event.isSoldOut ? <Badge label={t.events.soldOut} tone="danger" /> : null}
          {event.isOnline ? <Badge label="Online" tone="muted" /> : null}
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.contentMuted} />
          <Text style={styles.info}>{formatDate(event.startsAt, locale)}</Text>
        </View>
        {event.venue?.city || event.venue?.name ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.contentMuted} />
            <Text style={styles.info}>
              {[event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={18} color={colors.contentMuted} />
          <Text style={styles.info}>{compactNumber(event.attendeeCount)} {t.events.going}</Text>
        </View>

        <View style={styles.organizer}>
          <Text style={styles.organizerLabel}>{t.events.organizer}</Text>
          <View style={styles.organizerRow}>
            <Avatar uri={event.organizer.avatarUrl} name={event.organizer.displayName} size={32} />
            <Text style={styles.organizerName}>{event.organizer.displayName}</Text>
          </View>
        </View>

        {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}

        <View style={styles.rsvpRow}>
          <Button label={t.events.going} variant={event.myRsvp === 'GOING' ? 'primary' : 'secondary'} onPress={() => rsvp(EventRsvpStatus.GOING)} style={styles.rsvpBtn} />
          <Button label={t.events.interested} variant={event.myRsvp === 'INTERESTED' ? 'primary' : 'secondary'} onPress={() => rsvp(EventRsvpStatus.INTERESTED)} style={styles.rsvpBtn} />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t.events.tickets}</Text>
        {event.tickets.length === 0 ? (
          <Text style={styles.info}>{t.events.noEvents}</Text>
        ) : (
          event.tickets.map((tier) => {
            const soldOut = tier.quantityAvailable <= 0;
            return (
              <View key={tier.id} style={styles.tier}>
                <View style={styles.tierText}>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierMeta}>
                    {tier.price > 0 ? formatMoney(tier.price, tier.currency) : t.events.free}
                    {'  ·  '}{tier.quantityAvailable} left
                  </Text>
                  {tier.description ? <Text style={styles.tierDesc}>{tier.description}</Text> : null}
                </View>
                <View style={styles.qty}>
                  <Pressable style={styles.qtyBtn} onPress={() => bump(tier, -1)} disabled={soldOut}>
                    <Ionicons name="remove" size={18} color={colors.content} />
                  </Pressable>
                  <Text style={styles.qtyNum}>{qty[tier.id] ?? 0}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => bump(tier, +1)} disabled={soldOut}>
                    <Ionicons name="add" size={18} color={colors.content} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {selectedItems.length > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.events.price}</Text>
            <Text style={styles.total}>{formatMoney(total, event.currency)}</Text>
          </View>
        ) : null}

        <Button
          label={total > 0 ? t.events.checkout : t.events.getTickets}
          onPress={checkout}
          loading={busy}
          disabled={selectedItems.length === 0 || event.isSoldOut}
          size="lg"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.content },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  info: { fontSize: 14, color: colors.contentMuted, flex: 1 },
  organizer: { marginTop: spacing.lg },
  organizerLabel: { fontSize: 12, color: colors.contentMuted, marginBottom: spacing.xs },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  organizerName: { fontSize: 14, fontWeight: '600', color: colors.content },
  desc: { fontSize: 14, color: colors.content, lineHeight: 20, marginTop: spacing.lg },
  rsvpRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  rsvpBtn: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.content, marginBottom: spacing.sm },
  tier: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  tierText: { flex: 1 },
  tierName: { fontSize: 15, fontWeight: '700', color: colors.content },
  tierMeta: { fontSize: 13, color: colors.contentMuted, marginTop: 2 },
  tierDesc: { fontSize: 12, color: colors.contentMuted, marginTop: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { fontSize: 15, fontWeight: '700', color: colors.content, minWidth: 20, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.md },
  totalLabel: { fontSize: 15, color: colors.contentMuted },
  total: { fontSize: 18, fontWeight: '800', color: colors.content },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.xs },
});
