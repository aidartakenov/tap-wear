import Link from 'next/link';
import { cookies } from 'next/headers';
import { BottomNavigation } from '@/components/BottomNavigation';
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n';
import { sizeGuide } from '@/lib/i18n/sizeGuide';

export function generateMetadata() {
  const text = sizeGuide[parseLocale(cookies().get(LOCALE_COOKIE)?.value)];
  return { title: `${text.title} — TapWear` };
}

// A shirt laid flat with the measurements sellers give for a garment.
function GarmentDiagram({
  title,
  labels,
}: {
  title: string;
  labels: { shoulders: string; chest: string; length: string; sleeve: string };
}) {
  return (
    <svg viewBox="0 0 320 250" role="img" aria-labelledby="garment-title" className="w-full max-w-sm">
      <title id="garment-title">{title}</title>
      <path
        d="M110 30 L140 20 Q160 34 180 20 L210 30 L270 80 L245 105 L215 85 L215 225 L105 225 L105 85 L75 105 L50 80 Z"
        fill="#eff6ff"
        stroke="#1e3a8a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g stroke="#dc2626" strokeWidth="2" fill="none">
        <line x1="110" y1="14" x2="210" y2="14" />
        <line x1="105" y1="110" x2="215" y2="110" />
        <line x1="160" y1="34" x2="160" y2="225" strokeDasharray="5 4" />
        <line x1="222" y1="34" x2="282" y2="84" />
      </g>
      <g fontSize="12" fill="#111827" fontFamily="inherit">
        <text x="160" y="9" textAnchor="middle">
          {labels.shoulders}
        </text>
        <text x="110" y="126" textAnchor="start">
          {labels.chest}
        </text>
        <text x="166" y="180">{labels.length}</text>
        <text x="262" y="50">{labels.sleeve}</text>
      </g>
    </svg>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function Lead({ pair }: { pair: [string, string] }) {
  return (
    <>
      <strong>{pair[0]}</strong>
      {pair[1]}
    </>
  );
}

export default function SizeGuidePage() {
  const text = sizeGuide[parseLocale(cookies().get(LOCALE_COOKIE)?.value)];

  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{text.title}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <p className="text-sm text-gray-600">{text.intro}</p>

        <Step title={text.difference.title}>
          <p>
            <Lead pair={text.difference.body} />
          </p>
          <p>
            <Lead pair={text.difference.garment} />
          </p>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{text.difference.example}</p>
        </Step>

        <Step title={text.garment.title}>
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
            <GarmentDiagram title={text.garment.diagramTitle} labels={text.garment.labels} />
            <ul className="list-disc space-y-1 pl-5">
              {text.garment.items.map((item) => (
                <li key={item[0]}>
                  <Lead pair={item} />
                </li>
              ))}
            </ul>
          </div>
        </Step>

        <Step title={text.compare.title}>
          <ol className="list-decimal space-y-1 pl-5">
            {text.compare.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Step>

        <Step title={text.body.title}>
          <ul className="list-disc space-y-1 pl-5">
            {text.body.items.map((item) => (
              <li key={item[0]}>
                <Lead pair={item} />
              </li>
            ))}
          </ul>
          <p>{text.body.note}</p>
        </Step>

        <Step title={text.limits.title}>
          <ul className="list-disc space-y-1 pl-5">
            {text.limits.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Step>

        <p className="text-sm text-gray-600">
          {text.outro.before}
          <Link href="/catalog" className="text-blue-600 hover:underline">
            {text.outro.link}
          </Link>
          {text.outro.after}
        </p>
      </main>

      <BottomNavigation />
    </div>
  );
}
