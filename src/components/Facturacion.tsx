import React, { useState } from 'react';
import {
  Receipt, Search, Printer, Trash2, Eye, Plus, CheckCircle2,
  XCircle, Clock, Download, FileText, TrendingUp, X, Save
} from 'lucide-react';
import { AppSettings } from '../types';
import { localDB } from '../services/localDB';
import { storage } from '../services/persistence';

interface InvoiceLine { id: string; description: string; quantity: number; unitPrice: number; }
interface LaborLine  { id: string; description: string; hours: number; hourlyRate: number; }

interface FullInvoice {
  id: string; invoiceNumber: string;
  repairId?: string; rmaNumber?: number;
  customerName: string; customerPhone: string; customerTaxId?: string; customerAddress?: string;
  date: string;
  items: InvoiceLine[]; laborItems: LaborLine[];
  subtotal: number; taxRate: number; taxAmount: number; total: number;
  status: 'pendiente' | 'cobrada' | 'anulada';
  payMethod?: string; paidAt?: string;
  isRectificativa?: boolean; createdAt: string;
}

interface Props { settings: AppSettings; onNotify: (t: 'success'|'error'|'info', m: string) => void; }

const fmtMoney = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(n) + ' €';
const fmtDate  = (iso: string) => iso ? new Date(iso).toLocaleDateString('es-ES') : '—';
const fmtRMA   = (n: number)   => `RMA-${String(n).padStart(5, '0')}`;
const uid      = ()             => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

const PAY_METHODS = ['efectivo','tarjeta','bizum','transferencia'];
const PAY_LABELS: Record<string,string> = { efectivo:'Efectivo', tarjeta:'Tarjeta', bizum:'Bizum', transferencia:'Transferencia' };
const STATUS_STYLE: Record<string,string> = {
  cobrada:  'bg-emerald-50 text-emerald-700',
  pendiente:'bg-amber-50 text-amber-700',
  anulada:  'bg-red-50 text-red-700',
};

// ── CSV export ────────────────────────────────────────────────────────────────
const exportCSV = (invoices: FullInvoice[]) => {
  const rows = [
    ['Nº Factura','Cliente','Teléfono','NIF Cliente','Fecha','Base Imponible','IVA %','Cuota IVA','Total','Estado','Forma Pago','Fecha Cobro','RMA'],
    ...invoices.map(i => [
      i.invoiceNumber, i.customerName, i.customerPhone, i.customerTaxId || '',
      fmtDate(i.date),
      i.subtotal.toFixed(2), String(i.taxRate), i.taxAmount.toFixed(2), i.total.toFixed(2),
      i.status, PAY_LABELS[i.payMethod||''] || i.payMethod || '',
      i.paidAt ? fmtDate(i.paidAt) : '',
      i.rmaNumber ? fmtRMA(i.rmaNumber) : '',
    ])
  ];
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `facturas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ── Print invoice ─────────────────────────────────────────────────────────────
const printInvoice = (inv: FullInvoice, settings: AppSettings) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:white;color:#000;width:210mm;padding:14mm;font-size:11px}
@page{size:A4 portrait;margin:0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:16px}
.shop-name{font-size:20px;font-weight:900;text-transform:uppercase}
.shop-info{font-size:10px;color:#333;margin-top:4px;line-height:1.8}
.inv-badge{background:#000;color:#fff;padding:6px 14px;border-radius:4px;text-align:right}
.inv-num{font-size:22px;font-weight:900}
.inv-label{font-size:8px;text-transform:uppercase;letter-spacing:2px;opacity:0.7}
.section{border:1px solid #000;border-radius:4px;margin-bottom:12px;overflow:hidden}
.section-title{background:#000;color:#fff;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:2px;padding:4px 10px}
.section-body{padding:10px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f0f0f0;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:6px 8px;text-align:left;border-bottom:2px solid #000}
td{padding:6px 8px;border-bottom:1px solid #e0e0e0;font-size:10px}
.total-box{background:#000;color:#fff;padding:12px 16px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.total-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;opacity:0.7}
.total-amount{font-size:28px;font-weight:900}
.footer{border-top:2px solid #000;padding-top:8px;margin-top:16px;font-size:9px;color:#555;display:flex;justify-content:space-between}
.status-ok{background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:10px;font-weight:700;font-size:10px}
</style></head><body>
<div class="header">
  <div>
    <div class="shop-name">${settings.appName}</div>
    <div class="shop-info">
      ${settings.address || ''}<br>
      Tel: ${settings.phone || ''}${settings.taxId ? ' · NIF/CIF: ' + settings.taxId : ''}
    </div>
  </div>
  <div class="inv-badge">
    <div class="inv-label">${inv.isRectificativa ? 'Factura Rectificativa' : 'Factura'}</div>
    <div class="inv-num">${inv.invoiceNumber}</div>
    <div style="font-size:10px;margin-top:4px;opacity:0.8">${fmtDate(inv.date)}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">▶ Cliente</div>
  <div class="section-body">
    <div style="font-size:14px;font-weight:800;text-transform:uppercase">${inv.customerName}</div>
    <div style="font-size:11px;margin-top:4px">Tel: ${inv.customerPhone}${inv.customerTaxId ? ' · NIF: ' + inv.customerTaxId : ''}${inv.customerAddress ? '<br>' + inv.customerAddress : ''}</div>
    ${inv.rmaNumber ? `<div style="font-size:10px;color:#555;margin-top:4px">Reparación: ${fmtRMA(inv.rmaNumber)}</div>` : ''}
  </div>
</div>
<table>
  <thead><tr><th style="width:50%">Descripción</th><th>Cant.</th><th>Precio unit.</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>
    ${inv.items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${fmtMoney(i.unitPrice)}</td><td style="text-align:right">${fmtMoney(i.quantity * i.unitPrice)}</td></tr>`).join('')}
    ${inv.laborItems.map(i => `<tr><td>${i.description} (M.O.)</td><td>${i.hours}h</td><td>${fmtMoney(i.hourlyRate)}/h</td><td style="text-align:right">${fmtMoney(i.hours * i.hourlyRate)}</td></tr>`).join('')}
  </tbody>
</table>
<div style="text-align:right;margin-bottom:4px;font-size:10px">Base imponible: <strong>${fmtMoney(inv.subtotal)}</strong></div>
<div style="text-align:right;margin-bottom:8px;font-size:10px">IVA ${inv.taxRate}%: <strong>${fmtMoney(inv.taxAmount)}</strong></div>
<div class="total-box">
  <div class="total-label">Total factura</div>
  <div class="total-amount">${fmtMoney(inv.total)}</div>
</div>
${inv.status === 'cobrada' ? `<div style="margin-top:10px;text-align:right"><span class="status-ok">✓ Cobrada · ${PAY_LABELS[inv.payMethod||'']||inv.payMethod} · ${inv.paidAt ? fmtDate(inv.paidAt) : ''}</span></div>` : ''}
<div class="footer">
  <span>${settings.letterhead || 'Gracias por su confianza'}</span>
  <span>${settings.appName} · ${new Date().toLocaleDateString('es-ES')}</span>
</div>
</body></html>`;
  const w = window.open('', '_blank', 'width=850,height=1100');
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch {} }, 800);
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const Facturacion: React.FC<Props> = ({ settings, onNotify }) => {
  const [invoices, setInvoices]     = useState<FullInvoice[]>(() => localDB.getAll('invoices') as FullInvoice[]);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('todas');
  const [selected, setSelected]     = useState<FullInvoice | null>(null);
  const [payModal, setPayModal]     = useState<FullInvoice | null>(null);
  const [payMethod, setPayMethod]   = useState('efectivo');
  const [showNew, setShowNew]       = useState(false);

  const reload = () => setInvoices(localDB.getAll('invoices') as FullInvoice[]);

  const filtered = invoices
    .filter(i => {
      const s = `${i.invoiceNumber} ${i.customerName} ${i.customerPhone}`.toLowerCase();
      return s.includes(search.toLowerCase()) && (statusFilter === 'todas' || i.status === statusFilter);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const month = new Date().toISOString().slice(0, 7);
  const mesCobrado   = invoices.filter(i => i.status === 'cobrada' && i.date?.startsWith(month)).reduce((s,i) => s+i.total, 0);
  const totalCobrado = invoices.filter(i => i.status === 'cobrada').reduce((s,i) => s+i.total, 0);
  const pendiente    = invoices.filter(i => i.status === 'pendiente').reduce((s,i) => s+i.total, 0);

  const marcarCobrada = async () => {
    if (!payModal) return;
    const now = new Date().toISOString();
    const updated = { ...payModal, status: 'cobrada' as const, payMethod, paidAt: now };
    storage.save('invoices', updated.id, updated);
    storage.save('cash_movements', `CASH-${Date.now()}`, {
      id: `CASH-${Date.now()}`, type: 'ingreso', invoiceId: updated.id,
      description: `${updated.invoiceNumber} — ${updated.customerName}`,
      amount: updated.total, payMethod, date: now.slice(0,10), category: 'reparacion', createdAt: now,
    });
    onNotify('success', `${payModal.invoiceNumber} cobrada correctamente`);
    setPayModal(null); reload();
  };

  const anular = (inv: FullInvoice) => {
    if (!window.confirm(`¿Anular ${inv.invoiceNumber}? No se puede deshacer.`)) return;
    storage.save('invoices', inv.id, { ...inv, status: 'anulada' });
    onNotify('info', `${inv.invoiceNumber} anulada`);
    reload(); if (selected?.id === inv.id) setSelected(null);
  };

  // ── Vista detalle ──────────────────────────────────────────────────────────
  if (selected) return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">← Volver</button>
        <div className="flex gap-2">
          <button onClick={() => printInvoice(selected, settings)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition-all"><Printer size={13}/> Imprimir</button>
          {selected.status === 'pendiente' && <button onClick={() => { setPayModal(selected); setPayMethod('efectivo'); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all"><CheckCircle2 size={13}/> Cobrar</button>}
          {selected.status !== 'anulada' && <button onClick={() => anular(selected)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-all"><XCircle size={13}/> Anular</button>}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-950 px-7 py-5 flex justify-between items-start">
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{selected.isRectificativa ? 'Factura Rectificativa' : 'Factura'}</p>
            <p className="text-3xl font-black text-white font-mono">{selected.invoiceNumber}</p>
            <p className="text-sm text-slate-400 mt-1">{fmtDate(selected.date)}</p>
          </div>
          <span className={`text-xs font-black px-3 py-1.5 rounded-full ${STATUS_STYLE[selected.status]}`}>{selected.status.charAt(0).toUpperCase()+selected.status.slice(1)}</span>
        </div>
        <div className="p-7 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente</p><p className="text-sm font-bold text-slate-900">{selected.customerName}</p><p className="text-xs text-slate-500">{selected.customerPhone}</p>{selected.customerTaxId && <p className="text-xs text-slate-400">NIF: {selected.customerTaxId}</p>}</div>
            {selected.rmaNumber && <div className="bg-slate-50 rounded-xl p-3"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reparación</p><p className="text-sm font-bold text-slate-900 font-mono">{fmtRMA(selected.rmaNumber)}</p></div>}
            {selected.status === 'cobrada' && <div className="bg-emerald-50 rounded-xl p-3"><p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Cobrada</p><p className="text-sm font-bold text-emerald-700">{PAY_LABELS[selected.payMethod||'']||selected.payMethod}</p><p className="text-xs text-emerald-600">{selected.paidAt ? fmtDate(selected.paidAt) : ''}</p></div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50"><th className="px-4 py-2 text-left">Descripción</th><th className="px-4 py-2 text-center">Cant.</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {selected.items.map(i => <tr key={i.id}><td className="px-4 py-2">{i.description}</td><td className="px-4 py-2 text-center">{i.quantity}</td><td className="px-4 py-2 text-right">{fmtMoney(i.unitPrice)}</td><td className="px-4 py-2 text-right font-bold">{fmtMoney(i.quantity*i.unitPrice)}</td></tr>)}
                {selected.laborItems.map(i => <tr key={i.id}><td className="px-4 py-2">{i.description} (M.O.)</td><td className="px-4 py-2 text-center">{i.hours}h</td><td className="px-4 py-2 text-right">{fmtMoney(i.hourlyRate)}/h</td><td className="px-4 py-2 text-right font-bold">{fmtMoney(i.hours*i.hourlyRate)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{fmtMoney(selected.subtotal)}</span></div>
              <div className="flex justify-between text-sm text-slate-500"><span>IVA {selected.taxRate}%</span><span>{fmtMoney(selected.taxAmount)}</span></div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2"><span>Total</span><span>{fmtMoney(selected.total)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Formulario nueva factura ───────────────────────────────────────────────
  if (showNew) return (
    <NewInvoiceForm settings={settings}
      onSave={(inv) => { storage.save('invoices', inv.id, inv); onNotify('success', `${inv.invoiceNumber} creada`); reload(); setShowNew(false); }}
      onCancel={() => setShowNew(false)} />
  );

  // ── Listado ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Facturación</h1>
          <p className="text-sm text-slate-400 mt-0.5">{invoices.length} facturas registradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(filtered)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-all shadow-sm">
            <Download size={13}/> Exportar CSV
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition-all">
            <Plus size={13}/> Nueva factura
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Cobrado este mes', value: fmtMoney(mesCobrado), color: 'text-emerald-600' },
          { label: 'Total cobrado',    value: fmtMoney(totalCobrado), color: 'text-slate-900' },
          { label: 'Pendiente cobro',  value: fmtMoney(pendiente),    color: pendiente > 0 ? 'text-amber-600' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar factura, cliente..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-0.5">
          {['todas','cobrada','pendiente','anulada'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${statusFilter===s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt size={32} className="text-slate-200 mx-auto mb-3"/>
            <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">
              {invoices.length === 0 ? 'Sin facturas — se generan desde Despacho o con Nueva Factura' : 'Sin resultados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left">Factura</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">RMA</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Pago</th>
                <th className="px-4 py-3 text-right">Acc.</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5"><span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-mono">{inv.invoiceNumber}</span></td>
                    <td className="px-4 py-3.5"><p className="text-sm font-bold text-slate-900">{inv.customerName}</p><p className="text-[10px] text-slate-400">{inv.customerPhone}</p></td>
                    <td className="px-4 py-3.5">{inv.rmaNumber ? <span className="text-[10px] font-mono text-slate-500">{fmtRMA(inv.rmaNumber)}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{fmtDate(inv.date)}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-black text-slate-900">{fmtMoney(inv.total)}</td>
                    <td className="px-4 py-3.5"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[inv.status]}`}>{inv.status.charAt(0).toUpperCase()+inv.status.slice(1)}</span></td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{PAY_LABELS[inv.payMethod||'']||'—'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setSelected(inv)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all" title="Ver"><Eye size={13}/></button>
                        <button onClick={() => printInvoice(inv, settings)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all" title="Imprimir"><Printer size={13}/></button>
                        {inv.status === 'pendiente' && <button onClick={() => { setPayModal(inv); setPayMethod('efectivo'); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all" title="Cobrar"><CheckCircle2 size={13}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal cobro */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 space-y-5">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registrar cobro</p>
              <p className="text-xl font-black text-slate-900">{payModal.invoiceNumber}</p>
              <p className="text-sm text-slate-500">{payModal.customerName} · {fmtMoney(payModal.total)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Forma de cobro</p>
              <div className="grid grid-cols-2 gap-2">
                {PAY_METHODS.map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${payMethod===m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    {PAY_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={marcarCobrada} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all">Confirmar cobro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO NUEVA FACTURA MANUAL
// ══════════════════════════════════════════════════════════════════════════════

interface NewInvoiceFormProps {
  settings: AppSettings;
  onSave: (inv: FullInvoice) => void;
  onCancel: () => void;
}

const NewInvoiceForm: React.FC<NewInvoiceFormProps> = ({ settings, onSave, onCancel }) => {
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [taxRate, setTaxRate]             = useState(settings.taxRate || 21);
  const [items, setItems]                 = useState<InvoiceLine[]>([{ id: uid(), description: '', quantity: 1, unitPrice: 0 }]);
  const [laborItems, setLaborItems]       = useState<LaborLine[]>([]);
  const [status, setStatus]               = useState<'pendiente'|'cobrada'>('pendiente');
  const [payMethod, setPayMethod]         = useState('efectivo');
  const [notes, setNotes]                 = useState('');

  const addItem  = () => setItems(p => [...p, { id: uid(), description: '', quantity: 1, unitPrice: 0 }]);
  const addLabor = () => setLaborItems(p => [...p, { id: uid(), description: 'Mano de obra', hours: 1, hourlyRate: settings.hourlyRate || 45 }]);
  const updItem  = (id: string, k: string, v: any) => setItems(p => p.map(i => i.id===id ? {...i,[k]:v} : i));
  const updLabor = (id: string, k: string, v: any) => setLaborItems(p => p.map(i => i.id===id ? {...i,[k]:v} : i));

  const subtotal = items.reduce((s,i) => s+i.quantity*i.unitPrice, 0) + laborItems.reduce((s,i) => s+i.hours*i.hourlyRate, 0);
  const taxAmount = Math.round(subtotal * (taxRate/100) * 100) / 100;
  const total     = Math.round((subtotal + taxAmount) * 100) / 100;

  const nextInvoiceNumber = () => {
    const all = localDB.getAll('invoices');
    const nums = all.map((i:any) => parseInt(i.invoiceNumber?.replace(/\D/g,'') || '0')).filter(Boolean);
    const next = nums.length ? Math.max(...nums)+1 : 1;
    return `FAC-${String(next).padStart(5,'0')}`;
  };

  const handleSave = () => {
    if (!customerName.trim()) { alert('El nombre del cliente es obligatorio'); return; }
    if (items.every(i => !i.description.trim())) { alert('Añade al menos una línea'); return; }
    const now = new Date().toISOString();
    const inv: FullInvoice = {
      id: uid(), invoiceNumber: nextInvoiceNumber(),
      customerName: customerName.trim(), customerPhone: customerPhone.trim(),
      customerTaxId: customerTaxId.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      date: now.slice(0,10),
      items: items.filter(i => i.description.trim()),
      laborItems: laborItems.filter(i => i.description.trim()),
      subtotal, taxRate, taxAmount, total,
      status,
      payMethod: status === 'cobrada' ? payMethod : undefined,
      paidAt: status === 'cobrada' ? now : undefined,
      isRectificativa: false, createdAt: now,
    };
    onSave(inv);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nueva Factura</h1>
          <p className="text-sm text-slate-400 mt-0.5">Factura manual sin reparación asociada</p>
        </div>
        <button onClick={onCancel} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"><X size={16}/> Cancelar</button>
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Datos del cliente</p>
        <div className="grid grid-cols-2 gap-4">
          {[['Nombre *','text',customerName,setCustomerName,'Nombre completo'],['Teléfono','tel',customerPhone,setCustomerPhone,'600 000 000'],['NIF / CIF','text',customerTaxId,setCustomerTaxId,'12345678A'],['Dirección','text',customerAddress,setCustomerAddress,'Calle...']]
            .map(([label,type,val,setter,ph]) => (
              <div key={String(label)}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label as string}</label>
                <input type={type as string} value={val as string} onChange={e => (setter as any)(e.target.value)} placeholder={ph as string}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
              </div>
            ))}
        </div>
      </div>

      {/* Líneas */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Líneas de factura</p>
          <div className="flex gap-2">
            <button onClick={addItem}  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"><Plus size={12}/> Artículo</button>
            <button onClick={addLabor} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"><Plus size={12}/> M.O.</button>
          </div>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
            <input value={item.description} onChange={e => updItem(item.id,'description',e.target.value)} placeholder="Descripción del artículo"
              className="col-span-6 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            <input type="number" value={item.quantity} onChange={e => updItem(item.id,'quantity',+e.target.value)} min={1}
              className="col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => updItem(item.id,'unitPrice',+e.target.value)} placeholder="0.00"
              className="col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            <div className="col-span-1 text-right text-sm font-bold text-slate-700">{fmtMoney(item.quantity*item.unitPrice)}</div>
            <button onClick={() => setItems(p => p.filter(i => i.id!==item.id))} disabled={items.length===1}
              className="col-span-1 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 disabled:opacity-20 transition-all"><X size={13}/></button>
          </div>
        ))}

        {laborItems.map(item => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-blue-50/50 rounded-xl p-2">
            <input value={item.description} onChange={e => updLabor(item.id,'description',e.target.value)} placeholder="Descripción M.O."
              className="col-span-5 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
            <div className="col-span-1 text-center text-[9px] text-blue-600 font-bold">HORAS</div>
            <input type="number" step="0.5" value={item.hours} onChange={e => updLabor(item.id,'hours',+e.target.value)} min={0.5}
              className="col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-center focus:outline-none bg-white"/>
            <input type="number" step="1" value={item.hourlyRate} onChange={e => updLabor(item.id,'hourlyRate',+e.target.value)}
              className="col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-right focus:outline-none bg-white"/>
            <div className="col-span-1 text-right text-sm font-bold text-blue-700">{fmtMoney(item.hours*item.hourlyRate)}</div>
            <button onClick={() => setLaborItems(p => p.filter(i => i.id!==item.id))}
              className="col-span-1 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={13}/></button>
          </div>
        ))}

        {/* Totales */}
        <div className="border-t border-slate-100 pt-4 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest w-24">IVA %</label>
              <input type="number" value={taxRate} onChange={e => setTaxRate(+e.target.value)} min={0} max={100}
                className="w-20 px-3 py-1.5 text-sm border border-slate-200 rounded-xl text-center focus:outline-none"/>
            </div>
            <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-slate-500"><span>IVA {taxRate}%</span><span>{fmtMoney(taxAmount)}</span></div>
            <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2"><span>Total</span><span>{fmtMoney(total)}</span></div>
          </div>
        </div>
      </div>

      {/* Estado y cobro */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado de la factura</p>
        <div className="flex gap-3">
          {(['pendiente','cobrada'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all border ${status===s ? s==='cobrada' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {s === 'cobrada' ? '✓ Ya cobrada' : '⏳ Pendiente de cobro'}
            </button>
          ))}
        </div>
        {status === 'cobrada' && (
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Forma de cobro</p>
            <div className="grid grid-cols-4 gap-2">
              {PAY_METHODS.map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${payMethod===m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {PAY_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Guardar */}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all">Cancelar</button>
        <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition-all">
          <Save size={14}/> Guardar factura
        </button>
      </div>
    </div>
  );
};

export default Facturacion;
