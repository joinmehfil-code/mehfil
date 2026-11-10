'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MIN_AGE } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function RegisterPage() {
  const { t } = useI18n();
  const { register } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    phone: '',
  });
  const [acceptAge, setAcceptAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function ageOk(): boolean {
    if (!form.dateOfBirth) return true; // optional — server also enforces
    const dob = new Date(form.dateOfBirth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= MIN_AGE;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError(t.auth.confirmPassword);
      return;
    }
    if (!acceptAge || !ageOk()) {
      setError(t.auth.ageNotice);
      return;
    }

    setLoading(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        acceptedAge: true,
        phone: form.phone.trim() || undefined,
      });
      router.replace('/feed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="gradient-text text-2xl font-extrabold tracking-tight">{t.auth.createAccount}</h1>
        <p className="mt-1 text-sm text-content-muted">{t.auth.registerSubtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t.auth.displayName}>
          <Input
            required
            value={form.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label={t.auth.username} hint="letters, numbers, dot and underscore">
          <Input
            required
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            autoComplete="username"
            pattern="^[a-zA-Z0-9_.]{3,30}$"
          />
        </Field>
        <Field label={t.auth.email}>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.auth.password}>
            <Input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t.auth.confirmPassword}>
            <Input
              type="password"
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.auth.dateOfBirth}>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
            />
          </Field>
          <Field label={`${t.auth.phone} (${t.common.optional})`}>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              autoComplete="tel"
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm text-content-muted">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-brand-500 accent-brand-500"
            checked={acceptAge}
            onChange={(e) => setAcceptAge(e.target.checked)}
          />
          <span>{t.auth.acceptAge}</span>
        </label>

        {error && <p className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t.auth.register}
        </Button>
      </form>

      <p className="text-center text-sm text-content-muted">
        {t.auth.haveAccount}{' '}
        <Link href="/login" className="font-semibold text-brand-300 hover:text-brand-200 hover:underline">
          {t.auth.login}
        </Link>
      </p>
    </div>
  );
}
