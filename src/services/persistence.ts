// ============================================================
// ReparaPro — Persistence v11 — RELIABLE MULTI-DEVICE SYNC
//
// Features:
// 1. On startup: IDB → memory → UI, then pull from Supabase + merge
// 2. Every save: memory + IDB + Supabase
// 3. RETRY QUEUE: if Supabase save fails, record goes to pending queue
//    Queue is persisted in IDB so it survives page close
//    Auto-flushes when connection recovers
// 4. Connection monitor: checks every 30s, flushes queue when back online
// 5. ZERO polling of data — no status revert bug
// ============================================================

import { localDB } from './localDB';
import { supabase } from './supabaseService';

type CB = (data: any[]) => void;
const subs: Record<string, CB[]> = {};
let supabaseAvailable = false;
let initialized = false;

const COLLECTIONS = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas'] as const;
const tableFor = (col: string) => col === 'settings' ? 'rp_settings' : col;
const PENDING_KEY = 'rp_pending_sync';

// ── Pending sync queue (survives page reload) ──
interface PendingItem { col: string; record: any; timestamp: number; }
let pendingQueue: PendingItem[] = [];

const loadPendingQueue = () => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    pendingQueue = raw ? JSON.parse(raw) : [];
    if (pendingQueue.length > 0) console.log(`[Sync] ${pendingQueue.length} operaciones pendientes en cola`);
  } catch { pendingQueue = []; }
};

const savePendingQueue = () => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingQueue)); } catch {}
};

const addToPending = (col: string, record: any) => {
  // Replace if same col+id already in queue
  const idx = pendingQueue.findIndex(p => p.col === col && p.record?.id === record?.id);
  if (idx >= 0) pendingQueue[idx] = { col, record, timestamp: Date.now() };
  else pendingQueue.push({ col, record, timestamp: Date.now() });
  savePendingQueue();
  console.log(`[Sync] ⏳ Añadido a cola pendiente: ${col}/${record.id} (${pendingQueue.length} en cola)`);
};

const flushPendingQueue = async (): Promise<number> => {
  if (pendingQueue.length === 0) return 0;
  console.log(`[Sync] Procesando ${pendingQueue.length} operaciones pendientes...`);
  const failed: PendingItem[] = [];
  let ok = 0;

  for (const item of pendingQueue) {
    const { _rowId, ...clean } = item.record;
    const success = await supabase.save(tableFor(item.col), clean);
    if (success) { ok++; }
    else { failed.push(item); }
  }

  pendingQueue = failed;
  savePendingQueue();
  if (ok > 0) console.log(`[Sync] ✅ ${ok} operaciones sincronizadas, ${failed.length} pendientes`);
  return ok;
};

// ── Broadcast ──
const broadcast = (col: string) => {
  const data = localDB.getAll(col);
  subs[col]?.forEach(cb => { try { cb(data); } catch (e) { console.error('[broadcast]', e); } });
};

// ── Merge remote into local ──
const mergeRemoteData = (col: string, remoteItems: any[]): boolean => {
  let changed = false;
  const localItems = localDB.getAll(col);
  const localMap = new Map(localItems.map(item => [item.id, item]));

  for (const remoteRaw of remoteItems) {
    const { _rowId, ...remote } = remoteRaw;
    if (!remote.id) continue;
    const local = localMap.get(remote.id);

    if (!local) {
      localDB.put(col, remote);
      changed = true;
    } else {
      const lt = new Date(local.updatedAt || '2000-01-01').getTime();
      const rt = new Date(remote.updatedAt || '2000-01-01').getTime();
      if (rt > lt) { localDB.put(col, remote); changed = true; }
    }
  }
  return changed;
};

// ── Cloud write with retry ──
const syncToCloud = async (col: string, record: any): Promise<boolean> => {
  if (!supabaseAvailable) {
    addToPending(col, record);
    return false;
  }
  const { _rowId, ...clean } = record;
  const ok = await supabase.save(tableFor(col), clean);
  if (!ok) addToPending(col, record);
  return ok;
};

const syncDeleteToCloud = (col: string, id: string) => {
  if (!supabaseAvailable) return;
  supabase.remove(tableFor(col), id).catch(() => {});
};

// ── Connection monitor ──
let monitorTimer: ReturnType<typeof setInterval> | null = null;

const startConnectionMonitor = () => {
  if (monitorTimer) return;
  monitorTimer = setInterval(async () => {
    const wasOnline = supabaseAvailable;
    const isOnline = await supabase.test();
    supabaseAvailable = isOnline;

    if (!wasOnline && isOnline) {
      console.log('[Sync] 🔄 Conexión recuperada — sincronizando cola pendiente...');
      await flushPendingQueue();
    }
  }, 30000); // Check every 30 seconds
};

// Also flush when browser comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[Sync] 🌐 Navegador online — comprobando Supabase...');
    const ok = await supabase.test();
    supabaseAvailable = ok;
    if (ok) flushPendingQueue();
  });
}

export const storage = {
  init: async () => {
    if (initialized) { console.log('[Storage] Already initialized'); return; }
    initialized = true;

    await localDB.init();
    loadPendingQueue();

    try {
      const ok = await supabase.test();
      supabaseAvailable = ok;

      if (ok) {
        console.log('[Storage] Supabase ✅ — sincronizando...');

        // Flush any pending operations first
        if (pendingQueue.length > 0) await flushPendingQueue();

        // Pull + merge from Supabase
        for (const col of COLLECTIONS) {
          try {
            const remote = await supabase.getAll(tableFor(col));
            if (remote.length > 0) {
              const changed = mergeRemoteData(col, remote);
              if (changed) {
                console.log(`[Storage] ↓ Merged ${col} from cloud`);
                broadcast(col);
              }
            }
            // Push local to cloud
            const locals = localDB.getAll(col);
            const table = tableFor(col);
            for (const item of locals) {
              const { _rowId, ...clean } = item;
              await supabase.save(table, clean);
            }
          } catch (e) { console.warn(`[Storage] Sync ${col}:`, e); }
        }

        console.log('[Storage] Sincronización completa ✅');
      } else {
        console.warn('[Storage] Supabase no disponible — modo local (cola activa)');
      }
    } catch {
      console.warn('[Storage] Error de conexión — modo local');
    }

    startConnectionMonitor();
  },

  isOnline: () => supabaseAvailable,
  getPendingCount: () => pendingQueue.length,

  subscribe: (col: string, cb: CB): (() => void) => {
    if (!subs[col]) subs[col] = [];
    subs[col].push(cb);
    cb(localDB.getAll(col));
    return () => { subs[col] = (subs[col] || []).filter(fn => fn !== cb); };
  },

  save: async (col: string, id: string, data: any): Promise<void> => {
    console.log(`[Storage] SAVE ${col}/${id}`);

    const existing = localDB.getAll(col).find((x: any) => x.id === id);
    const { _rowId, ...cleanData } = data;
    const full: any = { ...(existing || {}), ...cleanData, id, updatedAt: new Date().toISOString() };
    delete full._rowId;

    localDB.put(col, full);
    broadcast(col);
    syncToCloud(col, full);
  },

  remove: async (col: string, id: string): Promise<void> => {
    localDB.delete(col, id);
    broadcast(col);
    syncDeleteToCloud(col, id);
  },

  syncNow: async (): Promise<{ pulled: number; pushed: number }> => {
    let pulled = 0, pushed = 0;

    // Re-test connection
    supabaseAvailable = await supabase.test();
    if (!supabaseAvailable) return { pulled: 0, pushed: 0 };

    // Flush pending queue first
    const flushed = await flushPendingQueue();
    if (flushed > 0) pushed++;

    for (const col of COLLECTIONS) {
      try {
        // Pull
        const remote = await supabase.getAll(tableFor(col));
        if (remote.length > 0) {
          const changed = mergeRemoteData(col, remote);
          if (changed) { broadcast(col); pulled++; }
        }
        // Push
        const locals = localDB.getAll(col);
        for (const item of locals) {
          const { _rowId, ...clean } = item;
          await supabase.save(tableFor(col), clean);
        }
        if (locals.length > 0) pushed++;
      } catch { /* skip */ }
    }

    return { pulled, pushed };
  },

  exportData: async () => {
    return JSON.stringify({
      repairs: localDB.getAll('repairs'),
      budgets: localDB.getAll('budgets'),
      settings: localDB.getAll('settings'),
      citas: localDB.getAll('citas'),
      apps_externas: localDB.getAll('apps_externas'),
      exportDate: new Date().toISOString(),
    }, null, 2);
  },

  forceBackup: async (): Promise<boolean> => {
    try {
      return await supabase.saveBackup({
        repairs: localDB.getAll('repairs'),
        budgets: localDB.getAll('budgets'),
        settings: localDB.getAll('settings'),
        backupDate: new Date().toISOString(),
        version: 'v11',
      });
    } catch { return false; }
  },

  nextRmaNumber: (): number => {
    const repairs = localDB.getAll('repairs');
    return repairs.reduce((m: number, r: any) => Math.max(m, r.rmaNumber || 0), 0) + 1;
  },
};
