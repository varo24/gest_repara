/**
 * LocalDB v2 — Memory-First Architecture
 * 
 * CRITICAL DESIGN: memoryStore is the SINGLE SOURCE OF TRUTH.
 * - getAll() ALWAYS reads from memoryStore (never directly from IDB)
 * - put() writes to memoryStore FIRST, then mirrors to IDB in background
 * - IDB is used ONLY for persistence across page reloads
 * - On init, IDB data is loaded INTO memoryStore
 * 
 * This eliminates all race conditions between IDB transactions.
 */

const DB_NAME = 'ReparaPro_LocalDB';
const DB_VERSION = 5;

export class LocalDB {
  private db: IDBDatabase | null = null;
  private memoryStore: Record<string, any[]> = {};
  private idbAvailable = false;
  private initialized = false;

  async init(): Promise<void> {
    // Initialize memory stores
    const stores = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas'];
    stores.forEach(s => { if (!this.memoryStore[s]) this.memoryStore[s] = []; });

    if (typeof indexedDB === 'undefined') {
      console.warn('[LocalDB] IndexedDB no disponible');
      this.initialized = true;
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          stores.forEach(s => {
            if (!db.objectStoreNames.contains(s)) {
              db.createObjectStore(s, { keyPath: 'id' });
            }
          });
        };

        request.onsuccess = async (event: any) => {
          this.db = event.target.result;
          this.idbAvailable = true;
          console.log('[LocalDB] IndexedDB OK');

          // Load IDB data into memoryStore
          for (const storeName of stores) {
            try {
              const data = await this._idbGetAll(storeName);
              this.memoryStore[storeName] = data;
            } catch (e) {
              console.warn(`[LocalDB] Failed to load ${storeName} from IDB`);
            }
          }
          this.initialized = true;
          resolve();
        };

        request.onerror = () => {
          console.warn('[LocalDB] IDB error, memory-only mode');
          this.initialized = true;
          resolve();
        };

        request.onblocked = () => {
          console.warn('[LocalDB] IDB blocked, memory-only mode');
          this.initialized = true;
          resolve();
        };
      } catch (e) {
        console.warn('[LocalDB] Exception:', e);
        this.initialized = true;
        resolve();
      }
    });
  }

  // ALWAYS reads from memoryStore — instant, no async IDB issues
  async getAll(storeName: string): Promise<any[]> {
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = [];
    // Return a shallow copy so React detects changes
    return this.memoryStore[storeName].map(item => ({ ...item }));
  }

  // Writes to memoryStore FIRST (synchronous), then mirrors to IDB (background)
  async put(storeName: string, data: any): Promise<void> {
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = [];

    // 1. Update memoryStore immediately (synchronous)
    const idx = this.memoryStore[storeName].findIndex((x: any) => x.id === data.id);
    if (idx >= 0) {
      this.memoryStore[storeName][idx] = { ...data };
    } else {
      this.memoryStore[storeName].push({ ...data });
    }

    // 2. Mirror to IDB in background (don't block on this)
    if (this.idbAvailable && this.db) {
      this._idbPut(storeName, data).catch(e => {
        console.warn(`[LocalDB] IDB mirror failed for ${storeName}:`, e);
      });
    }
  }

  async delete(storeName: string, id: string): Promise<void> {
    if (this.memoryStore[storeName]) {
      this.memoryStore[storeName] = this.memoryStore[storeName].filter((x: any) => x.id !== id);
    }

    if (this.idbAvailable && this.db) {
      this._idbDelete(storeName, id).catch(() => {});
    }
  }

  // ── Private IDB operations ──

  private _idbGetAll(storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  private _idbPut(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  private _idbDelete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }
}

export const localDB = new LocalDB();
