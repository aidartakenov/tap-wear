'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Download, FileText, Trash2 } from 'lucide-react';
import { FormError, StatusBadge, secondaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { SalesReport, getSalesPdf, getSalesReport, removeShopSale } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';
import { cn } from '@/lib/utils';

const PERIODS: { days: number; label: string }[] = [
  { days: 1, label: 'Сегодня' },
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 365, label: 'Год' },
];

// Short words for a size the store does not count.
const stockShort = { in_stock: 'Есть', out_of_stock: 'Нет', unknown: 'Не указано' } as const;

const number = (value: number) => value.toLocaleString('ru-RU');
const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
const moment = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-gray-900">{value}</p>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

// Revenue per day as columns; the day under the pointer is spelled out above.
function Days({ report }: { report: SalesReport }) {
  const { tr } = useApp();
  const [hovered, setHovered] = useState<string | null>(null);
  const peak = Math.max(1, ...report.by_day.map((day) => day.revenue_minor));
  const active = report.by_day.find((day) => day.date === hovered);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{tr('Выручка по дням')}</h3>
        <p className="text-xs text-gray-500" aria-live="polite">
          {active
            ? tr('{date}: {sum}, вещей {n}', {
                date: shortDate(active.date),
                sum: formatPrice(active.revenue_minor),
                n: active.pieces,
              })
            : tr('лучший день: {sum}', { sum: formatPrice(peak === 1 ? 0 : peak) })}
        </p>
      </div>
      <div className="mt-3 flex h-28 items-end gap-px" onMouseLeave={() => setHovered(null)}>
        {report.by_day.map((day) => (
          <div
            key={day.date}
            onMouseEnter={() => setHovered(day.date)}
            className={cn('flex h-full flex-1 items-end', hovered === day.date && 'bg-gray-100')}
          >
            <div
              className={cn('w-full rounded-t', day.revenue_minor ? 'bg-blue-600' : 'bg-gray-200')}
              style={{ height: `${Math.max(2, (day.revenue_minor / peak) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{shortDate(report.by_day[0].date)}</span>
        <span>{shortDate(report.by_day[report.by_day.length - 1].date)}</span>
      </div>
    </section>
  );
}

// A named list with a bar for each row: which categories, sizes or colours sell.
function Shares({ title, rows }: { title: string; rows: SalesReport['sizes'] }) {
  const { tr } = useApp();
  const most = Math.max(1, ...rows.map((row) => row.pieces));
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {rows.slice(0, 8).map((row) => (
          <li key={row.key}>
            <div className="flex justify-between gap-2">
              <span className="truncate text-gray-800">{row.key === '—' ? tr('не указано') : row.key}</span>
              <span className="shrink-0 tabular-nums text-gray-600">
                {tr('{n} шт.', { n: number(row.pieces) })} · {formatPrice(row.revenue_minor)}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(row.pieces / most) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The store's sales book: totals, what sold, every sale, and what is left.
export function StoreSales({ storeId }: { storeId: string }) {
  const { tr, t } = useApp();
  const [days, setDays] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(50);
  const [stockFilter, setStockFilter] = useState<'all' | 'low'>('all');
  const [failure, setFailure] = useState<unknown>(null);
  const [makingPdf, setMakingPdf] = useState(false);
  const { data, error, loading } = useApi(
    (signal) => getSalesReport(storeId, days, signal),
    [storeId, days, refresh]
  );
  const reload = () => setRefresh((value) => value + 1);

  const stock = useMemo(
    () =>
      (data?.stock ?? []).filter(
        (row) =>
          stockFilter === 'all' ||
          row.availability === 'out_of_stock' ||
          (row.quantity !== null && row.quantity <= 2)
      ),
    [data, stockFilter]
  );

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const { summary } = data;

  // The whole book for the period as a file that opens in Excel.
  const download = () => {
    const cell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Дата', 'Где продано', 'Заказ', 'Товар', 'Размер', 'Цвет', 'Штук', 'Цена, сом', 'Сумма, сом', 'Покупатель', 'Заметка'],
      ...data.lines.map((line) => [
        new Date(line.sold_at).toLocaleString('ru-RU'),
        line.channel === 'site' ? 'Сайт' : 'Магазин',
        line.order_number ?? '',
        line.title,
        line.size_label ?? '',
        line.color_name ?? '',
        line.quantity,
        (line.price_minor / 100).toFixed(2).replace('.', ','),
        (line.total_minor / 100).toFixed(2).replace('.', ','),
        line.buyer ?? '',
        line.note ?? '',
      ]),
    ];
    const text = '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
    save(new Blob([text], { type: 'text/csv;charset=utf-8' }), 'csv');
  };

  const save = (file: Blob, extension: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `tapwear-prodazhi-${data.by_day[0].date}_${data.by_day[data.by_day.length - 1].date}.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // The same book as a PDF: to print, or to send to the owner or the accountant.
  const downloadPdf = async () => {
    setFailure(null);
    setMakingPdf(true);
    try {
      save(await getSalesPdf(storeId, days), 'pdf');
    } catch (cause) {
      setFailure(cause);
    } finally {
      setMakingPdf(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(tr('Убрать эту продажу из отчёта? Количество на складе вернётся.'))) return;
    setFailure(null);
    try {
      await removeShopSale(id);
      reload();
    } catch (cause) {
      setFailure(cause);
    }
  };

  const head = 'px-3 py-2 font-semibold';
  return (
    <div className={cn('space-y-4', loading && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
          role="group"
          aria-label={tr('Период')}
        >
          {PERIODS.map((period) => (
            <button
              key={period.days}
              onClick={() => setDays(period.days)}
              aria-pressed={days === period.days}
              className={cn(
                'h-10 shrink-0 rounded-full border px-4 text-sm font-medium md:h-9 md:px-3',
                days === period.days ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              {tr(period.label)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {tr('Заказы с сайта считаются сами. Продажу в магазине отмечают одной кнопкой «Продано» у размера во вкладке «Товары».')}
      </p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Tile label={tr('Выручка')} value={formatPrice(summary.revenue_minor)} />
        <Tile label={tr('Продано вещей')} value={number(summary.pieces)} />
        <Tile label={tr('Продаж')} value={number(summary.sales)} note={tr('заказы на сайте и продажи в магазине')} />
        <Tile label={tr('Средний чек')} value={formatPrice(summary.average_minor)} />
        <Tile label={tr('Через сайт')} value={formatPrice(summary.site_revenue_minor)} note={tr('{n} шт.', { n: number(summary.site_pieces) })} />
        <Tile label={tr('В магазине')} value={formatPrice(summary.shop_revenue_minor)} note={tr('{n} шт.', { n: number(summary.shop_pieces) })} />
        <Tile
          label={tr('Заказы с сайта')}
          value={number(summary.delivery_orders + summary.pickup_orders)}
          note={tr('доставка: {delivery}, самовывоз: {pickup}', { delivery: summary.delivery_orders, pickup: summary.pickup_orders })}
        />
        <Tile label={tr('Возвраты')} value={number(summary.refunds)} note={summary.refunds ? formatPrice(summary.refunds_minor) : undefined} />
      </div>

      {summary.sales === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          {tr('За этот период продаж нет. Заказы с сайта появятся здесь после оплаты, а продажи в магазине — после нажатия «Продано» во вкладке «Товары».')}
        </p>
      ) : (
        <>
          {data.by_day.length > 1 && <Days report={data} />}

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-900">{tr('Что продаётся')}</h3>
            <ul className="mt-2 divide-y divide-gray-100">
              {data.products.map((product) => {
                const key = `${product.product_id}-${product.title}`;
                const expanded = open === key;
                return (
                  <li key={key} className="py-2">
                    <button onClick={() => setOpen(expanded ? null : key)} aria-expanded={expanded} className="flex w-full items-center gap-3 text-left">
                      <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-gray-100">
                        {product.image_url && <Image src={product.image_url} alt="" fill sizes="36px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{product.title}</span>
                      <span className="shrink-0 text-right text-sm">
                        <span className="block font-bold text-gray-900">{tr('{n} шт.', { n: number(product.pieces) })}</span>
                        <span className="block text-gray-600">{formatPrice(product.revenue_minor)}</span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')} />
                    </button>
                    {expanded && (
                      <ul className="mt-2 flex flex-wrap gap-1.5 pl-12">
                        {product.variants.map((variant, index) => (
                          <li key={index} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-800">
                            {[variant.size_label, variant.color_name].filter(Boolean).join(', ') || tr('Без размера')} —{' '}
                            <b>{variant.pieces}</b>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="grid gap-3 md:grid-cols-3">
            <Shares title={tr('По категориям')} rows={data.categories} />
            <Shares title={tr('По размерам')} rows={data.sizes} />
            <Shares title={tr('По цветам')} rows={data.colors} />
          </div>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{tr('Журнал продаж: {n}', { n: data.lines.length })}</h3>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <button onClick={download} className={secondaryButton}>
                  <Download className="h-4 w-4" />
                  {tr('Скачать Excel')}
                </button>
                <button onClick={downloadPdf} disabled={makingPdf} className={secondaryButton}>
                  <FileText className="h-4 w-4" />
                  {makingPdf ? tr('Готовим файл…') : tr('Скачать PDF')}
                </button>
              </div>
            </div>
            <FormError error={failure} />
            {/* Phones: one card per sale instead of a wide table. */}
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white md:hidden">
              {data.lines.slice(0, shown).map((line) => (
                <li key={line.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{line.title}</p>
                    <p className="text-xs text-gray-600">
                      {[line.size_label, line.color_name].filter(Boolean).join(', ')}
                      {line.quantity > 1 && ` · ${tr('{n} шт.', { n: line.quantity })}`}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      {moment(line.sold_at)} ·{' '}
                      {line.channel === 'site'
                        ? tr('Заказ №{number}', { number: line.order_number ?? '' })
                        : `${tr('Магазин')}${line.note ? ` · ${line.note}` : ''}`}
                      {line.channel === 'site' && line.status && (
                        <StatusBadge status={line.status} label={t(`orders.status.${line.status as 'paid'}`)} />
                      )}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-gray-900">
                    {formatPrice(line.total_minor)}
                  </p>
                  {line.channel === 'shop' && (
                    <button
                      onClick={() => remove(line.id)}
                      aria-label={tr('Убрать продажу')}
                      className="-my-1 -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className={head}>{tr('Когда')}</th>
                    <th className={head}>{tr('Товар')}</th>
                    <th className={head}>{tr('Размер, цвет')}</th>
                    <th className={`${head} text-right`}>{tr('Штук')}</th>
                    <th className={`${head} text-right`}>{tr('Сумма')}</th>
                    <th className={head}>{tr('Откуда')}</th>
                    <th className={head} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.lines.slice(0, shown).map((line) => (
                    <tr key={line.id}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">{moment(line.sold_at)}</td>
                      <td className="max-w-[14rem] truncate px-3 py-1.5 text-gray-900" title={line.title}>{line.title}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{[line.size_label, line.color_name].filter(Boolean).join(', ')}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{line.quantity}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-medium text-gray-900">{formatPrice(line.total_minor)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">
                        {line.channel === 'site' ? (
                          <span className="flex items-center gap-1.5">
                            {tr('Заказ №{number}', { number: line.order_number ?? '' })}
                            {line.status && <StatusBadge status={line.status} label={t(`orders.status.${line.status as 'paid'}`)} />}
                          </span>
                        ) : (
                          <span title={line.note ?? undefined}>{tr('Магазин')}{line.note ? ` · ${line.note}` : ''}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {line.channel === 'shop' && (
                          <button onClick={() => remove(line.id)} aria-label={tr('Убрать продажу')} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.lines.length > shown && (
              <button onClick={() => setShown(shown + 100)} className={secondaryButton}>
                {tr('Показать ещё')}
              </button>
            )}
          </section>
        </>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">{tr('Остатки')}</h3>
          <div className="flex overflow-hidden rounded-full border border-gray-300 text-sm font-medium">
            {(['all', 'low'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setStockFilter(value)}
                aria-pressed={stockFilter === value}
                className={cn('h-9 px-3.5', stockFilter === value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100')}
              >
                {tr(value === 'all' ? 'Все' : 'Заканчиваются')}
              </button>
            ))}
          </div>
        </div>
        {stock.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600">
            {tr(stockFilter === 'low' ? 'Ничего не заканчивается.' : 'Товаров пока нет.')}
          </p>
        ) : (
          <>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white md:hidden">
            {stock.map((row) => (
              <li key={row.variant_id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{row.title}</p>
                  <p className="text-xs text-gray-600">
                    {[row.size_label, row.color_name].filter(Boolean).join(', ') || '—'} · {formatPrice(row.price_minor)}
                    {row.sold > 0 && ` · ${tr('продано: {n}', { n: row.sold })}`}
                  </p>
                </div>
                <p
                  className={cn(
                    'whitespace-nowrap text-sm font-semibold',
                    row.availability === 'out_of_stock'
                      ? 'text-red-700'
                      : row.quantity !== null && row.quantity <= 2
                        ? 'text-amber-800'
                        : 'text-gray-900'
                  )}
                >
                  {row.quantity !== null ? tr('{n} шт.', { n: row.quantity }) : tr(stockShort[row.availability])}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className={head}>{tr('Товар')}</th>
                  <th className={head}>{tr('Размер, цвет')}</th>
                  <th className={`${head} text-right`}>{tr('Цена')}</th>
                  <th className={`${head} text-right`}>{tr('Осталось')}</th>
                  <th className={`${head} text-right`}>{tr('Продано за период')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stock.map((row) => (
                  <tr key={row.variant_id}>
                    <td className="max-w-[16rem] truncate px-3 py-1.5 text-gray-900" title={row.title}>{row.title}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{[row.size_label, row.color_name].filter(Boolean).join(', ') || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-700">{formatPrice(row.price_minor)}</td>
                    <td className={cn('whitespace-nowrap px-3 py-1.5 text-right font-medium', row.availability === 'out_of_stock' ? 'text-red-700' : row.quantity !== null && row.quantity <= 2 ? 'text-amber-800' : 'text-gray-900')}>
                      {row.quantity !== null ? tr('{n} шт.', { n: row.quantity }) : tr(stockShort[row.availability])}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{row.sold || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <p className="text-xs text-gray-500">
          {tr('Точное число показывается у размеров, для которых вы указали «Сколько штук» в карточке товара. У остальных видно только «есть» или «нет».')}
        </p>
      </section>
    </div>
  );
}
