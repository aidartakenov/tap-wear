'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CircleCheck, CircleX, ShieldCheck } from 'lucide-react';
import { BankBadge, bankColor } from '@/components/BankBadge';
import { FormError, primaryButton, secondaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { cancelOrder, confirmTestPayment, getOrder } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { Order } from '@/lib/types';
import { useApi } from '@/lib/useApi';

function Outcome({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  const { t } = useApp();
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-4 text-2xl font-extrabold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/orders" className={primaryButton}>
          {t('pay.myOrders')}
        </Link>
        <Link href="/catalog" className={secondaryButton}>
          {t('pay.backToCatalog')}
        </Link>
      </div>
    </div>
  );
}

function Payment({ id }: { id: string }) {
  const { t } = useApp();
  const { data, error } = useApi((signal) => getOrder(id, signal), [id]);
  const [changed, setChanged] = useState<Order | null>(null);
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  if (error) return <ErrorState error={error} />;
  const order = changed ?? data;
  if (!order) return <Loading />;

  const run = async (name: 'pay' | 'cancel', action: () => Promise<Order>) => {
    setBusy(name);
    setFailure(null);
    try {
      setChanged(await action());
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(null);
    }
  };

  if (order.status === 'paid') {
    return (
      <Outcome
        icon={<CircleCheck className="h-16 w-16 text-green-600" strokeWidth={1.5} />}
        title={t('pay.done')}
        text={t('pay.doneText', { number: order.number, store: order.store_name })}
      />
    );
  }
  if (order.status === 'cancelled') {
    return (
      <Outcome
        icon={<CircleX className="h-16 w-16 text-gray-400" strokeWidth={1.5} />}
        title={t('pay.cancelled')}
        text={t('pay.cancelledText')}
      />
    );
  }

  return (
    // Stands in for the bank's own app while payments run in test mode.
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
      <div className={`flex items-center gap-3 p-5 text-white ${bankColor(order.payment_method)}`}>
        <BankBadge method={order.payment_method} className="bg-white/20" />
        <div>
          <p className="text-lg font-bold leading-tight">{order.payment_method_name}</p>
          <p className="text-sm text-white/85">{t('pay.title')}</p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="text-center">
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">
            {formatPrice(order.price_minor)}
          </p>
          <p className="mt-1 text-sm text-gray-600">{t('pay.order', { number: order.number })}</p>
        </div>

        <dl className="divide-y divide-gray-100 rounded-2xl bg-gray-50 px-4 text-sm">
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-gray-500">{t('pay.to')}</dt>
            <dd className="text-right font-medium text-gray-900">{order.store_name}</dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="shrink-0 text-gray-500">{order.title}</dt>
            <dd className="text-right text-gray-700">
              {[order.size_label, order.color_name].filter(Boolean).join(' · ')}
            </dd>
          </div>
        </dl>

        {order.test_mode && (
          <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('pay.testNote')}
          </p>
        )}

        <FormError error={failure} />

        <div className="space-y-2">
          <button
            onClick={() => run('pay', () => confirmTestPayment(order.id))}
            disabled={busy !== null || !order.test_mode}
            className={`${primaryButton} !h-12 w-full text-base`}
          >
            {busy === 'pay' ? t('pay.confirming') : t('pay.confirm')}
          </button>
          <button
            onClick={() => run('cancel', () => cancelOrder(order.id))}
            disabled={busy !== null}
            className={`${secondaryButton} w-full`}
          >
            {t('pay.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  const id = String(useParams().id);
  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <main className="mx-auto max-w-md px-4 py-6 md:py-10">
        <RequireAccount>{() => <Payment id={id} />}</RequireAccount>
      </main>
    </div>
  );
}
