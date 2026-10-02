import Link from 'next/link';
import { BottomNavigation } from '@/components/BottomNavigation';

export const metadata = { title: 'Как выбрать размер — TapWear' };

// A shirt laid flat with the measurements sellers give for a garment.
function GarmentDiagram() {
  return (
    <svg viewBox="0 0 320 250" role="img" aria-labelledby="garment-title" className="w-full max-w-sm">
      <title id="garment-title">
        Замеры изделия: длина по спинке, ширина груди, ширина плеч и длина рукава
      </title>
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
        <text x="160" y="9" textAnchor="middle">плечи</text>
        <text x="110" y="126" textAnchor="start">ширина груди</text>
        <text x="166" y="180">длина</text>
        <text x="262" y="50">рукав</text>
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

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Как выбрать размер</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <p className="text-sm text-gray-600">
          Размеры у магазинов разные: «L» одного продавца может быть «M» у другого. Поэтому
          TapWear показывает размер так, как его указал продавец, и не переводит его сам.
          Надёжнее всего сравнивать сантиметры.
        </p>

        <Step title="Мерки тела и замеры изделия — разные вещи">
          <p>
            <strong>Мерки тела</strong> — это обхваты человека: грудь, талия, бёдра. Их снимают
            сантиметровой лентой вокруг тела.
          </p>
          <p>
            <strong>Замеры изделия</strong> — это размеры самой вещи, разложенной на столе. Ширину
            измеряют от шва до шва по одной стороне, поэтому она примерно вдвое меньше обхвата.
          </p>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
            Пример: у куртки указана ширина груди 56 см. Это не значит, что она подойдёт человеку
            с обхватом груди 56 см. Обхват самой куртки — около 112 см (56 × 2), а чтобы вещь
            не была тесной, она должна быть заметно шире тела.
          </p>
        </Step>

        <Step title="Что измеряют у вещи">
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
            <GarmentDiagram />
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Длина</strong> — по спинке от воротника до низа.
              </li>
              <li>
                <strong>Ширина груди</strong> — от подмышки до подмышки по разложенной вещи.
              </li>
              <li>
                <strong>Плечи</strong> — от одного плечевого шва до другого.
              </li>
              <li>
                <strong>Рукав</strong> — от плечевого шва до края манжеты.
              </li>
              <li>
                Для брюк: <strong>пояс</strong> (ширина по талии) и <strong>внутренний шов</strong>{' '}
                (от шагового шва до низа штанины).
              </li>
            </ul>
          </div>
        </Step>

        <Step title="Самый простой способ: сравнить со своей вещью">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Возьмите вещь того же типа, которая хорошо на вас сидит.</li>
            <li>Разложите её на ровной поверхности и расправьте.</li>
            <li>Измерьте длину, ширину груди и рукав так, как показано на схеме.</li>
            <li>Сравните с замерами в карточке товара или спросите их у продавца.</li>
          </ol>
        </Step>

        <Step title="Как снять мерки тела">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Грудь</strong> — лента горизонтально по самым выступающим точкам груди.
            </li>
            <li>
              <strong>Талия</strong> — по самому узкому месту, не втягивая живот.
            </li>
            <li>
              <strong>Бёдра</strong> — по самым выступающим точкам ягодиц.
            </li>
            <li>
              <strong>Рост</strong> — без обуви. Для детской одежды размер часто и есть рост: 110,
              116, 122.
            </li>
          </ul>
          <p>Все значения записывайте в сантиметрах. Лента должна прилегать, но не стягивать.</p>
        </Step>

        <Step title="Чего TapWear не делает">
          <ul className="list-disc space-y-1 pl-5">
            <li>Не определяет размер только по росту: у людей одного роста размеры бывают разными.</li>
            <li>Не переводит «L» в числовой размер без таблицы конкретного продавца.</li>
            <li>
              Не придумывает замеры: если продавец их не указал, в карточке так и написано, и
              лучше спросить у магазина.
            </li>
          </ul>
        </Step>

        <p className="text-sm text-gray-600">
          Нужны замеры конкретной вещи? Откройте товар в{' '}
          <Link href="/catalog" className="text-blue-600 hover:underline">
            каталоге
          </Link>{' '}
          и напишите продавцу — в сообщении уже будут указаны товар и выбранный размер.
        </p>
      </main>

      <BottomNavigation />
    </div>
  );
}
