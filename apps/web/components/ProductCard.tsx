'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/lib/types';
import { useApp } from '@/lib/context';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { isFavorite, toggleFavorite } = useApp();
  const favorite = isFavorite(product.id);

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-0">
          <div className="relative aspect-square bg-gray-100">
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <span className="text-4xl">👕</span>
            </div>
            {product.similarityScore && (
              <Badge className="absolute top-2 right-2 bg-blue-600">
                {Math.round(product.similarityScore * 100)}%
              </Badge>
            )}
            <button
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
              {product.name}
            </h3>
            <p className="text-sm text-gray-600 mb-2">{product.category}</p>
            <p className="font-bold text-sm text-gray-900">
              {product.priceRange || `${product.price} сом`}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
