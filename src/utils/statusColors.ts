import { RepairStatus } from '../types';

// ═══ STATUS COLORS — Vivid, high contrast, clearly distinguishable ═══
export const STATUS_COLORS: Record<string, string> = {
  [RepairStatus.PENDING]:         'bg-yellow-400 text-yellow-900',
  [RepairStatus.DIAGNOSING]:      'bg-cyan-400 text-cyan-900',
  [RepairStatus.BUDGET_PENDING]:  'bg-violet-500 text-white',
  [RepairStatus.BUDGET_ACCEPTED]: 'bg-lime-400 text-lime-900',
  [RepairStatus.BUDGET_REJECTED]: 'bg-rose-500 text-white',
  [RepairStatus.WAITING_PARTS]:   'bg-orange-500 text-white',
  [RepairStatus.IN_PROGRESS]:     'bg-blue-500 text-white',
  [RepairStatus.READY]:           'bg-emerald-500 text-white',
  [RepairStatus.DELIVERED]:       'bg-slate-400 text-white',
  [RepairStatus.CANCELLED]:       'bg-red-600 text-white',
};

export const getStatusColor = (status: RepairStatus | string): string => {
  return STATUS_COLORS[status] || 'bg-slate-200 text-slate-600';
};
