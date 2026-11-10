'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/feed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.invalidCredentials);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="gradient-text text-2xl font-extrabold tracking-tight">{t.auth.welcomeBack}</h1>
        <p className="mt-1 text-sm text-content-muted">{t.auth.loginSubtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t.auth.email}>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label={t.auth.password}>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t.auth.login}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-300 hover:text-brand-200 hover:underline">
          {t.auth.forgotPassword}
        </Link>
        <span className="text-content-muted">
          {t.auth.noAccount}{' '}
          <Link href="/register" className="font-semibold text-brand-300 hover:text-brand-200 hover:underline">
            {t.auth.register}
          </Link>
        </span>
      </div>
    </div>
  );
}
