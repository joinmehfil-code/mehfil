/**
 * Check-in scanner (for hosts). Pick one of your events, then scan attendee QR
 * codes; each scan posts to /events/:id/checkin and shows the result.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CheckInResult, EventSummary } from '@mehfil/shared';
import { eventsApi, ticketingApi } from '@/lib/services';
import { useI18n } from '@/i18n';
import { Button, Card, EmptyState, Loading, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { formatDate } from '@/lib/format';

export default function Scan() {
  const { t, locale } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventSummary | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [history, setHistory] = useState<CheckInResult[]>([]);
  const lastScan = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await eventsApi.mine(1, 30);
      setEvents(res.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (!selected) return;
      const now = Date.now();
      if (now - lastScan.current < 2000) return; // debounce repeat scans
      lastScan.current = now;
      try {
        const res = await ticketingApi.checkIn(selected.id, data, 'QR');
        setResult(res);
        setHistory((prev) => [res, ...prev]);
      } catch (e) {
        const err: CheckInResult = { success: false, message: (e as Error)?.message || 'Failed' };
        setResult(err);
        setHistory((prev) => [err, ...prev]);
      }
    },
    [selected],
  );

  if (loading) return <Loading label={t.common.loading} />;

  // Step 1: choose an event to check into.
  if (!selected) {
    return (
      <Screen>
        <Text style={styles.prompt}>{t.events.checkin}</Text>
        <Text style={styles.hint}>Select the event you are hosting</Text>
        {events.length === 0 ? (
          <EmptyState title={t.events.noEvents} />
        ) : (
          events.map((e) => (
            <Card key={e.id} onPress={() => setSelected(e)}>
              <Text style={styles.eventTitle}>{e.title}</Text>
              <Text style={styles.eventMeta}>{formatDate(e.startsAt, locale)}</Text>
            </Card>
          ))
        )}
      </Screen>
    );
  }

  // Step 2: camera.
  if (!permission) {
    return <Loading />;
  }
  if (!permission.granted) {
    return (
      <Screen>
        <EmptyState
          title="Camera access needed"
          message="Allow camera access to scan attendee tickets."
          action={<Button label="Grant permission" onPress={requestPermission} />}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.camHeader}>
        <Pressable onPress={() => setSelected(null)}>
          <Text style={styles.change}>Change</Text>
        </Pressable>
        <Text style={styles.camTitle} numberOfLines={1}>{selected.title}</Text>
        <View style={{ width: 50 }} />
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onBarcode}
      />

      <View style={styles.resultPanel}>
        {result ? (
          <View style={[styles.resultBox, result.success ? styles.resultOk : styles.resultBad]}>
            <Text style={[styles.resultText, { color: result.success ? colors.brand[300] : colors.danger }]}>
              {result.success ? '✓ ' : '✕ '}{result.message}
            </Text>
          </View>
        ) : (
          <Text style={styles.scanHint}>Point the camera at a ticket QR code</Text>
        )}
        <Text style={styles.count}>{history.length} scanned</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.black },
  prompt: { fontSize: 20, fontWeight: '800', color: colors.content },
  hint: { fontSize: 13, color: colors.contentMuted, marginBottom: spacing.lg },
  eventTitle: { fontSize: 16, fontWeight: '700', color: colors.content },
  eventMeta: { fontSize: 13, color: colors.contentMuted, marginTop: 2 },
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface },
  change: { fontSize: 14, color: colors.brand[600], fontWeight: '600' },
  camTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.content, marginHorizontal: spacing.sm },
  camera: { flex: 1 },
  resultPanel: { backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
  resultBox: { padding: spacing.md, borderRadius: 10 },
  resultOk: { backgroundColor: 'rgba(0,229,160,0.16)' },
  resultBad: { backgroundColor: colors.dangerBg },
  resultText: { fontSize: 14, fontWeight: '600' },
  scanHint: { fontSize: 14, color: colors.contentMuted, textAlign: 'center' },
  count: { fontSize: 12, color: colors.contentMuted, textAlign: 'center' },
});
