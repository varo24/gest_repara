// dataService.ts — Firestore backend + IndexedDB offline cache
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

type CB = (data: any[]) => void;

// ── IndexedDB local cache ────────────────────────────────────────────────────

const DB_NAME = 'ReparaPro_LocalDB';
const DB_VERSION = 11;
const ALL_STORES = [
  'repairs', 'budgets', 'invoices', 'cash_movements', 'inventory',
  'warranties', 'customers', 'settings', 'stock_movements',
  'citas', 'apps_externas',
  'correos_procesados', 'facturas_importadas', 'correos_analizados', 'facturas_descartadas',
  'suppliers', 'informes', 'cierres_caja',
];

class LocalStore {
  private mem: Record<string, any[]> = {};
  private idb: IDBDatabase | null = null;

  async init() {
    ALL_STORES.forEach(s => { this.mem[s] = []; });
    try {
      this.idb = await new Promise<IDBDatabase | null>(resolve => {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          ALL_STORES.forEach(s => {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
          });
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 3000);
      });
    } catch { this.idb = null; }

    if (this.idb) {
      for (const s of ALL_STORES) {
        try {
          const items: any[] = await new Promise(resolve => {
            const tx = this.idb!.transaction(s, 'readonly');
            const req = tx.objectStore(s).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
          this.mem[s] = items;
        } catch {}
      }
    }
  }

  getAll(store: string): any[] {
    return (this.mem[store] || []).map(i => ({ ...i }));
  }

  put(store: string, data: any): void {
    if (!this.mem[store]) this.mem[store] = [];
    const idx = this.mem[store].findIndex(x => x.id === data.id);
    const copy = { ...data };
    if (idx >= 0) this.mem[store][idx] = copy;
    else this.mem[store].push(copy);
    this._idbPut(store, copy);
  }

  delete(store: string, id: string): void {
    if (this.mem[store]) this.mem[store] = this.mem[store].filter(x => x.id !== id);
    this._idbDelete(store, id);
  }

  private _idbPut(store: string, data: any) {
    if (!this.idb || !this.idb.objectStoreNames.contains(store)) return;
    try { this.idb.transaction(store, 'readwrite').objectStore(store).put(data); } catch {}
  }

  private _idbDelete(store: string, id: string) {
    if (!this.idb || !this.idb.objectStoreNames.contains(store)) return;
    try { this.idb.transaction(store, 'readwrite').objectStore(store).delete(id); } catch {}
  }
}

const localStore = new LocalStore();

// Exported so components can call localDB.getAll() directly (backward compat)
export const localDB = {
  getAll: (col: string): any[] => localStore.getAll(col),
};

// ── Pub/Sub ──────────────────────────────────────────────────────────────────

const subs: Record<string, CB[]> = {};

const broadcast = (col: string) => {
  const data = localStore.getAll(col);
  subs[col]?.forEach(cb => { try { cb(data); } catch {} });
};

// ── Firestore helpers ────────────────────────────────────────────────────────

const normalizeDoc = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  const out: any = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    out[k] = (v && typeof v === 'object' && typeof (v as Timestamp).toDate === 'function')
      ? (v as Timestamp).toDate().toISOString()
      : v;
  }
  return out;
};

const cleanData = (obj: any): any => {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? cleanData(v) : v])
  );
};

const newerWins = (local: any, remote: any): boolean => {
  const lt = new Date(local.updatedAt || local.createdAt || '2000-01-01').getTime();
  const rt = new Date(remote.updatedAt || '2000-01-01').getTime();
  return rt > lt;
};

// ── Firestore real-time listeners ────────────────────────────────────────────

const activeListeners: Record<string, () => void> = {};

const startListener = (col: string) => {
  if (activeListeners[col] || !firestoreAvailable) return;
  try {
    const unsub = onSnapshot(collection(db, col), snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        const raw = { id: change.doc.id, ...change.doc.data() };
        const data = normalizeDoc(raw);

        if (change.type === 'removed') {
          localStore.delete(col, change.doc.id);
          changed = true;
        } else if (change.type === 'modified') {
          // 'modified' means Firestore confirmed a change from any device — always accept
          localStore.put(col, data);
          changed = true;
        } else {
          // 'added' — use newerWins to avoid overwriting local pending offline writes
          const existing = localStore.getAll(col).find(x => x.id === data.id);
          if (!existing || newerWins(existing, data)) {
            localStore.put(col, data);
            changed = true;
          }
        }
      });
      if (changed) broadcast(col);
    }, err => {
      // Do NOT set firestoreAvailable = false here — a listener error is per-collection,
      // not a sign that Firestore is unreachable. Auto-restart after a short delay.
      console.warn(`[DS] Listener ${col} error — will retry in 5 s:`, err.code || err.message);
      delete activeListeners[col];
      setTimeout(() => {
        if (firestoreAvailable) startListener(col);
      }, 5_000);
    });
    activeListeners[col] = unsub;
  } catch (e) {
    console.warn(`[DS] startListener ${col}:`, e);
  }
};

// Starts (or restarts) listeners for every collection that has active subscribers
const restartActiveListeners = () => {
  const cols = Object.keys(subs).filter(c => subs[c].length > 0);
  cols.forEach(col => { if (!activeListeners[col]) startListener(col); });
};

// ── Pending offline queue ─────────────────────────────────────────────────────

const PENDING_KEY = 'rp_pending_fs_v1';
interface PendingItem { col: string; id: string; data: any; action: 'save' | 'remove'; queuedAt?: string; }
let pendingQueue: PendingItem[] = [];

// Removes older than this are skipped — avoids stale offline deletes wiping Firestore
const MAX_PENDING_REMOVE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

const loadPending = () => {
  try { pendingQueue = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { pendingQueue = []; }
};
const savePending = () => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingQueue)); } catch {}
};
const addPending = (col: string, id: string, data: any, action: 'save' | 'remove') => {
  const idx = pendingQueue.findIndex(p => p.col === col && p.id === id);
  const item: PendingItem = { col, id, data, action, queuedAt: new Date().toISOString() };
  if (idx >= 0) pendingQueue[idx] = item;
  else pendingQueue.push(item);
  savePending();
};
const flushPending = async () => {
  if (!pendingQueue.length || !firestoreAvailable) return;
  const now = Date.now();
  const failed: PendingItem[] = [];

  for (const p of pendingQueue) {
    try {
      if (p.action === 'remove') {
        // Safety guard: skip removes queued more than MAX_PENDING_REMOVE_AGE_MS ago.
        // Stale offline deletes would otherwise wipe documents recreated on other devices.
        const queuedAt = p.queuedAt ? new Date(p.queuedAt).getTime() : 0;
        const ageMs = now - queuedAt;
        if (!p.queuedAt || ageMs > MAX_PENDING_REMOVE_AGE_MS) {
          continue; // drop stale remove silently
        }
        await deleteDoc(doc(db, p.col, p.id));
      } else {
        await setDoc(doc(db, p.col, p.id), p.data, { merge: true });
      }
    } catch { failed.push(p); }
  }
  pendingQueue = failed;
  savePending();
  if (failed.length) console.warn(`[DS] flushPending — ${failed.length} items failed, kept in queue`);
};

// ── Connectivity test ────────────────────────────────────────────────────────

let firestoreAvailable = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

// ── Sync-status pub/sub ───────────────────────────────────────────────────────

let currentSyncStatus: SyncStatus = 'syncing';
let lastSyncTs: number | null = null;
const statusCbs: ((s: SyncStatus) => void)[] = [];

const broadcastSyncStatus = (s: SyncStatus) => {
  currentSyncStatus = s;
  if (s === 'synced') lastSyncTs = Date.now();
  statusCbs.forEach(cb => { try { cb(s); } catch {} });
};

const testFirestore = async (): Promise<boolean> => {
  try {
    await getDocs(collection(db, 'settings'));
    return true;
  } catch (e: any) {
    const code = e?.code ?? 'unknown';
    const msg  = e?.message ?? String(e);
    console.error(`[DS] Firestore test FAILED — code: ${code}`);
    console.error(`[DS] Firestore error message: ${msg}`);
    if (code === 'not-found')
      console.error('[DS] ⚠️  La base de datos "gestrepara" no existe en Firebase Console o el projectId es incorrecto.');
    if (code === 'permission-denied')
      console.error('[DS] ⚠️  Reglas de Firestore denegando acceso. Ve a Firebase Console → Firestore → Rules.');
    if (code === 'unavailable' || code === 'deadline-exceeded')
      console.error('[DS] ⚠️  Firestore no alcanzable (red o cuota). Reintentando más tarde.');
    return false;
  }
};

// ── Per-collection sync TTLs ──────────────────────────────────────────────────
//
// Each collection has its own freshness window.  When pullAll() runs at startup
// it only fetches collections whose timestamp has expired — everything else is
// served from the IDB cache (kept live by onSnapshot listeners).
//
// Criteria for TTL length:
//  • Short  (1–2 min)  — changes during active use, wrong data is visible bug
//  • Medium (5 min)    — moderate churn, onSnapshot fills the gap quickly
//  • Long   (10–30 min)— rarely changes, stale risk is low
//
const COL_TTL: Partial<Record<string, number>> = {
  // ── Datos operativos críticos ──────────────────────────────────────────────
  repairs:             2 * 60_000,  // activas durante todo el día
  citas:               2 * 60_000,  // agenda viva
  cash_movements:      1 * 60_000,  // financiero, cambia con cada movimiento
  cierres_caja:        1 * 60_000,  // financiero, causó el bug del historial vacío
  // ── Datos de gestión ──────────────────────────────────────────────────────
  budgets:             5 * 60_000,
  invoices:            5 * 60_000,
  inventory:           5 * 60_000,
  stock_movements:     5 * 60_000,
  warranties:          5 * 60_000,
  // ── Datos de referencia (churn bajo) ──────────────────────────────────────
  customers:          10 * 60_000,
  suppliers:          10 * 60_000,
  informes:           10 * 60_000,
  facturas_importadas: 10 * 60_000,
  correos_procesados:  10 * 60_000,
  correos_analizados:  10 * 60_000,
  facturas_descartadas:10 * 60_000,
  // ── Estáticos ─────────────────────────────────────────────────────────────
  settings:           30 * 60_000,
  apps_externas:      30 * 60_000,
};

const DEFAULT_COL_TTL = 5 * 60_000;
const SYNC_TS_PREFIX  = 'gestrepara_sync_col_'; // per-col key, avoids old global key

const getColTs      = (col: string): number => {
  try { const v = localStorage.getItem(SYNC_TS_PREFIX + col); return v ? parseInt(v, 10) : 0; }
  catch { return 0; }
};
const markColSynced = (col: string) => {
  try { localStorage.setItem(SYNC_TS_PREFIX + col, String(Date.now())); } catch {}
};
const isColFresh    = (col: string): boolean => {
  const ttl = COL_TTL[col] ?? DEFAULT_COL_TTL;
  return Date.now() - getColTs(col) < ttl;
};

// pullAll — fetches only stale collections (or all when force=true),
// then broadcasts every collection so subscribers always get the latest IDB state.
const pullAll = async (force = false) => {
  const toFetch = force ? ALL_STORES : ALL_STORES.filter(col => !isColFresh(col));

  for (const col of toFetch) {
    try {
      const snap = await getDocs(collection(db, col));
      snap.forEach(docSnap => {
        const data = normalizeDoc({ id: docSnap.id, ...docSnap.data() });
        const existing = localStore.getAll(col).find(x => x.id === data.id);
        if (!existing || newerWins(existing, data)) localStore.put(col, data);
      });
      markColSynced(col);
    } catch (e) { console.warn(`[DS] pullAll error on ${col}:`, e); }
  }

  // Always broadcast all collections so subscribers get IDB-cached data immediately
  ALL_STORES.forEach(col => broadcast(col));
};

// ── Public API ────────────────────────────────────────────────────────────────

// Tracks the highest invoice number reserved this session per series.
// Prevents two concurrent nextInvoiceNumber() calls from returning the same number
// before either has written to IDB.
const invoiceReserved: Record<string, number> = {};

export const storage = {
  init: async () => {
    if (initialized) return;
    initialized = true;

    await localStore.init();
    loadPending();

    broadcastSyncStatus('syncing');
    try {
      firestoreAvailable = await testFirestore();
      if (firestoreAvailable) {
        console.log('[DS] Firestore ✅');
        if (pendingQueue.length) await flushPending();
        await pullAll(); // fetches only stale collections; broadcasts all
        restartActiveListeners();
        broadcastSyncStatus('synced');
        console.log('[DS] Sincronización inicial completa ✅');
      } else {
        broadcastSyncStatus('offline');
        console.warn('[DS] Sin conexión — modo local');
      }
    } catch (e) {
      broadcastSyncStatus('offline');
      console.warn('[DS] Error de conexión:', e);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        broadcastSyncStatus('syncing');
        firestoreAvailable = await testFirestore();
        if (firestoreAvailable) {
          await flushPending();
          restartActiveListeners();
          broadcastSyncStatus('synced');
        } else {
          broadcastSyncStatus('offline');
        }
      });
      window.addEventListener('offline', () => {
        firestoreAvailable = false;
        broadcastSyncStatus('offline');
        Object.values(activeListeners).forEach(u => { try { u(); } catch {} });
        Object.keys(activeListeners).forEach(k => delete activeListeners[k]);
      });

      // Restart dead listeners when the tab/app regains focus (e.g., tablet waking up)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;
        if (!firestoreAvailable) {
          firestoreAvailable = await testFirestore();
          broadcastSyncStatus(firestoreAvailable ? 'synced' : 'offline');
        }
        if (firestoreAvailable) restartActiveListeners();
      });

      // Heartbeat every 30 s:
      // - If offline: try to reconnect silently, flush pending, restart listeners
      // - If online: restart any dead listeners
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(async () => {
        if (!firestoreAvailable) {
          firestoreAvailable = await testFirestore();
          if (firestoreAvailable) {
            await flushPending();
            restartActiveListeners();
            broadcastSyncStatus('synced');
          } else {
            broadcastSyncStatus('offline');
          }
          return;
        }
        const cols = Object.keys(subs).filter(c => subs[c].length > 0);
        const dead = cols.filter(c => !activeListeners[c]);
        dead.forEach(startListener);
      }, 30_000);
    }
  },

  isOnline: () => firestoreAvailable,

  subscribe: (col: string, cb: CB): (() => void) => {
    if (!subs[col]) subs[col] = [];
    subs[col].push(cb);
    cb(localStore.getAll(col));
    if (firestoreAvailable) startListener(col);
    return () => {
      subs[col] = (subs[col] || []).filter(fn => fn !== cb);
      if (!subs[col].length && activeListeners[col]) {
        activeListeners[col]();
        delete activeListeners[col];
      }
    };
  },

  save: async (col: string, id: string, data: any): Promise<void> => {
    if (col === 'invoices') {
      const existing = localStore.getAll(col).find((x: any) => x.id === id);
      if (existing?.verifactu?.enviado === true && data.status !== 'anulada') {
        console.warn(`[VeriFactu] Factura ${id} ya enviada a AEAT — solo se permite anulación`);
        return;
      }
    }
    const existing = localStore.getAll(col).find((x: any) => x.id === id);
    const full = { ...(existing || {}), ...data, id, updatedAt: new Date().toISOString() };
    localStore.put(col, full);
    broadcast(col);

    if (firestoreAvailable) {
      try {
        const dataToSave = cleanData({ ...full, _ts: serverTimestamp() });
        await setDoc(doc(db, col, id), dataToSave, { merge: true });
      } catch (e: any) {
        const code = e?.code ?? '';
        console.warn(`[DS] save() write error — ${col}/${id} code: ${code}`, e?.message);
        addPending(col, id, full, 'save');
        // Only mark offline for genuine connectivity failures, not rules/validation errors
        if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') {
          firestoreAvailable = false;
        }
      }
    } else {
      addPending(col, id, full, 'save');
    }
  },

  remove: async (col: string, id: string): Promise<void> => {
    localStore.delete(col, id);
    broadcast(col);

    if (firestoreAvailable) {
      try {
        await deleteDoc(doc(db, col, id));
      } catch (e: any) {
        const code = e?.code ?? '';
        console.warn(`[DS] remove() error — ${col}/${id} code: ${code}`, e?.message);
        addPending(col, id, {}, 'remove');
        if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') {
          firestoreAvailable = false;
        }
      }
    } else {
      addPending(col, id, {}, 'remove');
    }
  },

  syncNow: async (): Promise<{ pulled: number; pushed: number }> => {
    broadcastSyncStatus('syncing');
    firestoreAvailable = await testFirestore();
    if (!firestoreAvailable) {
      broadcastSyncStatus('offline');
      return { pulled: 0, pushed: 0 };
    }

    let pulled = 0, pushed = 0;
    await flushPending();

    for (const col of ALL_STORES) {
      try {
        const snap = await getDocs(collection(db, col));
        let changed = false;
        snap.forEach(docSnap => {
          const data = normalizeDoc({ id: docSnap.id, ...docSnap.data() });
          const existing = localStore.getAll(col).find(x => x.id === data.id);
          if (!existing || newerWins(existing, data)) { localStore.put(col, data); changed = true; }
        });
        markColSynced(col); // reset TTL so next startup skips this collection
        if (changed) { broadcast(col); pulled++; }

        const localItems = localStore.getAll(col);
        for (const item of localItems) {
          try { await setDoc(doc(db, col, item.id), item, { merge: true }); pushed++; } catch {}
        }
      } catch (e) { console.warn(`[DS] syncNow() error on ${col}:`, e); }
    }

    restartActiveListeners();
    broadcastSyncStatus('synced');
    return { pulled, pushed };
  },

  nextRmaNumber: (): number => {
    return localStore.getAll('repairs').reduce((m: number, r: any) => Math.max(m, r.rmaNumber || 0), 0) + 1;
  },

  nextInvoiceNumber: (type: 'FAC' | 'REC'): string => {
    const prefix = type === 'REC' ? 'REC-' : 'FAC-';
    const nums = localStore.getAll('invoices')
      .filter((i: any) => (i.invoiceNumber || '').startsWith(prefix))
      .map((i: any) => parseInt((i.invoiceNumber || '').replace(/\D/g, '') || '0'))
      .filter(Boolean);
    const dbMax = nums.length ? Math.max(...nums) : 0;
    // Also check in-memory reservations so concurrent calls in the same tick
    // (e.g. double-click or Despacho + Facturacion race) never return the same number.
    const reserved = invoiceReserved[type] ?? 0;
    const next = Math.max(dbMax, reserved) + 1;
    invoiceReserved[type] = next;
    return `${prefix}${String(next).padStart(5, '0')}`;
  },

  onStatusChange: (cb: (s: SyncStatus) => void): (() => void) => {
    statusCbs.push(cb);
    cb(currentSyncStatus);
    return () => {
      const i = statusCbs.indexOf(cb);
      if (i >= 0) statusCbs.splice(i, 1);
    };
  },

  getSyncStatus: (): SyncStatus => currentSyncStatus,
  getLastSyncTs: (): number | null => lastSyncTs,

  // Pull a single collection from Firestore and broadcast, bypassing the sync-TTL cache.
  // Use this when the component needs guaranteed-fresh data (e.g., historial de cierres).
  refreshCollection: async (col: string): Promise<void> => {
    if (!firestoreAvailable) {
      firestoreAvailable = await testFirestore();
      if (!firestoreAvailable) return;
    }
    try {
      const snap = await getDocs(collection(db, col));
      snap.forEach(docSnap => {
        const data = normalizeDoc({ id: docSnap.id, ...docSnap.data() });
        localStore.put(col, data);
      });
      markColSynced(col);
      broadcast(col);
    } catch (e) { console.warn(`[DS] refreshCollection(${col}):`, e); }
  },

  exportData: async (): Promise<string> => {
    const BACKUP_COLS = [
      'repairs', 'budgets', 'invoices', 'cash_movements',
      'inventory', 'stock_movements', 'warranties', 'customers',
      'settings', 'citas', 'apps_externas',
      'correos_analizados', 'correos_procesados',
      'facturas_importadas', 'facturas_descartadas', 'suppliers', 'informes', 'cierres_caja',
    ];
    const result: Record<string, any> = { exportDate: new Date().toISOString(), version: 'v2-full' };
    for (const col of BACKUP_COLS) result[col] = localStore.getAll(col);
    return JSON.stringify(result, null, 2);
  },
};
