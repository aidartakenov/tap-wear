'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Field, FormError, inputClass, primaryButton } from '@/components/form';
import { useApp } from '@/lib/context';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, t } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await (mode === 'login' ? signIn(email, password) : signUp(email, password, name));
      // Administrators and sellers land in their work area, buyers in their profile.
      router.push(me.is_admin ? '/admin' : me.memberships.length ? '/cabinet' : '/profile');
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

  const tab = (value: 'login' | 'register', label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={`flex-1 rounded-md py-2 text-sm font-medium ${
        mode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(mode === 'login' ? 'login.title' : 'login.newAccount')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('login.intro')}
        </p>

        <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1">
          {tab('login', t('login.tabSignIn'))}
          {tab('register', t('login.tabRegister'))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          {mode === 'register' && (
            <Field label={t('login.name')}>
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                maxLength={100}
              />
            </Field>
          )}
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
          <Field
            label={t('login.password')}
            hint={mode === 'register' ? t('login.passwordHint') : undefined}
          >
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
            />
          </Field>
          <FormError error={error} />
          {mode === 'login' && (
            <Link href="/forgot-password" className="block text-sm text-blue-600 hover:underline">
              {t('login.forgot')}
            </Link>
          )}
          <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
            {t(busy ? 'login.wait' : mode === 'login' ? 'nav.signIn' : 'login.create')}
          </button>
        </form>
      </main>
      <BottomNavigation />
    </div>
  );
}
