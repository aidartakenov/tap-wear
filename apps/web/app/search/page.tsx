'use client';

import { useState } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { VisualSearchModal } from '@/components/VisualSearchModal';
import { ProductCard } from '@/components/ProductCard';
import { mockProducts } from '@/lib/mockData';

export default function SearchPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof mockProducts>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    setIsSearching(true);
    // Simulate search delay
    setTimeout(() => {
      const results = mockProducts
        .map(p => ({
          ...p,
          similarityScore: Math.random() * 0.3 + 0.7,
        }))
        .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
        .slice(0, 6);
      setSearchResults(results);
      setIsSearching(false);
      setIsModalOpen(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Найти по фото</h1>
        </div>
      </header>

      <main className="px-4 py-4">
        {!isSearching && searchResults.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📷</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Поиск по фотографии
            </h2>
            <p className="text-gray-600 mb-6">
              Загрузите фото одежды, чтобы найти похожие товары
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Загрузить фото
            </button>
          </div>
        )}

        {isSearching && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Ищем похожие товары...</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Похожие товары
              </h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                Новый поиск
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
