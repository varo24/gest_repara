import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const BASE = 'https://bglmkckpopcuxmafting.supabase.co/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbG1rY2twb3BjdXhtYWZ0aW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg0MzYsImV4cCI6MjA4NzE4NDQzNn0.g88wW7562dUhmzpNNPRxqxpMdykTv8A1YXBkSVNI4dA';
const H = { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': `Bearer ${KEY}` };

interface TestResult {
  name: string;
  status: 'ok' | 'fail' | 'warn' | 'running';
  detail: string;
}

const SupabaseDiagnostic: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const addResult = (r: TestResult) => setResults(prev => [...prev, r]);
  const updateLast = (r: Partial<TestResult>) => setResults(prev => {
    const copy = [...prev];
    if (copy.length > 0) Object.assign(copy[copy.length - 1], r);
    return copy;
  });

  const runDiagnostic = async () => {
    setResults([]);
    setRunning(true);

    // Test 1: Basic connectivity
    addResult({ name: '1. Conectividad Supabase', status: 'running', detail: 'Probando...' });
    try {
      const res = await fetch(`${BASE}/repairs?limit=1&select=id`, { headers: H, signal: AbortSignal.timeout(8000) });
      updateLast({ status: res.ok ? 'ok' : 'fail', detail: `HTTP ${res.status} — ${res.ok ? 'Conexión OK' : await res.text()}` });
      if (!res.ok) { setRunning(false); return; }
    } catch (e: any) {
      updateLast({ status: 'fail', detail: `Error: ${e.message}` });
      setRunning(false);
      return;
    }

    // Test 2: Read repairs table
    addResult({ name: '2. Leer tabla repairs', status: 'running', detail: 'Leyendo...' });
    try {
      const res = await fetch(`${BASE}/repairs?select=id,business_id,updated_at&order=updated_at.desc&limit=10`, { headers: H });
      const rows = await res.json();
      if (Array.isArray(rows)) {
        const bids = rows.map((r: any) => r.business_id).filter(Boolean);
        const uniqueBids = new Set(bids);
        updateLast({ status: 'ok', detail: `${rows.length} filas leídas, ${uniqueBids.size} business_ids únicos. ${bids.length !== uniqueBids.size ? '⚠️ HAY DUPLICADOS' : '✓ Sin duplicados'}` });
      } else {
        updateLast({ status: 'fail', detail: `Respuesta inesperada: ${JSON.stringify(rows).substring(0, 200)}` });
      }
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 3: Check table structure (does business_id exist?)
    addResult({ name: '3. Estructura de tabla', status: 'running', detail: 'Comprobando columnas...' });
    try {
      const res = await fetch(`${BASE}/repairs?select=id,business_id,data,updated_at&limit=1`, { headers: H });
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) {
          const cols = Object.keys(rows[0]);
          const hasBusinessId = cols.includes('business_id');
          const hasData = cols.includes('data');
          updateLast({ status: hasBusinessId && hasData ? 'ok' : 'warn', 
            detail: `Columnas: ${cols.join(', ')}. business_id: ${hasBusinessId ? '✓' : '✗'}, data: ${hasData ? '✓' : '✗'}` });
        } else {
          updateLast({ status: 'warn', detail: 'Tabla vacía — no hay filas' });
        }
      } else {
        updateLast({ status: 'fail', detail: `HTTP ${res.status}` });
      }
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 4: Try PATCH (update)
    const testId = `DIAG-TEST-${Date.now()}`;
    addResult({ name: '4. Test PATCH (actualizar)', status: 'running', detail: 'Probando actualización...' });
    try {
      const res = await fetch(`${BASE}/repairs?business_id=eq.${testId}`, {
        method: 'PATCH', headers: { ...H, 'Prefer': 'return=headers-only' },
        body: JSON.stringify({ data: { id: testId, test: true }, updated_at: new Date().toISOString() }),
      });
      const range = res.headers.get('content-range');
      updateLast({ status: 'ok', detail: `HTTP ${res.status}, content-range: ${range || 'null'} (esperado */0 para registro inexistente)` });
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 5: Try POST (insert)
    addResult({ name: '5. Test POST (insertar)', status: 'running', detail: 'Probando inserción...' });
    try {
      const res = await fetch(`${BASE}/repairs`, {
        method: 'POST', headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({ business_id: testId, data: { id: testId, test: true, ts: Date.now() }, updated_at: new Date().toISOString() }),
      });
      const body = await res.text();
      if (res.ok) {
        updateLast({ status: 'ok', detail: `HTTP ${res.status} — Inserción OK` });
      } else {
        updateLast({ status: 'fail', detail: `HTTP ${res.status}: ${body.substring(0, 300)}` });
      }
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 6: Verify the insert worked (read it back)
    addResult({ name: '6. Verificar lectura del registro insertado', status: 'running', detail: 'Leyendo...' });
    try {
      const res = await fetch(`${BASE}/repairs?business_id=eq.${testId}&select=*`, { headers: H });
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        updateLast({ status: 'ok', detail: `${rows.length} fila(s) con business_id=${testId}. Datos: ${JSON.stringify(rows[0].data).substring(0, 150)}` });
      } else {
        updateLast({ status: 'fail', detail: 'No se encontró el registro insertado' });
      }
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 7: Try PATCH on the inserted record
    addResult({ name: '7. Test PATCH sobre registro existente', status: 'running', detail: 'Actualizando...' });
    try {
      const res = await fetch(`${BASE}/repairs?business_id=eq.${testId}`, {
        method: 'PATCH', headers: { ...H, 'Prefer': 'return=headers-only' },
        body: JSON.stringify({ data: { id: testId, test: true, updated: true }, updated_at: new Date().toISOString() }),
      });
      const range = res.headers.get('content-range');
      updateLast({ status: res.ok ? 'ok' : 'fail', detail: `HTTP ${res.status}, content-range: ${range || 'null'}` });
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 8: Cleanup — delete test record
    addResult({ name: '8. Limpieza (borrar registro de prueba)', status: 'running', detail: 'Eliminando...' });
    try {
      const res = await fetch(`${BASE}/repairs?business_id=eq.${testId}`, {
        method: 'DELETE', headers: { ...H, 'Prefer': 'return=minimal' },
      });
      updateLast({ status: res.ok ? 'ok' : 'warn', detail: `HTTP ${res.status}` });
    } catch (e: any) {
      updateLast({ status: 'warn', detail: e.message });
    }

    // Test 9: Check all tables
    addResult({ name: '9. Contar registros en todas las tablas', status: 'running', detail: 'Contando...' });
    try {
      const tables = ['repairs', 'budgets', 'rp_settings', 'citas', 'apps_externas', 'backups'];
      const counts: string[] = [];
      for (const t of tables) {
        try {
          const res = await fetch(`${BASE}/${t}?select=id&limit=1000`, { headers: H });
          const rows = await res.json();
          counts.push(`${t}: ${Array.isArray(rows) ? rows.length : 'error'}`);
        } catch {
          counts.push(`${t}: ✗`);
        }
      }
      updateLast({ status: 'ok', detail: counts.join(' | ') });
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    // Test 10: Check pending queue
    addResult({ name: '10. Cola de pendientes', status: 'running', detail: 'Leyendo localStorage...' });
    try {
      const raw = localStorage.getItem('rp_pending_sync');
      const queue = raw ? JSON.parse(raw) : [];
      updateLast({ status: queue.length > 0 ? 'warn' : 'ok', detail: `${queue.length} operaciones en cola. ${queue.length > 0 ? 'IDs: ' + queue.map((q: any) => q.record?.id).join(', ') : 'Cola vacía'}` });
    } catch (e: any) {
      updateLast({ status: 'fail', detail: e.message });
    }

    setRunning(false);
  };

  const icon = (s: string) => {
    if (s === 'ok') return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
    if (s === 'fail') return <XCircle size={16} className="text-red-500 shrink-0" />;
    if (s === 'warn') return <AlertCircle size={16} className="text-amber-500 shrink-0" />;
    return <RefreshCw size={16} className="text-blue-500 shrink-0 animate-spin" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Diagnóstico Supabase</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verificar conexión y sincronización</p>
        </div>
      </div>

      <button onClick={runDiagnostic} disabled={running}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all">
        {running ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {running ? 'Ejecutando tests...' : 'Ejecutar Diagnóstico Completo'}
      </button>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {results.map((r, i) => (
            <div key={i} className={`px-6 py-4 flex items-start gap-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
              {icon(r.status)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 uppercase">{r.name}</p>
                <p className="text-[11px] text-slate-500 mt-1 break-all font-mono leading-relaxed">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-5 space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del entorno</p>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div><span className="text-slate-400">URL:</span> <span className="font-mono text-slate-700">{BASE}</span></div>
          <div><span className="text-slate-400">Navegador:</span> <span className="font-mono text-slate-700">{navigator.userAgent.split(' ').pop()}</span></div>
          <div><span className="text-slate-400">Online:</span> <span className="font-mono text-slate-700">{navigator.onLine ? 'Sí' : 'No'}</span></div>
          <div><span className="text-slate-400">LocalStorage:</span> <span className="font-mono text-slate-700">{typeof localStorage !== 'undefined' ? 'OK' : 'No'}</span></div>
        </div>
      </div>
    </div>
  );
};

export default SupabaseDiagnostic;
