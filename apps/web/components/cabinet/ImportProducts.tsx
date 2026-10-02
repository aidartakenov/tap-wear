'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { FormError, primaryButton, secondaryButton } from '@/components/form';
import { ImportResult, importProducts } from '@/lib/api';
import { useApp } from '@/lib/context';

// The sample file: the header a seller's spreadsheet must have, and two rows as
// a guide. Semicolons and the mark at the start make Excel open it correctly.
const SAMPLE =
  '﻿' +
  [
    'Название;Категория;Для кого;Цена;Бренд;Описание;Система размеров;Размеры;Цвета;Количество',
    'Куртка зимняя;Куртки;мужчинам;4500;;Тёплая куртка с капюшоном;INT;M, L, XL;Черный, Синий;',
    'Платье летнее;Платья и юбки;женщинам;2900,50;;;RU;44, 46;Белый;3',
  ].join('\r\n');

// Adds many products at once from a spreadsheet saved as CSV. The file is checked
// first; nothing is created until every row is valid and the seller confirms.
export function ImportProducts({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const { tr } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const send = async (chosen: File, dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await importProducts(storeId, chosen, dryRun);
      setResult(outcome);
      if (outcome.created > 0) onDone();
    } catch (cause) {
      setError(cause);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    setFile(chosen);
    setResult(null);
    if (chosen) send(chosen, true);
  };

  const downloadSample = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv;charset=utf-8' }));
    link.download = 'tapwear-products.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const bad = result?.rows.filter((row) => row.errors.length > 0) ?? [];
  const ready = result !== null && result.created === 0 && bad.length === 0;

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <FileSpreadsheet className="h-4 w-4" />
          {tr('Загрузка товаров из таблицы')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {tr('Заполните таблицу по образцу в Excel или Google Таблицах и сохраните как CSV. Одна строка — один товар; размеры и цвета через запятую. Товары создаются черновиками: фото добавляются потом.')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadSample} className={secondaryButton}>
          <Download className="h-4 w-4" />
          {tr('Скачать образец')}
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={primaryButton}
        >
          {busy ? tr('Проверяем…') : tr('Выбрать файл CSV')}
        </button>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={pick} />
      </div>
      <FormError error={error} />

      {result && result.created > 0 && (
        <p className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800">
          {tr('Создано черновиков: {n}. Добавьте фото и отправьте на проверку.', { n: result.created })}
        </p>
      )}
      {bad.length > 0 && (
        <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">
            {tr('Ничего не создано: исправьте строки и выберите файл снова.')}
          </p>
          <ul className="space-y-1">
            {bad.map((row) => (
              <li key={row.row}>
                {tr('Строка {n}', { n: row.row })}
                {row.title && ` («${row.title}»)`}: {row.errors.join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ready && file && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3">
          <p className="text-sm text-gray-700">
            {tr('Файл в порядке. Товаров в нём: {n}.', { n: result.rows.length })}
          </p>
          <button onClick={() => send(file, false)} disabled={busy} className={primaryButton}>
            {busy ? tr('Создаём…') : tr('Создать товары')}
          </button>
        </div>
      )}
    </div>
  );
}
