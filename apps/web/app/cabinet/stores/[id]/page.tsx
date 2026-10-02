'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { StoreForm } from '@/components/cabinet/StoreForm';
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
import {
  addMember,
  confirmProductAvailability,
  getMembers,
  getMyProducts,
  getMyStores,
  getReference,
  removeMember,
  updateStore,
  updateVariant,
} from '@/lib/api';
import {
  availabilityLabels,
  formatPrice,
  productStatusLabels,
  storeStatusLabels,
} from '@/lib/catalog';
import { Availability, Member, MerchantProduct, MerchantStore, Reference } from '@/lib/types';
import { useApi } from '@/lib/useApi';

type Tab = 'products' | 'statistics' | 'profile' | 'members';

const availabilityShort: Record<Availability, string> = {
  in_stock: 'Есть',
  out_of_stock: 'Нет',
  unknown: 'Не указано',
};

function variantName(variant: MerchantProduct['variants'][number]): string {
  return [variant.size_label, variant.color?.name].filter(Boolean).join(', ') || 'Без размера';
}

function ProductRow({ initial }: { initial: MerchantProduct }) {
  const [product, setProduct] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // Quick stock change straight from the list: one click, no form.
  const change = async (variantId: string, availability: Availability) => {
    setError(null);
    try {
      setProduct(await updateVariant(variantId, { availability, confirm_availability: true }));
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
            <StatusBadge status={product.status} label={productStatusLabels[product.status]} />
            <span>{formatPrice(product.base_price_minor)}</span>
          </div>
          {product.review_note && (
            <p className="mt-1 text-sm text-red-700">Замечание проверки: {product.review_note}</p>
          )}
        </div>
      </div>

      {product.variants.length > 0 && product.status !== 'blocked' && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {product.variants.map((variant) => (
            <li key={variant.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-700">{variantName(variant)}</span>
              <span className="flex gap-1" role="group" aria-label={availabilityLabels[variant.availability]}>
                {(['in_stock', 'out_of_stock'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => change(variant.id, status)}
                    aria-pressed={variant.availability === status}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      variant.availability === status
                        ? status === 'in_stock'
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-gray-700 bg-gray-700 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {availabilityShort[status]}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(stale > 0 || due > 0) && product.status !== 'blocked' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            {stale > 0
              ? 'Наличие давно не подтверждалось: покупатели видят «Требует уточнения».'
              : 'Наличие не подтверждалось больше двух дней.'}
          </span>
          <button
            onClick={confirmAll}
            className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Всё по-прежнему в наличии
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </li>
  );
}

function Members({ store }: { store: MerchantStore }) {
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
                {member.email} · {member.role === 'owner' ? 'владелец' : 'сотрудник'}
              </p>
            </div>
            {isOwner && member.role !== 'owner' && (
              <button
                onClick={() => remove(member)}
                aria-label={`Отозвать доступ: ${member.name}`}
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
            Сотрудник может добавлять товары и менять наличие, но не может менять профиль
            магазина и состав сотрудников. Сначала он должен сам зарегистрироваться на сайте.
          </p>
          <div className="flex gap-2">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Почта сотрудника"
              required
            />
            <button type="submit" className={`${primaryButton} shrink-0`}>
              Добавить
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-600">Добавлять и убирать сотрудников может только владелец.</p>
      )}
      <FormError error={formError} />
    </section>
  );
}

function StoreCabinet({ storeId }: { storeId: string }) {
  const { data, error, loading } = useApi(
    async (signal) => {
      const [stores, products, reference] = await Promise.all([
        getMyStores(signal),
        getMyProducts(storeId, signal),
        getReference(signal),
      ]);
      return { store: stores.find((item) => item.id === storeId), products: products.items, reference };
    },
    [storeId]
  );
  const [tab, setTab] = useState<Tab>('products');
  const [saved, setSaved] = useState<MerchantStore | null>(null);

  if (error) return <ErrorState error={error} notFound="Магазин не найден" />;
  if (loading || !data) return <Loading />;
  const store = saved ?? data.store;
  if (!store) return <p className="py-16 text-center text-gray-600">Магазин не найден</p>;
  const reference: Reference = data.reference;

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
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">{store.name}</h2>
          <StatusBadge status={store.status} label={storeStatusLabels[store.status]} />
        </div>
        {store.status === 'pending_review' && (
          <p className="mt-1 text-sm text-gray-600">
            Магазин ждёт проверки администратором. До одобрения он и его товары не видны покупателям.
          </p>
        )}
        {store.status === 'active' && (
          <p className="mt-1 text-sm text-gray-600">
            Витрина для покупателей:{' '}
            <Link href={`/stores/${store.slug}`} className="text-blue-600 hover:underline">
              /stores/{store.slug}
            </Link>
          </p>
        )}
        {store.review_note && (
          <p className="mt-1 text-sm text-red-700">Замечание проверки: {store.review_note}</p>
        )}
      </div>

      <div className="flex gap-5 overflow-x-auto border-b border-gray-200 whitespace-nowrap">
        {tabButton('products', `Товары (${data.products.length})`)}
        {tabButton('statistics', 'Статистика')}
        {tabButton('profile', 'Профиль магазина')}
        {tabButton('members', 'Сотрудники')}
      </div>

      {tab === 'products' && (
        <section className="space-y-3">
          <Link href={`/cabinet/products/new?store=${store.id}`} className={primaryButton}>
            <Plus className="w-4 h-4" />
            Добавить товар
          </Link>
          {data.products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
              Товаров пока нет. Добавьте первый: название, цена, размеры и фото.
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1 text-xs text-gray-500">
                <Check className="w-3.5 h-3.5" />
                Нажатие «Есть» или «Нет» сразу меняет наличие и отмечает его как подтверждённое сегодня.
              </p>
              <ul className="space-y-3">
                {data.products.map((product) => (
                  <ProductRow key={product.id} initial={product} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'statistics' && <StoreStatistics storeId={store.id} />}

      {tab === 'profile' &&
        (store.role === 'owner' ? (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <StoreForm
              initial={store}
              cities={reference.cities}
              submitLabel="Сохранить"
              onSubmit={async (input) => setSaved(await updateStore(store.id, input))}
            />
          </section>
        ) : (
          <p className="text-sm text-gray-600">Профиль магазина может менять только владелец.</p>
        ))}

      {tab === 'members' && <Members store={store} />}
    </div>
  );
}

export default function StoreCabinetPage() {
  const storeId = String(useParams().id);
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <Link href="/cabinet" aria-label="Назад в кабинет" className={`${secondaryButton} !px-2.5`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Магазин</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <RequireAccount>{() => <StoreCabinet storeId={storeId} />}</RequireAccount>
      </main>
      <BottomNavigation />
    </div>
  );
}
