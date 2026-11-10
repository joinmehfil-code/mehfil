import { en, type Dictionary } from './en';
import { ur } from './ur';

export const LOCALES = ['en', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Locales rendered right-to-left. */
export const RTL_LOCALES: Locale[] = ['ur'];

export const dictionaries: Record<Locale, Dictionary> = { en, ur };

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export { en, ur };
export type { Dictionary };
