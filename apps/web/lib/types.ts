export type UserRole = 'guest' | 'buyer' | 'store_owner' | 'admin';

export type SizeSystem = 'RU' | 'EU' | 'Letter';

export interface Size {
  system: SizeSystem;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  priceRange?: string;
  category: string;
  color: string;
  sizes: Size[];
  images: string[];
  description: string;
  seller: {
    id: string;
    name: string;
    contact: string;
    whatsapp?: string;
    instagram?: string;
  };
  bodyMeasurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    shoulders?: number;
    sleeve?: number;
  };
  garmentMeasurements: {
    length: number;
    chest: number;
    waist: number;
    hips?: number;
    sleeve?: number;
  };
  similarityScore?: number;
}

export interface Store {
  id: string;
  name: string;
  market: string;
  sector: string;
  containerNumber: string;
  categories: string[];
  contact: string;
  whatsapp?: string;
  instagram?: string;
  rating: number;
}

export interface FilterState {
  category: string;
  minPrice: number;
  maxPrice: number;
  color: string;
  size: string;
}

export interface AppState {
  favorites: string[];
  cart: string[];
  userRole: UserRole;
  filter: FilterState;
}
