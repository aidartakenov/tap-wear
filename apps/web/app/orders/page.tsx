'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BankBadge } from '@/components/BankBadge';
import {
  FormError,
  StatusBadge,
  dangerButton,
  primaryButton,
  secondaryButton,
} from '@/components/form';
import { OrderDelivery, OrderItems } from '@/components/OrderItems';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { cancelOrder, getMyOrders } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { ORDER_STEPS, Order, OrderStatus } from '@/lib/types';
import { useApi } from '@/lib/useApi';

// Where a paid order is on its way: paid, accepted, shipped, received.
function Steps({ status }: { status: OrderStatus }) {
  const { t } = useApp();
  const reached = ORDER_STEPS.indexOf(status);
  if (reached < 0) return null;
  return (
    <ol className="mt-3 flex items-start gap-1">
      {ORDER_STEPS.map((step, index) => (
        <li key={step} className="flex-1">
          <span
            className={`block h-1.5 rounded-full ${index <= reached ? 'bg-blue-600' : 'bg-gray-200'}`}
          />
          <span
            className={`mt-1 block text-[11px] leading-tight ${
              index <= reached ? 'font-semibold text-gray-900' : 'text-gray-500'
            }`}
          >
            {t(`orders.step.${step as 'paid'}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Orders() {
  const { t, locale } = useApp();
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);
  const { data, error } = useApi((signal) => getMyOrders(signal), [refresh]);

  const cancel = async (order: Order) => {
    // A paid order is refunded, so ask before doing it.
    if (order.status === 'paid' && !window.confirm(t('orders.cancelConfirm', { number: order.number }))) {
      return;
    }
    setFailure(null);
    try {
      await cancelOrder(order.id);
    } catch (cause) {
      setFailure(cause);
    }
    setRefresh((value) => value + 1);
  };

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  if (data.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">{t('orders.empty')}</p>
        <Link href="/catalog" className={`${primaryButton} mt-4`}>
          {t('pay.backToCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      <FormError error={failure} />
      {data.map((order) => (
        <li key={order.id} className="rounded-2xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {t('pay.order', { number: order.number })}
            </span>
            <StatusBadge status={order.status} label={t(`orders.status.${order.status}`)} />
            <span className="ml-auto text-sm text-gray-500">
              {new Date(order.created_at).toLocaleDateString(locale === 'ky' ? 'ky-KG' : 'ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
            </span>
          </div>
          <p className="mb-2 text-sm text-gray-600">{order.store_name}</p>
          <OrderItems items={order.items} links />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <OrderDelivery order={order} />
            <p className="flex items-center gap-2 font-bold text-gray-900">
              <BankBadge method={order.payment_method} className="h-5 w-5 rounded-md text-[9px]" />
              {formatPrice(order.total_minor)}
            </p>
          </div>
          <Steps status={order.status} />
          {order.status === 'refunded' && order.closing_note && (
            <p className="mt-2 text-sm text-red-700">
              {t('orders.reason', { note: order.closing_note })}
            </p>
          )}
          {(order.status === 'pending_payment' || order.can_cancel) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {order.status === 'pending_payment' && (
                <Link href={`/pay/${order.id}`} className={`${primaryButton} flex-1`}>
                  {t('orders.payNow')}
                </Link>
              )}
              {order.can_cancel && (
                <button onClick={() => cancel(order)} className={`${dangerButton} flex-1`}>
                  {t('orders.cancel')}
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  const { t } = useApp();
  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/profile" aria-label={t('profile.title')} className={`${secondaryButton} !px-2.5`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{t('orders.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <RequireAccount>{() => <Orders />}</RequireAccount>
      </main>
    </div>
  );
}
