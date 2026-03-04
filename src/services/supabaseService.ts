// ============================================================
// ReparaPro Master - Supabase Service v4
// ============================================================

const BASE = 'https://bglmkckpopcuxmafting.supabase.co/rest/v1';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA';

const H = {
  'Content-Type': 'application/json',
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
};

const call = async (path: string, opts: RequestInit = {}, timeoutMs = 5000): Promise<Response> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${path}`, {
      ...opts,
      headers: { ...H, ...(opts.headers as Record<string,string> || {}) },
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
};

export const supabase = {
  async test(): Promise<boolean> {
    try {
      const res = await call('repairs?limit=1&select=id', {}, 4000);
      return res.status < 500;
    } catch { return false; }
  },

  async getAll(table: string): Promise<any[]> {
    try {
      const res = await call(`${table}?select=*&order=updated_at.desc`);
      if (!res.ok) return [];
      const rows: any[] = await res.json();
      return rows.map(r => {
        const d = r.data && typeof r.data === 'object' ? r.data : {};
        return { ...d, _rowId: r.id };
      });
    } catch { return []; }
  },

  async save(table: string, record: any): Promise<boolean> {
    try {
      const { _rowId, ...clean } = record;
      const res = await call(table, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          business_id: clean.id,
          data: clean,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.warn(`[Supabase] save ${table} ${res.status}:`, txt);
      }
      return res.ok;
    } catch (e) {
      console.warn('[Supabase] save error:', e);
      return false;
    }
  },

  async remove(table: string, businessId: string): Promise<boolean> {
    try {
      const res = await call(
        `${table}?business_id=eq.${encodeURIComponent(businessId)}`,
        { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
      );
      return res.ok;
    } catch { return false; }
  },

  // ============================================================
  // BACKUP — Guarda snapshot completo en tabla 'backups'
  // ============================================================
  async saveBackup(backupData: any): Promise<boolean> {
    try {
      const backupId = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const res = await call('backups', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          backup_id: backupId,
          data: backupData,
          created_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.warn(`[Supabase] saveBackup ${res.status}:`, txt);
      }
      return res.ok;
    } catch (e) {
      console.warn('[Supabase] saveBackup error:', e);
      return false;
    }
  },

  async getLatestBackup(): Promise<any | null> {
    try {
      const res = await call('backups?select=*&order=created_at.desc&limit=1');
      if (!res.ok) return null;
      const rows: any[] = await res.json();
      if (rows.length === 0) return null;
      return rows[0].data || null;
    } catch {
      return null;
    }
  },
};
