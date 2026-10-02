'use client';

import { Info } from 'lucide-react';
import { useApp } from '@/lib/context';

// Spec: demo items must be marked and never presented as live store offers.
export function DemoNotice() {
  const { t } = useApp();
  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <p>{t('demo.notice')}</p>
    </div>
  );
}
