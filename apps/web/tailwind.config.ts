import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary glow: emerald -> teal
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Accent glow: gold -> amber
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Deep ink backgrounds for the dark, glassmorphic base
        ink: {
          900: '#060810',
          800: '#0b0f1c',
          700: '#111726',
          600: '#1a2234',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        urdu: ['var(--font-urdu)', 'Noto Nastaliq Urdu', 'serif'],
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(2,6,16,.4), 0 8px 30px rgba(2,6,16,.35)',
        glow: '0 0 20px -2px rgba(16,185,129,.55)',
        'glow-lg': '0 0 45px -4px rgba(16,185,129,.65)',
        'glow-accent': '0 0 30px -4px rgba(245,158,11,.6)',
        'glow-violet': '0 0 40px -6px rgba(139,92,246,.7)',
        'glow-rose': '0 0 40px -6px rgba(244,63,94,.6)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,.08), 0 8px 32px rgba(2,6,16,.45)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #00e5a0 0%, #06b6d4 100%)',
        'accent-gradient': 'linear-gradient(135deg, #ffc65c 0%, #f59e0b 100%)',
        'violet-gradient': 'linear-gradient(135deg, #ff4d8d 0%, #a855f7 100%)',
        'aurora-gradient':
          'radial-gradient(circle at 20% 20%, rgba(16,185,129,.35), transparent 45%), radial-gradient(circle at 80% 10%, rgba(168,85,247,.32), transparent 45%), radial-gradient(circle at 60% 80%, rgba(245,158,11,.25), transparent 50%)',
      },
      keyframes: {
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.75' },
          '33%': { transform: 'translate3d(4%,-6%,0) scale(1.12)', opacity: '1' },
          '66%': { transform: 'translate3d(-5%,4%,0) scale(0.95)', opacity: '0.85' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        aurora: 'aurora 18s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'glow-pulse': 'glow-pulse 3.5s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
