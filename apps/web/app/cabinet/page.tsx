'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { StoreForm } from '@/components/cabinet/StoreForm';
import { StatusBadge, secondaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { VerifyEmailNotice } from '@/components/VerifyEmailNotice';
import { createStore, getMyStores, getReference } from '@/lib/api';
import { StoreAvatar } from '@/components/StoreAvatar';
import { storeStatusLabels } from '@/lib/catalog';
import { useApi } from '@/lib/useApi';
import { useApp } from '@/lib/context';

function Cabinet() {
  const { tr } = useApp();
  const router = useRouter();
  const { data, error, loading } = useApi(
    async (signal) => {
      const [stores, reference] = await Promise.all([getMyStores(signal), getReference(signal)]);
      return { stores, reference };
    },
    []
  );
  const [creating, setCreating] = useState(false);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading />;
  const { stores, reference } = data;
  const showForm = creating || stores.length === 0;

  return (
    <div className="space-y-4">
      <VerifyEmailNotice />
      {stores.map((store) => (
        <Link
          key={store.id}
          href={`/cabinet/stores/${store.id}`}
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
        >
          <StoreAvatar name={store.name} url={store.avatar_url} className="h-12 w-12 text-base" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{store.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <StatusBadge status={store.status} label={tr(storeStatusLabels[store.status])} />
              <span>{store.role === 'owner' ? tr('Вы владелец') : tr('Вы сотрудник')}</span>
            </div>
            {store.review_note && (
              <p className="mt-2 text-sm text-red-700">
                {tr('Замечание проверки: {note}', { note: store.review_note })}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        </Link>
      ))}

      {showForm ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900">
            {stores.length === 0 ? tr('Создайте свой магазин') : tr('Новый магазин')}
          </h2>
          <p className="mt-1 mb-4 text-sm text-gray-600">
            {tr('После создания магазин проверит администратор. Товары можно добавлять сразу, они появятся в каталоге, когда магазин и товары будут одобрены.')}
          </p>
          <StoreForm
            cities={reference.cities}
            submitLabel={tr('Создать магазин')}
            onSubmit={async (store) => {
              const created = await createStore(store);
              router.push(`/cabinet/stores/${created.id}`);
            }}
          />
        </section>
      ) : (
        <button onClick={() => setCreating(true)} className={secondaryButton}>
          <Plus className="w-4 h-4" />
          {tr('Добавить ещё один магазин')}
        </button>
      )}
    </div>
  );
}

export default function CabinetPage() {
  const { tr } = useApp();
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{tr('Кабинет магазина')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <RequireAccount>{() => <Cabinet />}</RequireAccount>
      </main>
      <BottomNavigation />
    </div>
  );
}
