// ============================================================
// ReparaPro — Supabase Service v6
//
// CRITICAL FIX: save() only updates Supabase if the record
// being sent has a NEWER updatedAt than what exists there.
// This prevents Terminal B from overwriting Terminal A's changes.
// ============================================================

const BASE = 'https://ehtvcjleikeghldgaveb.supabase.co/rest/v1';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodHZjamxlaWtlZ2hsZGdhdmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODM3MTMsImV4cCI6MjA5Mjk1OTcxM30.1qDCpqVPx2gSoBWdL6jQnnxrmyw7nUGGjuHt3mL57IY';

const H: Record<string, string> = {
  'Content-Type': 'application/json',
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
};

const call = async (path: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<Response> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}/${path}`, {
      ...opts,
      headers: { ...H, ...(opts.headers as Record<string, string> || {}) },
      signal: ctrl.signal,
    });
  } finally { clearTimeout(t); }
};

export const supabase = {
  async test(): Promise<boolean> {
    try {
      const res = await call('repairs?limit=1&select=id', {}, 5000);
      return res.status < 500;
    } catch { return false; }
  },

  async getAll(table: string): Promise<any[]> {
    try {
      const res = await call(`${table}?select=*&order=updated_at.desc`);
      if (!res.ok) return [];
      const rows: any[] = await res.json();

      // Deduplicate by business_id (keep newest = first because sorted desc)
      const seen = new Map<string, any>();
      for (const r of rows) {
        const d = r.data && typeof r.data === 'object' ? r.data : {};
        const bid = r.business_id || d.id;
        if (!bid || seen.has(bid)) continue;
        seen.set(bid, { ...d, _rowId: r.id, _remoteUpdatedAt: r.updated_at });
      }
      console.log(`[Supabase] getAll ${table}: ${rows.length} rows → ${seen.size} unique`);
      return Array.from(seen.values());
    } catch (e) {
      console.warn(`[Supabase] getAll ${table}:`, e);
      return [];
    }
  },

  async save(table: string, record: any): Promise<boolean> {
    try {
      const { _rowId, _remoteUpdatedAt, ...clean } = record;
      const bid = clean.id;
      if (!bid) return false;

      const now = new Date().toISOString();
      const body = JSON.stringify({ data: clean, updated_at: now });

      // First: check if record exists in Supabase and get its data.updatedAt
      let existsRemote = false;
      let remoteNewer = false;
      try {
        const checkRes = await call(`${table}?business_id=eq.${encodeURIComponent(bid)}&select=updated_at,data&limit=1`);
        if (checkRes.ok) {
          const rows = await checkRes.json();
          if (rows.length > 0) {
            existsRemote = true;
            // Compare using updatedAt INSIDE the data JSON (more reliable than column)
            const remoteData = rows[0].data && typeof rows[0].data === 'object' ? rows[0].data : {};
            const remoteTime = new Date(remoteData.updatedAt || rows[0].updated_at || '2000-01-01').getTime();
            const localTime = new Date(clean.updatedAt || '2000-01-01').getTime();
            if (remoteTime > localTime) {
              remoteNewer = true;
            }
          }
        }
      } catch { /* assume doesn't exist */ }

      if (remoteNewer) {
        console.log(`[Supabase] SKIP ${table}/${bid} — remote is newer`);
        return true; // Not an error, just nothing to do
      }

      if (existsRemote) {
        // UPDATE existing
        const res = await call(
          `${table}?business_id=eq.${encodeURIComponent(bid)}`,
          { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body }
        );
        if (res.ok) {
          console.log(`[Supabase] ✅ UPDATE ${table}/${bid}`);
          return true;
        }
        console.warn(`[Supabase] PATCH ${table}/${bid}: ${res.status}`);
        return false;
      }

      // INSERT new
      const res = await call(table, {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ business_id: bid, data: clean, updated_at: now }),
      });

      if (res.ok) {
        console.log(`[Supabase] ✅ INSERT ${table}/${bid}`);
        return true;
      }

      // If 409 conflict, try PATCH
      if (res.status === 409) {
        const retry = await call(
          `${table}?business_id=eq.${encodeURIComponent(bid)}`,
          { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body }
        );
        if (retry.ok) { console.log(`[Supabase] ✅ UPDATE (retry) ${table}/${bid}`); return true; }
      }

      const err = await res.text().catch(() => '');
      console.warn(`[Supabase] ❌ ${table}/${bid}: ${res.status} ${err}`);
      return false;
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

  async saveBackup(backupData: any): Promise<boolean> {
    try {
      const res = await call('backups', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          backup_id: `backup-${Date.now()}`,
          data: backupData,
          created_at: new Date().toISOString(),
        }),
      });
      return res.ok;
    } catch { return false; }
  },

  async getLatestBackup(): Promise<any | null> {
    try {
      const res = await call('backups?select=*&order=created_at.desc&limit=1');
      if (!res.ok) return null;
      const rows: any[] = await res.json();
      return rows.length > 0 ? rows[0].data || null : null;
    } catch { return null; }
  },
};
