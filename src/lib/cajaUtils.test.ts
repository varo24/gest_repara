import { describe, it, expect } from 'vitest';
import { localDateStr, cajaAyerSinCerrar } from './cajaUtils';

describe('localDateStr', () => {
  it('formats a date using local year/month/day (not UTC)', () => {
    const d = new Date(2024, 0, 15); // Jan 15, 2024 in local time
    expect(localDateStr(d)).toBe('2024-01-15');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateStr(new Date(2024, 2, 5))).toBe('2024-03-05');  // Mar 5
    expect(localDateStr(new Date(2024, 9, 1))).toBe('2024-10-01');  // Oct 1
  });

  it('handles year/month boundary correctly', () => {
    expect(localDateStr(new Date(2023, 11, 31))).toBe('2023-12-31'); // Dec 31
    expect(localDateStr(new Date(2024, 0, 1))).toBe('2024-01-01');   // Jan 1
  });
});

describe('cajaAyerSinCerrar', () => {
  const YESTERDAY = '2024-01-14';

  it('returns false when there are no cash movements', () => {
    expect(cajaAyerSinCerrar([], [], YESTERDAY)).toBe(false);
  });

  it('returns false when apertura is marked ignorada:true', () => {
    const movements = [{ fecha: YESTERDAY, tipo: 'apertura', ignorada: true }];
    expect(cajaAyerSinCerrar(movements, [], YESTERDAY)).toBe(false);
  });

  it('returns true when apertura exists and no cierre', () => {
    const movements = [{ fecha: YESTERDAY, tipo: 'apertura', ignorada: false }];
    expect(cajaAyerSinCerrar(movements, [], YESTERDAY)).toBe(true);
  });

  it('returns false when both apertura and cierre exist', () => {
    const movements = [{ fecha: YESTERDAY, tipo: 'apertura' }];
    const cierres   = [{ fecha: YESTERDAY }];
    expect(cajaAyerSinCerrar(movements, cierres, YESTERDAY)).toBe(false);
  });

  it('ignores apertura movements from other days', () => {
    const movements = [{ fecha: '2024-01-13', tipo: 'apertura' }]; // wrong day
    expect(cajaAyerSinCerrar(movements, [], YESTERDAY)).toBe(false);
  });

  it('accepts legacy "date" field (in addition to "fecha")', () => {
    const movements = [{ date: YESTERDAY, type: 'apertura' }]; // legacy field names
    expect(cajaAyerSinCerrar(movements, [], YESTERDAY)).toBe(true);
  });

  it('handles cierre fecha with time component (slice to 10 chars)', () => {
    const movements = [{ fecha: YESTERDAY, tipo: 'apertura' }];
    const cierres   = [{ fecha: `${YESTERDAY}T22:00:00` }];
    expect(cajaAyerSinCerrar(movements, cierres, YESTERDAY)).toBe(false);
  });
});
