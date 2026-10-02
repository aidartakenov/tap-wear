'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Field, FormError, inputClass, primaryButton } from '@/components/form';
import { forgotPassword } from '@/lib/api';
import { useApp } from '@/lib/context';

export default function ForgotPasswordPage() {
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('forgot.title')}</h1>
        {sent ? (
          // The same message whether or not the address has an account.
          <p className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            {t('forgot.sent')}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-600">{t('forgot.text')}</p>
            <form
              onSubmit={submit}
              className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4"
            >
              <Field label={t('login.email')}>
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              <FormError error={error} />
              <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
                {t(busy ? 'login.wait' : 'forgot.send')}
              </button>
            </form>
          </>
        )}
        <Link href="/login" className="mt-4 block text-sm text-blue-600 hover:underline">
          {t('forgot.back')}
        </Link>
      </main>
      <BottomNavigation />
    </div>
  );
}
