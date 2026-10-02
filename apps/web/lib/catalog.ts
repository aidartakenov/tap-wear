import { Audience, Availability, FilterState, SortOrder } from './types';

// Pure helpers for the catalog: labels, formatting, and filter <-> URL conversion.
// The data itself comes from the API (lib/api.ts).

export const ALL = 'all';

export const audienceLabels: Record<Audience, string> = {
  women: 'Женщинам',
  men: 'Мужчинам',
  kids: 'Детям',
  unisex: 'Унисекс',
};

export const availabilityLabels: Record<Availability, string> = {
  in_stock: 'В наличии по данным магазина',
  out_of_stock: 'Нет в наличии',
  unknown: 'Наличие требует уточнения',
};

const sizeSystemLabels: Record<string, string> = {
  TR: 'турецкий размер',
  INT: 'международный размер',
  HEIGHT: 'рост ребёнка, см',
};

export const sortLabels: Record<SortOrder, string> = {
  default: 'По умолчанию',
  price_asc: 'Сначала дешевле',
  price_desc: 'Сначала дороже',
};

export const defaultFilter: FilterState = {
  query: '',
  audience: ALL,
  category: ALL,
  store: ALL,
  color: ALL,
  minPrice: 0,
  maxPrice: null,
  size: '',
  inStock: false,
  sort: 'default',
};

export function formatPrice(priceMinor: number, priceVaries = false, locale = 'ru'): string {
  const soms = Math.floor(priceMinor / 100);
  const tyiyn = priceMinor % 100;
  const whole = soms.toLocaleString('ru-RU');
  const amount = tyiyn ? `${whole},${String(tyiyn).padStart(2, '0')} сом` : `${whole} сом`;
  if (!priceVaries) return amount;
  // "from 4 500 soms": the lowest price among variants that cost differently.
  return locale === 'ky' ? `${amount}дон` : `от ${amount}`;
}

// Russian plural: plural(21, ['товар', 'товара', 'товаров']) -> "21 товар".
export function plural(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const form =
    mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
  return `${count} ${form}`;
}

export const productForms: [string, string, string] = ['товар', 'товара', 'товаров'];
export const storeForms: [string, string, string] = ['магазин', 'магазина', 'магазинов'];

export function sizeSystemLabel(system: string | null): string | null {
  return system ? sizeSystemLabels[system] ?? system : null;
}

// Slider upper bound: the highest price rounded up to the next 1 000 soms.
export function sliderMaxSom(priceMaxMinor: number): number {
  return Math.max(1000, Math.ceil(priceMaxMinor / 100000) * 1000);
}

// URL query string <-> filter. Only non-default values are written to the URL.
export function filterFromParams(params: URLSearchParams): FilterState {
  const number = (key: string) => {
    const value = Number(params.get(key));
    return params.has(key) && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const sort = params.get('sort') as SortOrder | null;
  return {
    query: params.get('q') ?? '',
    audience: params.get('audience') ?? ALL,
    category: params.get('category') ?? ALL,
    store: params.get('store') ?? ALL,
    color: params.get('color') ?? ALL,
    minPrice: number('price_min') ?? 0,
    maxPrice: number('price_max'),
    size: params.get('size') ?? '',
    inStock: params.get('in_stock') === '1',
    sort: sort && sort in sortLabels ? sort : 'default',
  };
}

export function filterToQuery(filter: Partial<FilterState>): string {
  const full = { ...defaultFilter, ...filter };
  const params = new URLSearchParams();
  if (full.query.trim()) params.set('q', full.query.trim());
  if (full.audience !== ALL) params.set('audience', full.audience);
  if (full.category !== ALL) params.set('category', full.category);
  if (full.store !== ALL) params.set('store', full.store);
  if (full.color !== ALL) params.set('color', full.color);
  if (full.minPrice > 0) params.set('price_min', String(full.minPrice));
  if (full.maxPrice != null) params.set('price_max', String(full.maxPrice));
  if (full.size) params.set('size', full.size);
  if (full.inStock) params.set('in_stock', '1');
  if (full.sort !== 'default') params.set('sort', full.sort);
  return params.toString();
}

export function catalogHref(filter: Partial<FilterState> = {}): string {
  const query = filterToQuery(filter);
  return query ? `/catalog?${query}` : '/catalog';
}

// "4 500" or "4500,50" (soms) -> 450000 / 450050 (tyiyn), without floating point.
// Returns null when the text is not a valid positive amount.
export function parsePriceToMinor(text: string): number | null {
  const match = text.replace(/\s/g, '').match(/^(\d{1,9})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return minor > 0 ? minor : null;
}

// 450050 -> "4500,50"; 450000 -> "4500". For editing in a form field.
export function minorToInput(minor: number): string {
  const tyiyn = minor % 100;
  const soms = String(Math.floor(minor / 100));
  return tyiyn ? `${soms},${String(tyiyn).padStart(2, '0')}` : soms;
}

export const productStatusLabels = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  published: 'Опубликован',
  archived: 'В архиве',
  blocked: 'Заблокирован',
} as const;

export const storeStatusLabels = {
  pending_review: 'На проверке',
  active: 'Работает',
  rejected: 'Нужны исправления',
  blocked: 'Заблокирован',
} as const;

export const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-800',
  blocked: 'bg-red-100 text-red-800',
};

export const reportReasonLabels = {
  wrong_price: 'Неверная цена',
  not_available: 'Товара нет в наличии',
  wrong_photo: 'Фото не соответствует товару',
  inappropriate: 'Неподходящее содержимое',
  other: 'Другое',
} as const;
