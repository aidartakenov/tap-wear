'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Phone, Search } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading } from '@/components/PageState';
import { ProductCard } from '@/components/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { getProducts, getStore } from '@/lib/api';
import { catalogHref } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

// A store shows its whole range on its own page; 100 is the API's page limit.
const STORE_PAGE_SIZE = 100;

export default function StoreProfilePage() {
  const slug = String(useParams().id);
  const router = useRouter();
  const { t, count } = useApp();
  const [query, setQuery] = useState('');

  // One view per opened storefront, for the store's statistics.
  useEffect(() => {
    track('store_view', { store_slug: slug });
  }, [slug]);

  // Search starts inside this store; the catalog page offers to widen it to all stores.
  const searchInStore = (event: FormEvent) => {
    event.preventDefault();
    router.push(catalogHref({ store: slug, query }));
  };
  const { data, error, loading } = useApi(
    async (signal) => {
      const [store, products] = await Promise.all([
        getStore(slug, signal),
        getProducts({ filter: { store: slug }, limit: STORE_PAGE_SIZE }, signal),
      ]);
      return { store, products };
    },
    [slug]
  );

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-2">
          <Link href="/stores">
            <Button variant="ghost" size="icon" aria-label={t('store.back')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {data?.store.name ?? t('store.title')}
          </h1>
        </div>
      </header>

      {error ? (
        <ErrorState error={error} notFound={t('store.notFound')} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-4 space-y-4 md:grid md:grid-cols-[320px_1fr] md:gap-6 md:space-y-0 md:items-start">
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 md:sticky md:top-20">
            {data.store.description && (
              <p className="text-sm text-gray-700">{data.store.description}</p>
            )}

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>
                  {[
                    data.store.city.name,
                    data.store.address,
                    data.store.market,
                    data.store.sector,
                    data.store.container,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
              {data.store.working_hours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{data.store.working_hours}</span>
                </div>
              )}
              {data.store.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 shrink-0" />
                  <a href={`tel:${data.store.phone.replace(/[^\d+]/g, '')}`}>{data.store.phone}</a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {data.store.categories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>

            <ContactButton store={data.store} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">
                {t('store.count', { count: count(data.products.total, 'product') })}
              </h2>
              <Link
                href={catalogHref({ store: slug })}
                className="text-sm font-medium text-blue-600 hover:underline shrink-0"
              >
                {t('store.filters')}
              </Link>
            </div>
            <form onSubmit={searchInStore} role="search" className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('store.searchPlaceholder')}
                aria-label={t('store.searchLabel')}
                className="w-full h-10 rounded-full border border-gray-200 bg-white pl-9 pr-4 text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
            </form>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.products.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {data.store.is_demo && <DemoNotice />}
          </section>
        </main>
      )}

      <BottomNavigation />
    </div>
  );
}
