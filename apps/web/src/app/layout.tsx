import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { PLATFORM } from '@mehfil/shared';
import { DEFAULT_LOCALE, isLocale, dirFor, type Locale } from '@/i18n/config';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'),
  title: {
    default: `${PLATFORM.name} — ${PLATFORM.tagline}`,
    template: `%s · ${PLATFORM.name}`,
  },
  description: PLATFORM.tagline,
  applicationName: PLATFORM.name,
  keywords: ['community', 'events', 'tickets', 'skills', 'Pakistan', 'mehfil'],
  openGraph: {
    title: PLATFORM.name,
    description: PLATFORM.tagline,
    url: PLATFORM.webUrl,
    siteName: PLATFORM.name,
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#060810',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieLocale = cookies().get('mehfil.locale')?.value;
  const locale: Locale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
