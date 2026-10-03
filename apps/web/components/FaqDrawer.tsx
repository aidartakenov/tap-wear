'use client';

import { PointerEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, CircleHelp, X } from 'lucide-react';
import { hasBottomNavigation } from '@/components/BottomNavigation';
import { FaqGroups, Rich } from '@/components/FaqContent';
import { useApp } from '@/lib/context';
import { faq } from '@/lib/i18n/faq';
import { cn } from '@/lib/utils';

// How far a finger has to pull before the panel opens or closes.
const PULL = 40;

// Questions and answers on every page, tucked away as a small tab at the right
// edge near the bottom. A tap or a pull to the left slides the panel out; a pull
// to the right, the cross, Esc or a tap outside puts it back.
export function FaqDrawer() {
  const { locale } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const start = useRef<number | null>(null);
  const page = faq[locale];

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  // A new page closes the panel (for example after following a link in an answer).
  useEffect(() => setOpen(false), [pathname]);

  // The full page already shows everything.
  if (pathname === '/faq') return null;

  const down = (event: PointerEvent) => {
    start.current = event.clientX;
  };
  const move = (event: PointerEvent, opening: boolean) => {
    if (start.current === null) return;
    const shift = event.clientX - start.current;
    if (opening ? shift < -PULL : shift > PULL) {
      setOpen(opening);
      start.current = null;
    }
  };
  const up = () => {
    start.current = null;
  };

  // Above the bottom bar on pages that have it.
  const raised = hasBottomNavigation(pathname);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        onPointerDown={down}
        onPointerMove={(event) => move(event, true)}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={page.title}
        aria-expanded={open}
        title={page.title}
        className={cn(
          'fixed right-0 z-40 flex h-12 w-9 touch-none items-center justify-start rounded-l-2xl bg-gray-900 pl-2 text-white shadow-lg transition-[width,opacity] hover:w-11',
          raised ? 'bottom-24 md:bottom-32' : 'bottom-6',
          open && 'pointer-events-none opacity-0'
        )}
      >
        <CircleHelp className="h-5 w-5" />
      </button>

      {/* Dim the page behind the open panel; a tap on it closes the panel. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          'fixed inset-0 z-[60] bg-black/30 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={page.title}
        aria-hidden={!open}
        onPointerDown={down}
        onPointerMove={(event) => move(event, false)}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn(
          'fixed bottom-0 right-0 top-0 z-[61] flex w-[min(420px,92vw)] flex-col bg-gray-50 shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 className="font-bold text-gray-900">{page.title}</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="×"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-700" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {open && <FaqGroups page={page} compact onNavigate={() => setOpen(false)} />}
          <p className="mt-4 text-sm text-gray-700">
            <Rich value={page.more} />
          </p>
          <Link
            href="/faq"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            {page.title}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </>
  );
}
