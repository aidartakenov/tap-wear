'use client';

import { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { statusColors } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { Translate, optionalKey } from '@/lib/i18n';

export const inputClass =
  'w-full h-10 rounded-lg border border-gray-300 bg-white px-3 text-base md:text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-gray-100';

export const textareaClass = inputClass.replace('h-10', 'min-h-24 py-2');

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 h-10 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60';

export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 h-10 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60';

export const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 h-10 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

// Messages for API error codes a person can act on; anything else gets a general text.
const messages: Record<string, string> = {
  invalid_credentials: 'Неверная почта или пароль',
  email_taken: 'Аккаунт с такой почтой уже есть. Войдите в него',
  too_many_attempts: 'Слишком много попыток. Попробуйте через 15 минут',
  version_conflict: 'Кто-то изменил этот товар, пока вы его редактировали. Обновите страницу',
  duplicate_variant: 'Один и тот же цвет и размер указан дважды',
  not_ready: 'Товар не готов к публикации',
  unsupported_image: 'Загрузите фото в формате JPEG, PNG или WebP',
  file_too_large: 'Файл больше 10 МБ',
  image_too_large: 'Изображение слишком большое (больше 20 мегапикселей)',
  too_many_images: 'У товара может быть не больше 5 фото',
  last_image: 'У опубликованного товара должно остаться хотя бы одно фото',
  storage_unavailable: 'Хранилище фото недоступно. Попробуйте позже',
  user_not_found: 'Аккаунта с такой почтой нет. Попросите человека сначала зарегистрироваться',
  already_member: 'У этого человека уже есть доступ',
  product_blocked: 'Товар заблокирован администратором',
  store_blocked: 'Магазин заблокирован администратором',
  wrong_password: 'Текущий пароль указан неверно',
  network_error: 'Не удалось связаться с сервером',
  unauthorized: 'Войдите в аккаунт',
  forbidden: 'Недостаточно прав',
  validation_error: 'Проверьте заполнение полей',
};

const problems: Record<string, string> = {
  'Add at least one size or variant': 'Добавьте хотя бы один размер',
  'Add at least one photo': 'Добавьте хотя бы одно фото',
};

export function errorText(error: unknown, t?: Translate): string {
  if (!(error instanceof ApiError)) return t ? t('error.unexpected') : 'Что-то пошло не так';
  // Codes a buyer can meet are in the dictionaries; seller-only ones are Russian for now.
  const key = optionalKey(`error.${error.code}`);
  const base =
    (t && key ? t(key) : undefined) ??
    messages[error.code] ??
    (t ? t('error.generic') : 'Не удалось выполнить действие');
  if (error.code === 'not_ready' && Array.isArray(error.details)) {
    const list = error.details.map((detail) => problems[detail.problem] ?? detail.problem);
    return `${base}: ${list.join('; ').toLowerCase()}`;
  }
  return base;
}

export function FormError({ error }: { error: unknown }) {
  const { t } = useApp();
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {errorText(error, t)}
    </p>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
      {label}
    </span>
  );
}


function statusClass(status: string): string {
  return statusColors[status] ?? 'bg-gray-100 text-gray-700';
}
