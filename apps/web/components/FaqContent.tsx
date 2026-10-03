import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { FaqText } from '@/lib/i18n/faq';
import { SUPPORT_EMAIL } from '@/lib/site';

// "[words](/path)" becomes a link and "{email}" the support address.
export function Rich({ value, onNavigate }: { value: string; onNavigate?: () => void }) {
  return (
    <>
      {value.split(/(\[[^\]]+\]\([^)]+\)|\{email\})/).map((part, index) => {
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Link
              key={index}
              href={link[2]}
              onClick={onNavigate}
              className="font-medium text-blue-600 hover:underline"
            >
              {link[1]}
            </Link>
          );
        }
        if (part === '{email}') {
          return (
            <a key={index} href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-blue-600 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

// The questions, grouped, each opening its answer on a tap.
export function FaqGroups({
  page,
  compact = false,
  onNavigate,
}: {
  page: FaqText;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {page.groups.map((group) => (
        <section key={group.title} className={compact ? 'mt-4' : 'mt-8'}>
          <h2 className={compact ? 'mb-2 text-sm font-bold text-gray-900' : 'mb-3 text-lg font-bold text-gray-900 md:text-xl'}>
            {group.title}
          </h2>
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {group.items.map((item) => (
              <details key={item.q} className="group">
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-gray-900 [&::-webkit-details-marker]:hidden ${
                    compact ? 'px-3 py-3 text-sm' : 'px-4 py-3.5'
                  }`}
                >
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
                </summary>
                <p className={`leading-relaxed text-gray-700 ${compact ? 'px-3 pb-3 text-sm' : 'px-4 pb-4'}`}>
                  <Rich value={item.a} onNavigate={onNavigate} />
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
