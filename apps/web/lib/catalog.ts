import demoCatalog from './data/demoCatalog.json';
import { Audience, FilterState, Product, SortOrder, Store, UserRole } from './types';

// Demo data imported from the stores' public sites by scripts/import_demo_catalog.py.
// These stores are not connected to TopWear; replace with the API once it exists.
export const stores = demoCatalog.stores as Store[];
export const products = demoCatalog.products as Product[];
export const isDemoCatalog = demoCatalog.isDemo;

export const ALL = 'all';

export const audienceLabels: Record<Audience, string> = {
  women: 'Женщинам',
  men: 'Мужчинам',
  kids: 'Детям',
  unisex: 'Унисекс',
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

export const userRoles: UserRole[] = ['guest', 'buyer', 'store_owner', 'admin'];

export const categoryOptions = Array.from(
  new Map(products.map((p) => [p.category, p.categoryLabel])).entries()
)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

export const audienceOptions = (Object.keys(audienceLabels) as Audience[]).filter((audience) =>
  products.some((p) => p.audience === audience)
);

export const sizeOptions = Array.from(new Set(products.flatMap((p) => p.sizes))).sort((a, b) =>
  a.localeCompare(b, 'ru', { numeric: true })
);

// Slider upper bound: the highest price rounded up to the next 1 000 soms.
export const maxPriceSom = Math.ceil(Math.max(...products.map((p) => p.priceMinor)) / 100000) * 1000;

export const defaultFilter: FilterState = {
  query: '',
  audience: ALL,
  category: ALL,
  storeId: ALL,
  minPrice: 0,
  maxPrice: maxPriceSom,
  size: '',
  sort: 'default',
};

export function getStore(id: string): Store | undefined {
  return stores.find((store) => store.id === id);
}

export function getProduct(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getStoreProducts(storeId: string): Product[] {
  return products.filter((product) => product.storeId === storeId);
}

// Categories that have products for an audience, most products first.
export function categoriesFor(audience: Audience | typeof ALL) {
  const counts = new Map<string, { value: string; label: string; count: number; cover: string }>();
  for (const product of products) {
    if (audience !== ALL && product.audience !== audience) continue;
    const entry = counts.get(product.category);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(product.category, {
        value: product.category,
        label: product.categoryLabel,
        count: 1,
        cover: product.images[0],
      });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

// Takes products from each store in turn, so one store does not fill a whole shelf.
export function mixedByStore(items: Product[], limit: number): Product[] {
  const queues = stores.map((store) => items.filter((p) => p.storeId === store.id));
  const mixed: Product[] = [];
  while (mixed.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && mixed.length < limit) mixed.push(next);
    }
  }
  return mixed;
}

export function formatPrice(priceMinor: number): string {
  const soms = Math.floor(priceMinor / 100);
  const tyiyn = priceMinor % 100;
  const whole = soms.toLocaleString('ru-RU');
  return tyiyn ? `${whole},${String(tyiyn).padStart(2, '0')} сом` : `${whole} сом`;
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

function matchesQuery(product: Product, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    product.title,
    product.categoryLabel,
    product.brand,
    product.color,
    audienceLabels[product.audience],
    getStore(product.storeId)?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function matchesFilter(product: Product, filter: FilterState): boolean {
  if (filter.audience !== ALL && product.audience !== filter.audience) return false;
  if (filter.category !== ALL && product.category !== filter.category) return false;
  if (filter.storeId !== ALL && product.storeId !== filter.storeId) return false;
  if (product.priceMinor < filter.minPrice * 100 || product.priceMinor > filter.maxPrice * 100) {
    return false;
  }
  if (filter.size && !product.sizes.includes(filter.size)) return false;
  return matchesQuery(product, filter.query);
}

export function sortProducts(items: Product[], sort: SortOrder): Product[] {
  if (sort === 'default') return items;
  const direction = sort === 'price_asc' ? 1 : -1;
  // Equal prices fall back to the id so the order is stable between renders.
  return [...items].sort(
    (a, b) => direction * (a.priceMinor - b.priceMinor) || a.id.localeCompare(b.id)
  );
}

// URL query string <-> filter. Only non-default values are written to the URL.
export function filterFromParams(params: URLSearchParams): FilterState {
  const number = (key: string, fallback: number) => {
    const value = Number(params.get(key));
    return params.has(key) && Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const sort = params.get('sort') as SortOrder | null;
  return {
    query: params.get('q') ?? '',
    audience: params.get('audience') ?? ALL,
    category: params.get('category') ?? ALL,
    storeId: params.get('store') ?? ALL,
    minPrice: number('price_min', 0),
    maxPrice: number('price_max', maxPriceSom),
    size: params.get('size') ?? '',
    sort: sort && sort in sortLabels ? sort : 'default',
  };
}

export function filterToQuery(filter: Partial<FilterState>): string {
  const full = { ...defaultFilter, ...filter };
  const params = new URLSearchParams();
  if (full.query.trim()) params.set('q', full.query.trim());
  if (full.audience !== ALL) params.set('audience', full.audience);
  if (full.category !== ALL) params.set('category', full.category);
  if (full.storeId !== ALL) params.set('store', full.storeId);
  if (full.minPrice > 0) params.set('price_min', String(full.minPrice));
  if (full.maxPrice < maxPriceSom) params.set('price_max', String(full.maxPrice));
  if (full.size) params.set('size', full.size);
  if (full.sort !== 'default') params.set('sort', full.sort);
  return params.toString();
}

export function catalogHref(filter: Partial<FilterState> = {}): string {
  const query = filterToQuery(filter);
  return query ? `/catalog?${query}` : '/catalog';
}
