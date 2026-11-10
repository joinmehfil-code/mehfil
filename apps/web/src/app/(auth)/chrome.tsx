'use client';

import { LanguageToggle, ThemeToggle } from '@/components/toggles';

/** Floating language + theme controls shown on auth screens. */
export function AuthChrome() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-end p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  );
}
