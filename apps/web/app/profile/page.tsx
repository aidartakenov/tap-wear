'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Heart, LogOut, Shield, Store, User } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Loading } from '@/components/PageState';
import { primaryButton, secondaryButton } from '@/components/form';
import { plural, productForms } from '@/lib/catalog';
import { useApp } from '@/lib/context';

function Row({ href, icon: Icon, title, text }: { href: string; icon: typeof User; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
    >
      <span className="rounded-full bg-gray-100 p-2.5 text-gray-700">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1">
        <span className="block font-medium text-gray-900">{title}</span>
        <span className="block text-sm text-gray-600">{text}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </Link>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { me, signOut, state } = useApp();

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Профиль</h1>
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
                    Искать, смотреть товары и сохранять избранное можно без регистрации. Аккаунт
                    нужен владельцам и сотрудникам магазинов.
                  </p>
                  <Link href="/login" className={`${primaryButton} mt-4`}>
                    Вход для магазинов
                  </Link>
                </>
              )}
            </section>

            <Row
              href="/favorites"
              icon={Heart}
              title="Избранное"
              text={
                state.favorites.length
                  ? `Сохранено на этом устройстве: ${plural(state.favorites.length, productForms)}`
                  : 'Сохраняется на этом устройстве'
              }
            />
            {me && (
              <Row
                href="/cabinet"
                icon={Store}
                title="Кабинет магазина"
                text={
                  me.memberships.length
                    ? me.memberships.map((m) => m.store_name).join(', ')
                    : 'Создайте магазин и добавьте товары'
                }
              />
            )}
            {me?.is_admin && (
              <Row href="/admin" icon={Shield} title="Модерация" text="Проверка магазинов, товаров и жалоб" />
            )}
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
