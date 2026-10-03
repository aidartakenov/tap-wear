import { cookies } from 'next/headers';
import { BottomNavigation } from '@/components/BottomNavigation';
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n';
import { InfoPageName, InfoText, infoPages } from '@/lib/i18n/infoPages';
import { OPERATOR_NAME, SUPPORT_EMAIL } from '@/lib/site';

export function infoText(name: InfoPageName): InfoText {
  return infoPages[name][parseLocale(cookies().get(LOCALE_COOKIE)?.value)];
}

export function infoMetadata(name: InfoPageName) {
  const text = infoText(name);
  return { title: `${text.title} — TapWear`, description: text.description };
}

// Puts the support address (as a mail link) and the operator's name into the text.
function Filled({ text }: { text: string }) {
  const parts = text.replaceAll('{operator}', OPERATOR_NAME).split('{email}');
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-blue-600 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          )}
          {part}
        </span>
      ))}
    </>
  );
}

// A plain reading page: title, an introduction and numbered sections.
export function InfoPage({ name }: { name: InfoPageName }) {
  const text = infoText(name);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{text.title}</h1>
        {text.updated && <p className="mt-2 text-sm text-gray-500">{text.updated}</p>}
        {text.intro && (
          <p className="mt-4 text-base leading-relaxed text-gray-700 md:text-lg">
            <Filled text={text.intro} />
          </p>
        )}
        <div className="mt-8 space-y-7">
          {text.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-gray-900 md:text-xl">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2 leading-relaxed text-gray-700">
                  <Filled text={paragraph} />
                </p>
              ))}
              {section.items && (
                <ul className="mt-2 space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2.5 leading-relaxed text-gray-700">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden />
                      <span>
                        <Filled text={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
