'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import {
  Field,
  FormError,
  StatusBadge,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
  textareaClass,
} from '@/components/form';
import {
  archiveProduct,
  copyProduct,
  createProduct,
  deleteProductImage,
  submitProduct,
  updateProduct,
  uploadProductImage,
} from '@/lib/api';
import {
  audienceLabels,
  minorToInput,
  parsePriceToMinor,
  productStatusLabels,
} from '@/lib/catalog';
import { Audience, Availability, MerchantProduct, ProductInput, Reference } from '@/lib/types';

const sizeSystems = [
  { value: '', label: 'Без размеров' },
  { value: 'INT', label: 'Буквенные (S, M, L)' },
  { value: 'RU', label: 'Российские (44, 46, 48)' },
  { value: 'EU', label: 'Европейские (36, 38, 40)' },
  { value: 'TR', label: 'Турецкие' },
  { value: 'HEIGHT', label: 'Детские по росту (110, 116)' },
];

interface VariantRow {
  key: string;
  id?: string;
  size: string;
  color: string;
  availability: Availability;
  price: string;
}

interface FormState {
  title: string;
  description: string;
  category: string;
  audience: Audience;
  price: string;
  brand: string;
  sizeSystem: string;
  variants: VariantRow[];
}

let rowCounter = 0;
const newRow = (): VariantRow => ({
  key: `new-${rowCounter++}`,
  size: '',
  color: '',
  availability: 'in_stock',
  price: '',
});

function toForm(product: MerchantProduct | null, reference: Reference): FormState {
  if (!product) {
    return {
      title: '',
      description: '',
      category: reference.categories[0]?.code ?? '',
      audience: 'women',
      price: '',
      brand: '',
      sizeSystem: 'INT',
      variants: [newRow()],
    };
  }
  return {
    title: product.title,
    description: product.description ?? '',
    category: product.category.code,
    audience: product.audience,
    price: minorToInput(product.base_price_minor),
    brand: product.brand ?? '',
    sizeSystem: product.variants.find((variant) => variant.size_system)?.size_system ?? '',
    variants: product.variants.map((variant) => ({
      key: variant.id,
      id: variant.id,
      size: variant.size_label ?? '',
      color: variant.color?.code ?? '',
      availability: variant.availability,
      price: variant.price_override_minor ? minorToInput(variant.price_override_minor) : '',
    })),
  };
}

interface ProductEditorProps {
  storeId: string;
  product: MerchantProduct | null;
  reference: Reference;
}

export function ProductEditor({ storeId, product: initial, reference }: ProductEditorProps) {
  const router = useRouter();
  const [product, setProduct] = useState(initial);
  const [form, setForm] = useState(() => toForm(initial, reference));
  const [savedForm, setSavedForm] = useState(form);
  const [error, setError] = useState<unknown>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const locked = product?.status === 'blocked';
  const withSizes = form.sizeSystem !== '';

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setRow = (key: string, change: Partial<VariantRow>) =>
    set(
      'variants',
      form.variants.map((row) => (row.key === key ? { ...row, ...change } : row))
    );

  const applySaved = (saved: MerchantProduct) => {
    const next = toForm(saved, reference);
    setProduct(saved);
    setForm(next);
    setSavedForm(next);
  };

  // Turns the form into the API's shape; returns null (and shows why) if a price is invalid.
  const toInput = (): ProductInput | null => {
    const basePrice = parsePriceToMinor(form.price);
    if (basePrice === null) {
      setPriceError('Укажите цену в сомах, например 4500');
      return null;
    }
    const rows = withSizes ? form.variants : form.variants.slice(0, 1);
    const variants = [];
    for (const row of rows) {
      const override = row.price.trim() ? parsePriceToMinor(row.price) : null;
      if (row.price.trim() && override === null) {
        setPriceError('Цена варианта указана неверно');
        return null;
      }
      variants.push({
        id: row.id,
        size_system: withSizes && row.size.trim() ? form.sizeSystem : null,
        size_label: withSizes ? row.size.trim() || null : null,
        color: row.color || null,
        price_override_minor: override,
        availability: row.availability,
        quantity: null,
      });
    }
    setPriceError(null);
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      audience: form.audience,
      base_price_minor: basePrice,
      brand: form.brand.trim() || null,
      variants,
    };
  };

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(null);
    }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const input = toInput();
    if (!input) return;
    run('save', async () => {
      if (!product) {
        const created = await createProduct(storeId, input);
        // Photos are added to an existing product, so continue on its own page.
        router.replace(`/cabinet/products/${created.id}`);
        return;
      }
      applySaved(await updateProduct(product.id, product.version, input));
    });
  };

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!product || files.length === 0) return;
    run('photo', async () => {
      let current = product;
      for (const file of files) {
        current = await uploadProductImage(current.id, file);
        // Uploading does not touch the form, so unsaved edits stay as they are.
        setProduct(current);
      }
    });
  };

  return (
    <div className="space-y-4">
      {product && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={product.status} label={productStatusLabels[product.status]} />
          {product.status === 'pending_review' && (
            <span className="text-sm text-gray-600">Товар ждёт проверки администратором.</span>
          )}
          {product.review_note && (
            <span className="text-sm text-red-700">Замечание проверки: {product.review_note}</span>
          )}
        </div>
      )}

      <form onSubmit={save} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <fieldset disabled={locked} className="space-y-4">
          <Field label="Название">
            <input
              className={inputClass}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder="Куртка зимняя с капюшоном"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Категория">
              <select
                className={inputClass}
                value={form.category}
                onChange={(event) => set('category', event.target.value)}
              >
                {reference.categories.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Для кого">
              <select
                className={inputClass}
                value={form.audience}
                onChange={(event) => set('audience', event.target.value as Audience)}
              >
                {(Object.keys(audienceLabels) as Audience[]).map((audience) => (
                  <option key={audience} value={audience}>
                    {audienceLabels[audience]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Цена, сом" hint="Покупатель видит цену всегда. «Цена по запросу» не допускается.">
              <input
                className={inputClass}
                value={form.price}
                onChange={(event) => set('price', event.target.value)}
                inputMode="decimal"
                required
                placeholder="4500"
              />
            </Field>
          </div>
          <Field label="Бренд" hint="Необязательно">
            <input
              className={inputClass}
              value={form.brand}
              onChange={(event) => set('brand', event.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label="Описание" hint="Ткань и состав указывайте, только если знаете точно.">
            <textarea
              className={textareaClass}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={5000}
            />
          </Field>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <div>
              <h2 className="font-semibold text-gray-900">Размеры и наличие</h2>
              <p className="text-sm text-gray-600">
                Одна строка — одно сочетание размера и цвета. Отмечайте, что реально есть.
              </p>
            </div>
            <Field label="Система размеров">
              <select
                className={`${inputClass} md:max-w-xs`}
                value={form.sizeSystem}
                onChange={(event) => set('sizeSystem', event.target.value)}
              >
                {sizeSystems.map((system) => (
                  <option key={system.value} value={system.value}>
                    {system.label}
                  </option>
                ))}
              </select>
            </Field>

            <ul className="space-y-2">
              {(withSizes ? form.variants : form.variants.slice(0, 1)).map((row) => (
                <li
                  key={row.key}
                  className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
                >
                  {withSizes && (
                    <input
                      className={inputClass}
                      value={row.size}
                      onChange={(event) => setRow(row.key, { size: event.target.value })}
                      placeholder="Размер"
                      aria-label="Размер"
                      maxLength={30}
                      required
                    />
                  )}
                  <select
                    className={inputClass}
                    value={row.color}
                    onChange={(event) => setRow(row.key, { color: event.target.value })}
                    aria-label="Цвет"
                  >
                    <option value="">Цвет не указан</option>
                    {reference.colors.map((color) => (
                      <option key={color.code} value={color.code}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={row.availability}
                    onChange={(event) =>
                      setRow(row.key, { availability: event.target.value as Availability })
                    }
                    aria-label="Наличие"
                  >
                    <option value="in_stock">Есть в наличии</option>
                    <option value="out_of_stock">Нет в наличии</option>
                    <option value="unknown">Нужно уточнять</option>
                  </select>
                  <input
                    className={inputClass}
                    value={row.price}
                    onChange={(event) => setRow(row.key, { price: event.target.value })}
                    placeholder="Своя цена"
                    aria-label="Цена этого варианта, если отличается"
                    inputMode="decimal"
                  />
                  {withSizes && (
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'variants',
                          form.variants.filter((item) => item.key !== row.key)
                        )
                      }
                      disabled={form.variants.length === 1}
                      aria-label="Удалить строку"
                      className="col-span-2 justify-self-end rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 md:col-span-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {withSizes && (
              <button
                type="button"
                onClick={() => {
                  // A new row repeats the previous colour: usually only the size differs.
                  const last = form.variants[form.variants.length - 1];
                  set('variants', [...form.variants, { ...newRow(), color: last?.color ?? '' }]);
                }}
                className={secondaryButton}
              >
                <Plus className="w-4 h-4" />
                Добавить размер
              </button>
            )}
          </div>
        </fieldset>

        {priceError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {priceError}
          </p>
        )}
        <FormError error={error} />

        {!locked && (
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button type="submit" disabled={busy !== null || (!!product && !dirty)} className={primaryButton}>
              {busy === 'save' ? 'Сохраняем…' : product ? 'Сохранить изменения' : 'Сохранить черновик'}
            </button>
            {product && !dirty && <span className="text-sm text-gray-500">Все изменения сохранены</span>}
            {!product && (
              <span className="text-sm text-gray-500">Фото добавляются после сохранения черновика.</span>
            )}
          </div>
        )}
      </form>

      {product && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <h2 className="font-semibold text-gray-900">Фотографии</h2>
            <p className="text-sm text-gray-600">
              От 1 до 5 фото, JPEG, PNG или WebP до 10 МБ. Первое фото показывается в каталоге.
              Загружайте только свои фотографии.
            </p>
          </div>
          <ul className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {product.images.map((image) => (
              <li key={image.id} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100">
                {image.url && <Image src={image.url} alt="" fill sizes="160px" className="object-cover" />}
                {!locked && (
                  <button
                    onClick={() =>
                      run('photo', async () =>
                        setProduct(await deleteProductImage(product.id, image.id))
                      )
                    }
                    disabled={busy !== null}
                    aria-label="Удалить фото"
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-gray-700 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
            {!locked && product.images.length < 5 && (
              <li>
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={busy !== null}
                  className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-blue-600 hover:text-blue-600"
                >
                  <ImagePlus className="w-6 h-6" />
                  {busy === 'photo' ? 'Загрузка…' : 'Добавить'}
                </button>
              </li>
            )}
          </ul>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={addPhotos}
          />
        </section>
      )}

      {product && !locked && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          {(product.status === 'draft' || product.status === 'archived') && (
            <button
              onClick={() => run('submit', async () => applySaved(await submitProduct(product.id)))}
              disabled={busy !== null || dirty}
              className={primaryButton}
            >
              {busy === 'submit' ? 'Отправляем…' : 'Отправить на проверку'}
            </button>
          )}
          <button
            onClick={() =>
              run('copy', async () => {
                const copy = await copyProduct(product.id);
                router.push(`/cabinet/products/${copy.id}`);
              })
            }
            disabled={busy !== null}
            className={secondaryButton}
          >
            Скопировать в новый черновик
          </button>
          {product.status !== 'archived' && (
            <button
              onClick={() => run('archive', async () => applySaved(await archiveProduct(product.id)))}
              disabled={busy !== null}
              className={dangerButton}
            >
              Убрать в архив
            </button>
          )}
          {dirty && (product.status === 'draft' || product.status === 'archived') && (
            <span className="text-sm text-gray-500">Сначала сохраните изменения.</span>
          )}
        </section>
      )}
    </div>
  );
}
