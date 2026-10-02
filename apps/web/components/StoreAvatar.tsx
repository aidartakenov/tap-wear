import Image from 'next/image';
import { cn } from '@/lib/utils';

// Background for stores without a picture. The colour is picked from the name,
// so a store keeps the same one everywhere.
const fallbackColors = [
  'bg-blue-600',
  'bg-gray-900',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-cyan-700',
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2)).toUpperCase();
}

function colorFor(name: string): string {
  let sum = 0;
  for (const char of name) sum += char.codePointAt(0) ?? 0;
  return fallbackColors[sum % fallbackColors.length];
}

interface StoreAvatarProps {
  name: string;
  url?: string | null;
  // Tailwind size and text classes, e.g. "h-12 w-12 text-base".
  className?: string;
}

// A store's round picture; without one, its initials on a colour.
export function StoreAvatar({ name, url, className }: StoreAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex h-10 w-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ring-1 ring-black/5',
        !url && colorFor(name),
        className
      )}
    >
      {url ? <Image src={url} alt="" fill sizes="96px" className="object-cover" /> : initials(name)}
    </span>
  );
}
