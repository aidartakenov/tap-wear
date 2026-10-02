'use client';

import Image from 'next/image';
import { Phone } from 'lucide-react';
import { BankBadge } from '@/components/BankBadge';
import { ErrorState, Loading } from '@/components/PageState';
import { getStoreOrders } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

// Paid orders of the store, newest first, with how to reach each buyer.
export function StoreOrders({ storeId }: { storeId: string }) {
  const { tr } = useApp();
  const { data, error } = useApi((signal) => getStoreOrders(storeId, signal), [storeId]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-600">
        {tr('Здесь появляются заказы после оплаты. Свяжитесь с покупателем, чтобы договориться о доставке или самовывозе.')}
      </p>
      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          {tr('Оплаченных заказов пока нет.')}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((order) => (
            <li key={order.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                {order.image_url && (
                  <Image src={order.image_url} alt="" fill sizes="64px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                  {tr('Заказ №{number}', { number: order.number })}
                  <span className="font-bold">{formatPrice(order.price_minor)}</span>
                  <BankBadge method={order.payment_method} className="h-5 w-5 rounded-md text-[9px]" />
                  {order.test_mode && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {tr('тестовая оплата')}
                    </span>
                  )}
                </p>
                <p className="truncate text-gray-900">{order.title}</p>
                <p className="text-gray-600">
                  {[order.size_label, order.color_name].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
                  <span>{tr('Покупатель: {name}', { name: order.buyer_name })}</span>
                  <a
                    href={`tel:${order.buyer_phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {order.buyer_phone}
                  </a>
                  {order.paid_at && (
                    <span>{new Date(order.paid_at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
