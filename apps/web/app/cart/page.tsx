'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { CheckoutSheet } from '@/components/CheckoutSheet';
import { primaryButton } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { StoreAvatar } from '@/components/StoreAvatar';
import { checkCart, getPaymentOptions } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { optionalKey } from '@/lib/i18n';
import { CartLine, CartStore } from '@/lib/types';
import { useApi } from '@/lib/useApi';

function Line({ line }: { line: CartLine }) {
  const { t, setCartQuantity, removeFromCart } = useApp();
  const most = Math.min(10, line.max_quantity ?? 10);
  const problem = line.problem ? optionalKey(`error.${line.problem}`) : undefined;
  const stepper =
    'flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 disabled:opacity-40';

  return (
    <li className="flex gap-3 py-3">
      <Link
        href={`/products/${line.product_id}`}
        className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-gray-100"
      >
        {line.image_url && (
          <Image src={line.image_url} alt="" fill sizes="72px" className="object-cover" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/products/${line.product_id}`}
          className="block truncate font-medium text-gray-900 hover:underline"
        >
          {line.title}
        </Link>
        <p className="text-sm text-gray-600">
          {[line.size_label, line.color_name].filter(Boolean).join(' · ')}
        </p>
        <p className="font-bold text-gray-900">{formatPrice(line.price_minor)}</p>
        {!line.available && (
          <p className="text-sm text-red-700">{problem ? t(problem) : t('cart.unavailable')}</p>
        )}
        {line.available && line.max_quantity !== null && line.max_quantity <= 3 && (
          <p className="text-xs text-amber-800">{t('cart.onlyLeft', { n: line.max_quantity })}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setCartQuantity(line.variant_id, line.quantity - 1)}
            disabled={line.quantity <= 1}
            aria-label={t('cart.fewer')}
            className={stepper}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-gray-900">{line.quantity}</span>
          <button
            onClick={() => setCartQuantity(line.variant_id, line.quantity + 1)}
            disabled={line.quantity >= most}
            aria-label={t('cart.more')}
            className={stepper}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => removeFromCart([line.variant_id])}
            aria-label={t('cart.remove')}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function CartContents() {
  const { t, cart, removeFromCart } = useApp();
  // The cart is a list of ids on this device; prices and stock come from the server.
  const key = JSON.stringify(cart);
  const { data, error } = useApi(
    async () => {
      const checked = await checkCart(cart);
      // Things that left the catalog are dropped from the saved cart.
      if (checked.missing.length > 0) removeFromCart(checked.missing);
      return checked;
    },
    [key]
  );
  const { data: payments } = useApi((signal) => getPaymentOptions(signal), []);
  const [checkout, setCheckout] = useState<CartStore | null>(null);

  if (cart.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">{t('cart.empty')}</p>
        <Link href="/catalog" className={`${primaryButton} mt-4`}>
          {t('pay.backToCatalog')}
        </Link>
      </div>
    );
  }
  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      {data.stores.length > 1 && <p className="text-sm text-gray-600">{t('cart.perStore')}</p>}
      {data.stores.map((store) => {
        const buyable = store.lines.some((line) => line.available);
        return (
          <section key={store.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <Link href={`/stores/${store.slug}`} className="flex items-center gap-2">
              <StoreAvatar name={store.name} url={store.avatar_url} className="h-8 w-8 text-xs" />
              <h2 className="font-semibold text-gray-900 hover:underline">{store.name}</h2>
            </Link>
            <ul className="divide-y divide-gray-100">
              {store.lines.map((line) => (
                <Line key={line.variant_id} line={line} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <p className="text-lg font-bold text-gray-900">{formatPrice(store.items_minor)}</p>
              <button
                onClick={() => setCheckout(store)}
                disabled={!buyable || !payments?.enabled}
                className={primaryButton}
              >
                {t('cart.checkout')}
              </button>
            </div>
            {payments && !payments.enabled && (
              <p className="mt-2 text-sm text-gray-600">{t('error.payments_unavailable')}</p>
            )}
          </section>
        );
      })}
      {checkout && payments && (
        <CheckoutSheet options={payments} store={checkout} onClose={() => setCheckout(null)} />
      )}
    </div>
  );
}

export default function CartPage() {
  const { t } = useApp();
  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('cart.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <CartContents />
      </main>
      <BottomNavigation />
    </div>
  );
}
