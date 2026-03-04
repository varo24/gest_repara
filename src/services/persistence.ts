// ============================================================
// ReparaPro Master - Persistence v7
// Memory-first: localDB.memoryStore is always the source of truth
// save → put to memory (instant) → broadcast → mirror to IDB + Supabase
// ============================================================

import { localDB } from './localDB';
import { supabase } from './supabaseService';

type CB = (data: any[]) => void;
const subs: Record<string, CB[]> = {};
const timers: Record<string, ReturnType<typeof setInterval>> = {};
const prevHash: Record<string, string> = {};
let online = false;
let backupInProgress = false;
let lastBackupTime = 0;

const localSaveTimestamps: Record<string, number> = {};
const LOCAL_SAVE_GRACE_PERIOD = 8000; // 8s grace

const BACKUP_COOLDOWN_MS = 30000;
const COLLECTIONS = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas'] as const;

const tableFor = (col: string) => col === 'settings' ? 'rp_settings' : col;
const hashOf = (arr: any[]) => arr.map(d => `${d.id}|${d.updatedAt||''}`).sort().join(',');

const broadcast = (col: string, data: any[]) => {
  const copy = data.map(item => ({ ...item })); // deep-ish copy per item
  subs[col]?.forEach(cb => cb(copy));
};

const syncToCloud = async (col: string, record: any) => {
  try {
    const { _rowId, ...clean } = record; // strip _rowId before sending
    await supabase.save(tableFor(col), clean);
  } catch (e) {
    console.warn(`[Sync] ${col} cloud error:`, e);
  }
};

const syncDeleteToCloud = async (col: string, id: string) => {
  try { await supabase.remove(tableFor(col), id); } catch (e) { /* silent */ }
};

// ── BACKUP ──
const performBackup = async (): Promise<boolean> => {
  if (!online || backupInProgress) return false;
  if (Date.now() - lastBackupTime < BACKUP_COOLDOWN_MS) return false;
  backupInProgress = true;
  try {
    const repairs = await localDB.getAll('repairs').catch(() => []);
    const budgets = await localDB.getAll('budgets').catch(() => []);
    const settings = await localDB.getAll('settings').catch(() => []);
    const ok = await supabase.saveBackup({
      repairs, budgets, settings,
      backupDate: new Date().toISOString(),
      totalRecords: repairs.length + budgets.length,
      version: 'v7-autobackup',
    });
    if (ok) lastBackupTime = Date.now();
    return ok;
  } catch { return false; }
  finally { backupInProgress = false; }
};

const performBeaconBackup = () => {
  if (!online || Date.now() - lastBackupTime < BACKUP_COOLDOWN_MS) return;
  try {
    fetch(`https://bglmkckpopcuxmafting.supabase.co/rest/v1/backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ backup_id: `beacon-${Date.now()}`, data: { version: 'v7-beacon' }, created_at: new Date().toISOString() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* closing */ }
};

const setupAutoBackup = () => {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') performBackup().catch(() => {}); });
  window.addEventListener('pagehide', performBeaconBackup);
  window.addEventListener('beforeunload', performBeaconBackup);
  setInterval(() => performBackup().catch(() => {}), 5 * 60 * 1000);
};

export const storage = {
  init: async () => {
    await localDB.init();
    supabase.test().then(ok => {
      online = ok;
      if (ok) {
        console.log('[Storage] Supabase OK ✅');
        storage._startPolling();
        storage._pullRemote();
        setupAutoBackup();
      } else {
        console.warn('[Storage] Offline mode');
      }
    });
  },

  isOnline: () => online,

  _pullRemote: async () => {
    for (const col of COLLECTIONS) {
      // Skip if there was a recent local save
      if (Date.now() - (localSaveTimestamps[col] || 0) < LOCAL_SAVE_GRACE_PERIOD) continue;
      try {
        const data = await supabase.getAll(tableFor(col));
        if (!data.length) continue;
        const h = hashOf(data);
        if (h === prevHash[col]) continue;
        prevHash[col] = h;
        for (const item of data) {
          const { _rowId, ...clean } = item;
          if (clean.id) await localDB.put(col, clean);
        }
        const current = await localDB.getAll(col);
        broadcast(col, current);
      } catch (e) {
        console.warn(`[Storage] pullRemote ${col}:`, e);
      }
    }
  },

  _startPolling: () => {
    for (const col of COLLECTIONS) {
      if (timers[col]) clearInterval(timers[col]);
      timers[col] = setInterval(async () => {
        if (!subs[col]?.length || !online) return;
        // Don't overwrite recent local saves
        if (Date.now() - (localSaveTimestamps[col] || 0) < LOCAL_SAVE_GRACE_PERIOD) return;
        try {
          const data = await supabase.getAll(tableFor(col));
          const h = hashOf(data);
          if (h === prevHash[col]) return;
          prevHash[col] = h;
          for (const item of data) {
            const { _rowId, ...clean } = item;
            if (clean.id) await localDB.put(col, clean);
          }
          const current = await localDB.getAll(col);
          broadcast(col, current);
        } catch { /* skip */ }
      }, 4000);
    }
  },

  subscribe: (col: string, cb: CB): (() => void) => {
    if (!subs[col]) subs[col] = [];
    subs[col].push(cb);

    // Fire immediately with current memoryStore data
    localDB.getAll(col).then(data => {
      // Only fire if no hash yet (first subscriber)
      if (prevHash[col] === undefined) {
        prevHash[col] = hashOf(data);
      }
      cb(data.map(item => ({ ...item })));
    }).catch(() => cb([]));

    return () => { subs[col] = subs[col].filter(fn => fn !== cb); };
  },

  // SAVE — the critical path
  save: async (col: string, id: string, data: any): Promise<void> => {
    console.log(`[Storage] SAVE ${col}/${id}`, data.status || '');

    // 1. Mark as locally saved (blocks polling)
    localSaveTimestamps[col] = Date.now();

    // 2. Build the record
    const allItems = await localDB.getAll(col);
    const existing = allItems.find((x: any) => x.id === id);
    const { _rowId, ...cleanData } = data; // strip _rowId if present
    const full = {
      ...(existing || {}),
      ...cleanData,
      id,
      updatedAt: new Date().toISOString(),
    };
    // Remove _rowId from final record
    delete full._rowId;

    // 3. Write to memoryStore (synchronous inside put)
    await localDB.put(col, full);

    // 4. Read back from memoryStore and broadcast
    const updated = await localDB.getAll(col);
    prevHash[col] = hashOf(updated);
    console.log(`[Storage] Broadcasting ${col}: ${updated.length} items, changed id=${id} status=${full.status || 'n/a'}`);
    broadcast(col, updated);

    // 5. Sync to cloud in background
    syncToCloud(col, full);
  },

  remove: async (col: string, id: string): Promise<void> => {
    localSaveTimestamps[col] = Date.now();
    await localDB.delete(col, id);
    const updated = await localDB.getAll(col);
    prevHash[col] = hashOf(updated);
    broadcast(col, updated);
    syncDeleteToCloud(col, id);
  },

  exportData: async () => {
    const repairs = await localDB.getAll('repairs').catch(() => []);
    const budgets = await localDB.getAll('budgets').catch(() => []);
    const settings = await localDB.getAll('settings').catch(() => []);
    const citas = await localDB.getAll('citas').catch(() => []);
    const apps_externas = await localDB.getAll('apps_externas').catch(() => []);
    return JSON.stringify({ repairs, budgets, settings, citas, apps_externas, exportDate: new Date().toISOString() }, null, 2);
  },

  forceBackup: performBackup,
};
