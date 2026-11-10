/**
 * Core UI primitives for the Mehfil mobile app. Dark-first "night mehfil"
 * glassmorphism design system. A single barrel keeps imports simple
 * (`import { Button, GlassCard } from '@/components/ui'`) and mirrors the web
 * tokens so both platforms feel identical.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, gradients, radius, spacing } from '@/theme/colors';
import { initials } from '@/lib/format';

/* --------------------------------- Screen --------------------------------- */

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  refresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  refresh?: { refreshing: boolean; onRefresh: () => void };
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refresh.refreshing}
                onRefresh={refresh.onRefresh}
                tintColor={colors.brand[500]}
                colors={[colors.brand[500]]}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/* --------------------------------- Button --------------------------------- */

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
}: {
  label?: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === 'primary'
      ? colors.brand[600]
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.glassStrong
          : 'transparent';
  const fg = variant === 'primary' ? colors.ink : colors.content;
  const padV = size === 'sm' ? spacing.sm : size === 'lg' ? spacing.lg : spacing.md;
  const glow = variant === 'primary';

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.96, { damping: 18, stiffness: 320 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 320 }))}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: bg, paddingVertical: padV },
          variant === 'secondary' && styles.btnGlass,
          glow && styles.btnGlow,
          (disabled || loading) && styles.btnDisabled,
          pressed && !disabled && { opacity: 0.9 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <View style={styles.btnInner}>
            {icon}
            {label ? (
              <Text
                style={[
                  styles.btnLabel,
                  { color: fg },
                  size === 'sm' && { fontSize: 13 },
                  size === 'lg' && { fontSize: 17 },
                ]}
              >
                {label}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------ GradientButton ---------------------------- */

/**
 * Bold gradient CTA with a reanimated press spring and soft glow. The default
 * primary action across the redesigned app.
 */
export function GradientButton({
  label,
  onPress,
  colors: stops = gradients.primary,
  size = 'md',
  disabled,
  loading,
  icon,
  textColor = colors.ink,
  style,
}: {
  label?: string;
  onPress?: () => void;
  colors?: readonly string[];
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const padV = size === 'sm' ? spacing.sm : size === 'lg' ? spacing.lg : spacing.md;
  const height = size === 'sm' ? 40 : size === 'lg' ? 58 : 50;

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.95, { damping: 16, stiffness: 340 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 16, stiffness: 340 }))}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.gradBtn,
          { paddingVertical: padV, minHeight: height },
          (disabled || loading) && styles.btnDisabled,
          pressed && !disabled && { opacity: 0.92 },
        ]}
      >
        <LinearGradient
          colors={[...stops]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <View style={styles.btnInner}>
            {icon}
            {label ? (
              <Text
                style={[
                  styles.btnLabel,
                  { color: textColor },
                  size === 'sm' && { fontSize: 13 },
                  size === 'lg' && { fontSize: 17 },
                ]}
              >
                {label}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/* -------------------------------- GlassCard -------------------------------- */

/**
 * Frosted-glass panel (BlurView) with a translucent hairline border and an
 * optional gradient top edge. The base building block of the redesign.
 */
export function GlassCard({
  children,
  style,
  onPress,
  accent = false,
  intensity = 30,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accent?: boolean;
  intensity?: number;
}) {
  const content = (
    <>
      <BlurView
        intensity={intensity}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {accent ? (
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.glassAccent}
        />
      ) : null}
      <View style={styles.glassInner}>{children}</View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.glass, pressed && { opacity: 0.9 }, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.glass, style]}>{content}</View>;
}

/* --------------------------------- Avatar --------------------------------- */

export function Avatar({
  uri,
  name,
  size = 44,
  ring = true,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const pad = ring ? 2 : 0;
  const outer = {
    width: size + pad * 2,
    height: size + pad * 2,
    borderRadius: (size + pad * 2) / 2,
  };
  const box = { width: size, height: size, borderRadius: size / 2 };
  const img = uri ? (
    <Image source={{ uri }} style={[box, styles.avatarImg]} />
  ) : (
    <View style={[box, styles.avatarFallback]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
  if (!ring) return img;
  return (
    <LinearGradient
      colors={[...gradients.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[outer, styles.avatarRing]}
    >
      <View style={[box, styles.avatarRingInner]}>{img}</View>
    </LinearGradient>
  );
}

/* ---------------------------------- Input --------------------------------- */

export interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
}

export function Field({ label, error, hint, style, ...rest }: FieldProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.contentMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* -------------------------------- Badges ---------------------------------- */

export function Badge({
  label,
  tone = 'brand',
}: {
  label: string;
  tone?: 'brand' | 'accent' | 'muted' | 'danger' | 'violet';
}) {
  const map = {
    brand: { bg: 'rgba(0,229,160,0.16)', fg: colors.brand[300], bd: 'rgba(0,229,160,0.35)' },
    accent: { bg: 'rgba(255,198,92,0.16)', fg: colors.accent[500], bd: 'rgba(255,198,92,0.35)' },
    muted: { bg: colors.glass, fg: colors.contentMuted, bd: colors.hairline },
    danger: { bg: colors.dangerBg, fg: colors.danger, bd: 'rgba(255,77,109,0.35)' },
    violet: { bg: 'rgba(168,85,247,0.16)', fg: colors.secondary[600], bd: 'rgba(168,85,247,0.35)' },
  } as const;
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.bd }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

/* --------------------------------- Loading -------------------------------- */

/** Animated glowing pulse loader. */
export function Loading({ label }: { label?: string }) {
  const pulse = useSharedValue(0.6);
  pulse.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.ease) }),
    ),
    -1,
    false,
  );
  const animated = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.85 + pulse.value * 0.3 }],
  }));
  return (
    <View style={styles.loading}>
      <Animated.View style={[styles.loadingDot, animated]}>
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

/* --------------------------------- Reveal --------------------------------- */

/** Fade + rise enter animation for lists and sections. */
export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(480).delay(delay).springify()} style={style}>
      {children}
    </Animated.View>
  );
}

/* --------------------------------- Header --------------------------------- */

export function Row({
  children,
  style,
  gap = spacing.sm,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

/** Headline text filled with a horizontal brand gradient. */
export function GradientTitle({
  children,
  stops = gradients.primary,
  style,
}: {
  children: string;
  stops?: readonly string[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={[...stops]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={style}>
      <Text style={styles.gradientTitle}>{children}</Text>
    </LinearGradient>
  );
}

/* --------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ink },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },

  btn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGlass: { borderWidth: 1, borderColor: colors.hairline },
  btnGlow: {
    shadowColor: colors.brand[500],
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btnLabel: { fontSize: 15, fontWeight: '700' },
  gradBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.brand[500],
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  card: {
    backgroundColor: colors.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  glass: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.glass,
  },
  glassAccent: { height: 2, width: '100%' },
  glassInner: { padding: spacing.lg },

  avatarRing: { alignItems: 'center', justifyContent: 'center' },
  avatarRingInner: { padding: 2, backgroundColor: colors.surface, borderRadius: radius.full },
  avatarImg: { backgroundColor: colors.elevated },
  avatarFallback: {
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.ink, fontWeight: '800' },

  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.content,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.content,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
  fieldHint: { color: colors.contentMuted, fontSize: 12, marginTop: spacing.xs },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.content, textAlign: 'center' },
  emptyMsg: {
    fontSize: 14,
    color: colors.contentMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  loading: { alignItems: 'center', paddingVertical: spacing.xl },
  loadingDot: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  loadingText: { marginTop: spacing.sm, color: colors.contentMuted, fontSize: 13 },

  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.content },
  subtitle: { fontSize: 14, color: colors.contentMuted },
  gradientTitle: { fontSize: 24, fontWeight: '900', color: colors.white },
});
