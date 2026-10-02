'use client';

import { FormEvent, useState } from 'react';
import { Field, FormError, inputClass, primaryButton, textareaClass } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { getPolicy, savePolicy } from '@/lib/api';
import { minorToInput, parsePriceToMinor } from '@/lib/catalog';
import { Policy } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { useApp } from '@/lib/context';

interface FormState {
  pickup: boolean;
  delivery: boolean;
  areas: string;
  // "" means "ask the seller"; "0" means free.
  fee: string;
  time: string;
  tryOn: boolean;
  payment: string;
  returnDays: string;
  returnTerms: string;
}

function toForm(policy: Policy | null): FormState {
  return {
    pickup: policy?.pickup_available ?? true,
    delivery: policy?.delivery_available ?? false,
    areas: policy?.delivery_areas ?? '',
    fee:
      policy?.delivery_fee_minor == null
        ? ''
        : policy.delivery_fee_minor === 0
          ? '0'
          : minorToInput(policy.delivery_fee_minor),
    time: policy?.delivery_time ?? '',
    tryOn: policy?.try_on_at_delivery ?? false,
    payment: policy?.payment_methods ?? '',
    returnDays: policy?.return_days == null ? '' : String(policy.return_days),
    returnTerms: policy?.return_terms ?? '',
  };
}

function Editor({ storeId, initial }: { storeId: string; initial: Policy | null }) {
  const { tr } = useApp();
  const [form, setForm] = useState(() => toForm(initial));
  const [version, setVersion] = useState(initial?.version ?? 0);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const feeText = form.fee.trim();
    const fee = feeText === '' ? null : feeText === '0' ? 0 : parsePriceToMinor(feeText);
    if (feeText !== '' && fee === null) {
      setProblem(tr('Стоимость доставки укажите числом в сомах, например 200'));
      return;
    }
    const days = form.returnDays.trim() === '' ? null : Number(form.returnDays);
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
      setProblem(tr('Срок возврата укажите числом дней'));
      return;
    }
    setProblem(null);
    setBusy(true);
    setError(null);
    try {
      const policy = await savePolicy(storeId, {
        pickup_available: form.pickup,
        delivery_available: form.delivery,
        delivery_areas: form.delivery ? form.areas.trim() || null : null,
        delivery_fee_minor: form.delivery ? fee : null,
        delivery_time: form.delivery ? form.time.trim() || null : null,
        try_on_at_delivery: form.delivery && form.tryOn,
        payment_methods: form.payment.trim() || null,
        return_days: days,
        return_terms: form.returnTerms.trim() || null,
      });
      setVersion(policy.version);
      setSaved(true);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const check = (key: 'pickup' | 'delivery' | 'tryOn', label: string) => (
    <label className="flex items-center gap-2 text-sm text-gray-800">
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(event) => set(key, event.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      {label}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600">
        {tr('Покупатель видит эти условия на странице магазина и в карточке товара до того, как напишет вам. Указывайте только то, что действительно выполняете.')}
      </p>
      {check('pickup', tr('Можно забрать самому (по адресу магазина)'))}
      {check('delivery', tr('Есть доставка'))}
      {form.delivery && (
        <div className="space-y-4 rounded-lg bg-gray-50 p-3">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={tr('Куда доставляете')}>
              <input
                className={inputClass}
                value={form.areas}
                onChange={(event) => set('areas', event.target.value)}
                maxLength={300}
                placeholder={tr('Бишкек')}
              />
            </Field>
            <Field label={tr('Стоимость, сом')} hint={tr('Пусто — «уточняйте»; 0 — бесплатно')}>
              <input
                className={inputClass}
                value={form.fee}
                onChange={(event) => set('fee', event.target.value)}
                inputMode="decimal"
                placeholder="200"
              />
            </Field>
            <Field label={tr('Срок')}>
              <input
                className={inputClass}
                value={form.time}
                onChange={(event) => set('time', event.target.value)}
                maxLength={200}
                placeholder={tr('1–2 дня')}
              />
            </Field>
          </div>
          {check('tryOn', tr('Можно примерить при доставке'))}
        </div>
      )}
      <Field label={tr('Способы оплаты')}>
        <input
          className={inputClass}
          value={form.payment}
          onChange={(event) => set('payment', event.target.value)}
          maxLength={300}
          placeholder={tr('Наличные, перевод на карту')}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <Field label={tr('Возврат, дней')} hint={tr('Пусто — срок не указан')}>
          <input
            className={inputClass}
            value={form.returnDays}
            onChange={(event) => set('returnDays', event.target.value)}
            inputMode="numeric"
            placeholder="14"
          />
        </Field>
        <Field label={tr('Условия возврата и обмена')}>
          <textarea
            className={textareaClass}
            value={form.returnTerms}
            onChange={(event) => set('returnTerms', event.target.value)}
            maxLength={3000}
            placeholder={tr('Вещь не носили, сохранены бирки. Обмен размера — бесплатно.')}
          />
        </Field>
      </div>
      <p className="text-xs text-gray-500">
        {tr('Ваши условия не могут быть хуже прав покупателя по закону о защите прав потребителей.')}
      </p>
      {problem && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {problem}
        </p>
      )}
      <FormError error={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? tr('Сохраняем…') : tr('Сохранить условия')}
        </button>
        {saved && (
          <span className="text-sm text-green-700">
            {tr('Сохранено, версия {version}', { version })}
          </span>
        )}
      </div>
    </form>
  );
}

export function PolicyForm({ storeId }: { storeId: string }) {
  const { data, error, loading } = useApi((signal) => getPolicy(storeId, signal), [storeId]);
  if (error) return <ErrorState error={error} />;
  if (loading) return <Loading />;
  return <Editor storeId={storeId} initial={data} />;
}
