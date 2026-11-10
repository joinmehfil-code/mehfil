'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Ticket, MessageCircle, Brain, Sparkles, ArrowRight } from 'lucide-react';
import { PLATFORM } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { Button, Spinner } from '@/components/ui';
import { LanguageToggle, ThemeToggle } from '@/components/toggles';
import {
  AuroraBackground,
  FloatOrb,
  Reveal,
  Stagger,
  StaggerItem,
  GradientText,
} from '@/components/motion';

export default function LandingPage() {
  const { t } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/feed');
  }, [loading, isAuthenticated, router]);

  const features = [
    { icon: Users, title: t.communities.title, body: t.communities.discover, glow: 'group-hover:shadow-glow' },
    { icon: Ticket, title: t.events.title, body: t.events.discover, glow: 'group-hover:shadow-glow-accent' },
    { icon: MessageCircle, title: t.messages.title, body: t.messages.newMessage, glow: 'group-hover:shadow-glow-violet' },
    { icon: Brain, title: t.profile.skillsOffered, body: t.profile.skillsWanted, glow: 'group-hover:shadow-glow-rose' },
  ];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AuroraBackground />
      <FloatOrb color="rgba(16,185,129,0.4)" size={160} className="left-[8%] top-[18%]" />
      <FloatOrb color="rgba(168,85,247,0.35)" size={130} className="right-[10%] top-[30%]" delay={2} />

      {/* --------------------------------- Header -------------------------------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-lg font-extrabold text-ink-900 shadow-glow">
            M
            <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30" />
          </span>
          <span className="gradient-text text-lg font-extrabold tracking-tight">
            {t.common.appName}
          </span>
        </motion.div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* ---------------------------------- Hero --------------------------------- */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
        <Reveal>
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-brand-200">
            <Sparkles className="h-3.5 w-3.5" />
            {PLATFORM.domain}
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            <GradientText as="span">{t.common.appName}</GradientText>
            <span className="mt-2 block text-content">
              gather. celebrate. belong.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mx-auto max-w-2xl text-lg text-content-muted">{t.common.tagline}</p>
        </Reveal>

        {loading ? (
          <Spinner className="h-6 w-6 text-brand-400" />
        ) : (
          <Reveal delay={0.24}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register">
                <Button size="lg" className="group px-6">
                  {t.auth.register}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="secondary" className="px-6">
                  {t.auth.login}
                </Button>
              </Link>
            </div>
          </Reveal>
        )}

        {/* ------------------------------ Feature grid ----------------------------- */}
        <Stagger className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className={`glass group h-full rounded-3xl p-5 text-start transition-shadow ${f.glow}`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-brand-300 ring-1 ring-inset ring-white/10 transition-colors group-hover:bg-brand-gradient group-hover:text-ink-900">
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="mt-3 font-semibold text-content">{f.title}</div>
                <div className="text-sm text-content-muted">{f.body}</div>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>
      </main>

      {/* --------------------------------- Footer -------------------------------- */}
      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-sm text-content-muted">
        © {new Date().getFullYear()} {PLATFORM.name} · {PLATFORM.domain}
      </footer>
    </div>
  );
}
