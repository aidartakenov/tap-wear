import { ALL } from './catalog';
import {
  Availability,
  CatalogFilters,
  Decision,
  FilterState,
  Me,
  Member,
  MerchantProduct,
  MerchantStore,
  Policy,
  PolicyInput,
  ProductDetail,
  ProductInput,
  ProductPage,
  Reference,
  Report,
  ReportReason,
  ReviewQueue,
  Store,
  StoreAnalytics,
  StoreInput,
  VariantInput,
  CabinetTheme,
  Cart,
  CartItem,
  DeliveryMethod,
  MerchantOrder,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentOptions,
} from './types';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// In the browser the API is reached by its public address. Pages rendered on
// the server call it directly inside the private network when API_INTERNAL_URL is set.
export const API_URL =
  typeof window === 'undefined' ? (process.env.API_INTERNAL_URL ?? PUBLIC_API_URL) : PUBLIC_API_URL;

export interface ErrorDetail {
  field: string;
  problem: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ErrorDetail[] | Record<string, unknown> | null = null
  ) {
    super(message);
  }
}

// The CSRF token of the signed-in session. The API requires it in a header on
// every changing request; it is kept in memory only (set by the auth context).
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.code ?? 'error',
      body?.message ?? 'Ошибка сервера',
      body?.details ?? null
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

// POST, PATCH and DELETE. A FormData body is sent as a file upload, anything else as JSON.
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Accept-Language': clientLocale };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const isUpload = body instanceof FormData;
  if (body !== undefined && !isUpload) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isUpload ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Не удалось связаться с сервером');
  }
  return parse<T>(response);
}

// The interface language. In the browser it is set once by the app provider; on
// the server each call passes its own locale, because requests share this module.
let clientLocale = 'ru';

export function setApiLocale(locale: string) {
  clientLocale = locale;
}

async function get<T>(
  path: string,
  params?: URLSearchParams,
  signal?: AbortSignal,
  locale?: string
): Promise<T> {
  const query = params?.toString();
  let response: Response;
  try {
    // The catalog changes as sellers update stock, so responses are never cached.
    response = await fetch(`${API_URL}${path}${query ? `?${query}` : ''}`, {
      signal,
      cache: 'no-store',
      // Category, colour and city names come back in this language.
      headers: { 'Accept-Language': locale ?? clientLocale },
      // Sends the session cookie, so signed-in areas work; harmless for guests.
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Не удалось связаться с сервером');
  }
  return parse<T>(response);
}

export const PAGE_SIZE = 24;

export interface ProductQuery {
  filter?: Partial<FilterState>;
  ids?: string[];
  cursor?: string | null;
  limit?: number;
}

export function productParams({ filter = {}, ids, cursor, limit = PAGE_SIZE }: ProductQuery) {
  const params = new URLSearchParams();
  const set = (key: string, value: string | undefined | null) => {
    if (value && value !== ALL) params.set(key, value);
  };
  set('q', filter.query?.trim());
  set('audience', filter.audience);
  set('category', filter.category);
  set('store', filter.store);
  set('color', filter.color);
  set('size_label', filter.size);
  // The API takes money in minor units (tyiyn); the filter holds whole soms.
  if (filter.minPrice) params.set('price_min_minor', String(filter.minPrice * 100));
  if (filter.maxPrice != null) params.set('price_max_minor', String(filter.maxPrice * 100));
  if (filter.height != null) params.set('height_cm', String(filter.height));
  if (filter.inStock) params.set('in_stock', 'true');
  if (filter.sort && filter.sort !== 'default') params.set('sort', filter.sort);
  ids?.forEach((id) => params.append('ids', id));
  set('cursor', cursor);
  params.set('limit', String(limit));
  return params;
}

export function getProducts(query: ProductQuery = {}, signal?: AbortSignal, locale?: string) {
  return get<ProductPage>('/products', productParams(query), signal, locale);
}

export function getProduct(id: string, signal?: AbortSignal, locale?: string) {
  return get<ProductDetail>(`/products/${encodeURIComponent(id)}`, undefined, signal, locale);
}

export function getStores(
  filter: { audience?: string; query?: string } = {},
  signal?: AbortSignal,
  locale?: string
) {
  const params = new URLSearchParams();
  if (filter.audience) params.set('audience', filter.audience);
  if (filter.query?.trim()) params.set('q', filter.query.trim());
  return get<{ items: Store[] }>('/stores', params, signal, locale);
}

export function getStore(slug: string, signal?: AbortSignal, locale?: string) {
  return get<Store>(`/stores/${encodeURIComponent(slug)}`, undefined, signal, locale);
}

// With a store slug the result describes that store's own range.
export function getCatalogFilters(signal?: AbortSignal, locale?: string, store?: string) {
  const params = store ? new URLSearchParams({ store }) : undefined;
  return get<CatalogFilters>('/catalog/filters', params, signal, locale);
}

// --- Accounts -----------------------------------------------------------------

export const getMe = (signal?: AbortSignal) => get<Me | null>('/auth/me', undefined, signal);
export const login = (email: string, password: string) =>
  send<Me>('POST', '/auth/login', { email, password });
export const register = (email: string, password: string, name: string) =>
  send<Me>('POST', '/auth/register', { email, password, name });
export const logout = () => send<void>('POST', '/auth/logout');

export const verifyEmail = (token: string) => send<void>('POST', '/auth/verify-email', { token });
export const resendVerification = () => send<void>('POST', '/auth/verify-email/resend');
export const forgotPassword = (email: string) =>
  send<void>('POST', '/auth/password/forgot', { email });
export const resetPassword = (token: string, newPassword: string) =>
  send<void>('POST', '/auth/password/reset', { token, new_password: newPassword });
export const updateProfile = (name: string) => send<Me>('PATCH', '/auth/me', { name });
export const changePassword = (currentPassword: string, newPassword: string) =>
  send<void>('POST', '/auth/password', {
    current_password: currentPassword,
    new_password: newPassword,
  });

// Saved products of the signed-in account. Each call returns the full list, newest first.
type FavoriteIds = { ids: string[] };
export const getFavoriteIds = (signal?: AbortSignal) =>
  get<FavoriteIds>('/me/favorites', undefined, signal);
export const addFavorite = (productId: string) =>
  send<FavoriteIds>('PUT', `/me/favorites/${productId}`);
export const removeFavorite = (productId: string) =>
  send<FavoriteIds>('DELETE', `/me/favorites/${productId}`);
export const mergeFavorites = (ids: string[]) =>
  send<FavoriteIds>('POST', '/me/favorites/merge', { ids });

// --- Seller cabinet -----------------------------------------------------------

export const getReference = (signal?: AbortSignal) =>
  get<Reference>('/reference', undefined, signal);

export const getMyStores = (signal?: AbortSignal) =>
  get<MerchantStore[]>('/merchant/stores', undefined, signal);
export const createStore = (store: StoreInput) =>
  send<MerchantStore>('POST', '/merchant/stores', store);
export const updateStore = (id: string, store: StoreInput) =>
  send<MerchantStore>('PATCH', `/merchant/stores/${id}`, store);

export const getPolicy = (storeId: string, signal?: AbortSignal) =>
  get<Policy | null>(`/merchant/stores/${storeId}/policy`, undefined, signal);
export const savePolicy = (storeId: string, policy: PolicyInput) =>
  send<Policy>('PUT', `/merchant/stores/${storeId}/policy`, policy);

export const getMembers = (storeId: string, signal?: AbortSignal) =>
  get<Member[]>(`/merchant/stores/${storeId}/members`, undefined, signal);
export const setCabinetTheme = (storeId: string, theme: CabinetTheme) =>
  send<MerchantStore>('PUT', `/merchant/stores/${storeId}/cabinet-theme`, { theme });
export function uploadStoreAvatar(storeId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return send<MerchantStore>('PUT', `/merchant/stores/${storeId}/avatar`, form);
}
export const deleteStoreAvatar = (storeId: string) =>
  send<MerchantStore>('DELETE', `/merchant/stores/${storeId}/avatar`);
export interface TelegramStatus {
  // False when the site has no bot yet.
  bot_configured: boolean;
  connected: boolean;
  link: string | null;
}
export const getStoreTelegram = (storeId: string, signal?: AbortSignal) =>
  get<TelegramStatus>(`/merchant/stores/${storeId}/telegram`, undefined, signal);
export const checkStoreTelegram = (storeId: string) =>
  send<TelegramStatus>('POST', `/merchant/stores/${storeId}/telegram/check`);
export const disconnectStoreTelegram = (storeId: string) =>
  send<TelegramStatus>('DELETE', `/merchant/stores/${storeId}/telegram`);
export const addMember = (storeId: string, email: string) =>
  send<Member>('POST', `/merchant/stores/${storeId}/members`, { email });
export const removeMember = (storeId: string, userId: string) =>
  send<void>('DELETE', `/merchant/stores/${storeId}/members/${userId}`);

export const getMyProducts = (storeId: string, signal?: AbortSignal) =>
  get<{ items: MerchantProduct[] }>(
    '/merchant/products',
    new URLSearchParams({ store_id: storeId }),
    signal
  );
export const getMyProduct = (id: string, signal?: AbortSignal) =>
  get<MerchantProduct>(`/merchant/products/${id}`, undefined, signal);
export const createProduct = (storeId: string, product: ProductInput) =>
  send<MerchantProduct>('POST', '/merchant/products', { store_id: storeId, ...product });
export const updateProduct = (id: string, expectedVersion: number, product: ProductInput) =>
  send<MerchantProduct>('PATCH', `/merchant/products/${id}`, {
    expected_version: expectedVersion,
    ...product,
  });
export const submitProduct = (id: string) =>
  send<MerchantProduct>('POST', `/merchant/products/${id}/submit`);
export const archiveProduct = (id: string) =>
  send<MerchantProduct>('POST', `/merchant/products/${id}/archive`);
export const copyProduct = (id: string) =>
  send<MerchantProduct>('POST', `/merchant/products/${id}/copy`);
export const updateVariant = (
  id: string,
  change: Partial<Pick<VariantInput, 'availability' | 'quantity'>> & {
    confirm_availability?: boolean;
  }
) => send<MerchantProduct>('PATCH', `/merchant/variants/${id}`, change);

export const confirmProductAvailability = (id: string) =>
  send<MerchantProduct>('POST', `/merchant/products/${id}/confirm-availability`);
export const getStoreAnalytics = (storeId: string, days: number, signal?: AbortSignal) =>
  get<StoreAnalytics>(
    '/merchant/analytics',
    new URLSearchParams({ store_id: storeId, days: String(days) }),
    signal
  );

export interface ImportResult {
  created: number;
  // One entry per product row; `row` counts the header as row 1.
  rows: { row: number; title: string; errors: string[] }[];
}
// With dryRun the file is only checked and nothing is created.
export function importProducts(storeId: string, file: File, dryRun: boolean) {
  const form = new FormData();
  form.append('file', file);
  return send<ImportResult>(
    'POST',
    `/merchant/stores/${storeId}/import?dry_run=${dryRun}`,
    form
  );
}

export function uploadProductImage(productId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return send<MerchantProduct>('POST', `/merchant/products/${productId}/images`, form);
}
export const setProductImageColor = (productId: string, imageId: string, color: string | null) =>
  send<MerchantProduct>('PATCH', `/merchant/products/${productId}/images/${imageId}`, { color });
export const deleteProductImage = (productId: string, imageId: string) =>
  send<MerchantProduct>('DELETE', `/merchant/products/${productId}/images/${imageId}`);

// --- Search by photo ----------------------------------------------------------------

export interface VisualSearchStatus {
  model_version: string;
  // True while a colour-only stand-in is used instead of a real image model.
  placeholder: boolean;
  indexed_photos: number;
  pending_photos: number;
}
export const getVisualSearchStatus = (signal?: AbortSignal) =>
  get<VisualSearchStatus>('/search/visual/status', undefined, signal);
// The picture is sent for this one search and is not kept on the server.
// The catalog's filters apply first; what passes them is ranked by likeness.
export function visualSearch(picture: Blob, filter: Partial<FilterState> = {}) {
  const form = new FormData();
  form.append('file', picture, 'query.jpg');
  const params = productParams({ filter, limit: 24 });
  return send<ProductPage>('POST', `/search/visual?${params}`, form);
}

// Products that look like the given one; empty until its photos are indexed.
export const getSimilarProducts = (productId: string, signal?: AbortSignal) =>
  get<ProductPage>(`/search/similar/${productId}`, new URLSearchParams({ limit: '12' }), signal);

// --- Orders and payment -----------------------------------------------------------

export const getPaymentOptions = (signal?: AbortSignal) =>
  get<PaymentOptions>('/payments/options', undefined, signal);
// The cart as it stands now: current prices and what can be bought, grouped by store.
export const checkCart = (items: CartItem[]) =>
  send<Cart>('POST', '/cart', {
    items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
  });
export const createOrder = (order: {
  items: CartItem[];
  method: PaymentMethod;
  phone: string;
  delivery: DeliveryMethod;
  address: string | null;
}) =>
  send<Order>('POST', '/orders', {
    items: order.items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    payment_method: order.method,
    phone: order.phone,
    delivery_method: order.delivery,
    address: order.address,
  });
export const getOrder = (id: string, signal?: AbortSignal) =>
  get<Order>(`/orders/${id}`, undefined, signal);
export const getMyOrders = (signal?: AbortSignal) => get<Order[]>('/me/orders', undefined, signal);
// Stands in for the bank's confirmation while payments run in test mode.
export const confirmTestPayment = (id: string) => send<Order>('POST', `/orders/${id}/test-pay`);
export const cancelOrder = (id: string) => send<Order>('POST', `/orders/${id}/cancel`);
export const advanceOrder = (id: string, status: OrderStatus) =>
  send<MerchantOrder>('POST', `/merchant/orders/${id}/status`, { status });
export const refuseOrder = (id: string, reason: string) =>
  send<MerchantOrder>('POST', `/merchant/orders/${id}/refuse`, { reason });
// A store's sales book: totals, what sold, every sale, and what is left.
export interface SalesReport {
  days: number;
  summary: {
    revenue_minor: number;
    pieces: number;
    sales: number;
    average_minor: number;
    site_revenue_minor: number;
    site_pieces: number;
    shop_revenue_minor: number;
    shop_pieces: number;
    refunds: number;
    refunds_minor: number;
    delivery_orders: number;
    pickup_orders: number;
  };
  by_day: { date: string; revenue_minor: number; pieces: number }[];
  products: {
    product_id: string | null;
    title: string;
    image_url: string | null;
    pieces: number;
    revenue_minor: number;
    variants: { size_label: string | null; color_name: string | null; pieces: number }[];
  }[];
  categories: { key: string; pieces: number; revenue_minor: number }[];
  sizes: { key: string; pieces: number; revenue_minor: number }[];
  colors: { key: string; pieces: number; revenue_minor: number }[];
  lines: {
    id: string;
    // Sold through the site, or in the shop itself and written down by the seller.
    channel: 'site' | 'shop';
    sold_at: string;
    order_number: number | null;
    product_id: string | null;
    title: string;
    size_label: string | null;
    color_name: string | null;
    quantity: number;
    price_minor: number;
    total_minor: number;
    buyer: string | null;
    status: string | null;
    note: string | null;
  }[];
  stock: {
    variant_id: string;
    product_id: string;
    title: string;
    size_label: string | null;
    color_name: string | null;
    quantity: number | null;
    availability: Availability;
    price_minor: number;
    sold: number;
  }[];
}
export const getSalesReport = (storeId: string, days: number, signal?: AbortSignal) =>
  get<SalesReport>(
    '/merchant/sales',
    new URLSearchParams({ store_id: storeId, days: String(days) }),
    signal
  );
// The same sales book as a PDF file, made by the server.
export async function getSalesPdf(storeId: string, days: number): Promise<Blob> {
  const query = new URLSearchParams({ store_id: storeId, days: String(days) });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/merchant/sales/pdf?${query}`, {
      cache: 'no-store',
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Не удалось связаться с сервером');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.code ?? 'error', body?.message ?? 'Ошибка сервера');
  }
  return response.blob();
}
// One tap: one piece of this size and colour was sold in the shop itself.
// A counted size goes down by one; an uncounted one is switched off.
export const markSold = (variantId: string) =>
  send<{ sale_id: string; product: MerchantProduct }>(
    'POST',
    `/merchant/variants/${variantId}/sold`
  );
export const removeShopSale = (id: string) => send<void>('DELETE', `/merchant/sales/${id}`);
export const getStoreOrders = (storeId: string, signal?: AbortSignal) =>
  get<MerchantOrder[]>('/merchant/orders', new URLSearchParams({ store_id: storeId }), signal);

// --- Moderation and reports ---------------------------------------------------

export const getReviewQueue = (signal?: AbortSignal) =>
  get<ReviewQueue>('/admin/queue', undefined, signal);
export const decide = (
  target: 'stores' | 'products',
  id: string,
  decision: Decision,
  reason?: string
) => send<{ id: string; status: string }>('POST', `/admin/${target}/${id}/decision`, { decision, reason });
// A read-only view of the database for the administrator.
export interface DatabaseOverview {
  database: string;
  version: string;
  size_bytes: number;
  connections: number;
  tables: { name: string; rows: number; size_bytes: number }[];
}
export interface DatabaseTable {
  name: string;
  columns: { name: string; type: string; primary_key: boolean; nullable: boolean }[];
  rows: unknown[][];
  total: number;
  sort: string;
  descending: boolean;
}
export const getDatabaseOverview = (signal?: AbortSignal) =>
  get<DatabaseOverview>('/admin/database', undefined, signal);
export function getDatabaseTable(
  name: string,
  page: { limit: number; offset: number; sort?: string; descending?: boolean; query?: string },
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
  if (page.sort) params.set('sort', page.sort);
  if (page.descending !== undefined) params.set('descending', String(page.descending));
  if (page.query) params.set('q', page.query);
  return get<DatabaseTable>(`/admin/database/tables/${encodeURIComponent(name)}`, params, signal);
}
export interface AdminOverview {
  users: number;
  stores_active: number;
  stores_pending: number;
  products_published: number;
  products_pending: number;
  // Over the chosen period.
  orders: number;
  turnover_minor: number;
  refunded: number;
  days: { day: string; orders: number; turnover_minor: number; new_users: number; new_stores: number }[];
}
export const getAdminOverview = (days: number, signal?: AbortSignal) =>
  get<AdminOverview>('/admin/overview', new URLSearchParams({ days: String(days) }), signal);

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  stores: string[];
  orders: number;
}
export function getAdminUsers(
  page: { query: string; limit: number; offset: number },
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
  if (page.query) params.set('q', page.query);
  return get<{ items: AdminUser[]; total: number }>('/admin/users', params, signal);
}
export const changeAdminUser = (id: string, change: { is_active?: boolean; is_admin?: boolean }) =>
  send<AdminUser>('PATCH', `/admin/users/${id}`, change);
export const getReports = (signal?: AbortSignal) => get<Report[]>('/admin/reports', undefined, signal);
export const resolveReport = (id: string, resolution: string) =>
  send<void>('POST', `/admin/reports/${id}/resolve`, { resolution });
export const reportProduct = (productId: string, reason: ReportReason, comment: string) =>
  send<{ id: string }>('POST', '/reports', {
    product_id: productId,
    reason,
    comment: comment.trim() || null,
  });
