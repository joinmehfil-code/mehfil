'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Compass,
  Users,
  CalendarDays,
  MessageCircle,
  Bell,
  Ticket,
  User as UserIcon,
  Shield,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { disconnectSocket } from '@/lib/socket';
import { cn } from '@/lib/cn';
import { Avatar, Button, Spinner } from '@/components/ui';
import { LanguageToggle, ThemeToggle } from '@/components/toggles';

const isStaff = (role?: UserRole | string) =>
  role === UserRole.MODERATOR ||
  role === UserRole.ADMIN ||
  role === UserRole.SUPER_ADMIN ||
  role === 'MODERATOR' ||
  role === 'ADMIN' ||
  role === 'SUPER_ADMIN';

/* --------------------------------- Brand mark ------------------------------ */

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="relative grid place-items-center rounded-2xl bg-brand-gradient font-extrabold text-ink-900 shadow-glow"
    >
      <span style={{ fontSize: size * 0.5 }}>M</span>
      <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30" />
    </span>
  );
}

/* --------------------------------- AppShell -------------------------------- */

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="relative grid min-h-dvh place-items-center">
        <Spinner className="h-9 w-9 text-brand-400" />
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  const nav: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/feed', label: t.nav.home, icon: Home },
    { href: '/discover', label: t.nav.discover, icon: Compass },
    { href: '/communities', label: t.nav.communities, icon: Users },
    { href: '/events', label: t.nav.events, icon: CalendarDays },
    { href: '/messages', label: t.nav.messages, icon: MessageCircle },
    { href: '/notifications', label: t.nav.notifications, icon: Bell },
    { href: '/tickets', label: t.nav.tickets, icon: Ticket },
    { href: `/u/${user.username}`, label: t.nav.profile, icon: UserIcon },
  ];
  if (isStaff(user.role)) nav.push({ href: '/admin', label: t.nav.admin, icon: Shield });
  nav.push({ href: '/settings', label: t.nav.settings, icon: Settings });

  async function onLogout() {
    disconnectSocket();
    await logout();
    router.replace('/login');
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/feed' && pathname.startsWith(href));

  // Indices used for the compact mobile bottom bar.
  const mobileNav = [nav[0], nav[2], nav[3], nav[4], nav[7]];

  return (
    <div className="min-h-dvh">
      {/* ---------------------------- Desktop sidebar ---------------------------- */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-72 flex-col gap-2 p-4 lg:flex">
        <div className="glass-strong flex h-full flex-col rounded-3xl p-4">
          <Link href="/feed" className="mb-6 flex items-center gap-3 px-2">
            <BrandMark />
            <span className="gradient-text text-xl font-extrabold tracking-tight">
              {t.common.appName}
            </span>
          </Link>

          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'text-ink-900' : 'text-content-muted hover:text-content',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-brand-gradient shadow-glow"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      'relative z-10 h-5 w-5 transition-transform',
                      !active && 'group-hover:scale-110',
                    )}
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <div className="glass mt-3 flex items-center gap-2 rounded-2xl p-2">
            <Avatar src={user.avatarUrl} alt={user.displayName} size={38} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.displayName}</div>
              <div className="truncate text-xs text-content-muted">@{user.username}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              aria-label={t.nav.logout}
              className="px-2"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ------------------------------ Mobile top bar --------------------------- */}
      <header className="sticky top-0 z-20 px-3 pt-3 lg:hidden">
        <div className="glass-strong flex items-center justify-between rounded-2xl px-4 py-2.5">
          <Link href="/feed" className="flex items-center gap-2">
            <BrandMark size={32} />
            <span className="gradient-text text-lg font-extrabold">{t.common.appName}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              aria-label={t.nav.notifications}
              className={cn(
                'relative grid h-9 w-9 place-items-center rounded-xl transition-colors',
                isActive('/notifications')
                  ? 'bg-brand-500/20 text-brand-200'
                  : 'text-content-muted hover:bg-white/5',
              )}
            >
              <Bell className="h-5 w-5" />
            </Link>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* --------------------------------- Content ------------------------------- */}
      <main className="px-0 pb-24 lg:ps-72 lg:pb-8">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
      </main>

      {/* ----------------------------- Mobile bottom nav -------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 lg:hidden">
        <div className="glass-strong flex items-center justify-around rounded-2xl px-2 py-2">
          {mobileNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors',
                  active ? 'text-ink-900' : 'text-content-muted',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-active"
                    className="absolute inset-0 rounded-xl bg-brand-gradient shadow-glow"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <item.icon className="relative z-10 h-5 w-5" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
