'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Loading } from '@/components/PageState';
import { primaryButton } from '@/components/form';
import { useApp } from '@/lib/context';
import { Me } from '@/lib/types';

// Renders its children only for a signed-in account (optionally only for an
// administrator). This is a convenience for the interface; the API enforces
// the same rules on every request.
export function RequireAccount({
  admin = false,
  children,
}: {
  admin?: boolean;
  children: (me: Me) => ReactNode;
}) {
  const { me, t } = useApp();

  if (me === undefined) return <Loading />;
  if (me === null) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium text-gray-900">{t('account.signInToContinue')}</p>
        <Link href="/login" className={`${primaryButton} mt-4`}>
          {t('profile.signInOrRegister')}
        </Link>
      </div>
    );
  }
  if (admin && !me.is_admin) {
    return <p className="py-16 text-center text-gray-600">{t('account.adminOnly')}</p>;
  }
  return <>{children(me)}</>;
}
