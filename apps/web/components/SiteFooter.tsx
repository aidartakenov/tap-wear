'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hasBottomNavigation } from '@/components/BottomNavigation';
import { useApp } from '@/lib/context';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/about', key: 'footer.about' },
  { href: '/faq', key: 'footer.faq' },
  { href: '/help/sellers', key: 'footer.sellers' },
  { href: '/size-guide', key: 'footer.sizeGuide' },
  { href: '/terms', key: 'footer.terms' },
  { href: '/privacy', key: 'footer.privacy' },
] as const;

export function SiteFooter() {
  const { t } = useApp();
  // Pages with the bottom bar need room under the footer, so the bar does not cover it.
  const withBar = hasBottomNavigation(usePathname());
  return (
    <footer className={cn('border-t border-gray-200 bg-white', withBar ? 'pb-28 md:pb-32' : 'pb-6')}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-6 md:flex-row md:items-center md:justify-between">
        <nav aria-label={t('footer.label')} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-gray-600 hover:text-gray-900 hover:underline">
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} TapWear</p>
      </div>
    </footer>
  );
}
