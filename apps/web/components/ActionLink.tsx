import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// TapWear's main call-to-action: a pill with a round "puck" that holds the icon.
// On hover the puck slides and turns, so the button feels like a switch being flicked.
const variants = {
  // Dark pill, blue puck. The default on light backgrounds.
  ink: {
    pill: 'bg-gray-900 text-white hover:bg-black',
    // In the dark theme the pill itself is blue, so the puck goes darker.
    puck: 'bg-blue-600 text-white dark:bg-[#0b0f17]/35',
  },
  // White pill, blue puck. For the one most important action on a dark panel.
  light: {
    pill: 'bg-white text-gray-900 hover:bg-gray-100',
    puck: 'bg-blue-600 text-white',
  },
  // Outlined pill for a secondary action on a dark panel.
  ghost: {
    pill: 'border border-white/30 text-white hover:border-white/70',
    puck: 'bg-white/15 text-white',
  },
} as const;

interface ActionLinkProps {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
  icon?: LucideIcon;
  // Arrows turn to point forward on hover; other icons only tilt.
  turn?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}

export function ActionLink({
  href,
  children,
  variant = 'ink',
  icon: Icon = ArrowUpRight,
  turn = Icon === ArrowUpRight,
  size = 'md',
  className,
}: ActionLinkProps) {
  const style = variants[variant];
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center rounded-full font-semibold transition-colors duration-200',
        size === 'md' ? 'gap-3 py-1.5 pl-5 pr-1.5 text-sm' : 'gap-2 py-1 pl-4 pr-1 text-sm',
        style.pill,
        className
      )}
    >
      {children}
      <span
        className={cn(
          'flex items-center justify-center rounded-full transition-transform duration-300 ease-out',
          size === 'md' ? 'h-9 w-9' : 'h-8 w-8',
          turn
            ? 'group-hover:translate-x-0.5 group-hover:rotate-45'
            : 'group-hover:-rotate-12 group-hover:scale-110',
          style.puck
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </Link>
  );
}
