'use client';

import { FormEvent, useState } from 'react';
import { Field, FormError, inputClass, primaryButton, textareaClass } from '@/components/form';
import { ReferenceItem, STORE_AUDIENCES, StoreAudience, StoreInput } from '@/lib/types';
import { useApp } from '@/lib/context';

const empty: StoreInput = {
  name: '',
  description: null,
  city_code: '',
  audiences: [],
  address: null,
  market: null,
  sector: null,
  container: null,
  working_hours: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  website: null,
};

interface StoreFormProps {
  initial?: StoreInput;
  cities: ReferenceItem[];
  submitLabel: string;
  onSubmit: (store: StoreInput) => Promise<void>;
}

export function StoreForm({ initial, cities, submitLabel, onSubmit }: StoreFormProps) {
  const { tr, t } = useApp();
  const [store, setStore] = useState<StoreInput>(
    initial ?? { ...empty, city_code: cities[0]?.code ?? '' }
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noAudience, setNoAudience] = useState(false);

  // Empty text fields are sent as null, so "not given" is never stored as "".
  const text = (key: keyof StoreInput) => ({
    className: inputClass,
    value: store[key] ?? '',
    onChange: (event: { target: { value: string } }) => {
      setSaved(false);
      setStore({ ...store, [key]: event.target.value || (key === 'name' ? '' : null) });
    },
  });

  const toggleAudience = (audience: StoreAudience) => {
    setSaved(false);
    setNoAudience(false);
    setStore({
      ...store,
      audiences: store.audiences.includes(audience)
        ? store.audiences.filter((item) => item !== audience)
        : [...store.audiences, audience],
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (store.audiences.length === 0) {
      setNoAudience(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...store,
        // WhatsApp links need digits only; people usually type "+996 555 ...".
        whatsapp: store.whatsapp ? store.whatsapp.replace(/\D/g, '') : null,
        instagram: store.instagram ? store.instagram.replace(/^@/, '') : null,
      });
      setSaved(true);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={tr('Название магазина')}>
          <input {...text('name')} required minLength={2} maxLength={200} />
        </Field>
        <Field label={tr('Город')}>
          <select
            className={inputClass}
            value={store.city_code}
            onChange={(event) => setStore({ ...store, city_code: event.target.value })}
            required
          >
            {cities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-gray-700">
          {tr('Тип магазина')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {STORE_AUDIENCES.map((audience) => {
            const chosen = store.audiences.includes(audience);
            return (
              <button
                key={audience}
                type="button"
                onClick={() => toggleAudience(audience)}
                aria-pressed={chosen}
                className={`rounded-full border px-4 h-10 text-sm font-medium transition-colors ${
                  chosen
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-900 hover:border-gray-900'
                }`}
              >
                {t(`storeAudience.${audience}`)}
              </button>
            );
          })}
        </div>
        {noAudience ? (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {tr('Выберите тип магазина')}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            {tr('Можно выбрать несколько. По этому покупатели ищут магазины.')}
          </p>
        )}
      </fieldset>
      <Field label={tr('Описание')} hint={tr('Что вы продаёте, для кого. Пара предложений.')}>
        <textarea {...text('description')} className={textareaClass} maxLength={2000} />
      </Field>
      <Field label={tr('Адрес')}>
        <input {...text('address')} maxLength={300} placeholder={tr('ул. Киевская, 100')} />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={tr('Рынок')} hint={tr('Если точка на рынке')}>
          <input {...text('market')} maxLength={100} placeholder={tr('Дордой')} />
        </Field>
        <Field label={tr('Сектор или ряд')}>
          <input {...text('sector')} maxLength={100} />
        </Field>
        <Field label={tr('Контейнер')}>
          <input {...text('container')} maxLength={100} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={tr('Режим работы')}>
          <input {...text('working_hours')} maxLength={200} placeholder={tr('Ежедневно 10:00–19:00')} />
        </Field>
        <Field label={tr('Телефон')}>
          <input {...text('phone')} type="tel" maxLength={50} placeholder="+996 555 123 456" />
        </Field>
        <Field label="WhatsApp" hint={tr('Номер с кодом страны')}>
          <input {...text('whatsapp')} type="tel" maxLength={20} placeholder="996555123456" />
        </Field>
        <Field label="Instagram" hint={tr('Имя аккаунта без @')}>
          <input {...text('instagram')} maxLength={31} placeholder="my_store" />
        </Field>
      </div>
      <Field label={tr('Сайт')}>
        <input {...text('website')} type="url" maxLength={300} placeholder="https://" />
      </Field>
      <FormError error={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? tr('Сохраняем…') : submitLabel}
        </button>
        {saved && <span className="text-sm text-green-700">{tr('Сохранено')}</span>}
      </div>
    </form>
  );
}
