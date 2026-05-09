// dataService.ts — Firestore backend + IndexedDB offline cache
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

type CB = (data: any[]) => void;

// ── IndexedDB local cache ────────────────────────────────────────────────────

const DB_NAME = 'ReparaPro_LocalDB';
const DB_VERSION = 8;
const ALL_STORES = [
  'repairs', 'budgets', 'invoices', 'cash_movements', 'inventory',
  'inventory_entries', 'purchase_orders', 'warranties', 'time_entries',
  'customers', 'appointments', 'reminders', 'surveys', 'settings',
  'stock_movements',
  // legacy collections
  'citas', 'apps_externas',
  // correos
  'correos_procesados',
  'facturas_importadas',
  'correos_analizados',
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
    console.log(`[dataService] IDB: ${this.idb ? 'OK' : 'NO'}`);
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
  console.log(`[DS] startListener — ${col}`);
  try {
    const unsub = onSnapshot(collection(db, col), snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        const raw = { id: change.doc.id, ...change.doc.data() };
        const data = normalizeDoc(raw);

        if (change.type === 'removed') {
          console.log(`[DS] onSnapshot REMOVED — ${col}/${change.doc.id}`);
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
  console.log(`[DS] flushPending — ${pendingQueue.length} items`, navigator.userAgent.slice(0, 80));

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
          console.warn(`[DS] flushPending — SKIPPING stale remove: ${p.col}/${p.id} (queued ${Math.round(ageMs / 60000)} min ago)`);
          continue; // drop stale remove silently
        }
        console.log(`[DS] flushPending — remove ${p.col}/${p.id}`);
        await deleteDoc(doc(db, p.col, p.id));
      } else {
        console.log(`[DS] flushPending — save ${p.col}/${p.id}`);
        await setDoc(doc(db, p.col, p.id), p.data, { merge: true });
      }
    } catch { failed.push(p); }
  }
  pendingQueue = failed;
  savePending();
  if (!failed.length) console.log('[DS] Pending queue flushed ✅');
  else console.warn(`[DS] flushPending — ${failed.length} items failed, kept in queue`);
};

// ── Connectivity test ────────────────────────────────────────────────────────

let firestoreAvailable = false;
let initialized = false;

const testFirestore = async (): Promise<boolean> => {
  try {
    console.log('[DS] Testing Firestore connection (db: gestrepara)...');
    await getDocs(collection(db, 'settings'));
    console.log('[DS] Firestore OK ✅');
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

// ── Initial Firestore pull ────────────────────────────────────────────────────

const pullAll = async () => {
  let totalDocs = 0;
  for (const col of ALL_STORES) {
    try {
      const snap = await getDocs(collection(db, col));
      totalDocs += snap.size;
      snap.forEach(docSnap => {
        const data = normalizeDoc({ id: docSnap.id, ...docSnap.data() });
        const existing = localStore.getAll(col).find(x => x.id === data.id);
        if (!existing || newerWins(existing, data)) localStore.put(col, data);
      });
      if (snap.size > 0) console.log(`[DS] pullAll — ${col}: ${snap.size} docs`);
    } catch (e) { console.warn(`[DS] pullAll error on ${col}:`, e); }
  }
  console.log(`[DS] pullAll complete — ${totalDocs} total docs from Firestore`);
  ALL_STORES.forEach(col => broadcast(col));
};

// ── Public API ────────────────────────────────────────────────────────────────

export const storage = {
  init: async () => {
    if (initialized) return;
    initialized = true;

    console.log('[DS] init() called —', navigator.userAgent.slice(0, 100));
    await localStore.init();
    loadPending();
    console.log(`[DS] init() — IDB loaded, pending queue: ${pendingQueue.length} items`);
    if (pendingQueue.length) {
      const removes = pendingQueue.filter(p => p.action === 'remove');
      const saves   = pendingQueue.filter(p => p.action === 'save');
      console.log(`[DS] init() — pending: ${saves.length} saves, ${removes.length} removes`);
      removes.forEach(p => console.log(`[DS] init() — pending remove: ${p.col}/${p.id} queued at ${p.queuedAt || 'UNKNOWN'}`));
    }

    try {
      firestoreAvailable = await testFirestore();
      if (firestoreAvailable) {
        console.log('[DS] Firestore ✅ — descargando datos...');
        if (pendingQueue.length) await flushPending();
        await pullAll();
        // Start real-time listeners for all collections already subscribed by components
        restartActiveListeners();
        console.log('[DS] Sincronización inicial completa ✅');
      } else {
        console.warn('[DS] Sin conexión — modo local');
      }
    } catch (e) { console.warn('[DS] Error de conexión:', e); }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        firestoreAvailable = await testFirestore();
        if (firestoreAvailable) {
          await flushPending();
          restartActiveListeners();
        }
      });
      window.addEventListener('offline', () => {
        firestoreAvailable = false;
        Object.values(activeListeners).forEach(u => { try { u(); } catch {} });
        Object.keys(activeListeners).forEach(k => delete activeListeners[k]);
      });

      // Restart dead listeners when the tab/app regains focus (e.g., tablet waking up)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;
        if (!firestoreAvailable) firestoreAvailable = await testFirestore();
        if (firestoreAvailable) restartActiveListeners();
      });

      // Heartbeat every 30 s:
      // - If offline: try to reconnect, flush pending, restart listeners
      // - If online: restart any dead listeners
      setInterval(async () => {
        if (!firestoreAvailable) {
          console.log('[DS] Heartbeat — offline, attempting reconnect...');
          firestoreAvailable = await testFirestore();
          if (firestoreAvailable) {
            console.log('[DS] Heartbeat — reconnected ✅');
            await flushPending();
            restartActiveListeners();
          }
          return;
        }
        const cols = Object.keys(subs).filter(c => subs[c].length > 0);
        const dead = cols.filter(c => !activeListeners[c]);
        if (dead.length > 0) {
          console.log('[DS] Heartbeat — restarting dead listeners:', dead);
          dead.forEach(startListener);
        }
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
    firestoreAvailable = await testFirestore();
    if (!firestoreAvailable) return { pulled: 0, pushed: 0 };

    let pulled = 0, pushed = 0;
    console.log('[DS] syncNow() started —', navigator.userAgent.slice(0, 80));
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
        if (changed) { broadcast(col); pulled++; }

        const localItems = localStore.getAll(col);
        console.log(`[DS] syncNow() — ${col}: pulling ${snap.size} remote, pushing ${localItems.length} local`);
        for (const item of localItems) {
          try { await setDoc(doc(db, col, item.id), item, { merge: true }); pushed++; } catch {}
        }
      } catch (e) { console.warn(`[DS] syncNow() error on ${col}:`, e); }
    }

    console.log(`[DS] syncNow() complete — pulled: ${pulled} cols, pushed: ${pushed} docs`);
    restartActiveListeners();
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
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  },

  exportData: async (): Promise<string> => {
    const BACKUP_COLS = [
      'repairs', 'budgets', 'invoices', 'cash_movements',
      'inventory', 'stock_movements', 'warranties', 'customers',
      'appointments', 'reminders', 'surveys', 'settings',
      'citas', 'apps_externas', 'inventory_entries', 'purchase_orders',
    ];
    const result: Record<string, any> = { exportDate: new Date().toISOString(), version: 'v2-full' };
    for (const col of BACKUP_COLS) result[col] = localStore.getAll(col);
    return JSON.stringify(result, null, 2);
  },
};
