'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bookmark,
  Camera,
  CircleUserRound,
  Moon,
  Search,
  ShoppingCart,
  Store,
  Sun,
} from 'lucide-react';
import { ActionLink } from '@/components/ActionLink';
import { hasBottomNavigation } from '@/components/BottomNavigation';
import { Logo } from '@/components/Logo';
import { catalogHref } from '@/lib/catalog';
import { Key, LOCALES, localeNames } from '@/lib/i18n';
import { useApp } from '@/lib/context';
import { cn } from '@/lib/utils';

const desktopLinks: { href: string; label: Key; icon: typeof Search }[] = [
  { href: '/stores', label: 'nav.stores', icon: Store },
  { href: '/favorites', label: 'nav.favorites', icon: Bookmark },
  { href: '/profile', label: 'nav.profile', icon: CircleUserRound },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { favorites, catalog, me, t, locale, setLocale, dark, setDark, cartCount } = useApp();
  const audiences = catalog?.audiences ?? [];
  const categories = catalog?.categories ?? [];
  const [query, setQuery] = useState('');

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    router.push(catalogHref({ query }));
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-2 sm:gap-3 md:gap-6">
        <Link href="/" aria-label="TapWear" className="shrink-0">
          <Logo />
        </Link>

        <form onSubmit={submitSearch} role="search" className="relative min-w-20 flex-1 sm:min-w-40 md:max-w-md md:mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.label')}
            className="w-full h-10 rounded-full bg-gray-100 pl-9 pr-4 text-base md:text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
          />
        </form>

        <div
          role="group"
          aria-label={t('nav.language')}
          className="flex shrink-0 overflow-hidden rounded-full border border-gray-300 text-xs font-semibold"
        >
          {LOCALES.map((code) => (
            <button
              key={code}
              onClick={() => code !== locale && setLocale(code)}
              aria-pressed={code === locale}
              title={localeNames[code]}
              className={cn(
                'px-2.5 py-1.5 uppercase',
                code === locale ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {code === 'ky' ? 'KG' : 'RU'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDark(!dark)}
          aria-label={t(dark ? 'nav.lightTheme' : 'nav.darkTheme')}
          title={t(dark ? 'nav.lightTheme' : 'nav.darkTheme')}
          // On phones the switch lives in the profile; the row has room for the cart instead.
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition-colors hover:bg-gray-100 sm:flex md:-ml-3"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <Link
          href="/cart"
          aria-label={t('cart.title')}
          title={t('cart.title')}
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 transition-colors hover:bg-gray-100 md:-ml-3',
            pathname === '/cart' ? 'text-blue-600' : 'text-gray-700'
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {desktopLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium hover:bg-gray-100',
                pathname.startsWith(href) ? 'text-blue-600' : 'text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {/* Icons only on tablet widths, where the full labels do not fit. */}
              <span className="max-lg:sr-only">
                {href === '/profile' ? t(me ? 'nav.cabinet' : 'nav.signIn') : t(label)}
              </span>
              {href === '/favorites' && favorites.length > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                  {favorites.length}
                </span>
              )}
            </Link>
          ))}
          {/* Pages with the bar at the bottom have photo search there. */}
          {!hasBottomNavigation(pathname) && (
            <ActionLink href="/search" icon={Camera} size="sm" className="ml-2">
              {t('nav.photoSearch')}
            </ActionLink>
          )}
        </nav>
      </div>

      <nav
        aria-label={t('nav.sections')}
        className="mx-auto max-w-6xl px-4 flex items-center gap-1 overflow-x-auto md:overflow-visible [scrollbar-width:none]"
      >
        {audiences.map(({ code: audience }) => (
          <div key={audience} className="group relative shrink-0">
            <Link
              href={catalogHref({ audience })}
              className="block px-3 py-2.5 text-sm font-semibold text-gray-900 border-b-2 border-transparent hover:border-gray-900"
            >
              {t(`audience.${audience}`)}
            </Link>
            {/* Category list on hover; desktop only, phones go straight to the catalog. */}
            <div className="absolute left-0 top-full z-50 hidden w-56 rounded-b-lg border border-gray-200 bg-white py-2 shadow-lg md:group-hover:block md:group-focus-within:block">
              {categories.flatMap((category) => {
                const count = category.by_audience.find((entry) => entry.audience === audience);
                if (!count) return [];
                return (
                  <Link
                    key={category.code}
                    href={catalogHref({ audience, category: category.code })}
                    className="flex items-center justify-between px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {category.name}
                    <span className="text-xs text-gray-400">{count.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {audiences.length > 0 && (
          <span className="mx-1 h-4 w-px shrink-0 bg-gray-300" aria-hidden />
        )}
        {categories.slice(0, 6).map((category, index) => (
          <Link
            key={category.code}
            href={catalogHref({ category: category.code })}
            className={cn(
              'shrink-0 px-3 py-2.5 text-sm text-gray-600 border-b-2 border-transparent hover:border-gray-400 hover:text-gray-900',
              // Phones scroll this row sideways; wider screens cannot (the hover menus
              // need visible overflow), so narrower ones show fewer shortcuts.
              index >= 4 ? 'md:max-xl:hidden' : index >= 1 && 'md:max-lg:hidden'
            )}
          >
            {category.name}
          </Link>
        ))}
        <Link
          href="/catalog?sale=1"
          className="shrink-0 px-3 py-2.5 text-sm font-semibold text-red-600 border-b-2 border-transparent hover:border-red-400"
        >
          {t('nav.sale')}
        </Link>
        <Link
          href="/catalog"
          className="shrink-0 px-3 py-2.5 text-sm text-gray-600 border-b-2 border-transparent hover:border-gray-400 hover:text-gray-900"
        >
          {t('nav.allCatalog')}
        </Link>
      </nav>
    </header>
  );
}
