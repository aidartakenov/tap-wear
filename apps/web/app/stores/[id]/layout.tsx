import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getStore } from '@/lib/api';
import { LOCALE_COOKIE, countLabel, parseLocale } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';

// Gives search engines and link previews the shop's name, description and picture.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const locale = parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  const store = await getStore(params.id, undefined, locale).catch(() => null);
  if (!store) return {};
  const title = `${store.name} — TapWear`;
  const description = (
    store.description ??
    `${store.city.name}${store.address ? `, ${store.address}` : ''}. ${countLabel(locale, store.product_count, 'product')}.`
  ).slice(0, 200);
  const image = store.avatar_url ?? store.preview_images[0];
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stores/${store.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/stores/${store.slug}`,
      images: image ? [image] : [],
      type: 'website',
    },
  };
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
