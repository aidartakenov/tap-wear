'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, MapPin, Phone } from 'lucide-react';
import { useApp } from '@/lib/context';
import { Store } from '@/lib/types';

interface StoreCardProps {
  store: Store;
}

export function StoreCard({ store }: StoreCardProps) {
  const { count } = useApp();
  return (
    <Link href={`/stores/${store.slug}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">{store.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {count(store.product_count, 'product')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="whitespace-normal">
                {[store.city.name, store.address].filter(Boolean).join(', ')}
              </span>
            </div>
            {store.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <span>{store.phone}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-3">
            {store.categories.slice(0, 4).map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
