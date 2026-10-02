'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading } from '@/components/PageState';
import { ReportProblem } from '@/components/ReportProblem';
import { track } from '@/lib/analytics';
import { getProduct } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
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
  // The buyer picks one concrete variant; price and availability are that variant's.
  const [selectedId, setSelectedId] = useState<string | null>(
    product.variants.length === 1 ? product.variants[0].id : null
  );
  const selected: Variant | undefined = product.variants.find((v) => v.id === selectedId);
  const { t, locale } = useApp();
  const systemKey = optionalKey(`sizeSystem.${product.size_system}`);
  const sizeSystem = systemKey ? t(systemKey) : product.size_system;

  // One view per opened product page, for the store's statistics.
  useEffect(() => {
    track('product_view', { product_id: product.id });
  }, [product.id]);
  const availability = selected?.availability ?? product.availability;

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

        <div>
          <h2 className="font-semibold text-gray-900 mb-2">{t('product.sizes')}</h2>
          {sized.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('product.sizeLabel')}>
                {sized.map((variant) => {
                  const soldOut = variant.availability === 'out_of_stock';
                  const active = variant.id === selectedId;
                  return (
                    <button
                      key={variant.id}
                      role="radio"
                      aria-checked={active}
                      disabled={soldOut}
                      onClick={() => setSelectedId(active ? null : variant.id)}
                      className={`min-w-11 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : soldOut
                            ? 'border-gray-200 text-gray-300 line-through'
                            : 'border-gray-300 text-gray-900 hover:border-gray-900'
                      }`}
                    >
                      {variant.size_label}
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
                  {t('product.chooseSize')}
                </p>
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
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div>
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
              <Heart
                className={`w-5 h-5 ${favorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
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
