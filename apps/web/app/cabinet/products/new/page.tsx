'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ProductEditor } from '@/components/cabinet/ProductEditor';
import { secondaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { getReference } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useApp } from '@/lib/context';

function NewProduct() {
  const { tr } = useApp();
  const storeId = useSearchParams().get('store') ?? '';
  const { data: reference, error, loading } = useApi((signal) => getReference(signal), []);

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <Link
            href={storeId ? `/cabinet/stores/${storeId}` : '/cabinet'}
            aria-label={tr('Назад к магазину')}
            className={`${secondaryButton} !px-2.5`}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{tr('Новый товар')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <RequireAccount>
          {() =>
            error ? (
              <ErrorState error={error} />
            ) : loading || !reference ? (
              <Loading />
            ) : (
              <ProductEditor storeId={storeId} product={null} reference={reference} />
            )
          }
        </RequireAccount>
      </main>
      <BottomNavigation />
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense>
      <NewProduct />
    </Suspense>
  );
}
