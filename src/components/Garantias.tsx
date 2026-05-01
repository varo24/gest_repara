import React, { useState, useMemo } from 'react';
import {
  Search, ShieldCheck, ShieldAlert, ShieldX, Shield,
  ChevronDown, ChevronRight, MessageCircle, Printer,
  Eye, AlertTriangle, Clock, X, FileText,
} from 'lucide-react';
import { Warranty, RepairItem, AppSettings } from '../types';
import { storage } from '../lib/dataService';

interface GarantiasProps {
  warranties: Warranty[];
  repairs: RepairItem[];
  settings: AppSettings;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
  onViewRepair?: (repair: RepairItem) => void;
}

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const getMonthKey   = (d: string) => d?.slice(0, 7) || 'sin-fecha';
const getMonthLabel = (key: string) => {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [yr, mo] = key.split('-');
  return `${MONTH_NAMES_ES[parseInt(mo, 10) - 1]} ${yr}`;
};

const Garantias: React.FC<GarantiasProps> = ({ warranties, repairs, settings, onNotify, onViewRepair }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [claimWarranty, setClaimWarranty] = useState<Warranty | null>(null);
  const [claimNotes, setClaimNotes] = useState('');

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([currentMonthKey]));

  // Compute today at midnight for stable day comparisons
  const todayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const getDaysRemaining = (expiryDate: string): number => {
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    return Math.floor((exp.getTime() - todayMs) / 86400000);
  };

  const getEffectiveStatus = (w: Warranty): 'activa' | 'vencida' | 'reclamada' => {
    if (w.status === 'reclamada') return 'reclamada';
    return getDaysRemaining(w.expiryDate) < 0 ? 'vencida' : 'activa';
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Metrics
  const expWeek  = useMemo(() => warranties.filter(w => getEffectiveStatus(w) === 'activa' && getDaysRemaining(w.expiryDate) <= 7), [warranties, todayMs]);
  const expMonth = useMemo(() => warranties.filter(w => { const d = getDaysRemaining(w.expiryDate); return getEffectiveStatus(w) === 'activa' && d > 7 && d <= 30; }), [warranties, todayMs]);
  const activeCount  = useMemo(() => warranties.filter(w => getEffectiveStatus(w) === 'activa').length, [warranties, todayMs]);
  const claimedCount = useMemo(() => warranties.filter(w => w.status === 'reclamada').length, [warranties]);

  // Filtered + sorted list
  const isSearching = searchTerm.trim().length > 0;

  const filteredWarranties = useMemo(() => {
    const sorted = [...warranties].sort((a, b) => (b.deliveryDate || '').localeCompare(a.deliveryDate || ''));
    if (!isSearching) return sorted;
    const s = searchTerm.toLowerCase();
    return sorted.filter(w =>
      `RMA-${w.rmaNumber.toString().padStart(5, '0')} ${w.customerName} ${w.customerPhone} ${w.deviceDescription}`.toLowerCase().includes(s)
    );
  }, [warranties, searchTerm, isSearching]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, Warranty[]>();
    for (const w of filteredWarranties) {
      const key = getMonthKey(w.deliveryDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filteredWarranties]);

  const handleRegisterClaim = async () => {
    if (!claimWarranty) return;
    await storage.save('warranties', claimWarranty.id, { ...claimWarranty, status: 'reclamada', notes: claimNotes });
    onNotify('success', `Reclamación registrada para ${claimWarranty.customerName}`);
    setClaimWarranty(null);
    setClaimNotes('');
  };

  const handleWhatsApp = (w: Warranty) => {
    const days = getDaysRemaining(w.expiryDate);
    const fmtDate = new Date(w.expiryDate).toLocaleDateString('es-ES');
    const msg = days >= 0
      ? `Hola ${w.customerName}, le recordamos que la garantía de su ${w.deviceDescription} vence el ${fmtDate} (${days} días restantes). Contacte con nosotros si necesita asistencia. ${settings.appName} · ${settings.phone}`
      : `Hola ${w.customerName}, la garantía de su ${w.deviceDescription} venció el ${fmtDate}. Para cualquier consulta, contacte con ${settings.appName} · ${settings.phone}`;
    window.open(`https://wa.me/${w.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printWarranty = (w: Warranty) => {
    const days = getDaysRemaining(w.expiryDate);
    const isExpired = days < 0;
    const effStatus = getEffectiveStatus(w);
    const rmaStr = `RMA-${w.rmaNumber.toString().padStart(5, '0')}`;
    const fmtDelivery = new Date(w.deliveryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const fmtExpiry   = new Date(w.expiryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const accentColor = isExpired ? '#dc2626' : effStatus === 'reclamada' ? '#d97706' : '#1e40af';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado de Garantía — ${rmaStr}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;background:#fff}
@page{size:A4;margin:0}
.page{width:210mm;min-height:297mm;padding:16mm 16mm 12mm;display:flex;flex-direction:column;position:relative}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:8mm;border-bottom:3px solid #0f172a;margin-bottom:7mm}
.brand-name{font-size:20pt;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#0f172a}
.brand-sub{font-size:8pt;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
.doc-right{text-align:right}
.doc-title{font-size:16pt;font-weight:900;color:${accentColor};text-transform:uppercase;letter-spacing:.05em}
.doc-sub{font-size:7.5pt;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-top:3px}
.rma-badge{display:inline-block;background:#0f172a;color:#fff;font-size:10pt;font-weight:900;padding:4px 12px;border-radius:6px;margin-top:6px;letter-spacing:.1em}
.section{margin-bottom:6mm}
.sec-title{font-size:7pt;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:.2em;margin-bottom:3mm;padding-bottom:2mm;border-bottom:1px solid #f1f5f9}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.info-box{background:#f8fafc;border-radius:7px;padding:3mm 4mm}
.info-lbl{font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:1.5mm}
.info-val{font-size:11pt;font-weight:800;color:#0f172a}
.dates-block{background:#f8fafc;border-radius:8px;padding:5mm 6mm;border-left:4px solid ${accentColor};margin-bottom:5mm}
.dates-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:4mm;align-items:center;text-align:center}
.date-lbl{font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:2mm}
.date-val{font-size:12pt;font-weight:900;color:#0f172a}
.date-accent{font-size:12pt;font-weight:900;color:${accentColor}}
.months-num{font-size:26pt;font-weight:900;color:${accentColor};line-height:1}
.months-lbl{font-size:8pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em}
.status-banner{text-align:center;padding:3mm 6mm;border-radius:8px;margin-bottom:5mm}
.status-active{background:#dcfce7;color:#166534}
.status-expired{background:#fee2e2;color:#991b1b}
.status-claimed{background:#fef3c7;color:#92400e}
.status-text{font-size:11pt;font-weight:900;text-transform:uppercase;letter-spacing:.15em}
.conditions{background:#f8fafc;border-radius:7px;padding:4mm 5mm}
.cond-p{font-size:8pt;color:#475569;line-height:1.7;margin-bottom:2mm}
.footer{margin-top:auto;padding-top:6mm;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:8mm;align-items:end}
.sig-box{border:1px dashed #cbd5e1;border-radius:7px;padding:3mm;min-height:22mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
.sig-lbl{font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-top:2mm}
.contact{font-size:8pt;color:#475569;line-height:1.9}
.contact strong{color:#0f172a}
.gen-date{font-size:7pt;color:#94a3b8;margin-top:3mm}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">${settings.appName}</div>
      ${settings.address ? `<div class="brand-sub">${settings.address}</div>` : ''}
      <div class="brand-sub">${settings.phone}${settings.taxId ? ' · ' + settings.taxId : ''}</div>
    </div>
    <div class="doc-right">
      <div class="doc-title">Certificado de Garantía</div>
      <div class="doc-sub">Documento oficial de cobertura técnica</div>
      <div><span class="rma-badge">${rmaStr}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Datos del cliente</div>
    <div class="grid2">
      <div class="info-box"><div class="info-lbl">Cliente</div><div class="info-val">${w.customerName}</div></div>
      <div class="info-box"><div class="info-lbl">Teléfono</div><div class="info-val">${w.customerPhone}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Equipo reparado</div>
    <div class="grid2">
      <div class="info-box"><div class="info-lbl">Descripción</div><div class="info-val">${w.deviceDescription}</div></div>
      <div class="info-box"><div class="info-lbl">Número de orden</div><div class="info-val">${rmaStr}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Cobertura de garantía</div>
    <div class="dates-block">
      <div class="dates-grid">
        <div>
          <div class="date-lbl">Fecha de entrega</div>
          <div class="date-val">${fmtDelivery}</div>
        </div>
        <div>
          <div class="months-num">${w.months}</div>
          <div class="months-lbl">meses</div>
        </div>
        <div>
          <div class="date-lbl">${isExpired ? 'Venció el' : 'Válida hasta'}</div>
          <div class="date-accent">${fmtExpiry}</div>
        </div>
      </div>
    </div>
    <div class="status-banner ${isExpired ? 'status-expired' : effStatus === 'reclamada' ? 'status-claimed' : 'status-active'}">
      <div class="status-text">${isExpired ? '⚠ Garantía Vencida' : effStatus === 'reclamada' ? '⚑ Reclamación en Curso' : '✓ Garantía Activa y Vigente'}</div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Condiciones de garantía</div>
    <div class="conditions">
      ${settings.letterhead ? `<p class="cond-p">${settings.letterhead}</p>` : ''}
      <p class="cond-p">Esta garantía cubre los defectos de mano de obra en la reparación realizada durante el período indicado.</p>
      <p class="cond-p">No cubre daños físicos, por líquidos, negligencia del usuario o intervenciones de terceros ajenos al servicio técnico.</p>
      <p class="cond-p">Para hacer efectiva esta garantía, el cliente deberá presentar este documento junto con el equipo en el establecimiento.</p>
      <p class="cond-p">La garantía queda automáticamente anulada si el equipo presenta signos de manipulación no autorizada o nuevos daños físicos.</p>
    </div>
  </div>

  <div class="footer">
    <div class="sig-box">
      <div style="flex:1"></div>
      <div class="sig-lbl">Firma y sello del técnico autorizado</div>
    </div>
    <div class="contact">
      <p><strong>${settings.appName}</strong></p>
      ${settings.address ? `<p>${settings.address}</p>` : ''}
      <p>${settings.phone}</p>
      ${settings.email ? `<p>${settings.email}</p>` : ''}
      ${settings.taxId ? `<p>CIF/NIF: ${settings.taxId}</p>` : ''}
      <p class="gen-date">Documento generado el ${new Date().toLocaleDateString('es-ES')}</p>
    </div>
  </div>
</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=820,height=1060');
    if (!win) { onNotify('error', 'Bloqueo de ventanas emergentes. Permita popups e inténtelo de nuevo.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch {} }, 600);
  };

  const getDaysDisplay = (expiryDate: string): { text: string; cls: string } => {
    const days = getDaysRemaining(expiryDate);
    if (days < 0)  return { text: 'VENCIDA', cls: 'text-red-600 font-black text-[10px]' };
    if (days === 0) return { text: 'HOY',    cls: 'text-red-500 font-black text-[10px]' };
    if (days <= 7)  return { text: `${days}d`, cls: 'text-red-500 font-black text-xs' };
    if (days <= 30) return { text: `${days}d`, cls: 'text-amber-600 font-bold text-xs' };
    return { text: `${days}d`, cls: 'text-emerald-600 font-bold text-xs' };
  };

  const getStatusBadge = (w: Warranty): { label: string; cls: string } => {
    const st = getEffectiveStatus(w);
    if (st === 'activa')    return { label: 'Activa',    cls: 'bg-emerald-100 text-emerald-700' };
    if (st === 'vencida')   return { label: 'Vencida',   cls: 'bg-red-100 text-red-700' };
    return                         { label: 'Reclamada', cls: 'bg-amber-100 text-amber-700' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Garantías</h1>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
          {warranties.length} garantía{warranties.length !== 1 ? 's' : ''} registrada{warranties.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <ShieldCheck size={20} className="text-emerald-500 mb-3" />
          <p className="text-2xl font-black text-slate-900">{activeCount}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Activas</p>
        </div>
        <div className={`rounded-2xl p-5 shadow-sm border transition-colors ${expWeek.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
          <ShieldAlert size={20} className={`mb-3 ${expWeek.length > 0 ? 'text-red-500' : 'text-slate-300'}`} />
          <p className={`text-2xl font-black ${expWeek.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{expWeek.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Vencen esta semana</p>
        </div>
        <div className={`rounded-2xl p-5 shadow-sm border transition-colors ${expMonth.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
          <Clock size={20} className={`mb-3 ${expMonth.length > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
          <p className={`text-2xl font-black ${expMonth.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{expMonth.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Vencen este mes</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <ShieldX size={20} className={`mb-3 ${claimedCount > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
          <p className="text-2xl font-black text-slate-900">{claimedCount}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Reclamadas</p>
        </div>
      </div>

      {/* Alert block — expiring this week */}
      {expWeek.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-500 shrink-0" />
            <p className="text-[11px] font-black text-red-700 uppercase tracking-widest">
              {expWeek.length} garantía{expWeek.length !== 1 ? 's' : ''} vence{expWeek.length !== 1 ? 'n' : ''} en 7 días o menos
            </p>
          </div>
          <div className="space-y-2">
            {expWeek.map(w => {
              const days = getDaysRemaining(w.expiryDate);
              return (
                <div key={w.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-red-100">
                  <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    RMA-{w.rmaNumber.toString().padStart(5, '0')}
                  </span>
                  <span className="text-xs font-bold text-slate-800 flex-1 truncate">{w.customerName}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px] hidden sm:block">{w.deviceDescription}</span>
                  <span className="text-xs font-black text-red-500 shrink-0">{days <= 0 ? 'HOY' : `${days}d`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alert block — expiring this month */}
      {expMonth.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-amber-500 shrink-0" />
            <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
              {expMonth.length} garantía{expMonth.length !== 1 ? 's' : ''} vence{expMonth.length !== 1 ? 'n' : ''} en menos de 30 días
            </p>
          </div>
          <div className="space-y-2">
            {expMonth.map(w => (
              <div key={w.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-amber-100">
                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                  RMA-{w.rmaNumber.toString().padStart(5, '0')}
                </span>
                <span className="text-xs font-bold text-slate-800 flex-1 truncate">{w.customerName}</span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px] hidden sm:block">{w.deviceDescription}</span>
                <span className="text-xs font-bold text-amber-600 shrink-0">{getDaysRemaining(w.expiryDate)}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Archivo de Garantías</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Histórico de garantías emitidas</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="RMA, cliente, teléfono o equipo..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">RMA</th>
                <th className="px-4 py-5">Cliente</th>
                <th className="px-4 py-5">Teléfono</th>
                <th className="px-4 py-5">Equipo</th>
                <th className="px-4 py-5">Entrega</th>
                <th className="px-4 py-5">Vencimiento</th>
                <th className="px-4 py-5">Restante</th>
                <th className="px-4 py-5">Estado</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarranties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">
                    No se encontraron garantías
                  </td>
                </tr>
              ) : (
                groupedByMonth.map(([monthKey, monthWarranties]) => {
                  const isCurrentMonth = monthKey === currentMonthKey;
                  const isExpanded = isSearching || expandedMonths.has(monthKey);
                  const mActive   = monthWarranties.filter(w => getEffectiveStatus(w) === 'activa').length;
                  const mExpired  = monthWarranties.filter(w => getEffectiveStatus(w) === 'vencida').length;
                  const mClaimed  = monthWarranties.filter(w => getEffectiveStatus(w) === 'reclamada').length;

                  return (
                    <React.Fragment key={monthKey}>
                      {/* Month header row */}
                      <tr
                        onClick={() => !isSearching && toggleMonth(monthKey)}
                        className={`select-none bg-slate-50 hover:bg-slate-100/80 transition-all border-b border-slate-100 ${!isSearching ? 'cursor-pointer' : ''}`}
                      >
                        <td colSpan={9} className="px-8 py-3.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            {isExpanded
                              ? <ChevronDown size={13} className="text-slate-400 shrink-0" />
                              : <ChevronRight size={13} className="text-slate-400 shrink-0" />
                            }
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                              {getMonthLabel(monthKey)}
                            </span>
                            {isCurrentMonth && (
                              <span className="text-[8px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full tracking-widest">ACTUAL</span>
                            )}
                            <span className="text-[10px] font-bold text-slate-400">
                              {monthWarranties.length} garantía{monthWarranties.length !== 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {mActive  > 0 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{mActive} activas</span>}
                              {mExpired > 0 && <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{mExpired} vencidas</span>}
                              {mClaimed > 0 && <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{mClaimed} reclamadas</span>}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Warranty rows */}
                      {isExpanded && monthWarranties.map(w => {
                        const { text: daysText, cls: daysCls } = getDaysDisplay(w.expiryDate);
                        const { label: statusLabel, cls: statusCls } = getStatusBadge(w);
                        const linkedRepair = repairs.find(r => r.id === w.repairId);
                        const effSt = getEffectiveStatus(w);

                        return (
                          <tr key={w.id} className="hover:bg-slate-50 transition-all group border-b border-slate-50">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center shrink-0">
                                  <Shield size={14} />
                                </div>
                                <span className="text-[11px] font-black text-slate-900">
                                  RMA-{w.rmaNumber.toString().padStart(5, '0')}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-5">
                              <p className="text-xs font-black text-slate-900 uppercase truncate max-w-[130px]">{w.customerName}</p>
                            </td>
                            <td className="px-4 py-5">
                              <p className="text-[10px] font-bold text-slate-500">{w.customerPhone}</p>
                            </td>
                            <td className="px-4 py-5">
                              <p className="text-[10px] font-bold text-slate-700 truncate max-w-[130px]">{w.deviceDescription}</p>
                            </td>
                            <td className="px-4 py-5">
                              <p className="text-[10px] font-bold text-slate-500">{new Date(w.deliveryDate).toLocaleDateString('es-ES')}</p>
                            </td>
                            <td className="px-4 py-5">
                              <p className="text-[10px] font-bold text-slate-500">{new Date(w.expiryDate).toLocaleDateString('es-ES')}</p>
                              <p className="text-[8px] text-slate-300 font-bold mt-0.5">{w.months} mes{w.months !== 1 ? 'es' : ''}</p>
                            </td>
                            <td className="px-4 py-5">
                              <span className={daysCls}>{daysText}</span>
                            </td>
                            <td className="px-4 py-5">
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${statusCls}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex justify-end gap-2">
                                {linkedRepair && onViewRepair && (
                                  <button
                                    onClick={() => onViewRepair(linkedRepair)}
                                    className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white border border-slate-100 transition-all"
                                    title="Ver ficha de reparación"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleWhatsApp(w)}
                                  className="p-2.5 bg-white text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white border border-slate-100 transition-all"
                                  title="Enviar recordatorio WhatsApp"
                                >
                                  <MessageCircle size={14} />
                                </button>
                                <button
                                  onClick={() => printWarranty(w)}
                                  className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white border border-slate-100 transition-all"
                                  title="Imprimir certificado de garantía"
                                >
                                  <Printer size={14} />
                                </button>
                                {effSt !== 'reclamada' && (
                                  <button
                                    onClick={() => { setClaimWarranty(w); setClaimNotes(''); }}
                                    className="p-2.5 bg-white text-amber-400 rounded-xl hover:bg-amber-500 hover:text-white border border-slate-100 transition-all"
                                    title="Registrar reclamación"
                                  >
                                    <FileText size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claim modal */}
      {claimWarranty && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Registrar Reclamación</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  RMA-{claimWarranty.rmaNumber.toString().padStart(5, '0')} · {claimWarranty.customerName}
                </p>
                <p className="text-[10px] text-slate-300 font-bold mt-0.5">{claimWarranty.deviceDescription}</p>
              </div>
              <button onClick={() => setClaimWarranty(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas de la reclamación</p>
              <textarea
                value={claimNotes}
                onChange={e => setClaimNotes(e.target.value)}
                placeholder="Describe el problema reportado por el cliente..."
                className="w-full h-28 p-4 bg-slate-50 rounded-2xl text-xs font-bold resize-none border-none outline-none placeholder:text-slate-300"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setClaimWarranty(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegisterClaim}
                className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-all"
              >
                Registrar reclamación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Garantias;
