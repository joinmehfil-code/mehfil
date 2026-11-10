/**
 * Registration screen with the Phase 1 age gate. Dark glass form on an aurora
 * backdrop. Collects identity fields, date of birth and an explicit age
 * confirmation before creating the account.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { Field, GlassCard, GradientButton, Reveal, Screen } from '@/components/ui';
import { Aurora } from '@/components/Aurora';
import { colors, spacing } from '@/theme/colors';

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();

  const [form, setForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    phone: '',
  });
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit() {
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError(t.auth.confirmPassword);
      return;
    }
    if (!acceptedAge) {
      setError(t.auth.ageNotice);
      return;
    }
    setBusy(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        phone: form.phone.trim() || undefined,
        acceptedAge,
      });
    } catch (e) {
      setError((e as Error)?.message || t.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Aurora opacity={0.4} />

      <Reveal>
        <Text style={styles.title}>{t.auth.createAccount}</Text>
        <Text style={styles.subtitle}>{t.auth.registerSubtitle}</Text>
      </Reveal>

      <Reveal delay={100}>
        <GlassCard accent>
          <Field label={t.auth.displayName} value={form.displayName} onChangeText={(v) => set('displayName', v)} placeholder="Ayesha Khan" />
          <Field label={t.auth.username} value={form.username} onChangeText={(v) => set('username', v)} placeholder="ayesha" autoCapitalize="none" />
          <Field label={t.auth.email} value={form.email} onChangeText={(v) => set('email', v)} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
          <Field label={t.auth.phone} value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+92 3xx xxxxxxx" keyboardType="phone-pad" />
          <Field
            label={t.auth.dateOfBirth}
            value={form.dateOfBirth}
            onChangeText={(v) => set('dateOfBirth', v)}
            placeholder="YYYY-MM-DD"
            hint={t.auth.ageNotice}
          />
          <Field label={t.auth.password} value={form.password} onChangeText={(v) => set('password', v)} secureTextEntry placeholder="••••••••" />
          <Field label={t.auth.confirmPassword} value={form.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} secureTextEntry placeholder="••••••••" />

          <Pressable style={styles.checkRow} onPress={() => setAcceptedAge((a) => !a)}>
            <Ionicons
              name={acceptedAge ? 'checkbox' : 'square-outline'}
              size={22}
              color={acceptedAge ? colors.brand[400] : colors.contentMuted}
            />
            <Text style={styles.checkLabel}>{t.auth.acceptAge}</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GradientButton label={t.auth.register} onPress={onSubmit} loading={busy} size="lg" />
        </GlassCard>
      </Reveal>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.auth.haveAccount}</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={styles.link}> {t.auth.login}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg },
  title: { fontSize: 26, fontWeight: '900', color: colors.content },
  subtitle: {
    fontSize: 14,
    color: colors.contentMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  checkLabel: { flex: 1, fontSize: 14, color: colors.content },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  footerText: { color: colors.contentMuted, fontSize: 14 },
  link: { color: colors.brand[400], fontSize: 14, fontWeight: '700' },
});
