import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText, RefreshCw, AlertCircle, CheckCircle2, Package,
  X, ChevronDown, ChevronRight, AlertTriangle, Trash2, Play, Download,
} from 'lucide-react';
import { AppSettings, Supplier } from '../types';
import { storage, localDB } from '../lib/dataService';
import { uploadFacturaPDF } from '../lib/storageService';

interface DatosFactura {
  proveedor: string;
  numero_factura: string;
  fecha: string;
  total: number;
  lineas: Array<{ descripcion: string; referencia: string; cantidad: number; precio_unitario: number }>;
  supplierId?: string;
  cif_proveedor?: string;
  email_proveedor?: string;
  telefono_proveedor?: string;
  direccion_proveedor?: string;
}

interface AnalizadoDoc {
  id: string;
  emailUid: number;
  es_factura: boolean;
  from: string;
  subject: string;
  date: string | null;
  datos_factura: DatosFactura | null;
  tiene_adjunto_pdf?: boolean;
  analizado_via?: 'pdf' | 'texto';
  analyzedAt: string;
}

interface DupeModal {
  datos: DatosFactura;
  emailUid: number;
  existing: any;
}

interface CorreosProps {
  settings: AppSettings;
  onImportToStock: (datos: DatosFactura) => void;
  onBack: () => void;
  onNotify?: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

const fmtDateShort = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

export default function Correos({ settings, onImportToStock, onBack, onNotify }: CorreosProps) {
  const serverUrl = (settings.imapServerUrl || '').trim().replace(/\/$/, '');
  const apiKey    = settings.imapApiKey || '';

  const [days, setDays]               = useState<number>(settings.imapDays ?? 7);
  const [connected, setConnected]     = useState<boolean | null>(null);
  const [loading, setLoading]         = useState(false);
  const [progress, setProgress]       = useState<{ analizados: number; total: number; facturas: number } | null>(null);
  const [error, setError]             = useState('');
  const [filter, setFilter]           = useState<'todas' | 'pendientes' | 'importadas'>('todas');
  const [dupeModal, setDupeModal]     = useState<DupeModal | null>(null);
  const [descartarModal, setDescartarModal] = useState<AnalizadoDoc | null>(null);
  const [expandedLineas, setExpandedLineas] = useState<Set<number>>(new Set());
  const [expandedProvs, setExpandedProvs]   = useState<Set<string>>(new Set());

  const [correosAnalizados, setCorreosAnalizados] = useState<Record<string, AnalizadoDoc>>({});
  const correosAnalizadosRef = useRef<Record<string, AnalizadoDoc>>({});
  const pdfCacheRef = useRef<Map<number, { base64: string; filename: string }>>(new Map());
  const [importingUid, setImportingUid] = useState<number | null>(null);
  const [facturasImportadas, setFacturasImportadas] = useState<Record<string, any>>({});
  const [facturasDescartadas, setFacturasDescartadas] = useState<Record<string, any>>({});
  const facturasDescartadasRef = useRef<Record<string, any>>({});
  const [procesados, setProcessados] = useState<Record<string, any>>({});

  // ── Subscriptions ────────────────────────────────────────────────────────
  useEffect(() => {
    const u1 = storage.subscribe('correos_analizados', (data: any[]) => {
      const map: Record<string, AnalizadoDoc> = {};
      data.forEach((d: AnalizadoDoc) => { if (d.emailUid) map[String(d.emailUid)] = d; });
      setCorreosAnalizados(map);
      correosAnalizadosRef.current = map;
    });
    const u2 = storage.subscribe('facturas_importadas', (data: any[]) => {
      const map: Record<string, any> = {};
      data.forEach(d => { if (d.claveUnica) map[d.claveUnica] = d; });
      setFacturasImportadas(map);
    });
    const u3 = storage.subscribe('facturas_descartadas', (data: any[]) => {
      const map: Record<string, any> = {};
      data.forEach(d => { if (d.emailUid) map[String(d.emailUid)] = d; });
      setFacturasDescartadas(map);
      facturasDescartadasRef.current = map;
    });
    const u4 = storage.subscribe('correos_procesados', (data: any[]) => {
      const map: Record<string, any> = {};
      data.forEach(d => { const k = String(d.emailUid ?? ''); if (k) map[k] = d; });
      setProcessados(map);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchFacturas = useCallback(async (daysToFetch: number, force = false) => {
    if (!serverUrl) return;
    setLoading(true); setProgress(null); setError('');
    try {
      const TTL_MS = 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - TTL_MS;
      const skipUids = force
        ? []
        : Object.values(correosAnalizadosRef.current)
            .filter(d => new Date(d.analyzedAt).getTime() > cutoff)
            .map(d => String(d.emailUid));
      const descartadasUids = Object.values(facturasDescartadasRef.current)
        .map(d => String(d.emailUid)).filter(Boolean);

      const params = new URLSearchParams({ days: String(daysToFetch) });
      if (skipUids.length) params.set('skip', skipUids.join(','));
      if (descartadasUids.length) params.set('descartadas', descartadasUids.join(','));

      const r = await fetch(`${serverUrl}/emails/facturas?${params}`, {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(180000),
      });
      if (!r.ok) { setConnected(false); return; }
      const data = await r.json();
      const now = new Date().toISOString();
      for (const result of (data.results || [])) {
        storage.save('correos_analizados', `ANAL-${result.uid}`, {
          id: `ANAL-${result.uid}`,
          emailUid: result.uid,
          es_factura: result.es_factura,
          from: result.from,
          subject: result.subject,
          date: result.date,
          datos_factura: result.datos_factura ?? null,
          tiene_adjunto_pdf: result.tiene_adjunto_pdf ?? false,
          analizado_via: result.analizado_via ?? 'texto',
          analyzedAt: now,
        });
      }
      for (const f of (data.facturas || []) as any[]) {
        if (f.attachment_base64 && f.uid) {
          pdfCacheRef.current.set(Number(f.uid), {
            base64: f.attachment_base64,
            filename: f.attachment_filename || 'factura.pdf',
          });
          if (pdfCacheRef.current.size > 20) {
            pdfCacheRef.current.delete(pdfCacheRef.current.keys().next().value!);
          }
        }
      }
      setProgress({
        analizados: data.analizados ?? 0,
        total: data.total_candidatos ?? 0,
        facturas: (data.facturas as any[])?.length ?? 0,
      });
      setConnected(true);
    } catch {
      setProgress(prev => prev ?? { analizados: 0, total: 0, facturas: 0 });
      setConnected(false);
    } finally { setLoading(false); }
  }, [serverUrl, apiKey]);

  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (!serverUrl) return;
    const force = initialFetchDoneRef.current;
    initialFetchDoneRef.current = true;
    fetchFacturas(days, force);
  }, [serverUrl, days, fetchFacturas]);

  const changePeriod = (d: number) => setDays(d);

  // ── Import ───────────────────────────────────────────────────────────────
  const importedNumeros = useMemo(() => {
    const s = new Set<string>();
    Object.values(facturasImportadas).forEach((imp: any) => { if (imp.numeroFactura) s.add(imp.numeroFactura); });
    return s;
  }, [facturasImportadas]);

  const upsertSupplier = async (datos: DatosFactura): Promise<string> => {
    const normalized = datos.proveedor.trim().toLowerCase();
    const existing = (localDB.getAll('suppliers') as Supplier[]).find(
      s => s.name.trim().toLowerCase() === normalized
    );
    if (existing) return existing.id;
    const now = new Date().toISOString();
    const id = `SUPP-${Date.now()}`;
    const newSupplier: Supplier = {
      id,
      name: datos.proveedor.trim(),
      taxId: datos.cif_proveedor || undefined,
      email: datos.email_proveedor || undefined,
      phone: datos.telefono_proveedor || undefined,
      city: datos.direccion_proveedor || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await storage.save('suppliers', id, newSupplier);
    return id;
  };

  const doImport = async (datos: DatosFactura, emailUid: number, forzado: boolean, pdfBase64?: string) => {
    const now = new Date().toISOString();
    const claveUnica = `${emailUid}-${datos.numero_factura}`;
    const importId = `IMP-${Date.now()}`;

    let pdfUrl: string | undefined;
    if (pdfBase64) {
      try {
        pdfUrl = await uploadFacturaPDF(pdfBase64, datos.proveedor, datos.numero_factura, datos.fecha);
      } catch {
        onNotify?.('warning', 'La factura se importó pero el PDF no se pudo guardar. Súbelo manualmente desde Archivo Facturas.');
      }
    }

    let supplierId: string | undefined;
    if (datos.proveedor) {
      try { supplierId = await upsertSupplier(datos); } catch {}
    }

    storage.save('facturas_importadas', importId, {
      id: importId, emailUid, claveUnica,
      proveedor: datos.proveedor, numeroFactura: datos.numero_factura,
      fecha: datos.fecha, total: datos.total, lineas: datos.lineas,
      importadoEn: now, forzado, pdfUrl, supplierId,
    });
    storage.save('correos_procesados', `PROC-${emailUid}`, {
      id: `PROC-${emailUid}`, emailUid, tipo: 'stock_importado',
      proveedor: datos.proveedor, numeroFactura: datos.numero_factura, procesadoEn: now,
    });
    setDupeModal(null);
    onImportToStock({ ...datos, supplierId });
  };

  const handleImport = async (doc: AnalizadoDoc) => {
    if (!doc.datos_factura || importingUid !== null) return;
    const claveUnica = `${doc.emailUid}-${doc.datos_factura.numero_factura}`;
    if (facturasImportadas[claveUnica]) {
      setDupeModal({ datos: doc.datos_factura, emailUid: doc.emailUid, existing: facturasImportadas[claveUnica] });
      return;
    }
    if (doc.datos_factura.numero_factura && importedNumeros.has(doc.datos_factura.numero_factura)) {
      const existing = Object.values(facturasImportadas).find((imp: any) => imp.numeroFactura === doc.datos_factura!.numero_factura);
      setDupeModal({ datos: doc.datos_factura, emailUid: doc.emailUid, existing: existing || {} });
      return;
    }
    let pdfData = pdfCacheRef.current.get(doc.emailUid);

    // Si el PDF no está en cache pero el email tenía adjunto, re-fetchear del servidor
    if (!pdfData && doc.tiene_adjunto_pdf && serverUrl) {
      setImportingUid(doc.emailUid);
      try {
        const r = await fetch(`${serverUrl}/emails/${doc.emailUid}`, {
          headers: { 'x-api-key': apiKey },
          signal: AbortSignal.timeout(20000),
        });
        if (r.ok) {
          const data = await r.json();
          const att = (data.attachments || []).find(
            (a: any) => a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf')
          );
          if (att?.data) {
            pdfData = { base64: att.data, filename: att.filename || 'factura.pdf' };
            pdfCacheRef.current.set(doc.emailUid, pdfData);
          }
        }
      } catch {
        // continúa sin PDF — se avisará en doImport si el upload falla
      }
    }

    setImportingUid(doc.emailUid);
    try {
      await doImport(doc.datos_factura, doc.emailUid, false, pdfData?.base64);
    } finally { setImportingUid(null); }
  };

  const downloadPdf = (emailUid: number) => {
    const cached = pdfCacheRef.current.get(emailUid);
    if (!cached) return;
    const bytes = Uint8Array.from(atob(cached.base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cached.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doDescartar = (doc: AnalizadoDoc) => {
    storage.save('facturas_descartadas', `DESC-${Date.now()}`, {
      id: `DESC-${Date.now()}`,
      emailUid: doc.emailUid,
      proveedor: doc.datos_factura?.proveedor || '',
      numeroFactura: doc.datos_factura?.numero_factura || '',
      fecha: doc.datos_factura?.fecha || '',
      descartadoEn: new Date().toISOString(),
      motivo: 'manual',
    });
    setDescartarModal(null);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  // All detected facturas (includes descartadas for display)
  const facturasAll = useMemo(() =>
    (Object.values(correosAnalizados) as AnalizadoDoc[])
      .filter(d => d.es_factura)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
  [correosAnalizados]);

  // Non-discarded facturas (for stats)
  const facturasActivas = useMemo(() =>
    facturasAll.filter(d => !facturasDescartadas[String(d.emailUid)]),
  [facturasAll, facturasDescartadas]);

  const stats = useMemo(() => ({
    total:     facturasActivas.length,
    pendientes: facturasActivas.filter(d => !procesados[String(d.emailUid)]).length,
    importadas: facturasActivas.filter(d => !!procesados[String(d.emailUid)]).length,
  }), [facturasActivas, procesados]);

  // Filtered list (includes descartadas shown with badge)
  const listaFiltrada = useMemo(() => {
    if (filter === 'pendientes') return facturasActivas.filter(d => !procesados[String(d.emailUid)]);
    if (filter === 'importadas') return facturasActivas.filter(d => !!procesados[String(d.emailUid)]);
    return facturasAll;
  }, [filter, facturasAll, facturasActivas, procesados]);

  // Group by proveedor
  const grouped = useMemo(() => {
    const map: Record<string, AnalizadoDoc[]> = {};
    listaFiltrada.forEach(doc => {
      const prov = doc.datos_factura?.proveedor || 'Sin proveedor';
      if (!map[prov]) map[prov] = [];
      map[prov].push(doc);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [listaFiltrada]);

  // Auto-expand all proveedores when data arrives
  useEffect(() => {
    if (grouped.length) setExpandedProvs(new Set(grouped.map(([p]) => p)));
  }, [grouped.length]); // eslint-disable-line

  const toggleProv = (p: string) =>
    setExpandedProvs(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const toggleLineas = (uid: number) =>
    setExpandedLineas(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  // ── No server ─────────────────────────────────────────────────────────────
  if (!serverUrl) {
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Facturas Recibidas</h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center space-y-4">
          <FileText size={40} className="text-slate-200 mx-auto" />
          <p className="text-sm font-bold text-slate-500">Servidor IMAP no configurado</p>
          <p className="text-xs text-slate-400">
            Ve a <strong>Ajustes → Servidor de Correo</strong> e introduce la URL del servidor IMAP.
          </p>
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* ── Discard modal ── */}
      {descartarModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                <Trash2 size={28} className="text-red-400" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">¿Descartar factura?</h2>
              <p className="text-xs text-slate-600">
                <strong>{descartarModal.datos_factura?.proveedor || descartarModal.from}</strong>
                {descartarModal.datos_factura?.numero_factura && (
                  <span className="block text-slate-400">Nº {descartarModal.datos_factura.numero_factura}</span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No se importará al stock</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDescartarModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={() => doDescartar(descartarModal)} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all">Descartar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dupe modal ── */}
      {dupeModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-amber-50 rounded-2xl">
                <AlertTriangle size={28} className="text-amber-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Factura ya importada</h2>
              <div className="text-xs text-slate-600 space-y-1">
                <p>La factura <strong>{dupeModal.datos.numero_factura}</strong> de <strong>{dupeModal.datos.proveedor}</strong></p>
                {dupeModal.existing?.importadoEn && (
                  <p>fue importada el <strong>{fmtDateShort(dupeModal.existing.importadoEn)}</strong>.</p>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">¿Importar igualmente?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDupeModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button
                onClick={async () => {
                  const pdfData = pdfCacheRef.current.get(dupeModal.emailUid);
                  setImportingUid(dupeModal.emailUid);
                  try { await doImport(dupeModal.datos, dupeModal.emailUid, true, pdfData?.base64); }
                  finally { setImportingUid(null); }
                }}
                disabled={importingUid === dupeModal.emailUid}
                className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 disabled:opacity-60 transition-all"
              >
                {importingUid === dupeModal.emailUid ? 'Subiendo PDF…' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Facturas Recibidas</h1>
          <div className="flex items-center gap-2 mt-1">
            {connected === null
              ? <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
              : connected
                ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                : <span className="w-2 h-2 rounded-full bg-red-400" />}
            <span className={`text-xs font-bold ${connected === true ? 'text-emerald-600' : connected === false ? 'text-red-500' : 'text-slate-400'}`}>
              {connected === true ? 'Conectado' : connected === false ? 'Sin conexión' : 'Verificando…'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Period selector */}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            {([7, 15, 30] as const).map(d => (
              <button
                key={d}
                onClick={() => changePeriod(d)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${days === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          {/* Reanalizar */}
          <button
            onClick={() => fetchFacturas(days, true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm"
          >
            {loading
              ? <><RefreshCw size={12} className="animate-spin" /> Analizando…</>
              : <><Play size={12} /> Reanalizar</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Detectadas', value: stats.total, color: '#2e7d32', f: 'todas' as const },
          { label: 'Pendientes', value: stats.pendientes, color: '#1565c0', f: 'pendientes' as const },
          { label: 'Importadas', value: stats.importadas, color: '#6a1b9a', f: 'importadas' as const },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilter(f => f === s.f ? 'todas' : s.f)}
            className={`bg-white rounded-2xl border p-5 text-left transition-all ${filter === s.f ? 'border-current shadow-md ring-2' : 'border-slate-100 hover:border-slate-300'}`}
            style={filter === s.f ? { borderColor: s.color, '--tw-ring-color': s.color + '30' } as any : {}}
          >
            <p className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mt-2">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Active filter pill */}
      {filter !== 'todas' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-600">
            Mostrando: {filter}
          </span>
          <button onClick={() => setFilter('todas')} className="text-[10px] text-slate-400 hover:text-slate-700 font-bold transition-colors">
            × Ver todas
          </button>
        </div>
      )}

      {/* ── Loading spinner ── */}
      {loading && listaFiltrada.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center space-y-3">
          <RefreshCw size={24} className="text-amber-400 mx-auto animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Analizando correos de los últimos {days} días…
          </p>
          <p className="text-[10px] text-slate-400">Esto puede tardar unos segundos</p>
          <div className="mx-auto w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* ── Progress bar when loading but already have results ── */}
      {loading && listaFiltrada.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-100 rounded-xl">
          <RefreshCw size={12} className="text-amber-500 animate-spin shrink-0" />
          <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
            Analizando correos de los últimos {days} días…
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && listaFiltrada.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center space-y-3">
          <FileText size={36} className="text-slate-200 mx-auto" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
            {filter !== 'todas' ? `Sin facturas ${filter}` : `Sin facturas en los últimos ${days} días`}
          </p>
          <p className="text-[10px] text-slate-300">
            {filter !== 'todas'
              ? 'Cambia el filtro para ver todas'
              : 'Pulsa "Reanalizar" o amplía el período de búsqueda'}
          </p>
        </div>
      )}

      {/* ── Summary bar ── */}
      {!loading && progress && listaFiltrada.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
          <p className="text-[10px] font-bold text-slate-500">
            Analizados {progress.analizados} de {progress.total} candidatos · {progress.facturas} factura{progress.facturas !== 1 ? 's' : ''} detectada{progress.facturas !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* ── Facturas agrupadas por proveedor ── */}
      {listaFiltrada.length > 0 && (
        <div className="space-y-3">
          {grouped.map(([prov, docs]) => {
            const open = expandedProvs.has(prov);
            const importadasCount = docs.filter(d => !!procesados[String(d.emailUid)]).length;
            return (
              <div key={prov} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Proveedor header */}
                <button
                  onClick={() => toggleProv(prov)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                  <span className="flex-1 font-black text-slate-900 uppercase text-sm tracking-wide">{prov}</span>
                  {importadasCount > 0 && (
                    <span className="text-[9px] font-black text-violet-600 mr-1">{importadasCount} importada{importadasCount !== 1 ? 's' : ''}</span>
                  )}
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{docs.length}</span>
                </button>

                {/* Factura rows */}
                {open && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {docs.map(doc => {
                      const isImportada = !!procesados[String(doc.emailUid)];
                      const isDescartada = !!facturasDescartadas[String(doc.emailUid)];
                      const claveUnica = `${doc.emailUid}-${doc.datos_factura?.numero_factura}`;
                      const yaImportada = doc.datos_factura ? !!facturasImportadas[claveUnica] : false;
                      const posibleDuplicado = !yaImportada && !!doc.datos_factura?.numero_factura && importedNumeros.has(doc.datos_factura.numero_factura);
                      const tieneLineas = (doc.datos_factura?.lineas?.length ?? 0) > 0;
                      const lineasOpen = expandedLineas.has(doc.emailUid);

                      return (
                        <div key={doc.emailUid} className={isImportada || isDescartada ? 'opacity-60' : ''}>
                          <div className="flex items-start gap-3 px-5 py-4">
                            {/* Left: data */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {/* Status badges */}
                                {isImportada && (
                                  <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full shrink-0">✓ Importada</span>
                                )}
                                {isDescartada && !isImportada && (
                                  <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">✗ Descartada</span>
                                )}
                                {posibleDuplicado && (
                                  <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0">⚠ Posible duplicado</span>
                                )}
                                {doc.tiene_adjunto_pdf
                                  ? <span className="text-[9px] font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full shrink-0">📎 PDF</span>
                                  : <span className="text-[9px] font-bold bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full shrink-0">📝 Texto</span>}
                              </div>

                              {doc.datos_factura ? (
                                <div className="flex items-center gap-4 flex-wrap">
                                  <span className="text-[10px] text-slate-400">Nº <strong className="text-slate-700">{doc.datos_factura.numero_factura || '—'}</strong></span>
                                  <span className="text-[10px] text-slate-400">{fmtDateShort(doc.datos_factura.fecha)}</span>
                                  <span className="text-sm font-black text-slate-900">{(doc.datos_factura.total ?? 0).toFixed(2)} €</span>
                                  {tieneLineas && (
                                    <button
                                      onClick={() => toggleLineas(doc.emailUid)}
                                      className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                      {lineasOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                      {doc.datos_factura.lineas.length} artículo{doc.datos_factura.lineas.length !== 1 ? 's' : ''}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 truncate">{doc.subject}</p>
                              )}

                              <p className="text-[10px] text-slate-300 mt-1">{fmtDateTime(doc.date)}</p>
                            </div>

                            {/* Right: actions */}
                            {((!isImportada && !isDescartada && doc.datos_factura) || pdfCacheRef.current.has(doc.emailUid)) && (
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                {!isImportada && !isDescartada && doc.datos_factura && (<>
                                  <button
                                    onClick={() => handleImport(doc)}
                                    disabled={importingUid === doc.emailUid}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-60 ${posibleDuplicado ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                  >
                                    {importingUid === doc.emailUid
                                      ? <><RefreshCw size={11} className="animate-spin" /> Subiendo PDF…</>
                                      : <><Package size={11} /> {posibleDuplicado ? 'Importar igualmente' : 'Importar a Stock'}</>}
                                  </button>
                                  <button
                                    onClick={() => setDescartarModal(doc)}
                                    className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-red-500 transition-colors font-bold"
                                  >
                                    <Trash2 size={10} /> Descartar
                                  </button>
                                </>)}
                                {pdfCacheRef.current.has(doc.emailUid) && (
                                  <button
                                    onClick={() => downloadPdf(doc.emailUid)}
                                    className="flex items-center gap-1 text-[9px] text-sky-600 hover:text-sky-800 transition-colors font-bold"
                                    title="Descargar PDF adjunto"
                                  >
                                    <Download size={10} /> PDF
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Líneas expandibles */}
                          {lineasOpen && tieneLineas && (
                            <div className="px-5 pb-4 bg-slate-50/60 border-t border-slate-100">
                              <div className="overflow-x-auto mt-2">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[9px] font-bold text-slate-400 uppercase">
                                      <th className="text-left py-1.5 px-2">Descripción</th>
                                      <th className="text-left py-1.5 px-2">Ref.</th>
                                      <th className="text-center py-1.5 px-2">Cant.</th>
                                      <th className="text-right py-1.5 px-2">P.Unit.</th>
                                      <th className="text-right py-1.5 px-2">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {doc.datos_factura!.lineas.map((l, i) => (
                                      <tr key={i} className="hover:bg-white/60">
                                        <td className="py-1.5 px-2 font-medium text-slate-800">{l.descripcion}</td>
                                        <td className="py-1.5 px-2 text-slate-400 font-mono text-[10px]">{l.referencia || '—'}</td>
                                        <td className="py-1.5 px-2 text-center text-slate-600">{l.cantidad}</td>
                                        <td className="py-1.5 px-2 text-right text-slate-600">{(l.precio_unitario ?? 0).toFixed(2)} €</td>
                                        <td className="py-1.5 px-2 text-right font-bold text-slate-900">{((l.cantidad ?? 1) * (l.precio_unitario ?? 0)).toFixed(2)} €</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
