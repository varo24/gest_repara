import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNotifEnabled, checkStockLow, checkRepairsReady } from './pushNotifications';
import type { InventoryItem, RepairItem } from '../types';
import { RepairStatus } from '../types';

// KEY constants mirroring pushNotifications.ts
const KEY_ENABLED    = 'gestrepara_notif_enabled';
const KEY_STOCK_DATE = 'gestrepara_notif_stock';
const KEY_READY_IDS  = 'gestrepara_notif_ready';

// setup.ts mocks Notification.permission = 'granted'

describe('isNotifEnabled', () => {
  it('returns true when permission is granted and not disabled', () => {
    expect(isNotifEnabled()).toBe(true);
  });

  it('returns false when explicitly disabled in localStorage', () => {
    localStorage.setItem(KEY_ENABLED, '0');
    expect(isNotifEnabled()).toBe(false);
  });

  it('returns false when Notification.permission is not granted', () => {
    (globalThis as any).Notification.permission = 'denied';
    expect(isNotifEnabled()).toBe(false);
    (globalThis as any).Notification.permission = 'granted';
  });
});

describe('checkStockLow', () => {
  const lowItem = {
    id: 'i1',
    description: 'Pantalla LCD',
    stock: 1,
    minStock: 5,
  } as InventoryItem;

  const okItem = {
    id: 'i2',
    description: 'Cable USB',
    stock: 10,
    minStock: 5,
  } as InventoryItem;

  it('does nothing when already notified today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(KEY_STOCK_DATE, today);
    await checkStockLow([lowItem]);
    // Date key unchanged (function returned early)
    expect(localStorage.getItem(KEY_STOCK_DATE)).toBe(today);
  });

  it('does not set date when no items are low', async () => {
    await checkStockLow([okItem]);
    expect(localStorage.getItem(KEY_STOCK_DATE)).toBeNull();
  });

  it('sets KEY_STOCK_DATE to today after notifying low items', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await checkStockLow([lowItem]);
    expect(localStorage.getItem(KEY_STOCK_DATE)).toBe(today);
  });

  it('ignores items where minStock is 0', async () => {
    const zeroMin = { ...lowItem, minStock: 0 };
    await checkStockLow([zeroMin as InventoryItem]);
    expect(localStorage.getItem(KEY_STOCK_DATE)).toBeNull();
  });
});

describe('checkRepairsReady', () => {
  const readyRepair: Partial<RepairItem> = {
    id: 'r1',
    status: RepairStatus.READY,
    customerName: 'Ana García',
    brand: 'Samsung',
    model: 'A54',
    rmaNumber: 1,
  };

  it('records repair ID in localStorage after notifying', async () => {
    await checkRepairsReady([readyRepair as RepairItem]);
    const stored: string[] = JSON.parse(localStorage.getItem(KEY_READY_IDS) ?? '[]');
    expect(stored).toContain('r1');
  });

  it('skips repairs already in the notified list', async () => {
    localStorage.setItem(KEY_READY_IDS, JSON.stringify(['r1']));
    const swMock = (await navigator.serviceWorker.ready).showNotification as ReturnType<typeof vi.fn>;
    const callsBefore = swMock.mock.calls.length;
    await checkRepairsReady([readyRepair as RepairItem]);
    expect(swMock.mock.calls.length).toBe(callsBefore); // no new notification
  });

  it('does not add to list when repair is not READY', async () => {
    const pending = { ...readyRepair, id: 'r2', status: 'En reparación' as RepairStatus };
    await checkRepairsReady([pending as RepairItem]);
    const stored: string[] = JSON.parse(localStorage.getItem(KEY_READY_IDS) ?? '[]');
    expect(stored).not.toContain('r2');
  });
});
