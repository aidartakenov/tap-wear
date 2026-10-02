'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Store, Camera, Heart, User } from 'lucide-react';
import { useApp } from '@/lib/context';
import { Key } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const navItems: { href: string; label: Key; icon: typeof User; isCenter?: boolean }[] = [
  { href: '/catalog', label: 'nav.catalog', icon: LayoutGrid },
  { href: '/stores', label: 'nav.stores', icon: Store },
  { href: '/search', label: 'nav.photoShort', icon: Camera, isCenter: true },
  { href: '/favorites', label: 'nav.favorites', icon: Heart },
  { href: '/profile', label: 'nav.profile', icon: User },
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
                <div className="absolute -top-6 bg-blue-600 rounded-full p-3 shadow-lg">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs mt-8 font-medium">{t(item.label)}</span>
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
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">{t(item.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
