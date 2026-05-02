import React, { useState } from 'react';
import {
  Receipt, Search, Printer, Trash2, Eye, Plus, CheckCircle2,
  XCircle, Clock, Download, FileText, TrendingUp, X, Save, Pencil,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { AppSettings, InventoryItem } from '../types';
import { storage } from '../lib/dataService';

interface InvoiceLine { id: string; description: string; quantity: number; unitPrice: number; inventoryItemId?: string; }
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

interface Customer { id: string; name: string; phone: string; city?: string; address?: string; email?: string; taxId?: string; }
interface Props { settings: AppSettings; customers?: Customer[]; invoices: any[]; inventoryItems?: InventoryItem[]; onNotify: (t: 'success'|'error'|'info', m: string) => void; onSaveCustomer?: (c: Customer) => void; onBack?: () => void; }

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const getMonthKey   = (d: string) => d?.slice(0, 7) || 'sin-fecha';
const getMonthLabel = (key: string) => {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [yr, mo] = key.split('-');
  return `${MONTH_NAMES_ES[parseInt(mo, 10) - 1]} ${yr}`;
};

const fmtMoney = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(n || 0) + ' €';
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
      (i.subtotal||0).toFixed(2), String(i.taxRate||21), (i.taxAmount||0).toFixed(2), (i.total||0).toFixed(2),
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
export const printInvoice = (inv: any, settings: AppSettings, warranty?: any) => {
  const isSimplificada = !inv.customerTaxId;
  const isRecibo = (inv.invoiceNumber || '').startsWith('REC-');
  const hasWarranty = !!warranty;

  const certSection = hasWarranty ? `
<!-- ═══ LÍNEA DE CORTE ═══ -->
<div style="margin-top:10mm;text-align:center;border-top:2px dashed #bbb;padding:5mm 0 3mm;color:#999;font-size:8px;letter-spacing:3px;font-family:monospace">
  — — — ✂ &nbsp; CORTAR AQUÍ · CERTIFICADO DE GARANTÍA &nbsp; ✂ — — —
</div>

<!-- ═══ CERTIFICADO DE GARANTÍA ═══ -->
<div style="page-break-before:always;padding-top:4mm">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm;padding-bottom:5mm;border-bottom:2px solid #000">
    <div>
      <div style="font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;color:#111">${settings.appName}</div>
      <div style="font-size:8px;color:#555;margin-top:3px">${settings.address || ''}${settings.phone ? ' · Tel. ' + settings.phone : ''}${settings.taxId ? ' · ' + settings.taxId : ''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;font-weight:900;color:#1e40af;text-transform:uppercase;border:2px solid #1e40af;padding:4px 12px;display:inline-block;letter-spacing:1px">CERTIFICADO DE GARANTÍA</div>
      <div style="font-size:9px;color:#666;font-family:monospace;font-weight:700;margin-top:5px">RMA-${String(warranty.rmaNumber).padStart(5,'0')}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-bottom:6mm">
    <div style="border:1px solid #e0e0e0;border-radius:4px;overflow:hidden">
      <div style="background:#111;color:#fff;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 8px">Cliente</div>
      <div style="padding:8px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#111">${warranty.customerName}</div>
        <div style="font-size:9px;color:#555;margin-top:2px">${warranty.customerPhone}</div>
      </div>
    </div>
    <div style="border:1px solid #e0e0e0;border-radius:4px;overflow:hidden">
      <div style="background:#111;color:#fff;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 8px">Equipo reparado</div>
      <div style="padding:8px">
        <div style="font-size:11px;font-weight:800;color:#111">${warranty.deviceDescription}</div>
        <div style="font-size:9px;color:#555;margin-top:2px">RMA-${String(warranty.rmaNumber).padStart(5,'0')}</div>
      </div>
    </div>
  </div>

  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #1e40af;border-radius:6px;padding:6mm;margin-bottom:6mm">
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:5mm;text-align:center;align-items:center">
      <div>
        <div style="font-size:7px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px">Fecha de entrega</div>
        <div style="font-size:13px;font-weight:900;color:#111">${fmtDate(warranty.deliveryDate)}</div>
      </div>
      <div>
        <div style="font-size:30px;font-weight:900;color:#1e40af;line-height:1">${warranty.months}</div>
        <div style="font-size:7px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px">meses</div>
      </div>
      <div>
        <div style="font-size:7px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px">Válida hasta</div>
        <div style="font-size:13px;font-weight:900;color:#1e40af">${fmtDate(warranty.expiryDate)}</div>
      </div>
    </div>
  </div>

  <div style="background:#f8f9fa;border-radius:4px;padding:4mm 5mm;margin-bottom:8mm;font-size:8px;line-height:1.7;color:#444">
    ${settings.letterhead ? `<p style="margin-bottom:2px;font-weight:600">${settings.letterhead}</p>` : ''}
    <p style="margin-bottom:2px">Esta garantía cubre los defectos de mano de obra en la reparación realizada durante el período indicado.</p>
    <p style="margin-bottom:2px">No cubre daños físicos, por líquidos, negligencia del usuario o intervenciones de terceros no autorizados.</p>
    <p>Para hacer efectiva esta garantía, presentar este documento junto con el equipo en el establecimiento.</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;border-top:1px solid #ddd;padding-top:5mm">
    <div style="border:1px dashed #ccc;border-radius:4px;padding:3mm;min-height:20mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
      <div style="font-size:7px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-top:3mm">Firma y sello del técnico autorizado</div>
    </div>
    <div style="font-size:8px;color:#555;line-height:1.9">
      <div style="font-weight:900;color:#111;font-size:10px">${settings.appName}</div>
      ${settings.address ? `<div>${settings.address}</div>` : ''}
      <div>${settings.phone || ''}</div>
      ${settings.taxId ? `<div>CIF/NIF: ${settings.taxId}</div>` : ''}
      <div style="color:#aaa;font-size:7px;margin-top:2mm">Documento generado el ${new Date().toLocaleDateString('es-ES')}</div>
    </div>
  </div>
</div>` : '';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:white;color:#111;width:210mm;min-height:297mm;padding:12mm 14mm;font-size:10px;position:relative}
@page{size:A4 portrait;margin:0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}

/* HEADER */
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;padding-bottom:6mm;border-bottom:2px solid #000}
.logo-area{display:flex;align-items:center;gap:8px}
.logo-box{width:72px;height:72px;border:1.5px solid #ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8f8f8}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-initials{font-size:26px;font-weight:900;color:#111;letter-spacing:-1px}
.shop-data{margin-left:4px}
.shop-name{font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;line-height:1}
.shop-sub{font-size:8.5px;color:#555;margin-top:3px;line-height:1.7}
.doc-type-block{text-align:right}
.doc-type{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#111;border:2px solid #111;padding:4px 12px;display:inline-block;margin-bottom:6px}
.doc-meta{font-size:8px;color:#666;line-height:2}
.doc-meta strong{color:#111;font-weight:700}

/* PARTIES */
.parties{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-bottom:8mm}
.party-box{border:1px solid #e0e0e0;border-radius:4px;overflow:hidden}
.party-title{background:#111;color:#fff;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 8px}
.party-body{padding:8px;font-size:9px;line-height:1.9;color:#333}
.party-name{font-size:11px;font-weight:800;color:#111;text-transform:uppercase;line-height:1.2;margin-bottom:3px}
.party-cif{font-size:8px;color:#888;margin-top:2px}

/* TABLE */
.items-table{width:100%;border-collapse:collapse;margin-bottom:6mm;font-size:9px}
.items-table thead tr{background:#111;color:#fff}
.items-table thead th{padding:5px 8px;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left}
.items-table thead th.r{text-align:right}
.items-table tbody tr{border-bottom:1px solid #eee}
.items-table tbody tr:nth-child(even){background:#fafafa}
.items-table tbody td{padding:6px 8px;vertical-align:top}
.items-table tbody td.r{text-align:right;font-weight:600}
.items-table tbody td.c{text-align:center}
.item-code{font-size:7.5px;color:#888;font-family:monospace;display:block;margin-top:1px}
.items-table tfoot tr{border-top:2px solid #ddd}
.items-table tfoot td{padding:4px 8px;font-size:9px}

/* TOTALS */
.totals-section{display:flex;justify-content:flex-end;margin-bottom:8mm}
.totals-box{width:80mm}
.totals-row{display:flex;justify-content:space-between;padding:3px 0;font-size:9px;border-bottom:1px solid #f0f0f0}
.totals-row.subtotal{color:#555}
.totals-row.iva{color:#555}
.totals-row.total{border-top:2px solid #111;border-bottom:none;margin-top:3px;padding-top:6px}
.totals-row.total .label{font-size:11px;font-weight:800;text-transform:uppercase}
.totals-row.total .amount{font-size:18px;font-weight:900;color:#111}

/* PAYMENT */
.payment-section{border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;margin-bottom:6mm}
.payment-title{background:#f5f5f5;border-bottom:1px solid #e0e0e0;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 8px;color:#555}
.payment-body{padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:8.5px;color:#333}
.pay-item{display:flex;flex-direction:column}
.pay-label{font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:1px}
.pay-value{font-weight:600;color:#111}
.vencimiento{grid-column:1/-1;background:#f9f9f9;border:1px solid #e8e8e8;border-radius:3px;padding:5px 8px;display:flex;justify-content:space-between;align-items:center}
.venc-label{font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#999}
.venc-amount{font-size:13px;font-weight:800;color:#111}
.venc-date{font-size:9px;font-weight:600;color:#555}

/* FOOTER */
.footer{position:absolute;bottom:10mm;left:14mm;right:14mm;border-top:1px solid #ddd;padding-top:5mm}
.footer-text{font-size:7.5px;color:#888;line-height:1.7}
.footer-legal{font-size:7px;color:#aaa;margin-top:3px}
.page-num{text-align:right;font-size:7.5px;color:#bbb;margin-top:3px}

/* STATUS STAMP */
.stamp{position:absolute;top:80mm;right:20mm;border:3px solid #16a34a;color:#16a34a;padding:4px 12px;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:2px;transform:rotate(-15deg);opacity:0.35;border-radius:3px}
.stamp-void{position:absolute;top:80mm;right:20mm;border:3px solid #dc2626;color:#dc2626;padding:4px 12px;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:2px;transform:rotate(-15deg);opacity:0.35;border-radius:3px}
</style></head><body>

${inv.status === 'cobrada' ? '<div class="stamp">PAGADA</div>' : ''}
${inv.status === 'anulada' ? '<div class="stamp-void">ANULADA</div>' : ''}

<!-- HEADER -->
<div class="header">
  <div class="logo-area">
    ${settings.logoUrl
      ? `<div class="logo-box"><img src="${settings.logoUrl}" alt="Logo"/></div>`
      : `<div class="logo-box"><span class="logo-initials">${(settings.appName||'G').charAt(0)}</span></div>`}
    <div class="shop-data">
      <div class="shop-name">${settings.appName}</div>
      <div class="shop-sub">
        ${settings.address ? settings.address + '<br>' : ''}
        ${settings.phone ? 'Tel. ' + settings.phone : ''}
        ${settings.email ? '<br>e-Mail ' + settings.email : ''}
        ${settings.taxId ? '<br>C.I.F. ' + settings.taxId : ''}
      </div>
    </div>
  </div>
  <div class="doc-type-block">
    <div class="doc-type">${isRecibo ? 'Recibo' : inv.isRectificativa ? 'Factura Rectificativa' : isSimplificada ? 'Fact. Simplificada' : 'Factura'}</div>
    <div class="doc-meta">
      <strong>${isRecibo ? 'Nº Recibo' : 'Nº Fact.'}</strong> &nbsp; ${inv.invoiceNumber}<br>
      <strong>Fecha</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${fmtDate(inv.date)}<br>
      <strong>Fecha Valor</strong> ${inv.paidAt ? fmtDate(inv.paidAt) : fmtDate(inv.date)}<br>
      ${inv.rmaNumber ? `<strong>Referencia</strong> ${fmtRMA(inv.rmaNumber)}` : ''}
    </div>
  </div>
</div>

<!-- PARTIES -->
<div class="parties">
  <div class="party-box">
    <div class="party-title">Emisor</div>
    <div class="party-body">
      <div class="party-name">${settings.appName}</div>
      ${settings.address ? settings.address + '<br>' : ''}
      ${settings.phone ? 'Tel. ' + settings.phone : ''}
      ${settings.email ? '<br>' + settings.email : ''}
      <div class="party-cif">${settings.taxId ? 'C.I.F. ' + settings.taxId : ''}</div>
    </div>
  </div>
  <div class="party-box">
    <div class="party-title">Cliente</div>
    <div class="party-body">
      <div class="party-name">${inv.customerName}</div>
      ${inv.customerAddress ? inv.customerAddress + '<br>' : ''}
      Tel. ${inv.customerPhone}
      ${inv.customerTaxId ? '<div class="party-cif">' + inv.customerTaxId + '</div>' : ''}
    </div>
  </div>
</div>

<!-- ITEMS TABLE -->
<table class="items-table">
  <thead>
    <tr>
      <th>Cantidad</th>
      <th>Código</th>
      <th>Artículo / Descripción</th>
      <th class="r">Precio</th>
      ${!isRecibo ? '<th class="r">IVA</th>' : ''}
      <th class="r">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${(inv.items as any[]).map((item: any, i: number) => `
    <tr>
      <td class="c">${item.quantity}</td>
      <td><span class="item-code">${String(i+1).padStart(4,'0')}</span></td>
      <td>${item.description}</td>
      <td class="r">${(item.unitPrice||0).toFixed(2)}</td>
      ${!isRecibo ? `<td class="r">${(inv.taxRate||0).toFixed(2)}%</td>` : ''}
      <td class="r">${(item.quantity * (item.unitPrice||0)).toFixed(2)}</td>
    </tr>`).join('')}
    ${(inv.laborItems as any[]).map((item: any, i: number) => `
    <tr>
      <td class="c">${item.hours}h</td>
      <td><span class="item-code">MO${String(i+1).padStart(3,'0')}</span></td>
      <td>${item.description} <em style="color:#888;font-size:8px">(Mano de obra)</em></td>
      <td class="r">${(item.hourlyRate||0).toFixed(2)}</td>
      ${!isRecibo ? `<td class="r">${(inv.taxRate||0).toFixed(2)}%</td>` : ''}
      <td class="r">${((item.hours||0) * (item.hourlyRate||0)).toFixed(2)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4"></td>
      <td style="font-size:8px;font-weight:700;color:#555;text-align:right">Subtotal</td>
      <td style="font-weight:700;text-align:right">${(inv.subtotal||0).toFixed(2)}</td>
    </tr>
  </tfoot>
</table>

<!-- TOTALS -->
<div class="totals-section">
  <div class="totals-box">
    ${!isRecibo ? `
    <div class="totals-row subtotal"><span>Descuento</span><span>—</span></div>
    <div class="totals-row subtotal"><span>Dto. P.Pago</span><span>—</span></div>
    <div class="totals-row iva"><span>Base Imponible</span><span>${(inv.subtotal||0).toFixed(2)} €</span></div>
    <div class="totals-row iva"><span>IVA ${inv.taxRate||0}%</span><span>${(inv.taxAmount||0).toFixed(2)} €</span></div>
    ` : ''}
    <div class="totals-row total">
      <span class="label">${isRecibo ? 'Total Recibo' : 'Total Factura'}</span>
      <span class="amount">${(inv.total||0).toFixed(2)} €</span>
    </div>
  </div>
</div>

<!-- PAYMENT -->
<div class="payment-section">
  <div class="payment-title">Forma de Pago y Vencimientos</div>
  <div class="payment-body">
    <div class="pay-item">
      <span class="pay-label">Forma de Pago</span>
      <span class="pay-value">${PAY_LABELS[inv.payMethod||''] || inv.payMethod || 'Pendiente'}</span>
    </div>
    <div class="pay-item">
      <span class="pay-label">Estado</span>
      <span class="pay-value">${inv.status === 'cobrada' ? '✓ Cobrada' : inv.status === 'anulada' ? '✗ Anulada' : '⏳ Pendiente'}</span>
    </div>
    <div class="vencimiento">
      <div>
        <div class="venc-label">Vencimiento</div>
        <div class="venc-date">${inv.paidAt ? fmtDate(inv.paidAt) : fmtDate(inv.date)}</div>
      </div>
      <div class="venc-amount">${(inv.total||0).toFixed(2)} €</div>
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer" ${hasWarranty ? 'style="position:relative;bottom:auto;left:auto;right:auto;margin-top:8mm;"' : ''}>
  <div class="footer-text">${settings.letterhead || 'La reparación realizada tiene una garantía de 3 meses desde la fecha de emisión de esta factura.'}</div>
  ${settings.legalTerms ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0"><div style="font-size:7px;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:3px">Condiciones Generales</div><div style="font-size:7px;color:#64748b;line-height:1.6;text-align:justify">${settings.legalTerms}</div></div>` : ''}
  <div class="footer-legal">Documento generado por ${settings.appName} · ${new Date().toLocaleDateString('es-ES')}</div>
  <div class="page-num">Página 1${hasWarranty ? ' / 2' : ' / 1'}</div>
</div>

${certSection}
</body></html>`;
  const win = window.open('', '_blank', 'width=850,height=1100');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch(e) {} }, 800);
    return;
  }
  // Fallback: iframe
  const frameId = 'inv-print-frame';
  let frame = document.getElementById(frameId) as HTMLIFrameElement;
  if (frame) frame.remove();
  frame = document.createElement('iframe');
  frame.id = frameId;
  frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch {}
    setTimeout(() => frame.remove(), 3000);
  }, 800);
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const Facturacion: React.FC<Props> = ({ settings, customers = [], invoices, inventoryItems = [], onNotify, onSaveCustomer, onBack }) => {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatus]       = useState('todas');
  const [selected, setSelected]         = useState<FullInvoice | null>(null);
  const [payModal, setPayModal]         = useState<FullInvoice | null>(null);
  const [payMethod, setPayMethod]       = useState('efectivo');
  const [showNew, setShowNew]           = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<FullInvoice | null>(null);

  const month = new Date().toISOString().slice(0, 7);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([month]));

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filtered = invoices
    .filter(i => {
      if ((i as any)._deleted) return false;
      const s = `${i.invoiceNumber} ${i.customerName} ${i.customerPhone}`.toLowerCase();
      return s.includes(search.toLowerCase()) && (statusFilter === 'todas' || i.status === statusFilter);
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const isSearching = search.trim().length > 0 || statusFilter !== 'todas';

  const groupedByMonth: [string, FullInvoice[]][] = (() => {
    const map = new Map<string, FullInvoice[]>();
    for (const inv of filtered) {
      const key = getMonthKey(inv.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  })();
  const visibleInvoices = invoices.filter(i => !(i as any)._deleted);
  const mesCobrado   = visibleInvoices.filter(i => i.status === 'cobrada' && i.date?.startsWith(month)).reduce((s,i) => s+i.total, 0);
  const totalCobrado = visibleInvoices.filter(i => i.status === 'cobrada').reduce((s,i) => s+i.total, 0);
  const pendiente    = visibleInvoices.filter(i => i.status === 'pendiente').reduce((s,i) => s+i.total, 0);

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
    setPayModal(null);
  };

  const anular = (inv: FullInvoice) => {
    if (!window.confirm(`¿Anular ${inv.invoiceNumber}? No se puede deshacer.`)) return;
    storage.save('invoices', inv.id, { ...inv, status: 'anulada' });
    onNotify('info', `${inv.invoiceNumber} anulada`);
    if (selected?.id === inv.id) setSelected(null);
  };

  const deleteInvoice = (inv: FullInvoice) => {
    if (!window.confirm(
      `¿Eliminar ${inv.invoiceNumber}?\n\nEl número quedará reservado y no se reutilizará para mantener la correlación fiscal.`
    )) return;
    // Mark as deleted but keep the number reserved
    storage.save('invoices', inv.id, { ...inv, status: 'anulada', _deleted: true, deletedAt: new Date().toISOString() });
    onNotify('info', `${inv.invoiceNumber} eliminada — número reservado`);
    if (selected?.id === inv.id) setSelected(null);
  };

  // ── Vista detalle ──────────────────────────────────────────────────────────
  if (selected) return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">← Volver</button>
        <div className="flex gap-2">
          <button onClick={() => printInvoice(selected, settings)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition-all"><Printer size={13}/> Imprimir</button>
          {selected.status !== 'anulada' && <button onClick={() => { setEditingInvoice(selected); setSelected(null); }} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-black uppercase hover:bg-amber-100 transition-all"><Pencil size={13}/> Editar</button>}
          {selected.status === 'pendiente' && <button onClick={() => { setPayModal(selected); setPayMethod('efectivo'); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all"><CheckCircle2 size={13}/> Cobrar</button>}
          {selected.status !== 'anulada' && <button onClick={() => anular(selected)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-all"><XCircle size={13}/> Anular</button>}
          <button onClick={() => deleteInvoice(selected)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase hover:bg-red-700 transition-all"><Trash2 size={13}/> Eliminar</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-950 px-7 py-5 flex justify-between items-start">
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{(selected.invoiceNumber||'').startsWith('REC-') ? 'Recibo' : selected.isRectificativa ? 'Factura Rectificativa' : 'Factura'}</p>
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
              {(selected.taxRate || 0) > 0 && <div className="flex justify-between text-sm text-slate-500"><span>IVA {selected.taxRate}%</span><span>{fmtMoney(selected.taxAmount)}</span></div>}
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2"><span>Total</span><span>{fmtMoney(selected.total)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Formulario editar factura ─────────────────────────────────────────────
  if (editingInvoice) return (
    <NewInvoiceForm settings={settings} customers={customers} invoices={invoices}
      inventoryItems={inventoryItems}
      initialInvoice={editingInvoice}
      onSave={(inv, _saveCustomer) => {
        storage.save('invoices', inv.id, inv);
        onNotify('success', `${inv.invoiceNumber} actualizada`);
        setEditingInvoice(null);
      }}
      onCancel={() => setEditingInvoice(null)} />
  );

  // ── Formulario nueva factura ───────────────────────────────────────────────
  if (showNew) return (
    <NewInvoiceForm settings={settings} customers={customers} invoices={invoices}
      inventoryItems={inventoryItems}
      onSave={(inv, saveCustomer) => {
        storage.save('invoices', inv.id, inv);
        if (saveCustomer && inv.customerName && inv.customerPhone) {
          const now = new Date().toISOString();
          const existing = customers.find(c => c.phone === inv.customerPhone);
          if (!existing) {
            const newCustomer: Customer = { id: `CUST-${Date.now()}`, name: inv.customerName, phone: inv.customerPhone, address: inv.customerAddress, taxId: inv.customerTaxId, createdAt: now, updatedAt: now };
            if (onSaveCustomer) onSaveCustomer(newCustomer);
          }
        }
        onNotify('success', `${inv.invoiceNumber} creada`);
        setShowNew(false);
      }}
      onCancel={() => setShowNew(false)} />
  );

  // ── Listado ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-start justify-between">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
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
              <tbody>
                {groupedByMonth.map(([monthKey, monthInvoices]) => {
                  const isCurrentMonth = monthKey === month;
                  const isExpanded = isSearching || expandedMonths.has(monthKey);
                  const monthTotal = monthInvoices.reduce((s, i) => s + (i.total || 0), 0);

                  return (
                    <React.Fragment key={monthKey}>
                      {/* Month header */}
                      <tr
                        onClick={() => !isSearching && toggleMonth(monthKey)}
                        className={`select-none bg-slate-50 hover:bg-slate-100/80 transition-all border-b border-slate-100 ${!isSearching ? 'cursor-pointer' : ''}`}
                      >
                        <td colSpan={8} className="px-5 py-3">
                          <div className="flex items-center gap-3">
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
                              {monthInvoices.length} factura{monthInvoices.length !== 1 ? 's' : ''}
                            </span>
                            <span className="ml-auto text-xs font-black text-slate-700">{fmtMoney(monthTotal)}</span>
                          </div>
                        </td>
                      </tr>
                      {/* Invoice rows */}
                      {isExpanded && monthInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                          <td className="px-5 py-3.5"><span className={`text-[11px] font-black px-2.5 py-1 rounded-full font-mono ${(inv.invoiceNumber||'').startsWith('REC-') ? 'text-slate-600 bg-slate-100' : 'text-blue-600 bg-blue-50'}`}>{inv.invoiceNumber}</span></td>
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
                              {inv.status !== 'anulada' && <button onClick={() => setEditingInvoice(inv)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all" title="Editar"><Pencil size={13}/></button>}
                              {inv.status === 'pendiente' && <button onClick={() => { setPayModal(inv); setPayMethod('efectivo'); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all" title="Cobrar"><CheckCircle2 size={13}/></button>}
                              <button onClick={() => deleteInvoice(inv)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all" title="Eliminar"><Trash2 size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
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
  customers: Customer[];
  invoices: FullInvoice[];
  inventoryItems?: InventoryItem[];
  initialInvoice?: FullInvoice;
  onSave: (inv: FullInvoice, saveCustomer: boolean) => void;
  onCancel: () => void;
}

const NewInvoiceForm: React.FC<NewInvoiceFormProps> = ({ settings, customers, invoices, inventoryItems = [], initialInvoice, onSave, onCancel }) => {
  const isEditing = !!initialInvoice;
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saveAsCustomer, setSaveAsCustomer] = useState(false);
  const [customerName, setCustomerName]     = useState(initialInvoice?.customerName || '');
  const [customerPhone, setCustomerPhone]   = useState(initialInvoice?.customerPhone || '');
  const [customerTaxId, setCustomerTaxId]   = useState(initialInvoice?.customerTaxId || '');
  const [customerAddress, setCustomerAddress] = useState(initialInvoice?.customerAddress || '');
  const [taxEnabled, setTaxEnabled]         = useState(isEditing ? (initialInvoice!.taxRate || 0) > 0 : true);
  const [taxRate, setTaxRate]               = useState(isEditing && (initialInvoice!.taxRate || 0) > 0 ? initialInvoice!.taxRate : settings.taxRate || 21);
  const [items, setItems]                   = useState<InvoiceLine[]>(initialInvoice?.items?.length ? initialInvoice.items : [{ id: uid(), description: '', quantity: 1, unitPrice: 0 }]);
  const [laborItems, setLaborItems]         = useState<LaborLine[]>(initialInvoice?.laborItems || []);
  const [status, setStatus]                 = useState<'pendiente'|'cobrada'>(initialInvoice?.status === 'cobrada' ? 'cobrada' : 'pendiente');
  const [payMethod, setPayMethod]           = useState(initialInvoice?.payMethod || 'efectivo');
  const [notes, setNotes]                   = useState('');
  const [invSearch, setInvSearch]           = useState('');
  const [showInvDrop, setShowInvDrop]       = useState(false);

  const filteredInv = invSearch.trim()
    ? inventoryItems.filter(i => {
        const q = invSearch.toLowerCase();
        return i.ref.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || (i.ean || '').toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  const addFromInventory = (inv: InventoryItem) => {
    setItems(p => [...p, { id: uid(), description: inv.description, quantity: 1, unitPrice: inv.salePrice || inv.costPrice, inventoryItemId: inv.id }]);
    setInvSearch('');
    setShowInvDrop(false);
  };

  const addItem  = () => setItems(p => [...p, { id: uid(), description: '', quantity: 1, unitPrice: 0 }]);
  const addLabor = () => setLaborItems(p => [...p, { id: uid(), description: 'Mano de obra', hours: 1, hourlyRate: settings.hourlyRate || 45 }]);
  const updItem  = (id: string, k: string, v: any) => setItems(p => p.map(i => i.id===id ? {...i,[k]:v} : i));
  const updLabor = (id: string, k: string, v: any) => setLaborItems(p => p.map(i => i.id===id ? {...i,[k]:v} : i));

  const subtotal = items.reduce((s,i) => s+i.quantity*i.unitPrice, 0) + laborItems.reduce((s,i) => s+i.hours*i.hourlyRate, 0);
  const effectiveTaxRate = taxEnabled ? taxRate : 0;
  const taxAmount = Math.round(subtotal * (effectiveTaxRate/100) * 100) / 100;
  const total     = Math.round((subtotal + taxAmount) * 100) / 100;

  const handleSave = () => {
    if (!customerName.trim()) { alert('El nombre del cliente es obligatorio'); return; }
    if (items.every(i => !i.description.trim())) { alert('Añade al menos una línea'); return; }
    const now = new Date().toISOString();
    const filteredItems = items.filter(i => i.description.trim());
    const inv: FullInvoice = {
      id:            isEditing ? initialInvoice!.id : uid(),
      invoiceNumber: isEditing ? initialInvoice!.invoiceNumber : storage.nextInvoiceNumber(effectiveTaxRate === 0 ? 'REC' : 'FAC'),
      createdAt:     isEditing ? initialInvoice!.createdAt : now,
      repairId:      initialInvoice?.repairId,
      rmaNumber:     initialInvoice?.rmaNumber,
      isRectificativa: initialInvoice?.isRectificativa || false,
      customerName: customerName.trim(), customerPhone: customerPhone.trim(),
      customerTaxId: customerTaxId.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      date: isEditing ? initialInvoice!.date : now.slice(0,10),
      items: filteredItems,
      laborItems: laborItems.filter(i => i.description.trim()),
      subtotal, taxRate: effectiveTaxRate, taxAmount, total,
      status,
      payMethod: status === 'cobrada' ? payMethod : undefined,
      paidAt: status === 'cobrada' ? (isEditing && initialInvoice!.paidAt ? initialInvoice!.paidAt : now) : undefined,
    };
    onSave(inv, !isEditing && saveAsCustomer);

    // Deducir stock de inventario al guardar como cobrada (solo si no estaba ya cobrada)
    const wasCobrada = isEditing && initialInvoice?.status === 'cobrada';
    if (status === 'cobrada' && !wasCobrada) {
      for (const item of filteredItems) {
        if (!item.inventoryItemId) continue;
        const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
        if (!invItem) continue;
        const newStock = Math.max(0, invItem.stock - item.quantity);
        storage.save('inventory', invItem.id, { ...invItem, stock: newStock, updatedAt: now });
        const mvId = uid();
        storage.save('stock_movements', mvId, {
          id: mvId,
          itemId: invItem.id,
          ref: invItem.ref,
          description: invItem.description,
          type: 'salida',
          qty: -item.quantity,
          costPrice: invItem.costPrice,
          date: now.slice(0, 10),
          origin: 'factura',
          notes: `Factura: ${inv.invoiceNumber}`,
          createdAt: now,
        });
      }
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {isEditing ? `Editar ${initialInvoice!.invoiceNumber}` : 'Nueva Factura'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isEditing ? 'Actualiza los datos de la factura existente' : 'Factura manual sin reparación asociada'}
          </p>
        </div>
        <button onClick={onCancel} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"><X size={16}/> Cancelar</button>
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Datos del cliente</p>
          {customers.length > 0 && (
            <span className="text-[10px] text-slate-400">{customers.length} clientes en agenda</span>
          )}
        </div>

        {/* Buscador de cliente existente */}
        {customers.length > 0 && (
          <div className="relative">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Buscar cliente existente</label>
            <input
              type="text" value={customerSearch} placeholder="Nombre o teléfono..."
              onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
              onFocus={() => setShowCustomerDropdown(true)}
              className="w-full px-3.5 py-2.5 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-blue-50"
            />
            {showCustomerDropdown && customerSearch.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {customers
                  .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
                  .slice(0, 8)
                  .map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone);
                        setCustomerTaxId(c.taxId || '');
                        setCustomerAddress(c.address || '');
                        setCustomerSearch(c.name);
                        setShowCustomerDropdown(false);
                        setSaveAsCustomer(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-slate-50 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-blue-600">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.phone}{c.city ? ' · ' + c.city : ''}</p>
                      </div>
                    </button>
                  ))}
                {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).length === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-400">No encontrado — rellena los datos manualmente</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {[
            ['Nombre *','text',customerName,setCustomerName,'Nombre completo'],
            ['Teléfono','tel',customerPhone,setCustomerPhone,'600 000 000'],
            ['NIF / CIF','text',customerTaxId,setCustomerTaxId,'12345678A'],
            ['Dirección','text',customerAddress,setCustomerAddress,'Calle...']
          ].map(([label,type,val,setter,ph]) => (
            <div key={String(label)}>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label as string}</label>
              <input type={type as string} value={val as string} onChange={e => (setter as any)(e.target.value)} placeholder={ph as string}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
            </div>
          ))}
        </div>

        {/* Guardar como cliente — solo en creación */}
        {!isEditing && customerName && !customers.find(c => c.phone === customerPhone) && (
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input type="checkbox" checked={saveAsCustomer} onChange={e => setSaveAsCustomer(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer"/>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
              Guardar como cliente en la agenda
            </span>
          </label>
        )}
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

        {/* Buscador inventario local */}
        {inventoryItems.length > 0 && (
          <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowInvDrop(false); }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <input
              type="text"
              placeholder="Buscar en inventario local..."
              className="w-full pl-9 pr-8 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={invSearch}
              onChange={e => { setInvSearch(e.target.value); setShowInvDrop(true); }}
              onFocus={() => setShowInvDrop(true)}
            />
            {invSearch && (
              <button onMouseDown={() => { setInvSearch(''); setShowInvDrop(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
            {showInvDrop && filteredInv.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {filteredInv.map(inv => (
                  <button
                    key={inv.id}
                    onMouseDown={() => addFromInventory(inv)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-all text-left"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900">{inv.description}</p>
                      <p className="text-[9px] text-slate-400">{inv.ref} · Stock: {inv.stock} · {(inv.salePrice || inv.costPrice).toFixed(2)}€</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-3 ${inv.stock === 0 ? 'bg-red-50 text-red-600' : inv.stock <= inv.minStock ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {inv.stock === 0 ? 'Sin stock' : `${inv.stock} uds`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Aplicar IVA</span>
                <button
                  type="button"
                  onClick={() => setTaxEnabled(v => !v)}
                  className={`relative inline-flex h-4 w-8 flex-shrink-0 items-center rounded-full transition-colors ${taxEnabled ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${taxEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {taxEnabled && (
                <div className="flex items-center gap-1">
                  <input type="number" value={taxRate} onChange={e => setTaxRate(+e.target.value)} min={0} max={100}
                    className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-xl text-center focus:outline-none"/>
                  <span className="text-[9px] text-slate-400">%</span>
                </div>
              )}
            </div>
            <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
            {taxEnabled && <div className="flex justify-between text-sm text-slate-500"><span>IVA {taxRate}%</span><span>{fmtMoney(taxAmount)}</span></div>}
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
          <Save size={14}/> {isEditing ? 'Guardar cambios' : 'Guardar factura'}
        </button>
      </div>
    </div>
  );
};

export default Facturacion;
