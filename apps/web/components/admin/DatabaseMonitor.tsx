'use client';

import { FormEvent, useState } from 'react';
import { ArrowDown, ArrowUp, Database, KeyRound, RefreshCw, Search } from 'lucide-react';
import { ErrorState, Loading } from '@/components/PageState';
import { getDatabaseOverview, getDatabaseTable } from '@/lib/api';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';
import { cn } from '@/lib/utils';

const PAGE = 50;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// A cell as text: dates shortened, lists joined, empty values marked.
function cellText(value: unknown): string {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  return String(value);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function TableView({ name, refresh }: { name: string; refresh: number }) {
  const { tr } = useApp();
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<{ column: string; descending: boolean } | null>(null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  const { data, error, loading } = useApi(
    (signal) =>
      getDatabaseTable(
        name,
        { limit: PAGE, offset, sort: sort?.column, descending: sort?.descending, query },
        signal
      ),
    [name, offset, sort, query, refresh]
  );

  const search = (event: FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setQuery(text.trim());
  };

  const sortBy = (column: string) => {
    setOffset(0);
    // A second click on the same column reverses the order.
    const current = sort ?? (data ? { column: data.sort, descending: data.descending } : null);
    setSort({ column, descending: current?.column === column ? !current.descending : true });
  };

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const from = data.total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, data.total);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-mono text-base font-bold text-gray-900">{name}</h3>
        <form onSubmit={search} role="search" className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={tr('Поиск по тексту и id')}
            aria-label={tr('Поиск по таблице')}
            maxLength={100}
            className="h-9 w-full rounded-full border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-600"
          />
        </form>
      </div>

      <div
        className={cn(
          'overflow-x-auto rounded-xl border border-gray-200 bg-white',
          loading && 'opacity-60'
        )}
      >
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
            <tr>
              {data.columns.map((column) => {
                const secret = data.rows.some((row) => row[data.columns.indexOf(column)] === '•••');
                return (
                  <th key={column.name} className="whitespace-nowrap px-3 py-2 font-semibold">
                    <button
                      onClick={() => sortBy(column.name)}
                      disabled={secret}
                      title={`${column.type}${column.nullable ? '' : ', NOT NULL'}`}
                      className="flex items-center gap-1 font-mono hover:text-gray-900 disabled:hover:text-gray-600"
                    >
                      {column.primary_key && <KeyRound className="h-3 w-3 text-amber-600" />}
                      {column.name}
                      {data.sort === column.name &&
                        (data.descending ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        ))}
                    </button>
                    <span className="block font-normal lowercase text-gray-400">{column.type}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {row.map((value, cell) => (
                  <td
                    key={cell}
                    title={cellText(value)}
                    className={cn(
                      'max-w-[18rem] truncate whitespace-nowrap px-3 py-1.5 font-mono',
                      value === null ? 'text-gray-400' : 'text-gray-800'
                    )}
                  >
                    {cellText(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">{tr('Строк нет')}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>{tr('Строки {from}–{to} из {total}', { from, to, total: data.total })}</span>
        <span className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            disabled={offset === 0}
            className="rounded-full border border-gray-300 bg-white px-4 py-1.5 font-medium text-gray-900 hover:border-gray-900 disabled:opacity-40"
          >
            {tr('Назад')}
          </button>
          <button
            onClick={() => setOffset(offset + PAGE)}
            disabled={to >= data.total}
            className="rounded-full border border-gray-300 bg-white px-4 py-1.5 font-medium text-gray-900 hover:border-gray-900 disabled:opacity-40"
          >
            {tr('Дальше')}
          </button>
        </span>
      </div>
    </section>
  );
}

// A read-only look into the database: how big it is, what each table holds.
export function DatabaseMonitor() {
  const { tr } = useApp();
  const [refresh, setRefresh] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const { data, error, loading } = useApi((signal) => getDatabaseOverview(signal), [refresh]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const totalRows = data.tables.reduce((sum, table) => sum + table.rows, 0);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Database className="h-5 w-5" />
            {data.database}
            <span className="text-sm font-normal text-gray-500">PostgreSQL {data.version}</span>
          </h2>
          <button
            onClick={() => setRefresh((value) => value + 1)}
            className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 hover:border-gray-900"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {tr('Обновить')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <Stat label={tr('Размер базы')} value={formatBytes(data.size_bytes)} />
          <Stat label={tr('Таблиц')} value={String(data.tables.length)} />
          <Stat label={tr('Строк всего')} value={totalRows.toLocaleString('ru-RU')} />
          <Stat label={tr('Подключений')} value={String(data.connections)} />
        </div>
        <p className="text-xs text-gray-500">
          {tr('Только просмотр: изменить данные отсюда нельзя. Пароли и токены скрыты.')}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-gray-900">{tr('Таблицы')}</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {data.tables.map((table) => (
            <button
              key={table.name}
              onClick={() => setChosen(table.name)}
              aria-pressed={chosen === table.name}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                chosen === table.name
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-900'
              )}
            >
              <span className="block truncate font-mono text-sm font-semibold">{table.name}</span>
              <span
                className={cn('text-xs', chosen === table.name ? 'text-white/80' : 'text-gray-500')}
              >
                {tr('строк: {n}', { n: table.rows.toLocaleString('ru-RU') })} ·{' '}
                {formatBytes(table.size_bytes)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {chosen ? (
        // The key resets paging, sorting and search when another table is opened.
        <TableView key={chosen} name={chosen} refresh={refresh} />
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          {tr('Выберите таблицу, чтобы посмотреть её строки.')}
        </p>
      )}
    </div>
  );
}
