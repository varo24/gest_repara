// ============================================================
// ReparaPro Master - Persistence v6 (Local-First + Auto-Backup)
// FIX: Local saves are now authoritative — polling will NOT
//      overwrite data that was saved locally within the last 5s.
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

// Track recently saved collections to prevent polling from reverting changes
const localSaveTimestamps: Record<string, number> = {};
const LOCAL_SAVE_GRACE_PERIOD = 6000; // 6s grace — polling won't overwrite during this window

const BACKUP_COOLDOWN_MS = 30000;
const COLLECTIONS = ['repairs', 'budgets', 'settings', 'citas', 'apps_externas'] as const;

const tableFor = (col: string) => col === 'settings' ? 'rp_settings' : col;
const hashOf = (arr: any[]) => arr.map(d => `${d.id}|${d.updatedAt||''}`).sort().join(',');
const broadcast = (col: string, data: any[]) => subs[col]?.forEach(cb => cb([...data]));

const syncToCloud = async (col: string, record: any) => {
  try {
    const ok = await supabase.save(tableFor(col), record);
    if (!ok) console.warn(`[Sync] ${col} cloud save failed`);
  } catch (e) {
    console.warn(`[Sync] ${col} cloud error:`, e);
  }
};

const syncDeleteToCloud = async (col: string, id: string) => {
  try { await supabase.remove(tableFor(col), id); } catch (e) { /* silent */ }
};

// ============================================================
// BACKUP
// ============================================================
const performBackup = async (): Promise<boolean> => {
  if (!online || backupInProgress) return false;
  const now = Date.now();
  if (now - lastBackupTime < BACKUP_COOLDOWN_MS) return false;
  backupInProgress = true;
  try {
    const repairs = await localDB.getAll('repairs').catch(() => []);
    const budgets = await localDB.getAll('budgets').catch(() => []);
    const settings = await localDB.getAll('settings').catch(() => []);
    const ok = await supabase.saveBackup({
      repairs, budgets, settings,
      backupDate: new Date().toISOString(),
      totalRecords: repairs.length + budgets.length,
      version: 'v6-autobackup',
    });
    if (ok) { lastBackupTime = Date.now(); }
    return ok;
  } catch (e) { return false; }
  finally { backupInProgress = false; }
};

const performBeaconBackup = () => {
  if (!online) return;
  if (Date.now() - lastBackupTime < BACKUP_COOLDOWN_MS) return;
  try {
    const url = `https://bglmkckpopcuxmafting.supabase.co/rest/v1/backups`;
    const body = JSON.stringify({
      backup_id: `beacon-${Date.now()}`,
      data: { backupDate: new Date().toISOString(), version: 'v6-beacon', trigger: 'app-close' },
      created_at: new Date().toISOString(),
    });
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body, keepalive: true,
    }).catch(() => {});
  } catch (e) { /* silent */ }
};

const setupAutoBackup = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') performBackup().catch(() => {});
  });
  window.addEventListener('pagehide', () => performBeaconBackup());
  window.addEventListener('beforeunload', () => performBeaconBackup());
  setInterval(() => performBackup().catch(() => {}), 5 * 60 * 1000);
};

export const storage = {
  init: async () => {
    await localDB.init();
    supabase.test().then(ok => {
      online = ok;
      if (ok) {
        console.log('[Storage] Supabase conectado ✅');
        storage._startPolling();
        storage._pullRemote();
        setupAutoBackup();
      } else {
        console.warn('[Storage] Modo local');
      }
    });
  },

  isOnline: () => online,

  _pullRemote: async () => {
    for (const col of COLLECTIONS) {
      try {
        const data = await supabase.getAll(tableFor(col));
        const h = hashOf(data);
        prevHash[col] = h;
        for (const item of data) {
          const { _rowId, ...clean } = item;
          if (clean.id) await localDB.put(col, clean).catch(() => {});
        }
        broadcast(col, data);
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

        // ── CRITICAL FIX: Don't overwrite recent local saves ──
        const lastLocalSave = localSaveTimestamps[col] || 0;
        if (Date.now() - lastLocalSave < LOCAL_SAVE_GRACE_PERIOD) {
          return; // Skip this poll cycle — local data is authoritative
        }

        try {
          const data = await supabase.getAll(tableFor(col));
          const h = hashOf(data);
          if (h === prevHash[col]) return;
          prevHash[col] = h;
          for (const item of data) {
            const { _rowId, ...clean } = item;
            if (clean.id) await localDB.put(col, clean).catch(() => {});
          }
          broadcast(col, data);
        } catch (e) { /* network error — skip */ }
      }, 3000);
    }
  },

  subscribe: (col: string, cb: CB): (() => void) => {
    if (!subs[col]) subs[col] = [];
    subs[col].push(cb);

    let localTimer: ReturnType<typeof setTimeout>;
    localDB.getAll(col)
      .then(localData => {
        localTimer = setTimeout(() => {
          if (prevHash[col] === undefined) {
            prevHash[col] = hashOf(localData);
            cb([...localData]);
          }
        }, 80);
      })
      .catch(() => { cb([]); });

    return () => {
      clearTimeout(localTimer);
      subs[col] = subs[col].filter(fn => fn !== cb);
    };
  },

  // SAVE — local first, broadcast immediately, sync cloud in background
  save: async (col: string, id: string, data: any): Promise<void> => {
    const updatedAt = new Date().toISOString();

    // Mark this collection as recently saved locally
    localSaveTimestamps[col] = Date.now();

    // Build the full record
    const existing = await localDB.getAll(col)
      .then(all => all.find((x: any) => x.id === id))
      .catch(() => null);
    const full = { ...existing, ...data, id, updatedAt };

    // Write to IndexedDB
    await localDB.put(col, full).catch(e => console.error('[Storage] put error:', e));

    // Read back ALL from local and broadcast to UI immediately
    const localData = await localDB.getAll(col).catch(() => [full]);
    prevHash[col] = hashOf(localData);
    broadcast(col, localData);

    // Sync to cloud in background (don't await)
    syncToCloud(col, full);
  },

  remove: async (col: string, id: string): Promise<void> => {
    localSaveTimestamps[col] = Date.now();
    await localDB.delete(col, id).catch(() => {});
    const localData = await localDB.getAll(col).catch(() => []);
    prevHash[col] = hashOf(localData);
    broadcast(col, localData);
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
