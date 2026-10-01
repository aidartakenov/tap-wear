import { Info } from 'lucide-react';

// Spec: demo items must be marked and never presented as live store offers.
export function DemoNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <p>
        Демо-данные: товары и контакты взяты с публичных сайтов магазинов для разработки.
        Магазины не подключены к TopWear, цены и наличие могли измениться.
      </p>
    </div>
  );
}
