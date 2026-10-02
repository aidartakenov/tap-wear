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

export function BottomNavigation() {
  const pathname = usePathname();
  const { t } = useApp();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
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
  );
}
