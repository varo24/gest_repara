import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, FolderOpen, Search, RefreshCw, ExternalLink,
  Download, Trash2, ChevronDown, ChevronRight, FileText,
  AlertCircle, Loader2, LayoutList, LayoutGrid,
} from 'lucide-react';
import { AppSettings } from '../types';
import { storage } from '../lib/dataService';
import { getFacturasProveedores, deleteFacturaPDF, ArchivoFactura } from '../lib/storageService';

interface ArchivoFacturasProps {
  settings: AppSettings;
  onBack: () => void;
}

interface ImportadaDoc {
  id: string;
  emailUid: number;
  claveUnica: string;
  proveedor: string;
  numeroFactura: string;
  fecha: string;
  total: number;
  importadoEn: string;
  pdfUrl?: string;
  lineas?: any[];
}

interface EnrichedFactura extends ArchivoFactura {
  importada?: ImportadaDoc;
  displayName: string;
  totalImporte?: number;
  fechaFactura?: string;
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function slugToLabel(slug: string): string {
  return slug.replace(/_+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function monthLabel(m: string): string {
  const n = parseInt(m, 10);
  return MONTHS_ES[n - 1] ?? m;
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

const fmtEuros = (n?: number) =>
  n != null ? n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—';

export default function ArchivoFacturas({ onBack }: ArchivoFacturasProps) {
  const [archivos, setArchivos]               = useState<EnrichedFactura[]>([]);
  const [importadas, setImportadas]           = useState<Record<string, ImportadaDoc>>({});
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [search, setSearch]                   = useState('');
  const [viewMode, setViewMode]               = useState<'accordion' | 'list'>('accordion');
  const [expandedProveedores, setExpandedProveedores] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears]     = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete]     = useState<EnrichedFactura | null>(null);
  const [deleting, setDeleting]               = useState<string | null>(null);

  // Subscribe to facturas_importadas for enrichment
  useEffect(() => {
    const unsub = storage.subscribe('facturas_importadas', (data: any[]) => {
      const map: Record<string, ImportadaDoc> = {};
      data.forEach(d => {
        if (d.pdfUrl) map[d.pdfUrl] = d;
        if (d.claveUnica) map[d.claveUnica] = d;
      });
      setImportadas(map);
    });
    return unsub;
  }, []);

  const loadArchivos = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const raw = await getFacturasProveedores();
      setArchivos(raw.map(f => ({
        ...f,
        displayName: f.name.replace(/\.pdf$/i, '').replace(/_+/g, ' '),
        importada: undefined,
        totalImporte: undefined,
        fechaFactura: undefined,
      })));
      // Auto-expand all proveedores on first load
      const proveedores = new Set(raw.map(f => f.proveedor));
      setExpandedProveedores(proveedores);
      const years = new Set(raw.map(f => `${f.proveedor}/${f.year}`));
      setExpandedYears(years);
    } catch (e: any) {
      setError(e.message || 'Error al cargar el archivo');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadArchivos(); }, [loadArchivos]);

  // Enrich with importada data
  const enriched = useMemo<EnrichedFactura[]>(() =>
    archivos.map(f => {
      const byUrl = f.url ? importadas[f.url] : undefined;
      const imp = byUrl;
      return {
        ...f,
        importada: imp,
        totalImporte: imp?.total,
        fechaFactura: imp?.fecha,
      };
    }),
  [archivos, importadas]);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(f =>
      f.displayName.toLowerCase().includes(q) ||
      slugToLabel(f.proveedor).toLowerCase().includes(q) ||
      (f.importada?.numeroFactura || '').toLowerCase().includes(q)
    );
  }, [enriched, search]);

  // Stats
  const stats = useMemo(() => {
    const proveedores = new Set(enriched.map(f => f.proveedor)).size;
    const totalImporte = enriched.reduce((s, f) => s + (f.totalImporte ?? 0), 0);
    return { total: enriched.length, proveedores, totalImporte };
  }, [enriched]);

  // Grouped for accordion
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, Record<string, EnrichedFactura[]>>> = {};
    filtered.forEach(f => {
      if (!map[f.proveedor]) map[f.proveedor] = {};
      if (!map[f.proveedor][f.year]) map[f.proveedor][f.year] = {};
      if (!map[f.proveedor][f.year][f.month]) map[f.proveedor][f.year][f.month] = [];
      map[f.proveedor][f.year][f.month].push(f);
    });
    return map;
  }, [filtered]);

  const toggleProv = (p: string) =>
    setExpandedProveedores(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const toggleYear = (key: string) =>
    setExpandedYears(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleDelete = async (f: EnrichedFactura) => {
    setDeleting(f.path); setConfirmDelete(null);
    try {
      await deleteFacturaPDF(f.path);
      setArchivos(prev => prev.filter(a => a.path !== f.path));
    } catch (e: any) {
      setError(e.message || 'Error al eliminar');
    } finally { setDeleting(null); }
  };

  const FacturaRow = ({ f }: { f: EnrichedFactura }) => (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <FileText size={15} className="text-sky-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 truncate">{f.displayName}</p>
        <p className="text-[10px] text-slate-400">
          {f.importada ? (
            <span className="text-emerald-600 font-bold">
              {f.importada.numeroFactura} · {fmtDate(f.importada.fecha)} · {fmtEuros(f.importada.total)}
            </span>
          ) : (
            <span>{monthLabel(f.month)} {f.year}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors"
          title="Ver PDF"
        >
          <ExternalLink size={13} />
        </a>
        <a
          href={f.url}
          download={f.name}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Descargar"
        >
          <Download size={13} />
        </a>
        <button
          onClick={() => setConfirmDelete(f)}
          disabled={deleting === f.path}
          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
          title="Eliminar"
        >
          {deleting === f.path ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <FolderOpen size={22} className="text-sky-500" />
            Archivo Facturas
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">PDFs de facturas de proveedores</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(v => v === 'accordion' ? 'list' : 'accordion')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            {viewMode === 'accordion' ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
            {viewMode === 'accordion' ? 'Lista' : 'Carpetas'}
          </button>
          <button
            onClick={loadArchivos}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Facturas', value: stats.total, color: '#0288d1' },
          { label: 'Proveedores', value: stats.proveedores, color: '#6a1b9a' },
          { label: 'Importe Total', value: fmtEuros(stats.totalImporte), color: '#2e7d32' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por proveedor, número…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-sky-400" />
          <span className="ml-3 text-sm font-bold text-slate-400">Cargando archivo…</span>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <FolderOpen size={40} className="text-slate-200 mx-auto mb-4" />
          <p className="font-black text-slate-400 uppercase text-sm tracking-widest">
            {search ? 'Sin resultados' : 'Archivo vacío'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Prueba con otra búsqueda' : 'Las facturas importadas con PDF aparecerán aquí'}
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && filtered.length > 0 && (
        <>
          {/* ── ACCORDION VIEW ── */}
          {viewMode === 'accordion' && (
            <div className="space-y-3">
              {Object.entries(grouped).sort(([a], [b]) => slugToLabel(a).localeCompare(slugToLabel(b))).map(([prov, years]) => {
                const provLabel = slugToLabel(prov);
                const provOpen = expandedProveedores.has(prov);
                const provTotal = Object.values(years).flatMap(m => Object.values(m)).flat().length;
                return (
                  <div key={prov} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Proveedor header */}
                    <button
                      onClick={() => toggleProv(prov)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      {provOpen ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                      <FolderOpen size={16} className="text-sky-400 shrink-0" />
                      <span className="flex-1 font-black text-slate-900 uppercase text-sm tracking-wide">{provLabel}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{provTotal}</span>
                    </button>

                    {provOpen && (
                      <div className="border-t border-slate-100">
                        {Object.entries(years).sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => {
                          const yearKey = `${prov}/${year}`;
                          const yearOpen = expandedYears.has(yearKey);
                          const yearTotal = Object.values(months).flat().length;
                          return (
                            <div key={year}>
                              <button
                                onClick={() => toggleYear(yearKey)}
                                className="w-full flex items-center gap-3 px-8 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
                              >
                                {yearOpen ? <ChevronDown size={13} className="text-slate-300 shrink-0" /> : <ChevronRight size={13} className="text-slate-300 shrink-0" />}
                                <span className="flex-1 text-xs font-black text-slate-600 uppercase">{year}</span>
                                <span className="text-[10px] font-bold text-slate-300">{yearTotal} docs</span>
                              </button>

                              {yearOpen && (
                                <div>
                                  {Object.entries(months).sort(([a], [b]) => b.localeCompare(a)).map(([month, files]) => (
                                    <div key={month} className="border-b border-slate-50 last:border-0">
                                      <div className="px-12 py-2 bg-slate-50/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          {monthLabel(month)} {year}
                                        </p>
                                      </div>
                                      <div className="px-4">
                                        {files.map(f => <FacturaRow key={f.path} f={f} />)}
                                      </div>
                                    </div>
                                  ))}
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

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Documento</span>
                <span>Proveedor</span>
                <span>Fecha</span>
                <span>Importe</span>
                <span>Acciones</span>
              </div>
              {filtered.sort((a, b) => {
                const da = a.importada?.fecha || `${a.year}-${a.month}`;
                const db = b.importada?.fecha || `${b.year}-${b.month}`;
                return db.localeCompare(da);
              }).map(f => (
                <div key={f.path} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{f.displayName}</p>
                    {f.importada?.numeroFactura && (
                      <p className="text-[10px] text-emerald-600 font-bold">{f.importada.numeroFactura}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 truncate">{slugToLabel(f.proveedor)}</p>
                  <p className="text-xs text-slate-500">
                    {f.importada?.fecha ? fmtDate(f.importada.fecha) : `${monthLabel(f.month)} ${f.year}`}
                  </p>
                  <p className="text-xs font-bold text-slate-700">{fmtEuros(f.importada?.total)}</p>
                  <div className="flex items-center gap-1.5">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors" title="Ver PDF">
                      <ExternalLink size={12} />
                    </a>
                    <a href={f.url} download={f.name} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" title="Descargar">
                      <Download size={12} />
                    </a>
                    <button
                      onClick={() => setConfirmDelete(f)}
                      disabled={deleting === f.path}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                      title="Eliminar"
                    >
                      {deleting === f.path ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Eliminar PDF</h2>
              <p className="text-xs text-slate-600">
                ¿Eliminar <strong>{confirmDelete.displayName}</strong> del archivo?
              </p>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Esta acción no se puede deshacer</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
