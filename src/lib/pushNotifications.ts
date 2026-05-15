import { RepairItem, RepairStatus, InventoryItem, Cita } from '../types';

// ── localStorage keys ─────────────────────────────────────────────────────────
const KEY_ENABLED      = 'gestrepara_notif_enabled';
const KEY_ASKED        = 'gestrepara_notif_asked';
const KEY_READY_IDS    = 'gestrepara_notif_ready';    // repair IDs notified as "ready"
const KEY_STOCK_DATE   = 'gestrepara_notif_stock';    // last date stock notif was sent
const KEY_CITA_IDS     = 'gestrepara_notif_citas';    // cita IDs already reminded

// ── Permission ────────────────────────────────────────────────────────────────

export function hasAskedPermission(): boolean {
  return localStorage.getItem(KEY_ASKED) === '1';
}

export function isNotifEnabled(): boolean {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  return localStorage.getItem(KEY_ENABLED) !== '0';
}

export function setNotifEnabled(val: boolean): void {
  localStorage.setItem(KEY_ENABLED, val ? '1' : '0');
}

export async function requestPermissionIfNeeded(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (hasAskedPermission()) return;
  if (Notification.permission === 'denied') { localStorage.setItem(KEY_ASKED, '1'); return; }

  localStorage.setItem(KEY_ASKED, '1');
  const result = await Notification.requestPermission();
  if (result === 'granted') localStorage.setItem(KEY_ENABLED, '1');
}

// ── Core show ─────────────────────────────────────────────────────────────────

export async function showNotif(
  title: string,
  body: string,
  data: Record<string, string> = {},
  tag?: string,
): Promise<void> {
  if (!isNotifEnabled()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag ?? `gestrepara-${Date.now()}`,
      data,
      // @ts-expect-error — non-standard but supported in Chrome/Edge
      renotify: true,
    });
  } catch {
    // Fallback: direct Notification API (e.g. no SW ready)
    new Notification(title, { body, icon: '/icon-192.png', tag, data } as NotificationOptions);
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export function setBadge(count: number): void {
  if ('setAppBadge' in navigator) {
    if (count > 0) (navigator as any).setAppBadge(count).catch(() => {});
    else (navigator as any).clearAppBadge().catch(() => {});
  }
}

// ── Case 1: Reparaciones listas ───────────────────────────────────────────────

export async function checkRepairsReady(repairs: RepairItem[]): Promise<void> {
  if (!isNotifEnabled()) return;

  const stored: string[] = JSON.parse(localStorage.getItem(KEY_READY_IDS) ?? '[]');
  const storedSet = new Set(stored);

  const pending = repairs.filter(
    r => r.status === RepairStatus.READY && !storedSet.has(r.id)
  );
  if (pending.length === 0) return;

  if (pending.length === 1) {
    const r = pending[0];
    await showNotif(
      'Reparación lista 🔧',
      `La reparación de ${r.customerName} — ${r.brand} ${r.model} está lista`,
      { view: 'repairs', repairId: r.id },
      `ready-${r.id}`,
    );
  } else {
    await showNotif(
      `${pending.length} reparaciones listas 🔧`,
      pending.map(r => `${r.customerName} (RMA ${r.rmaNumber})`).join(' · '),
      { view: 'repairs' },
      'ready-batch',
    );
  }

  const newIds = [...stored, ...pending.map(r => r.id)];
  localStorage.setItem(KEY_READY_IDS, JSON.stringify(newIds));
}

// ── Case 2: Citas próximas (próxima hora) ─────────────────────────────────────

export async function checkCitasReminder(citas: Cita[]): Promise<void> {
  if (!isNotifEnabled()) return;

  const stored: string[] = JSON.parse(localStorage.getItem(KEY_CITA_IDS) ?? '[]');
  const storedSet = new Set(stored);

  const now  = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const pending = citas.filter(c => {
    if (storedSet.has(c.id)) return false;
    if (c.estado === 'cancelada' || c.estado === 'completada') return false;
    const citaStart = new Date(`${c.fecha}T${c.horaInicio}`);
    return citaStart > now && citaStart <= in2h;
  });

  for (const cita of pending) {
    await showNotif(
      'Cita próxima 📅',
      `Cita con ${cita.clienteName ?? 'cliente'} a las ${cita.horaInicio}`,
      { view: 'calendar', citaId: cita.id },
      `cita-${cita.id}`,
    );
  }

  if (pending.length > 0) {
    const newIds = [...stored, ...pending.map(c => c.id)];
    localStorage.setItem(KEY_CITA_IDS, JSON.stringify(newIds));
  }
}

// ── Case 3: Stock bajo ────────────────────────────────────────────────────────

export async function checkStockLow(items: InventoryItem[]): Promise<void> {
  if (!isNotifEnabled()) return;

  const today   = new Date().toISOString().slice(0, 10);
  const lastDay = localStorage.getItem(KEY_STOCK_DATE);
  if (lastDay === today) return;   // already notified today

  const low = items.filter(i => i.stock <= i.minStock && i.minStock > 0);
  if (low.length === 0) return;

  for (const item of low.slice(0, 3)) {
    await showNotif(
      'Stock bajo ⚠️',
      `${item.description} tiene solo ${item.stock} unidades (mínimo: ${item.minStock})`,
      { view: 'inventory' },
      `stock-low-${item.id}`,
    );
  }

  localStorage.setItem(KEY_STOCK_DATE, today);
}

// ── Purge old notified IDs (keep list from growing forever) ──────────────────

export function purgeOldNotifIds(activeRepairIds: Set<string>, activeCitaIds: Set<string>): void {
  try {
    const readyIds: string[] = JSON.parse(localStorage.getItem(KEY_READY_IDS) ?? '[]');
    localStorage.setItem(KEY_READY_IDS, JSON.stringify(readyIds.filter(id => activeRepairIds.has(id))));

    const citaIds: string[] = JSON.parse(localStorage.getItem(KEY_CITA_IDS) ?? '[]');
    localStorage.setItem(KEY_CITA_IDS, JSON.stringify(citaIds.filter(id => activeCitaIds.has(id))));
  } catch {}
}
