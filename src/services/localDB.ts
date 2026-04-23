/**
 * LocalDB v3 — Ultra-simple memory store with IDB persistence.
 * Memory is ALWAYS the source of truth. IDB is only for reload persistence.
 */

const DB_NAME = 'ReparaPro_LocalDB';
const DB_VERSION = 6;
const STORES = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas', 'customers'];

class LocalDB {
  private mem: Record<string, any[]> = {};
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    STORES.forEach(s => { this.mem[s] = []; });

    // Try to open IDB
    try {
      this.db = await new Promise<IDBDatabase | null>((resolve) => {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
        setTimeout(() => resolve(null), 3000); // timeout fallback
      });
    } catch { this.db = null; }

    // Load IDB → memory
    if (this.db) {
      for (const s of STORES) {
        try {
          const items: any[] = await new Promise((resolve) => {
            const tx = this.db!.transaction(s, 'readonly');
            const req = tx.objectStore(s).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
          this.mem[s] = items;
          console.log(`[DB] Loaded ${items.length} ${s} from IDB`);
        } catch { /* skip */ }
      }
    }
    console.log(`[DB] Init complete. IDB: ${this.db ? 'YES' : 'NO'}`);
  }

  getAll(store: string): any[] {
    return (this.mem[store] || []).map(item => ({ ...item }));
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
    if (this.mem[store]) {
      this.mem[store] = this.mem[store].filter(x => x.id !== id);
    }
    this._idbDelete(store, id);
  }

  private _idbPut(store: string, data: any) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
    } catch { /* IDB error — memory is still correct */ }
  }

  private _idbDelete(store: string, id: string) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
    } catch { /* memory is still correct */ }
  }
}

export const localDB = new LocalDB();
