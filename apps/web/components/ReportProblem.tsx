'use client';

import { FormEvent, useState } from 'react';
import { Flag } from 'lucide-react';
import { FormError, inputClass, primaryButton, textareaClass } from '@/components/form';
import { reportProduct } from '@/lib/api';
import { reportReasonLabels } from '@/lib/catalog';
import { useApp } from '@/lib/context';
import { ReportReason } from '@/lib/types';

// Lets a buyer tell us that a price, the stock or a photo is wrong. No account needed.
export function ReportProblem({ productId }: { productId: string }) {
  const { t } = useApp();
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
    return <p className="text-sm text-green-700">{t('report.thanks')}</p>;
  }
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <Flag className="w-4 h-4" />
        {t('report.open')}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 p-3">
      <select
        className={inputClass}
        value={reason}
        onChange={(event) => setReason(event.target.value as ReportReason)}
        aria-label={t('report.what')}
      >
        {(Object.keys(reportReasonLabels) as ReportReason[]).map((value) => (
          <option key={value} value={value}>
            {t(`reportReason.${value}`)}
          </option>
        ))}
      </select>
      <textarea
        className={textareaClass}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={t('report.details')}
        maxLength={1000}
      />
      <FormError error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {t(busy ? 'report.sending' : 'report.send')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-gray-600">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
