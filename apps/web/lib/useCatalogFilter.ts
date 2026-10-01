'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { defaultFilter, filterFromParams, filterToQuery } from './catalog';
import { FilterState } from './types';

// The catalog filter is read from and written to the URL query string.
export function useCatalogFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => filterFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const setFilter = useCallback(
    (change: Partial<FilterState>) => {
      const query = filterToQuery({ ...filter, ...change });
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [filter, pathname, router]
  );

  const resetFilter = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const activeCount = (Object.keys(defaultFilter) as (keyof FilterState)[]).filter(
    (key) => key !== 'sort' && filter[key] !== defaultFilter[key]
  ).length;

  return { filter, setFilter, resetFilter, activeCount };
}
