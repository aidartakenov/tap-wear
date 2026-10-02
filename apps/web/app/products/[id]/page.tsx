'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading } from '@/components/PageState';
import { ReportProblem } from '@/components/ReportProblem';
import { getProduct } from '@/lib/api';
import { audienceLabels, availabilityLabels, formatPrice, sizeSystemLabel } from '@/lib/catalog';
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

function formatConfirmed(value: string): string {
  return new Date(value).toLocaleDateString('ru-RU', {
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
  const sizeSystem = sizeSystemLabel(product.size_system);
  const availability = selected?.availability ?? product.availability;

  return (
    <main className="mx-auto max-w-6xl bg-white md:my-6 md:grid md:grid-cols-2 md:gap-8 md:rounded-2xl md:border md:border-gray-200 md:p-6 md:items-start">
      <div className="md:sticky md:top-20">
        <div className="flex overflow-x-auto snap-x snap-mandatory bg-gray-100 md:rounded-xl">
          {product.images.map((image, index) => (
            <div key={image} className="relative aspect-[3/4] w-full shrink-0 snap-center">
              <Image
                src={image}
                alt={`${product.title}, фото ${index + 1}`}
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
            Фото: {product.images.length}. Листайте в сторону
          </p>
        )}
      </div>

      <div className="px-4 py-4 md:p-0 space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary">{product.category.name}</Badge>
            <Badge variant="outline">{audienceLabels[product.audience]}</Badge>
            {product.colors.map((color) => (
              <Badge key={color.code} variant="outline">
                {color.name}
              </Badge>
            ))}
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {selected
              ? formatPrice(selected.price_minor)
              : formatPrice(product.price_minor, product.price_varies)}
          </p>
          <p className={`text-sm mt-1 ${availabilityColor[availability]}`}>
            {availabilityLabels[availability]}
            {selected?.availability_confirmed_at &&
              ` · подтверждено ${formatConfirmed(selected.availability_confirmed_at)}`}
          </p>
        </div>

        <Separator />

        <div>
          <h2 className="font-semibold text-gray-900 mb-2">Размеры</h2>
          {sized.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Размер">
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
                <p className="text-xs text-gray-500 mt-2">Система размеров: {sizeSystem}</p>
              )}
              {!selected && (
                <p className="text-xs text-gray-500 mt-1">
                  Выберите размер, чтобы указать его в сообщении продавцу.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">Магазин не указал размеры. Уточните у продавца.</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Замеры изделия продавец не указал.{' '}
            <Link href="/size-guide" className="text-blue-600 hover:underline">
              Как выбрать размер
            </Link>
          </p>
        </div>

        {product.description && (
          <>
            <Separator />
            <div>
              <h2 className="font-semibold text-gray-900 mb-2">Описание</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{product.description}</p>
            </div>
          </>
        )}

        <Separator />

        <Link href={`/stores/${store.slug}`} className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs text-gray-500 mb-1">Продавец</h2>
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
  const { isFavorite, toggleFavorite } = useApp();
  const { data: product, error, loading } = useApi((signal) => getProduct(id, signal), [id]);
  const favorite = isFavorite(id);

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Назад" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {product && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
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
        <ErrorState error={error} notFound="Товар не найден или снят с продажи" />
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
