
/**
 * LocalDB - Motor de persistencia basado en IndexedDB
 * Con fallback a memoria si IndexedDB no está disponible
 */

const DB_NAME = 'ReparaPro_LocalDB';
const DB_VERSION = 5;

export class LocalDB {
  private db: IDBDatabase | null = null;
  private memoryStore: Record<string, any[]> = {
    repairs: [],
    budgets: [],
    settings: [],
    citas: [],
    apps_externas: [],
  };
  private useMemory = false;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      console.warn('[LocalDB] IndexedDB no disponible, usando memoria');
      this.useMemory = true;
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('repairs')) {
            db.createObjectStore('repairs', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('budgets')) {
            db.createObjectStore('budgets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('citas')) {
            db.createObjectStore('citas', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('apps_externas')) {
            db.createObjectStore('apps_externas', { keyPath: 'id' });
          }
        };

        request.onsuccess = (event: any) => {
          this.db = event.target.result;
          console.log('[LocalDB] IndexedDB inicializado OK');
          resolve();
        };

        request.onerror = () => {
          console.warn('[LocalDB] Error abriendo IndexedDB, usando memoria');
          this.useMemory = true;
          resolve();
        };

        request.onblocked = () => {
          console.warn('[LocalDB] IndexedDB bloqueado, usando memoria');
          this.useMemory = true;
          resolve();
        };
      } catch (e) {
        console.warn('[LocalDB] Excepcion al abrir IndexedDB:', e);
        this.useMemory = true;
        resolve();
      }
    });
  }

  async getAll(storeName: string): Promise<any[]> {
    if (this.useMemory || !this.db) {
      return [...(this.memoryStore[storeName] || [])];
    }
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(this.memoryStore[storeName] || []);
      } catch (e) {
        resolve(this.memoryStore[storeName] || []);
      }
    });
  }

  async put(storeName: string, data: any): Promise<void> {
    if (!this.memoryStore[storeName]) this.memoryStore[storeName] = [];
    const idx = this.memoryStore[storeName].findIndex((x: any) => x.id === data.id);
    if (idx >= 0) {
      this.memoryStore[storeName][idx] = data;
    } else {
      this.memoryStore[storeName].push(data);
    }

    if (this.useMemory || !this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(data);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    if (this.memoryStore[storeName]) {
      this.memoryStore[storeName] = this.memoryStore[storeName].filter((x: any) => x.id !== id);
    }

    if (this.useMemory || !this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }
}

export const localDB = new LocalDB();
