import { PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';

// A coloured square with the bank's initial. These are plain markers in each
// bank's usual colour, not the banks' own logos.
const marks: Record<PaymentMethod, { text: string; color: string }> = {
  mbank: { text: 'M', color: 'bg-emerald-600' },
  optima: { text: 'O', color: 'bg-red-600' },
  obank: { text: 'O!', color: 'bg-pink-600' },
};

export function BankBadge({ method, className }: { method: PaymentMethod; className?: string }) {
  const mark = marks[method];
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white',
        mark.color,
        className
      )}
    >
      {mark.text}
    </span>
  );
}

export const bankColor = (method: PaymentMethod) => marks[method].color;
