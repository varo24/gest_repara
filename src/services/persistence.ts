// ============================================================
// ReparaPro — Persistence v12 — DEFINITIVE SYNC
//
// ROOT CAUSE FIXED: On init, Terminal B was pushing its OLD
// local data to Supabase, overwriting Terminal A's newer data.
//
// RULES:
// 1. Init: ONLY PULL from Supabase → merge into local (newer wins)
//    NEVER push local to cloud on init
// 2. save(): write local + push THIS record to Supabase
// 3. syncNow(): pull from cloud, then push ONLY records that
//    are newer locally than in Supabase
// 4. Retry queue for failed saves
// ============================================================

import { localDB } from './localDB';
import { supabase } from './supabaseService';

type CB = (data: any[]) => void;
const subs: Record<string, CB[]> = {};
let supabaseAvailable = false;
let initialized = false;

const COLLECTIONS = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas', 'customers'] as const;
const tableFor = (col: string) => col === 'settings' ? 'rp_settings' : col;
const PENDING_KEY = 'rp_pending_sync';

// ── Pending queue ──
interface PendingItem { col: string; record: any; }
let pendingQueue: PendingItem[] = [];

const loadPending = () => {
  try { pendingQueue = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
  catch { pendingQueue = []; }
};
const savePending = () => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingQueue)); } catch {}
};
const addPending = (col: string, record: any) => {
  const idx = pendingQueue.findIndex(p => p.col === col && p.record?.id === record?.id);
  if (idx >= 0) pendingQueue[idx] = { col, record };
  else pendingQueue.push({ col, record });
  savePending();
  console.log(`[Sync] ⏳ Pendiente: ${col}/${record.id} (${pendingQueue.length} en cola)`);
};
const flushPending = async (): Promise<number> => {
  if (!pendingQueue.length) return 0;
  console.log(`[Sync] Procesando ${pendingQueue.length} pendientes...`);
  const failed: PendingItem[] = [];
  let ok = 0;
  for (const p of pendingQueue) {
    const { _rowId, _remoteUpdatedAt, ...clean } = p.record;
    if (await supabase.save(tableFor(p.col), clean)) ok++;
    else failed.push(p);
  }
  pendingQueue = failed;
  savePending();
  if (ok) console.log(`[Sync] ✅ ${ok} enviados, ${failed.length} pendientes`);
  return ok;
};

// ── Broadcast ──
const broadcast = (col: string) => {
  const data = localDB.getAll(col);
  subs[col]?.forEach(cb => { try { cb(data); } catch {} });
};

// ── Merge: remote wins if newer OR if local doesn't have the record ──
const mergeRemote = (col: string, remoteItems: any[]): boolean => {
  let changed = false;
  const localMap = new Map(localDB.getAll(col).map(i => [i.id, i]));

  for (const raw of remoteItems) {
    const { _rowId, _remoteUpdatedAt, ...remote } = raw;
    if (!remote.id) continue;
    const local = localMap.get(remote.id);

    if (!local) {
      // New record from another terminal
      localDB.put(col, remote);
      changed = true;
    } else {
      // Use updatedAt from inside data, fallback to _remoteUpdatedAt from Supabase row
      const lt = new Date(local.updatedAt || local.createdAt || '2000-01-01').getTime();
      const rt = new Date(remote.updatedAt || _remoteUpdatedAt || '2000-01-01').getTime();
      if (rt > lt) {
        localDB.put(col, remote);
        changed = true;
      }
    }
  }
  return changed;
};

// ── Cloud write with retry ──
const syncToCloud = async (col: string, record: any): Promise<void> => {
  if (!supabaseAvailable) { addPending(col, record); return; }
  const { _rowId, _remoteUpdatedAt, ...clean } = record;
  const ok = await supabase.save(tableFor(col), clean);
  if (!ok) addPending(col, record);
};

// ── Auto-Sync: pull changes every 15s + connection monitor ──
const AUTO_SYNC_INTERVAL = 15000; // 15 seconds
let monitor: ReturnType<typeof setInterval> | null = null;
let autoSync: ReturnType<typeof setInterval> | null = null;
let isSyncing = false; // prevent overlapping syncs

const autoSyncPull = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    // Re-check connection on every pull (don't rely on stale flag)
    supabaseAvailable = await supabase.test();
    if (!supabaseAvailable) {
      isSyncing = false;
      return;
    }

    let anyChanged = false;
    let totalPulled = 0;
    for (const col of COLLECTIONS) {
      try {
        const remote = await supabase.getAll(tableFor(col));
        if (remote.length > 0) {
          totalPulled += remote.length;
          const changed = mergeRemote(col, remote);
          if (changed) {
            broadcast(col);
            anyChanged = true;
            console.log(`[AutoSync] ↓ ${col} actualizado`);
          }
        }
      } catch (e) {
        console.warn(`[AutoSync] Error en ${col}:`, e);
      }
    }
    // Also flush any pending saves
    if (pendingQueue.length > 0) await flushPending();
    if (anyChanged) console.log(`[AutoSync] ✅ Datos actualizados (${totalPulled} registros revisados)`);
  } catch (e) {
    console.warn('[AutoSync] Error general:', e);
  } finally {
    isSyncing = false;
  }
};

const startMonitor = () => {
  if (monitor) return;
  // Connection check every 30s
  monitor = setInterval(async () => {
    const was = supabaseAvailable;
    supabaseAvailable = await supabase.test();
    if (!was && supabaseAvailable) {
      console.log('[Sync] 🔄 Conexión recuperada');
      flushPending();
    }
  }, 30000);
};

const startAutoSync = () => {
  if (autoSync) return;
  autoSync = setInterval(autoSyncPull, AUTO_SYNC_INTERVAL);
  console.log(`[AutoSync] ✅ Activado — pull cada ${AUTO_SYNC_INTERVAL / 1000}s`);
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    supabaseAvailable = await supabase.test();
    if (supabaseAvailable) flushPending();
  });
  // Pause auto-sync when tab is hidden to save resources
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (autoSync) { clearInterval(autoSync); autoSync = null; }
      console.log('[AutoSync] ⏸ Pausado (pestaña oculta)');
    } else {
      startAutoSync();
      autoSyncPull(); // immediate pull when tab becomes visible again
      console.log('[AutoSync] ▶ Reanudado');
    }
  });
}

export const storage = {
  init: async () => {
    if (initialized) return;
    initialized = true;

    // 1. IDB → memory (instant)
    await localDB.init();
    loadPending();

    // 2. Pull from Supabase (NEVER push on init)
    try {
      supabaseAvailable = await supabase.test();

      if (supabaseAvailable) {
        console.log('[Storage] Supabase ✅ — descargando datos...');

        // Flush pending saves FIRST (these are from THIS device)
        if (pendingQueue.length > 0) await flushPending();

        // Pull remote data and merge
        for (const col of COLLECTIONS) {
          try {
            const remote = await supabase.getAll(tableFor(col));
            if (remote.length > 0) {
              const changed = mergeRemote(col, remote);
              if (changed) {
                console.log(`[Storage] ↓ ${col}: datos actualizados desde la nube`);
                broadcast(col);
              }
            }
            // NO pushLocalToCloud here — that was the bug!
          } catch (e) { console.warn(`[Storage] ${col}:`, e); }
        }
        console.log('[Storage] Sincronización completa ✅');
      } else {
        console.warn('[Storage] Sin conexión — modo local');
      }
    } catch { console.warn('[Storage] Error conexión'); }

    startMonitor();
    startAutoSync();
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
    const existing = localDB.getAll(col).find((x: any) => x.id === id);
    const { _rowId, _remoteUpdatedAt, ...cleanData } = data;
    const full: any = { ...(existing || {}), ...cleanData, id, updatedAt: new Date().toISOString() };
    delete full._rowId;
    delete full._remoteUpdatedAt;

    // Local: immediate
    localDB.put(col, full);
    broadcast(col);

    // Cloud: background (with retry on failure)
    syncToCloud(col, full);
  },

  remove: async (col: string, id: string): Promise<void> => {
    localDB.delete(col, id);
    broadcast(col);
    if (supabaseAvailable) supabase.remove(tableFor(col), id).catch(() => {});
  },

  syncNow: async (): Promise<{ pulled: number; pushed: number }> => {
    let pulled = 0, pushed = 0;
    supabaseAvailable = await supabase.test();
    if (!supabaseAvailable) return { pulled: 0, pushed: 0 };

    // 1. Flush pending
    const flushed = await flushPending();
    if (flushed) pushed++;

    // 2. Pull + merge
    for (const col of COLLECTIONS) {
      try {
        const remote = await supabase.getAll(tableFor(col));
        if (remote.length > 0) {
          const changed = mergeRemote(col, remote);
          if (changed) { broadcast(col); pulled++; }
        }

        // 3. Push local records that are NEWER than remote
        // supabase.save already checks updatedAt, so it won't overwrite newer remote data
        const locals = localDB.getAll(col);
        for (const item of locals) {
          const { _rowId, _remoteUpdatedAt, ...clean } = item;
          await supabase.save(tableFor(col), clean);
        }
        if (locals.length) pushed++;
      } catch {}
    }
    return { pulled, pushed };
  },

  exportData: async () => JSON.stringify({
    repairs: localDB.getAll('repairs'), budgets: localDB.getAll('budgets'),
    settings: localDB.getAll('settings'), citas: localDB.getAll('citas'),
    apps_externas: localDB.getAll('apps_externas'), exportDate: new Date().toISOString(),
  }, null, 2),

  forceBackup: async (): Promise<boolean> => {
    try {
      return await supabase.saveBackup({
        repairs: localDB.getAll('repairs'), budgets: localDB.getAll('budgets'),
        settings: localDB.getAll('settings'), backupDate: new Date().toISOString(), version: 'v12',
      });
    } catch { return false; }
  },

  nextRmaNumber: (): number => {
    return localDB.getAll('repairs').reduce((m: number, r: any) => Math.max(m, r.rmaNumber || 0), 0) + 1;
  },
};
