'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice, getStore } from '@/lib/catalog';
import { Product } from '@/lib/types';
import { useApp } from '@/lib/context';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { isFavorite, toggleFavorite } = useApp();
  const favorite = isFavorite(product.id);
  const store = getStore(product.storeId);

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-0">
          <div className="relative aspect-[3/4] bg-gray-100">
            <Image
              src={product.images[0]}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
            <button
              aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(product.id);
              }}
              className="absolute top-2 left-2 p-1.5 bg-white/80 rounded-full hover:bg-white transition-colors"
            >
              <Heart
                className={`w-4 h-4 ${
                  favorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
                }`}
              />
            </button>
          </div>
          <div className="p-3">
            <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
              {product.title}
            </h3>
            {store && <p className="text-xs text-gray-500 mb-1 truncate">{store.name}</p>}
            {product.sizes.length > 0 && (
              <p className="text-xs text-gray-600 mb-2 truncate">
                Размеры: {product.sizes.join(', ')}
              </p>
            )}
            <p className="font-bold text-sm text-gray-900">{formatPrice(product.priceMinor)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
