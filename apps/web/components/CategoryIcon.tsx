import { cn } from '@/lib/utils';

// Line drawings of garment types, one per catalog category (see CATEGORY_NAMES_RU
// in the API's seed), in the same style as the other icons: 24px grid, rounded
// strokes. Each entry is a list of SVG paths.
const LONG_SLEEVES = 'M8.5 3 4 5.5 2.5 17H6v4h12v-4h3.5L20 5.5 15.5 3';
const SLEEVE_SEAMS = 'M6 17V9.5M18 17V9.5';
const LONG_COAT = 'M8.5 2.5 4.5 5 3 15h3v7h12v-7h3L19.5 5l-4-2.5';
const COAT_SEAMS = 'M6 15V9M18 15V9';
const SUIT_JACKET = 'M8.5 3 4.5 5.5 3 16h3v5h12v-5h3L19.5 5.5l-4-2.5';
const SUIT_SEAMS = 'M6 16V9.5M18 16V9.5';

const icons: Record<string, string[]> = {
  tshirts: [
    'M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z',
  ],
  shirts: [
    'M8 3 4 5 2.5 10.5 6 11.5V21h12v-9.5l3.5-1L20 5l-4-2',
    'M8 3l4 4 4-4',
    'M12 7v14',
    'M12 11h.01M12 14.5h.01M12 18h.01',
  ],
  hoodies: [
    LONG_SLEEVES,
    SLEEVE_SEAMS,
    'M8.5 3c0 3 1.5 5 3.5 5s3.5-2 3.5-5',
    'M8.5 3c1-1.3 2.2-2 3.5-2s2.5.7 3.5 2',
    'M9 21v-4h6v4',
    'M11 8v3M13 8v3',
  ],
  knitwear: [
    LONG_SLEEVES,
    SLEEVE_SEAMS,
    'M8.5 3c.7 1.5 2 2.3 3.5 2.3s2.8-.8 3.5-2.3',
    'M6 18.5h12',
    'M9 9l1.5 1.5L12 9l1.5 1.5L15 9M9 12.5l1.5 1.5 1.5-1.5 1.5 1.5 1.5-1.5',
  ],
  jackets: [LONG_SLEEVES, SLEEVE_SEAMS, 'M8.5 3 12 6l3.5-3', 'M12 6v15', 'M8 15.5h2M14 15.5h2'],
  coats: [
    LONG_COAT,
    COAT_SEAMS,
    'M8.5 2.5 12 9l3.5-6.5',
    'M12 9v13',
    'M6 14h12',
    'M10 17h.01M10 19.5h.01',
  ],
  fur: [
    LONG_COAT,
    COAT_SEAMS,
    // A fluffy collar and hem.
    'M8.5 2.5c-1.2 1.6-.6 3.2 1 3.6.2 1.5 1.2 2.4 2.5 2.4s2.3-.9 2.5-2.4c1.6-.4 2.2-2 1-3.6',
    'M12 8.5v10.5',
    'M6 19c1 1 2 1 3 0 1 1 2 1 3 0 1 1 2 1 3 0 1 1 2 1 3 0',
  ],
  vests: [
    'M8 3c0 3-1.5 5-3 6v12h14V9c-1.5-1-3-3-3-6',
    'M8 3l4 6 4-6',
    'M12 9v12',
    'M7.5 16H10M14 16h2.5',
  ],
  blazers: [
    SUIT_JACKET,
    SUIT_SEAMS,
    'M8.5 3 12 12.5 15.5 3',
    'M12 12.5V21',
    'M14.5 16h2',
    'M12 15.5h.01',
  ],
  suits: [
    SUIT_JACKET,
    SUIT_SEAMS,
    'M8.5 3 12 13l3.5-10',
    'M12 13v8',
    'M11 4h2l-.4 1.5L13 9l-1 1.5L11 9l.4-3.5z',
  ],
  trousers: ['M7 3h10l1.5 18h-5L12 9l-1.5 12h-5z', 'M6.8 6h10.4', 'M12 6v3'],
  shorts: ['M6 5h12l1.5 12h-6L12 11l-1.5 6h-6z', 'M5.7 8h12.6', 'M12 8v3'],
  dresses: [
    'M9 2.5V5c0 1.5-.5 2.8-1 4l-4 12.5h16L16 9c-.5-1.2-1-2.5-1-4V2.5',
    'M9 5c1 1.6 5 1.6 6 0',
    'M8 9h8',
  ],
  sportswear: [
    // A sleeveless jersey with a stripe.
    'M8 2.5V5c0 2-1 3.5-3 4.5V21h14V9.5c-2-1-3-2.5-3-4.5V2.5',
    'M8 3.5c0 2.2 1.8 4 4 4s4-1.8 4-4',
    'M5 17 19 12',
    'M5 20 19 15',
  ],
  underwear: ['M10 3h6v10l-5.5 5.5a2.8 2.8 0 0 1-4-4L10 11z', 'M10 6.5h6', 'M7.5 13.5l4 4'],
  shoes: [
    'M2.5 18.5v-9l2.5-1 1 1c1 1 2 1 3 .5l2-1 4 4.5 4.5 1.2c1.2.3 2 1.1 2 2.3v1.5z',
    'M2.5 15.5h19',
    'M11.8 9.8l-1.2 1.2M13.6 11.8l-1.2 1.2',
  ],
  bags: ['M5 8h14l1.5 13h-17z', 'M9 8V6a3 3 0 0 1 6 0v2', 'M12 12v2'],
  headwear: ['M5 14.5a7 7 0 0 1 14 0v1H5z', 'M19 15.5h2a1.5 1.5 0 0 1 0 3h-8', 'M12 7.5v-1'],
  accessories: [
    // Glasses.
    'M2.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
    'M14.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
    'M9.5 13c.8-1.2 4.2-1.2 5 0',
    'M2.5 13 4 7M21.5 13 20 7',
  ],
  national: [
    // A kalpak.
    'M7 15 9.5 5.5c.6-2 4.4-2 5 0L17 15',
    'M3.5 15h17l-2 4h-13z',
    'M12 4V2.5',
    'M12 8v4M10.5 10h3',
  ],
};

// A coat hanger, for a category without a drawing of its own.
const fallback = ['M10 5a2 2 0 1 1 2 2v2', 'M12 9l8.5 6.5a1 1 0 0 1-.6 1.8H4.1a1 1 0 0 1-.6-1.8z'];

export function CategoryIcon({ code, className }: { code: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('h-10 w-10', className)}
    >
      {(icons[code] ?? fallback).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
