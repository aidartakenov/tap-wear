'use client';

import { useState } from 'react';
import { ErrorState, Loading } from '@/components/PageState';
import { getAdminOverview } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';
import { cn } from '@/lib/utils';

const PERIODS = [7, 30, 90];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-gray-900">{value}</p>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </div>
  );
}

// What is happening on the site: sales, new shops and buyers, day by day.
export function Overview() {
  const { tr } = useApp();
  const [days, setDays] = useState(30);
  const { data, error, loading } = useApi((signal) => getAdminOverview(days, signal), [days]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const peak = Math.max(1, ...data.days.map((day) => day.turnover_minor));
  const newUsers = data.days.reduce((sum, day) => sum + day.new_users, 0);
  const newStores = data.days.reduce((sum, day) => sum + day.new_stores, 0);
  const active = data.days.filter(
    (day) => day.orders || day.new_users || day.new_stores
  );

  return (
    <div className={cn('space-y-6', loading && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">{tr('Обзор')}</h2>
        <div className="flex overflow-hidden rounded-full border border-gray-300 text-sm font-medium">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setDays(period)}
              aria-pressed={days === period}
              className={cn(
                'px-3 py-1.5',
                days === period ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {tr('{n} дн.', { n: period })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat
          label={tr('Оборот за период')}
          value={formatPrice(data.turnover_minor)}
          note={tr('оплаченные заказы без возвратов')}
        />
        <Stat
          label={tr('Заказов за период')}
          value={String(data.orders)}
          note={data.refunded ? tr('возвратов: {n}', { n: data.refunded }) : undefined}
        />
        <Stat label={tr('Новых покупателей')} value={String(newUsers)} note={tr('всего аккаунтов: {n}', { n: data.users })} />
        <Stat label={tr('Новых магазинов')} value={String(newStores)} note={tr('работает: {n}', { n: data.stores_active })} />
        <Stat label={tr('Товаров в каталоге')} value={String(data.products_published)} />
        <Stat label={tr('Товаров на проверке')} value={String(data.products_pending)} />
        <Stat label={tr('Магазинов на проверке')} value={String(data.stores_pending)} />
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold text-gray-900">{tr('Оборот по дням')}</h3>
        <div className="flex h-40 items-end gap-px rounded-xl border border-gray-200 bg-white p-3">
          {data.days.map((day) => (
            <div
              key={day.day}
              title={`${day.day}: ${formatPrice(day.turnover_minor)}, ${tr('заказов: {n}', { n: day.orders })}`}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={cn('w-full rounded-t', day.turnover_minor ? 'bg-blue-600' : 'bg-gray-200')}
                // An empty day still shows a thin line, so the days stay readable.
                style={{ height: `${Math.max(2, (day.turnover_minor / peak) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <p className="flex justify-between text-xs text-gray-500">
          <span>{data.days[0]?.day}</span>
          <span>{data.days[data.days.length - 1]?.day}</span>
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-gray-900">{tr('Дни с событиями')}</h3>
        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
            {tr('За этот период ничего не происходило.')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">{tr('День')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Заказы')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Оборот')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Новые покупатели')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Новые магазины')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...active].reverse().map((day) => (
                  <tr key={day.day}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-900">{day.day}</td>
                    <td className="px-3 py-1.5 text-gray-700">{day.orders}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">
                      {formatPrice(day.turnover_minor)}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700">{day.new_users}</td>
                    <td className="px-3 py-1.5 text-gray-700">{day.new_stores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
