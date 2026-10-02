'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Camera, Heart, Search, Store, User } from 'lucide-react';
import { audienceLabels, catalogHref } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { cn } from '@/lib/utils';

const desktopLinks = [
  { href: '/stores', label: 'Магазины', icon: Store },
  { href: '/favorites', label: 'Избранное', icon: Heart },
  { href: '/profile', label: 'Профиль', icon: User },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { state, catalog } = useApp();
  const audiences = catalog?.audiences ?? [];
  const categories = catalog?.categories ?? [];
  const [query, setQuery] = useState('');

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    router.push(catalogHref({ query }));
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3 md:gap-6">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-gray-900 shrink-0">
          Top<span className="text-blue-600">Wear</span>
        </Link>

        <form onSubmit={submitSearch} role="search" className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Куртка, худи, Nike…"
            aria-label="Поиск по каталогу"
            className="w-full h-10 rounded-full bg-gray-100 pl-9 pr-4 text-base md:text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
          />
        </form>

        <nav className="hidden md:flex items-center gap-1 ml-auto">
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
              {label}
              {href === '/favorites' && state.favorites.length > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                  {state.favorites.length}
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/search"
            className="ml-2 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Camera className="w-4 h-4" />
            Найти по фото
          </Link>
        </nav>
      </div>

      <nav
        aria-label="Разделы каталога"
        className="mx-auto max-w-6xl px-4 flex items-center gap-1 overflow-x-auto md:overflow-visible [scrollbar-width:none]"
      >
        {audiences.map(({ code: audience }) => (
          <div key={audience} className="group relative shrink-0">
            <Link
              href={catalogHref({ audience })}
              className="block px-3 py-2.5 text-sm font-semibold text-gray-900 border-b-2 border-transparent hover:border-gray-900"
            >
              {audienceLabels[audience]}
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
        {categories.slice(0, 6).map((category) => (
          <Link
            key={category.code}
            href={catalogHref({ category: category.code })}
            className="shrink-0 px-3 py-2.5 text-sm text-gray-600 border-b-2 border-transparent hover:border-gray-400 hover:text-gray-900"
          >
            {category.name}
          </Link>
        ))}
        <Link
          href="/catalog"
          className="shrink-0 px-3 py-2.5 text-sm text-gray-600 border-b-2 border-transparent hover:border-gray-400 hover:text-gray-900"
        >
          Весь каталог
        </Link>
      </nav>
    </header>
  );
}
