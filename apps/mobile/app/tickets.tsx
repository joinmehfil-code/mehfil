/**
 * QR ticket wallet: lists the user's e-tickets and renders each ticket's QR
 * (react-native-qrcode-svg) with event/tier/status details.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import { TicketStatus, type ETicket } from '@mehfil/shared';
import { ticketsApi } from '@/lib/services';
import { useI18n } from '@/i18n';
import { Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';

function statusTone(s: TicketStatus): 'brand' | 'accent' | 'muted' | 'danger' {
  switch (s) {
    case TicketStatus.VALID:
      return 'brand';
    case TicketStatus.USED:
      return 'muted';
    case TicketStatus.CANCELLED:
    case TicketStatus.REFUNDED:
      return 'danger';
    default:
      return 'accent';
  }
}

export default function Tickets() {
  const router = useRouter();
  const { t } = useI18n();
  const [tickets, setTickets] = useState<ETicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await ticketsApi.mine(1, 50);
      setTickets(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label={t.common.loading} />;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.events.myTickets}</Text>
        <Button label="Scan" size="sm" variant="secondary" onPress={() => router.push('/scan')} />
      </View>
      <FlatList
        data={tickets}
        keyExtractor={(tk) => tk.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title={t.events.noEvents} />}
        renderItem={({ item }) => {
          const open = expanded === item.id;
          const usable = item.status === TicketStatus.VALID;
          return (
            <Card>
              <Pressable onPress={() => setExpanded(open ? null : item.id)}>
                <View style={styles.topRow}>
                  <View style={styles.topText}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{item.eventTitle}</Text>
                    <Text style={styles.tier}>{item.ticketTierName}</Text>
                  </View>
                  <Badge label={item.status} tone={statusTone(item.status)} />
                </View>
                <Text style={styles.code}>#{item.code}</Text>
              </Pressable>

              {open ? (
                <View style={styles.qrWrap}>
                  <View style={styles.qrBox}>
                    <QRCode
                      value={item.qrPayload || item.code}
                      size={200}
                      color={colors.black}
                      backgroundColor={colors.white}
                    />
                  </View>
                  <Text style={styles.qrHint}>
                    {usable ? 'Show this at the door' : 'This ticket is not active'}
                  </Text>
                  {item.attendeeName ? <Text style={styles.attendee}>{item.attendeeName}</Text> : null}
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.content },
  list: { padding: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  topText: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: colors.content },
  tier: { fontSize: 13, color: colors.contentMuted, marginTop: 2 },
  code: { fontSize: 12, color: colors.contentMuted, marginTop: spacing.sm, fontFamily: 'monospace' },
  qrWrap: { alignItems: 'center', marginTop: spacing.lg },
  qrBox: { padding: spacing.md, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder },
  qrHint: { fontSize: 12, color: colors.contentMuted, marginTop: spacing.sm, textAlign: 'center' },
  attendee: { fontSize: 13, color: colors.content, marginTop: spacing.xs },
});
