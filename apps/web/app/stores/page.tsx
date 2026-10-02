'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Search, X } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorState, Loading } from '@/components/PageState';
import { StoreCard } from '@/components/StoreCard';
import { getStores } from '@/lib/api';
import { useApp } from '@/lib/context';
import { STORE_AUDIENCES, StoreAudience } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { cn } from '@/lib/utils';

// Typing waits this long before the list is searched again.
const SEARCH_DELAY_MS = 300;

const audienceFrom = (value: string | null): StoreAudience | null =>
  STORE_AUDIENCES.find((audience) => audience === value) ?? null;

function StoreSearch() {
  const { t } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The choice and the search text live in the URL, so they survive going back
  // from a store page and can be shared.
  const chosen = audienceFrom(params.get('audience'));
  const query = params.get('q') ?? '';
  const [text, setText] = useState(query);

  const show = (audience: StoreAudience | null, search: string) => {
    const next = new URLSearchParams();
    if (audience) next.set('audience', audience);
    if (search.trim()) next.set('q', search.trim());
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      // Read the address at this moment: a choice or a reset made while the
      // timer was running must not be undone by it.
      const current = new URLSearchParams(window.location.search);
      if ((current.get('q') ?? '') === text.trim()) return;
      show(audienceFrom(current.get('audience')), text);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only typing restarts the timer
  }, [text]);

  const { data, error, loading } = useApi(
    (signal) => getStores({ audience: chosen ?? undefined, query }, signal),
    [chosen, query]
  );
  const stores = data?.items ?? [];
  const filtered = chosen !== null || query !== '';

  const reset = () => {
    setText('');
    show(null, '');
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 space-y-4">
      <section className="space-y-3">
        <div role="group" aria-label={t('stores.audience')} className="grid grid-cols-3 gap-2 md:gap-3">
          {STORE_AUDIENCES.map((audience) => {
            const active = chosen === audience;
            return (
              <button
                key={audience}
                // A second tap on the chosen option shows all stores again.
                onClick={() => show(active ? null : audience, text)}
                aria-pressed={active}
                className={cn(
                  'relative flex h-16 items-center justify-center rounded-2xl border text-base font-extrabold tracking-tight transition-all active:scale-[0.98] md:h-20 md:text-xl',
                  active
                    ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-900'
                )}
              >
                {t(`storeAudience.${audience}`)}
                {active && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div role="search" className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('stores.searchPlaceholder')}
            aria-label={t('stores.searchLabel')}
            maxLength={100}
            className="h-12 w-full rounded-full border border-gray-200 bg-white pl-11 pr-11 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              onClick={() => setText('')}
              aria-label={t('stores.clearSearch')}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {error ? (
        <ErrorState error={error} />
      ) : loading && !data ? (
        <Loading />
      ) : stores.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">{t(filtered ? 'stores.nothingFound' : 'stores.empty')}</p>
          {filtered && (
            <button onClick={reset} className="mt-3 text-sm font-medium text-blue-600 hover:underline">
              {t('stores.reset')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
      {stores.some((store) => store.is_demo) && <DemoNotice />}
    </main>
  );
}

export default function StoresPage() {
  const { t } = useApp();
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.stores')}</h1>
        </div>
      </header>

      {/* useSearchParams needs a Suspense boundary for the production build. */}
      <Suspense>
        <StoreSearch />
      </Suspense>

      <BottomNavigation />
    </div>
  );
}
