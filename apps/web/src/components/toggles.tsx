'use client';

import { useI18n } from '@/i18n/provider';
import { useTheme } from '@/lib/theme';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** English ↔ Urdu switch. Sets locale (and therefore document dir). */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className={cn(
        'glass inline-flex items-center rounded-full p-0.5 text-xs font-semibold',
        className,
      )}
      role="group"
      aria-label={t.language.label}
    >
      {(['en', 'ur'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={cn(
            'rounded-full px-3 py-1 transition-all duration-200',
            locale === l
              ? 'bg-brand-gradient text-ink-900 shadow-glow'
              : 'text-content-muted hover:text-content',
          )}
          aria-pressed={locale === l}
        >
          {t.language[l]}
        </button>
      ))}
    </div>
  );
}

/** Light ↔ dark theme switch. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'glass inline-flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition hover:text-brand-300 hover:shadow-glow',
        className,
      )}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
