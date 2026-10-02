'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Plus, Search, Trash2 } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { AvatarUploader } from '@/components/cabinet/AvatarUploader';
import { ImportProducts } from '@/components/cabinet/ImportProducts';
import { PolicyForm } from '@/components/cabinet/PolicyForm';
import { StoreForm } from '@/components/cabinet/StoreForm';
import { StoreOrders } from '@/components/cabinet/StoreOrders';
import { StoreSales } from '@/components/cabinet/StoreSales';
import { TelegramConnect } from '@/components/cabinet/TelegramConnect';
import { StoreStatistics } from '@/components/cabinet/StoreStatistics';
import {
  FormError,
  StatusBadge,
  errorText,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/form';
import { ErrorState, Loading } from '@/components/PageState';
import { RequireAccount } from '@/components/RequireAccount';
import { StoreAvatar } from '@/components/StoreAvatar';
import {
  addMember,
  confirmProductAvailability,
  getMembers,
  setCabinetTheme,
  getMyProduct,
  markSold,
  removeShopSale,
  getMyProducts,
  getMyStores,
  getReference,
  removeMember,
  updateStore,
  updateVariant,
} from '@/lib/api';
import {
  formatPrice,
  productStatusLabels,
  storeStatusLabels,
} from '@/lib/catalog';
import {
  CABINET_THEMES,
  CabinetTheme,
  Member,
  MerchantProduct,
  MerchantStore,
  Reference,
} from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { useApp } from '@/lib/context';

const themeNames: Record<CabinetTheme, string> = {
  black: 'Чёрный',
  pink: 'Розовый',
  green: 'Зелёный',
  blue: 'Синий',
  orange: 'Оранжевый',
  rainbow: 'Радуга',
};
const themeSwatches: Record<CabinetTheme, string> = {
  black: '#111827',
  pink: '#ec4899',
  green: '#16a34a',
  blue: '#2563eb',
  orange: '#f97316',
  rainbow: 'conic-gradient(#db2777, #ea580c, #eab308, #16a34a, #2563eb, #7c3aed, #db2777)',
};

type Tab = 'products' | 'orders' | 'sales' | 'statistics' | 'conditions' | 'profile' | 'members';


function variantName(variant: MerchantProduct['variants'][number]): string {
  return [variant.size_label, variant.color?.name].filter(Boolean).join(', ');
}

function ProductRow({ initial, onSale }: { initial: MerchantProduct; onSale: () => void }) {
  const { tr, t } = useApp();
  const [product, setProduct] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // The sale recorded by the last tap, so it can be taken back at once.
  const [lastSale, setLastSale] = useState<{ id: string; name: string } | null>(null);

  // "Есть": the size is in the shop again. One click, no form.
  const restock = async (variant: MerchantProduct['variants'][number]) => {
    setError(null);
    try {
      setProduct(
        await updateVariant(variant.id, { availability: 'in_stock', confirm_availability: true })
      );
      setLastSale(null);
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  // "Продано": one tap is the whole record. It goes into the sales book, and the
  // size is switched off (a counted size goes down by one instead).
  const sold = async (variant: MerchantProduct['variants'][number]) => {
    setError(null);
    try {
      const result = await markSold(variant.id);
      setProduct(result.product);
      setLastSale({ id: result.sale_id, name: variantName(variant) });
      onSale();
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  const undo = async () => {
    if (!lastSale) return;
    setError(null);
    try {
      await removeShopSale(lastSale.id);
      setProduct(await getMyProduct(product.id));
      setLastSale(null);
      onSale();
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  // "In stock" that has not been confirmed for a while: after 2 days the seller is
  // reminded, after 3 days buyers stop seeing "in stock" until it is confirmed.
  const inStock = product.variants.filter((variant) => variant.availability === 'in_stock');
  const stale = inStock.filter((variant) => variant.confirmation === 'stale').length;
  const due = inStock.filter((variant) => variant.confirmation === 'due').length;

  const confirmAll = async () => {
    setError(null);
    try {
      setProduct(await confirmProductAvailability(product.id));
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  const image = product.images[0]?.url;
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex gap-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
          {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/cabinet/products/${product.id}`}
            className="font-medium text-gray-900 hover:underline line-clamp-2"
          >
            {product.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <StatusBadge status={product.status} label={tr(productStatusLabels[product.status])} />
            <span>{formatPrice(product.base_price_minor)}</span>
          </div>
          {product.review_note && (
            <p className="mt-1 text-sm text-red-700">
              {tr('Замечание проверки: {note}', { note: product.review_note })}
            </p>
          )}
        </div>
      </div>

      {product.variants.length > 0 && product.status !== 'blocked' && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {product.variants.map((variant) => (
            <li key={variant.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-700">
                {variantName(variant) || tr('Без размера')}
              </span>
              <span className="flex items-center gap-1" role="group" aria-label={t(`availability.${variant.availability}`)}>
                {variant.quantity !== null ? (
                  // A counted size: the number is the status, and it goes down by itself.
                  <span
                    className={`min-w-14 rounded-md px-2 py-1 text-center text-xs font-medium ${
                      variant.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tr('{n} шт.', { n: variant.quantity })}
                  </span>
                ) : (
                  <button
                    onClick={() => restock(variant)}
                    aria-pressed={variant.availability === 'in_stock'}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      variant.availability === 'in_stock'
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tr('Есть')}
                  </button>
                )}
                <button
                  onClick={() => sold(variant)}
                  disabled={variant.availability === 'out_of_stock'}
                  aria-pressed={variant.availability === 'out_of_stock'}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    variant.availability === 'out_of_stock'
                      ? 'border-gray-700 bg-gray-700 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tr('Продано')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {(stale > 0 || due > 0) && product.status !== 'blocked' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            {stale > 0
              ? tr('Наличие давно не подтверждалось: покупатели видят «Требует уточнения».')
              : tr('Наличие не подтверждалось больше двух дней.')}
          </span>
          <button
            onClick={confirmAll}
            className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            {tr('Всё по-прежнему в наличии')}
          </button>
        </div>
      )}
      {lastSale && (
        <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-sm text-green-800">
          {tr('Продажа записана: {name}', { name: lastSale.name || product.title })}
          <button onClick={undo} className="font-semibold underline">
            {tr('Отменить')}
          </button>
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </li>
  );
}

function Members({ store }: { store: MerchantStore }) {
  const { tr } = useApp();
  const { data, error, loading } = useApi((signal) => getMembers(store.id, signal), [store.id]);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<unknown>(null);
  const list = members ?? data ?? [];
  const isOwner = store.role === 'owner';

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      const member = await addMember(store.id, email.trim().toLowerCase());
      setMembers([...list, member]);
      setEmail('');
    } catch (cause) {
      setFormError(cause);
    }
  };

  const remove = async (member: Member) => {
    setFormError(null);
    try {
      await removeMember(store.id, member.user_id);
      setMembers(list.filter((item) => item.user_id !== member.user_id));
    } catch (cause) {
      setFormError(cause);
    }
  };

  if (error) return <ErrorState error={error} />;
  if (loading && !data) return <Loading />;

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <ul className="divide-y divide-gray-100">
        {list.map((member) => (
          <li key={member.user_id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{member.name}</p>
              <p className="text-sm text-gray-600 truncate">
                {member.email} · {member.role === 'owner' ? tr('владелец') : tr('сотрудник')}
              </p>
            </div>
            {isOwner && member.role !== 'owner' && (
              <button
                onClick={() => remove(member)}
                aria-label={tr('Отозвать доступ: {name}', { name: member.name })}
                className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form onSubmit={invite} className="space-y-2">
          <p className="text-sm text-gray-600">
            {tr('Сотрудник может добавлять товары и менять наличие, но не может менять профиль магазина и состав сотрудников. Сначала он должен сам зарегистрироваться на сайте.')}
          </p>
          <div className="flex gap-2">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={tr('Почта сотрудника')}
              required
            />
            <button type="submit" className={`${primaryButton} shrink-0`}>
              {tr('Добавить')}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-600">{tr('Добавлять и убирать сотрудников может только владелец.')}</p>
      )}
      <FormError error={formError} />
    </section>
  );
}

function StoreCabinet({ storeId }: { storeId: string }) {
  const { tr } = useApp();
  // Raised after products are imported, so the list is read again.
  const [reload, setReload] = useState(0);
  const { data, error, loading } = useApi(
    async (signal) => {
      const [stores, products, reference] = await Promise.all([
        getMyStores(signal),
        getMyProducts(storeId, signal),
        getReference(signal),
      ]);
      return { store: stores.find((item) => item.id === storeId), products: products.items, reference };
    },
    [storeId, reload]
  );
  const [tab, setTab] = useState<Tab>('products');
  const [importing, setImporting] = useState(false);
  const [find, setFind] = useState('');
  // Raised by every "sold" tap, so the sales tab reads fresh numbers when opened.
  const [salesChanged, setSalesChanged] = useState(0);
  const [saved, setSaved] = useState<MerchantStore | null>(null);
  const [themeError, setThemeError] = useState<unknown>(null);

  if (error) return <ErrorState error={error} notFound={tr('Магазин не найден')} />;
  if (loading || !data) return <Loading />;
  const store = saved ?? data.store;
  if (!store) return <p className="py-16 text-center text-gray-600">{tr('Магазин не найден')}</p>;
  const reference: Reference = data.reference;

  // The owner switches the cabinet's colours: shown at once, then saved for the store.
  const changeTheme = async (theme: CabinetTheme) => {
    const before = store;
    setThemeError(null);
    setSaved({ ...store, cabinet_theme: theme });
    try {
      setSaved(await setCabinetTheme(store.id, theme));
    } catch (cause) {
      setSaved(before);
      setThemeError(cause);
    }
  };

  const tabButton = (value: Tab, label: string) => (
    <button
      onClick={() => setTab(value)}
      aria-current={tab === value}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        tab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    // The cabinet's own colours: see ".cabinet-theme" in globals.css.
    <div className={`cabinet-theme cabinet-theme-${store.cabinet_theme} space-y-4`}>
      <div>
        <div className="cabinet-banner static-colors flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4 text-white md:p-5">
          <StoreAvatar
            name={store.name}
            url={store.avatar_url}
            className="h-12 w-12 ring-2 ring-white/80 md:h-14 md:w-14"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold md:text-xl">{store.name}</h2>
              <StatusBadge status={store.status} label={tr(storeStatusLabels[store.status])} />
            </div>
            {store.status === 'active' && (
              <p className="mt-0.5 text-sm text-white/85">
                {tr('Витрина для покупателей:')}{' '}
                <Link href={`/stores/${store.slug}`} className="font-medium underline">
                  /stores/{store.slug}
                </Link>
              </p>
            )}
          </div>
        </div>
        {store.status === 'pending_review' && (
          <p className="mt-2 text-sm text-gray-600">
            {tr('Магазин ждёт проверки администратором. До одобрения он и его товары не видны покупателям.')}
          </p>
        )}
        {store.review_note && (
          <p className="mt-1 text-sm text-red-700">
            {tr('Замечание проверки: {note}', { note: store.review_note })}
          </p>
        )}
      </div>

      <div className="flex gap-5 overflow-x-auto border-b border-gray-200 whitespace-nowrap">
        {tabButton('products', tr('Товары ({n})', { n: data.products.length }))}
        {tabButton('orders', tr('Заказы'))}
        {tabButton('sales', tr('Продажи'))}
        {tabButton('statistics', tr('Посещения'))}
        {tabButton('conditions', tr('Доставка и возврат'))}
        {tabButton('profile', tr('Профиль магазина'))}
        {tabButton('members', tr('Сотрудники'))}
      </div>

      {tab === 'products' && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link href={`/cabinet/products/new?store=${store.id}`} className={primaryButton}>
              <Plus className="w-4 h-4" />
              {tr('Добавить товар')}
            </Link>
            <button onClick={() => setImporting(!importing)} className={secondaryButton}>
              {tr('Загрузить из таблицы')}
            </button>
          </div>
          {importing && <ImportProducts storeId={store.id} onDone={() => setReload((n) => n + 1)} />}
          {data.products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
              {tr('Товаров пока нет. Добавьте первый: название, цена, размеры и фото.')}
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={find}
                  onChange={(event) => setFind(event.target.value)}
                  placeholder={tr('Найти товар по названию')}
                  aria-label={tr('Найти товар по названию')}
                  className="h-10 w-full rounded-full border border-gray-300 bg-white pl-9 pr-4 text-base text-gray-900 outline-none focus:border-blue-600 md:text-sm"
                />
              </div>
              <p className="flex items-start gap-1 text-xs text-gray-500">
                <Check className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                {tr('Продали вещь в магазине — нажмите «Продано»: продажа запишется во вкладку «Продажи», а размер выключится. Купили через сайт — «Продано» ставится само. Вещь снова в наличии — нажмите «Есть».')}
              </p>
              <ul className="space-y-3">
                {data.products
                  .filter((product) => product.title.toLowerCase().includes(find.trim().toLowerCase()))
                  .map((product) => (
                    <ProductRow key={product.id} initial={product} onSale={() => setSalesChanged((n) => n + 1)} />
                  ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'orders' && <StoreOrders storeId={store.id} />}

      {tab === 'sales' && <StoreSales key={salesChanged} storeId={store.id} />}

      {tab === 'statistics' && <StoreStatistics storeId={store.id} />}

      {tab === 'conditions' &&
        (store.role === 'owner' ? (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <PolicyForm storeId={store.id} />
          </section>
        ) : (
          <p className="text-sm text-gray-600">
            {tr('Условия доставки и возврата может менять только владелец.')}
          </p>
        ))}

      {tab === 'profile' &&
        (store.role === 'owner' ? (
          <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-4">
            <AvatarUploader store={store} onChange={setSaved} />
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-gray-700">{tr('Цвет кабинета')}</legend>
              <div className="flex flex-wrap gap-3">
                {CABINET_THEMES.map((theme) => {
                  const chosen = store.cabinet_theme === theme;
                  return (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => changeTheme(theme)}
                      aria-pressed={chosen}
                      className="flex w-16 flex-col items-center gap-1 text-xs text-gray-700"
                    >
                      <span
                        style={{ background: themeSwatches[theme] }}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-white ring-offset-2 transition-transform hover:scale-110 ${
                          chosen ? 'ring-2 ring-[#2563eb]' : 'border border-gray-200'
                        }`}
                      >
                        {chosen && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                      <span className={chosen ? 'font-semibold text-gray-900' : ''}>{tr(themeNames[theme])}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {tr('Цвет этой страницы магазина в кабинете. Видят только вы и ваши сотрудники.')}
              </p>
              <FormError error={themeError} />
            </fieldset>
            <StoreForm
              initial={store}
              cities={reference.cities}
              submitLabel={tr('Сохранить')}
              onSubmit={async (input) => setSaved(await updateStore(store.id, input))}
            />
            <TelegramConnect storeId={store.id} />
          </section>
        ) : (
          <p className="text-sm text-gray-600">{tr('Профиль магазина может менять только владелец.')}</p>
        ))}

      {tab === 'members' && <Members store={store} />}
    </div>
  );
}

export default function StoreCabinetPage() {
  const { tr } = useApp();
  const storeId = String(useParams().id);
  return (
    <div className="min-h-screen pb-24 md:pb-32">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-2">
          <Link href="/cabinet" aria-label={tr('Назад в кабинет')} className={`${secondaryButton} !px-2.5`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{tr('Магазин')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        <RequireAccount>{() => <StoreCabinet storeId={storeId} />}</RequireAccount>
      </main>
      <BottomNavigation />
    </div>
  );
}
