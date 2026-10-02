'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DatabaseMonitor } from '@/components/admin/DatabaseMonitor';
import { Overview } from '@/components/admin/Overview';
import { Users } from '@/components/admin/Users';
import { BottomNavigation } from '@/components/BottomNavigation';
import {
  FormError,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { decide, getReports, getReviewQueue, resolveReport } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { Decision } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { useApp } from '@/lib/context';

// Approve, or reject / block with a reason. Calls onDone once the decision is saved.
function DecisionBar({
  target,
  id,
  onDone,
}: {
  target: 'stores' | 'products';
  id: string;
  onDone: () => void;
}) {
  const { tr } = useApp();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const send = async (decision: Decision) => {
    if (decision !== 'approve' && !reason.trim()) {
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await decide(target, id, decision, reason.trim() || undefined);
      onDone();
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

  const needsReason = !reason.trim();
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <input
        className={inputClass}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={tr('Причина (обязательна для отказа и блокировки)')}
        maxLength={1000}
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={() => send('approve')} disabled={busy} className={primaryButton}>
          {tr('Одобрить')}
        </button>
        <button onClick={() => send('reject')} disabled={busy || needsReason} className={secondaryButton}>
          {tr('Вернуть на доработку')}
        </button>
        <button onClick={() => send('block')} disabled={busy || needsReason} className={dangerButton}>
          {tr('Заблокировать')}
        </button>
      </div>
      <FormError error={error} />
    </div>
  );
}

function Moderation() {
  const { tr, t } = useApp();
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useApi(
    async (signal) => {
      const [queue, reports] = await Promise.all([getReviewQueue(signal), getReports(signal)]);
      return { queue, reports };
    },
    [refresh]
  );
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const reload = () => setRefresh((value) => value + 1);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const { queue, reports } = data;

  return (
    <div className={`space-y-8 ${loading ? 'opacity-60' : ''}`}>
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">
          {tr('Магазины на проверке: {n}', { n: queue.stores.length })}
        </h2>
        {queue.stores.map((store) => (
          <article key={store.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-900">{store.name}</h3>
            {store.description && <p className="text-sm text-gray-700">{store.description}</p>}
            <p className="text-sm text-gray-600">
              {[store.address, store.phone, store.instagram && `@${store.instagram}`, store.website]
                .filter(Boolean)
                .join(' · ') || tr('Контакты не указаны')}
            </p>
            <DecisionBar target="stores" id={store.id} onDone={reload} />
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">
          {tr('Товары на проверке: {n}', { n: queue.products.length })}
        </h2>
        {queue.products.map((product) => (
          <article key={product.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <div>
              <h3 className="font-semibold text-gray-900">{product.title}</h3>
              <p className="text-sm text-gray-600">
                {product.store_name} · {product.category} · {t(`audience.${product.audience}`)} ·{' '}
                {formatPrice(product.base_price_minor)} ·{' '}
                {tr('вариантов: {n}', { n: product.variant_count })}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((image) => (
                <div key={image} className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image src={image} alt="" fill sizes="128px" className="object-cover" />
                </div>
              ))}
            </div>
            {product.description && (
              <p className="text-sm text-gray-700 whitespace-pre-line">{product.description}</p>
            )}
            <DecisionBar target="products" id={product.id} onDone={reload} />
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">
          {tr('Жалобы покупателей: {n}', { n: reports.length })}
        </h2>
        {reports.map((report) => (
          <article key={report.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-semibold text-gray-900">{t(`reportReason.${report.reason}`)}</p>
            <p className="text-sm text-gray-600">
              <a href={`/products/${report.product_id}`} className="text-blue-600 hover:underline">
                {report.product_title}
              </a>{' '}
              · {report.store_name}
            </p>
            {report.comment && <p className="text-sm text-gray-700">«{report.comment}»</p>}
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={resolutions[report.id] ?? ''}
                onChange={(event) => setResolutions({ ...resolutions, [report.id]: event.target.value })}
                placeholder={tr('Что сделано')}
                maxLength={1000}
              />
              <button
                onClick={async () => {
                  await resolveReport(report.id, resolutions[report.id]);
                  reload();
                }}
                disabled={!resolutions[report.id]?.trim()}
                className={`${primaryButton} shrink-0`}
              >
                {tr('Закрыть')}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

type Section = 'overview' | 'moderation' | 'users' | 'database';

export default function AdminPage() {
  const { tr } = useApp();
  const [section, setSection] = useState<Section>('overview');

  const tab = (value: Section, label: string) => (
    <button
      onClick={() => setSection(value)}
      aria-current={section === value}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        section === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <h1 className="text-xl font-bold text-gray-900">{tr('Администрирование')}</h1>
          <div className="mt-2 flex gap-5 overflow-x-auto whitespace-nowrap">
            {tab('overview', tr('Обзор'))}
            {tab('moderation', tr('Модерация'))}
            {tab('users', tr('Пользователи'))}
            {tab('database', tr('База данных'))}
          </div>
        </div>
      </header>
      {/* Moderation reads best in a narrow column; database tables need the width. */}
      <main
        className={`mx-auto px-4 py-4 ${
          section === 'moderation' || section === 'users' ? 'max-w-3xl' : 'max-w-6xl'
        }`}
      >
        <RequireAccount admin>
          {() =>
            section === 'overview' ? (
              <Overview />
            ) : section === 'users' ? (
              <Users />
            ) : section === 'database' ? (
              <DatabaseMonitor />
            ) : (
              <Moderation />
            )
          }
        </RequireAccount>
      </main>
      <BottomNavigation />
    </div>
  );
}
