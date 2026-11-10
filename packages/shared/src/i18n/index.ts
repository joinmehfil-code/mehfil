import { en, type Dictionary } from './en';
import { ur } from './ur';

/**
 * NOTE: named `AppLocale` (not `Locale`) to avoid clashing with the `Locale`
 * enum already exported from ./enums. Values are the same ('en' | 'ur').
 */
export type AppLocale = 'en' | 'ur';

export const LOCALES: AppLocale[] = ['en', 'ur'];
export const DEFAULT_LOCALE: AppLocale = 'en';

/** Locales rendered right-to-left. */
export const RTL_LOCALES: AppLocale[] = ['ur'];

export const dictionaries: Record<AppLocale, Dictionary> = { en, ur };

export function isRtl(locale: AppLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function dirFor(locale: AppLocale): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: string): value is AppLocale {
  return (LOCALES as string[]).includes(value);
}

export { en, ur };
export type { Dictionary };
