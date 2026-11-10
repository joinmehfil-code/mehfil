import Link from 'next/link';
import { PLATFORM } from '@mehfil/shared';
import { AuroraBackground, FloatOrb, Reveal } from '@/components/motion';
import { AuthChrome } from './chrome';

const highlights = [
  'Communities that feel like home',
  'Discover events and mehfils near you',
  'Book tickets in seconds, enter with a QR',
  'Share skills, posts and messages',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh">
      {/* ------------------------- Left: animated brand panel ------------------------ */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <AuroraBackground />
        <FloatOrb color="rgba(16,185,129,0.45)" size={140} className="left-16 top-24" />
        <FloatOrb color="rgba(168,85,247,0.4)" size={110} className="bottom-28 left-40" delay={2} />
        <div className="relative z-10 flex h-full flex-col justify-center px-16">
          <Reveal>
            <Link href="/" className="mb-10 flex items-center gap-3">
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-brand-gradient text-2xl font-extrabold text-ink-900 shadow-glow">
                M
              </span>
              <span className="gradient-text text-2xl font-extrabold tracking-tight">
                {PLATFORM.name}
              </span>
            </Link>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white">
              Where your <span className="gradient-text-animated">mehfil</span> comes alive.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-4 max-w-md text-lg text-content-muted">{PLATFORM.tagline}</p>
          </Reveal>

          <ul className="mt-10 space-y-3">
            {highlights.map((h, i) => (
              <Reveal key={h} delay={0.25 + i * 0.08}>
                <li className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-content">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-ink-900">
                    ✓
                  </span>
                  {h}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>

      {/* ------------------------------ Right: form -------------------------------- */}
      <div className="relative flex w-full flex-col justify-center px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-xl font-extrabold text-ink-900 shadow-glow">
              M
            </span>
            <span className="gradient-text text-xl font-extrabold tracking-tight">
              {PLATFORM.name}
            </span>
          </Link>
          <div className="glass-strong rounded-3xl p-6 shadow-glass sm:p-8">{children}</div>
        </div>
      </div>

      <AuthChrome />
    </div>
  );
}
