'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Heart, LogOut, Shield, Store, User } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Loading } from '@/components/PageState';
import {
  Field,
  FormError,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/form';
import { changePassword, updateProfile } from '@/lib/api';
import { plural, productForms } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { Me } from '@/lib/types';

function Row({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: typeof User;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
    >
      <span className="rounded-full bg-gray-100 p-2.5 text-gray-700">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-gray-900">{title}</span>
        <span className="block text-sm text-gray-600 truncate">{text}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </Link>
  );
}

function AccountSettings({ me }: { me: Me }) {
  const { setMe } = useApp();
  const [name, setName] = useState(me.name);
  const [nameState, setNameState] = useState<{ error?: unknown; saved?: boolean }>({});
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordState, setPasswordState] = useState<{ error?: unknown; saved?: boolean }>({});

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setMe(await updateProfile(name));
      setNameState({ saved: true });
    } catch (error) {
      setNameState({ error });
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setPasswordState({ saved: true });
    } catch (error) {
      setPasswordState({ error });
    }
  };

  return (
    <details className="rounded-xl border border-gray-200 bg-white">
      <summary className="cursor-pointer p-4 font-medium text-gray-900">Настройки аккаунта</summary>
      <div className="space-y-6 border-t border-gray-100 p-4">
        <form onSubmit={saveName} className="space-y-3">
          <Field label="Имя">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameState({});
              }}
              required
              maxLength={100}
            />
          </Field>
          <FormError error={nameState.error} />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={name.trim() === me.name} className={secondaryButton}>
              Сохранить имя
            </button>
            {nameState.saved && <span className="text-sm text-green-700">Сохранено</span>}
          </div>
        </form>

        <form onSubmit={savePassword} className="space-y-3">
          <Field label="Текущий пароль">
            <input
              className={inputClass}
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="Новый пароль" hint="Не короче 8 символов. На других устройствах нужно будет войти заново.">
            <input
              className={inputClass}
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
          <FormError error={passwordState.error} />
          <div className="flex items-center gap-3">
            <button type="submit" className={secondaryButton}>
              Сменить пароль
            </button>
            {passwordState.saved && <span className="text-sm text-green-700">Пароль изменён</span>}
          </div>
        </form>
      </div>
    </details>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { me, signOut, favorites } = useApp();

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{me ? 'Личный кабинет' : 'Профиль'}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        {me === undefined ? (
          <Loading />
        ) : (
          <>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              {me ? (
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-blue-50 p-3 text-blue-600">
                    <User className="w-6 h-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{me.name}</p>
                    <p className="text-sm text-gray-600 truncate">{me.email}</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">Вы смотрите каталог как гость</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Войдите или создайте аккаунт, чтобы избранное сохранялось в нём и было
                    доступно на всех ваших устройствах.
                  </p>
                  <Link href="/login" className={`${primaryButton} mt-4`}>
                    Войти или зарегистрироваться
                  </Link>
                </>
              )}
            </section>

            <Row
              href="/favorites"
              icon={Heart}
              title="Избранное"
              text={
                favorites.length
                  ? `${plural(favorites.length, productForms)} · ${
                      me ? 'сохранено в аккаунте' : 'сохранено на этом устройстве'
                    }`
                  : me
                    ? 'Сохраняется в вашем аккаунте'
                    : 'Сохраняется на этом устройстве'
              }
            />
            {me && (
              <Row
                href="/cabinet"
                icon={Store}
                title={me.memberships.length ? 'Кабинет магазина' : 'Открыть свой магазин'}
                text={
                  me.memberships.length
                    ? me.memberships.map((m) => m.store_name).join(', ')
                    : 'Для продавцов: витрина и товары в каталоге TapWear'
                }
              />
            )}
            {me?.is_admin && (
              <Row href="/admin" icon={Shield} title="Модерация" text="Проверка магазинов, товаров и жалоб" />
            )}
            {me && <AccountSettings me={me} />}
            {me && (
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className={`${secondaryButton} w-full`}
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            )}
          </>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
