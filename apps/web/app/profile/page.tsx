'use client';

import { BottomNavigation } from '@/components/BottomNavigation';
import { useApp } from '@/lib/context';
import { User, ShoppingBag, Store, Shield, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProfilePage() {
  const { state, setUserRole } = useApp();

  const roleConfig = {
    guest: {
      title: 'Гость',
      description: 'Войдите в аккаунт для полного доступа',
      icon: User,
      color: 'text-gray-600',
    },
    buyer: {
      title: 'Покупатель',
      description: 'Добро пожаловать!',
      icon: ShoppingBag,
      color: 'text-blue-600',
    },
    store_owner: {
      title: 'Продавец',
      description: 'Управляйте своим магазином',
      icon: Store,
      color: 'text-green-600',
    },
    admin: {
      title: 'Администратор',
      description: 'Полный доступ к системе',
      icon: Shield,
      color: 'text-purple-600',
    },
  };

  const currentRole = roleConfig[state.userRole];
  const RoleIcon = currentRole.icon;

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Профиль</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-gray-100 rounded-full ${currentRole.color}`}>
                <RoleIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{currentRole.title}</h2>
                <p className="text-sm text-gray-600">{currentRole.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {state.userRole === 'guest' && (
          <Card>
            <CardContent className="p-4">
              <Button className="w-full" size="lg">
                Войти в аккаунт
              </Button>
            </CardContent>
          </Card>
        )}

        {state.userRole === 'buyer' && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Заказы</span>
                <span className="font-medium">5</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Избранное</span>
                <span className="font-medium">12</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Адрес доставки</span>
                <span className="font-medium text-sm text-gray-500">Не указан</span>
              </div>
            </CardContent>
          </Card>
        )}

        {state.userRole === 'store_owner' && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Мой магазин</span>
                <span className="font-medium text-sm text-blue-600">Elegance Fashion</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Товары</span>
                <span className="font-medium">48</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Продажи за месяц</span>
                <span className="font-medium">24 500 сом</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Рейтинг</span>
                <span className="font-medium">4.8 ⭐</span>
              </div>
            </CardContent>
          </Card>
        )}

        {state.userRole === 'admin' && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Пользователи</span>
                <span className="font-medium">1,234</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Магазины</span>
                <span className="font-medium">156</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Товары</span>
                <span className="font-medium">8,432</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Жалобы</span>
                <span className="font-medium text-red-600">3</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="w-4 h-4 mr-2" />
              Настройки
            </Button>
            <Button variant="ghost" className="w-full justify-start text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Демо: переключить роль</h3>
            <Tabs defaultValue="guest" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="guest" onClick={() => setUserRole('guest')}>
                  Гость
                </TabsTrigger>
                <TabsTrigger value="buyer" onClick={() => setUserRole('buyer')}>
                  Покупатель
                </TabsTrigger>
                <TabsTrigger
                  value="store_owner"
                  onClick={() => setUserRole('store_owner')}
                >
                  Продавец
                </TabsTrigger>
                <TabsTrigger value="admin" onClick={() => setUserRole('admin')}>
                  Админ
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
}
