'use client';

import { useState } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { VisualSearchModal } from '@/components/VisualSearchModal';
import { ProductCard } from '@/components/ProductCard';
import { getProducts } from '@/lib/api';
import { useApp } from '@/lib/context';
import { Product } from '@/lib/types';

export default function SearchPage() {
  const { t } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    setIsSearching(true);
    // Placeholder until the visual search API exists: a random sample of the catalog.
    getProducts({ limit: 60 })
      .then((page) => [...page.items].sort(() => Math.random() - 0.5).slice(0, 6))
      .catch(() => [])
      .then((results) => {
        setSearchResults(results);
        setIsSearching(false);
        setIsModalOpen(false);
      });
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.photoSearch')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {!isSearching && searchResults.length === 0 && (
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

        {searchResults.length > 0 && (
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
