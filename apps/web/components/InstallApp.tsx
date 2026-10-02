'use client';

import { useEffect } from 'react';

// Registers the service worker that makes the site installable on a phone.
// Only on the real site: during development it would get in the way of live reloading.
export function InstallApp() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without it the site works the same; it only cannot be installed.
    });
  }, []);
  return null;
}
