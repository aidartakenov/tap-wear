'use client';

import { useState } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { VisualSearchModal } from '@/components/VisualSearchModal';
import { ProductCard } from '@/components/ProductCard';
import { FormError } from '@/components/form';
import { getVisualSearchStatus, visualSearch } from '@/lib/api';
import { useApp } from '@/lib/context';
import { ALL } from '@/lib/catalog';
import { FilterState, Product } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function SearchPage() {
  const { t, catalog } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { data: status } = useApi((signal) => getVisualSearchStatus(signal), []);

  // The last picture is kept, so changing a filter searches again without a new upload.
  const [picture, setPicture] = useState<Blob | null>(null);
  const [filter, setFilter] = useState<Partial<FilterState>>({});

  const run = async (image: Blob, chosen: Partial<FilterState>) => {
    setIsSearching(true);
    setError(null);
    try {
      setSearchResults((await visualSearch(image, chosen)).items);
    } catch (cause) {
      setError(cause);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (image: Blob) => {
    setIsModalOpen(false);
    setPicture(image);
    run(image, filter);
  };

  const change = (part: Partial<FilterState>) => {
    const next = { ...filter, ...part };
    setFilter(next);
    if (picture) run(picture, next);
  };

  const select =
    'h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-600';

  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.photoSearch')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {status?.placeholder && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {t('photo.placeholder')}
          </p>
        )}
        <FormError error={error} />
        {!isSearching && searchResults === null && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📷</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t('photo.heading')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('photo.hint')}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {t('photo.upload')}
            </button>
          </div>
        )}

        {isSearching && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('photo.searching')}</p>
          </div>
        )}

        {picture && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={filter.audience ?? ALL}
              onChange={(event) => change({ audience: event.target.value })}
              aria-label={t('filter.audience')}
              className={select}
            >
              <option value={ALL}>{t('audience.all')}</option>
              {(catalog?.audiences ?? []).map(({ code }) => (
                <option key={code} value={code}>
                  {t(`audience.${code}`)}
                </option>
              ))}
            </select>
            <select
              value={filter.category ?? ALL}
              onChange={(event) => change({ category: event.target.value })}
              aria-label={t('filter.category')}
              className={select}
            >
              <option value={ALL}>{t('filter.allCategories')}</option>
              {(catalog?.categories ?? []).map((category) => (
                <option key={category.code} value={category.code}>
                  {category.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filter.inStock ?? false}
                onChange={(event) => change({ inStock: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t('filter.inStockOnly')}
            </label>
          </div>
        )}

        {!isSearching && searchResults !== null && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('photo.results')}
              </h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                {t('photo.newSearch')}
              </button>
            </div>
            {searchResults.length === 0 && (
              <p className="py-12 text-center text-gray-600">{t('photo.nothing')}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {searchResults.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </main>

      <VisualSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSearch={handleSearch}
      />

      <BottomNavigation />
    </div>
  );
}
