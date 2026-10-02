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

  // Sorting is not a filter; price min and max count as one.
  const keys = ['query', 'audience', 'category', 'store', 'color', 'size', 'inStock'] as const;
  const activeCount =
    keys.filter((key) => filter[key] !== defaultFilter[key]).length +
    (filter.minPrice > 0 || filter.maxPrice != null ? 1 : 0) +
    (filter.height != null ? 1 : 0);

  return { filter, setFilter, resetFilter, activeCount };
}
