import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderOpen, Search, RefreshCw, ExternalLink,
  Download, Trash2, ChevronDown, ChevronRight, FileText,
  AlertCircle, Loader2, LayoutList, LayoutGrid, Upload, Truck,
} from 'lucide-react';
import { storage } from '../lib/dataService';
import { getFacturasProveedores, deleteFacturaPDF, uploadFacturaFile, ArchivoFactura } from '../lib/storageService';
import { AppSettings } from '../types';

interface ArchivoFacturasProps {
  settings: AppSettings;
  onBack: () => void;
  onViewSupplier?: (supplierName: string) => void;
}

interface ImportadaDoc {
  id: string;
  emailUid?: number;
  claveUnica?: string;
  proveedor: string;
  numeroFactura: string;
  fecha: string;
  total?: number;
  importadoEn?: string;
  lineas?: any[];
  pdfUrl?: string;
}

// Unified entry merging facturas_importadas + Firebase Storage
interface UnifiedEntry {
  key: string;           // unique: importId or storagePath
  importId?: string;     // id from facturas_importadas
  storagePath?: string;  // Firebase Storage path (if PDF exists)
  pdfUrl?: string;       // download URL for the PDF
  hasPdf: boolean;
  proveedor: string;     // human-readable
  numeroFactura: string;
  fecha: string;
  total?: number;
  importadoEn?: string;
  year: string;
  month: string;
  displayName: string;
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function slugToLabel(slug: string): string {
  return slug.replace(/_+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function monthLabel(m: string): string {
  const n = parseInt(m, 10);
  return MONTHS_ES[n - 1] ?? m;
}

function yearMonthFrom(fecha: string): { year: string; month: string } {
  try {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) throw new Error('invalid');
    return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, '0') };
  } catch {
    return { year: '????', month: '??' };
  }
}

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

const fmtEuros = (n?: number) =>
  n != null ? n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—';

export default function ArchivoFacturas({ onBack, onViewSupplier }: ArchivoFacturasProps) {
  const [importadasList, setImportadasList]       = useState<ImportadaDoc[]>([]);
  const [storageFiles, setStorageFiles]           = useState<ArchivoFactura[]>([]);
  const [loadingStorage, setLoadingStorage]       = useState(true);
  const [uploadingId, setUploadingId]             = useState<string | null>(null);
  const [error, setError]                         = useState('');
  const [search, setSearch]                       = useState('');
  const [viewMode, setViewMode]                   = useState<'accordion' | 'list'>('accordion');
  const [expandedProveedores, setExpandedProveedores] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears]         = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete]         = useState<UnifiedEntry | null>(null);
  const [deleting, setDeleting]                   = useState<string | null>(null);
  const [pendingUploadEntry, setPendingUploadEntry] = useState<UnifiedEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Primary data source: facturas_importadas from IDB/Firestore
  useEffect(() => {
    const unsub = storage.subscribe('facturas_importadas', (data: any[]) => {
      setImportadasList(data.filter(d => d.proveedor || d.numeroFactura));
    });
    return unsub;
  }, []);

  const loadStorageFiles = useCallback(async () => {
    setLoadingStorage(true);
    try {
      const files = await getFacturasProveedores();
      setStorageFiles(files);
    } catch (e: any) {
      setError(e.message || 'Error al cargar PDFs de Storage');
    } finally {
      setLoadingStorage(false);
    }
  }, []);

  useEffect(() => { loadStorageFiles(); }, [loadStorageFiles]);

  // Auto-expand all proveedores when data loads
  useEffect(() => {
    if (importadasList.length > 0) {
      const provs = new Set(importadasList.map(d => d.proveedor));
      setExpandedProveedores(provs);
      const yearKeys = new Set(importadasList.map(d => {
        const { year } = yearMonthFrom(d.fecha);
        return `${d.proveedor}/${year}`;
      }));
      setExpandedYears(yearKeys);
    }
  }, [importadasList.length]); // eslint-disable-line

  // Build a map of Storage files by URL for quick lookup
  const storageByUrl = useMemo(() => {
    const m = new Map<string, ArchivoFactura>();
    storageFiles.forEach(f => m.set(f.url, f));
    return m;
  }, [storageFiles]);

  // Merge: importadas (with or without PDF) + orphaned Storage files
  const unified = useMemo<UnifiedEntry[]>(() => {
    const entries: UnifiedEntry[] = [];
    const usedStorageUrls = new Set<string>();

    // All importadas entries
    importadasList.forEach(imp => {
      const { year, month } = yearMonthFrom(imp.fecha);
      const storageEntry = imp.pdfUrl ? storageByUrl.get(imp.pdfUrl) : undefined;
      if (imp.pdfUrl) usedStorageUrls.add(imp.pdfUrl);
      entries.push({
        key: imp.id,
        importId: imp.id,
        storagePath: storageEntry?.path,
        pdfUrl: imp.pdfUrl || undefined,
        hasPdf: !!imp.pdfUrl,
        proveedor: imp.proveedor,
        numeroFactura: imp.numeroFactura,
        fecha: imp.fecha,
        total: imp.total,
        importadoEn: imp.importadoEn,
        year,
        month,
        displayName: imp.numeroFactura || imp.id,
      });
    });

    // Orphaned Storage files not linked to any importada
    storageFiles.forEach(f => {
      if (usedStorageUrls.has(f.url)) return;
      entries.push({
        key: f.path,
        storagePath: f.path,
        pdfUrl: f.url,
        hasPdf: true,
        proveedor: slugToLabel(f.proveedor),
        numeroFactura: f.name.replace(/\.pdf$/i, '').replace(/_+/g, ' '),
        fecha: `${f.year}-${f.month}-01`,
        year: f.year,
        month: f.month,
        displayName: f.name.replace(/\.pdf$/i, '').replace(/_+/g, ' '),
      });
    });

    return entries;
  }, [importadasList, storageByUrl, storageFiles]);

  // Stats
  const stats = useMemo(() => {
    const conPdf = unified.filter(e => e.hasPdf).length;
    const sinPdf = unified.filter(e => !e.hasPdf).length;
    const proveedores = new Set(unified.map(e => e.proveedor)).size;
    const totalImporte = unified.reduce((s, e) => s + (e.total ?? 0), 0);
    return { total: unified.length, conPdf, sinPdf, proveedores, totalImporte };
  }, [unified]);

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return unified;
    const q = search.toLowerCase();
    return unified.filter(e =>
      e.proveedor.toLowerCase().includes(q) ||
      e.numeroFactura.toLowerCase().includes(q) ||
      e.displayName.toLowerCase().includes(q)
    );
  }, [unified, search]);

  // Group for accordion: proveedor → year → month → entries[]
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, Record<string, UnifiedEntry[]>>> = {};
    filtered.forEach(e => {
      if (!map[e.proveedor]) map[e.proveedor] = {};
      if (!map[e.proveedor][e.year]) map[e.proveedor][e.year] = {};
      if (!map[e.proveedor][e.year][e.month]) map[e.proveedor][e.year][e.month] = [];
      map[e.proveedor][e.year][e.month].push(e);
    });
    return map;
  }, [filtered]);

  const toggleProv = (p: string) =>
    setExpandedProveedores(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const toggleYear = (key: string) =>
    setExpandedYears(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Manual PDF upload
  const triggerUpload = (entry: UnifiedEntry) => {
    setPendingUploadEntry(entry);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingUploadEntry?.importId) return;
    const imp = importadasList.find(d => d.id === pendingUploadEntry.importId);
    if (!imp) return;
    setUploadingId(imp.id);
    setPendingUploadEntry(null);
    try {
      const url = await uploadFacturaFile(file, imp.proveedor, imp.numeroFactura, imp.fecha);
      storage.save('facturas_importadas', imp.id, { id: imp.id, pdfUrl: url });
      // refresh storage listing to include new file
      loadStorageFiles();
    } catch (err: any) {
      setError(err.message || 'Error al subir PDF');
    } finally {
      setUploadingId(null);
    }
  };

  // Delete PDF from Storage (keeps importada record, clears pdfUrl)
  const handleDelete = async (entry: UnifiedEntry) => {
    setDeleting(entry.key); setConfirmDelete(null);
    try {
      if (entry.storagePath) await deleteFacturaPDF(entry.storagePath);
      if (entry.importId) {
        storage.save('facturas_importadas', entry.importId, { id: entry.importId, pdfUrl: null });
      }
      setStorageFiles(prev => prev.filter(f => f.path !== entry.storagePath));
    } catch (e: any) {
      setError(e.message || 'Error al eliminar PDF');
    } finally { setDeleting(null); }
  };

  const isLoading = loadingStorage && importadasList.length === 0;

  // ── Row component ──────────────────────────────────────────────────────────
  const EntryRow = ({ e }: { e: UnifiedEntry }) => {
    const isUploadingThis = uploadingId === e.importId;
    const isDeletingThis = deleting === e.key;
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
        <FileText size={15} className={e.hasPdf ? 'text-sky-400 shrink-0' : 'text-slate-300 shrink-0'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-900 truncate">{e.displayName}</p>
            {!e.hasPdf && (
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                Sin PDF
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {e.fecha ? fmtDate(e.fecha) : `${monthLabel(e.month)} ${e.year}`}
            {e.total != null && ` · ${fmtEuros(e.total)}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {e.hasPdf && e.pdfUrl ? (
            <>
              <a
                href={e.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors"
                title="Ver PDF"
              >
                <ExternalLink size={13} />
              </a>
              <a
                href={e.pdfUrl}
                download
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Descargar"
              >
                <Download size={13} />
              </a>
              <button
                onClick={() => setConfirmDelete(e)}
                disabled={isDeletingThis}
                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                title="Eliminar PDF"
              >
                {isDeletingThis ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </>
          ) : e.importId ? (
            <button
              onClick={() => triggerUpload(e)}
              disabled={isUploadingThis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase transition-colors disabled:opacity-50"
              title="Subir PDF manualmente"
            >
              {isUploadingThis ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              {isUploadingThis ? 'Subiendo…' : 'Subir PDF'}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Hidden file input for manual upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <FolderOpen size={22} className="text-sky-500" />
            Archivo Facturas
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Historial de facturas de proveedores importadas
          </p>
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
            onClick={loadStorageFiles}
            disabled={loadingStorage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingStorage ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats — 4 tiles */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Facturas', value: stats.total,          color: '#0288d1' },
          { label: 'Con PDF',        value: stats.conPdf,         color: '#2e7d32' },
          { label: 'Sin PDF',        value: stats.sinPdf,         color: '#757575' },
          { label: 'Importe Total',  value: fmtEuros(stats.totalImporte), color: '#6a1b9a' },
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
          placeholder="Buscar por proveedor, número de factura…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 bg-white"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-base leading-none">×</button>
        </div>
      )}

      {/* Storage loading note */}
      {loadingStorage && importadasList.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold">
          <Loader2 size={12} className="animate-spin" />
          Verificando PDFs en Storage…
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-sky-400" />
          <span className="ml-3 text-sm font-bold text-slate-400">Cargando archivo…</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <FolderOpen size={40} className="text-slate-200 mx-auto mb-4" />
          <p className="font-black text-slate-400 uppercase text-sm tracking-widest">
            {search ? 'Sin resultados' : 'Sin facturas importadas'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {search
              ? 'Prueba con otra búsqueda'
              : 'Las facturas importadas desde el módulo Correos aparecerán aquí'}
          </p>
        </div>
      )}

      {/* Content */}
      {!isLoading && filtered.length > 0 && (
        <>
          {/* ── ACCORDION VIEW ── */}
          {viewMode === 'accordion' && (
            <div className="space-y-3">
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b, 'es'))
                .map(([prov, years]) => {
                  const provOpen = expandedProveedores.has(prov);
                  const provTotal = Object.values(years).flatMap(m => Object.values(m)).flat().length;
                  const provConPdf = Object.values(years).flatMap(m => Object.values(m)).flat().filter(e => e.hasPdf).length;
                  return (
                    <div key={prov} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="flex items-center w-full">
                        <button
                          onClick={() => toggleProv(prov)}
                          className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                        >
                          {provOpen
                            ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                            : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                          <FolderOpen size={16} className="text-sky-400 shrink-0" />
                          <span className="flex-1 font-black text-slate-900 uppercase text-sm tracking-wide">{prov}</span>
                          <span className="text-[10px] font-bold text-emerald-600 mr-1">{provConPdf} PDF</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{provTotal}</span>
                        </button>
                        {onViewSupplier && (
                          <button
                            onClick={() => onViewSupplier(prov)}
                            className="flex items-center gap-1 mr-3 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors shrink-0"
                            title="Ver ficha del proveedor"
                          >
                            <Truck size={11} /> Ficha
                          </button>
                        )}
                      </div>

                      {provOpen && (
                        <div className="border-t border-slate-100">
                          {Object.entries(years)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([year, months]) => {
                              const yearKey = `${prov}/${year}`;
                              const yearOpen = expandedYears.has(yearKey);
                              const yearTotal = Object.values(months).flat().length;
                              return (
                                <div key={year}>
                                  <button
                                    onClick={() => toggleYear(yearKey)}
                                    className="w-full flex items-center gap-3 px-8 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
                                  >
                                    {yearOpen
                                      ? <ChevronDown size={13} className="text-slate-300 shrink-0" />
                                      : <ChevronRight size={13} className="text-slate-300 shrink-0" />}
                                    <span className="flex-1 text-xs font-black text-slate-600 uppercase">{year}</span>
                                    <span className="text-[10px] font-bold text-slate-300">{yearTotal} docs</span>
                                  </button>

                                  {yearOpen && (
                                    <div>
                                      {Object.entries(months)
                                        .sort(([a], [b]) => b.localeCompare(a))
                                        .map(([month, entries]) => (
                                          <div key={month} className="border-b border-slate-50 last:border-0">
                                            <div className="px-12 py-2 bg-slate-50/50">
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {monthLabel(month)} {year}
                                              </p>
                                            </div>
                                            <div className="px-4">
                                              {entries.map(e => <EntryRow key={e.key} e={e} />)}
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
              <div className="grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_auto] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>PDF</span>
                <span>Factura</span>
                <span>Proveedor</span>
                <span>Fecha</span>
                <span>Importe</span>
                <span>Acciones</span>
              </div>
              {[...filtered]
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map(e => {
                  const isUploadingThis = uploadingId === e.importId;
                  const isDeletingThis = deleting === e.key;
                  return (
                    <div key={e.key} className="grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      {/* PDF status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${e.hasPdf ? 'bg-emerald-400' : 'bg-slate-200'}`} title={e.hasPdf ? 'Con PDF' : 'Sin PDF'} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{e.displayName}</p>
                        {!e.hasPdf && (
                          <span className="text-[9px] font-black uppercase text-slate-400">Sin PDF</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate">{e.proveedor}</p>
                      <p className="text-xs text-slate-500">{e.fecha ? fmtDate(e.fecha) : `${monthLabel(e.month)} ${e.year}`}</p>
                      <p className="text-xs font-bold text-slate-700">{fmtEuros(e.total)}</p>
                      <div className="flex items-center gap-1.5">
                        {e.hasPdf && e.pdfUrl ? (
                          <>
                            <a href={e.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors" title="Ver PDF">
                              <ExternalLink size={12} />
                            </a>
                            <a href={e.pdfUrl} download className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" title="Descargar">
                              <Download size={12} />
                            </a>
                            <button
                              onClick={() => setConfirmDelete(e)}
                              disabled={isDeletingThis}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                              title="Eliminar PDF"
                            >
                              {isDeletingThis ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </>
                        ) : e.importId ? (
                          <button
                            onClick={() => triggerUpload(e)}
                            disabled={isUploadingThis}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black uppercase transition-colors disabled:opacity-50"
                          >
                            {isUploadingThis ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                            {isUploadingThis ? '…' : 'PDF'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
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
                ¿Eliminar el PDF de <strong>{confirmDelete.displayName}</strong>?
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                La factura seguirá visible pero sin PDF adjunto
              </p>
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
                Eliminar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
