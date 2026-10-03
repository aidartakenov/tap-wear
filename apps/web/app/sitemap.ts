import type { MetadataRoute } from 'next';
import { getProducts, getStores } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

// Read on every request: the list follows the catalog as sellers change it.
export const dynamic = 'force-dynamic';

// Every public page a search engine should know about.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    '',
    '/catalog',
    '/stores',
    '/size-guide',
    '/about',
    '/faq',
    '/help/sellers',
    '/terms',
    '/privacy',
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'daily',
  }));
  try {
    const stores = await getStores({}, undefined, 'ru');
    for (const store of stores.items) {
      pages.push({ url: `${SITE_URL}/stores/${store.slug}`, changeFrequency: 'daily' });
    }
    // The catalog is read page by page; a very large one is cut off at 5 000 products.
    let cursor: string | null = null;
    for (let page = 0; page < 50; page++) {
      const batch = await getProducts({ cursor, limit: 100 }, undefined, 'ru');
      for (const product of batch.items) {
        pages.push({ url: `${SITE_URL}/products/${product.id}`, changeFrequency: 'weekly' });
      }
      cursor = batch.next_cursor;
      if (!cursor) break;
    }
  } catch {
    // The API is down: the fixed pages are still listed.
  }
  return pages;
}
