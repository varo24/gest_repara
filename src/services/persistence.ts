// ============================================================
// ReparaPro — Persistence v10 — MULTI-DEVICE SYNC
//
// Strategy:
// 1. On startup: load IDB (instant) → show UI → then fetch Supabase
//    and MERGE (remote wins only if updatedAt is strictly newer)
// 2. On save: write memory → IDB → broadcast → Supabase (background)
// 3. ZERO polling — no automatic reads from Supabase after init
// 4. To sync from another device: reload the page
//
// This prevents the status-revert bug (no polling) while allowing
// multi-device sync (initial load merges by updatedAt).
// ============================================================

import { localDB } from './localDB';
import { supabase } from './supabaseService';

type CB = (data: any[]) => void;
const subs: Record<string, CB[]> = {};
let supabaseAvailable = false;

const COLLECTIONS = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas'] as const;
const tableFor = (col: string) => col === 'settings' ? 'rp_settings' : col;

const broadcast = (col: string) => {
  const data = localDB.getAll(col);
  subs[col]?.forEach(cb => {
    try { cb(data); } catch (e) { console.error('[broadcast]', e); }
  });
};

// ── MERGE: remote into local, remote wins ONLY if strictly newer ──
const mergeRemoteData = (col: string, remoteItems: any[]): boolean => {
  let changed = false;
  const localItems = localDB.getAll(col);
  const localMap = new Map(localItems.map(item => [item.id, item]));

  for (const remoteRaw of remoteItems) {
    const { _rowId, ...remote } = remoteRaw;
    if (!remote.id) continue;

    const local = localMap.get(remote.id);

    if (!local) {
      // New record from cloud — add locally
      localDB.put(col, remote);
      changed = true;
    } else {
      // Both exist — compare updatedAt timestamps
      const localTime = new Date(local.updatedAt || '2000-01-01').getTime();
      const remoteTime = new Date(remote.updatedAt || '2000-01-01').getTime();

      if (remoteTime > localTime) {
        // Remote is strictly newer — update local
        localDB.put(col, remote);
        changed = true;
      }
      // If local is same or newer → keep local (don't overwrite)
    }
  }
  return changed;
};

// ── Push all local records to Supabase (for records that may not exist remotely) ──
const pushLocalToCloud = async (col: string) => {
  const items = localDB.getAll(col);
  const table = tableFor(col);
  for (const item of items) {
    const { _rowId, ...clean } = item;
    supabase.save(table, clean).catch(() => {});
  }
};

// ── Cloud write (fire & forget) ──
const syncToCloud = (col: string, record: any) => {
  if (!supabaseAvailable) return;
  const table = tableFor(col);
  const { _rowId, ...clean } = record;
  supabase.save(table, clean).catch(() => {});
};

const syncDeleteToCloud = (col: string, id: string) => {
  if (!supabaseAvailable) return;
  const table = tableFor(col);
  supabase.remove(table, id).catch(() => {});
};

export const storage = {
  init: async () => {
    // 1. Load from IDB → memory (instant, shows data immediately)
    await localDB.init();

    // 2. Test Supabase, then merge remote data
    try {
      const ok = await supabase.test();
      supabaseAvailable = ok;

      if (ok) {
        console.log('[Storage] Supabase disponible ✅ — sincronizando...');

        for (const col of COLLECTIONS) {
          try {
            const remoteData = await supabase.getAll(tableFor(col));
            if (remoteData.length > 0) {
              const changed = mergeRemoteData(col, remoteData);
              if (changed) {
                console.log(`[Storage] Merged ${col}: new/updated records from cloud`);
                broadcast(col);
              }
            }
            // Push local records to cloud (in case this device has records the cloud doesn't)
            pushLocalToCloud(col);
          } catch (e) {
            console.warn(`[Storage] Sync ${col} error:`, e);
          }
        }

        console.log('[Storage] Sincronización completa ✅');
      } else {
        console.warn('[Storage] Supabase no disponible — modo local');
      }
    } catch {
      console.warn('[Storage] Error de conexión — modo local');
    }
  },

  isOnline: () => supabaseAvailable,

  subscribe: (col: string, cb: CB): (() => void) => {
    if (!subs[col]) subs[col] = [];
    subs[col].push(cb);
    // Fire immediately with current data
    cb(localDB.getAll(col));
    return () => { subs[col] = (subs[col] || []).filter(fn => fn !== cb); };
  },

  save: async (col: string, id: string, data: any): Promise<void> => {
    console.log(`[Storage] SAVE ${col}/${id} status=${data.status || ''}`);

    // 1. Get existing from memory
    const existing = localDB.getAll(col).find((x: any) => x.id === id);

    // 2. Merge
    const { _rowId, ...cleanData } = data;
    const full: any = {
      ...(existing || {}),
      ...cleanData,
      id,
      updatedAt: new Date().toISOString(),
    };
    delete full._rowId;

    // 3. Write to memory + IDB
    localDB.put(col, full);

    // 4. Broadcast immediately
    broadcast(col);

    // 5. Write to Supabase in background
    syncToCloud(col, full);
  },

  remove: async (col: string, id: string): Promise<void> => {
    localDB.delete(col, id);
    broadcast(col);
    syncDeleteToCloud(col, id);
  },

  // Manual full sync (can be called from UI)
  syncNow: async (): Promise<{ pulled: number; pushed: number }> => {
    let pulled = 0;
    let pushed = 0;

    if (!supabaseAvailable) {
      const ok = await supabase.test();
      supabaseAvailable = ok;
      if (!ok) return { pulled: 0, pushed: 0 };
    }

    for (const col of COLLECTIONS) {
      try {
        // Pull
        const remoteData = await supabase.getAll(tableFor(col));
        if (remoteData.length > 0) {
          const changed = mergeRemoteData(col, remoteData);
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
    const repairs = localDB.getAll('repairs');
    const budgets = localDB.getAll('budgets');
    const settings = localDB.getAll('settings');
    const citas = localDB.getAll('citas');
    const apps_externas = localDB.getAll('apps_externas');
    return JSON.stringify({ repairs, budgets, settings, citas, apps_externas, exportDate: new Date().toISOString() }, null, 2);
  },

  forceBackup: async (): Promise<boolean> => {
    try {
      const repairs = localDB.getAll('repairs');
      const budgets = localDB.getAll('budgets');
      const settings = localDB.getAll('settings');
      return await supabase.saveBackup({
        repairs, budgets, settings,
        backupDate: new Date().toISOString(),
        totalRecords: repairs.length + budgets.length,
        version: 'v10',
      });
    } catch { return false; }
  },
};
