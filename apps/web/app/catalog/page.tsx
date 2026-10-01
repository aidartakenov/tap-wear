'use client';

import { Suspense } from 'react';
import { X } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { FilterBar } from '@/components/FilterBar';
import { ProductCard } from '@/components/ProductCard';
import {
  ALL,
  audienceLabels,
  categoryOptions,
  defaultFilter,
  getStore,
  isDemoCatalog,
  matchesFilter,
  plural,
  productForms,
  products,
  sortProducts,
} from '@/lib/catalog';
import { Audience, FilterState } from '@/lib/types';
import { useCatalogFilter } from '@/lib/useCatalogFilter';

function pageTitle(filter: FilterState): string {
  const category = categoryOptions.find((option) => option.value === filter.category)?.label;
  const audience =
    filter.audience !== ALL ? audienceLabels[filter.audience as Audience] : undefined;
  if (filter.query) return `Поиск: ${filter.query}`;
  if (category && audience) return `${category} · ${audience.toLowerCase()}`;
  return category ?? audience ?? 'Каталог';
}

function Catalog() {
  const { filter, setFilter } = useCatalogFilter();
  const filteredProducts = sortProducts(
    products.filter((product) => matchesFilter(product, filter)),
    filter.sort
  );

  // Removable chips for what is currently applied; each one clears a single filter.
  const chips: { label: string; clear: Partial<FilterState> }[] = [];
  if (filter.query) chips.push({ label: `«${filter.query}»`, clear: { query: '' } });
  if (filter.audience !== ALL) {
    chips.push({ label: audienceLabels[filter.audience as Audience], clear: { audience: ALL } });
  }
  if (filter.category !== ALL) {
    const label = categoryOptions.find((option) => option.value === filter.category)?.label;
    chips.push({ label: label ?? filter.category, clear: { category: ALL } });
  }
  if (filter.storeId !== ALL) {
    chips.push({ label: getStore(filter.storeId)?.name ?? filter.storeId, clear: { storeId: ALL } });
  }
  if (filter.size) chips.push({ label: `Размер ${filter.size}`, clear: { size: '' } });
  if (filter.minPrice > 0 || filter.maxPrice < defaultFilter.maxPrice) {
    chips.push({
      label: `${filter.minPrice.toLocaleString('ru-RU')}–${filter.maxPrice.toLocaleString('ru-RU')} сом`,
      clear: { minPrice: 0, maxPrice: defaultFilter.maxPrice },
    });
  }

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 truncate">{pageTitle(filter)}</h1>
          <p className="text-sm text-gray-500 shrink-0">
            {plural(filteredProducts.length, productForms)}
          </p>
        </div>
        <FilterBar />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-3">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => setFilter(chip.clear)}
                className="flex items-center gap-1 rounded-full bg-gray-900 pl-3 pr-2 py-1 text-xs font-medium text-white hover:bg-gray-700"
              >
                {chip.label}
                <X className="w-3.5 h-3.5" aria-label="Убрать фильтр" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="font-medium text-gray-900">Ничего не найдено</p>
            <p className="mt-1 text-sm text-gray-500">
              Уберите один из фильтров выше, чтобы увидеть больше товаров.
            </p>
          </div>
        )}

        {isDemoCatalog && <DemoNotice />}
      </main>

      <BottomNavigation />
    </div>
  );
}

export default function CatalogPage() {
  // useSearchParams needs a Suspense boundary for the production build.
  return (
    <Suspense>
      <Catalog />
    </Suspense>
  );
}
