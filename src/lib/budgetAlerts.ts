import { Budget } from '../types';

export type BudgetAlertLevel = 'none' | 'yellow' | 'red';

// Count Mon-Fri days between isoDate and today (isoDate exclusive, today inclusive)
export function workingDaysSince(isoDate: string): number {
  const start = new Date(isoDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today <= start) return 0;
  let count = 0;
  const d = new Date(start);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function getBudgetAlertLevel(budget: Budget, threshold: number): BudgetAlertLevel {
  if (budget.status && budget.status !== 'pending') return 'none';
  const ref = budget.lastContactedAt || budget.date;
  if (!ref) return 'none';
  const days = workingDaysSince(ref);
  if (days >= threshold * 2 + 1) return 'red';
  if (days >= threshold) return 'yellow';
  return 'none';
}

export function countBudgetAlerts(
  budgets: Budget[],
  threshold: number,
): { yellow: number; red: number; total: number } {
  let yellow = 0;
  let red = 0;
  for (const b of budgets) {
    const level = getBudgetAlertLevel(b, threshold);
    if (level === 'yellow') yellow++;
    else if (level === 'red') red++;
  }
  return { yellow, red, total: yellow + red };
}
