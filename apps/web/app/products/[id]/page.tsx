'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading } from '@/components/PageState';
import { ReportProblem } from '@/components/ReportProblem';
import { StoreAvatar } from '@/components/StoreAvatar';
import { StoreConditions } from '@/components/StoreConditions';
import { track } from '@/lib/analytics';
import { getProduct } from '@/lib/api';
import { colorSwatches, formatHeight, formatPrice } from '@/lib/catalog';
import { Locale, optionalKey } from '@/lib/i18n';
import { useApp } from '@/lib/context';
import { ProductDetail, Variant } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const availabilityColor = {
  in_stock: 'text-green-700',
  out_of_stock: 'text-red-700',
  unknown: 'text-gray-600',
};

function formatConfirmed(value: string, locale: Locale): string {
  return new Date(value).toLocaleDateString(locale === 'ky' ? 'ky-KG' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Bishkek',
  });
}

function ProductView({ product }: { product: ProductDetail }) {
  const { store } = product;
  const sized = product.variants.filter((variant) => variant.size_label);
  // The buyer picks a colour (when there are several) and a size; together they
  // name one concrete variant, whose price and availability are then shown.
  const sizes = Array.from(new Set(sized.map((variant) => variant.size_label!)));
  const manyColors = product.colors.length > 1;
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const fits = (variant: Variant, bySize: string | null, byColor: string | null) =>
    (bySize === null || variant.size_label === bySize) &&
    (!manyColors || byColor === null || variant.color?.code === byColor);
  // Whether the buyer can still get something with this size or colour.
  const offered = (bySize: string | null, byColor: string | null) =>
    product.variants.some(
      (variant) => fits(variant, bySize, byColor) && variant.availability !== 'out_of_stock'
    );
  const complete = (sizes.length === 0 || size !== null) && (!manyColors || color !== null);
  const selected: Variant | undefined =
    product.variants.length === 1
      ? product.variants[0]
      : complete
        ? product.variants.find((variant) => fits(variant, size, color))
        : undefined;
  const { t, locale } = useApp();
  const systemKey = optionalKey(`sizeSystem.${product.size_system}`);
  const sizeSystem = systemKey ? t(systemKey) : product.size_system;

  // One view per opened product page, for the store's statistics.
  useEffect(() => {
    track('product_view', { product_id: product.id });
  }, [product.id]);
  const availability = selected?.availability ?? product.availability;
  // Size -> height, where the seller stated one. Several colours share a size, so each size is listed once.
  const heights = Array.from(
    new Map(
      sized
        .filter((variant) => variant.height_min_cm !== null && variant.height_max_cm !== null)
        .map((variant) => [
          variant.size_label!,
          formatHeight(variant.height_min_cm!, variant.height_max_cm!),
        ])
    )
  );

  return (
    <main className="mx-auto max-w-6xl bg-white md:my-6 md:grid md:grid-cols-2 md:gap-8 md:rounded-2xl md:border md:border-gray-200 md:p-6 md:items-start">
      <div className="md:sticky md:top-20">
        <div className="flex overflow-x-auto snap-x snap-mandatory bg-gray-100 md:rounded-xl">
          {product.images.map((image, index) => (
            <div key={image} className="relative aspect-[3/4] w-full shrink-0 snap-center">
              <Image
                src={image}
                alt={t('product.photoAlt', { title: product.title, n: index + 1 })}
                fill
                sizes="(max-width: 768px) 100vw, 448px"
                className="object-contain"
                priority={index === 0}
              />
            </div>
          ))}
        </div>
        {product.images.length > 1 && (
          <p className="text-center text-xs text-gray-500 py-1">
            {t('product.photos', { n: product.images.length })}
          </p>
        )}
      </div>

      <div className="px-4 py-4 md:p-0 space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary">{product.category.name}</Badge>
            <Badge variant="outline">{t(`audience.${product.audience}`)}</Badge>
            {product.colors.map((color) => (
              <Badge key={color.code} variant="outline">
                {color.name}
              </Badge>
            ))}
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {selected
              ? formatPrice(selected.price_minor)
              : formatPrice(product.price_minor, product.price_varies, locale)}
          </p>
          <p className={`text-sm mt-1 ${availabilityColor[availability]}`}>
            {t(`availability.${availability}`)}
            {selected?.availability_confirmed_at &&
              ` · ${t('product.confirmed', {
                date: formatConfirmed(selected.availability_confirmed_at, locale),
              })}`}
          </p>
        </div>

        <Separator />

        {manyColors && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">{t('product.colors')}</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('product.colorLabel')}>
              {product.colors.map((item) => {
                const active = item.code === color;
                const soldOut = !offered(size, item.code);
                return (
                  <button
                    key={item.code}
                    role="radio"
                    aria-checked={active}
                    disabled={soldOut}
                    onClick={() => setColor(active ? null : item.code)}
                    className={`flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : soldOut
                          ? 'border-gray-200 text-gray-300 line-through'
                          : 'border-gray-300 text-gray-900 hover:border-gray-900'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/15 ring-1 ring-white/60"
                      style={{ background: colorSwatches[item.code] ?? '#e5e7eb' }}
                    />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold text-gray-900 mb-2">{t('product.sizes')}</h2>
          {sized.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('product.sizeLabel')}>
                {sizes.map((label) => {
                  // Several colours share a size, so each size is listed once.
                  const soldOut = !offered(label, color);
                  const active = label === size;
                  return (
                    <button
                      key={label}
                      role="radio"
                      aria-checked={active}
                      disabled={soldOut}
                      onClick={() => setSize(active ? null : label)}
                      className={`min-w-11 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : soldOut
                            ? 'border-gray-200 text-gray-300 line-through'
                            : 'border-gray-300 text-gray-900 hover:border-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {sizeSystem && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('product.sizeSystem', { system: sizeSystem })}
                </p>
              )}
              {!selected && (
                <p className="text-xs text-gray-500 mt-1">
                  {t(manyColors ? 'product.chooseColorAndSize' : 'product.chooseSize')}
                </p>
              )}
              {selected && selected.height_min_cm !== null && selected.height_max_cm !== null && (
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {t('product.heightForSize', {
                    height: formatHeight(selected.height_min_cm, selected.height_max_cm),
                  })}
                </p>
              )}
              {heights.length > 0 && (
                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-600">{t('product.heights')}</p>
                  <dl className="mt-2 flex flex-wrap gap-2 text-sm">
                    {heights.map(([size, height]) => (
                      // Size and height sit side by side in one chip, so they read as a pair.
                      <div
                        key={size}
                        className="flex items-baseline gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1"
                      >
                        <dt className="font-semibold text-gray-900">{size}</dt>
                        <dd className="whitespace-nowrap text-gray-600">— {height} см</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">{t('product.noSizes')}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            {t('product.noMeasurements')}{' '}
            <Link href="/size-guide" className="text-blue-600 hover:underline">
              {t('product.sizeGuide')}
            </Link>
          </p>
        </div>

        {product.description && (
          <>
            <Separator />
            <div>
              <h2 className="font-semibold text-gray-900 mb-2">{t('product.description')}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{product.description}</p>
            </div>
          </>
        )}

        <Separator />

        <Link href={`/stores/${store.slug}`} className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <StoreAvatar name={store.name} url={store.avatar_url} className="h-12 w-12 text-base" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xs text-gray-500 mb-1">{t('product.seller')}</h2>
                <p className="font-medium text-gray-900">{store.name}</p>
                <p className="text-sm text-gray-600">
                  {[store.city.name, store.address].filter(Boolean).join(', ')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <ContactButton
          store={store}
          inquiry={{
            title: product.title,
            priceMinor: selected?.price_minor ?? product.price_minor,
            size: selected?.size_label ?? null,
            color: selected?.color?.name ?? null,
            url: product.source_url,
            productId: product.id,
            variantId: selected?.id ?? null,
          }}
        />

        <StoreConditions store={store} />

        <ReportProblem productId={product.id} />

        {store.is_demo && <DemoNotice />}
      </div>
    </main>
  );
}

export default function ProductDetailPage() {
  const id = String(useParams().id);
  const router = useRouter();
  const { isFavorite, toggleFavorite, t } = useApp();
  const { data: product, error, loading } = useApi((signal) => getProduct(id, signal), [id]);
  const favorite = isFavorite(id);

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label={t('common.back')} onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {product && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(favorite ? 'favorite.remove' : 'favorite.add')}
              onClick={() => toggleFavorite(id)}
            >
              <Bookmark
                className={`w-5 h-5 ${favorite ? 'fill-blue-600 text-blue-600' : 'text-gray-600'}`}
              />
            </Button>
          )}
        </div>
      </header>

      {error ? (
        <ErrorState error={error} notFound={t('product.notFound')} />
      ) : loading || !product ? (
        <Loading />
      ) : (
        // The key resets the selected variant when another product is opened.
        <ProductView key={product.id} product={product} />
      )}

      <BottomNavigation />
    </div>
  );
}
