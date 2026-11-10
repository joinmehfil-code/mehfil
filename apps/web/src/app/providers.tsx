'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n/provider';
import { ThemeProvider } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth';
import type { Locale } from '@/i18n/config';

/**
 * Global client providers: i18n (en/ur + RTL), theme (light/dark) and auth.
 * `locale` is seeded from the server (cookie) to avoid a flash on first paint.
 */
export function Providers({
  children,
  locale,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  return (
    <I18nProvider initialLocale={locale}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
