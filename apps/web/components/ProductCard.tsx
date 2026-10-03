'use client';

import { StoreAvatar } from '@/components/StoreAvatar';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/lib/catalog';
import { Product } from '@/lib/types';
import { useApp } from '@/lib/context';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { isFavorite, toggleFavorite, t, locale } = useApp();
  const favorite = isFavorite(product.id);

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-0">
          <div className="relative aspect-[3/4] bg-gray-100">
            {product.image_url && (
              <Image
                src={product.image_url}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            )}
            <button
              aria-label={t(favorite ? 'favorite.remove' : 'favorite.add')}
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(product.id);
              }}
              className="absolute top-2 left-2 p-1.5 bg-white/80 rounded-full hover:bg-white transition-colors"
            >
              <Bookmark
                className={`w-4 h-4 ${
                  favorite ? 'fill-blue-600 text-blue-600' : 'text-gray-600'
                }`}
              />
            </button>
            {product.discount_percent && (
              <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                −{product.discount_percent}%
              </span>
            )}
            {product.availability === 'out_of_stock' && (
              <span className="absolute bottom-2 left-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-xs font-medium text-white">
                {t('availability.out_of_stock')}
              </span>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
              {product.title}
            </h3>
            <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
              <StoreAvatar
                name={product.store.name}
                url={product.store.avatar_url}
                className="h-5 w-5 text-[9px]"
              />
              <span className="truncate">{product.store.name}</span>
            </p>
            {product.sizes.length > 0 && (
              <p className="text-xs text-gray-600 mb-2 truncate">
                {t('product.sizesList', { sizes: product.sizes.join(', ') })}
              </p>
            )}
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className={`font-bold ${product.old_price_minor ? 'text-red-600' : 'text-gray-900'}`}>
                {formatPrice(product.price_minor, product.price_varies, locale)}
              </span>
              {product.old_price_minor && (
                <s className="text-xs text-gray-500">{formatPrice(product.old_price_minor)}</s>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
