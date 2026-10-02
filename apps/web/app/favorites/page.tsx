'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { ErrorState, ProductGridSkeleton } from '@/components/PageState';
import { ProductCard } from '@/components/ProductCard';
import { getProducts } from '@/lib/api';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

export default function FavoritesPage() {
  const { state } = useApp();
  const ids = state.favorites;

  // Favorites are stored on the device as ids; the current product data comes
  // from the API, so prices are up to date and removed products drop out.
  const { data, error, loading } = useApi(
    async (signal) => (ids.length ? getProducts({ ids, limit: 100 }, signal) : null),
    [ids.join(',')]
  );
  // Removing a favorite hides the card at once, without waiting for the reload.
  const products = (data?.items ?? []).filter((product) => ids.includes(product.id));
  const unavailable = data ? ids.length - data.items.length : 0;

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Избранное</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-3">
        {error ? (
          <ErrorState error={error} />
        ) : ids.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❤️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Избранное пусто</h2>
            <p className="text-gray-600">Добавляйте товары в избранное, чтобы не потерять их</p>
          </div>
        ) : loading && !data ? (
          <ProductGridSkeleton count={ids.length} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {unavailable > 0 && (
              <p className="text-sm text-gray-500">
                Часть сохранённых товаров больше недоступна в каталоге: {unavailable}.
              </p>
            )}
          </>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
