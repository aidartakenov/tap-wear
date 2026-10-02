'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { FormError, dangerButton, primaryButton, secondaryButton } from '@/components/form';
import { checkStoreTelegram, disconnectStoreTelegram, getStoreTelegram, TelegramStatus } from '@/lib/api';
import { useApp } from '@/lib/context';
import { useApi } from '@/lib/useApi';

// Lets the owner connect a Telegram chat that gets a message for every new paid order.
export function TelegramConnect({ storeId }: { storeId: string }) {
  const { tr } = useApp();
  const { data } = useApi((signal) => getStoreTelegram(storeId, signal), [storeId]);
  const [changed, setChanged] = useState<TelegramStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const status = changed ?? data;
  if (!status) return null;

  const run = async (action: () => Promise<TelegramStatus>) => {
    setBusy(true);
    setError(null);
    try {
      setChanged(await action());
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-gray-100 pt-4">
      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
        <Send className="h-4 w-4" />
        {tr('Заказы в Telegram')}
      </h3>
      {status.connected ? (
        <>
          <p className="text-sm text-green-700">
            {tr('Подключено: о каждом новом оплаченном заказе придёт сообщение.')}
          </p>
          <button
            onClick={() => run(() => disconnectStoreTelegram(storeId))}
            disabled={busy}
            className={dangerButton}
          >
            {tr('Отключить')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {status.bot_configured
              ? tr('Откройте бота по ссылке, нажмите «Старт», затем вернитесь и нажмите «Проверить подключение».')
              : tr('Бот сайта ещё не настроен администратором. Сейчас сообщения записываются только в журнал сервера.')}
          </p>
          <div className="flex flex-wrap gap-2">
            {status.link && (
              <a href={status.link} target="_blank" rel="noopener noreferrer" className={primaryButton}>
                {tr('Открыть бота')}
              </a>
            )}
            <button
              onClick={() => run(() => checkStoreTelegram(storeId))}
              disabled={busy}
              className={secondaryButton}
            >
              {tr('Проверить подключение')}
            </button>
          </div>
        </>
      )}
      <FormError error={error} />
    </div>
  );
}
