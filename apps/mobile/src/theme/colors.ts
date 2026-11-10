/**
 * Mehfil mobile design tokens — a dark-first "night mehfil" palette that mirrors
 * the web brand so both platforms feel identical. Surfaces are deep ink with
 * glass (translucent white) overlays; the primary glow is emerald→teal, the
 * accent is gold→amber and the vibrant secondary is magenta→violet.
 */
export const colors = {
  /* Base surfaces */
  ink: '#060810',
  surface: '#0B0F1C',
  elevated: '#111726',
  /** Back-compat alias used by existing screens (screen background). */
  surfaceMuted: '#0B0F1C',
  surfaceBorder: 'rgba(255,255,255,0.12)',
  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.10)',
  hairline: 'rgba(255,255,255,0.10)',

  /* Text */
  content: '#F5F7FB',
  contentMuted: '#94A3B8',

  /* Primary — emerald glow */
  brand: {
    50: '#d8fff1',
    100: '#a9f6dc',
    200: '#72e9c4',
    300: '#3fdcab',
    400: '#14e7a6',
    500: '#00E5A0',
    600: '#06b48a',
    700: '#059077',
    800: '#0a6b58',
    900: '#084c3f',
  },

  /* Accent — gold/amber */
  accent: {
    50: '#fff6e0',
    100: '#ffe9b8',
    500: '#FFC65C',
    600: '#F59E0B',
    800: '#b45309',
  },

  /* Vibrant secondary — magenta/violet */
  secondary: {
    50: '#ffe6f0',
    100: '#ffc2dc',
    500: '#FF4D8D',
    600: '#A855F7',
    800: '#7e22ce',
  },

  danger: '#FF4D6D',
  dangerBg: 'rgba(255,77,109,0.15)',
  success: '#00E5A0',
  white: '#ffffff',
  black: '#000000',
} as const;

/** Dark-mode surface overrides. The palette is dark-first so these mirror it. */
export const darkColors = {
  surface: colors.surface,
  surfaceMuted: colors.surfaceMuted,
  surfaceBorder: colors.surfaceBorder,
  content: colors.content,
  contentMuted: colors.contentMuted,
} as const;

/** Gradient stop arrays for LinearGradient across the app. */
export const gradients = {
  primary: ['#00E5A0', '#06B6D4'] as const,
  accent: ['#FFC65C', '#F59E0B'] as const,
  secondary: ['#FF4D8D', '#A855F7'] as const,
  aurora: ['#00E5A0', '#A855F7', '#FFC65C'] as const,
  hero: ['#0B0F1C', '#111726', '#060810'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  full: 999,
} as const;
