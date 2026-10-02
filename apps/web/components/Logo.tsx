import { cn } from '@/lib/utils';

// The TapWear mark: a clothes hanger with a pointer "tapping" inside it.
// Redrawn as vector from the project's logo so it stays sharp at any size.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-2 -3 68 68"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('h-8 w-8 text-gray-900', className)}
    >
      <g stroke="#2563eb" strokeWidth={3}>
        {/* Hook, then the two arms and the open bottom bar. */}
        <path d="M24.7 9.3A7.6 7.6 0 1 1 36 14.6L32 18.8" />
        <path d="M24.6 44.5H7.5C2.5 44.5.8 38.2 5 35.6L32 18.8l27 16.8c4.2 2.6 2.5 8.9-2.5 8.9H47" />
        {/* The "tap" rays. */}
        <path d="M32.2 28.5V34M22.4 34.2l3.6 3.3M42 34.2l-3.6 3.3" />
      </g>
      <path
        d="M33.2 41.6 35.2 57.6l3.5-3.5 4.3 6.7 2.8-1.8-4.2-6.6 5.5-1.9z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.6}
      />
    </svg>
  );
}

// The mark with the wordmark, as in the header.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <LogoMark className="h-7 w-7 md:h-8 md:w-8" />
      <span className="text-xl font-extrabold tracking-tight text-gray-900">
        Tap<span className="text-blue-600">Wear</span>
      </span>
    </span>
  );
}
