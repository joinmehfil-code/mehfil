import { Prisma } from '@prisma/client';

/**
 * Serialization helpers shared across services/mappers.
 */

/** Convert a Prisma Decimal (or number/string/null) to a plain number (2dp). */
export function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
  fallback = 0,
): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value.toString());
  if (Number.isNaN(n)) return fallback;
  return Math.round(n * 100) / 100;
}

/** Round to 2 decimals safely. */
export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convert a Date (or ISO string) to an ISO string, or null. */
export function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/** Strip fields that must never leave the API (e.g. passwordHash). */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const clone = { ...obj };
  for (const k of keys) delete clone[k];
  return clone;
}

/** Parse a comma/space separated list of hashtags from post content. */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) || [];
  const tags = matches
    .map((m) => m.slice(1).toLowerCase())
    .filter((t) => t.length > 0);
  return Array.from(new Set(tags));
}

/** Parse @mentions from post content. */
export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/@[\p{L}\p{N}_]+/gu) || [];
  const mentions = matches.map((m) => m.slice(1).toLowerCase());
  return Array.from(new Set(mentions));
}

/** Convert an arbitrary string into a URL-safe slug. */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[\p{L}\p{N}_]+/gu, (m) => m)
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}
