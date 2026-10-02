'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading } from '@/components/PageState';
import { StoreCard } from '@/components/StoreCard';
import { getStores } from '@/lib/api';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

export default function StoresPage() {
  const { data, error, loading } = useApi((signal) => getStores(signal), []);
  const stores = data?.items ?? [];
  const { t } = useApp();

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.stores')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-3">
        {error ? (
          <ErrorState error={error} />
        ) : loading ? (
          <Loading />
        ) : stores.length === 0 ? (
          <p className="py-16 text-center text-gray-500">{t('stores.empty')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}
        {stores.some((store) => store.is_demo) && <DemoNotice />}
      </main>

      <BottomNavigation />
    </div>
  );
}
