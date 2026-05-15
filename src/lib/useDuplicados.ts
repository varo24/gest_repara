import { useMemo } from 'react';

export interface DuplicateGroup {
  keep: any;
  remove: any[];
}

const getSeries = (invoiceNumber: string) => (invoiceNumber ?? '').split('-')[0]; // 'FAC' | 'REC'

export function useDuplicados(invoices: any[]): DuplicateGroup[] {
  return useMemo(() => {
    const grupos: Record<string, any[]> = {};
    for (const inv of invoices) {
      // Una FAC y un REC de la misma RMA son documentos distintos — no son duplicados
      if (!inv.repairId || inv.status === 'anulada') continue;
      const key = `${inv.repairId}:${getSeries(inv.invoiceNumber)}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(inv);
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
