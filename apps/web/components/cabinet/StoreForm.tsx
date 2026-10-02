'use client';

import { FormEvent, useState } from 'react';
import { Field, FormError, inputClass, primaryButton, textareaClass } from '@/components/form';
import { ReferenceItem, StoreInput } from '@/lib/types';

const empty: StoreInput = {
  name: '',
  description: null,
  city_code: '',
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
  const [store, setStore] = useState<StoreInput>(
    initial ?? { ...empty, city_code: cities[0]?.code ?? '' }
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Empty text fields are sent as null, so "not given" is never stored as "".
  const text = (key: keyof StoreInput) => ({
    className: inputClass,
    value: store[key] ?? '',
    onChange: (event: { target: { value: string } }) => {
      setSaved(false);
      setStore({ ...store, [key]: event.target.value || (key === 'name' ? '' : null) });
    },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
        <Field label="Название магазина">
          <input {...text('name')} required minLength={2} maxLength={200} />
        </Field>
        <Field label="Город">
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
      <Field label="Описание" hint="Что вы продаёте, для кого. Пара предложений.">
        <textarea {...text('description')} className={textareaClass} maxLength={2000} />
      </Field>
      <Field label="Адрес">
        <input {...text('address')} maxLength={300} placeholder="ул. Киевская, 100" />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Рынок" hint="Если точка на рынке">
          <input {...text('market')} maxLength={100} placeholder="Дордой" />
        </Field>
        <Field label="Сектор или ряд">
          <input {...text('sector')} maxLength={100} />
        </Field>
        <Field label="Контейнер">
          <input {...text('container')} maxLength={100} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Режим работы">
          <input {...text('working_hours')} maxLength={200} placeholder="Ежедневно 10:00–19:00" />
        </Field>
        <Field label="Телефон">
          <input {...text('phone')} type="tel" maxLength={50} placeholder="+996 555 123 456" />
        </Field>
        <Field label="WhatsApp" hint="Номер с кодом страны">
          <input {...text('whatsapp')} type="tel" maxLength={20} placeholder="996555123456" />
        </Field>
        <Field label="Instagram" hint="Имя аккаунта без @">
          <input {...text('instagram')} maxLength={31} placeholder="my_store" />
        </Field>
      </div>
      <Field label="Сайт">
        <input {...text('website')} type="url" maxLength={300} placeholder="https://" />
      </Field>
      <FormError error={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Сохраняем…' : submitLabel}
        </button>
        {saved && <span className="text-sm text-green-700">Сохранено</span>}
      </div>
    </form>
  );
}
