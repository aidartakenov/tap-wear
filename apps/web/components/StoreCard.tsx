'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, MapPin, Phone } from 'lucide-react';
import { useApp } from '@/lib/context';
import { STORE_AUDIENCES, Store } from '@/lib/types';
import { StoreAvatar } from '@/components/StoreAvatar';

interface StoreCardProps {
  store: Store;
}

export function StoreCard({ store }: StoreCardProps) {
  const { count, t } = useApp();
  return (
    <Link href={`/stores/${store.slug}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <StoreAvatar name={store.name} url={store.avatar_url} className="h-12 w-12 text-base" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900">{store.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {[
                  ...STORE_AUDIENCES.filter((audience) => store.audiences.includes(audience)).map(
                    (audience) => t(`storeAudience.${audience}`)
                  ),
                  count(store.product_count, 'product'),
                ].join(' · ')}
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
