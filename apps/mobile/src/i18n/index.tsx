/**
 * Mobile i18n provider. Uses the shared dictionaries from @mehfil/shared so the
 * exact same translations power web and mobile. Persists the chosen locale and
 * drives RTL layout via I18nManager + a `rtl` flag consumed by components.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager } from 'react-native';
import {
  DEFAULT_LOCALE,
  dictionaries,
  isRtl,
  type AppLocale,
  type Dictionary,
} from '@mehfil/shared';
import { loadLocale, saveLocale } from '@/lib/storage';

interface I18nValue {
  locale: AppLocale;
  rtl: boolean;
  t: Dictionary;
  setLocale: (locale: AppLocale) => Promise<void>;
  toggleLocale: () => Promise<void>;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await loadLocale();
      if (!mounted) return;
      if (stored === 'en' || stored === 'ur') setLocaleState(stored);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep RN's layout direction in sync with the locale.
  useEffect(() => {
    const rtl = isRtl(locale);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
    I18nManager.swapLeftAndRightInRTL(rtl);
  }, [locale]);

  const setLocale = useCallback(async (next: AppLocale) => {
    setLocaleState(next);
    await saveLocale(next);
  }, []);

  const toggleLocale = useCallback(async () => {
    await setLocale(locale === 'en' ? 'ur' : 'en');
  }, [locale, setLocale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      rtl: isRtl(locale),
      t: dictionaries[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale],
  );

  // Avoid a flash of the wrong locale on first paint.
  if (!ready) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
