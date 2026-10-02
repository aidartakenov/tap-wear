export type Audience = 'men' | 'women' | 'kids' | 'unisex';

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export type SortOrder = 'default' | 'price_asc' | 'price_desc';

// The shapes below mirror the API responses (see /api/v1/docs), field for field.

export interface StoreBrief {
  id: string;
  slug: string;
  name: string;
  // Demo stores are imported samples, not real participants.
  is_demo: boolean;
}

export interface Store extends StoreBrief {
  description: string | null;
  city: { code: string; name: string };
  address: string | null;
  market: string | null;
  sector: string | null;
  container: string | null;
  working_hours: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  product_count: number;
  categories: string[];
  preview_images: string[];
}

export interface Color {
  code: string;
  name: string;
}

export interface Product {
  id: string;
  store: StoreBrief;
  title: string;
  category: { code: string; name: string };
  audience: Audience;
  // Integer amount in the currency's minor unit (tyiyn for KGS). Never a float.
  price_minor: number;
  // True when the matching variants differ in price; shown as "от ...".
  price_varies: boolean;
  currency: string;
  brand: string | null;
  colors: Color[];
  size_system: string | null;
  sizes: string[];
  availability: Availability;
  image_url: string | null;
}

export interface Variant {
  id: string;
  size_system: string | null;
  size_label: string | null;
  color: Color | null;
  price_minor: number;
  availability: Availability;
  availability_confirmed_at: string | null;
}

export interface ProductDetail extends Omit<Product, 'store'> {
  description: string | null;
  sku: string | null;
  source_url: string | null;
  images: string[];
  variants: Variant[];
  store: Store;
}

export interface ProductPage {
  items: Product[];
  total: number;
  next_cursor: string | null;
}

export interface CategoryFacet {
  code: string;
  name: string;
  count: number;
  cover_image: string | null;
  by_audience: { audience: Audience; count: number }[];
}

export interface CatalogFilters {
  audiences: { code: Audience; count: number; cover_image: string | null }[];
  categories: CategoryFacet[];
  colors: Color[];
  sizes: { system: string | null; label: string }[];
  stores: StoreBrief[];
  price_max_minor: number;
  product_count: number;
}

// Catalog filters. They live in the URL query string, so a filtered view can be shared.
export interface FilterState {
  query: string;
  audience: string;
  category: string;
  // Store slug.
  store: string;
  color: string;
  // Whole soms; null means "no upper limit".
  minPrice: number;
  maxPrice: number | null;
  size: string;
  inStock: boolean;
  sort: SortOrder;
}

// --- Accounts, seller cabinet and moderation ---------------------------------

export type MemberRole = 'owner' | 'staff';
export type StoreStatus = 'pending_review' | 'active' | 'rejected' | 'blocked';
export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'archived' | 'blocked';

export interface Membership {
  store_id: string;
  store_slug: string;
  store_name: string;
  store_status: StoreStatus;
  role: MemberRole;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  csrf_token: string;
  memberships: Membership[];
}

export interface StoreInput {
  name: string;
  description: string | null;
  city_code: string;
  address: string | null;
  market: string | null;
  sector: string | null;
  container: string | null;
  working_hours: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
}

export interface MerchantStore extends StoreInput {
  id: string;
  slug: string;
  status: StoreStatus;
  review_note: string | null;
  role: MemberRole;
}

export interface Member {
  user_id: string;
  email: string;
  name: string;
  role: MemberRole;
}

export interface VariantInput {
  id?: string;
  size_system: string | null;
  size_label: string | null;
  color: string | null;
  price_override_minor: number | null;
  availability: Availability;
  quantity: number | null;
}

export interface MerchantVariant extends Omit<VariantInput, 'color' | 'id'> {
  id: string;
  color: Color | null;
  availability_confirmed_at: string | null;
  // For "in stock" variants: fresh, due for a reminder, or too old to be shown as in stock.
  confirmation: 'fresh' | 'due' | 'stale';
}

export interface MerchantProduct {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  category: { code: string; name: string };
  audience: Audience;
  base_price_minor: number;
  currency: string;
  brand: string | null;
  sku: string | null;
  status: ProductStatus;
  version: number;
  review_note: string | null;
  images: { id: string; url: string | null; color: string | null; position: number }[];
  variants: MerchantVariant[];
  updated_at: string;
}

export interface ProductInput {
  title: string;
  description: string | null;
  category: string;
  audience: Audience;
  base_price_minor: number;
  brand: string | null;
  variants: VariantInput[];
}

export interface ReferenceItem {
  code: string;
  name: string;
}

export interface Reference {
  cities: ReferenceItem[];
  categories: ReferenceItem[];
  colors: ReferenceItem[];
}

export type Decision = 'approve' | 'reject' | 'block';

export interface ReviewQueue {
  stores: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    instagram: string | null;
    website: string | null;
  }[];
  products: {
    id: string;
    title: string;
    description: string | null;
    store_name: string;
    category: string;
    audience: Audience;
    base_price_minor: number;
    images: string[];
    variant_count: number;
  }[];
}

export type ReportReason = 'wrong_price' | 'not_available' | 'wrong_photo' | 'inappropriate' | 'other';

export interface Report {
  id: string;
  product_id: string;
  product_title: string;
  store_name: string;
  reason: ReportReason;
  comment: string | null;
  status: 'open' | 'resolved';
  resolution: string | null;
  created_at: string;
}

export interface StoreAnalytics {
  days: number;
  store_views: number;
  product_views: number;
  visitors: number;
  contact_clicks: number;
  contacting_visitors: number;
  contacts_by_channel: { key: string; count: number }[];
  sources: { key: string; count: number }[];
  top_products: { id: string; title: string; views: number; contacts: number }[];
  daily: { date: string; product_views: number; contact_clicks: number }[];
  freshness: { in_stock_variants: number; confirmed_recently: number; needs_confirmation: number };
}
