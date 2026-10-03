import { cookies } from 'next/headers';
import { BottomNavigation } from '@/components/BottomNavigation';
import { FaqGroups, Rich } from '@/components/FaqContent';
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n';
import { faq } from '@/lib/i18n/faq';

function text() {
  return faq[parseLocale(cookies().get(LOCALE_COOKIE)?.value)];
}

export function generateMetadata() {
  const page = text();
  return { title: `${page.title} — TapWear`, description: page.description };
}

export default function FaqPage() {
  const page = text();
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{page.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-700 md:text-lg">
          <Rich value={page.intro} />
        </p>
        <FaqGroups page={page} />
        <p className="mt-8 text-gray-700">
          <Rich value={page.more} />
        </p>
      </main>
      <BottomNavigation />
    </div>
  );
}
