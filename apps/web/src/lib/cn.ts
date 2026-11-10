/** Tiny class-name joiner (avoids a dependency on clsx/tailwind-merge). */
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | Record<string, boolean>
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string' || typeof input === 'number') {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else if (typeof input === 'object') {
      for (const [key, val] of Object.entries(input)) {
        if (val) out.push(key);
      }
    }
  }
  return out.join(' ');
}

/** Format a number as a PKR (or given currency) amount. */
export function formatMoney(amount: number, currency = 'PKR', locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** Compact relative time (e.g. "3h ago") with an Intl fallback. */
export function timeAgo(iso: string | Date, locale = 'en'): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return locale === 'ur' ? 'ابھی' : 'just now';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
  ];
  let prev = 60;
  for (const [limit, unit] of divisions) {
    if (Math.abs(seconds) < limit) {
      return rtf.format(-Math.floor(seconds / prev), unit);
    }
    prev = limit;
  }
  return rtf.format(-Math.floor(seconds / prev), 'year');
}
