'use client';

import { useParams } from 'next/navigation';
import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ContactButton } from '@/components/ContactButton';
import { MeasurementSection } from '@/components/MeasurementSection';
import { mockProducts } from '@/lib/mockData';
import { useApp } from '@/lib/context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function ProductDetailPage() {
  const params = useParams();
  const { isFavorite, toggleFavorite } = useApp();
  const product = mockProducts.find((p) => p.id === params.id);

  if (!product) {
    return (
      <div className="min-h-screen pb-20 bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Товар не найден</p>
      </div>
    );
  }

  const favorite = isFavorite(product.id);

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/catalog">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(product.id)}
            >
              <Heart
                className={`w-5 h-5 ${
                  favorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
                }`}
              />
            </Button>
            <Button variant="ghost" size="icon">
              <Share2 className="w-5 h-5 text-gray-600" />
            </Button>
          </div>
        </div>
      </header>

      <main className="bg-white">
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          <span className="text-8xl">👕</span>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{product.category}</Badge>
              <Badge variant="outline">{product.color}</Badge>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {product.priceRange || `${product.price} сом`}
            </p>
          </div>

          <Separator />

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">Описание</h2>
            <p className="text-gray-600">{product.description}</p>
          </div>

          <Separator />

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">Размеры</h2>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size, index) => (
                <Badge key={index} variant="outline" className="px-3 py-1">
                  {size.value} ({size.system})
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <MeasurementSection
            bodyMeasurements={product.bodyMeasurements}
            garmentMeasurements={product.garmentMeasurements}
          />

          <Separator />

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-gray-900 mb-2">Продавец</h2>
              <p className="font-medium text-gray-900">{product.seller.name}</p>
              <p className="text-sm text-gray-600">{product.seller.contact}</p>
            </CardContent>
          </Card>

          <ContactButton product={product} />
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}
