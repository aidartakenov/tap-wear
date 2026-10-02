'use client';

import { FormEvent, useState } from 'react';
import { Flag } from 'lucide-react';
import { FormError, inputClass, primaryButton, textareaClass } from '@/components/form';
import { reportProduct } from '@/lib/api';
import { reportReasonLabels } from '@/lib/catalog';
import { ReportReason } from '@/lib/types';

// Lets a buyer tell us that a price, the stock or a photo is wrong. No account needed.
export function ReportProblem({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('wrong_price');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reportProduct(productId, reason, comment);
      setSent(true);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return <p className="text-sm text-green-700">Спасибо, сообщение отправлено. Мы проверим карточку.</p>;
  }
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <Flag className="w-4 h-4" />
        Сообщить об ошибке в карточке
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 p-3">
      <select
        className={inputClass}
        value={reason}
        onChange={(event) => setReason(event.target.value as ReportReason)}
        aria-label="Что не так"
      >
        {(Object.keys(reportReasonLabels) as ReportReason[]).map((value) => (
          <option key={value} value={value}>
            {reportReasonLabels[value]}
          </option>
        ))}
      </select>
      <textarea
        className={textareaClass}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Подробности (необязательно). Не указывайте личные данные."
        maxLength={1000}
      />
      <FormError error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Отправляем…' : 'Отправить'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-gray-600">
          Отмена
        </button>
      </div>
    </form>
  );
}
