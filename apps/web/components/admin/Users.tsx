'use client';

import { FormEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { FormError } from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { AdminUser, changeAdminUser, getAdminUsers } from '@/lib/api';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';
import { cn } from '@/lib/utils';

const PAGE = 50;

// Every account on the site. An administrator can block one or share admin rights.
export function Users() {
  const { tr, me } = useApp();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);
  const { data, error, loading } = useApi(
    (signal) => getAdminUsers({ query, limit: PAGE, offset }, signal),
    [query, offset, refresh]
  );

  const search = (event: FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setQuery(text.trim());
  };

  const change = async (user: AdminUser, part: { is_active?: boolean; is_admin?: boolean }) => {
    const question =
      part.is_active === false
        ? tr('Заблокировать {email}? Человек сразу выйдет из аккаунта и не сможет войти.', { email: user.email })
        : part.is_admin === true
          ? tr('Сделать {email} администратором? У него будет доступ ко всему, включая этот раздел.', { email: user.email })
          : null;
    if (question && !window.confirm(question)) return;
    setFailure(null);
    try {
      await changeAdminUser(user.id, part);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setFailure(cause);
    }
  };

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const action =
    'rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-40';

  return (
    <div className={cn('space-y-4', loading && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">
          {tr('Пользователи: {n}', { n: data.total })}
        </h2>
        <form onSubmit={search} role="search" className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={tr('Почта или имя')}
            aria-label={tr('Поиск пользователей')}
            maxLength={100}
            className="h-9 w-full rounded-full border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-600"
          />
        </form>
      </div>
      <FormError error={failure} />

      <ul className="space-y-2">
        {data.items.map((user) => {
          const self = user.id === me?.id;
          return (
            <li key={user.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
                {user.is_admin && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                    {tr('администратор')}
                  </span>
                )}
                {!user.is_active && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    {tr('заблокирован')}
                  </span>
                )}
                {!user.email_verified && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {tr('почта не подтверждена')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {[
                  tr('с {date}', { date: new Date(user.created_at).toLocaleDateString('ru-RU') }),
                  tr('заказов: {n}', { n: user.orders }),
                  user.stores.length ? tr('магазины: {names}', { names: user.stores.join(', ') }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {self ? (
                <p className="mt-2 text-xs text-gray-500">{tr('Это вы. Свой аккаунт здесь изменить нельзя.')}</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => change(user, { is_active: !user.is_active })}
                    className={cn(
                      action,
                      user.is_active
                        ? 'border-red-200 text-red-700 hover:bg-red-50'
                        : 'border-gray-300 text-gray-900 hover:border-gray-900'
                    )}
                  >
                    {user.is_active ? tr('Заблокировать') : tr('Разблокировать')}
                  </button>
                  <button
                    onClick={() => change(user, { is_admin: !user.is_admin })}
                    className={cn(action, 'border-gray-300 text-gray-900 hover:border-gray-900')}
                  >
                    {user.is_admin ? tr('Снять права администратора') : tr('Сделать администратором')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {data.total > PAGE && (
        <div className="flex justify-end gap-2 text-sm">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            disabled={offset === 0}
            className={cn(action, 'border-gray-300 text-gray-900')}
          >
            {tr('Назад')}
          </button>
          <button
            onClick={() => setOffset(offset + PAGE)}
            disabled={offset + PAGE >= data.total}
            className={cn(action, 'border-gray-300 text-gray-900')}
          >
            {tr('Дальше')}
          </button>
        </div>
      )}
    </div>
  );
}
