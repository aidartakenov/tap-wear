export type Audience = 'men' | 'women' | 'kids' | 'unisex';

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export type SortOrder = 'default' | 'price_asc' | 'price_desc';

// The shapes below mirror the API responses (see /api/v1/docs), field for field.

// Who a store sells for. A store may pick several.
export type StoreAudience = 'women' | 'men' | 'kids';
export const STORE_AUDIENCES: StoreAudience[] = ['men', 'women', 'kids'];
// Colours of a store's cabinet; the owner picks one.
export type CabinetTheme = 'black' | 'pink' | 'green' | 'blue' | 'orange' | 'rainbow';
export const CABINET_THEMES: CabinetTheme[] = ['black', 'pink', 'green', 'blue', 'orange', 'rainbow'];

export interface StoreBrief {
  id: string;
  slug: string;
  name: string;
  // Demo stores are imported samples, not real participants.
  is_demo: boolean;
  // The store's own picture; null when it has not uploaded one.
  avatar_url: string | null;
}

export interface PolicyInput {
  pickup_available: boolean;
  delivery_available: boolean;
  delivery_areas: string | null;
  // Minor units (tyiyn). null: the fee must be asked. 0: free.
  delivery_fee_minor: number | null;
  delivery_time: string | null;
  try_on_at_delivery: boolean;
  payment_methods: string | null;
  return_days: number | null;
  return_terms: string | null;
}

export interface Policy extends PolicyInput {
  version: number;
  updated_at: string;
}

export interface Store extends StoreBrief {
  audiences: StoreAudience[];
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
  policy: Policy | null;
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
  // The same price before the store's discount, shown crossed out; null without one.
  old_price_minor: number | null;
  discount_percent: number | null;
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
  // The seller's recommended height for this size, in cm; null when not given.
  height_min_cm: number | null;
  height_max_cm: number | null;
  price_minor: number;
  // Before the store's discount; null without one.
  old_price_minor: number | null;
  availability: Availability;
  availability_confirmed_at: string | null;
  // Pieces left, when the store counts its stock and few remain.
  left: number | null;
}

export interface ProductDetail extends Omit<Product, 'store'> {
  description: string | null;
  sku: string | null;
  source_url: string | null;
  images: string[];
  // For each photo, the colour code it shows, or null for any colour.
  image_colors: (string | null)[];
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
  // The buyer's height in centimetres; null when not filtering by it.
  height: number | null;
  inStock: boolean;
  // Only discounted products.
  sale: boolean;
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
  // False until the person opens the link sent to their address.
  email_verified: boolean;
  csrf_token: string;
  memberships: Membership[];
}

export interface StoreInput {
  name: string;
  description: string | null;
  city_code: string;
  audiences: StoreAudience[];
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
  avatar_url: string | null;
  cabinet_theme: CabinetTheme;
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
  // Optional recommended height for this size, in cm. Both or neither.
  height_min_cm: number | null;
  height_max_cm: number | null;
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
  // "Скидка −30%" on the whole product; null when none.
  discount_percent: number | null;
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
  discount_percent: number | null;
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

// --- Orders and payment -------------------------------------------------------

export type PaymentMethod = 'mbank' | 'optima' | 'obank';
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'accepted'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded';
// The path of a paid order, in order.
export const ORDER_STEPS: OrderStatus[] = ['paid', 'accepted', 'shipped', 'completed'];

export interface PaymentOptions {
  enabled: boolean;
  // True while payments are simulated and no money moves.
  test_mode: boolean;
  methods: { code: PaymentMethod; name: string }[];
}

export type DeliveryMethod = 'pickup' | 'delivery';

export interface OrderItem {
  product_id: string | null;
  title: string;
  size_label: string | null;
  color_name: string | null;
  image_url: string | null;
  // Price of one piece.
  price_minor: number;
  quantity: number;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  items: OrderItem[];
  items_minor: number;
  delivery_method: DeliveryMethod;
  delivery_address: string | null;
  // null: the store names the delivery price when it contacts the buyer.
  delivery_fee_minor: number | null;
  // What is paid online.
  total_minor: number;
  store_name: string;
  store_slug: string;
  payment_method: PaymentMethod;
  payment_method_name: string;
  test_mode: boolean;
  created_at: string;
  paid_at: string | null;
  // Why a paid order was called off, if it was.
  closing_note: string | null;
  can_cancel: boolean;
}

// One size and colour of a product in the cart, and how many.
export interface CartItem {
  variantId: string;
  quantity: number;
}

export interface CartLine {
  variant_id: string;
  product_id: string;
  title: string;
  size_label: string | null;
  color_name: string | null;
  image_url: string | null;
  price_minor: number;
  quantity: number;
  // False when this size and colour cannot be bought now; `problem` is an error code.
  available: boolean;
  problem: string | null;
  // The most that can be bought, when the store counts its stock.
  max_quantity: number | null;
}

export interface CartStore {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  pickup_available: boolean;
  delivery_available: boolean;
  // null: the store names the delivery price itself. 0: free.
  delivery_fee_minor: number | null;
  delivery_areas: string | null;
  delivery_time: string | null;
  address: string | null;
  lines: CartLine[];
  items_minor: number;
}

export interface Cart {
  stores: CartStore[];
  // Lines that are no longer in the catalog.
  missing: string[];
}

export interface MerchantOrder extends Order {
  buyer_name: string;
  buyer_phone: string;
}
