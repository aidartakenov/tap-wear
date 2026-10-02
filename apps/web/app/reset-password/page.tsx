'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Field, FormError, inputClass, primaryButton } from '@/components/form';
import { ApiError, resetPassword } from '@/lib/api';
import { useApp } from '@/lib/context';

function ResetPassword() {
  const token = useSearchParams().get('token') ?? '';
  const { t } = useApp();
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'form' | 'done' | 'invalid'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setState('done');
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'invalid_token') setState('invalid');
      else setError(cause);
    } finally {
      setBusy(false);
    }
  };

  if (state !== 'form') {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        <p>{t(state === 'done' ? 'reset.done' : 'reset.invalid')}</p>
        <Link
          href={state === 'done' ? '/login' : '/forgot-password'}
          className={`${primaryButton} mt-4`}
        >
          {t(state === 'done' ? 'nav.signIn' : 'forgot.send')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <Field label={t('profile.newPassword')} hint={t('login.passwordHint')}>
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <FormError error={error} />
      <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
        {t(busy ? 'login.wait' : 'reset.save')}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useApp();
  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('reset.title')}</h1>
        <Suspense>
          <ResetPassword />
        </Suspense>
      </main>
      <BottomNavigation />
    </div>
  );
}
