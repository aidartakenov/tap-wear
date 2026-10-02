'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { BankBadge } from '@/components/BankBadge';
import { FormError, inputClass, primaryButton } from '@/components/form';
import { createOrder } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { PaymentMethod, PaymentOptions } from '@/lib/types';
import { cn } from '@/lib/utils';

const PHONE_KEY = 'tapwear.phone';
const PHONE = /^\+?[\d\s()-]{9,20}$/;

interface CheckoutSheetProps {
  options: PaymentOptions;
  item: {
    variantId: string;
    title: string;
    image: string | null;
    size: string | null;
    color: string | null;
    priceMinor: number;
  };
  onClose: () => void;
}

// The second step of buying: what is being bought, which bank to pay from, and
// a phone number for the store. "Pay" creates the order and opens the payment.
export function CheckoutSheet({ options, item, onClose }: CheckoutSheetProps) {
  const { t, me } = useApp();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // The phone typed last time is offered again, so a repeat purchase is two taps.
  useEffect(() => {
    try {
      setPhone(localStorage.getItem(PHONE_KEY) ?? '');
    } catch {
      // Private mode: the field simply starts empty.
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pay = async (event: FormEvent) => {
    event.preventDefault();
    if (!method) return;
    if (!PHONE.test(phone.trim())) {
      setPhoneError(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder(item.variantId, method, phone.trim());
      try {
        localStorage.setItem(PHONE_KEY, phone.trim());
      } catch {
        // Not remembered; nothing else depends on it.
      }
      router.push(`/pay/${order.id}`);
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

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
          <h2 className="text-lg font-bold text-gray-900">{t('buy.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('buy.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200">
            {item.image && <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-gray-900">{item.title}</p>
            <p className="text-sm text-gray-600">
              {[item.size, item.color].filter(Boolean).join(' · ') || ' '}
            </p>
          </div>
          <p className="shrink-0 font-bold text-gray-900">{formatPrice(item.priceMinor)}</p>
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
                  setPhoneError(false);
                }}
                placeholder="+996 555 123 456"
                autoComplete="tel"
                maxLength={20}
                required
              />
              <span className={cn('mt-1 block text-xs', phoneError ? 'text-red-700' : 'text-gray-500')}>
                {t(phoneError ? 'buy.phoneInvalid' : 'buy.phoneHint')}
              </span>
            </label>

            <FormError error={error} />

            <button
              type="submit"
              disabled={!method || busy}
              className={`${primaryButton} !h-12 w-full text-base`}
            >
              {busy ? t('buy.creating') : t('buy.pay', { price: formatPrice(item.priceMinor) })}
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
