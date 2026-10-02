'use client';

import { useEffect, useState } from 'react';

const KEY = 'tapwear.height';
// The same rules as the catalog's height filter (apps/api/app/catalog/queries.py).
export const HEIGHT_TOLERANCE_CM = 5;
export const KIDS_SIZE_STEP_CM = 6;

export function validHeight(value: unknown): number | null {
  const height = Number(value);
  return Number.isInteger(height) && height >= 50 && height <= 250 ? height : null;
}

// The buyer's own height, entered once and remembered on this device.
export function useMyHeight(): [number | null, (height: number | null) => void] {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    try {
      setHeight(validHeight(localStorage.getItem(KEY)));
    } catch {
      // Private mode: nothing remembered.
    }
  }, []);
  const save = (next: number | null) => {
    setHeight(next);
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {
      // Kept for this page only.
    }
  };
  return [height, save];
}

// Whether a size is meant for a person of this height.
export function sizeFitsHeight(
  height: number,
  size: { size_system: string | null; size_label: string | null; height_min_cm: number | null; height_max_cm: number | null }
): boolean {
  if (size.height_min_cm !== null && size.height_max_cm !== null) {
    return (
      size.height_min_cm - HEIGHT_TOLERANCE_CM <= height &&
      height <= size.height_max_cm + HEIGHT_TOLERANCE_CM
    );
  }
  // Children's sizes are named by height: "116" is for a child up to 116 cm.
  if (size.size_system === 'HEIGHT' && /^\d{2,3}$/.test(size.size_label ?? '')) {
    const label = Number(size.size_label);
    return label >= height && label - KIDS_SIZE_STEP_CM < height;
  }
  return false;
}
