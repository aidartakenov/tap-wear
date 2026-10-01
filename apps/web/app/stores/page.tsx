'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { StoreCard } from '@/components/StoreCard';
import { mockStores } from '@/lib/mockData';

export default function StoresPage() {
  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Магазины</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3">
        {mockStores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </main>

      <BottomNavigation />
    </div>
  );
}
