import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, RefreshCw, Inbox, FileText, AlertCircle,
  CheckCircle2, Paperclip, ArrowLeft, Package, X, Brain
} from 'lucide-react';
import { AppSettings } from '../types';

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
  data: string; // base64
}

interface EmailDetail extends EmailSummary {
  text: string;
  html: string;
  es_factura: boolean;
  tipo: string;
  datos_factura: DatosFactura | null;
  attachments?: Attachment[];
}

interface CorreosProps {
  settings: AppSettings;
  onImportToStock: (datos: DatosFactura) => void;
  onBack: () => void;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const decodeEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&acute;/g, "'")
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

export default function Correos({ settings, onImportToStock, onBack }: CorreosProps) {
  const serverUrl = (settings.imapServerUrl || '').trim().replace(/\/$/, '');

  console.log('[Correos] settings.imapServerUrl:', settings?.imapServerUrl, '→ serverUrl:', serverUrl);

  const [tab, setTab]                         = useState<'bandeja' | 'facturas'>('bandeja');
  const [emails, setEmails]                   = useState<EmailSummary[]>([]);
  const [loadingList, setLoadingList]         = useState(false);
  const [loadingDetail, setLoadingDetail]     = useState(false);
  const [selected, setSelected]               = useState<EmailDetail | null>(null);
  const [error, setError]                     = useState('');
  const [connected, setConnected]             = useState<boolean | null>(null);
  const [checkingConn, setCheckingConn]       = useState(false);
  const [analyzingAtt, setAnalyzingAtt]       = useState<string | null>(null);

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
    if (!serverUrl) { setError('Configura la URL del servidor en Ajustes → Servidor de Correo'); return; }
    setLoadingList(true);
    setError('');
    try {
      const r = await fetch(`${serverUrl}/emails`, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      setEmails(data.emails || []);
      setConnected(true);
    } catch (e: any) {
      setError(e.message || 'Error al conectar con el servidor');
      setConnected(false);
    } finally { setLoadingList(false); }
  }, [serverUrl]);

  useEffect(() => {
    checkHealth();
    if (serverUrl) fetchEmails();
  }, [serverUrl]); // eslint-disable-line

  const openEmail = async (uid: number) => {
    if (!serverUrl) return;
    setLoadingDetail(true);
    setSelected(null);
    try {
      const r = await fetch(`${serverUrl}/emails/${uid}`, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      setSelected(data);
      setEmails(prev => prev.map(e => e.uid === uid
        ? { ...e, seen: true, es_factura: data.es_factura }
        : e));
    } catch (e: any) {
      setError(e.message || 'Error al cargar email');
    } finally { setLoadingDetail(false); }
  };

  const analyzeAttachment = async (att: Attachment) => {
    if (!serverUrl) return;
    setAnalyzingAtt(att.filename);
    setError('');
    try {
      const r = await fetch(`${serverUrl}/analyze-attachment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: att.filename, contentType: att.contentType, data: att.data }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const result = await r.json();
      // Server returns { ok, analysis: { es_factura, proveedor, numero_factura, fecha, total, lineas } }
      const a = result.analysis || {};
      if (result.ok && a.es_factura) {
        const datos: DatosFactura = {
          proveedor:       a.proveedor       || '',
          numero_factura:  a.numero_factura  || '',
          fecha:           a.fecha           || '',
          total:           a.total           || 0,
          lineas: (a.lineas || []).map((l: any) => ({
            descripcion:    l.descripcion    || '',
            referencia:     l.referencia     || '',
            cantidad:       l.cantidad       || 1,
            precio_unitario: l.precio_unitario || 0,
          })),
        };
        setSelected(prev => prev ? { ...prev, es_factura: true, datos_factura: datos } : prev);
        setEmails(prev => prev.map(e => selected && e.uid === selected.uid ? { ...e, es_factura: true } : e));
      } else {
        setError(result.error || 'El adjunto no parece una factura de proveedor');
      }
    } catch (e: any) {
      setError(e.message || 'Error al analizar adjunto');
    } finally { setAnalyzingAtt(null); }
  };

  const facturas = emails.filter(e => e.es_factura === true);
  const listToShow = tab === 'bandeja' ? emails : facturas;

  // ── No server configured ──────────────────────────────────────────────────
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
          <p className="text-[10px] text-slate-300 font-mono break-all">
            imapServerUrl recibido: {JSON.stringify(settings?.imapServerUrl ?? null)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mx-auto flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase transition-all"
          >
            <RefreshCw size={12} /> Recargar página
          </button>
        </div>
      </div>
    );
  }

  // ── Detail panel ──────────────────────────────────────────────────────────
  if (selected) {
    const attachments = selected.attachments || [];
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={14} /> Volver
          </button>
          {selected.datos_factura && (
            <button
              onClick={() => { onImportToStock(selected.datos_factura!); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all shadow-sm"
            >
              <Package size={13} /> Importar a Entrada de Stock
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <span className="text-xs font-bold text-red-700">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Email header */}
          <div className="bg-slate-950 px-7 py-5">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{fmtDate(selected.date)}</p>
            <p className="text-lg font-black text-white leading-tight">{selected.subject}</p>
            <p className="text-sm text-slate-400 mt-1">{selected.from}</p>
          </div>

          {/* AI analysis badge */}
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
              {selected.datos_factura.lineas?.length > 0 && (
                <div className="overflow-x-auto">
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
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Adjuntos ({attachments.length})
              </p>
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
                        {analyzingAtt === att.filename
                          ? <RefreshCw size={11} className="animate-spin" />
                          : <Brain size={11} />}
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
                  // Auto-height
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

  // ── Main list view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Correos</h1>
          <div className="flex items-center gap-2 mt-1">
            {checkingConn ? (
              <RefreshCw size={10} className="text-slate-400 animate-spin" />
            ) : connected === true ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-400" />
            )}
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total correos',       value: emails.length,                      color: 'text-slate-900' },
          { label: 'No leídos',           value: emails.filter(e => !e.seen).length, color: 'text-blue-600' },
          { label: 'Facturas detectadas', value: facturas.length,                    color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-0.5 w-fit">
        {(['bandeja', 'facturas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'bandeja'
              ? <span className="flex items-center gap-1.5"><Inbox size={12} /> Bandeja ({emails.length})</span>
              : <span className="flex items-center gap-1.5"><FileText size={12} /> Facturas ({facturas.length})</span>}
          </button>
        ))}
      </div>

      {/* Email list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loadingList ? (
          <div className="py-16 text-center">
            <RefreshCw size={24} className="text-slate-200 mx-auto mb-3 animate-spin" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Cargando correos…</p>
          </div>
        ) : listToShow.length === 0 ? (
          <div className="py-16 text-center">
            <Mail size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              {tab === 'facturas' ? 'Sin facturas detectadas' : 'Sin correos'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {listToShow.map(email => (
              <button
                key={email.uid}
                onClick={() => openEmail(email.uid)}
                className={`w-full flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left ${!email.seen ? 'bg-blue-50/30' : ''}`}
              >
                <div className="shrink-0 mt-1">
                  {email.es_factura
                    ? <CheckCircle2 size={15} className="text-emerald-500" />
                    : email.seen
                      ? <Mail size={15} className="text-slate-300" />
                      : <Mail size={15} className="text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm truncate ${!email.seen ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>
                      {email.from}
                    </p>
                    {email.tiene_adjuntos && <Paperclip size={11} className="text-slate-400 shrink-0" />}
                    {email.es_factura && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">FACTURA</span>
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
            ))}
          </div>
        )}
      </div>

      {/* Loading detail overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex items-center gap-4">
            <RefreshCw size={20} className="text-blue-600 animate-spin" />
            <span className="text-sm font-bold text-slate-700">Analizando correo con IA…</span>
          </div>
        </div>
      )}
    </div>
  );
}
