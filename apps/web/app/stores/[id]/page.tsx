'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Phone } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import { ProductCard } from '@/components/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  catalogHref,
  getStore,
  getStoreProducts,
  isDemoCatalog,
  plural,
  productForms,
} from '@/lib/catalog';

export default function StoreProfilePage() {
  const params = useParams();
  const store = getStore(String(params.id));

  if (!store) {
    return (
      <div className="min-h-screen pb-20 bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Магазин не найден</p>
        <BottomNavigation />
      </div>
    );
  }

  const storeProducts = getStoreProducts(store.id);
  const categories = Array.from(new Set(storeProducts.map((p) => p.categoryLabel)));

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-2">
          <Link href="/stores">
            <Button variant="ghost" size="icon" aria-label="Назад к магазинам">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 truncate">{store.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-4 md:grid md:grid-cols-[320px_1fr] md:gap-6 md:space-y-0 md:items-start">
        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 md:sticky md:top-20">
          <p className="text-sm text-gray-700">{store.description}</p>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>
                {store.city}, {store.address}
              </span>
            </div>
            {store.workingHours && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{store.workingHours}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 shrink-0" />
              <a href={`tel:${store.phone.replace(/[^\d+]/g, '')}`}>{store.phone}</a>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {categories.map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>

          <ContactButton store={store} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">
              {plural(storeProducts.length, productForms)} в магазине
            </h2>
            <div className="flex gap-3 text-sm font-medium shrink-0">
              <Link href={catalogHref({ storeId: store.id })} className="text-blue-600 hover:underline">
                Фильтры
              </Link>
              <Link href="/catalog" className="text-blue-600 hover:underline">
                Все магазины
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {storeProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {isDemoCatalog && <DemoNotice />}
        </section>
      </main>

      <BottomNavigation />
    </div>
  );
}
