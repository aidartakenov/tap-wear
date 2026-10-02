'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { FormError, primaryButton } from '@/components/form';
import { ErrorState, ProductGridSkeleton } from '@/components/PageState';
import { ProductCard } from '@/components/ProductCard';
import { getProducts } from '@/lib/api';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

export default function FavoritesPage() {
  const { me, favorites: ids, deviceOnlyFavorites, moveDeviceFavoritesToAccount, t, count } =
    useApp();
  const [moveError, setMoveError] = useState<unknown>(null);
  const [declined, setDeclined] = useState(false);

  // Favorites are stored as ids (in the account, or on the device for a guest); the current product data comes
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
          <h1 className="text-xl font-bold text-gray-900">{t('nav.favorites')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-3">
        {me && deviceOnlyFavorites.length > 0 && !declined && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p>
              {t('favorites.deviceSaved', { count: count(deviceOnlyFavorites.length, 'product') })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => moveDeviceFavoritesToAccount().catch(setMoveError)}
                className={primaryButton}
              >
                {t('favorites.addToAccount')}
              </button>
              <button onClick={() => setDeclined(true)} className="px-3 text-sm text-blue-900">
                {t('favorites.notNow')}
              </button>
            </div>
            <FormError error={moveError} />
          </div>
        )}
        {me === null && ids.length > 0 && (
          <p className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
            {t('favorites.deviceOnly')}{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              {t('favorites.signIn')}
            </Link>
            {t('favorites.signInWhy')}
          </p>
        )}
        {error ? (
          <ErrorState error={error} />
        ) : ids.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❤️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('favorites.empty')}</h2>
            <p className="text-gray-600">{t('favorites.emptyHint')}</p>
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
                {t('favorites.unavailable', { n: unavailable })}
              </p>
            )}
          </>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
