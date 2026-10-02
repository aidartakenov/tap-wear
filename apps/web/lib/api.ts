import { ALL } from './catalog';
import {
  CatalogFilters,
  Decision,
  FilterState,
  Me,
  Member,
  MerchantProduct,
  MerchantStore,
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
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

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
  const headers: Record<string, string> = {};
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

async function get<T>(path: string, params?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const query = params?.toString();
  let response: Response;
  try {
    // The catalog changes as sellers update stock, so responses are never cached.
    response = await fetch(`${API_URL}${path}${query ? `?${query}` : ''}`, {
      signal,
      cache: 'no-store',
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
  if (filter.inStock) params.set('in_stock', 'true');
  if (filter.sort && filter.sort !== 'default') params.set('sort', filter.sort);
  ids?.forEach((id) => params.append('ids', id));
  set('cursor', cursor);
  params.set('limit', String(limit));
  return params;
}

export function getProducts(query: ProductQuery = {}, signal?: AbortSignal) {
  return get<ProductPage>('/products', productParams(query), signal);
}

export function getProduct(id: string, signal?: AbortSignal) {
  return get<ProductDetail>(`/products/${encodeURIComponent(id)}`, undefined, signal);
}

export function getStores(signal?: AbortSignal) {
  return get<{ items: Store[] }>('/stores', undefined, signal);
}

export function getStore(slug: string, signal?: AbortSignal) {
  return get<Store>(`/stores/${encodeURIComponent(slug)}`, undefined, signal);
}

export function getCatalogFilters(signal?: AbortSignal) {
  return get<CatalogFilters>('/catalog/filters', undefined, signal);
}

// --- Accounts -----------------------------------------------------------------

export const getMe = (signal?: AbortSignal) => get<Me | null>('/auth/me', undefined, signal);
export const login = (email: string, password: string) =>
  send<Me>('POST', '/auth/login', { email, password });
export const register = (email: string, password: string, name: string) =>
  send<Me>('POST', '/auth/register', { email, password, name });
export const logout = () => send<void>('POST', '/auth/logout');

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

export const getMembers = (storeId: string, signal?: AbortSignal) =>
  get<Member[]>(`/merchant/stores/${storeId}/members`, undefined, signal);
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

export function uploadProductImage(productId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return send<MerchantProduct>('POST', `/merchant/products/${productId}/images`, form);
}
export const deleteProductImage = (productId: string, imageId: string) =>
  send<MerchantProduct>('DELETE', `/merchant/products/${productId}/images/${imageId}`);

// --- Moderation and reports ---------------------------------------------------

export const getReviewQueue = (signal?: AbortSignal) =>
  get<ReviewQueue>('/admin/queue', undefined, signal);
export const decide = (
  target: 'stores' | 'products',
  id: string,
  decision: Decision,
  reason?: string
) => send<{ id: string; status: string }>('POST', `/admin/${target}/${id}/decision`, { decision, reason });
export const getReports = (signal?: AbortSignal) => get<Report[]>('/admin/reports', undefined, signal);
export const resolveReport = (id: string, resolution: string) =>
  send<void>('POST', `/admin/reports/${id}/resolve`, { resolution });
export const reportProduct = (productId: string, reason: ReportReason, comment: string) =>
  send<{ id: string }>('POST', '/reports', {
    product_id: productId,
    reason,
    comment: comment.trim() || null,
  });
