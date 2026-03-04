// ============================================================
// ReparaPro — Persistence v9 — NUCLEAR FIX
//
// PROBLEM: Every version of polling/pullRemote from Supabase
// was reverting local status changes because Supabase data
// was overwriting the local memory store.
//
// SOLUTION: Supabase is now WRITE-ONLY.
// - We NEVER read from Supabase back into the app
// - We NEVER poll Supabase
// - We NEVER call getAll from Supabase
// - Supabase only receives saves (fire & forget backup)
// - All data lives in memory + IndexedDB
// - This is a true local-first architecture
//
// Multi-device sync can be added later via explicit "sync" button
// but will NEVER be automatic to prevent this bug from recurring.
// ============================================================

import { localDB } from './localDB';
import { supabase } from './supabaseService';

type CB = (data: any[]) => void;
const subs: Record<string, CB[]> = {};

const broadcast = (col: string) => {
  const data = localDB.getAll(col); // synchronous, from memory
  subs[col]?.forEach(cb => {
    try { cb(data); } catch (e) { console.error('[broadcast]', e); }
  });
};

// Background cloud save — fire & forget, never blocks UI
const syncToCloud = (col: string, record: any) => {
  const table = col === 'settings' ? 'rp_settings' : col;
  const { _rowId, ...clean } = record;
  supabase.save(table, clean).catch(() => {});
};

const syncDeleteToCloud = (col: string, id: string) => {
  const table = col === 'settings' ? 'rp_settings' : col;
  supabase.remove(table, id).catch(() => {});
};

export const storage = {
  init: async () => {
    await localDB.init();
    // Test Supabase connectivity (just for backup status indicator)
    supabase.test().then(ok => {
      if (ok) console.log('[Storage] Supabase backup available ✅');
      else console.warn('[Storage] Supabase unavailable — local only');
    });
  },

  isOnline: () => true, // Always "online" from local perspective

  subscribe: (col: string, cb: CB): (() => void) => {
    if (!subs[col]) subs[col] = [];
    subs[col].push(cb);
    // Fire immediately with current data
    const data = localDB.getAll(col);
    cb(data);
    return () => { subs[col] = (subs[col] || []).filter(fn => fn !== cb); };
  },

  save: async (col: string, id: string, data: any): Promise<void> => {
    console.log(`[Storage] SAVE ${col}/${id} status=${data.status || ''}`);

    // 1. Get existing record from memory
    const all = localDB.getAll(col);
    const existing = all.find((x: any) => x.id === id);

    // 2. Merge
    const { _rowId, ...cleanData } = data;
    const full: any = {
      ...(existing || {}),
      ...cleanData,
      id,
      updatedAt: new Date().toISOString(),
    };
    delete full._rowId;

    // 3. Write to memory + IDB (synchronous memory update)
    localDB.put(col, full);

    // 4. Broadcast to all subscribers — IMMEDIATE
    console.log(`[Storage] ✅ Saved & broadcasting ${col}, id=${id}, status=${full.status}`);
    broadcast(col);

    // 5. Backup to Supabase in background (fire & forget)
    syncToCloud(col, full);
  },

  remove: async (col: string, id: string): Promise<void> => {
    localDB.delete(col, id);
    broadcast(col);
    syncDeleteToCloud(col, id);
  },

  exportData: async () => {
    const repairs = localDB.getAll('repairs');
    const budgets = localDB.getAll('budgets');
    const settings = localDB.getAll('settings');
    const citas = localDB.getAll('citas');
    const apps_externas = localDB.getAll('apps_externas');
    return JSON.stringify({ repairs, budgets, settings, citas, apps_externas, exportDate: new Date().toISOString() }, null, 2);
  },

  // Manual backup (can be triggered from settings)
  forceBackup: async (): Promise<boolean> => {
    try {
      const repairs = localDB.getAll('repairs');
      const budgets = localDB.getAll('budgets');
      const settings = localDB.getAll('settings');
      return await supabase.saveBackup({
        repairs, budgets, settings,
        backupDate: new Date().toISOString(),
        totalRecords: repairs.length + budgets.length,
        version: 'v9',
      });
    } catch { return false; }
  },
};
