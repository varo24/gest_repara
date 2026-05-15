import { useMemo } from 'react';

export interface DuplicateGroup {
  keep: any;
  remove: any[];
}

export function useDuplicados(invoices: any[]): DuplicateGroup[] {
  return useMemo(() => {
    const grupos: Record<string, any[]> = {};
    for (const inv of invoices) {
      if (!inv.repairId || inv.status === 'anulada') continue;
      if (!grupos[inv.repairId]) grupos[inv.repairId] = [];
      grupos[inv.repairId].push(inv);
    }
    return Object.values(grupos)
      .filter(g => g.length > 1)
      .map(g => {
        const sorted = [...g].sort((a, b) =>
          (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '')
        );
        return { keep: sorted[0], remove: sorted.slice(1) };
      });
  }, [invoices]);
}
