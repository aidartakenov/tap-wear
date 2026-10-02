'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { useApp } from '@/lib/context';
import { Product } from '@/lib/types';

interface ProductShelfProps {
  title: string;
  href: string;
  products: Product[];
}

// A titled row of product cards that scrolls sideways on narrow screens.
export function ProductShelf({ title, href, products }: ProductShelfProps) {
  const { t } = useApp();
  if (products.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
        <Link
          href={href}
          className="flex items-center text-sm font-medium text-blue-600 hover:underline shrink-0"
        >
          {t('shelf.seeAll')}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x [scrollbar-width:thin]">
        {products.map((product) => (
          <div key={product.id} className="w-40 md:w-52 shrink-0 snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
