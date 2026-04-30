// dataService.ts — Firestore backend + IndexedDB offline cache
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

type CB = (data: any[]) => void;

// ── IndexedDB local cache ────────────────────────────────────────────────────

const DB_NAME = 'ReparaPro_LocalDB';
const DB_VERSION = 7;
const ALL_STORES = [
  'repairs', 'budgets', 'invoices', 'cash_movements', 'inventory',
  'inventory_entries', 'purchase_orders', 'warranties', 'time_entries',
  'customers', 'appointments', 'reminders', 'surveys', 'settings',
  'stock_movements',
  // legacy collections
  'citas', 'apps_externas',
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
        } else {
          const existing = localStore.getAll(col).find(x => x.id === data.id);
          if (!existing || newerWins(existing, data)) {
            localStore.put(col, data);
            changed = true;
          }
        }
      });
      if (changed) broadcast(col);
    }, err => {
      console.warn(`[dataService] Listener ${col}:`, err);
      firestoreAvailable = false;
      delete activeListeners[col];
    });
    activeListeners[col] = unsub;
  } catch (e) {
    console.warn(`[dataService] startListener ${col}:`, e);
  }
};

const restartActiveListeners = () => {
  const cols = Object.keys(subs).filter(c => subs[c].length > 0);
  cols.forEach(col => {
    if (!activeListeners[col]) startListener(col);
  });
};

// ── Pending offline queue ─────────────────────────────────────────────────────

const PENDING_KEY = 'rp_pending_fs_v1';
interface PendingItem { col: string; id: string; data: any; action: 'save' | 'remove'; }
let pendingQueue: PendingItem[] = [];

const loadPending = () => {
  try { pendingQueue = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { pendingQueue = []; }
};
const savePending = () => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingQueue)); } catch {}
};
const addPending = (col: string, id: string, data: any, action: 'save' | 'remove') => {
  const idx = pendingQueue.findIndex(p => p.col === col && p.id === id);
  if (idx >= 0) pendingQueue[idx] = { col, id, data, action };
  else pendingQueue.push({ col, id, data, action });
  savePending();
};
const flushPending = async () => {
  if (!pendingQueue.length || !firestoreAvailable) return;
  const failed: PendingItem[] = [];
  for (const p of pendingQueue) {
    try {
      if (p.action === 'remove') await deleteDoc(doc(db, p.col, p.id));
      else await setDoc(doc(db, p.col, p.id), p.data, { merge: true });
    } catch { failed.push(p); }
  }
  pendingQueue = failed;
  savePending();
  if (!failed.length) console.log('[dataService] Pending queue flushed ✅');
};

// ── Connectivity test ────────────────────────────────────────────────────────

let firestoreAvailable = false;
let initialized = false;

const testFirestore = async (): Promise<boolean> => {
  try {
    await getDocs(collection(db, 'settings'));
    return true;
  } catch {
    return false;
  }
};

// ── Initial Firestore pull ────────────────────────────────────────────────────

const pullAll = async () => {
  for (const col of ALL_STORES) {
    try {
      const snap = await getDocs(collection(db, col));
      snap.forEach(docSnap => {
        const data = normalizeDoc({ id: docSnap.id, ...docSnap.data() });
        const existing = localStore.getAll(col).find(x => x.id === data.id);
        if (!existing || newerWins(existing, data)) localStore.put(col, data);
      });
    } catch {}
  }
  ALL_STORES.forEach(col => broadcast(col));
};

// ── Public API ────────────────────────────────────────────────────────────────

export const storage = {
  init: async () => {
    if (initialized) return;
    initialized = true;

    await localStore.init();
    loadPending();

    try {
      firestoreAvailable = await testFirestore();
      if (firestoreAvailable) {
        console.log('[dataService] Firestore ✅ — descargando datos...');
        if (pendingQueue.length) await flushPending();
        await pullAll();
        console.log('[dataService] Sincronización inicial completa ✅');
      } else {
        console.warn('[dataService] Sin conexión — modo local');
      }
    } catch { console.warn('[dataService] Error de conexión'); }

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
        await setDoc(doc(db, col, id), full, { merge: true });
      } catch {
        firestoreAvailable = false;
        addPending(col, id, full, 'save');
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
      } catch {
        addPending(col, id, {}, 'remove');
      }
    } else {
      addPending(col, id, {}, 'remove');
    }
  },

  syncNow: async (): Promise<{ pulled: number; pushed: number }> => {
    firestoreAvailable = await testFirestore();
    if (!firestoreAvailable) return { pulled: 0, pushed: 0 };

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
        if (changed) { broadcast(col); pulled++; }

        for (const item of localStore.getAll(col)) {
          try { await setDoc(doc(db, col, item.id), item, { merge: true }); pushed++; } catch {}
        }
      } catch {}
    }

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
    const BACKUP_COLS = ['repairs', 'budgets', 'invoices', 'cash_movements', 'inventory', 'customers', 'warranties', 'settings'];
    const result: Record<string, any> = { exportDate: new Date().toISOString(), version: 'v1-firestore' };
    for (const col of BACKUP_COLS) result[col] = localStore.getAll(col);
    return JSON.stringify(result, null, 2);
  },
};
