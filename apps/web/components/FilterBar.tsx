'use client';

import { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { categories, colors } from '@/lib/mockData';
import { useApp } from '@/lib/context';

export function FilterBar() {
  const { state, setFilter } = useApp();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="border-t border-gray-200">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFilters(!showFilters)}
        className="w-full justify-between px-4 py-2 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Фильтры</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
        />
      </Button>

      {showFilters && (
        <div className="px-4 py-3 space-y-4 bg-gray-50">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Категория
            </label>
            <Select
              value={state.filter.category}
              onValueChange={(value) => setFilter({ category: value || 'Все' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Цвет
            </label>
            <Select
              value={state.filter.color}
              onValueChange={(value) => setFilter({ color: value || 'Все' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colors.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Цена: {state.filter.minPrice} - {state.filter.maxPrice} сом
            </label>
            <Slider
              min={0}
              max={20000}
              step={500}
              value={[state.filter.minPrice, state.filter.maxPrice]}
              onValueChange={(value) => {
                const minPrice = Array.isArray(value) ? value[0] : value;
                const maxPrice = Array.isArray(value) ? value[1] : state.filter.maxPrice;
                setFilter({ minPrice, maxPrice });
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Размер
            </label>
            <Select
              value={state.filter.size}
              onValueChange={(value) => setFilter({ size: value || '' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Все размеры" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все размеры</SelectItem>
                <SelectItem value="S">S</SelectItem>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="L">L</SelectItem>
                <SelectItem value="XL">XL</SelectItem>
                <SelectItem value="42">42 (RU)</SelectItem>
                <SelectItem value="44">44 (RU)</SelectItem>
                <SelectItem value="46">46 (RU)</SelectItem>
                <SelectItem value="48">48 (RU)</SelectItem>
                <SelectItem value="50">50 (RU)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
