'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { DemoNotice } from '@/components/DemoNotice';
import {
  audienceLabels,
  formatPrice,
  getProduct,
  getStore,
  isDemoCatalog,
  sizeSystemLabel,
} from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { Availability } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const availabilityText: Record<Availability, string> = {
  in_stock: 'В наличии по данным магазина',
  out_of_stock: 'Нет в наличии',
  unknown: 'Наличие требует уточнения',
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useApp();
  const product = getProduct(String(params.id));
  const store = product && getStore(product.storeId);

  if (!product || !store) {
    return (
      <div className="min-h-screen pb-20 bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Товар не найден</p>
        <BottomNavigation />
      </div>
    );
  }

  const favorite = isFavorite(product.id);
  const sizeSystem = sizeSystemLabel(product.sizeSystem);

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Назад" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            onClick={() => toggleFavorite(product.id)}
          >
            <Heart
              className={`w-5 h-5 ${favorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            />
          </Button>
        </div>
      </header>

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
              <Badge variant="secondary">{product.categoryLabel}</Badge>
              <Badge variant="outline">{audienceLabels[product.audience]}</Badge>
              {product.color && <Badge variant="outline">{product.color}</Badge>}
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(product.priceMinor)}</p>
            <p className="text-sm text-gray-600 mt-1">{availabilityText[product.availability]}</p>
          </div>

          <Separator />

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">Размеры</h2>
            {product.sizes.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <Badge key={size} variant="outline" className="px-3 py-1">
                      {size}
                    </Badge>
                  ))}
                </div>
                {sizeSystem && (
                  <p className="text-xs text-gray-500 mt-2">Система размеров: {sizeSystem}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-600">
                Магазин не указал размеры. Уточните у продавца.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">Замеры изделия продавец не указал.</p>
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

          <Link href={`/stores/${store.id}`} className="block">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs text-gray-500 mb-1">Продавец</h2>
                  <p className="font-medium text-gray-900">{store.name}</p>
                  <p className="text-sm text-gray-600">
                    {store.city}, {store.address}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </CardContent>
            </Card>
          </Link>

          <ContactButton store={store} product={product} />

          {isDemoCatalog && <DemoNotice />}
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}
