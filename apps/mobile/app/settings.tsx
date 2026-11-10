/**
 * Settings: edit the current user's profile (name, bio, location, interests and
 * skills). Array fields are entered comma-separated.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { UserProfile } from '@mehfil/shared';
import { usersApi } from '@/lib/services';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { Button, Card, Field, Loading, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';

function toArray(csv: string): string[] {
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Diff two string lists → items to add and items to remove. */
function diffLists(before: string[], after: string[]) {
  const b = new Set(before.map((s) => s.toLowerCase()));
  const a = new Set(after.map((s) => s.toLowerCase()));
  const toAdd = after.filter((s) => !b.has(s.toLowerCase()));
  const toRemove = before.filter((s) => !a.has(s.toLowerCase()));
  return { toAdd, toRemove };
}

export default function Settings() {
  const { user, setUser } = useAuth();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialSkills = useRef<{ offered: string[]; wanted: string[] }>({ offered: [], wanted: [] });
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    city: '',
    country: '',
    aboutMe: '',
    interests: '',
    skillsOffered: '',
    skillsWanted: '',
  });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me = (user ?? (await usersApi.me())) as UserProfile;
        if (!mounted) return;
        setForm({
          displayName: me.displayName || '',
          bio: me.bio || '',
          city: me.city || '',
          country: me.country || '',
          aboutMe: me.aboutMe || '',
          interests: (me.interests || []).join(', '),
          skillsOffered: (me.skillsOffered || []).join(', '),
          skillsWanted: (me.skillsWanted || []).join(', '),
        });
        initialSkills.current = {
          offered: me.skillsOffered || [],
          wanted: me.skillsWanted || [],
        };
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  async function save() {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        displayName: form.displayName.trim(),
        bio: form.bio.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        aboutMe: form.aboutMe.trim() || null,
        interests: toArray(form.interests),
      } as Partial<UserProfile>);

      // Sync skills through the dedicated endpoints (diff against initial).
      const offered = toArray(form.skillsOffered);
      const wanted = toArray(form.skillsWanted);
      const offerDiff = diffLists(initialSkills.current.offered, offered);
      const wantDiff = diffLists(initialSkills.current.wanted, wanted);
      await Promise.all([
        ...offerDiff.toRemove.map((s) => usersApi.removeSkill(s, 'OFFER').catch(() => {})),
        ...offerDiff.toAdd.map((s) => usersApi.addSkill(s, 'OFFER').catch(() => {})),
        ...wantDiff.toRemove.map((s) => usersApi.removeSkill(s, 'WANT').catch(() => {})),
        ...wantDiff.toAdd.map((s) => usersApi.addSkill(s, 'WANT').catch(() => {})),
      ]);

      // Re-fetch so the auth-provided user reflects the new skills too.
      const fresh = await usersApi.me().catch(() => updated);
      setUser(fresh);
      initialSkills.current = { offered, wanted };
      Alert.alert(t.common.done, t.common.save);
    } catch (e) {
      Alert.alert(t.common.error, (e as Error)?.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label={t.common.loading} />;

  return (
    <Screen>
      <Card>
        <Field label={t.auth.displayName} value={form.displayName} onChangeText={(v) => setForm({ ...form, displayName: v })} />
        <Field label={t.profile.bio} value={form.bio} onChangeText={(v) => setForm({ ...form, bio: v })} multiline />
        <Field label={t.profile.city} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
        <Field label={t.profile.country} value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
      </Card>

      <Card>
        <Text style={styles.section}>{t.profile.interests}</Text>
        <Field value={form.interests} onChangeText={(v) => setForm({ ...form, interests: v })} placeholder="music, poetry, cricket" hint="Comma separated" />
        <Text style={styles.section}>{t.profile.skillsOffered}</Text>
        <Field value={form.skillsOffered} onChangeText={(v) => setForm({ ...form, skillsOffered: v })} placeholder="guitar, urdu poetry" hint="Comma separated" />
        <Text style={styles.section}>{t.profile.skillsWanted}</Text>
        <Field value={form.skillsWanted} onChangeText={(v) => setForm({ ...form, skillsWanted: v })} placeholder="photography" hint="Comma separated" />
      </Card>

      <View style={styles.actions}>
        <Button label={t.common.save} onPress={save} loading={saving} size="lg" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', color: colors.content, marginBottom: spacing.xs, marginTop: spacing.sm },
  actions: { marginTop: spacing.sm },
});
