import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Camera, MapPin } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { ProductShelf } from '@/components/ProductShelf';
import { getCatalogFilters, getProducts, getStores } from '@/lib/api';
import { cookies } from 'next/headers';
import { catalogHref } from '@/lib/catalog';
import { LOCALE_COOKIE, Locale, Translate, countLabel, parseLocale, translator } from '@/lib/i18n';
import { Audience, FilterState } from '@/lib/types';

// The catalog changes as sellers update it, so this page is rendered per request.
export const dynamic = 'force-dynamic';

const SHELF_SIZE = 12;

// Which products make a good tile photo. This is a presentation choice for the
// demo catalog (photos with the garment worn, framed from the top); without a
// match the tile falls back to the newest product's photo.
const coverPicks: Partial<Record<Audience, Partial<FilterState>>> = {
  women: { store: 'gergert-sport' },
  men: { store: 'gergert-sport' },
  kids: { category: 'tshirts' },
};

async function loadHome(locale: Locale) {
  const [catalog, stores, mixed] = await Promise.all([
    getCatalogFilters(undefined, locale),
    getStores(undefined, locale),
    getProducts({ limit: SHELF_SIZE }, undefined, locale),
  ]);
  const shelves = await Promise.all(
    catalog.audiences.map(async ({ code, cover_image }) => {
      const [shelf, pick] = await Promise.all([
        getProducts({ filter: { audience: code }, limit: SHELF_SIZE }, undefined, locale),
        getProducts({ filter: { audience: code, ...coverPicks[code] }, limit: 1 }, undefined, locale),
      ]);
      return {
        audience: code,
        products: shelf.items,
        count: shelf.total,
        cover: pick.items[0]?.image_url ?? cover_image,
      };
    })
  );
  return { catalog, stores: stores.items, mixed: mixed.items, shelves };
}

function Unavailable({ t }: { t: Translate }) {
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900">{t('home.unavailable')}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t('home.unavailableText')}
        </p>
      </main>
      <BottomNavigation />
    </div>
  );
}

export default async function HomePage() {
  const locale = parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  const t = translator(locale);
  const home = await loadHome(locale).catch(() => null);
  if (!home) return <Unavailable t={t} />;
  const { catalog, stores, mixed, shelves } = home;

  const hasDemoData = stores.some((store) => store.is_demo);
  const tiles = shelves.filter((shelf) => shelf.cover);
  const heroImages = tiles.map((tile) => tile.cover!).slice(0, 3);

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <main className="mx-auto max-w-6xl px-4 py-4 md:py-6 space-y-8 md:space-y-12">
        <section id="audience" aria-label={t('filter.audience')} className="scroll-mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {tiles.map((tile, index) => (
              <Link
                key={tile.audience}
                href={catalogHref({ audience: tile.audience })}
                className={`group relative overflow-hidden rounded-2xl bg-gray-200 md:col-span-1 md:aspect-[4/5] ${
                  // On phones two tiles share a row; an odd last tile takes the full width.
                  index === tiles.length - 1 && tiles.length % 2 === 1
                    ? 'col-span-2 aspect-[2/1]'
                    : 'aspect-[3/4]'
                }`}
              >
                <Image
                  src={tile.cover!}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 380px"
                  // Above the fold on every screen, so load without waiting for scroll.
                  priority
                  className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
                  <h2 className="text-2xl md:text-3xl font-extrabold">{t(`audience.${tile.audience}`)}</h2>
                  <p className="mt-1 text-xs md:text-sm text-gray-200">
                    {t(`home.tagline.${tile.audience}`)}
                  </p>
                  <p className="mt-2 md:mt-3 text-xs md:text-sm font-semibold text-white">
                    {countLabel(locale, tile.count, 'product')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-gray-900 text-white">
          <div className="grid md:grid-cols-2 items-center">
            <div className="p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-3">
                {t('home.eyebrow')}
              </p>
              <h1 className="text-2xl md:text-4xl font-extrabold leading-tight tracking-tight">
                {t('home.heroTitle')}
              </h1>
              <p className="mt-3 text-sm md:text-base text-gray-300 max-w-md">
                {t('home.heroText')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                >
                  <Camera className="w-4 h-4" />
                  {t('nav.photoSearch')}
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  {t('home.openCatalog')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-6 text-xs text-gray-400">
                {countLabel(locale, catalog.product_count, 'product')} ·{' '}
                {countLabel(locale, stores.length, 'store')}
              </p>
            </div>

            <div className="hidden md:flex justify-center gap-4 p-8" aria-hidden>
              {heroImages.map((image, index) => (
                <div
                  key={image}
                  className={`relative w-28 lg:w-36 aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-2xl ${
                    index === 1 ? 'translate-y-6' : '-translate-y-2'
                  }`}
                >
                  <Image src={image} alt="" fill sizes="144px" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="categories" className="scroll-mt-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3">{t('home.categories')}</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0 [scrollbar-width:thin]">
            {catalog.categories.slice(0, 12).map((category) => (
              <Link
                key={category.code}
                href={catalogHref({ category: category.code })}
                className="group w-24 md:w-auto shrink-0 text-center"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-200">
                  {category.cover_image && (
                    <Image
                      src={category.cover_image}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 96px, 180px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-2 text-xs md:text-sm font-medium text-gray-900 leading-tight">
                  {category.name}
                </p>
                <p className="text-xs text-gray-500">{category.count}</p>
              </Link>
            ))}
          </div>
        </section>

        <ProductShelf title={t('home.shelf')} href="/catalog" products={mixed} />

        <section id="stores" className="scroll-mt-4">
          <div className="flex items-end justify-between gap-3 mb-3">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">{t('nav.stores')}</h2>
            <Link href="/stores" className="text-sm font-medium text-blue-600 hover:underline">
              {t('home.allStores')}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/stores/${store.slug}`}
                className="rounded-xl border border-gray-200 bg-white p-3 hover:shadow-md transition-shadow"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {store.preview_images.map((image) => (
                    <div
                      key={image}
                      className="relative aspect-[3/4] overflow-hidden rounded-md bg-gray-100"
                    >
                      <Image src={image} alt="" fill sizes="120px" className="object-cover" />
                    </div>
                  ))}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{store.name}</h3>
                {store.address && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{store.address}</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {countLabel(locale, store.product_count, 'product')}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {shelves.map(({ audience, products }) => (
          <ProductShelf
            key={audience}
            title={t(`audience.${audience}`)}
            href={catalogHref({ audience })}
            products={products}
          />
        ))}

        {hasDemoData && <DemoNotice />}
      </main>

      <BottomNavigation />
    </div>
  );
}
