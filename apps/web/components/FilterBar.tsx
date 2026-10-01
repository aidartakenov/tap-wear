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
import {
  ALL,
  audienceLabels,
  audienceOptions,
  categoryOptions,
  maxPriceSom,
  sizeOptions,
  sortLabels,
  stores,
} from '@/lib/catalog';
import { SortOrder } from '@/lib/types';
import { useCatalogFilter } from '@/lib/useCatalogFilter';

interface Option {
  value: string;
  label: string;
}

const audienceItems: Option[] = [
  { value: ALL, label: 'Для всех' },
  ...audienceOptions.map((audience) => ({ value: audience, label: audienceLabels[audience] })),
];
const categoryItems: Option[] = [{ value: ALL, label: 'Все категории' }, ...categoryOptions];
const storeItems: Option[] = [
  { value: ALL, label: 'Все магазины' },
  ...stores.map((store) => ({ value: store.id, label: store.name })),
];
const sizeItems: Option[] = [
  { value: ALL, label: 'Все размеры' },
  ...sizeOptions.map((size) => ({ value: size, label: size })),
];
const sortItems: Option[] = (Object.keys(sortLabels) as SortOrder[]).map((sort) => ({
  value: sort,
  label: sortLabels[sort],
}));

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
          Фильтры
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
            aria-label="Сбросить фильтры"
            className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Сбросить</span>
          </button>
        )}
        <div className="ml-auto min-w-0 flex-1 max-w-44">
          <Select
            items={sortItems}
            value={filter.sort}
            onValueChange={(sort) => setFilter({ sort: (sort ?? 'default') as SortOrder })}
          >
            <SelectTrigger className="w-full" aria-label="Сортировка">
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
          <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-3">
            <FilterSelect
              label="Для кого"
              items={audienceItems}
              value={filter.audience}
              onChange={(audience) => setFilter({ audience })}
            />
            <FilterSelect
              label="Категория"
              items={categoryItems}
              value={filter.category}
              onChange={(category) => setFilter({ category })}
            />
            <FilterSelect
              label="Магазин"
              items={storeItems}
              value={filter.storeId}
              onChange={(storeId) => setFilter({ storeId })}
            />
            <FilterSelect
              label="Размер"
              items={sizeItems}
              value={filter.size || ALL}
              onChange={(size) => setFilter({ size: size === ALL ? '' : size })}
            />
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Цена: {filter.minPrice.toLocaleString('ru-RU')} –{' '}
                {filter.maxPrice.toLocaleString('ru-RU')} сом
              </label>
              <div className="h-8 flex items-center px-2">
                <Slider
                  min={0}
                  max={maxPriceSom}
                  step={500}
                  value={[filter.minPrice, filter.maxPrice]}
                  onValueChange={(value) => {
                    const minPrice = Array.isArray(value) ? value[0] : value;
                    const maxPrice = Array.isArray(value) ? value[1] : filter.maxPrice;
                    setFilter({ minPrice, maxPrice });
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
