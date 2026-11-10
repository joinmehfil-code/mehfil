/**
 * Formatting helpers for mobile. Written without Intl.RelativeTimeFormat /
 * Intl.NumberFormat because Hermes' Intl support is partial — we implement the
 * small amount of formatting we need by hand so it behaves identically on
 * Android, iOS and in Expo Go.
 */

/** Format an amount as a currency string (default PKR). */
export function formatMoney(amount: number, currency = 'PKR'): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  const grouped = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency} ${grouped}`;
}

const UR_UNITS: [number, string, string][] = [
  [60, 'second', 'سیکنڈ'],
  [3600, 'minute', 'منٹ'],
  [86400, 'hour', 'گھنٹہ'],
  [604800, 'day', 'دن'],
  [2629800, 'week', 'ہفتہ'],
  [31557600, 'month', 'مہینہ'],
];

/** Compact relative time (e.g. "3h ago" / "ابھی"). */
export function timeAgo(iso: string | Date, locale: 'en' | 'ur' = 'en'): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const ts = date.getTime();
  if (Number.isNaN(ts)) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);

  if (locale === 'ur') {
    if (seconds < 60) return 'ابھی';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} منٹ پہلے`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} گھنٹے پہلے`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} دن پہلے`;
    if (seconds < 2629800) return `${Math.floor(seconds / 604800)} ہفتے پہلے`;
    if (seconds < 31557600) return `${Math.floor(seconds / 2629800)} مہینے پہلے`;
    return `${Math.floor(seconds / 31557600)} سال پہلے`;
  }

  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m}m ago`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h}h ago`;
  }
  if (seconds < 604800) {
    const d = Math.floor(seconds / 86400);
    return `${d}d ago`;
  }
  if (seconds < 2629800) {
    const w = Math.floor(seconds / 604800);
    return `${w}w ago`;
  }
  if (seconds < 31557600) {
    const mo = Math.floor(seconds / 2629800);
    return `${mo}mo ago`;
  }
  const y = Math.floor(seconds / 31557600);
  return `${y}y ago`;
}

/** Long-ish absolute date/time for event listings. */
export function formatDate(iso: string | Date, locale: 'en' | 'ur' = 'en'): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString(locale === 'ur' ? 'ur-PK' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Compact integer with K/M suffix (counts, metrics). */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

/** Initials (up to 2) from a display name — used by avatar fallbacks. */
export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export { UR_UNITS };
