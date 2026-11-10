/**
 * Current-user profile tab: identity, stats, skills and quick links to
 * messages, notifications, tickets, settings, language toggle and logout.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfile } from '@mehfil/shared';
import { usersApi } from '@/lib/services';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { Avatar, Badge, Button, Card, Loading, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme/colors';
import { compactNumber } from '@/lib/format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.contentMuted} />
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.contentMuted} />
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, locale, toggleLocale } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(user);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      try {
        const p = await usersApi.profile(user.username);
        if (mounted) setProfile(p);
      } catch {
        /* keep the auth-provided user */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!profile) return <Loading label={t.common.loading} />;

  return (
    <Screen>
      <Card>
        <View style={styles.head}>
          <Avatar uri={profile.avatarUrl} name={profile.displayName} size={72} />
          <View style={styles.headText}>
            <Text style={styles.name}>{profile.displayName}</Text>
            <Text style={styles.handle}>@{profile.username}</Text>
            {profile.isVerified ? <Badge label="✓ Verified" tone="brand" /> : null}
          </View>
        </View>

        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        {profile.city ? <Text style={styles.meta}>{profile.city}{profile.country ? `, ${profile.country}` : ''}</Text> : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{compactNumber(profile.followersCount)}</Text>
            <Text style={styles.statLabel}>{t.profile.followers}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{compactNumber(profile.followingCount)}</Text>
            <Text style={styles.statLabel}>{t.profile.following}</Text>
          </View>
          <Pressable style={styles.stat} onPress={() => router.push(`/profile/${profile.username}`)}>
            <Text style={styles.statNum}>—</Text>
            <Text style={styles.statLabel}>{t.profile.posts}</Text>
          </Pressable>
        </View>

        {profile.skillsOffered?.length ? (
          <View style={styles.skills}>
            <Text style={styles.skillsTitle}>{t.profile.skillsOffered}</Text>
            <View style={styles.chips}>
              {profile.skillsOffered.map((s) => (
                <Badge key={s} label={s} tone="brand" />
              ))}
            </View>
          </View>
        ) : null}

        {profile.skillsWanted?.length ? (
          <View style={styles.skills}>
            <Text style={styles.skillsTitle}>{t.profile.skillsWanted}</Text>
            <View style={styles.chips}>
              {profile.skillsWanted.map((s) => (
                <Badge key={s} label={s} tone="accent" />
              ))}
            </View>
          </View>
        ) : null}
      </Card>

      <Card>
        <MenuRow icon="chatbubbles-outline" label={t.nav.messages} onPress={() => router.push('/messages')} />
        <MenuRow icon="notifications-outline" label={t.nav.notifications} onPress={() => router.push('/notifications')} />
        <MenuRow icon="ticket-outline" label={t.nav.tickets} onPress={() => router.push('/tickets')} />
        <MenuRow icon="qr-code-outline" label={t.events.checkin} onPress={() => router.push('/scan')} />
        <MenuRow icon="settings-outline" label={t.nav.settings} onPress={() => router.push('/settings')} />
        <MenuRow
          icon="language-outline"
          label={`${t.language.label}: ${locale === 'en' ? t.language.en : t.language.ur}`}
          onPress={toggleLocale}
        />
      </Card>

      <Button label={t.nav.logout} variant="danger" onPress={logout} icon={<Ionicons name="log-out-outline" size={18} color={colors.white} />} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '800', color: colors.content },
  handle: { fontSize: 14, color: colors.contentMuted },
  bio: { fontSize: 14, color: colors.content, marginTop: spacing.md, lineHeight: 20 },
  meta: { fontSize: 13, color: colors.contentMuted, marginTop: spacing.xs },
  stats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: 10 },
  statNum: { fontSize: 18, fontWeight: '800', color: colors.content },
  statLabel: { fontSize: 12, color: colors.contentMuted },
  skills: { marginTop: spacing.lg },
  skillsTitle: { fontSize: 13, fontWeight: '700', color: colors.content, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuLabel: { flex: 1, fontSize: 15, color: colors.content },
});
