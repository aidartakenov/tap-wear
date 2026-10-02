'use client';

import { ReactNode } from 'react';
import { CreditCard, RotateCcw, Store as StoreIcon, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { Store } from '@/lib/types';

function Line({ icon: Icon, title, children }: { icon: typeof Truck; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{title}</p>
        <div className="text-gray-600">{children}</div>
      </div>
    </div>
  );
}

// The store's own delivery, payment and return conditions, shown before a buyer contacts it.
export function StoreConditions({ store }: { store: Store }) {
  const { t, locale } = useApp();
  const policy = store.policy;

  if (!policy) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <h2 className="font-semibold text-gray-900">{t('conditions.title')}</h2>
        <p className="mt-1 text-gray-600">{t('conditions.none')}</p>
      </section>
    );
  }

  const fee =
    policy.delivery_fee_minor === null
      ? t('conditions.feeAsk')
      : policy.delivery_fee_minor === 0
        ? t('conditions.feeFree')
        : formatPrice(policy.delivery_fee_minor);
  const delivery = [policy.delivery_areas, fee, policy.delivery_time].filter(Boolean).join(' · ');
  const updated = new Date(policy.updated_at).toLocaleDateString(
    locale === 'ky' ? 'ky-KG' : 'ru-RU',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bishkek' }
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm space-y-3">
      <h2 className="font-semibold text-gray-900">{t('conditions.title')}</h2>
      {policy.pickup_available && (
        <Line icon={StoreIcon} title={t('conditions.pickup')}>
          {[store.city.name, store.address, store.market, store.sector, store.container]
            .filter(Boolean)
            .join(', ')}
        </Line>
      )}
      <Line icon={Truck} title={t('conditions.delivery')}>
        {policy.delivery_available ? (
          <>
            <p>{delivery}</p>
            {policy.try_on_at_delivery && <p>{t('conditions.tryOn')}</p>}
          </>
        ) : (
          t('conditions.noDelivery')
        )}
      </Line>
      {policy.payment_methods && (
        <Line icon={CreditCard} title={t('conditions.payment')}>
          {policy.payment_methods}
        </Line>
      )}
      <Line icon={RotateCcw} title={t('conditions.returns')}>
        {policy.return_days === null && !policy.return_terms ? (
          t('conditions.returnAsk')
        ) : (
          <>
            {policy.return_days !== null && (
              <p>{t('conditions.returnDays', { days: policy.return_days })}</p>
            )}
            {policy.return_terms && <p className="whitespace-pre-line">{policy.return_terms}</p>}
          </>
        )}
      </Line>
      <p className="border-t border-gray-100 pt-2 text-xs text-gray-500">
        {t('conditions.note')} {t('conditions.updated', { date: updated })}
      </p>
    </section>
  );
}
