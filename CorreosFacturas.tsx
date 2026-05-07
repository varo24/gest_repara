import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, RefreshCw, Search, Tag, CheckCircle2, XCircle,
  Clock, AlertCircle, FileText, Loader2, ExternalLink,
  ChevronDown, ChevronRight, Inbox, Filter, Zap, Link2,
  Eye, X, MailOpen
} from 'lucide-react';
import { AppSettings } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface OutlookEmail {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  bodyPreview: string;
  hasAttachments: boolean;
  isRead: boolean;
  body?: { content: string; contentType: string };
}

export interface ReceivedInvoice {
  id: string;
  emailId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedAt: string;
  aiConfidence: number; // 0-100
  aiReason: string;
  supplierName: string;
  estimatedAmount?: number;
  invoiceNumber?: string;
  status: 'pendiente' | 'vinculada' | 'ignorada';
  linkedRepairId?: string;
  bodyPreview: string;
  hasAttachments: boolean;
}

interface Props {
  settings: AppSettings;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MSFT_CLIENT_ID_KEY = 'gestrepara_msft_client_id';
const MSFT_TOKEN_KEY = 'gestrepara_msft_token';
const RECEIVED_INVOICES_KEY = 'gestrepara_received_invoices';
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtMoney = (n?: number) =>
  n !== undefined ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(n) + ' €' : '—';

const GREEN = '#2e7d32';
const DARK_BG = '#0d0d0d';

// ── Microsoft Graph OAuth (PKCE implicit for SPA) ─────────────────────────────
const SCOPES = 'openid profile email Mail.Read offline_access';

async function startMsftLogin(clientId: string, redirectUri: string) {
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem('msft_state', state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: 'fragment',
    state,
  });
  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

function parseHashToken(): string | null {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const state = params.get('state');
  if (token && state && state === sessionStorage.getItem('msft_state')) {
    sessionStorage.removeItem('msft_state');
    window.location.hash = '';
    return token;
  }
  return null;
}

async function fetchInbox(token: string, top = 50): Promise<OutlookEmail[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Graph API error ' + res.status);
  const data = await res.json();
  return data.value || [];
}

// ── AI classifier via Anthropic API ──────────────────────────────────────────

async function classifyEmailsWithAI(
  emails: OutlookEmail[],
  anthropicKey: string
): Promise<ReceivedInvoice[]> {
  const emailSummaries = emails.map((e, i) => ({
    index: i,
    subject: e.subject,
    from: e.from.emailAddress.name + ' <' + e.from.emailAddress.address + '>',
    preview: e.bodyPreview,
    hasAttachments: e.hasAttachments,
    date: e.receivedDateTime,
  }));

  const prompt = `Eres un asistente especializado en contabilidad para talleres de reparación.
Analiza estos ${emails.length} correos electrónicos y determina cuáles son facturas o albaranes recibidos de proveedores.

CORREOS:
${JSON.stringify(emailSummaries, null, 2)}

Responde ÚNICAMENTE con un array JSON válido. Para cada correo que sea una factura/albarán incluye:
{
  "index": <número>,
  "isInvoice": true/false,
  "confidence": <0-100>,
  "reason": "<motivo breve en español>",
  "supplierName": "<nombre del proveedor>",
  "estimatedAmount": <número o null>,
  "invoiceNumber": "<número de factura si aparece o null>"
}

Criterios para considerar una factura:
- Asunto contiene: factura, albarán, invoice, receipt, pedido, orden, cargo, payment, bill
- Remitente es empresa/proveedor (no particular)
- Preview menciona importes, IVA, total, referencia
- Tiene adjuntos (likely PDF factura)

Solo incluye los correos que sean facturas (isInvoice: true). Si ninguno lo es, devuelve [].`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error('Anthropic API error ' + res.status);
  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';

  let parsed: any[] = [];
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = [];
  }

  const results: ReceivedInvoice[] = parsed
    .filter((r: any) => r.isInvoice)
    .map((r: any) => {
      const email = emails[r.index];
      return {
        id: `ri-${email.id}`,
        emailId: email.id,
        subject: email.subject,
        fromName: email.from.emailAddress.name,
        fromEmail: email.from.emailAddress.address,
        receivedAt: email.receivedDateTime,
        aiConfidence: r.confidence || 80,
        aiReason: r.reason || 'Detectado como factura',
        supplierName: r.supplierName || email.from.emailAddress.name,
        estimatedAmount: r.estimatedAmount || undefined,
        invoiceNumber: r.invoiceNumber || undefined,
        status: 'pendiente',
        bodyPreview: email.bodyPreview,
        hasAttachments: email.hasAttachments,
      } as ReceivedInvoice;
    });

  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────

const CorreosFacturas: React.FC<Props> = ({ settings, onNotify }) => {
  const [step, setStep] = useState<'setup' | 'ready' | 'scanning'>('setup');
  const [clientId, setClientId] = useState(() => localStorage.getItem(MSFT_CLIENT_ID_KEY) || '');
  const [msftToken, setMsftToken] = useState(() => localStorage.getItem(MSFT_TOKEN_KEY) || '');
  const [invoices, setInvoices] = useState<ReceivedInvoice[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECEIVED_INVOICES_KEY) || '[]'); } catch { return []; }
  });
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendiente' | 'vinculada' | 'ignorada'>('all');
  const [selected, setSelected] = useState<ReceivedInvoice | null>(null);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const persist = useCallback((data: ReceivedInvoice[]) => {
    setInvoices(data);
    localStorage.setItem(RECEIVED_INVOICES_KEY, JSON.stringify(data));
  }, []);

  // Check for OAuth redirect token on mount
  useEffect(() => {
    const token = parseHashToken();
    if (token) {
      localStorage.setItem(MSFT_TOKEN_KEY, token);
      setMsftToken(token);
      setStep('ready');
      onNotify('success', 'Conectado con Outlook correctamente');
    } else if (msftToken) {
      setStep('ready');
    }
  }, []);

  const handleSaveClientId = () => {
    if (!clientId.trim()) { onNotify('error', 'Introduce el Client ID de Azure'); return; }
    localStorage.setItem(MSFT_CLIENT_ID_KEY, clientId.trim());
    onNotify('info', 'Client ID guardado. Ahora conecta tu cuenta.');
  };

  const handleConnect = () => {
    if (!clientId.trim()) { onNotify('error', 'Guarda primero el Client ID'); return; }
    startMsftLogin(clientId.trim(), window.location.origin + window.location.pathname);
  };

  const handleDisconnect = () => {
    localStorage.removeItem(MSFT_TOKEN_KEY);
    setMsftToken('');
    setStep('setup');
    onNotify('info', 'Sesión de Outlook cerrada');
  };

  const handleScan = async () => {
    if (!msftToken) { onNotify('error', 'Conecta primero con Outlook'); return; }
    const apiKey = settings.anthropicApiKey;
    if (!apiKey) { onNotify('error', 'Configura la API Key de Anthropic en Ajustes'); return; }

    setScanning(true);
    try {
      onNotify('info', 'Leyendo bandeja de entrada...');
      const emails = await fetchInbox(msftToken, 50);
      if (!emails.length) { onNotify('info', 'No se encontraron correos'); return; }

      onNotify('info', `Analizando ${emails.length} correos con IA...`);
      const detected = await classifyEmailsWithAI(emails, apiKey);

      // Merge — skip already existing emailIds
      const existing = new Set(invoices.map(i => i.emailId));
      const newOnes = detected.filter(d => !existing.has(d.emailId));

      if (!newOnes.length) {
        onNotify('info', 'No se detectaron facturas nuevas');
      } else {
        persist([...newOnes, ...invoices]);
        onNotify('success', `${newOnes.length} factura(s) detectada(s) y añadida(s)`);
      }
    } catch (err: any) {
      if (err.message?.includes('401')) {
        localStorage.removeItem(MSFT_TOKEN_KEY);
        setMsftToken('');
        setStep('setup');
        onNotify('error', 'Sesión expirada. Vuelve a conectar con Outlook.');
      } else {
        onNotify('error', 'Error al escanear: ' + (err.message || 'desconocido'));
      }
    } finally {
      setScanning(false);
    }
  };

  const updateInvoice = (id: string, changes: Partial<ReceivedInvoice>) => {
    const updated = invoices.map(i => i.id === id ? { ...i, ...changes } : i);
    persist(updated);
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...changes } : null);
  };

  const removeInvoice = (id: string) => {
    persist(invoices.filter(i => i.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      inv.subject.toLowerCase().includes(q) ||
      inv.supplierName.toLowerCase().includes(q) ||
      inv.fromEmail.toLowerCase().includes(q) ||
      (inv.invoiceNumber || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const getMonthLabel = (iso: string) => {
    if (!iso) return 'Sin fecha';
    const d = new Date(iso);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };
  const getMonthKey = (iso: string) => iso ? iso.slice(0, 7) : 'sin-fecha';

  const bySupplierMonth = filtered.reduce<Record<string, Record<string, ReceivedInvoice[]>>>((acc, inv) => {
    const supplier = inv.supplierName;
    const month = getMonthKey(inv.receivedAt);
    if (!acc[supplier]) acc[supplier] = {};
    if (!acc[supplier][month]) acc[supplier][month] = [];
    acc[supplier][month].push(inv);
    return acc;
  }, {});

  const sortedMonthKeys = (months: Record<string, ReceivedInvoice[]>) =>
    Object.keys(months).sort((a, b) => b.localeCompare(a));

  const supplierTotal = (months: Record<string, ReceivedInvoice[]>) =>
    Object.values(months).reduce((s, arr) => s + arr.length, 0);

  const supplierAmount = (months: Record<string, ReceivedInvoice[]>) => {
    const total = Object.values(months).flat().reduce((s, inv) => s + (inv.estimatedAmount || 0), 0);
    return total > 0 ? total : undefined;
  };

  const stats = {
    total: invoices.length,
    pendiente: invoices.filter(i => i.status === 'pendiente').length,
    vinculada: invoices.filter(i => i.status === 'vinculada').length,
    ignorada: invoices.filter(i => i.status === 'ignorada').length,
  };

  const confidenceColor = (c: number) =>
    c >= 80 ? '#4caf50' : c >= 50 ? '#ff9800' : '#f44336';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 no-print" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <div className="flex items-center gap-3">
          <Mail size={20} style={{ color: GREEN }} />
          <div>
            <h1 className="text-white font-black uppercase tracking-widest text-sm">Correos — Facturas Recibidas</h1>
            <p className="text-xs mt-0.5" style={{ color: '#555' }}>
              {step === 'ready' ? 'Outlook conectado · Detección automática con IA' : 'Configura la conexión con Outlook'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === 'ready' && (
            <>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: GREEN, borderRadius: 6 }}
              >
                {scanning ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                {scanning ? 'Analizando...' : 'Escanear correos'}
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-70"
                style={{ color: '#555', border: '1px solid #2a2a2a', borderRadius: 6 }}
              >
                <X size={11} /> Desconectar
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Setup panel ── */}
      {step === 'setup' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto">
            <div className="mb-6 p-5 rounded-lg" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} style={{ color: '#ff9800' }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#ff9800' }}>Configuración requerida</span>
              </div>
              <p className="text-sm mb-4" style={{ color: '#888', lineHeight: 1.6 }}>
                Para conectar con Outlook necesitas registrar la app en el <strong style={{ color: '#aaa' }}>Portal Azure</strong> y obtener un Client ID.
              </p>

              <div className="space-y-3 text-xs mb-5" style={{ color: '#666' }}>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 font-black text-white" style={{ background: GREEN, fontSize: 10 }}>1</span>
                  <span>Ve a <a href="https://portal.azure.com" target="_blank" rel="noopener" className="underline" style={{ color: '#4caf50' }}>portal.azure.com</a> → App registrations → New registration</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 font-black text-white" style={{ background: GREEN, fontSize: 10 }}>2</span>
                  <span>Redirect URI: <code className="px-1 py-0.5 rounded text-xs" style={{ background: '#1a1a1a', color: '#4caf50' }}>{window.location.origin + window.location.pathname}</code></span>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 font-black text-white" style={{ background: GREEN, fontSize: 10 }}>3</span>
                  <span>En API Permissions añade <strong style={{ color: '#aaa' }}>Mail.Read</strong> (Microsoft Graph, Delegated)</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 font-black text-white" style={{ background: GREEN, fontSize: 10 }}>4</span>
                  <span>Copia el Application (client) ID y pégalo aquí</span>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="flex-1 px-3 py-2 text-sm text-white rounded"
                  style={{ background: '#1a1a1a', border: '1px solid #333', outline: 'none', fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleSaveClientId}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-white rounded"
                  style={{ background: '#1a1a1a', border: '1px solid #333' }}
                >
                  Guardar
                </button>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={!clientId.trim()}
              className="w-full flex items-center justify-center gap-3 py-3 text-sm font-black uppercase tracking-wider text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-30"
              style={{ background: '#0078d4' }}
            >
              <Mail size={16} />
              Conectar con Microsoft Outlook
            </button>

            <p className="text-center text-xs mt-3" style={{ color: '#444' }}>
              También necesitas la API Key de Anthropic en <strong style={{ color: '#666' }}>Ajustes → Integraciones IA</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Main content (connected) ── */}
      {step === 'ready' && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left: list */}
          <div className="flex flex-col overflow-hidden" style={{ width: selected ? '50%' : '100%', borderRight: selected ? '1px solid #1e1e1e' : 'none', transition: 'width 0.2s' }}>

            {/* Stats bar */}
            <div className="flex gap-0 px-4 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
              {[
                { label: 'Total', val: stats.total, color: '#555' },
                { label: 'Pendientes', val: stats.pendiente, color: '#ff9800' },
                { label: 'Vinculadas', val: stats.vinculada, color: GREEN },
                { label: 'Ignoradas', val: stats.ignorada, color: '#444' },
              ].map(s => (
                <div key={s.label} className="flex-1 text-center px-3 py-1">
                  <div className="text-lg font-black" style={{ color: s.color }}>{s.val}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: '#444' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Search + filter */}
            <div className="flex gap-2 px-4 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
              <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded" style={{ background: '#111', border: '1px solid #222' }}>
                <Search size={13} style={{ color: '#444' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar proveedor, asunto..."
                  className="bg-transparent text-sm text-white w-full outline-none placeholder-neutral-600"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded"
                style={{ background: '#111', border: '1px solid #222', color: '#888', outline: 'none' }}
              >
                <option value="all">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="vinculada">Vinculada</option>
                <option value="ignorada">Ignorada</option>
              </select>
            </div>

            {/* Invoices list */}
            <div className="flex-1 overflow-y-auto">
              {!filtered.length ? (
                <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#333' }}>
                  <Inbox size={40} strokeWidth={1} />
                  <p className="text-sm font-bold uppercase tracking-widest">
                    {invoices.length ? 'Sin resultados' : 'Sin facturas detectadas'}
                  </p>
                  <p className="text-xs" style={{ color: '#2a2a2a' }}>
                    {invoices.length ? 'Ajusta los filtros' : 'Pulsa "Escanear correos" para analizar tu bandeja'}
                  </p>
                </div>
              ) : (
                Object.entries(bySupplierMonth).map(([supplier, months]) => {
                  const suppKey = `s-${supplier}`;
                  const suppExpanded = expandedSuppliers.has(suppKey) || expandedSuppliers.size === 0;
                  const toggleSupplier = () => setExpandedSuppliers(prev => {
                    const next = new Set(prev);
                    if (suppExpanded && prev.size > 0) next.delete(suppKey);
                    else next.add(suppKey);
                    return next;
                  });
                  const amt = supplierAmount(months);
                  return (
                    <div key={supplier}>
                      {/* ── Supplier header ── */}
                      <button
                        onClick={toggleSupplier}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-neutral-900 transition-colors"
                        style={{ borderBottom: '1px solid #1a1a1a', background: '#0a0a0a' }}
                      >
                        {suppExpanded ? <ChevronDown size={12} style={{ color: '#555' }} /> : <ChevronRight size={12} style={{ color: '#555' }} />}
                        <span className="text-xs font-black uppercase tracking-wider flex-1 truncate" style={{ color: '#888' }}>{supplier}</span>
                        {amt !== undefined && (
                          <span className="text-xs font-bold mr-2" style={{ color: GREEN }}>{fmtMoney(amt)}</span>
                        )}
                        <span
                          className="text-xs font-black px-1.5 py-0.5 rounded"
                          style={{ background: '#1a1a1a', color: '#555' }}
                        >
                          {supplierTotal(months)}
                        </span>
                      </button>

                      {suppExpanded && sortedMonthKeys(months).map(monthKey => {
                        const monthItems = months[monthKey];
                        const mKey = `m-${supplier}-${monthKey}`;
                        const mExpanded = expandedSuppliers.has(mKey) || expandedSuppliers.size === 0;
                        const monthAmt = monthItems.reduce((s, i) => s + (i.estimatedAmount || 0), 0);
                        const toggleMonth = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          setExpandedSuppliers(prev => {
                            const next = new Set(prev);
                            if (mExpanded && prev.size > 0) next.delete(mKey);
                            else next.add(mKey);
                            return next;
                          });
                        };
                        return (
                          <div key={monthKey}>
                            {/* ── Month subheader ── */}
                            <button
                              onClick={toggleMonth}
                              className="w-full flex items-center gap-2 pl-8 pr-4 py-1.5 text-left hover:bg-neutral-900 transition-colors"
                              style={{ borderBottom: '1px solid #161616', background: '#080808' }}
                            >
                              {mExpanded ? <ChevronDown size={10} style={{ color: '#333' }} /> : <ChevronRight size={10} style={{ color: '#333' }} />}
                              <span className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color: '#444' }}>
                                {getMonthLabel(monthItems[0]?.receivedAt)}
                              </span>
                              {monthAmt > 0 && (
                                <span className="text-xs" style={{ color: '#3a6a3a' }}>{fmtMoney(monthAmt)}</span>
                              )}
                              <span className="text-xs ml-2" style={{ color: '#333' }}>{monthItems.length}</span>
                            </button>

                            {/* ── Invoice rows ── */}
                            {mExpanded && monthItems.map(inv => (
                              <button
                                key={inv.id}
                                onClick={() => setSelected(selected?.id === inv.id ? null : inv)}
                                className="w-full text-left pl-10 pr-4 py-3 flex gap-3 items-start transition-colors hover:bg-neutral-900"
                                style={{
                                  borderBottom: '1px solid #111',
                                  background: selected?.id === inv.id ? '#161616' : undefined,
                                }}
                              >
                                <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{
                                  background: inv.status === 'vinculada' ? GREEN : inv.status === 'ignorada' ? '#2a2a2a' : '#ff9800',
                                }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-bold truncate text-white">{inv.subject}</span>
                                    {inv.hasAttachments && <FileText size={11} style={{ color: '#555', flexShrink: 0 }} />}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs" style={{ color: '#555' }}>{fmtDate(inv.receivedAt)}</span>
                                    {inv.estimatedAmount !== undefined && (
                                      <span className="text-xs font-bold" style={{ color: GREEN }}>{fmtMoney(inv.estimatedAmount)}</span>
                                    )}
                                    {inv.invoiceNumber && (
                                      <span className="text-xs" style={{ color: '#555' }}>#{inv.invoiceNumber}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div
                                      className="text-xs px-1.5 py-0.5 rounded font-bold"
                                      style={{ background: confidenceColor(inv.aiConfidence) + '22', color: confidenceColor(inv.aiConfidence) }}
                                    >
                                      IA {inv.aiConfidence}%
                                    </div>
                                    <span className="text-xs truncate" style={{ color: '#444' }}>{inv.aiReason}</span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          {selected && (
            <div className="flex flex-col overflow-hidden flex-1">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#555' }}>Detalle</span>
                <button onClick={() => setSelected(null)} className="p-1 hover:opacity-60 transition-opacity">
                  <X size={14} style={{ color: '#555' }} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Info card */}
                <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  <p className="text-white font-bold text-sm mb-1 leading-snug">{selected.subject}</p>
                  <p className="text-xs mb-3" style={{ color: '#555' }}>
                    De: <span style={{ color: '#888' }}>{selected.fromName}</span>
                    {' '}·{' '}<span style={{ color: '#555' }}>{selected.fromEmail}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Recibido', value: fmtDate(selected.receivedAt) },
                      { label: 'Proveedor', value: selected.supplierName },
                      { label: 'Importe est.', value: fmtMoney(selected.estimatedAmount) },
                      { label: 'Nº Factura', value: selected.invoiceNumber || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ color: '#444' }} className="uppercase tracking-wider mb-0.5">{label}</p>
                        <p style={{ color: '#ccc' }} className="font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI analysis */}
                <div className="p-3 rounded-lg" style={{ background: '#0a1a0a', border: `1px solid ${GREEN}33` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={13} style={{ color: GREEN }} />
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: GREEN }}>Análisis IA</span>
                    <div
                      className="ml-auto text-xs font-black px-2 py-0.5 rounded"
                      style={{ background: confidenceColor(selected.aiConfidence) + '22', color: confidenceColor(selected.aiConfidence) }}
                    >
                      {selected.aiConfidence}% confianza
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: '#4caf50', lineHeight: 1.5 }}>{selected.aiReason}</p>
                </div>

                {/* Preview */}
                <div className="p-3 rounded-lg" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: '#444' }}>Vista previa</p>
                  <p className="text-xs" style={{ color: '#666', lineHeight: 1.6 }}>{selected.bodyPreview}</p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: '#444' }}>Acciones</p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { updateInvoice(selected.id, { status: 'vinculada' }); onNotify('success', 'Marcada como vinculada'); }}
                      className="flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider rounded transition-opacity hover:opacity-80"
                      style={{ background: GREEN + '22', color: GREEN, border: `1px solid ${GREEN}44` }}
                    >
                      <CheckCircle2 size={13} /> Vincular
                    </button>
                    <button
                      onClick={() => { updateInvoice(selected.id, { status: 'ignorada' }); onNotify('info', 'Marcada como ignorada'); }}
                      className="flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider rounded transition-opacity hover:opacity-80"
                      style={{ background: '#1a1a1a', color: '#555', border: '1px solid #2a2a2a' }}
                    >
                      <XCircle size={13} /> Ignorar
                    </button>
                  </div>

                  <button
                    onClick={() => { updateInvoice(selected.id, { status: 'pendiente' }); onNotify('info', 'Marcada como pendiente'); }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-wider rounded transition-opacity hover:opacity-80"
                    style={{ background: '#1a1a1a', color: '#ff9800', border: '1px solid #ff980033' }}
                  >
                    <Clock size={12} /> Marcar como pendiente
                  </button>

                  <button
                    onClick={() => { removeInvoice(selected.id); onNotify('info', 'Eliminada de la lista'); }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-wider rounded transition-opacity hover:opacity-80"
                    style={{ background: '#1a1a1a', color: '#f44336', border: '1px solid #f4433633' }}
                  >
                    <X size={12} /> Eliminar de la lista
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CorreosFacturas;
