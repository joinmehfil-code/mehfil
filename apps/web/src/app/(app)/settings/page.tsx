'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { usersApi } from '@/lib/services';
import { ApiError } from '@/lib/api';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { LanguageToggle, ThemeToggle } from '@/components/toggles';

function toList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { user, setUser, refreshUser } = useAuth();
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    aboutMe: '',
    city: '',
    country: '',
    phone: '',
    interests: '',
    skillsOffered: '',
    skillsWanted: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName ?? '',
      bio: user.bio ?? '',
      aboutMe: user.aboutMe ?? '',
      city: user.city ?? '',
      country: user.country ?? '',
      phone: user.phone ?? '',
      interests: (user.interests ?? []).join(', '),
      skillsOffered: (user.skillsOffered ?? []).join(', '),
      skillsWanted: (user.skillsWanted ?? []).join(', '),
    });
  }, [user]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await usersApi.updateMe({
        displayName: form.displayName.trim(),
        bio: form.bio.trim() || null,
        aboutMe: form.aboutMe.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        interests: toList(form.interests),
        skillsOffered: toList(form.skillsOffered),
        skillsWanted: toList(form.skillsWanted),
      });
      setUser(updated);
      await refreshUser();
      setMessage(t.common.save);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.nav.settings}</h1>

      <div className="card space-y-3">
        <p className="text-sm font-semibold text-content-muted">{t.language.label}</p>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <p className="text-sm font-semibold">{t.profile.editProfile}</p>
        <Field label={t.auth.displayName}>
          <Input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} required />
        </Field>
        <Field label={t.profile.bio}>
          <Textarea rows={2} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        </Field>
        <Field label="About me">
          <Textarea rows={3} value={form.aboutMe} onChange={(e) => set('aboutMe', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.profile.city}>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label={t.profile.country}>
            <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
        </div>
        <Field label={t.auth.phone}>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t.profile.interests} hint="comma separated">
          <Input value={form.interests} onChange={(e) => set('interests', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.profile.skillsOffered} hint="comma separated">
            <Input value={form.skillsOffered} onChange={(e) => set('skillsOffered', e.target.value)} />
          </Field>
          <Field label={t.profile.skillsWanted} hint="comma separated">
            <Input value={form.skillsWanted} onChange={(e) => set('skillsWanted', e.target.value)} />
          </Field>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
