'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Camera, CircleUserRound, Shirt, Store } from 'lucide-react';
import { useApp } from '@/lib/context';
import { Key } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const navItems: { href: string; label: Key; icon: typeof Shirt; isCenter?: boolean }[] = [
  { href: '/catalog', label: 'nav.catalog', icon: Shirt },
  { href: '/stores', label: 'nav.stores', icon: Store },
  { href: '/search', label: 'nav.photoShort', icon: Camera, isCenter: true },
  { href: '/favorites', label: 'nav.favorites', icon: Bookmark },
  { href: '/profile', label: 'nav.profile', icon: CircleUserRound },
];

// The bar belongs to the first page and the five main sections only. Pages
// inside them (one shop, one product, the seller cabinet…) do not show it.
export function hasBottomNavigation(pathname: string): boolean {
  return pathname === '/' || navItems.some((item) => item.href === pathname);
}

export function BottomNavigation() {
  const pathname = usePathname();
  const { t } = useApp();

  // Phones: a bar along the bottom edge on every page. Wide screens: the same
  // bar floats at the bottom centre, except on the first page, which shows only
  // the photo search button there, since that is the heart of the project.
  const home = pathname === '/';
  if (!hasBottomNavigation(pathname)) return null;

  return (
    <>
      {home && (
        <Link
          href="/search"
          className="group fixed bottom-7 left-1/2 z-50 hidden h-16 -translate-x-1/2 items-center gap-4 rounded-full bg-gray-900 pl-3 pr-8 text-base font-semibold text-white shadow-[0_18px_50px_-12px_rgba(17,24,39,0.55)] ring-4 ring-white/80 transition-transform duration-200 hover:scale-[1.03] active:scale-95 md:inline-flex"
        >
          {/* The same tilted square as in the phone bar, in the brand blue. */}
          <span className="flex h-10 w-10 rotate-45 items-center justify-center rounded-xl bg-blue-600 transition-transform dark:bg-[#0b0f17]/35 duration-300 group-hover:rotate-[135deg]">
            <Camera className="h-5 w-5 -rotate-45 transition-transform duration-300 group-hover:rotate-[-135deg]" strokeWidth={2.25} />
          </span>
          {t('nav.photoSearch')}
        </Link>
      )}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white',
          home
            ? 'md:hidden'
            : 'md:bottom-6 md:left-1/2 md:right-auto md:w-[34rem] md:-translate-x-1/2 md:rounded-[1.75rem] md:border md:bg-white/90 md:px-4 md:shadow-[0_18px_50px_-12px_rgba(17,24,39,0.35)] md:backdrop-blur-md'
        )}
      >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center',
                  isActive ? 'text-blue-600' : 'text-gray-500'
                )}
              >
                {/* A dark blue square standing on its corner, with the icon kept upright. */}
                <div className="absolute -top-7 flex h-[52px] w-[52px] rotate-45 items-center justify-center rounded-2xl bg-gray-900 shadow-lg ring-4 ring-white transition-transform duration-200 active:scale-95">
                  <Icon className="h-6 w-6 -rotate-45 text-white" strokeWidth={2.25} />
                </div>
                <span className="mt-8 text-[11px] font-medium leading-tight">{t(item.label)}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              {/* The open page's icon sits in a soft blue pill. */}
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                  isActive && 'bg-blue-50'
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} />
              </span>
              <span className="text-[11px] font-medium leading-tight">{t(item.label)}</span>
            </Link>
          );
        })}
      </div>
      </nav>
    </>
  );
}
