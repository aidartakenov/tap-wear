'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { ProductCard } from '@/components/ProductCard';
import { products } from '@/lib/catalog';
import { useApp } from '@/lib/context';

export default function FavoritesPage() {
  const { state } = useApp();
  const favoriteProducts = products.filter((product) =>
    state.favorites.includes(product.id)
  );

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Избранное</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {favoriteProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {favoriteProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❤️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Избранное пусто
            </h2>
            <p className="text-gray-600">
              Добавляйте товары в избранное, чтобы не потерять их
            </p>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
