'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Store, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { Order, OrderItem } from '@/lib/types';

// The lines of an order: photo, name, size and colour, price and count.
export function OrderItems({ items, links = false }: { items: OrderItem[]; links?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
            {item.image_url && (
              <Image src={item.image_url} alt="" fill sizes="48px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            {links && item.product_id ? (
              <Link
                href={`/products/${item.product_id}`}
                className="block truncate font-medium text-gray-900 hover:underline"
              >
                {item.title}
              </Link>
            ) : (
              <p className="truncate font-medium text-gray-900">{item.title}</p>
            )}
            <p className="text-gray-600">
              {[item.size_label, item.color_name].filter(Boolean).join(' · ')}
            </p>
            <p className="text-gray-900">
              {formatPrice(item.price_minor)}
              {item.quantity > 1 && <span className="text-gray-500"> × {item.quantity}</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// How the buyer gets the order, and what the delivery costs.
export function OrderDelivery({ order }: { order: Order }) {
  const { t } = useApp();
  if (order.delivery_method === 'pickup') {
    return (
      <p className="flex items-start gap-2 text-sm text-gray-600">
        <Store className="mt-0.5 h-4 w-4 shrink-0" />
        {t('delivery.pickup')}
      </p>
    );
  }
  return (
    <div className="space-y-1 text-sm text-gray-600">
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        {order.delivery_address}
      </p>
      <p className="flex items-start gap-2">
        <Truck className="mt-0.5 h-4 w-4 shrink-0" />
        {order.delivery_fee_minor === null
          ? t('delivery.feeLater')
          : order.delivery_fee_minor === 0
            ? t('delivery.free')
            : t('delivery.fee', { price: formatPrice(order.delivery_fee_minor) })}
      </p>
    </div>
  );
}
