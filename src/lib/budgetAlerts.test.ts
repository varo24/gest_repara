import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { workingDaysSince, getBudgetAlertLevel, countBudgetAlerts } from './budgetAlerts';
import type { Budget } from '../types';

afterEach(() => {
  vi.useRealTimers();
});

// Pin "today" to 2024-01-15 (Monday) for all date-sensitive tests
const FIXED_NOW = new Date('2024-01-15T10:00:00');

describe('workingDaysSince', () => {
  it('returns 0 for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    expect(workingDaysSince('2024-01-15')).toBe(0);
  });

  it('returns 0 for a future date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    expect(workingDaysSince('2024-01-20')).toBe(0);
  });

  it('counts Mon–Fri only, skipping weekends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW); // 2024-01-15 (Mon)
    // From Mon 2024-01-08 → iterate Tue 9, Wed 10, Thu 11, Fri 12, (Sat/Sun skip), Mon 15 = 5
    expect(workingDaysSince('2024-01-08')).toBe(5);
  });

  it('returns 7 working days for a date two weeks ago crossing two weekends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW); // 2024-01-15 (Mon)
    // From Thu 2024-01-04 → Fri 5, (Sat/Sun skip), Mon 8, Tue 9, Wed 10, Thu 11, Fri 12, (Sat/Sun skip), Mon 15 = 7
    expect(workingDaysSince('2024-01-04')).toBe(7);
  });
});

describe('getBudgetAlertLevel', () => {
  const base: Budget = {
    id: 'b1',
    repairId: '',
    customerName: '',
    items: [],
    total: 0,
    date: '2024-01-08', // 5 working days ago
    status: 'pending',
  } as unknown as Budget;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  it('returns none for non-pending budgets', () => {
    expect(getBudgetAlertLevel({ ...base, status: 'accepted' }, 3)).toBe('none');
    expect(getBudgetAlertLevel({ ...base, status: 'rejected' }, 3)).toBe('none');
  });

  it('returns none when budget has no date', () => {
    expect(getBudgetAlertLevel({ ...base, date: undefined } as any, 3)).toBe('none');
  });

  it('returns yellow when working days >= threshold but < threshold*2+1', () => {
    // 5 working days, threshold=3 → yellow (5 >= 3, 5 < 7)
    expect(getBudgetAlertLevel(base, 3)).toBe('yellow');
  });

  it('returns red when working days >= threshold*2+1', () => {
    // 7 working days (date=2024-01-04), threshold=3 → red (7 >= 7)
    expect(getBudgetAlertLevel({ ...base, date: '2024-01-04' }, 3)).toBe('red');
  });

  it('uses lastContactedAt over date when both present', () => {
    // date is old (red), but lastContactedAt is recent (none)
    const recent: Budget = { ...base, date: '2024-01-04', lastContactedAt: '2024-01-15' } as any;
    expect(getBudgetAlertLevel(recent, 3)).toBe('none');
  });
});

describe('countBudgetAlerts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  it('returns zeros for empty list', () => {
    expect(countBudgetAlerts([], 3)).toEqual({ yellow: 0, red: 0, total: 0 });
  });

  it('sums yellow and red correctly', () => {
    const budgets: Partial<Budget>[] = [
      { id: 'b1', date: '2024-01-08', status: 'pending' }, // 5 days → yellow
      { id: 'b2', date: '2024-01-04', status: 'pending' }, // 7 days → red
      { id: 'b3', date: '2024-01-14', status: 'pending' }, // 1 day → none
      { id: 'b4', date: '2024-01-08', status: 'accepted' }, // accepted → none
    ];
    const result = countBudgetAlerts(budgets as Budget[], 3);
    expect(result).toEqual({ yellow: 1, red: 1, total: 2 });
  });
});
