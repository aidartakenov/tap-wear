'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BankBadge } from '@/components/BankBadge';
import { StatusBadge, primaryButton, secondaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { getMyOrders } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

function Orders() {
  const { t, locale } = useApp();
  const { data, error } = useApi((signal) => getMyOrders(signal), []);

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
      {data.map((order) => (
        <li key={order.id} className="rounded-2xl border border-gray-200 bg-white p-3">
          <div className="flex gap-3">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {order.image_url && (
                <Image src={order.image_url} alt="" fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {t('pay.order', { number: order.number })}
                </span>
                <StatusBadge
                  status={order.status}
                  label={t(`orders.status.${order.status}`)}
                />
              </div>
              {order.product_id ? (
                <Link
                  href={`/products/${order.product_id}`}
                  className="mt-0.5 block truncate font-medium text-gray-900 hover:underline"
                >
                  {order.title}
                </Link>
              ) : (
                <p className="mt-0.5 truncate font-medium text-gray-900">{order.title}</p>
              )}
              <p className="text-sm text-gray-600">
                {[order.size_label, order.color_name, order.store_name].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <BankBadge method={order.payment_method} className="h-5 w-5 rounded-md text-[9px]" />
                <span className="font-bold text-gray-900">{formatPrice(order.price_minor)}</span>
                <span>
                  {new Date(order.created_at).toLocaleDateString(locale === 'ky' ? 'ky-KG' : 'ru-RU', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </p>
            </div>
          </div>
          {order.status === 'pending_payment' && (
            <Link href={`/pay/${order.id}`} className={`${secondaryButton} mt-3 w-full`}>
              {t('orders.payNow')}
            </Link>
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
