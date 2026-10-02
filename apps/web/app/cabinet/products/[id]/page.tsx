'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ProductEditor } from '@/components/cabinet/ProductEditor';
import { secondaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { getMyProduct, getReference } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useApp } from '@/lib/context';

function EditProduct({ id }: { id: string }) {
  const { tr } = useApp();
  const { data, error, loading } = useApi(
    async (signal) => {
      const [product, reference] = await Promise.all([getMyProduct(id, signal), getReference(signal)]);
      return { product, reference };
    },
    [id]
  );

  if (error) return <ErrorState error={error} notFound={tr('Товар не найден')} />;
  if (loading || !data) return <Loading />;
  return (
    <>
      <Link
        href={`/cabinet/stores/${data.product.store_id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        {tr('Все товары магазина')}
      </Link>
      {/* The key gives a copied product its own fresh editor. */}
      <ProductEditor
        key={data.product.id}
        storeId={data.product.store_id}
        product={data.product}
        reference={data.reference}
      />
    </>
  );
}

export default function EditProductPage() {
  const { tr } = useApp();
  const id = String(useParams().id);
  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <Link href="/cabinet" aria-label={tr('Назад в кабинет')} className={`${secondaryButton} !px-2.5`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{tr('Товар')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <RequireAccount>{() => <EditProduct id={id} />}</RequireAccount>
      </main>
      <BottomNavigation />
    </div>
  );
}
