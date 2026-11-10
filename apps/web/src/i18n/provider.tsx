'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  dictionaries,
  dirFor,
  isLocale,
  isRtl,
  type Dictionary,
  type Locale,
} from './config';

const STORAGE_KEY = 'mehfil.locale';

interface I18nValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  rtl: boolean;
  /** The active dictionary — use like `t.nav.home`. */
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof document !== 'undefined') {
    const cookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${STORAGE_KEY}=`))
      ?.split('=')[1];
    if (cookie && isLocale(cookie)) return cookie;
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  }
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language.slice(0, 2);
    if (isLocale(nav)) return nav;
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  // On mount (client), reconcile with persisted/cookie/navigator locale.
  useEffect(() => {
    if (!initialLocale) setLocaleState(readInitialLocale());
  }, [initialLocale]);

  // Reflect locale on <html> for CSS :lang, dir and font switching.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dirFor(locale);
    root.classList.toggle('urdu', locale === 'ur');
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
    document.cookie = `${STORAGE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (isLocale(next)) setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === 'en' ? 'ur' : 'en'));
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirFor(locale),
      rtl: isRtl(locale),
      t: dictionaries[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
