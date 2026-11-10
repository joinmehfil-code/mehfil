'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { http, ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await http.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="gradient-text text-2xl font-extrabold tracking-tight">{t.auth.resetPassword}</h1>
        <p className="mt-1 text-sm text-content-muted">{t.auth.forgotPassword}</p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-brand-400/30 bg-brand-500/15 px-3 py-2 text-sm text-brand-200">
            {t.auth.verifyEmailBody}
          </p>
          <Link href="/login">
            <Button variant="secondary" className="w-full">
              {t.auth.login}
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t.auth.email}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          {error && <p className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {t.common.submit}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-content-muted">
        <Link href="/login" className="font-semibold text-brand-300 hover:text-brand-200 hover:underline">
          {t.common.back}
        </Link>
      </p>
    </div>
  );
}
