'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { FormError, dangerButton, secondaryButton } from '@/components/form';
import { StoreAvatar } from '@/components/StoreAvatar';
import { deleteStoreAvatar, uploadStoreAvatar } from '@/lib/api';
import { useApp } from '@/lib/context';
import { MerchantStore } from '@/lib/types';

interface AvatarUploaderProps {
  store: MerchantStore;
  onChange: (store: MerchantStore) => void;
}

export function AvatarUploader({ store, onChange }: AvatarUploaderProps) {
  const { tr } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (action: () => Promise<MerchantStore>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset, so choosing the same file again still triggers an upload.
    event.target.value = '';
    if (file) run(() => uploadStoreAvatar(store.id, file));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <StoreAvatar name={store.name} url={store.avatar_url} className="h-20 w-20 text-2xl" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-gray-900">{tr('Аватар магазина')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className={secondaryButton}
            >
              <Camera className="w-4 h-4" />
              {busy
                ? tr('Загружаем…')
                : store.avatar_url
                  ? tr('Заменить фото')
                  : tr('Загрузить фото')}
            </button>
            {store.avatar_url && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => deleteStoreAvatar(store.id))}
                className={dangerButton}
              >
                <Trash2 className="w-4 h-4" />
                {tr('Убрать')}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {tr('Логотип или фото точки. JPEG, PNG или WebP; обрежем до квадрата по центру.')}
          </p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={pick}
        className="hidden"
        aria-label={tr('Аватар магазина')}
      />
      <FormError error={error} />
    </div>
  );
}
