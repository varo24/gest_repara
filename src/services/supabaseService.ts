// ============================================================
// ReparaPro — Supabase Service v5
//
// FIX: save() now uses PATCH (update) first, then INSERT if new.
// This works regardless of whether business_id has a UNIQUE constraint.
// getAll() deduplicates by business_id (keeps newest updated_at).
// ============================================================

const BASE = 'https://bglmkckpopcuxmafting.supabase.co/rest/v1';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA';

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
  } finally {
    clearTimeout(t);
  }
};

export const supabase = {
  async test(): Promise<boolean> {
    try {
      const res = await call('repairs?limit=1&select=id', {}, 5000);
      console.log(`[Supabase] test: ${res.status}`);
      return res.status < 500;
    } catch (e) {
      console.warn('[Supabase] test failed:', e);
      return false;
    }
  },

  async getAll(table: string): Promise<any[]> {
    try {
      const res = await call(`${table}?select=*&order=updated_at.desc`);
      if (!res.ok) {
        console.warn(`[Supabase] getAll ${table}: ${res.status}`);
        return [];
      }
      const rows: any[] = await res.json();

      // Deduplicate by business_id — keep the one with newest updated_at
      const seen = new Map<string, any>();
      for (const r of rows) {
        const d = r.data && typeof r.data === 'object' ? r.data : {};
        const bid = r.business_id || d.id;
        if (!bid) continue;

        if (!seen.has(bid)) {
          seen.set(bid, { ...d, _rowId: r.id });
        }
        // First one wins because ordered by updated_at desc (newest first)
      }

      const result = Array.from(seen.values());
      console.log(`[Supabase] getAll ${table}: ${rows.length} rows → ${result.length} unique`);
      return result;
    } catch (e) {
      console.warn(`[Supabase] getAll ${table} error:`, e);
      return [];
    }
  },

  async save(table: string, record: any): Promise<boolean> {
    try {
      const { _rowId, ...clean } = record;
      const bid = clean.id;
      if (!bid) { console.warn('[Supabase] save: no id'); return false; }

      const body = JSON.stringify({
        data: clean,
        updated_at: new Date().toISOString(),
      });

      // Strategy: Try PATCH first (update existing), then POST (insert new)
      // PATCH updates where business_id matches
      const patchRes = await call(
        `${table}?business_id=eq.${encodeURIComponent(bid)}`,
        {
          method: 'PATCH',
          headers: { 'Prefer': 'return=headers-only' },
          body,
        }
      );

      if (patchRes.ok) {
        // Check if any row was actually updated via content-range header
        const range = patchRes.headers.get('content-range');
        // Format: "*/0" means 0 rows updated (doesn't exist yet)
        // Format: "0-0/*" or "*/1" means 1+ rows updated
        const noRowsUpdated = range && range.includes('/0');

        if (!noRowsUpdated) {
          // Updated successfully
          console.log(`[Supabase] ✅ PATCH ${table}/${bid}`);
          return true;
        }

        // No rows matched — need to INSERT
        console.log(`[Supabase] PATCH ${table}/${bid} — no match, inserting...`);
      } else {
        console.warn(`[Supabase] PATCH ${table}/${bid} failed: ${patchRes.status}, trying INSERT...`);
      }

      // INSERT new record
      const postRes = await call(table, {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          business_id: bid,
          data: clean,
          updated_at: new Date().toISOString(),
        }),
      });

      if (postRes.ok) {
        console.log(`[Supabase] ✅ INSERT ${table}/${bid}`);
        return true;
      }

      const errTxt = await postRes.text().catch(() => '');
      console.warn(`[Supabase] ❌ INSERT ${table}/${bid} failed: ${postRes.status} ${errTxt}`);

      // If INSERT fails with 409 (conflict/duplicate), try PATCH one more time
      if (postRes.status === 409) {
        console.log(`[Supabase] 409 conflict, retrying PATCH...`);
        const retry = await call(
          `${table}?business_id=eq.${encodeURIComponent(bid)}`,
          { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body }
        );
        if (retry.ok) {
          console.log(`[Supabase] ✅ PATCH retry ${table}/${bid}`);
          return true;
        }
      }

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
      console.log(`[Supabase] DELETE ${table}/${businessId}: ${res.status}`);
      return res.ok;
    } catch { return false; }
  },

  async saveBackup(backupData: any): Promise<boolean> {
    try {
      const backupId = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const res = await call('backups', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          backup_id: backupId,
          data: backupData,
          created_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.warn(`[Supabase] saveBackup ${res.status}: ${txt}`);
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
    } catch { return null; }
  },
};
