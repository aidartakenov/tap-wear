import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getProduct } from '@/lib/api';
import { formatPrice } from '@/lib/catalog';
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { ProductDetail } from '@/lib/types';

// The page itself is drawn in the browser. This server part gives search engines
// and link previews the product's name, price and photo.

async function load(id: string): Promise<ProductDetail | null> {
  const locale = parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  return getProduct(id, undefined, locale).catch(() => null);
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await load(params.id);
  if (!product) return {};
  const title = `${product.title} — ${formatPrice(product.price_minor, product.price_varies)} · ${product.store.name}`;
  const description = (
    product.description ?? `${product.category.name}. ${product.store.name}, ${product.store.city.name}.`
  ).slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/products/${product.id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/products/${product.id}`,
      images: product.images.slice(0, 1),
      type: 'website',
    },
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const product = await load(params.id);
  // Structured data: lets a search engine show the price and availability in its results.
  const data = product && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images,
    description: product.description ?? undefined,
    category: product.category.name,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/products/${product.id}`,
      priceCurrency: 'KGS',
      price: (product.price_minor / 100).toFixed(2),
      availability:
        product.availability === 'out_of_stock'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: product.store.name },
    },
  };
  return (
    <>
      {data && (
        <script
          type="application/ld+json"
          // "<" is escaped so that text from a product can never close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
        />
      )}
      {children}
    </>
  );
}
