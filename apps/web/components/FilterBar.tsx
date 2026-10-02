'use client';

import { useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ALL, sliderMaxSom, sortLabels } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { SortOrder } from '@/lib/types';
import { useCatalogFilter } from '@/lib/useCatalogFilter';

interface Option {
  value: string;
  label: string;
}

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? ALL)}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterBar() {
  const { filter, setFilter, resetFilter, activeCount } = useCatalogFilter();
  const { catalog, t } = useApp();
  const sortItems: Option[] = (Object.keys(sortLabels) as SortOrder[]).map((sort) => ({
    value: sort,
    label: t(`sort.${sort}`),
  }));

  // The choices come from what the catalog actually contains.
  const audienceItems: Option[] = [
    { value: ALL, label: t('audience.all') },
    ...(catalog?.audiences ?? []).map(({ code }) => ({ value: code, label: t(`audience.${code}`) })),
  ];
  const categoryItems: Option[] = [
    { value: ALL, label: t('filter.allCategories') },
    ...(catalog?.categories ?? []).map(({ code, name }) => ({ value: code, label: name })),
  ];
  const storeItems: Option[] = [
    { value: ALL, label: t('filter.allStores') },
    ...(catalog?.stores ?? []).map(({ slug, name }) => ({ value: slug, label: name })),
  ];
  const colorItems: Option[] = [
    { value: ALL, label: t('filter.anyColor') },
    ...(catalog?.colors ?? []).map(({ code, name }) => ({ value: code, label: name })),
  ];
  const sizeLabels = Array.from(new Set((catalog?.sizes ?? []).map((size) => size.label)));
  const sizeItems: Option[] = [
    { value: ALL, label: t('filter.allSizes') },
    ...sizeLabels.map((label) => ({ value: label, label })),
  ];
  const maxPriceSom = sliderMaxSom(catalog?.price_max_minor ?? 0);
  const maxPrice = Math.min(filter.maxPrice ?? maxPriceSom, maxPriceSom);
  // While a handle is dragged the label follows it; the filter (and the request
  // to the server) changes only when the handle is released.
  const [priceDraft, setPriceDraft] = useState<[number, number] | null>(null);
  const priceRange = priceDraft ?? [Math.min(filter.minPrice, maxPrice), maxPrice];
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="border-t border-gray-200">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t('filter.title')}
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
        {activeCount > 0 && (
          <button
            onClick={resetFilter}
            aria-label={t('filter.resetAll')}
            className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{t('filter.reset')}</span>
          </button>
        )}
        <div className="ml-auto min-w-0 flex-1 max-w-44">
          <Select
            items={sortItems}
            value={filter.sort}
            onValueChange={(sort) => setFilter({ sort: (sort ?? 'default') as SortOrder })}
          >
            <SelectTrigger className="w-full" aria-label={t('filter.sort')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showFilters && (
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <FilterSelect
              label={t('filter.audience')}
              items={audienceItems}
              value={filter.audience}
              onChange={(audience) => setFilter({ audience })}
            />
            <FilterSelect
              label={t('filter.category')}
              items={categoryItems}
              value={filter.category}
              onChange={(category) => setFilter({ category })}
            />
            <FilterSelect
              label={t('filter.store')}
              items={storeItems}
              value={filter.store}
              onChange={(store) => setFilter({ store })}
            />
            <FilterSelect
              label={t('filter.color')}
              items={colorItems}
              value={filter.color}
              onChange={(color) => setFilter({ color })}
            />
            <FilterSelect
              label={t('filter.size')}
              items={sizeItems}
              value={filter.size || ALL}
              onChange={(size) => setFilter({ size: size === ALL ? '' : size })}
            />
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {t('filter.price', {
                  min: priceRange[0].toLocaleString('ru-RU'),
                  max: priceRange[1].toLocaleString('ru-RU'),
                })}
              </label>
              <div className="h-8 flex items-center px-2">
                <Slider
                  min={0}
                  max={maxPriceSom}
                  step={500}
                  value={priceRange}
                  onValueChange={(value) => {
                    if (Array.isArray(value)) setPriceDraft([value[0], value[1]]);
                  }}
                  onValueCommitted={(value) => {
                    if (!Array.isArray(value)) return;
                    // The top of the slider means "no upper limit".
                    setFilter({
                      minPrice: value[0],
                      maxPrice: value[1] >= maxPriceSom ? null : value[1],
                    });
                    setPriceDraft(null);
                  }}
                  className="w-full"
                />
              </div>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 md:self-end md:pb-1.5">
              <input
                type="checkbox"
                checked={filter.inStock}
                onChange={(event) => setFilter({ inStock: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t('filter.inStockOnly')}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
