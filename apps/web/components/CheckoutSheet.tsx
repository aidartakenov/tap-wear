'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Store, Truck, X } from 'lucide-react';
import { BankBadge } from '@/components/BankBadge';
import { FormError, inputClass, primaryButton } from '@/components/form';
import { OrderItems } from '@/components/OrderItems';
import { createOrder } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { CartStore, DeliveryMethod, PaymentMethod, PaymentOptions } from '@/lib/types';
import { cn } from '@/lib/utils';

const PHONE_KEY = 'tapwear.phone';
const ADDRESS_KEY = 'tapwear.address';
const PHONE = /^\+?[\d\s()-]{9,20}$/;

function remembered(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    // Private mode: the field simply starts empty.
    return '';
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

interface CheckoutSheetProps {
  options: PaymentOptions;
  // One store's part of the cart: what is bought and how this store hands it over.
  store: CartStore;
  onClose: () => void;
}

// The last step before paying: what is bought, how to get it, which bank to pay
// from, and a phone number for the store. "Pay" creates the order and opens the payment.
export function CheckoutSheet({ options, store, onClose }: CheckoutSheetProps) {
  const { t, me, removeFromCart } = useApp();
  const router = useRouter();
  const lines = store.lines.filter((line) => line.available);
  const [delivery, setDelivery] = useState<DeliveryMethod>(
    store.pickup_available ? 'pickup' : 'delivery'
  );
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [invalid, setInvalid] = useState<'phone' | 'address' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // What was typed last time is offered again, so a repeat purchase is a few taps.
  useEffect(() => {
    setPhone(remembered(PHONE_KEY));
    setAddress(remembered(ADDRESS_KEY));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fee = delivery === 'delivery' ? store.delivery_fee_minor : 0;
  const total = store.items_minor + (fee ?? 0);

  const pay = async (event: FormEvent) => {
    event.preventDefault();
    if (!method) return;
    if (delivery === 'delivery' && address.trim().length < 5) {
      setInvalid('address');
      return;
    }
    if (!PHONE.test(phone.trim())) {
      setInvalid('phone');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder({
        items: lines.map((line) => ({ variantId: line.variant_id, quantity: line.quantity })),
        method,
        phone: phone.trim(),
        delivery,
        address: delivery === 'delivery' ? address.trim() : null,
      });
      remember(PHONE_KEY, phone.trim());
      if (delivery === 'delivery') remember(ADDRESS_KEY, address.trim());
      // What was ordered leaves the cart; the rest stays for later.
      removeFromCart(lines.map((line) => line.variant_id));
      router.push(`/pay/${order.id}`);
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

  const ways: { value: DeliveryMethod; offered: boolean; icon: typeof Store; text: string }[] = [
    {
      value: 'pickup',
      offered: store.pickup_available,
      icon: Store,
      text: store.address ?? '',
    },
    {
      value: 'delivery',
      offered: store.delivery_available,
      icon: Truck,
      text: [
        store.delivery_areas,
        store.delivery_fee_minor === null
          ? t('delivery.feeLater')
          : store.delivery_fee_minor === 0
            ? t('delivery.free')
            : formatPrice(store.delivery_fee_minor),
        store.delivery_time,
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('buy.title')}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-3xl md:p-6"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{t('buy.title')}</h2>
            <p className="truncate text-sm text-gray-500">{store.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('buy.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-gray-50 p-3">
          <OrderItems
            items={lines.map((line) => ({
              product_id: line.product_id,
              title: line.title,
              size_label: line.size_label,
              color_name: line.color_name,
              image_url: line.image_url,
              price_minor: line.price_minor,
              quantity: line.quantity,
            }))}
          />
        </div>

        {me === null ? (
          <div className="mt-5 text-center">
            <p className="text-sm text-gray-600">{t('buy.signIn')}</p>
            <Link href="/login" className={`${primaryButton} mt-4`}>
              {t('profile.signInOrRegister')}
            </Link>
          </div>
        ) : (
          <form onSubmit={pay} className="mt-5 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-gray-900">{t('buy.delivery')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {ways
                  .filter((way) => way.offered)
                  .map(({ value, icon: Icon, text }) => {
                    const chosen = delivery === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        onClick={() => setDelivery(value)}
                        className={cn(
                          'rounded-2xl border p-3 text-left transition-colors',
                          chosen
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-900'
                        )}
                      >
                        <span className="flex items-center gap-2 font-semibold text-gray-900">
                          <Icon className="h-4 w-4" />
                          {t(`delivery.${value}`)}
                        </span>
                        {text && <span className="mt-1 block text-xs text-gray-600">{text}</span>}
                      </button>
                    );
                  })}
              </div>
              {delivery === 'delivery' && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-sm font-semibold text-gray-900">
                    {t('buy.address')}
                  </span>
                  <input
                    className={inputClass}
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      setInvalid(null);
                    }}
                    placeholder={t('buy.addressPlaceholder')}
                    autoComplete="street-address"
                    maxLength={300}
                  />
                  {invalid === 'address' && (
                    <span className="mt-1 block text-xs text-red-700">{t('buy.addressInvalid')}</span>
                  )}
                </label>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-gray-900">{t('buy.method')}</legend>
              <div className="space-y-2">
                {options.methods.map((option) => {
                  const chosen = method === option.code;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      onClick={() => setMethod(option.code)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                        chosen
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-900'
                      )}
                    >
                      <BankBadge method={option.code} />
                      <span className="flex-1 font-semibold text-gray-900">{option.name}</span>
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border',
                          chosen ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                        )}
                      >
                        {chosen && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-900">{t('buy.phone')}</span>
              <input
                className={inputClass}
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setInvalid(null);
                }}
                placeholder="+996 555 123 456"
                autoComplete="tel"
                maxLength={20}
                required
              />
              <span
                className={cn(
                  'mt-1 block text-xs',
                  invalid === 'phone' ? 'text-red-700' : 'text-gray-500'
                )}
              >
                {t(invalid === 'phone' ? 'buy.phoneInvalid' : 'buy.phoneHint')}
              </span>
            </label>

            <dl className="space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <dt>{t('buy.items')}</dt>
                <dd>{formatPrice(store.items_minor)}</dd>
              </div>
              {delivery === 'delivery' && (
                <div className="flex justify-between text-gray-600">
                  <dt>{t('delivery.delivery')}</dt>
                  <dd>
                    {fee === null
                      ? t('delivery.feeLater')
                      : fee === 0
                        ? t('delivery.free')
                        : formatPrice(fee)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900">
                <dt>{t('buy.total')}</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            <FormError error={error} />

            <button
              type="submit"
              disabled={!method || busy || lines.length === 0}
              className={`${primaryButton} !h-12 w-full text-base`}
            >
              {busy ? t('buy.creating') : t('buy.pay', { price: formatPrice(total) })}
            </button>
            {options.test_mode && (
              <p className="text-center text-xs text-gray-500">{t('buy.testMode')}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
