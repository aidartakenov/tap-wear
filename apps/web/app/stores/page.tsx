'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { StoreCard } from '@/components/StoreCard';
import { isDemoCatalog, stores } from '@/lib/catalog';

export default function StoresPage() {
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Магазины</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
        {isDemoCatalog && <DemoNotice />}
      </main>

      <BottomNavigation />
    </div>
  );
}
