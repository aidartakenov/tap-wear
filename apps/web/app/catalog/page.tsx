'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { FilterBar } from '@/components/FilterBar';
import { ErrorState, ProductGridSkeleton } from '@/components/PageState';
import { ProductCard } from '@/components/ProductCard';
import { ApiError, getProducts } from '@/lib/api';
import { ALL, filterToQuery } from '@/lib/catalog';
import { Translate } from '@/lib/i18n';
import { useApp } from '@/lib/context';
import { Audience, CatalogFilters, FilterState, Product } from '@/lib/types';
import { useCatalogFilter } from '@/lib/useCatalogFilter';

interface Chip {
  label: string;
  clear: Partial<FilterState>;
}

// Removable chips for what is currently applied; each one clears a single filter.
function appliedChips(
  filter: FilterState,
  catalog: CatalogFilters | null,
  t: Translate
): Chip[] {
  const chips: Chip[] = [];
  const name = <T extends { name: string }>(items: T[] | undefined, match: (item: T) => boolean) =>
    items?.find(match)?.name;

  if (filter.query) chips.push({ label: `«${filter.query}»`, clear: { query: '' } });
  if (filter.audience !== ALL) {
    const known = catalog?.audiences.some((audience) => audience.code === filter.audience);
    const label = known ? t(`audience.${filter.audience as Audience}`) : filter.audience;
    chips.push({ label, clear: { audience: ALL } });
  }
  if (filter.category !== ALL) {
    const label = name(catalog?.categories, (c) => c.code === filter.category);
    chips.push({ label: label ?? filter.category, clear: { category: ALL } });
  }
  if (filter.store !== ALL) {
    const label = name(catalog?.stores, (s) => s.slug === filter.store);
    chips.push({ label: label ?? filter.store, clear: { store: ALL } });
  }
  if (filter.color !== ALL) {
    const label = name(catalog?.colors, (c) => c.code === filter.color);
    chips.push({ label: label ?? filter.color, clear: { color: ALL } });
  }
  if (filter.size) chips.push({ label: t('catalog.chipSize', { size: filter.size }), clear: { size: '' } });
  if (filter.minPrice > 0 || filter.maxPrice != null) {
    const from = filter.minPrice.toLocaleString('ru-RU');
    const label =
      filter.maxPrice == null
        ? t('catalog.chipPriceFrom', { min: from })
        : t('catalog.chipPriceRange', {
            min: from,
            max: filter.maxPrice.toLocaleString('ru-RU'),
          });
    chips.push({ label, clear: { minPrice: 0, maxPrice: null } });
  }
  if (filter.height != null) {
    chips.push({ label: t('catalog.chipHeight', { height: filter.height }), clear: { height: null } });
  }
  if (filter.inStock) chips.push({ label: t('catalog.chipInStock'), clear: { inStock: false } });
  return chips;
}

function pageTitle(filter: FilterState, chips: Chip[], t: Translate): string {
  if (filter.query) return t('catalog.search', { query: filter.query });
  const category = filter.category !== ALL ? chips.find((c) => 'category' in c.clear) : undefined;
  const audience = filter.audience !== ALL ? chips.find((c) => 'audience' in c.clear) : undefined;
  if (category && audience) return `${category.label} · ${audience.label.toLowerCase()}`;
  return category?.label ?? audience?.label ?? t('catalog.title');
}

function Catalog() {
  const { filter, setFilter } = useCatalogFilter();
  const { catalog, t, count } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Reload from the first page whenever the filters in the URL change. A request
  // still in flight for the previous filters is aborted, so it cannot overwrite
  // the newer result.
  const filterKey = filterToQuery(filter);
  const currentKey = useRef(filterKey);
  currentKey.current = filterKey;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getProducts({ filter }, controller.signal)
      .then((page) => {
        setProducts(page.items);
        setTotal(page.total);
        setNextCursor(page.next_cursor);
        setLoading(false);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof ApiError ? cause : new ApiError(0, 'error', 'Ошибка'));
        setLoading(false);
      });
    return () => controller.abort();
    // filterKey is the serialised filter; the object itself changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const requestedFor = filterKey;
      const page = await getProducts({ filter, cursor: nextCursor });
      // Ignore the page if the filters changed while it was loading.
      if (requestedFor === currentKey.current) {
        setProducts((current) => [...current, ...page.items]);
        setNextCursor(page.next_cursor);
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(0, 'error', 'Ошибка'));
    } finally {
      setLoadingMore(false);
    }
  };

  const chips = appliedChips(filter, catalog, t);

  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 truncate">{pageTitle(filter, chips, t)}</h1>
          {total !== null && !error && (
            <p className="text-sm text-gray-500 shrink-0">{count(total, 'product')}</p>
          )}
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
                <X className="w-3.5 h-3.5" aria-label={t('catalog.removeFilter')} />
              </button>
            ))}
          </div>
        )}

        {filter.store !== ALL && (
          <p className="text-sm text-gray-600">
            {t('catalog.oneStore')}{' '}
            <button
              onClick={() => setFilter({ store: ALL })}
              className="font-medium text-blue-600 hover:underline"
            >
              {t('catalog.searchAll')}
            </button>
          </p>
        )}

        {error ? (
          <ErrorState error={error} />
        ) : loading && products.length === 0 ? (
          <ProductGridSkeleton />
        ) : (
          <>
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 ${
                loading ? 'opacity-50' : ''
              }`}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {products.length === 0 && (
              <div className="text-center py-16">
                <p className="font-medium text-gray-900">{t('catalog.nothing')}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t(chips.length > 0 ? 'catalog.removeOne' : 'catalog.empty')}
                </p>
              </div>
            )}

            {nextCursor && (
              <div className="pt-2 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                >
                  {loadingMore
                    ? t('state.loading')
                    : t('catalog.more', { shown: products.length, total: total ?? 0 })}
                </button>
              </div>
            )}
          </>
        )}

        {products.some((product) => product.store.is_demo) && <DemoNotice />}
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
