import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Camera, MapPin } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { ProductShelf } from '@/components/ProductShelf';
import {
  ALL,
  audienceLabels,
  audienceOptions,
  catalogHref,
  categoriesFor,
  getStoreProducts,
  isDemoCatalog,
  mixedByStore,
  plural,
  productForms,
  products,
  storeForms,
  stores,
} from '@/lib/catalog';
import { Audience } from '@/lib/types';

const audienceTaglines: Record<Audience, string> = {
  women: 'Платья, костюмы, трикотаж',
  men: 'Куртки, худи, джинсы',
  kids: 'Одежда по росту ребёнка',
  unisex: 'Подходит всем',
};

// Photo shown on each audience tile: taken from a store with clean studio pictures.
const audienceCoverStore: Partial<Record<Audience, string>> = {
  women: 'gergert-sport',
  men: 'gergert-sport',
};

function audienceCover(audience: Audience): string {
  const ofAudience = products.filter((p) => p.audience === audience);
  const preferred = ofAudience.find((p) => p.storeId === audienceCoverStore[audience]);
  return (preferred ?? ofAudience[0]).images[0];
}

export default function HomePage() {
  const heroProducts = audienceOptions.map(
    (audience) => products.find((p) => p.images[0] === audienceCover(audience))!
  );

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <main className="mx-auto max-w-6xl px-4 py-4 md:py-6 space-y-8 md:space-y-12">
        <section id="audience" aria-label="Для кого" className="scroll-mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {audienceOptions.map((audience, index) => (
              <Link
                key={audience}
                href={catalogHref({ audience })}
                className={`group relative overflow-hidden rounded-2xl bg-gray-200 md:col-span-1 md:aspect-[4/5] ${
                  // On phones two tiles share a row; an odd last tile takes the full width.
                  index === audienceOptions.length - 1 && audienceOptions.length % 2 === 1
                    ? 'col-span-2 aspect-[2/1]'
                    : 'aspect-[3/4]'
                }`}
              >
                <Image
                  src={audienceCover(audience)}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 380px"
                  className={`object-cover transition-transform duration-300 group-hover:scale-105 ${audience === 'kids' ? 'object-top' : 'object-center'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
                  <h2 className="text-2xl md:text-3xl font-extrabold">{audienceLabels[audience]}</h2>
                  <p className="mt-1 text-xs md:text-sm text-gray-200">
                    {audienceTaglines[audience]}
                  </p>
                  <p className="mt-2 md:mt-3 text-xs md:text-sm font-semibold text-white">
                    {plural(products.filter((p) => p.audience === audience).length, productForms)}
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
                Каталог одежды Бишкека
              </p>
              <h1 className="text-2xl md:text-4xl font-extrabold leading-tight tracking-tight">
                Найдите вещь по&nbsp;фото
              </h1>
              <p className="mt-3 text-sm md:text-base text-gray-300 max-w-md">
                Загрузите скриншот или фотографию и сравните похожую одежду из магазинов города:
                цена, размеры и контакты продавца на одной странице.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                >
                  <Camera className="w-4 h-4" />
                  Найти по фото
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Открыть каталог
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-6 text-xs text-gray-400">
                {plural(products.length, productForms)} · {plural(stores.length, storeForms)}
              </p>
            </div>

            <div className="hidden md:flex justify-center gap-4 p-8" aria-hidden>
              {heroProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={`relative w-28 lg:w-36 aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-2xl ${
                    index === 1 ? 'translate-y-6' : '-translate-y-2'
                  }`}
                >
                  <Image src={product.images[0]} alt="" fill sizes="144px" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="categories" className="scroll-mt-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3">Категории</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0 [scrollbar-width:thin]">
            {categoriesFor(ALL)
              .slice(0, 12)
              .map((category) => (
                <Link
                  key={category.value}
                  href={catalogHref({ category: category.value })}
                  className="group w-24 md:w-auto shrink-0 text-center"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-200">
                    <Image
                      src={category.cover}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 96px, 180px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 text-xs md:text-sm font-medium text-gray-900 leading-tight">
                    {category.label}
                  </p>
                  <p className="text-xs text-gray-500">{category.count}</p>
                </Link>
              ))}
          </div>
        </section>

        <ProductShelf
          title="Подборка из магазинов"
          href="/catalog"
          products={mixedByStore(products, 12)}
        />

        <section id="stores" className="scroll-mt-4">
          <div className="flex items-end justify-between gap-3 mb-3">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">Магазины</h2>
            <Link href="/stores" className="text-sm font-medium text-blue-600 hover:underline">
              Все магазины
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stores.map((store) => {
              const storeProducts = getStoreProducts(store.id);
              return (
                <Link
                  key={store.id}
                  href={`/stores/${store.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-3 hover:shadow-md transition-shadow"
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {storeProducts.slice(0, 3).map((product) => (
                      <div
                        key={product.id}
                        className="relative aspect-[3/4] overflow-hidden rounded-md bg-gray-100"
                      >
                        <Image
                          src={product.images[0]}
                          alt=""
                          fill
                          sizes="120px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900">{store.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{store.address}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{plural(storeProducts.length, productForms)}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {audienceOptions.map((audience) => (
          <ProductShelf
            key={audience}
            title={audienceLabels[audience]}
            href={catalogHref({ audience })}
            products={mixedByStore(
              products.filter((p) => p.audience === audience),
              12
            )}
          />
        ))}

        {isDemoCatalog && <DemoNotice />}
      </main>

      <BottomNavigation />
    </div>
  );
}
