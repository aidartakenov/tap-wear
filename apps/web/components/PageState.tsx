'use client';

import { AlertCircle } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useApp } from '@/lib/context';

export function Loading({ label }: { label?: string }) {
  const { t } = useApp();
  return (
    <div className="py-16 text-center" role="status">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      <p className="text-sm text-gray-500">{label ?? t('state.loading')}</p>
    </div>
  );
}

export function ErrorState({ error, notFound }: { error: ApiError; notFound?: string }) {
  const { t } = useApp();
  const isNotFound = error.status === 404 || error.status === 422;
  return (
    <div className="py-16 text-center" role="alert">
      <AlertCircle className="mx-auto mb-3 h-8 w-8 text-gray-400" />
      <p className="font-medium text-gray-900">
        {isNotFound && notFound ? notFound : t('state.loadError')}
      </p>
      {!isNotFound && (
        <>
          <p className="mt-1 text-sm text-gray-500">
            {t('state.checkConnection')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            {t('state.reload')}
          </button>
        </>
      )}
    </div>
  );
}

// Grey placeholders shown while a product grid loads.
export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="aspect-[3/4] animate-pulse bg-gray-200" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
