import React, { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft, FileBarChart, Download, Trash2, ExternalLink, RefreshCw,
  TrendingUp, Wrench, Package, ShoppingBag, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { RepairItem, InventoryItem, StockMovement, AppSettings, InformeRecord } from '../types';
import { storage } from '../lib/dataService';
import { uploadInformeHTML } from '../lib/storageService';

type PeriodType = 'semanal' | 'mensual' | 'trimestral' | 'personalizado';

interface InformesProps {
  invoices: any[];
  repairs: RepairItem[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  facturasImportadas: any[];
  settings: AppSettings;
  informes: InformeRecord[];
  onBack: () => void;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

interface ComputedStats {
  periodLabel: string;
  start: string;
  end: string;
  totalFacturado: number;
  baseImponible: number;
  totalIVA: number;
  nFac: number;
  nRec: number;
  facCobradas: number;
  facPendientes: number;
  byPayMethod: Record<string, number>;
  top5Clientes: { name: string; total: number }[];
  invoicesByDay: Record<string, number>;
  nReparaciones: number;
  nEntregadas: number;
  nPendientes: number;
  nCanceladas: number;
  nSinReparacion: number;
  avgDays: number;
  byDeviceType: Record<string, number>;
  byBrand: Record<string, number>;
  top5Averias: { desc: string; count: number }[];
  repairsByDay: Record<string, number>;
  valorStock: number;
  nReferencias: number;
  nBajoMinimo: number;
  nSinStock: number;
  entradasQty: number;
  salidasQty: number;
  top10Piezas: { desc: string; qty: number }[];
  totalCompras: number;
  nFacturasProveedor: number;
  byProveedor: Record<string, number>;
  margenEstimado: number;
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PAY_LABELS: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum', transferencia: 'Transferencia' };

const fmtE = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
const fmtD = (n: number) => n.toLocaleString('es-ES');

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

function computePeriod(
  type: PeriodType,
  week: string, month: number, year: number, quarter: number,
  customStart: string, customEnd: string
): { start: string; end: string; periodLabel: string } {
  if (type === 'semanal') {
    const mon = new Date(week + 'T00:00:00');
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const start = mon.toISOString().slice(0, 10);
    const end = sun.toISOString().slice(0, 10);
    return { start, end, periodLabel: `Semana ${start} / ${end}` };
  }
  if (type === 'mensual') {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    return { start, end, periodLabel: `${MONTHS[month - 1]} ${year}` };
  }
  if (type === 'trimestral') {
    const qStart = (quarter - 1) * 3 + 1;
    const qEnd = quarter * 3;
    const start = `${year}-${String(qStart).padStart(2, '0')}-01`;
    const end = `${year}-${String(qEnd).padStart(2, '0')}-${String(new Date(year, qEnd, 0).getDate()).padStart(2, '0')}`;
    const qNames = ['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'];
    return { start, end, periodLabel: `Q${quarter} ${year} (${qNames[quarter - 1]})` };
  }
  return { start: customStart, end: customEnd, periodLabel: `${customStart} al ${customEnd}` };
}

function computeStats(
  invoices: any[], repairs: RepairItem[], inventory: InventoryItem[],
  stockMovements: StockMovement[], facturasImportadas: any[],
  start: string, end: string, periodLabel: string
): ComputedStats {
  const inRange = (s?: string) => !!s && s.slice(0, 10) >= start && s.slice(0, 10) <= end;

  // ─── A: Facturación ─────────────────────────────────────────────────────────
  const fInv = invoices.filter(i => inRange(i.date));
  const totalFacturado = fInv.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const totalIVA = fInv.reduce((s, i) => s + (Number(i.taxAmount) || 0), 0);
  const baseImponible = totalFacturado - totalIVA;
  const nFac = fInv.filter(i => (i.invoiceNumber || '').startsWith('FAC')).length;
  const nRec = fInv.filter(i => (i.invoiceNumber || '').startsWith('REC')).length;
  const facCobradas = fInv.filter(i => i.status === 'cobrada').length;
  const facPendientes = fInv.filter(i => i.status === 'pendiente' || i.status === 'vencida').length;

  const byPayMethod: Record<string, number> = {};
  fInv.filter(i => i.payMethod).forEach(i => {
    byPayMethod[i.payMethod] = (byPayMethod[i.payMethod] || 0) + (Number(i.total) || 0);
  });

  const clienteMap: Record<string, number> = {};
  fInv.forEach(i => {
    const n = i.customerName || 'Desconocido';
    clienteMap[n] = (clienteMap[n] || 0) + (Number(i.total) || 0);
  });
  const top5Clientes = Object.entries(clienteMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  const invoicesByDay: Record<string, number> = {};
  fInv.forEach(i => {
    const d = (i.date || '').slice(0, 10);
    if (d) invoicesByDay[d] = (invoicesByDay[d] || 0) + (Number(i.total) || 0);
  });

  // ─── B: Reparaciones ────────────────────────────────────────────────────────
  const fRep = repairs.filter(r => inRange(r.entryDate));
  const nReparaciones = fRep.length;
  const nEntregadas = fRep.filter(r => r.status === 'Entregado').length;
  const nCanceladas = fRep.filter(r => r.status === 'Cancelado').length;
  const nSinReparacion = fRep.filter(r => r.status === 'Sin Reparación').length;
  const nPendientes = nReparaciones - nEntregadas - nCanceladas - nSinReparacion;

  const delivered = fRep.filter(r => r.status === 'Entregado' && r.updatedAt);
  const avgDays = delivered.length > 0
    ? delivered.reduce((s, r) => s + Math.max(0, (new Date(r.updatedAt!).getTime() - new Date(r.entryDate).getTime()) / 86400000), 0) / delivered.length
    : 0;

  const byDeviceType: Record<string, number> = {};
  fRep.forEach(r => { const t = r.deviceType || 'Otro'; byDeviceType[t] = (byDeviceType[t] || 0) + 1; });

  const byBrand: Record<string, number> = {};
  fRep.forEach(r => { if (r.brand) byBrand[r.brand] = (byBrand[r.brand] || 0) + 1; });

  const descCount: Record<string, number> = {};
  fRep.forEach(r => {
    const key = (r.problemDescription || 'Sin descripción').split('\n')[0].slice(0, 60).trim();
    if (key) descCount[key] = (descCount[key] || 0) + 1;
  });
  const top5Averias = Object.entries(descCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([desc, count]) => ({ desc, count }));

  const repairsByDay: Record<string, number> = {};
  fRep.forEach(r => {
    const d = (r.entryDate || '').slice(0, 10);
    if (d) repairsByDay[d] = (repairsByDay[d] || 0) + 1;
  });

  // ─── C: Inventario ──────────────────────────────────────────────────────────
  const valorStock = inventory.reduce((s, i) => s + (i.stock || 0) * (i.costPrice || 0), 0);
  const nReferencias = inventory.length;
  const nBajoMinimo = inventory.filter(i => i.stock > 0 && i.stock <= i.minStock).length;
  const nSinStock = inventory.filter(i => (i.stock || 0) <= 0).length;

  const fMov = stockMovements.filter(m => inRange(m.date));
  const entradasQty = fMov.filter(m => m.type === 'entrada').reduce((s, m) => s + (m.qty || 0), 0);
  const salidasQty = fMov.filter(m => m.type === 'salida').reduce((s, m) => s + (m.qty || 0), 0);

  const piezaMap: Record<string, number> = {};
  fMov.filter(m => m.type === 'salida').forEach(m => {
    const k = m.description || m.ref || 'Sin nombre';
    piezaMap[k] = (piezaMap[k] || 0) + (m.qty || 0);
  });
  const top10Piezas = Object.entries(piezaMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([desc, qty]) => ({ desc, qty }));

  // ─── D: Compras ─────────────────────────────────────────────────────────────
  const fComp = facturasImportadas.filter(f => inRange(f.fecha_factura) || inRange(f.date));
  const totalCompras = fComp.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const nFacturasProveedor = fComp.length;

  const byProveedor: Record<string, number> = {};
  fComp.forEach(f => {
    const p = f.proveedor || 'Desconocido';
    byProveedor[p] = (byProveedor[p] || 0) + (Number(f.total) || 0);
  });

  return {
    periodLabel, start, end,
    totalFacturado, baseImponible, totalIVA, nFac, nRec, facCobradas, facPendientes,
    byPayMethod, top5Clientes, invoicesByDay,
    nReparaciones, nEntregadas, nPendientes, nCanceladas, nSinReparacion,
    avgDays, byDeviceType, byBrand, top5Averias, repairsByDay,
    valorStock, nReferencias, nBajoMinimo, nSinStock, entradasQty, salidasQty, top10Piezas,
    totalCompras, nFacturasProveedor, byProveedor, margenEstimado: totalFacturado - totalCompras,
  };
}

function toDayChart(byDay: Record<string, number>, start: string, end: string): { label: string; value: number }[] {
  const startMs = new Date(start + 'T00:00:00').getTime();
  const endMs = new Date(end + 'T00:00:00').getTime();
  const days = Math.round((endMs - startMs) / 86400000) + 1;
  const result: { label: string; value: number }[] = [];
  for (let i = 0; i < Math.min(days, 92); i++) {
    const d = new Date(startMs + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ label, value: byDay[key] || 0 });
  }
  return result;
}

// ─── SVG bar chart for PDF ────────────────────────────────────────────────────
function svgBar(data: { label: string; value: number }[], color: string): string {
  const W = 480, H = 110, PAD_L = 42, PAD_B = 22, PAD_T = 8;
  const drawW = W - PAD_L;
  const drawH = H - PAD_B - PAD_T;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(2, drawW / data.length - 1.5);
  const bars = data.map((d, i) => {
    const h = (d.value / max) * drawH;
    const x = PAD_L + i * (drawW / data.length) + 0.75;
    const y = PAD_T + drawH - h;
    const show = data.length <= 12 || i % Math.ceil(data.length / 12) === 0;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="2"/>` +
      (show ? `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="6.5" fill="#888">${d.label}</text>` : '');
  }).join('');
  const yLines = [0, 0.5, 1].map(p => {
    const y = PAD_T + drawH * (1 - p);
    const v = max * p;
    const label = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
    return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#f0f0f0"/>` +
      `<text x="${(PAD_L - 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="6.5" fill="#aaa">${label}</text>`;
  }).join('');
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;display:block">${yLines}${bars}</svg>`;
}

// ─── PDF HTML builder ─────────────────────────────────────────────────────────
function buildPDFHtml(s: ComputedStats, settings: AppSettings): string {
  const now = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const app = settings.appName || 'ReparaPro';
  const invChartData = Object.entries(s.invoicesByDay).sort().map(([d, v]) => ({ label: d.slice(5).replace('-', '/'), value: v }));
  const repChartData = Object.entries(s.repairsByDay).sort().map(([d, v]) => ({ label: d.slice(5).replace('-', '/'), value: v }));

  const box4 = (items: { label: string; value: string; cls?: string }[]) =>
    `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">${items.map(b =>
      `<div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;padding:9px">
        <div style="font-size:7pt;color:#999;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">${b.label}</div>
        <div style="font-size:13pt;font-weight:900;color:${b.cls === 'green' ? '#2e7d32' : b.cls === 'red' ? '#c62828' : b.cls === 'blue' ? '#1565c0' : '#333'}">${b.value}</div>
      </div>`
    ).join('')}</div>`;

  const table = (headers: string[], rows: string[][]): string =>
    `<table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:12px">
      <tr>${headers.map(h => `<th style="background:#f0f4ff;color:#1565c0;font-weight:900;text-align:left;padding:5px 8px;border-bottom:2px solid #d0d8ff;font-size:8pt;text-transform:uppercase">${h}</th>`).join('')}</tr>
      ${rows.map((r, ri) => `<tr>${r.map(c => `<td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;background:${ri % 2 === 1 ? '#fafafa' : '#fff'}">${c}</td>`).join('')}</tr>`).join('')}
    </table>`;

  const sectionHeader = (letter: string, title: string, bg: string) =>
    `<div style="background:${bg};color:#fff;padding:8px 12px;border-radius:6px;font-size:11pt;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">${letter} — ${title}</div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Informe ${s.periodLabel} — ${app}</title>
<style>
@page{size:A4;margin:15mm 15mm 20mm 15mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:10pt;color:#222;background:#fff}
.cover{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}
.page-break{page-break-before:always}
.section{margin-bottom:20px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

<div class="cover">
  <div style="width:72px;height:72px;border-radius:14px;background:#1565c0;color:#fff;font-size:32pt;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">${app.charAt(0).toUpperCase()}</div>
  <h1 style="font-size:26pt;font-weight:900;color:#1565c0;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">${app}</h1>
  <h2 style="font-size:14pt;color:#666;margin-bottom:20px">Informe de Gestión</h2>
  <p style="font-size:16pt;font-weight:900;color:#333;margin-bottom:6px">${s.periodLabel}</p>
  <p style="color:#999">${s.start} &nbsp;·&nbsp; ${s.end}</p>
  <p style="margin-top:12px;color:#bbb;font-size:9pt">Generado el ${now}</p>
  ${settings.address ? `<p style="margin-top:8px;color:#ccc;font-size:9pt">${settings.address}</p>` : ''}
</div>

<div class="section">
  ${sectionHeader('A', 'Facturación', '#1565c0')}
  ${box4([
    { label: 'Total facturado', value: fmtE(s.totalFacturado), cls: 'blue' },
    { label: 'Base imponible', value: fmtE(s.baseImponible) },
    { label: 'Total IVA', value: fmtE(s.totalIVA) },
    { label: 'Nº facturas', value: String(s.nFac + s.nRec) },
  ])}
  ${box4([
    { label: 'FAC (con IVA)', value: String(s.nFac) },
    { label: 'REC (sin IVA)', value: String(s.nRec) },
    { label: 'Cobradas', value: String(s.facCobradas), cls: 'green' },
    { label: 'Pendientes', value: String(s.facPendientes), cls: s.facPendientes > 0 ? 'red' : '' },
  ])}
  ${Object.keys(s.byPayMethod).length > 0 ? `
  <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Desglose por forma de pago</p>
  ${table(['Forma de pago', 'Importe'], Object.entries(s.byPayMethod).map(([m, v]) => [PAY_LABELS[m] || m, fmtE(v)]))}` : ''}
  ${s.top5Clientes.length > 0 ? `
  <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Top 5 clientes por importe</p>
  ${table(['#', 'Cliente', 'Total'], s.top5Clientes.map((c, i) => [String(i + 1), c.name, fmtE(c.total)]))}` : ''}
  ${invChartData.length > 0 ? `<p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Facturación diaria</p>${svgBar(invChartData, '#1565c0')}` : ''}
</div>

<div class="section page-break">
  ${sectionHeader('B', 'Reparaciones', '#2e7d32')}
  ${box4([
    { label: 'Total entradas', value: String(s.nReparaciones) },
    { label: 'Entregadas', value: String(s.nEntregadas), cls: 'green' },
    { label: 'Pendientes', value: String(s.nPendientes) },
    { label: 'Canceladas', value: String(s.nCanceladas), cls: s.nCanceladas > 0 ? 'red' : '' },
  ])}
  ${box4([
    { label: 'Sin reparación', value: String(s.nSinReparacion) },
    { label: 'Tiempo medio', value: `${s.avgDays.toFixed(1)} días` },
    { label: '', value: '' },
    { label: '', value: '' },
  ])}
  ${Object.keys(s.byDeviceType).length > 0 ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div>
      <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Por tipo de equipo</p>
      ${table(['Tipo', 'Nº'], Object.entries(s.byDeviceType).sort((a, b) => b[1] - a[1]).map(([t, c]) => [t, String(c)]))}
    </div>
    <div>
      <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Por marca</p>
      ${table(['Marca', 'Nº'], Object.entries(s.byBrand).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, c]) => [b, String(c)]))}
    </div>
  </div>` : ''}
  ${s.top5Averias.length > 0 ? `
  <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Top 5 averías más frecuentes</p>
  ${table(['#', 'Descripción', 'Veces'], s.top5Averias.map((a, i) => [String(i + 1), a.desc, String(a.count)]))}` : ''}
  ${repChartData.length > 0 ? `<p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Reparaciones por día</p>${svgBar(repChartData, '#2e7d32')}` : ''}
</div>

<div class="section page-break">
  ${sectionHeader('C', 'Inventario', '#e65100')}
  ${box4([
    { label: 'Valor stock actual', value: fmtE(s.valorStock), cls: 'blue' },
    { label: 'Nº referencias', value: String(s.nReferencias) },
    { label: 'Bajo mínimo', value: String(s.nBajoMinimo), cls: s.nBajoMinimo > 0 ? 'red' : 'green' },
    { label: 'Sin stock', value: String(s.nSinStock), cls: s.nSinStock > 0 ? 'red' : 'green' },
  ])}
  ${box4([
    { label: `Entradas período (uds)`, value: `+${fmtD(s.entradasQty)}`, cls: 'green' },
    { label: `Salidas período (uds)`, value: `-${fmtD(s.salidasQty)}`, cls: 'red' },
    { label: '', value: '' },
    { label: '', value: '' },
  ])}
  ${s.top10Piezas.length > 0 ? `
  <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Top 10 piezas más usadas</p>
  ${table(['#', 'Pieza / referencia', 'Uds. salida'], s.top10Piezas.map((p, i) => [String(i + 1), p.desc, String(p.qty)]))}` : ''}
</div>

<div class="section page-break">
  ${sectionHeader('D', 'Compras a proveedores', '#4e342e')}
  ${box4([
    { label: 'Total comprado', value: fmtE(s.totalCompras), cls: 'red' },
    { label: 'Nº facturas proveedor', value: String(s.nFacturasProveedor) },
    { label: 'Margen estimado', value: fmtE(s.margenEstimado), cls: s.margenEstimado >= 0 ? 'green' : 'red' },
    { label: '% Margen s/ ventas', value: s.totalFacturado > 0 ? `${((s.margenEstimado / s.totalFacturado) * 100).toFixed(1)}%` : '—', cls: s.margenEstimado >= 0 ? 'green' : 'red' },
  ])}
  ${Object.keys(s.byProveedor).length > 0 ? `
  <p style="font-size:8pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px">Desglose por proveedor</p>
  ${table(['Proveedor', 'Total comprado'], Object.entries(s.byProveedor).sort((a, b) => b[1] - a[1]).map(([p, v]) => [p, fmtE(v)]))}` : ''}
</div>

</body></html>`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({ label, value, sub, color = '#1565c0' }) => (
  <div className="bg-white rounded-xl border border-slate-100 p-4">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
    <p className="text-xl font-black leading-none" style={{ color }}>{value}</p>
    {sub && <p className="text-[10px] text-slate-400 font-bold mt-1">{sub}</p>}
  </div>
);

const SectionBlock: React.FC<{ letter: string; title: string; color: string; children: React.ReactNode }> = ({ letter, title, color, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: color }}
      >
        <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">{letter}</span>
        <span className="flex-1 text-white font-black uppercase tracking-widest text-sm">{title}</span>
        {open ? <ChevronUp size={16} className="text-white/70" /> : <ChevronDown size={16} className="text-white/70" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const Informes: React.FC<InformesProps> = ({
  invoices, repairs, inventory, stockMovements, facturasImportadas,
  settings, informes, onBack, onNotify
}) => {
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const defaultQuarter = Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4;

  const [tab, setTab] = useState<'nuevo' | 'historial'>('nuevo');
  const [periodType, setPeriodType] = useState<PeriodType>('mensual');
  const [selWeek, setSelWeek] = useState(getMonday(now));
  const [selMonth, setSelMonth] = useState(defaultMonth);
  const [selYear, setSelYear] = useState(defaultYear);
  const [selQuarter, setSelQuarter] = useState<1 | 2 | 3 | 4>(defaultQuarter);
  const [quarterYear, setQuarterYear] = useState(now.getFullYear());
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(now.toISOString().slice(0, 10));
  const [preview, setPreview] = useState<ComputedStats | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { start, end, periodLabel } = useMemo(
    () => computePeriod(periodType, selWeek, selMonth, selYear, selQuarter, customStart, customEnd),
    [periodType, selWeek, selMonth, selYear, selQuarter, customStart, customEnd]
  );

  const handleGenerate = useCallback(() => {
    const stats = computeStats(invoices, repairs, inventory, stockMovements, facturasImportadas, start, end, periodLabel);
    setPreview(stats);
  }, [invoices, repairs, inventory, stockMovements, facturasImportadas, start, end, periodLabel]);

  const handleDownloadPDF = useCallback(async () => {
    if (!preview) return;
    setGenerating(true);
    try {
      const html = buildPDFHtml(preview, settings);
      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
      else {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument?.write(html);
        iframe.contentDocument?.close();
        setTimeout(() => { iframe.contentWindow?.print(); document.body.removeChild(iframe); }, 400);
      }

      let url: string | undefined;
      try {
        url = await uploadInformeHTML(html, preview.periodLabel, preview.start);
      } catch {
        // Storage upload optional — don't block save
      }

      const record: InformeRecord = {
        id: `informe-${Date.now()}`,
        periodo: preview.periodLabel,
        fechaInicio: preview.start,
        fechaFin: preview.end,
        url,
        stats: {
          totalFacturado: preview.totalFacturado,
          nReparaciones: preview.nReparaciones,
          valorStock: preview.valorStock,
          totalCompras: preview.totalCompras,
        },
        generadoEn: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.save('informes', record.id, record);
      onNotify('success', `Informe "${preview.periodLabel}" generado y guardado.`);
    } catch (e) {
      onNotify('error', 'Error al generar el informe.');
    } finally {
      setGenerating(false);
    }
  }, [preview, settings, onNotify]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await storage.remove('informes', id);
      onNotify('info', 'Informe eliminado.');
    } finally {
      setDeletingId(null);
    }
  }, [onNotify]);

  const invChartData = useMemo(() => preview ? toDayChart(preview.invoicesByDay, preview.start, preview.end) : [], [preview]);
  const repChartData = useMemo(() => preview ? toDayChart(preview.repairsByDay, preview.start, preview.end) : [], [preview]);

  const historialSorted = [...informes].sort((a, b) => b.generadoEn.localeCompare(a.generadoEn));

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-400";

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f5' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-100 no-print">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <FileBarChart size={22} className="text-blue-700" />
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">Informes</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{informes.length} informes generados</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setTab('nuevo')}
            className="px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
            style={tab === 'nuevo' ? { background: '#1565c0', color: '#fff' } : { background: '#f5f5f5', color: '#555' }}
          >
            Nuevo informe
          </button>
          <button
            onClick={() => setTab('historial')}
            className="px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
            style={tab === 'historial' ? { background: '#1565c0', color: '#fff' } : { background: '#f5f5f5', color: '#555' }}
          >
            Historial ({informes.length})
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {tab === 'nuevo' && (
          <>
            {/* Period Selector */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Período</p>

              {/* Type buttons */}
              <div className="flex gap-2 mb-5">
                {(['semanal', 'mensual', 'trimestral', 'personalizado'] as PeriodType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setPeriodType(t); setPreview(null); }}
                    className="flex-1 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border"
                    style={periodType === t
                      ? { background: '#1565c0', color: '#fff', borderColor: '#1565c0' }
                      : { background: '#f8f9fa', color: '#666', borderColor: '#e9ecef' }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Type-specific controls */}
              {periodType === 'semanal' && (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Selecciona cualquier día de la semana</label>
                    <input type="date" className={inputCls} value={selWeek}
                      onChange={e => { if (e.target.value) { setSelWeek(getMonday(new Date(e.target.value + 'T00:00:00'))); setPreview(null); } }} />
                  </div>
                  <div className="text-sm font-bold text-slate-500">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1">Semana seleccionada</span>
                    {start} → {end}
                  </div>
                </div>
              )}

              {periodType === 'mensual' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Mes</label>
                    <select className={inputCls} value={selMonth}
                      onChange={e => { setSelMonth(Number(e.target.value)); setPreview(null); }}>
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Año</label>
                    <input type="number" className={inputCls} value={selYear} min={2020} max={2099}
                      onChange={e => { setSelYear(Number(e.target.value)); setPreview(null); }} />
                  </div>
                </div>
              )}

              {periodType === 'trimestral' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Trimestre</label>
                    <div className="flex gap-2">
                      {([1, 2, 3, 4] as const).map(q => (
                        <button key={q} onClick={() => { setSelQuarter(q); setPreview(null); }}
                          className="flex-1 py-2.5 rounded-xl font-black text-sm border transition-all"
                          style={selQuarter === q
                            ? { background: '#1565c0', color: '#fff', borderColor: '#1565c0' }
                            : { background: '#f8f9fa', color: '#666', borderColor: '#e9ecef' }}>
                          Q{q}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="w-32">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Año</label>
                    <input type="number" className={inputCls} value={quarterYear} min={2020} max={2099}
                      onChange={e => { setQuarterYear(Number(e.target.value)); setPreview(null); }} />
                  </div>
                </div>
              )}

              {periodType === 'personalizado' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Desde</label>
                    <input type="date" className={inputCls} value={customStart}
                      onChange={e => { setCustomStart(e.target.value); setPreview(null); }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Hasta</label>
                    <input type="date" className={inputCls} value={customEnd}
                      onChange={e => { setCustomEnd(e.target.value); setPreview(null); }} />
                  </div>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-600">
                  Período: <span className="text-blue-700 font-black">{periodLabel}</span>
                  <span className="text-slate-400 ml-2 text-xs">({start} → {end})</span>
                </p>
                <button
                  onClick={handleGenerate}
                  className="px-6 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest text-white transition-all active:scale-95"
                  style={{ background: '#2e7d32' }}
                >
                  Calcular informe
                </button>
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <>
                {/* Summary stats row */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <StatCard label="Total facturado" value={fmtE(preview.totalFacturado)} color="#1565c0" />
                  <StatCard label="Reparaciones" value={String(preview.nReparaciones)} color="#2e7d32" />
                  <StatCard label="Valor stock" value={fmtE(preview.valorStock)} color="#e65100" />
                  <StatCard label="Total compras" value={fmtE(preview.totalCompras)} color={preview.margenEstimado >= 0 ? '#2e7d32' : '#c62828'}
                    sub={`Margen: ${fmtE(preview.margenEstimado)}`} />
                </div>

                {/* Section A: Facturación */}
                <SectionBlock letter="A" title="Facturación" color="#1565c0">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <StatCard label="Total con IVA" value={fmtE(preview.totalFacturado)} color="#1565c0" />
                    <StatCard label="Base imponible" value={fmtE(preview.baseImponible)} color="#555" />
                    <StatCard label="Total IVA" value={fmtE(preview.totalIVA)} color="#555" />
                    <StatCard label="Nº facturas" value={String(preview.nFac + preview.nRec)}
                      sub={`FAC: ${preview.nFac} · REC: ${preview.nRec}`} color="#555" />
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    <StatCard label="Cobradas" value={String(preview.facCobradas)} color="#2e7d32" />
                    <StatCard label="Pendientes" value={String(preview.facPendientes)} color={preview.facPendientes > 0 ? '#c62828' : '#555'} />
                    <StatCard label="Margen bruto" value={fmtE(preview.margenEstimado)} color={preview.margenEstimado >= 0 ? '#2e7d32' : '#c62828'} />
                    <StatCard label="% Margen" value={preview.totalFacturado > 0 ? `${((preview.margenEstimado / preview.totalFacturado) * 100).toFixed(1)}%` : '—'}
                      color={preview.margenEstimado >= 0 ? '#2e7d32' : '#c62828'} />
                  </div>

                  {Object.keys(preview.byPayMethod).length > 0 && (
                    <div className="mb-5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Por forma de pago</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(preview.byPayMethod).map(([m, v]) => (
                          <div key={m} className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-[9px] font-black uppercase text-blue-600">{PAY_LABELS[m] || m}</p>
                            <p className="text-sm font-black text-blue-800">{fmtE(v)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {preview.top5Clientes.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Top 5 clientes</p>
                      <div className="space-y-1.5">
                        {preview.top5Clientes.map((c, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="w-5 text-[10px] font-black text-slate-300">{i + 1}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ background: '#1565c0', width: `${(c.total / preview.top5Clientes[0].total) * 100}%` }} />
                            </div>
                            <span className="text-xs font-black text-slate-700 w-32 truncate">{c.name}</span>
                            <span className="text-xs font-black text-blue-700 w-24 text-right">{fmtE(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {invChartData.some(d => d.value > 0) && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Facturación por día</p>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={invChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} width={40} />
                          <Tooltip formatter={(v: number) => fmtE(v)} />
                          <Bar dataKey="value" fill="#1565c0" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SectionBlock>

                {/* Section B: Reparaciones */}
                <SectionBlock letter="B" title="Reparaciones" color="#2e7d32">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <StatCard label="Total entradas" value={String(preview.nReparaciones)} color="#555" />
                    <StatCard label="Entregadas" value={String(preview.nEntregadas)} color="#2e7d32" />
                    <StatCard label="Pendientes" value={String(preview.nPendientes)} color="#555" />
                    <StatCard label="Canceladas" value={String(preview.nCanceladas)} color={preview.nCanceladas > 0 ? '#c62828' : '#555'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <StatCard label="Sin reparación" value={String(preview.nSinReparacion)} color="#555" />
                    <StatCard label="Tiempo medio (días)" value={preview.avgDays.toFixed(1)} color="#555"
                      sub={preview.avgDays === 0 ? 'Sin datos suficientes' : undefined} />
                  </div>

                  {(Object.keys(preview.byDeviceType).length > 0 || Object.keys(preview.byBrand).length > 0) && (
                    <div className="grid grid-cols-2 gap-5 mb-5">
                      {Object.keys(preview.byDeviceType).length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Por tipo de equipo</p>
                          <div className="space-y-1">
                            {Object.entries(preview.byDeviceType).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                              <div key={t} className="flex justify-between text-xs font-bold py-1 border-b border-slate-50">
                                <span className="text-slate-700">{t}</span>
                                <span className="text-green-700 font-black">{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.keys(preview.byBrand).length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Por marca</p>
                          <div className="space-y-1">
                            {Object.entries(preview.byBrand).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, c]) => (
                              <div key={b} className="flex justify-between text-xs font-bold py-1 border-b border-slate-50">
                                <span className="text-slate-700">{b}</span>
                                <span className="text-green-700 font-black">{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {preview.top5Averias.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Top 5 averías frecuentes</p>
                      <div className="space-y-1.5">
                        {preview.top5Averias.map((a, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="w-5 text-slate-300 font-black">{i + 1}</span>
                            <span className="flex-1 text-slate-700 font-bold truncate">{a.desc}</span>
                            <span className="text-green-700 font-black">{a.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {repChartData.some(d => d.value > 0) && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Reparaciones por día</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={repChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#2e7d32" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SectionBlock>

                {/* Section C: Inventario */}
                <SectionBlock letter="C" title="Inventario" color="#e65100">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <StatCard label="Valor stock" value={fmtE(preview.valorStock)} color="#e65100" />
                    <StatCard label="Nº referencias" value={String(preview.nReferencias)} color="#555" />
                    <StatCard label="Bajo mínimo" value={String(preview.nBajoMinimo)} color={preview.nBajoMinimo > 0 ? '#c62828' : '#2e7d32'} />
                    <StatCard label="Sin stock" value={String(preview.nSinStock)} color={preview.nSinStock > 0 ? '#c62828' : '#2e7d32'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <StatCard label={`Entradas en período (uds)`} value={`+${fmtD(preview.entradasQty)}`} color="#2e7d32" />
                    <StatCard label={`Salidas en período (uds)`} value={`-${fmtD(preview.salidasQty)}`} color="#c62828" />
                  </div>

                  {preview.top10Piezas.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Top 10 piezas más usadas</p>
                      <div className="space-y-1">
                        {preview.top10Piezas.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="w-5 text-slate-300 font-black">{i + 1}</span>
                            <span className="flex-1 text-slate-700 font-bold truncate">{p.desc}</span>
                            <span className="text-orange-700 font-black">{p.qty} uds</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionBlock>

                {/* Section D: Compras */}
                <SectionBlock letter="D" title="Compras a proveedores" color="#4e342e">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <StatCard label="Total comprado" value={fmtE(preview.totalCompras)} color="#c62828" />
                    <StatCard label="Nº facturas proveedor" value={String(preview.nFacturasProveedor)} color="#555" />
                    <StatCard label="Margen estimado" value={fmtE(preview.margenEstimado)} color={preview.margenEstimado >= 0 ? '#2e7d32' : '#c62828'} />
                    <StatCard label="% Margen s/ ventas" value={preview.totalFacturado > 0 ? `${((preview.margenEstimado / preview.totalFacturado) * 100).toFixed(1)}%` : '—'}
                      color={preview.margenEstimado >= 0 ? '#2e7d32' : '#c62828'} />
                  </div>

                  {Object.keys(preview.byProveedor).length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Por proveedor</p>
                      <div className="space-y-1.5">
                        {Object.entries(preview.byProveedor).sort((a, b) => b[1] - a[1]).map(([p, v]) => (
                          <div key={p} className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ background: '#4e342e', width: `${(v / preview.totalCompras) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-40 truncate">{p}</span>
                            <span className="text-xs font-black w-24 text-right" style={{ color: '#4e342e' }}>{fmtE(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionBlock>

                {/* Download button */}
                <div className="flex justify-end gap-3 mt-4 mb-8">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={generating}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest text-white transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: '#1565c0' }}
                  >
                    {generating ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                    Generar y descargar PDF
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'historial' && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {historialSorted.length === 0 ? (
              <div className="py-16 text-center">
                <FileBarChart size={36} className="mx-auto mb-3 text-slate-200" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sin informes generados</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {historialSorted.map(inf => (
                  <div key={inf.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#e8f0fe' }}>
                      <FileBarChart size={18} style={{ color: '#1565c0' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{inf.periodo}</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {new Date(inf.generadoEn).toLocaleDateString('es-ES')} &nbsp;·&nbsp;
                        Fact: {fmtE(inf.stats.totalFacturado)} &nbsp;·&nbsp;
                        Rep: {inf.stats.nReparaciones} &nbsp;·&nbsp;
                        Stock: {fmtE(inf.stats.valorStock)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inf.url && (
                        <a href={inf.url} target="_blank" rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Ver informe">
                          <Eye size={15} />
                        </a>
                      )}
                      {inf.url && (
                        <a href={inf.url} target="_blank" rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                          title="Descargar">
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(inf.id)}
                        disabled={deletingId === inf.id}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar">
                        {deletingId === inf.id
                          ? <RefreshCw size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Informes;
