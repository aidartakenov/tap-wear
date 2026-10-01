'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { FilterBar } from '@/components/FilterBar';
import { ProductCard } from '@/components/ProductCard';
import { mockProducts } from '@/lib/mockData';
import { useApp } from '@/lib/context';

export default function CatalogPage() {
  const { state } = useApp();

  const filteredProducts = mockProducts.filter((product) => {
    if (state.filter.category !== 'Все' && product.category !== state.filter.category) {
      return false;
    }
    if (state.filter.color !== 'Все' && product.color !== state.filter.color) {
      return false;
    }
    if (product.price < state.filter.minPrice || product.price > state.filter.maxPrice) {
      return false;
    }
    if (state.filter.size && !product.sizes.some(s => s.value === state.filter.size)) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Каталог</h1>
        </div>
        <FilterBar />
      </header>

      <main className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Ничего не найдено</p>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
