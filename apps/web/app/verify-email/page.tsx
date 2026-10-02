'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { primaryButton } from '@/components/form';
import { Loading } from '@/components/PageState';
import { getMe, verifyEmail } from '@/lib/api';
import { useApp } from '@/lib/context';

function VerifyEmail() {
  const token = useSearchParams().get('token') ?? '';
  const { t, me, setMe } = useApp();
  const [state, setState] = useState<'checking' | 'done' | 'invalid'>('checking');
  // The token works once, so the request must not be repeated (React's
  // development mode runs effects twice).
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    verifyEmail(token)
      .then(async () => {
        setState('done');
        // Refresh the account, so the "not confirmed" notice disappears.
        const account = await getMe().catch(() => null);
        if (account) setMe(account);
      })
      .catch(() => setState('invalid'));
    // Runs once for the token in the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state === 'checking') return <Loading label={t('email.verifying')} />;
  return (
    <div className="py-12 text-center">
      <h1 className="text-xl font-bold text-gray-900">
        {t(state === 'done' ? 'email.verified' : 'email.invalidLink')}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {t(state === 'done' ? 'email.verifiedText' : 'email.invalidLinkText')}
      </p>
      <Link href={me === null ? '/login' : '/profile'} className={`${primaryButton} mt-6`}>
        {t(me === null ? 'nav.signIn' : 'email.toProfile')}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <main className="mx-auto max-w-md px-4 py-8">
        <Suspense>
          <VerifyEmail />
        </Suspense>
      </main>
      <BottomNavigation />
    </div>
  );
}
