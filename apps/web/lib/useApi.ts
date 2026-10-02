'use client';

import { DependencyList, useEffect, useState } from 'react';
import { ApiError } from './api';

interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

// Runs an API request when the dependencies change. A request that is still in
// flight when they change again is aborted, so a slow old response can never
// overwrite a newer one.
export function useApi<T>(
  request: (signal: AbortSignal) => Promise<T>,
  dependencies: DependencyList
): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: null, loading: true }));
    request(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        const apiError =
          error instanceof ApiError ? error : new ApiError(0, 'error', 'Что-то пошло не так');
        setState({ data: null, error: apiError, loading: false });
      });
    return () => controller.abort();
    // The caller lists what the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return state;
}
