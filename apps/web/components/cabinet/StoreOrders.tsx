'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { BankBadge } from '@/components/BankBadge';
import {
  FormError,
  StatusBadge,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/form';
import { OrderDelivery, OrderItems } from '@/components/OrderItems';
import { ErrorState, Loading } from '@/components/PageState';
import { advanceOrder, getStoreOrders, refuseOrder } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { MerchantOrder, OrderStatus } from '@/lib/types';
import { useApi } from '@/lib/useApi';

// The one step the store can take from each status, and what the button says.
const nextStep: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  paid: { to: 'accepted', label: 'Принять заказ' },
  accepted: { to: 'shipped', label: 'Передан в доставку' },
  shipped: { to: 'completed', label: 'Покупатель получил' },
};

function OrderRow({ initial }: { initial: MerchantOrder }) {
  const { tr, t } = useApp();
  const [order, setOrder] = useState(initial);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (action: () => Promise<MerchantOrder>) => {
    setBusy(true);
    setError(null);
    try {
      setOrder(await action());
      setRefusing(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const step = nextStep[order.status];
  const canRefuse = order.status === 'paid' || order.status === 'accepted';

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="space-y-2 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
          {tr('Заказ №{number}', { number: order.number })}
          <StatusBadge
            status={order.status}
            label={order.status === 'paid' ? tr('Ждёт вашего ответа') : t(`orders.status.${order.status}`)}
          />
          {order.test_mode && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {tr('тестовая оплата')}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 font-bold">
            <BankBadge method={order.payment_method} className="h-5 w-5 rounded-md text-[9px]" />
            {formatPrice(order.total_minor)}
          </span>
        </p>
        <OrderItems items={order.items} />
        <OrderDelivery order={order} />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
          <span>{tr('Покупатель: {name}', { name: order.buyer_name })}</span>
          <a
            href={`tel:${order.buyer_phone.replace(/[^\d+]/g, '')}`}
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {order.buyer_phone}
          </a>
          {order.paid_at && (
            <span>
              {new Date(order.paid_at).toLocaleString('ru-RU', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          )}
        </p>
        {order.closing_note && (
          <p className="text-red-700">{tr('Причина: {note}', { note: order.closing_note })}</p>
        )}
      </div>

      {(step || canRefuse) && !refusing && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {step && (
            <button
              onClick={() => run(() => advanceOrder(order.id, step.to))}
              disabled={busy}
              className={primaryButton}
            >
              {tr(step.label)}
            </button>
          )}
          {canRefuse && (
            <button onClick={() => setRefusing(true)} disabled={busy} className={dangerButton}>
              {tr('Отказать')}
            </button>
          )}
        </div>
      )}
      {refusing && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <input
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={tr('Почему заказ нельзя выполнить? Покупатель увидит это.')}
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(() => refuseOrder(order.id, reason.trim()))}
              disabled={busy || reason.trim().length < 3}
              className={dangerButton}
            >
              {tr('Отказать и вернуть деньги')}
            </button>
            <button onClick={() => setRefusing(false)} disabled={busy} className={secondaryButton}>
              {tr('Не отказывать')}
            </button>
          </div>
        </div>
      )}
      <FormError error={error} />
    </li>
  );
}

// A store's orders from payment onwards, newest first. The store accepts each
// one and marks its progress; the buyer sees every step.
export function StoreOrders({ storeId }: { storeId: string }) {
  const { tr } = useApp();
  const { data, error } = useApi((signal) => getStoreOrders(storeId, signal), [storeId]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-600">
        {tr('Заказы появляются здесь после оплаты. Примите заказ, свяжитесь с покупателем и отмечайте каждый шаг: он видит их у себя.')}
      </p>
      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          {tr('Оплаченных заказов пока нет.')}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((order) => (
            <OrderRow key={order.id} initial={order} />
          ))}
        </ul>
      )}
    </section>
  );
}
