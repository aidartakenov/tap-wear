export type UserRole = 'guest' | 'buyer' | 'store_owner' | 'admin';

export type Audience = 'men' | 'women' | 'kids' | 'unisex';

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export type SortOrder = 'default' | 'price_asc' | 'price_desc';

export interface Store {
  id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  workingHours: string | null;
  phone: string;
  whatsapp: string | null;
  instagram: string | null;
  website: string;
}

export interface Product {
  id: string;
  storeId: string;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  audience: Audience;
  // Integer amount in the currency's minor unit (tyiyn for KGS). Never a float.
  priceMinor: number;
  currency: 'KGS';
  color: string | null;
  brand: string | null;
  sku: string | null;
  // The seller's own size system (e.g. TR, INT); null when the seller gave no sizes.
  sizeSystem: string | null;
  sizes: string[];
  availability: Availability;
  images: string[];
  sourceUrl: string;
}

// Catalog filters. They live in the URL query string, so a filtered view can be shared.
export interface FilterState {
  query: string;
  audience: string;
  category: string;
  storeId: string;
  minPrice: number;
  maxPrice: number;
  size: string;
  sort: SortOrder;
}

export interface AppState {
  favorites: string[];
  userRole: UserRole;
}
