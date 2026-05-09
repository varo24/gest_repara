import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Mail, RefreshCw, Inbox, FileText, AlertCircle,
  CheckCircle2, Paperclip, ArrowLeft, Package, X, Brain,
  ChevronDown, ChevronRight, Search, Eye, EyeOff, Play,
  AlertTriangle, Trash2,
} from 'lucide-react';
import { AppSettings } from '../types';
import { storage } from '../lib/dataService';

interface EmailSummary {
  uid: number;
  date: string | null;
  from: string;
  subject: string;
  seen: boolean;
  tiene_adjuntos: boolean;
  es_factura?: boolean;
}

interface DatosFactura {
  proveedor: string;
  numero_factura: string;
  fecha: string;
  total: number;
  lineas: Array<{ descripcion: string; referencia: string; cantidad: number; precio_unitario: number }>;
}

interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  data: string;
}

interface EmailDetail extends EmailSummary {
  text: string;
  html: string;
  es_factura: boolean;
  tipo: string;
  datos_factura: DatosFactura | null;
  attachments?: Attachment[];
}

interface DupeModal {
  datos: DatosFactura;
  emailUid: number;
  existing: any; // doc from facturas_importadas
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

interface CorreosProps {
  settings: AppSettings;
  onImportToStock: (datos: DatosFactura) => void;
  onBack: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string | null) =>
  !iso ? '—' : new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const fmtDateShort = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const decodeEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&acute;/g, "'")
    .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
    .replace(/&aacute;/g, 'á').replace(/&Aacute;/g, 'Á')
    .replace(/&iacute;/g, 'í').replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
    .replace(/&uacute;/g, 'ú').replace(/&Uacute;/g, 'Ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&[a-zA-Z]+;/g, ' ');
};

const isAnalyzable = (att: Attachment) =>
  att.contentType.startsWith('image/') || att.contentType === 'application/pdf';

// ── Date grouping ─────────────────────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const GROUP_ORDER = ['Hoy','Ayer','Esta semana','Semana pasada','Hace 2 semanas','Este mes'];

function classifyDate(dateStr: string | null): string {
  if (!dateStr) return 'Sin fecha';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const emailDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - emailDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return 'Esta semana';
  if (diffDays < 14) return 'Semana pasada';
  if (diffDays < 21) return 'Hace 2 semanas';
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'Este mes';
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function sortGroupKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a); const ib = GROUP_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const parse = (s: string) => { const p = s.split(' '); return parseInt(p[1] || '0') * 100 + MONTHS_ES.indexOf(p[0]); };
    return parse(b) - parse(a);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Correos({ settings, onImportToStock, onBack }: CorreosProps) {
  const serverUrl = (settings.imapServerUrl || '').trim().replace(/\/$/, '');
  const apiKey    = settings.imapApiKey || 'gestrepara-2026-secure';
  const imapDays  = settings.imapDays ?? 7;

  const [tab, setTab]                       = useState<'bandeja' | 'facturas'>('bandeja');
  const [emails, setEmails]                 = useState<EmailSummary[]>([]);
  const [loadingList, setLoadingList]       = useState(false);
  const [loadingDetail, setLoadingDetail]   = useState(false);
  const [selected, setSelected]             = useState<EmailDetail | null>(null);
  const [error, setError]                   = useState('');
  const [connected, setConnected]           = useState<boolean | null>(null);
  const [checkingConn, setCheckingConn]     = useState(false);
  const [analyzingAtt, setAnalyzingAtt]     = useState<string | null>(null);

  // correos_procesados: keyed by emailUid
  const [procesados, setProcessados]         = useState<Record<string, any>>({});
  // facturas_importadas: keyed by claveUnica
  const [facturasImportadas, setFacturasImportadas] = useState<Record<string, any>>({});
  // correos_analizados: keyed by emailUid (string)
  const [correosAnalizados, setCorreosAnalizados] = useState<Record<string, AnalizadoDoc>>({});
  const correosAnalizadosRef = useRef<Record<string, AnalizadoDoc>>({});
  // facturas_descartadas: keyed by emailUid (string)
  const [facturasDescartadas, setFacturasDescartadas] = useState<Record<string, any>>({});
  const facturasDescartadasRef = useRef<Record<string, any>>({});
  // duplicate import modal
  const [dupeModal, setDupeModal]            = useState<DupeModal | null>(null);
  // discard confirmation modal
  const [descartarModal, setDescartarModal]  = useState<AnalizadoDoc | null>(null);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [facturaProgress, setFacturaProgress] = useState<{ analizados: number; total: number; facturas: number } | null>(null);

  const [showProcesados, setShowProcesados]  = useState(false);
  const [expandedGroups, setExpandedGroups]  = useState<Set<string>>(new Set(['Hoy']));
  const [searchQuery, setSearchQuery]        = useState('');
  const [expandedLineas, setExpandedLineas]  = useState<Set<number>>(new Set());
  const [facturasFilter, setFacturasFilter]  = useState<'all' | 'pendientes' | 'importados'>('all');

  const cancelRef = useRef(false);

  // ── Storage subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub1 = storage.subscribe('correos_procesados', (data: any[]) => {
      const map: Record<string, any> = {};
      data.forEach(d => {
        const key = String(d.emailUid ?? d.uid ?? '');
        if (key) map[key] = d;
      });
      setProcessados(map);
    });
    const unsub2 = storage.subscribe('facturas_importadas', (data: any[]) => {
      const map: Record<string, any> = {};
      data.forEach(d => { if (d.claveUnica) map[d.claveUnica] = d; });
      setFacturasImportadas(map);
    });
    const unsub3 = storage.subscribe('correos_analizados', (data: any[]) => {
      const map: Record<string, AnalizadoDoc> = {};
      data.forEach((d: AnalizadoDoc) => { if (d.emailUid) map[String(d.emailUid)] = d; });
      setCorreosAnalizados(map);
      correosAnalizadosRef.current = map;
    });
    const unsub4 = storage.subscribe('facturas_descartadas', (data: any[]) => {
      const map: Record<string, any> = {};
      data.forEach(d => { if (d.emailUid) map[String(d.emailUid)] = d; });
      setFacturasDescartadas(map);
      facturasDescartadasRef.current = map;
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  // keep ref in sync so fetchFacturas always reads current cache
  useEffect(() => { correosAnalizadosRef.current = correosAnalizados; }, [correosAnalizados]);

  useEffect(() => () => { cancelRef.current = true; }, []);

  const checkHealth = useCallback(async () => {
    if (!serverUrl) { setConnected(false); return; }
    setCheckingConn(true);
    try {
      const r = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(6000) });
      setConnected(r.ok);
    } catch { setConnected(false); }
    finally { setCheckingConn(false); }
  }, [serverUrl]);

  const fetchEmails = useCallback(async () => {
    if (!serverUrl) return;
    setLoadingList(true); setError('');
    try {
      const r = await fetch(`${serverUrl}/emails?days=${imapDays}`, { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      const list: EmailSummary[] = data.emails || [];
      setEmails(list);
      setConnected(true);
      const keys = [...new Set(list.map(e => classifyDate(e.date)))];
      const sorted = sortGroupKeys(keys);
      if (sorted.length) setExpandedGroups(new Set([sorted[0]]));
    } catch (e: any) {
      setError(e.message || 'Error al conectar con el servidor');
      setConnected(false);
    } finally { setLoadingList(false); }
  }, [serverUrl, apiKey, imapDays]);

  const fetchFacturas = useCallback(async (force = false) => {
    if (!serverUrl) return;
    setLoadingFacturas(true);
    setFacturaProgress(null);
    try {
      // Only skip UIDs analyzed in the last 24h — older entries get re-analyzed
      // (catches invoices Gemini may have missed previously)
      // force=true (REANALIZAR button) bypasses all skipping
      const TTL_MS = 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - TTL_MS;
      const skipUids = force
        ? []
        : Object.values(correosAnalizadosRef.current)
            .filter(d => new Date(d.analyzedAt).getTime() > cutoff)
            .map(d => String(d.emailUid));
      // Discarded facturas are permanently excluded regardless of TTL or force
      const descartadasUids = Object.values(facturasDescartadasRef.current)
        .map(d => String(d.emailUid)).filter(Boolean);

      const params = new URLSearchParams({ days: String(imapDays) });
      if (skipUids.length) params.set('skip', skipUids.join(','));
      if (descartadasUids.length) params.set('descartadas', descartadasUids.join(','));
      const r = await fetch(`${serverUrl}/emails/facturas?${params}`, {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(180000),
      });
      if (!r.ok) return;
      const data = await r.json();
      const now = new Date().toISOString();
      // Save ALL analyzed results to cache (including es_factura:false) so they are
      // properly skipped on the next call within 24h
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
      setFacturaProgress({
        analizados: data.analizados ?? 0,
        total: data.total_candidatos ?? 0,
        facturas: (data.facturas as any[])?.length ?? 0,
      });
      if (data.results?.length) {
        const facturaUids = new Set(
          (data.results as any[]).filter((r: any) => r.es_factura).map((r: any) => r.uid as number)
        );
        setEmails(prev => prev.map(e => facturaUids.has(e.uid) ? { ...e, es_factura: true } : e));
      }
    } catch {
      // On error, ensure facturaProgress is never left as null so the tab renders safely
      setFacturaProgress(prev => prev ?? { analizados: 0, total: 0, facturas: 0 });
    } finally { setLoadingFacturas(false); }
  }, [serverUrl, apiKey, imapDays]);

  useEffect(() => {
    if (serverUrl) { fetchEmails(); fetchFacturas(); }
  }, [serverUrl, imapDays]); // eslint-disable-line

  const saveToCache = (uid: number, data: any, datos: DatosFactura | null, viaPdf: boolean) => {
    const hasPdf = (data.attachments || []).some((a: any) =>
      a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf')
    );
    storage.save('correos_analizados', `ANAL-${uid}`, {
      id: `ANAL-${uid}`,
      emailUid: uid,
      es_factura: datos !== null,
      from: data.from,
      subject: data.subject,
      date: data.date,
      datos_factura: datos,
      tiene_adjunto_pdf: hasPdf,
      analizado_via: viaPdf ? 'pdf' : 'texto',
      analyzedAt: new Date().toISOString(),
    });
  };

  const openEmail = async (uid: number) => {
    if (!serverUrl) return;
    setLoadingDetail(true); setSelected(null); setError('');

    let emailData: any;
    try {
      const r = await fetch(`${serverUrl}/emails/${uid}`, { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      emailData = await r.json();
    } catch (e: any) {
      setError(e.message || 'Error al cargar email');
      setLoadingDetail(false);
      return;
    }

    setSelected(emailData);
    setEmails(prev => prev.map(e => e.uid === uid ? { ...e, seen: true, es_factura: emailData.es_factura } : e));
    setLoadingDetail(false); // show email immediately — PDF analysis runs in background

    // If body analysis already found a factura, cache and done
    if (emailData.es_factura && emailData.datos_factura) {
      saveToCache(uid, emailData, emailData.datos_factura, false);
      return;
    }

    // Auto-analyze the first PDF attachment
    const pdfAtt = (emailData.attachments || []).find((a: any) =>
      a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf')
    );
    if (!pdfAtt) return;

    setAnalyzingAtt(pdfAtt.filename);
    try {
      const ar = await fetch(`${serverUrl}/analyze-attachment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ filename: pdfAtt.filename, contentType: pdfAtt.contentType, data: pdfAtt.data }),
        signal: AbortSignal.timeout(60000),
      });
      if (!ar.ok) return;
      const result = await ar.json();
      const a = result.analysis || {};
      if (result.ok && a.es_factura) {
        const datos: DatosFactura = {
          proveedor:      a.proveedor      || '',
          numero_factura: a.numero_factura || '',
          fecha:          a.fecha          || '',
          total:          a.total          || 0,
          lineas: (a.lineas || []).map((l: any) => ({
            descripcion:     l.descripcion     || '',
            referencia:      l.referencia      || '',
            cantidad:        l.cantidad        || 1,
            precio_unitario: l.precio_unitario || 0,
          })),
        };
        setSelected(prev => prev ? { ...prev, es_factura: true, datos_factura: datos } : prev);
        setEmails(prev => prev.map(e => e.uid === uid ? { ...e, es_factura: true } : e));
        saveToCache(uid, emailData, datos, true);
      }
    } catch { /* silent */ }
    finally { setAnalyzingAtt(null); }
  };

  const analyzeAttachment = async (att: Attachment) => {
    if (!serverUrl) return;
    const currentUid = selected?.uid;
    setAnalyzingAtt(att.filename); setError('');
    try {
      const r = await fetch(`${serverUrl}/analyze-attachment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ filename: att.filename, contentType: att.contentType, data: att.data }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const result = await r.json();
      const a = result.analysis || {};
      if (result.ok && a.es_factura) {
        const datos: DatosFactura = {
          proveedor:      a.proveedor      || '',
          numero_factura: a.numero_factura || '',
          fecha:          a.fecha          || '',
          total:          a.total          || 0,
          lineas: (a.lineas || []).map((l: any) => ({
            descripcion:     l.descripcion     || '',
            referencia:      l.referencia      || '',
            cantidad:        l.cantidad        || 1,
            precio_unitario: l.precio_unitario || 0,
          })),
        };
        setSelected(prev => prev ? { ...prev, es_factura: true, datos_factura: datos } : prev);
        if (currentUid != null) {
          setEmails(prev => prev.map(e => e.uid === currentUid ? { ...e, es_factura: true } : e));
          if (selected) saveToCache(currentUid, selected, datos, true);
        }
      } else {
        setError(result.error || 'El adjunto no parece una factura de proveedor');
      }
    } catch (e: any) {
      setError(e.message || 'Error al analizar adjunto');
    } finally { setAnalyzingAtt(null); }
  };

  // ── Import with anti-duplicate check ─────────────────────────────────────
  const handleImportClick = (datos: DatosFactura) => {
    if (!selected) return;
    const claveUnica = `${selected.uid}-${datos.numero_factura}`;
    const existing = facturasImportadas[claveUnica];
    if (existing) {
      setDupeModal({ datos, emailUid: selected.uid, existing });
    } else {
      doImport(datos, selected.uid, false);
    }
  };

  const doImport = (datos: DatosFactura, emailUid: number, forzado: boolean) => {
    const now = new Date().toISOString();
    const claveUnica = `${emailUid}-${datos.numero_factura}`;
    const importId = `IMP-${Date.now()}`;

    storage.save('facturas_importadas', importId, {
      id: importId,
      emailUid,
      claveUnica,
      proveedor: datos.proveedor,
      numeroFactura: datos.numero_factura,
      fecha: datos.fecha,
      total: datos.total,
      lineas: datos.lineas,
      importadoEn: now,
      forzado,
    });

    storage.save('correos_procesados', `PROC-${emailUid}`, {
      id: `PROC-${emailUid}`,
      emailUid,
      tipo: 'stock_importado',
      proveedor: datos.proveedor,
      numeroFactura: datos.numero_factura,
      procesadoEn: now,
    });

    setDupeModal(null);
    onImportToStock(datos);
  };

  const handleImportFromList = (doc: AnalizadoDoc) => {
    if (!doc.datos_factura) return;
    // Check exact match (same email + numero)
    const claveUnica = `${doc.emailUid}-${doc.datos_factura.numero_factura}`;
    if (facturasImportadas[claveUnica]) {
      setDupeModal({ datos: doc.datos_factura, emailUid: doc.emailUid, existing: facturasImportadas[claveUnica] });
      return;
    }
    // Check numero_factura across all imports (different email)
    if (doc.datos_factura.numero_factura && importedNumeros.has(doc.datos_factura.numero_factura)) {
      const existing = Object.values(facturasImportadas).find((imp: any) => imp.numeroFactura === doc.datos_factura!.numero_factura);
      setDupeModal({ datos: doc.datos_factura, emailUid: doc.emailUid, existing: existing || {} });
      return;
    }
    doImport(doc.datos_factura, doc.emailUid, false);
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

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredEmails = useMemo(() => {
    let list = emails;
    if (!showProcesados) list = list.filter(e => !procesados[String(e.uid)]);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.from.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
    }
    return list;
  }, [emails, procesados, showProcesados, searchQuery]);

  const pendingCount = useMemo(() =>
    emails.filter(e => e.tiene_adjuntos && !correosAnalizados[String(e.uid)]).length,
  [emails, correosAnalizados]);

  const groupedEmails = useMemo(() => {
    const map: Record<string, EmailSummary[]> = {};
    filteredEmails.forEach(e => {
      const key = classifyDate(e.date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return sortGroupKeys(Object.keys(map)).map(key => ({
      key,
      emails: map[key],
      facturas: map[key].filter(e => e.es_factura === true).length,
    }));
  }, [filteredEmails]);

  // Facturas tab: confirmed invoices from cache, excluding discarded ones
  const facturasFromCache = useMemo(() =>
    (Object.values(correosAnalizados) as AnalizadoDoc[])
      .filter(d => d.es_factura && !facturasDescartadas[String(d.emailUid)])
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
  [correosAnalizados, facturasDescartadas]);

  // Set of all imported numero_factura values (for cross-email duplicate detection)
  const importedNumeros = useMemo(() => {
    const s = new Set<string>();
    Object.values(facturasImportadas).forEach((imp: any) => {
      if (imp.numeroFactura) s.add(imp.numeroFactura);
    });
    return s;
  }, [facturasImportadas]);

  // Emails with attachments not yet analyzed — shown in FACTURAS tab when filter='pendientes'
  const pendingEmails = useMemo(() =>
    emails.filter(e => e.tiene_adjuntos && !correosAnalizados[String(e.uid)]),
  [emails, correosAnalizados]);

  // Facturas list filtered by the active stat card selection
  const filteredFacturas = useMemo(() => {
    if (facturasFilter === 'importados') return facturasFromCache.filter(d => !!procesados[String(d.emailUid)]);
    return facturasFromCache;
  }, [facturasFilter, facturasFromCache, procesados]);

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const isGroupExpanded = (key: string) => searchQuery.trim().length > 0 || expandedGroups.has(key);

  // ── No server ─────────────────────────────────────────────────────────────
  if (!serverUrl) {
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Correos</h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center space-y-4">
          <Mail size={40} className="text-slate-200 mx-auto" />
          <p className="text-sm font-bold text-slate-500">No hay servidor configurado</p>
          <p className="text-xs text-slate-400">
            Ve a <strong>Ajustes → Servidor de Correo</strong> e introduce la URL del servidor IMAP y pulsa <strong>Guardar</strong>.
          </p>
          <button onClick={onBack} className="mx-auto flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase transition-all">
            <ArrowLeft size={12} /> Ir a Ajustes
          </button>
        </div>
      </div>
    );
  }

  // ── Detail panel ──────────────────────────────────────────────────────────
  if (selected) {
    // Show only PDFs — hide decorative image logos/icons (images < 50 KB)
    const attachments = (selected.attachments || []).filter((a: Attachment) =>
      a.contentType === 'application/pdf' ||
      (a.filename || '').toLowerCase().endsWith('.pdf') ||
      (a.contentType.startsWith('image/') && a.size >= 50 * 1024)
    );
    const isProcesado = !!procesados[String(selected.uid)];
    const claveUnica = `${selected.uid}-${selected.datos_factura?.numero_factura}`;
    const yaImportada = selected.datos_factura ? !!facturasImportadas[claveUnica] : false;

    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Duplicate import modal */}
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
                  <p>ya fue importada el <strong>{fmtDateShort(dupeModal.existing.importadoEn)}</strong>.</p>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">¿Deseas importarla igualmente?</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDupeModal(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => doImport(dupeModal.datos, dupeModal.emailUid, true)}
                  className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-all"
                >
                  Importar igualmente
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => { setSelected(null); setError(''); }} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={14} /> Volver
          </button>
          <div className="flex items-center gap-3">
            {isProcesado && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase">
                <CheckCircle2 size={11} /> Ya importado
              </span>
            )}
            {selected.datos_factura && (
              <button
                onClick={() => handleImportClick(selected.datos_factura!)}
                className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm ${yaImportada ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                <Package size={13} />
                {yaImportada ? 'Reimportar a Stock' : 'Importar a Entrada de Stock'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <span className="text-xs font-bold text-red-700">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-slate-950 px-7 py-5">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{fmtDate(selected.date)}</p>
            <p className="text-lg font-black text-white leading-tight">{selected.subject}</p>
            <p className="text-sm text-slate-400 mt-1">{selected.from}</p>
          </div>

          {/* AI badge */}
          {selected.es_factura !== undefined && (
            <div className={`px-7 py-3 flex items-center gap-3 border-b border-slate-100 ${selected.es_factura ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              {selected.es_factura
                ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                : <AlertCircle size={14} className="text-slate-400 shrink-0" />}
              <span className={`text-xs font-bold ${selected.es_factura ? 'text-emerald-700' : 'text-slate-500'}`}>
                {selected.es_factura ? 'Factura de proveedor detectada' : `Clasificado como: ${selected.tipo}`}
              </span>
            </div>
          )}

          {/* Invoice data */}
          {selected.datos_factura && (
            <div className="px-7 py-5 border-b border-slate-100 bg-emerald-50/50">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-3">Datos extraídos</p>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {[
                  ['Proveedor', selected.datos_factura.proveedor],
                  ['Nº Factura', selected.datos_factura.numero_factura],
                  ['Fecha', selected.datos_factura.fecha],
                  ['Total', `${(selected.datos_factura.total ?? 0).toFixed(2)} €`],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
                    <p className="text-sm font-black text-slate-900">{val || '—'}</p>
                  </div>
                ))}
              </div>
              {yaImportada && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700">
                    Esta factura ya fue importada el {fmtDateShort(facturasImportadas[claveUnica]?.importadoEn)}.
                    Si la reimportas se creará una entrada de stock duplicada.
                  </p>
                </div>
              )}
              {selected.datos_factura.lineas?.length > 0 && (
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[9px] font-bold text-slate-400 uppercase bg-white/60">
                        <th className="text-left py-1.5 px-2">Descripción</th>
                        <th className="text-left py-1.5 px-2">Ref.</th>
                        <th className="text-center py-1.5 px-2">Cant.</th>
                        <th className="text-right py-1.5 px-2">P.Unit.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {selected.datos_factura.lineas.map((l, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-2 font-medium text-slate-800">{l.descripcion}</td>
                          <td className="py-1.5 px-2 text-slate-500 font-mono text-[10px]">{l.referencia}</td>
                          <td className="py-1.5 px-2 text-center">{l.cantidad}</td>
                          <td className="py-1.5 px-2 text-right font-bold">{(l.precio_unitario ?? 0).toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="px-7 py-4 border-b border-slate-100 bg-slate-50/60">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Adjuntos ({attachments.length})</p>
              <div className="space-y-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-100">
                    <Paperclip size={13} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{att.filename}</p>
                      <p className="text-[10px] text-slate-400">{att.contentType} · {fmtSize(att.size)}</p>
                    </div>
                    {isAnalyzable(att) && (
                      <button
                        onClick={() => analyzeAttachment(att)}
                        disabled={analyzingAtt !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-[10px] font-black uppercase transition-all shrink-0"
                      >
                        {analyzingAtt === att.filename ? <RefreshCw size={11} className="animate-spin" /> : <Brain size={11} />}
                        Analizar IA
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="px-7 py-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Contenido</p>
            {selected.html ? (
              <iframe
                srcDoc={selected.html}
                sandbox="allow-popups"
                className="w-full border-0 rounded-xl bg-white"
                style={{ minHeight: 280, maxHeight: 520, display: 'block' }}
                title="Contenido del correo"
                onLoad={e => {
                  const f = e.currentTarget;
                  try { f.style.height = (f.contentDocument?.body?.scrollHeight ?? 280) + 'px'; } catch {}
                }}
              />
            ) : (
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
                {decodeEntities(selected.text) || '(Sin contenido)'}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main list view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* Discard confirmation modal */}
      {descartarModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                <Trash2 size={28} className="text-red-400" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">¿Descartar factura?</h2>
              <div className="text-xs text-slate-600 space-y-1">
                <p><strong>{descartarModal.datos_factura?.proveedor || descartarModal.from}</strong></p>
                {descartarModal.datos_factura?.numero_factura && (
                  <p className="text-slate-400">Nº {descartarModal.datos_factura.numero_factura}</p>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No se importará al stock</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDescartarModal(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => doDescartar(descartarModal)}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Correos</h1>
          <div className="flex items-center gap-2 mt-1">
            {checkingConn
              ? <RefreshCw size={10} className="text-slate-400 animate-spin" />
              : connected === true
                ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                : <span className="w-2 h-2 rounded-full bg-red-400" />}
            <span className={`text-xs font-bold ${connected === true ? 'text-emerald-600' : 'text-red-500'}`}>
              {connected === true ? 'Conectado' : connected === false ? 'Sin conexión al servidor' : 'Verificando…'}
            </span>
          </div>
        </div>
        <button
          onClick={fetchEmails}
          disabled={loadingList}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40"
        >
          <RefreshCw size={13} className={loadingList ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => { setTab('bandeja'); setFacturasFilter('all'); }}
          className="bg-white rounded-2xl border border-slate-100 p-5 text-left hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total correos</p>
          <p className="text-2xl font-black text-slate-900">{emails.length}</p>
        </button>
        <button
          onClick={() => { setTab('facturas'); setFacturasFilter('pendientes'); }}
          className="bg-white rounded-2xl border border-slate-100 p-5 text-left hover:border-blue-200 hover:bg-blue-50/40 transition-all cursor-pointer"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pendientes de analizar</p>
          <p className="text-2xl font-black text-blue-600">{pendingCount}</p>
        </button>
        <button
          onClick={() => { setTab('facturas'); setFacturasFilter('all'); }}
          className="bg-white rounded-2xl border border-slate-100 p-5 text-left hover:border-emerald-200 hover:bg-emerald-50/40 transition-all cursor-pointer"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Facturas detectadas</p>
          <p className="text-2xl font-black text-emerald-600">{facturasFromCache.length}</p>
        </button>
        <button
          onClick={() => { setShowProcesados(true); setTab('facturas'); setFacturasFilter('importados'); }}
          className="bg-white rounded-2xl border border-slate-100 p-5 text-left hover:border-violet-200 hover:bg-violet-50/40 transition-all cursor-pointer"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Importados</p>
          <p className="text-2xl font-black text-violet-600">{Object.keys(procesados).length}</p>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar remitente o asunto…"
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowProcesados(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${showProcesados ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          {showProcesados ? <Eye size={13} /> : <EyeOff size={13} />}
          {showProcesados ? 'Ocultar importados' : 'Mostrar importados'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex bg-slate-100 rounded-xl p-0.5 w-fit">
          {(['bandeja', 'facturas'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'bandeja'
                ? <span className="flex items-center gap-1.5"><Inbox size={12} /> Bandeja ({filteredEmails.length})</span>
                : <span className="flex items-center gap-1.5"><FileText size={12} /> Facturas ({facturasFromCache.length}){loadingFacturas && <RefreshCw size={10} className="animate-spin ml-1" />}</span>}
            </button>
          ))}
        </div>

        {tab === 'facturas' && (
          <button
            onClick={() => fetchFacturas(true)}
            disabled={loadingFacturas}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm"
          >
            {loadingFacturas
              ? <><RefreshCw size={12} className="animate-spin" /> Analizando facturas…</>
              : <><Play size={12} /> Reanalizar</>}
          </button>
        )}
      </div>

      {/* ── PESTAÑA FACTURAS ─────────────────────────────────────────────── */}
      {tab === 'facturas' ? (
        <div className="space-y-3">

          {/* Active filter pill */}
          {facturasFilter !== 'all' && (
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${facturasFilter === 'pendientes' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                {facturasFilter === 'pendientes' ? `📋 Pendientes de analizar (${pendingEmails.length})` : `✓ Importados (${filteredFacturas.length})`}
              </span>
              <button onClick={() => setFacturasFilter('all')} className="text-[10px] text-slate-400 hover:text-slate-700 font-bold transition-colors">
                × Ver todos
              </button>
            </div>
          )}

          {/* PENDIENTES filter view */}
          {facturasFilter === 'pendientes' ? (
            pendingEmails.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
                <CheckCircle2 size={32} className="text-emerald-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sin pendientes</p>
                <p className="text-[10px] text-slate-300 mt-1">Todos los correos con adjunto han sido analizados</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                    {pendingEmails.length} correo{pendingEmails.length !== 1 ? 's' : ''} con adjunto pendiente{pendingEmails.length !== 1 ? 's' : ''} de analizar
                  </p>
                </div>
                <div className="divide-y divide-slate-50">
                  {pendingEmails.map(email => (
                    <div key={email.uid} className="flex items-center gap-4 px-6 py-3">
                      <Paperclip size={13} className="text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{email.from}</p>
                        <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-slate-400 mb-1">{fmtDate(email.date)}</p>
                        <button
                          onClick={() => openEmail(email.uid)}
                          className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wide transition-colors"
                        >
                          Analizar →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : loadingFacturas && facturasFromCache.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center space-y-3">
              <RefreshCw size={24} className="text-amber-400 mx-auto animate-spin" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analizando facturas… esto puede tardar unos segundos</p>
              <p className="text-[10px] text-slate-400">Procesando correos de los últimos {imapDays} días con IA</p>
              <div className="mx-auto w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          ) : filteredFacturas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
              <FileText size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                {facturasFilter === 'importados' ? 'Sin facturas importadas' : 'Sin facturas detectadas'}
              </p>
              <p className="text-[10px] text-slate-300 mt-1">Pulsa "Reanalizar" para buscar de nuevo en los últimos {imapDays} días</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {loadingFacturas ? (
                <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100">
                  <RefreshCw size={12} className="text-amber-500 animate-spin shrink-0" />
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Detectando facturas en los últimos {imapDays} días…</p>
                </div>
              ) : facturaProgress ? (
                <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100">
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Analizados {facturaProgress.analizados} de {facturaProgress.total} candidatos · {facturaProgress.facturas} factura{facturaProgress.facturas !== 1 ? 's' : ''} detectada{facturaProgress.facturas !== 1 ? 's' : ''}
                  </p>
                </div>
              ) : null}
              <div className="divide-y divide-slate-50">
                {(filteredFacturas || []).map(doc => {
                  const isProcesado = !!procesados[String(doc.emailUid)];
                  const clave = `${doc.emailUid}-${doc.datos_factura?.numero_factura}`;
                  const yaImportada = doc.datos_factura ? !!facturasImportadas[clave] : false;
                  const posibleDuplicado = !yaImportada && !!doc.datos_factura?.numero_factura && importedNumeros.has(doc.datos_factura.numero_factura);
                  const tieneLineas = (doc.datos_factura?.lineas?.length ?? 0) > 0;
                  const lineasExpanded = expandedLineas.has(doc.emailUid);
                  return (
                    <div key={doc.emailUid} className={isProcesado ? 'opacity-60' : ''}>
                      <div className="flex items-start gap-4 px-6 py-4">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-bold text-slate-800 truncate">{doc.from}</p>
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">✓ Factura</span>
                            {doc.tiene_adjunto_pdf
                              ? <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full shrink-0">📎 PDF</span>
                              : <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">📝 Texto</span>}
                            {isProcesado && <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full shrink-0">✓ Importado</span>}
                            {yaImportada && !isProcesado && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">⚠ Ya importada</span>}
                            {posibleDuplicado && <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0">⚠️ Posible duplicado</span>}
                          </div>
                          <p className="text-xs text-slate-500 truncate mb-1">{doc.subject}</p>
                          {doc.datos_factura && (
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-700">{doc.datos_factura.proveedor}</span>
                              <span className="text-[10px] text-slate-400">Nº {doc.datos_factura.numero_factura || '—'}</span>
                              <span className="text-[10px] text-slate-400">{doc.datos_factura.fecha || '—'}</span>
                              <span className="text-[10px] font-black text-slate-900">{(doc.datos_factura.total ?? 0).toFixed(2)} €</span>
                              {tieneLineas && (
                                <button
                                  onClick={() => setExpandedLineas(prev => { const n = new Set(prev); n.has(doc.emailUid) ? n.delete(doc.emailUid) : n.add(doc.emailUid); return n; })}
                                  className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  {lineasExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                  {doc.datos_factura.lineas.length} artículo{doc.datos_factura.lineas.length !== 1 ? 's' : ''}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <p className="text-[10px] text-slate-400 whitespace-nowrap">{fmtDate(doc.date)}</p>
                          {doc.datos_factura && !isProcesado && (
                            <button
                              onClick={() => handleImportFromList(doc)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-[10px] font-black uppercase transition-all ${yaImportada || posibleDuplicado ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            >
                              <Package size={11} />
                              {yaImportada ? 'Reimportar a Stock' : posibleDuplicado ? 'Importar igualmente' : 'Importar a Stock'}
                            </button>
                          )}
                          {!isProcesado && (
                            <button
                              onClick={() => setDescartarModal(doc)}
                              className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-red-500 transition-colors font-bold"
                            >
                              <Trash2 size={10} /> Descartar
                            </button>
                          )}
                          <button
                            onClick={() => openEmail(doc.emailUid)}
                            className="text-[9px] text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            Ver correo →
                          </button>
                        </div>
                      </div>
                      {lineasExpanded && tieneLineas && (
                        <div className="px-6 pb-4 bg-slate-50/60 border-t border-slate-100">
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
            </div>
          )}
        </div>
      ) : (
      /* ── PESTAÑA BANDEJA ───────────────────────────────────────────────── */
      <div className="space-y-3">
        {loadingList ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <RefreshCw size={24} className="text-slate-200 mx-auto mb-3 animate-spin" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Cargando correos…</p>
          </div>
        ) : groupedEmails.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Mail size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sin correos</p>
          </div>
        ) : (
          groupedEmails.map(group => (
            <div key={group.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isGroupExpanded(group.key)
                    ? <ChevronDown size={14} className="text-slate-400" />
                    : <ChevronRight size={14} className="text-slate-400" />}
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">{group.key}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{group.emails.length} correo{group.emails.length !== 1 ? 's' : ''}</span>
                </div>
                {group.facturas > 0 && (
                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                    {group.facturas} factura{group.facturas !== 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {isGroupExpanded(group.key) && (
                <div className="divide-y divide-slate-50">
                  {group.emails.map(email => {
                    const isProcesadoRow = !!procesados[String(email.uid)];
                    const esFacturaDetectada = !!correosAnalizados[String(email.uid)]?.es_factura;
                    const esFactura = email.es_factura === true || esFacturaDetectada;
                    return (
                      <button
                        key={email.uid}
                        onClick={() => openEmail(email.uid)}
                        className={`w-full flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left ${!email.seen ? 'bg-blue-50/30' : ''} ${isProcesadoRow ? 'opacity-60' : ''}`}
                      >
                        <div className="shrink-0 mt-1">
                          {isProcesadoRow || esFactura
                            ? <CheckCircle2 size={15} className="text-emerald-500" />
                            : email.seen
                              ? <Mail size={15} className="text-slate-300" />
                              : <Mail size={15} className="text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className={`text-sm truncate ${!email.seen ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>
                              {email.from}
                            </p>
                            {email.tiene_adjuntos && <Paperclip size={11} className="text-slate-400 shrink-0" />}
                            {isProcesadoRow && (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">✓ Importado</span>
                            )}
                            {!isProcesadoRow && esFactura && (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">📄 Factura</span>
                            )}
                          </div>
                          <p className={`text-xs truncate ${!email.seen ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                            {email.subject}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{fmtDate(email.date)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      )}

      {/* Loading detail overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex items-center gap-4">
            <RefreshCw size={20} className="text-blue-600 animate-spin" />
            <span className="text-sm font-bold text-slate-700">Cargando correo…</span>
          </div>
        </div>
      )}
    </div>
  );
}
