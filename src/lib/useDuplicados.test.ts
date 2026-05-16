import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDuplicados } from './useDuplicados';

const inv = (id: string, repairId: string, number: string, status = 'paid') =>
  ({ id, repairId, invoiceNumber: number, status });

describe('useDuplicados', () => {
  it('returns empty array for no invoices', () => {
    const { result } = renderHook(() => useDuplicados([]));
    expect(result.current).toEqual([]);
  });

  it('returns empty when no repair has more than one invoice per series', () => {
    const invoices = [inv('1', 'r1', 'FAC-00001'), inv('2', 'r2', 'FAC-00002')];
    const { result } = renderHook(() => useDuplicados(invoices));
    expect(result.current).toHaveLength(0);
  });

  it('detects two FAC invoices for the same repair as a duplicate', () => {
    const invoices = [inv('1', 'r1', 'FAC-00001'), inv('2', 'r1', 'FAC-00002')];
    const { result } = renderHook(() => useDuplicados(invoices));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].keep.id).toBe('1');       // lower number wins
    expect(result.current[0].remove[0].id).toBe('2');
  });

  it('does NOT flag FAC + REC for the same repair as duplicates', () => {
    const invoices = [inv('1', 'r1', 'FAC-00001'), inv('2', 'r1', 'REC-00001')];
    const { result } = renderHook(() => useDuplicados(invoices));
    expect(result.current).toHaveLength(0);
  });

  it('ignores anulada invoices', () => {
    const invoices = [inv('1', 'r1', 'FAC-00001'), inv('2', 'r1', 'FAC-00002', 'anulada')];
    const { result } = renderHook(() => useDuplicados(invoices));
    expect(result.current).toHaveLength(0);
  });

  it('handles invoices with no repairId gracefully', () => {
    const invoices = [
      { id: '1', repairId: undefined, invoiceNumber: 'FAC-00001', status: 'paid' },
      { id: '2', repairId: undefined, invoiceNumber: 'FAC-00002', status: 'paid' },
    ];
    const { result } = renderHook(() => useDuplicados(invoices as any));
    expect(result.current).toHaveLength(0);
  });

  it('identifies the keep item as the one with the lower invoice number', () => {
    // FAC-00003 comes before FAC-00010 alphabetically and numerically
    const invoices = [inv('a', 'r1', 'FAC-00010'), inv('b', 'r1', 'FAC-00003')];
    const { result } = renderHook(() => useDuplicados(invoices));
    expect(result.current[0].keep.id).toBe('b');  // FAC-00003 sorts first
    expect(result.current[0].remove[0].id).toBe('a');
  });
});
