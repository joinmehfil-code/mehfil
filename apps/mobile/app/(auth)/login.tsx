/**
 * Login screen. Animated aurora hero + glass form on the dark "night mehfil"
 * theme. Uses the shared auth provider; on success the root layout swaps the
 * stack to the authenticated (tabs) app automatically.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { Field, GlassCard, GradientButton, GradientTitle, Reveal, Screen } from '@/components/ui';
import { Aurora } from '@/components/Aurora';
import { colors, gradients, spacing } from '@/theme/colors';

export default function Login() {
  const { login } = useAuth();
  const { t, locale, toggleLocale } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t.auth.invalidCredentials);
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError((e as Error)?.message || t.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Aurora opacity={0.55} />

      <Reveal>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>M</Text>
          </View>
          <GradientTitle stops={gradients.primary}>{t.common.appName}</GradientTitle>
          <Text style={styles.tagline}>{t.common.tagline}</Text>
        </View>
      </Reveal>

      <View style={styles.langRow}>
        <Pressable onPress={toggleLocale} style={styles.langBtn}>
          <Text style={styles.langText}>{locale === 'en' ? t.language.ur : t.language.en}</Text>
        </Pressable>
      </View>

      <Reveal delay={120}>
        <GlassCard accent>
          <Text style={styles.title}>{t.auth.welcomeBack}</Text>
          <Text style={styles.subtitle}>{t.auth.loginSubtitle}</Text>

          <View style={styles.form}>
            <Field
              label={t.auth.email}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Field
              label={t.auth.password}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              textContentType="password"
              autoComplete="password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <GradientButton label={t.auth.login} onPress={onSubmit} loading={busy} size="lg" />

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t.auth.noAccount}</Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={styles.link}> {t.auth.register}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </GlassCard>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[600],
    marginBottom: spacing.md,
    shadowColor: colors.brand[500],
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  logoMarkText: { fontSize: 30, fontWeight: '900', color: colors.ink },
  tagline: { fontSize: 14, color: colors.contentMuted, textAlign: 'center', marginTop: spacing.sm },
  langRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
  langBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
  },
  langText: { color: colors.content, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: colors.content },
  subtitle: {
    fontSize: 14,
    color: colors.contentMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  form: { gap: spacing.xs },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { color: colors.contentMuted, fontSize: 14 },
  link: { color: colors.brand[400], fontSize: 14, fontWeight: '700' },
});
