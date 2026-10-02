'use client';

import { useState } from 'react';
import { ErrorState, Loading } from '@/components/PageState';
import { getStoreAnalytics } from '@/lib/api';
import { StoreAnalytics } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Звонок',
  instagram: 'Instagram',
  website: 'Сайт магазина',
};

const sourceLabels: Record<string, string> = {
  direct: 'Прямой заход или TapWear',
  instagram: 'Instagram',
};

const number = (value: number) => value.toLocaleString('ru-RU');

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{number(value)}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

// The last `days` calendar days in Bishkek time, oldest first, as YYYY-MM-DD.
function lastDays(days: number): string[] {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek' });
  return Array.from({ length: days }, (_, index) =>
    format.format(new Date(Date.now() - (days - 1 - index) * 86_400_000))
  );
}

const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

// Product views per day: one series, thin columns from a common baseline.
function DailyViews({ data }: { data: StoreAnalytics }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const byDate = new Map(data.daily.map((day) => [day.date, day]));
  const days = lastDays(data.days).map((date) => ({
    date,
    views: byDate.get(date)?.product_views ?? 0,
    contacts: byDate.get(date)?.contact_clicks ?? 0,
  }));
  const max = Math.max(1, ...days.map((day) => day.views));
  const active = days.find((day) => day.date === hovered);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-gray-900">Просмотры товаров по дням</h3>
        <p className="text-xs text-gray-500" aria-live="polite">
          {active
            ? `${shortDate(active.date)}: просмотров ${number(active.views)}, обращений ${number(active.contacts)}`
            : `максимум за день: ${number(max)}`}
        </p>
      </div>
      <div
        className="mt-4 flex h-32 items-end gap-0.5 border-b border-gray-300"
        onMouseLeave={() => setHovered(null)}
      >
        {days.map((day) => (
          // The whole column slot is the hover target, not just the thin bar.
          <div
            key={day.date}
            onMouseEnter={() => setHovered(day.date)}
            onFocus={() => setHovered(day.date)}
            tabIndex={0}
            aria-label={`${shortDate(day.date)}: просмотров ${day.views}, обращений ${day.contacts}`}
            className={`flex h-full flex-1 items-end justify-center outline-none ${
              hovered === day.date ? 'bg-gray-100' : ''
            }`}
          >
            <div
              className="w-full max-w-6 rounded-t bg-blue-600"
              style={{ height: day.views ? `${Math.max(3, (day.views / max) * 100)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{shortDate(days[0].date)}</span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-gray-600">Показать таблицей</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="py-1 font-medium">День</th>
              <th className="py-1 font-medium text-right">Просмотры</th>
              <th className="py-1 font-medium text-right">Обращения</th>
            </tr>
          </thead>
          <tbody>
            {days
              .filter((day) => day.views || day.contacts)
              .map((day) => (
                <tr key={day.date} className="border-t border-gray-100">
                  <td className="py-1">{shortDate(day.date)}</td>
                  <td className="py-1 text-right tabular-nums">{number(day.views)}</td>
                  <td className="py-1 text-right tabular-nums">{number(day.contacts)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function CountList({
  title,
  rows,
  labels,
  empty,
}: {
  title: string;
  rows: { key: string; count: number }[];
  labels: Record<string, string>;
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-3 py-1.5">
              <span className="text-gray-700">{labels[row.key] ?? row.key}</span>
              <span className="font-medium tabular-nums text-gray-900">{number(row.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StoreStatistics({ storeId }: { storeId: string }) {
  const [days, setDays] = useState(7);
  const { data, error, loading } = useApi(
    (signal) => getStoreAnalytics(storeId, days, signal),
    [storeId, days]
  );

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const noActivity = data.visitors === 0;

  return (
    <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2" role="group" aria-label="Период">
        {[7, 30].map((value) => (
          <button
            key={value}
            onClick={() => setDays(value)}
            aria-pressed={days === value}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              days === value
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {value} дней
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Посетители" value={data.visitors} note="Открыли витрину или товар" />
        <Tile label="Просмотры товаров" value={data.product_views} />
        <Tile label="Просмотры витрины" value={data.store_views} />
        <Tile
          label="Обращения"
          value={data.contact_clicks}
          note={`От ${number(data.contacting_visitors)} ${
            data.contacting_visitors % 10 === 1 && data.contacting_visitors % 100 !== 11
              ? 'посетителя'
              : 'посетителей'
          }`}
        />
      </div>
      <p className="text-xs text-gray-500">
        Обращение — это нажатие на кнопку WhatsApp, звонка, Instagram или сайта. Это ещё не
        продажа: состоялась ли покупка, знает только магазин.
      </p>

      {noActivity ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          За этот период посещений не было. Поделитесь ссылкой на витрину в Instagram, добавив в
          конец <code className="rounded bg-gray-100 px-1">?source=instagram</code>, чтобы видеть
          переходы оттуда отдельно.
        </p>
      ) : (
        <>
          <DailyViews data={data} />
          <div className="grid gap-3 md:grid-cols-2">
            <CountList
              title="Откуда пришли посетители"
              rows={data.sources}
              labels={sourceLabels}
              empty="Нет данных"
            />
            <CountList
              title="Обращения по каналам"
              rows={data.contacts_by_channel}
              labels={channelLabels}
              empty="Обращений пока не было"
            />
          </div>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-900">Самые просматриваемые товары</h3>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="py-1 font-medium">Товар</th>
                  <th className="py-1 font-medium text-right">Просмотры</th>
                  <th className="py-1 font-medium text-right">Обращения</th>
                </tr>
              </thead>
              <tbody>
                {data.top_products.map((product) => (
                  <tr key={product.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-2 text-gray-700">{product.title}</td>
                    <td className="py-1.5 text-right tabular-nums">{number(product.views)}</td>
                    <td className="py-1.5 text-right tabular-nums">{number(product.contacts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <h3 className="font-semibold text-gray-900">Актуальность наличия</h3>
        <p className="mt-1 text-gray-700">
          Вариантов «в наличии» у опубликованных товаров: {number(data.freshness.in_stock_variants)}.
          Подтверждены недавно: {number(data.freshness.confirmed_recently)}.
        </p>
        {data.freshness.needs_confirmation > 0 && (
          <p className="mt-1 text-amber-800">
            Требуют подтверждения: {number(data.freshness.needs_confirmation)}. Покупатели видят у
            них «Наличие требует уточнения», пока вы не подтвердите наличие во вкладке «Товары».
          </p>
        )}
      </section>
    </div>
  );
}
