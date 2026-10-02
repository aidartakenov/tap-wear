'use client';

import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { FormError } from '@/components/form';
import { resendVerification } from '@/lib/api';
import { useApp } from '@/lib/context';

// Shown to a signed-in person whose address is not confirmed yet.
export function VerifyEmailNotice() {
  const { me, t } = useApp();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!me || me.email_verified) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-semibold">
        <MailWarning className="w-4 h-4 shrink-0" />
        {t('email.notVerified')}
      </p>
      <p className="mt-1">{t('email.notVerifiedText', { email: me.email })}</p>
      {sent ? (
        <p className="mt-2 text-green-800">{t('email.resent')}</p>
      ) : (
        <button
          onClick={() =>
            resendVerification()
              .then(() => setSent(true))
              .catch(setError)
          }
          className="mt-2 font-medium text-amber-950 underline"
        >
          {t('email.resend')}
        </button>
      )}
      <FormError error={error} />
    </div>
  );
}
