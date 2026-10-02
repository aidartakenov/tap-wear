'use client';

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, Info, MapPin, MessageCircle, Phone, Search, X } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading, ProductGridSkeleton } from '@/components/PageState';
import { ProductCard } from '@/components/ProductCard';
import { StoreAvatar } from '@/components/StoreAvatar';
import { StoreConditions } from '@/components/StoreConditions';
import { track } from '@/lib/analytics';
import { ApiError, getCatalogFilters, getProducts, getStore } from '@/lib/api';
import { ALL } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import {
  Audience,
  CatalogFilters,
  Product,
  STORE_AUDIENCES,
  SortOrder,
  Store,
} from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { cn } from '@/lib/utils';

const SORTS: SortOrder[] = ['default', 'price_asc', 'price_desc'];
// Sections of the storefront, in the order they are offered.
const SECTION_ORDER: Audience[] = ['men', 'women', 'kids', 'unisex'];

// What the buyer is looking at inside the store. It lives in the URL, so a
// section of a store can be shared and survives going back from a product.
interface View {
  audience: string;
  category: string;
  query: string;
  sort: SortOrder;
}

function useStoreView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sort = params.get('sort') as SortOrder;
  const view: View = {
    audience: params.get('audience') ?? ALL,
    category: params.get('category') ?? ALL,
    query: params.get('q') ?? '',
    sort: SORTS.includes(sort) ? sort : 'default',
  };
  const setView = (change: Partial<View>) => {
    const next = { ...view, ...change };
    const query = new URLSearchParams();
    if (next.audience !== ALL) query.set('audience', next.audience);
    if (next.category !== ALL) query.set('category', next.category);
    if (next.query.trim()) query.set('q', next.query.trim());
    if (next.sort !== 'default') query.set('sort', next.sort);
    const suffix = query.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  };
  return { view, setView };
}

function Cover({ store }: { store: Store }) {
  const { t, count } = useApp();
  const place = [store.city.name, store.address, store.market, store.sector, store.container]
    .filter(Boolean)
    .join(', ');
  const types = STORE_AUDIENCES.filter((audience) => store.audiences.includes(audience)).map(
    (audience) => t(`storeAudience.${audience}`)
  );

  return (
    <section className="relative overflow-hidden bg-gray-900 text-white">
      {/* The store's own photos, dimmed, as the backdrop of its cover. */}
      <div className="absolute inset-0 grid grid-cols-3 opacity-25" aria-hidden>
        {store.preview_images.map((image) => (
          <div key={image} className="relative">
            <Image src={image} alt="" fill sizes="33vw" className="object-cover object-top" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-gray-900/50" />

      <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-3 md:pb-10">
        <Link
          href="/stores"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-md hover:bg-white/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('store.back')}
        </Link>

        <div className="mt-6 flex items-end gap-4 md:mt-12 md:gap-6">
          <StoreAvatar
            name={store.name}
            url={store.avatar_url}
            className="h-20 w-20 text-2xl ring-4 ring-white/90 md:h-28 md:w-28 md:text-4xl"
          />
          <div className="min-w-0 flex-1">
            {types.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                {types.join(' · ')}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight md:text-5xl">
              {store.name}
            </h1>
            <p className="mt-1 text-sm text-gray-300">{count(store.product_count, 'product')}</p>
          </div>
        </div>

        {store.description && (
          <p className="mt-4 max-w-2xl text-sm text-gray-200 line-clamp-3 md:text-base">
            {store.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-300">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" />
            {place}
          </span>
          {store.working_hours && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" />
              {store.working_hours}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(t('message.generic'))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('contact_click', { store_slug: store.slug, channel: 'whatsapp' })}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              {t('contact.whatsapp')}
            </a>
          )}
          {store.phone && (
            <a
              href={`tel:${store.phone.replace(/[^\d+]/g, '')}`}
              onClick={() => track('contact_click', { store_slug: store.slug, channel: 'phone' })}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              <Phone className="h-4 w-4" />
              {t('store.call')}
            </a>
          )}
          <a
            href="#about"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold hover:bg-white/10"
          >
            <Info className="h-4 w-4" />
            {t('store.about')}
          </a>
        </div>
      </div>
    </section>
  );
}

function Storefront({ store, range }: { store: Store; range: CatalogFilters }) {
  const { t, count } = useApp();
  const { view, setView } = useStoreView();
  const [text, setText] = useState(view.query);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const filter = {
    store: store.slug,
    audience: view.audience,
    category: view.category,
    query: view.query,
    sort: view.sort,
  };
  // Reload from the first page whenever the view changes; a request still in
  // flight for the previous view is aborted.
  const viewKey = JSON.stringify(filter);
  const currentKey = useRef(viewKey);
  currentKey.current = viewKey;
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
    // viewKey is the serialised view; the object itself changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const requestedFor = viewKey;
      const page = await getProducts({ filter, cursor: nextCursor });
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

  const search = (event: FormEvent) => {
    event.preventDefault();
    setView({ query: text });
  };

  const sections = SECTION_ORDER.filter((code) =>
    range.audiences.some((audience) => audience.code === code)
  );
  // Only the categories this store has, with the chosen section's counts.
  const categories = range.categories.flatMap((category) => {
    if (view.audience === ALL) return [category];
    const own = category.by_audience.find((entry) => entry.audience === view.audience);
    return own ? [{ ...category, count: own.count }] : [];
  });
  const chosenCategory = range.categories.find((category) => category.code === view.category);
  const narrowed = view.audience !== ALL || view.category !== ALL || view.query !== '';

  const sectionTab = (code: string, label: string) => (
    <button
      key={code}
      // A category that the new section does not have would show nothing, so it is dropped.
      onClick={() => setView({ audience: code, category: ALL })}
      aria-current={view.audience === code}
      className={cn(
        'shrink-0 border-b-2 px-1 py-3 text-sm font-semibold transition-colors',
        view.audience === code
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-900'
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* The store's own menu: its sections and a search inside the store. */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4">
          <StoreAvatar name={store.name} url={store.avatar_url} className="hidden h-8 w-8 text-xs md:flex" />
          <nav
            aria-label={t('store.sections')}
            className="flex flex-1 gap-5 overflow-x-auto [scrollbar-width:none]"
          >
            {sectionTab(ALL, t('store.all'))}
            {sections.length > 1 &&
              sections.map((code) => sectionTab(code, t(`audience.${code}`)))}
          </nav>
          <form onSubmit={search} role="search" className="relative hidden w-64 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('store.searchPlaceholder')}
              aria-label={t('store.searchLabel')}
              className="h-9 w-full rounded-full bg-gray-100 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
            />
          </form>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <form onSubmit={search} role="search" className="relative md:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('store.searchPlaceholder')}
            aria-label={t('store.searchLabel')}
            className="h-11 w-full rounded-full border border-gray-200 bg-white pl-9 pr-4 text-base outline-none focus:ring-2 focus:ring-blue-600"
          />
        </form>

        {categories.length > 1 && (
          <section aria-label={t('store.categories')}>
            <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
              {categories.map((category) => {
                const active = view.category === category.code;
                return (
                  <button
                    key={category.code}
                    onClick={() => setView({ category: active ? ALL : category.code })}
                    aria-pressed={active}
                    className="group w-20 shrink-0 text-center md:w-24"
                  >
                    <div
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-2xl border transition-colors',
                        active
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-800 group-hover:border-gray-900'
                      )}
                    >
                      <CategoryIcon code={category.code} className="h-11 w-11 md:h-12 md:w-12" />
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-xs leading-tight md:text-sm',
                        active ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                      )}
                    >
                      {category.name}
                    </p>
                    <p className="text-xs text-gray-500">{category.count}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold text-gray-900 md:text-xl">
                {view.query
                  ? `«${view.query}»`
                  : (chosenCategory?.name ?? t('store.allProducts'))}
              </h2>
              {total !== null && !error && (
                <span className="text-sm text-gray-500">{count(total, 'product')}</span>
              )}
              {view.query && (
                <button
                  onClick={() => {
                    setText('');
                    setView({ query: '' });
                  }}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('stores.clearSearch')}
                </button>
              )}
            </div>
            <select
              value={view.sort}
              onChange={(event) => setView({ sort: event.target.value as SortOrder })}
              aria-label={t('store.sort')}
              className="h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-900"
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sort.${sort}`)}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <ErrorState error={error} />
          ) : loading && products.length === 0 ? (
            <ProductGridSkeleton />
          ) : products.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-600">{t(view.query ? 'catalog.nothing' : 'store.nothing')}</p>
              {narrowed && (
                <button
                  onClick={() => {
                    setText('');
                    setView({ audience: ALL, category: ALL, query: '' });
                  }}
                  className="mt-3 text-sm font-medium text-blue-600 hover:underline"
                >
                  {t('store.showAll')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
                  loading && 'opacity-50'
                )}
              >
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
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
        </section>

        <section id="about" className="scroll-mt-16 space-y-3">
          <h2 className="text-lg font-bold text-gray-900 md:text-xl">{t('store.about')}</h2>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
              {store.description && (
                <p className="whitespace-pre-line text-sm text-gray-700">{store.description}</p>
              )}
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {[store.city.name, store.address, store.market, store.sector, store.container]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
                {store.working_hours && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{store.working_hours}</span>
                  </div>
                )}
                {store.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    <a href={`tel:${store.phone.replace(/[^\d+]/g, '')}`}>{store.phone}</a>
                  </div>
                )}
              </div>
              <ContactButton store={store} />
            </div>
            <StoreConditions store={store} />
          </div>
        </section>

        {store.is_demo && <DemoNotice />}
      </main>
    </>
  );
}

function StorePage() {
  const slug = String(useParams().id);
  const { t, locale } = useApp();

  // One view per opened storefront, for the store's statistics.
  useEffect(() => {
    track('store_view', { store_slug: slug });
  }, [slug]);

  const { data, error, loading } = useApi(
    async (signal) => {
      const [store, range] = await Promise.all([
        getStore(slug, signal),
        getCatalogFilters(signal, undefined, slug),
      ]);
      return { store, range };
    },
    [slug, locale]
  );

  if (error) return <ErrorState error={error} notFound={t('store.notFound')} />;
  if (loading || !data) return <Loading />;
  return (
    <>
      <Cover store={data.store} />
      <Storefront store={data.store} range={data.range} />
    </>
  );
}

export default function StoreProfilePage() {
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      {/* useSearchParams needs a Suspense boundary for the production build. */}
      <Suspense>
        <StorePage />
      </Suspense>
      <BottomNavigation />
    </div>
  );
}
