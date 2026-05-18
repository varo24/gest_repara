/**
 * DEV-ONLY — Visual preview of all printable documents.
 * Access at: http://localhost:5173/dev/docs
 * Never included in production bundle (dynamic import in main.tsx guarded by import.meta.env.DEV).
 */
import React, { useMemo, useState } from 'react';
import {
  RepairItem, Budget, AppSettings, FullInvoice, Warranty,
  BudgetItem, LaborItem, RepairStatus,
} from '../types';
import { printAlbaranEntrega } from '../lib/printAlbaranEntrega';
import { printInvoice }        from '../lib/printInvoice';
import { printWorkOrder }      from '../lib/printWorkOrder';
import { printRechazoPresupuesto } from '../lib/printRechazoPresupuesto';

// ─── Visual assets ──────────────────────────────────────────────────────────

const LOGO_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="10" fill="#1e40af"/>
    <text x="40" y="53" font-family="Arial" font-size="42" font-weight="900"
      fill="white" text-anchor="middle">T</text>
  </svg>`,
)}`;

const SIG_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="70" viewBox="0 0 280 70">
    <path d="M10,50 Q30,10 55,45 T100,35 T155,50 T200,25 T250,40 T280,35"
      stroke="#1e3a5f" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
)}`;

// ─── Test data ───────────────────────────────────────────────────────────────

const S: AppSettings = {
  appName:        'TechRepair Valencia',
  taxId:          'B12345678',
  address:        'Calle Mayor 45, 46001 Valencia',
  city:           'Valencia',
  phone:          '963 456 789',
  email:          'info@techrepair.es',
  logoUrl:        LOGO_URL,
  warrantyMonths: 6,
  hourlyRate:     55,
  taxRate:        21,
  letterhead:     'Servicio técnico oficial para smartphones, tablets y portátiles. Presupuesto sin compromiso.',
  legalTerms:     'Los trabajos están garantizados conforme al RDL 1/2007. Cualquier reclamación deberá efectuarse en un plazo máximo de 30 días desde la entrega del equipo.',
};

const ITEMS: BudgetItem[] = [
  { id: '1', repairId: 'r1', description: 'Pantalla OLED iPhone 14 Pro (original)', quantity: 1, unitPrice: 189.00 },
  { id: '2', repairId: 'r1', description: 'Adhesivo de sellado IP68 + junta',        quantity: 1, unitPrice:  12.50 },
];
const LABOR: LaborItem[] = [
  { id: 'l1', description: 'Sustitución de pantalla', hours: 1.5, hourlyRate: 55 },
];

const REPAIR: RepairItem = {
  id:                 'r1',
  rmaNumber:          47,
  repairType:         'taller',
  customerName:       'María García Fernández',
  customerPhone:      '611 222 333',
  deviceType:         'Smartphone',
  brand:              'Apple',
  model:              'iPhone 14 Pro',
  serialNumber:       'F4KD7X8HQ6M9',
  problemDescription: 'Pantalla rota por caída. Muestra líneas horizontales y el táctil no responde en la mitad inferior del panel.',
  entryDate:          '2026-05-10',
  status:             RepairStatus.BUDGET_ACCEPTED,
  technician:         'Carlos López',
  notes:              'Cliente prefiere pantalla original Apple, no compatible genérica.',
  estimatedParts:     202,
  estimatedHours:     1.5,
  firmaClienteUrl:    SIG_URL,
  firmaClienteDate:   '2026-05-10T10:34:00Z',
  customerSignature:  SIG_URL,
  fieldNotes: [
    {
      id:        'fn1',
      text:      'Confirmado: conector flex pantalla dañado además del panel. Se incluye en el presupuesto.',
      timestamp: '2026-05-11T09:15:00Z',
    },
    {
      id:        'fn2',
      text:      'Pedido realizado a proveedor. Llegada estimada mañana.',
      timestamp: '2026-05-12T14:20:00Z',
    },
  ],
  estadoEstetico: {
    pantalla: 'roto',
    carcasa:  'rayado',
    botones:  'perfecto',
    puertos:  'perfecto',
    observaciones: 'Cristal trasero con micro-arañazos. Cámara sin daños.',
  },
  photos: [],
};

const BUDGET: Budget = {
  id:          'b1',
  repairId:    'r1',
  rmaNumber:   47,
  items:       ITEMS,
  laborItems:  LABOR,
  taxRate:     21,
  taxEnabled:  true,
  total:       244.24,
  date:        '2026-05-11',
  status:      'accepted',
  signature:   SIG_URL,
  firmaData:   SIG_URL,
  firmadoPor:  'María García Fernández',
  firmadoAt:   '2026-05-11T11:00:00Z',
  firmaEstado: 'firmado',
};

const INV_FAC: FullInvoice = {
  id:              'inv1',
  invoiceNumber:   'FAC-00023',
  repairId:        'r1',
  rmaNumber:       47,
  customerName:    'María García Fernández',
  customerPhone:   '611 222 333',
  customerAddress: 'Av. de las Cortes Valencianas 12, 46015 Valencia',
  customerTaxId:   '12345678A',
  date:            '2026-05-14',
  items:           ITEMS,
  laborItems:      LABOR,
  subtotal:        284.00,
  taxRate:         21,
  taxAmount:        59.64,
  total:           343.64,
  status:          'cobrada',
  payMethod:       'tarjeta',
  paidAt:          '2026-05-14',
  stockDescontado: true,
  createdAt:       '2026-05-14T12:00:00Z',
};

const INV_REC: FullInvoice = {
  id:            'inv2',
  invoiceNumber: 'REC-00011',
  repairId:      'r1',
  rmaNumber:     47,
  customerName:  'María García Fernández',
  customerPhone: '611 222 333',
  date:          '2026-05-14',
  items:         ITEMS,
  laborItems:    LABOR,
  subtotal:      284.00,
  taxRate:       0,
  taxAmount:     0,
  total:         284.00,
  status:        'cobrada',
  payMethod:     'efectivo',
  paidAt:        '2026-05-14',
  createdAt:     '2026-05-14T12:00:00Z',
};

const WARRANTY: Warranty = {
  id:                'w1',
  repairId:          'r1',
  rmaNumber:         47,
  customerName:      'María García Fernández',
  customerPhone:     '611 222 333',
  deviceDescription: 'Apple iPhone 14 Pro — Sustitución pantalla OLED',
  deliveryDate:      '2026-05-14',
  expiryDate:        '2026-11-14',
  months:            6,
  status:            'activa',
  notes:             'Garantía únicamente sobre la pantalla sustituida y la mano de obra asociada. No cubre daños por nueva caída o contacto con líquidos.',
  createdAt:         '2026-05-14T12:00:00Z',
};

// ─── captureHtml — intercepts window.open and captures document.write ────────

function captureHtml(fn: () => void): string {
  let captured = '';
  const orig = window.open;
  (window as any).open = () => ({
    document: { write: (h: string) => { captured = h; }, close: () => {} },
    focus:  () => {},
    print:  () => {},
  } as any);
  try { fn(); } finally { window.open = orig; }
  return captured;
}

// ─── Inline HTML builders for documents embedded inside React components ─────
// These replicate the exact HTML generated by CustomerReceipt.tsx, BudgetCreator.tsx
// and Garantias.tsx so we can preview them without rendering the full component.

function buildReceiptHtml(): string {
  const rma  = `RMA-${REPAIR.rmaNumber.toString().padStart(5, '0')}`;
  const date = new Date(REPAIR.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const ciudad     = S.city || S.appName;
  const fechaLugar = `${ciudad}, ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const est = REPAIR.estadoEstetico!;
  const EST: Record<string, Record<string, string>> = {
    pantalla: { perfecto: 'Perfecto ✓', rayado: 'Rayado', roto: 'Roto ⚠', na: 'N/A' },
    carcasa:  { perfecto: 'Perfecto ✓', rayado: 'Rayado', golpes: 'Golpes', roto: 'Roto ⚠' },
    botones:  { perfecto: 'Perfecto ✓', 'fallo-parcial': 'Fallo parcial', 'no-funciona': 'No funciona ⚠' },
    puertos:  { perfecto: 'Perfecto ✓', 'dano-visible': 'Daño visible', 'no-funciona': 'No funciona ⚠' },
  };

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Resguardo ${rma}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;background:white;color:#000;width:210mm;padding:14mm 14mm 10mm 14mm}
@page{size:A4 portrait;margin:0}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #000;margin-bottom:14px}
.shop-name{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em}
.shop-info{font-size:10px;color:#333;margin-top:4px;line-height:1.8}
.rma-number{font-size:28px;font-weight:900;border:2px solid #000;padding:2px 10px;display:inline-block;margin:4px 0}
.doc-title{text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;border:1px solid #000;padding:5px;margin-bottom:14px}
.section{border:1px solid #000;border-radius:4px;margin-bottom:10px;overflow:hidden}
.section-title{background:#000;color:white;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;padding:4px 10px}
.section-body{padding:10px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.field{margin-bottom:6px}
.field-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#555;margin-bottom:2px}
.field-value{font-size:12px;font-weight:700;border-bottom:1px solid #aaa;padding-bottom:2px;min-height:18px}
.field-value-big{font-size:14px;font-weight:900;text-transform:uppercase}
.fault-text{font-size:11px;line-height:1.7;border:1px dashed #666;padding:8px;border-radius:4px}
.sig-area{border:1px solid #000;border-radius:4px;padding:10px;margin-bottom:10px}
.sig-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#555;margin-bottom:6px}
.sig-img{height:70px;max-width:300px;object-fit:contain;display:block}
.sig-line{border-top:1px solid #aaa;margin-top:10px;padding-top:4px;font-size:9px;color:#666}
.conditions{border:1px solid #aaa;border-radius:4px;padding:8px 10px;margin-bottom:10px;background:#f9f9f9}
.conditions-title{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px}
.conditions-text{font-size:9px;color:#333;line-height:1.8}
.rgpd{border:1px solid #aaa;border-radius:4px;padding:8px 10px;margin-bottom:10px;background:#f0f4f8}
.rgpd-title{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:#1e3a5f;margin-bottom:5px}
.rgpd-text{font-size:8.5px;color:#333;line-height:1.75;margin-bottom:8px}
.rgpd-consent-row{display:flex;align-items:flex-start;gap:7px;font-size:9px;font-weight:700;color:#111;margin-bottom:8px}
.rgpd-checkbox{width:13px;height:13px;border:1.5px solid #000;border-radius:2px;flex-shrink:0;margin-top:1px;text-align:center;font-size:10px;line-height:13px}
.rgpd-sig{display:grid;grid-template-columns:2fr 1fr;gap:12px}
.rgpd-sig-col{text-align:center}
.rgpd-sig-label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#555;margin-bottom:5px}
.rgpd-sig-empty{height:35px;border-bottom:1px solid #000}
.footer{border-top:2px solid #000;padding-top:8px;display:flex;justify-content:space-between;font-size:9px;color:#555}
</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${S.logoUrl}" style="width:56px;height:56px;border:2px solid #000;border-radius:6px;object-fit:contain;padding:3px" alt="Logo">
    <div>
      <div class="shop-name">${S.appName}</div>
      <div class="shop-info">📍 ${S.address}<br>📞 ${S.phone} · ✉️ ${S.email}<br>NIF/CIF: ${S.taxId}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#555">Nº de Trabajo</div>
    <div class="rma-number">${rma}</div>
    <div style="font-size:10px;color:#333">📅 ${date}</div>
  </div>
</div>
<div class="doc-title">■ Resguardo de Depósito de Equipo ■</div>
<div class="two-col">
  <div class="section">
    <div class="section-title">▶ Datos del Cliente</div>
    <div class="section-body">
      <div class="field"><div class="field-label">Nombre completo</div><div class="field-value field-value-big">${REPAIR.customerName}</div></div>
      <div class="field"><div class="field-label">Teléfono de contacto</div><div class="field-value">📞 ${REPAIR.customerPhone}</div></div>
      <div class="field"><div class="field-label">Técnico asignado</div><div class="field-value">${REPAIR.technician}</div></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">▶ Equipo Depositado</div>
    <div class="section-body">
      <div class="field"><div class="field-label">Marca y Modelo</div><div class="field-value field-value-big">${REPAIR.brand} ${REPAIR.model}</div></div>
      <div class="field"><div class="field-label">Tipo de equipo</div><div class="field-value">${REPAIR.deviceType}</div></div>
      <div class="field"><div class="field-label">Número de Serie / IMEI</div><div class="field-value">${REPAIR.serialNumber}</div></div>
    </div>
  </div>
</div>
<div class="section">
  <div class="section-title">▶ Avería / Síntomas Declarados por el Cliente</div>
  <div class="section-body"><div class="fault-text">${REPAIR.problemDescription}</div></div>
</div>
<div class="section" style="margin-bottom:10px">
  <div class="section-title">▶ Estado Estético al Ingreso</div>
  <div class="section-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
      <div class="field"><div class="field-label">Pantalla</div><div class="field-value">${EST.pantalla[est.pantalla]}</div></div>
      <div class="field"><div class="field-label">Carcasa</div><div class="field-value">${EST.carcasa[est.carcasa]}</div></div>
      <div class="field"><div class="field-label">Botones</div><div class="field-value">${EST.botones[est.botones]}</div></div>
      <div class="field"><div class="field-label">Puertos</div><div class="field-value">${EST.puertos[est.puertos]}</div></div>
    </div>
    <div class="field"><div class="field-label">Observaciones</div><div style="font-size:10px;font-weight:500;padding:4px 0">${est.observaciones}</div></div>
    <div style="margin-top:6px;padding:5px 8px;background:#f5f5f5;border-radius:3px;font-size:8px;color:#555">⚖️ El cliente confirma el estado estético descrito al entregar el equipo.</div>
  </div>
</div>
<div class="sig-area">
  <div class="sig-label">✍ Firma del Cliente — Conforme con el depósito del equipo</div>
  <img src="${SIG_URL}" class="sig-img" alt="Firma">
  <div style="font-size:8px;color:#555;margin-top:4px">Firmado digitalmente el ${new Date(REPAIR.firmaClienteDate!).toLocaleDateString('es-ES')}</div>
  <div class="sig-line">El abajo firmante declara haber entregado voluntariamente el equipo descrito para su diagnóstico y/o reparación, y acepta las condiciones del servicio indicadas a continuación.</div>
</div>
<div class="conditions">
  <div class="conditions-title">📋 Condiciones del Servicio</div>
  <div class="conditions-text">${S.letterhead} Los equipos no retirados en un plazo de <strong>90 días</strong> desde la notificación podrán considerarse abandonados.</div>
</div>
<div class="rgpd">
  <div class="rgpd-title">🔒 Protección de Datos — RGPD / LOPDGDD</div>
  <div class="rgpd-text">De conformidad con el RGPD y la LOPDGDD, sus datos personales serán tratados por <strong>${S.appName}</strong>, con CIF/NIF ${S.taxId}, con la finalidad de gestionar la reparación. Puede ejercer sus derechos dirigiéndose a ${[S.address, S.email].filter(Boolean).join(' o ')}.</div>
  <div class="rgpd-consent-row"><div class="rgpd-checkbox">✓</div><span>La firma del cliente implica su consentimiento para el tratamiento de sus datos personales conforme al RGPD.</span></div>
  <div class="rgpd-sig">
    <div class="rgpd-sig-col">
      <div class="rgpd-sig-label">Firma del cliente — Consentimiento RGPD</div>
      <img src="${SIG_URL}" style="height:35px;max-width:100%;object-fit:contain;display:block;margin:0 auto">
    </div>
    <div class="rgpd-sig-col">
      <div class="rgpd-sig-label">Fecha y lugar</div>
      <div style="height:35px;border-bottom:1px solid #000;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;font-size:9px;font-weight:700">${fechaLugar}</div>
    </div>
  </div>
</div>
<div style="display:flex;align-items:center;gap:16px;border:1px solid #000;border-radius:4px;padding:8px 12px;margin-bottom:10px">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(rma)}&color=000000&bgcolor=ffffff" width="80" height="80" alt="QR">
  <div>
    <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:#555;margin-bottom:4px">Código QR de recogida</div>
    <div style="font-size:13px;font-weight:900;letter-spacing:2px">${rma}</div>
    <div style="font-size:9px;color:#333;margin-top:4px">Muestre este código al recoger su equipo.</div>
  </div>
</div>
<div class="footer">
  <span>Conserve este resguardo para retirar su equipo · ${S.appName}</span>
  <span>Documento generado por ${S.appName}</span>
</div>
</body></html>`;
}

function buildBudgetHtml(): string {
  const rma    = `RMA-${REPAIR.rmaNumber.toString().padStart(5, '0')}`;
  const sub    = ITEMS.reduce((s, i) => s + i.quantity * i.unitPrice, 0) + LABOR.reduce((s, i) => s + i.hours * i.hourlyRate, 0);
  const tax    = Math.round(sub * 21 / 100 * 100) / 100;
  const total  = Math.round((sub + tax) * 100) / 100;
  const expiry = new Date(Date.now() + 15 * 86400000).toLocaleDateString('es-ES');
  const rows = [
    ...ITEMS.map(i => `<tr><td style="padding:10px 16px;font-weight:700;text-transform:uppercase;font-size:11px">${i.description}</td><td style="padding:10px 16px;text-align:center;color:#94a3b8;font-size:11px">${i.quantity}</td><td style="padding:10px 16px;text-align:right;color:#94a3b8;font-size:11px">${i.unitPrice.toFixed(2)}€</td><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:11px">${(i.quantity * i.unitPrice).toFixed(2)}€</td></tr>`),
    ...LABOR.map(i  => `<tr><td style="padding:10px 16px;font-weight:700;text-transform:uppercase;font-size:11px">${i.description} (M.O.)</td><td style="padding:10px 16px;text-align:center;color:#94a3b8;font-size:11px">${i.hours}h</td><td style="padding:10px 16px;text-align:right;color:#94a3b8;font-size:11px">${i.hourlyRate.toFixed(2)}€/h</td><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:11px">${(i.hours * i.hourlyRate).toFixed(2)}€</td></tr>`),
  ].join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto ${rma}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#fff;color:#000;width:210mm;padding:14mm}
@page{size:A4 portrait;margin:0}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:20px}
.logo-wrap{display:flex;align-items:center;gap:10px}
.logo-box{width:64px;height:64px;border:1.5px solid #ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8f8f8;flex-shrink:0}
.shop-name{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em}
.shop-info{font-size:10px;color:#555;margin-top:4px;line-height:1.8}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.info-box{padding:16px;background:#f8fafc;border-radius:12px}
.info-label{font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px}
.info-val{font-size:13px;font-weight:900;text-transform:uppercase}
.info-sub{font-size:10px;font-weight:600;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead tr{background:#0f172a;color:#fff}
thead th{padding:8px 16px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em}
thead th:first-child{border-radius:8px 0 0 8px;text-align:left}
thead th:last-child{border-radius:0 8px 8px 0;text-align:right}
tbody tr{border-bottom:1px solid #f1f5f9}
.totals-box{background:#f8fafc;padding:20px;border-radius:12px;min-width:260px}
.total-row{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px}
.total-final{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid #e2e8f0;padding-top:10px;margin-top:8px}
.total-label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em}
.total-amount{font-size:28px;font-weight:900}
.sig-box{width:180px;height:70px;border-bottom:1px solid #ccc;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sig-box img{max-height:100%;mix-blend-mode:multiply}
.footer{margin-top:40px;font-size:8px;font-weight:600;color:#94a3b8;text-align:justify;text-transform:uppercase;line-height:1.5}
</style></head><body>
<div class="header">
  <div class="logo-wrap">
    <div class="logo-box"><img src="${S.logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain"/></div>
    <div>
      <div class="shop-name">${S.appName}</div>
      <div class="shop-info">${[S.taxId, S.phone].filter(Boolean).join(' · ')}<br>${[S.address, S.email].filter(Boolean).join(' · ')}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em">Presupuesto Técnico</div>
    <div style="font-size:28px;font-weight:900;text-align:right">${rma}</div>
    <div style="font-size:10px;font-weight:600;color:#64748b;margin-top:4px">Fecha: ${new Date().toLocaleDateString('es-ES')}</div>
    <div style="font-size:9px;font-weight:600;color:#94a3b8;margin-top:2px">Válido hasta: ${expiry}</div>
  </div>
</div>
<div class="grid2">
  <div class="info-box">
    <div class="info-label">Cliente</div>
    <div class="info-val">${REPAIR.customerName}</div>
    <div class="info-sub">${REPAIR.customerPhone}</div>
  </div>
  <div class="info-box">
    <div class="info-label">Equipo</div>
    <div class="info-val">${REPAIR.brand} ${REPAIR.model}</div>
    <div class="info-sub">${REPAIR.deviceType}</div>
  </div>
</div>
<table>
  <thead><tr><th>Descripción</th><th style="text-align:center;width:60px">Cant</th><th style="text-align:right;width:90px">P. Unit.</th><th style="text-align:right;width:100px">Subtotal</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <div style="text-align:center">
    <div class="sig-box"><img src="${SIG_URL}"/></div>
    <div style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;margin-top:8px">Aceptación del Cliente</div>
    <div style="font-size:8px;font-weight:600;color:#475569;margin-top:4px">Firmado por: ${BUDGET.firmadoPor}</div>
    <div style="font-size:8px;color:#94a3b8;margin-top:2px">${new Date(BUDGET.firmadoAt!).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  <div class="totals-box">
    <div class="total-row"><span>Subtotal</span><span>${sub.toFixed(2)}€</span></div>
    <div class="total-row"><span>IVA (21%)</span><span>${tax.toFixed(2)}€</span></div>
    <div class="total-final"><span class="total-label">Total</span><span class="total-amount">${total.toFixed(2)}€</span></div>
  </div>
</div>
<div class="footer">${S.letterhead || `Garantía de ${S.warrantyMonths ?? 3} meses en reparaciones. Presupuesto válido 15 días.`}</div>
${S.legalTerms ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0"><div style="font-size:7px;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px">Condiciones Generales</div><div style="font-size:7px;color:#64748b;line-height:1.6;text-align:justify">${S.legalTerms}</div></div>` : ''}
</body></html>`;
}

function buildWarrantyHtml(): string {
  const rmaStr      = `RMA-${WARRANTY.rmaNumber.toString().padStart(5, '0')}`;
  const fmtDelivery = new Date(WARRANTY.deliveryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtExpiry   = new Date(WARRANTY.expiryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const accentColor = '#1e40af';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Garantía ${rmaStr}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#1e293b;background:#fff}
@page{size:A4;margin:0}
.page{width:210mm;min-height:297mm;padding:16mm 16mm 12mm;display:flex;flex-direction:column;position:relative}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:8mm;border-bottom:3px solid #0f172a;margin-bottom:7mm}
.brand-name{font-size:20pt;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#0f172a}
.brand-sub{font-size:8pt;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
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
.status-banner{text-align:center;padding:3mm 6mm;border-radius:8px;margin-bottom:5mm;background:#dcfce7;color:#166534}
.status-text{font-size:11pt;font-weight:900;text-transform:uppercase;letter-spacing:.15em}
.conditions{background:#f8fafc;border-radius:7px;padding:4mm 5mm}
.cond-p{font-size:8pt;color:#475569;line-height:1.7;margin-bottom:2mm}
.sig-lbl{font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-top:2mm}
.sig-box{border:1px dashed #cbd5e1;border-radius:7px;padding:3mm;min-height:22mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
.contact{font-size:8pt;color:#475569;line-height:1.9}
.contact strong{color:#0f172a}
.gen-date{font-size:7pt;color:#94a3b8;margin-top:3mm}
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">${S.appName}</div>
      <div class="brand-sub">${S.address}</div>
      ${(S.phone || S.taxId) ? `<div class="brand-sub">${[S.phone, S.taxId].filter(Boolean).join(' · ')}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="doc-title">Certificado de Garantía</div>
      <div class="doc-sub">Documento oficial de cobertura técnica</div>
      <div><span class="rma-badge">${rmaStr}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Datos del cliente</div>
    <div class="grid2">
      <div class="info-box"><div class="info-lbl">Cliente</div><div class="info-val">${WARRANTY.customerName}</div></div>
      <div class="info-box"><div class="info-lbl">Teléfono</div><div class="info-val">${WARRANTY.customerPhone}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Equipo reparado</div>
    <div class="grid2">
      <div class="info-box"><div class="info-lbl">Descripción</div><div class="info-val">${WARRANTY.deviceDescription}</div></div>
      <div class="info-box"><div class="info-lbl">Número de orden</div><div class="info-val">${rmaStr}</div></div>
      <div class="info-box" style="grid-column:1/-1"><div class="info-lbl">N/S · IMEI</div><div class="info-val" style="font-size:10pt">${REPAIR.serialNumber}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Cobertura de garantía</div>
    <div class="dates-block">
      <div class="dates-grid">
        <div><div class="date-lbl">Fecha de entrega</div><div class="date-val">${fmtDelivery}</div></div>
        <div><div class="months-num">${WARRANTY.months}</div><div class="months-lbl">meses</div></div>
        <div><div class="date-lbl">Válida hasta</div><div class="date-accent">${fmtExpiry}</div></div>
      </div>
    </div>
    <div class="status-banner"><div class="status-text">✓ Garantía Activa y Vigente</div></div>
  </div>

  <div class="section">
    <div class="sec-title">Condiciones de garantía</div>
    <div class="conditions">
      ${S.letterhead ? `<p class="cond-p">${S.letterhead}</p>` : ''}
      <p class="cond-p">Esta garantía cubre los defectos de mano de obra en la reparación realizada durante el período indicado.</p>
      <p class="cond-p">No cubre daños físicos, por líquidos, negligencia del usuario o intervenciones de terceros ajenos al servicio técnico.</p>
      <p class="cond-p">Para hacer efectiva esta garantía, presentar este documento junto con el equipo en el establecimiento.</p>
      <p class="cond-p">La garantía queda automáticamente anulada si el equipo presenta signos de manipulación no autorizada o nuevos daños físicos.</p>
    </div>
  </div>

  ${WARRANTY.notes ? `
  <div class="section" style="margin-bottom:5mm">
    <div class="sec-title">Observaciones</div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:4mm 5mm;font-size:8pt;color:#475569;line-height:1.7">${WARRANTY.notes}</div>
  </div>` : ''}

  <div style="margin-top:auto;padding-top:6mm;border-top:1px solid #e2e8f0">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-bottom:6mm">
      <div class="sig-box"><div style="flex:1"></div><div class="sig-lbl">Firma del cliente — Recibí el certificado</div></div>
      <div class="sig-box"><div style="flex:1"></div><div class="sig-lbl">Firma y sello del técnico autorizado</div></div>
    </div>
    <div class="contact">
      <p><strong>${S.appName}</strong></p>
      ${S.address ? `<p>${S.address}</p>` : ''}
      ${S.phone ? `<p>${S.phone}</p>` : ''}
      ${S.email ? `<p>${S.email}</p>` : ''}
      ${S.taxId ? `<p>CIF/NIF: ${S.taxId}</p>` : ''}
      <p class="gen-date">Documento generado el ${new Date().toLocaleDateString('es-ES')}</p>
    </div>
  </div>
</div>
</body></html>`;
}

// ─── Documents list ──────────────────────────────────────────────────────────

type DocEntry = { id: string; title: string; html: string };

function buildDocs(): DocEntry[] {
  return [
    {
      id:    'resguardo',
      title: '1 · Resguardo de Depósito',
      html:  buildReceiptHtml(),
    },
    {
      id:    'albaran',
      title: '2 · Albarán de Entrega',
      html:  captureHtml(() => printAlbaranEntrega(REPAIR, S, INV_FAC, null, 'tarjeta')),
    },
    {
      id:    'presupuesto',
      title: '3 · Presupuesto',
      html:  buildBudgetHtml(),
    },
    {
      id:    'factura',
      title: '4 · Factura con IVA (FAC)',
      html:  captureHtml(() => printInvoice(INV_FAC, S, WARRANTY, REPAIR)),
    },
    {
      id:    'recibo',
      title: '4b · Recibo sin IVA (REC)',
      html:  captureHtml(() => printInvoice(INV_REC, S)),
    },
    {
      id:    'orden',
      title: '5 · Orden de Trabajo',
      html:  captureHtml(() => printWorkOrder(REPAIR, BUDGET, S, [REPAIR])),
    },
    {
      id:    'garantia',
      title: '6 · Certificado de Garantía',
      html:  buildWarrantyHtml(),
    },
    {
      id:    'rechazo',
      title: '7 · Rechazo de Presupuesto',
      html:  captureHtml(() =>
        printRechazoPresupuesto(BUDGET, REPAIR, S, 'El cliente decide no realizar la reparación por el momento.')),
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DocumentPreview() {
  const [active, setActive] = useState(0);
  const docs = useMemo(buildDocs, []);
  const current = docs[active];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          DEV — Vista previa de documentos imprimibles
        </span>
        <span style={{ color: '#475569', fontSize: '10px' }}>
          Datos de prueba · {S.appName} · {docs.length} documentos
        </span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', padding: '8px 12px', background: '#1e293b', flexShrink: 0, flexWrap: 'wrap' }}>
        {docs.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setActive(i)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              background: active === i ? '#3b82f6' : '#334155',
              color:      active === i ? '#fff'     : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            {d.title}
          </button>
        ))}
      </div>

      {/* Document iframe */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px', overflowY: 'auto', background: '#0f172a' }}>
        {current.html
          ? (
            <iframe
              key={current.id}
              srcDoc={current.html}
              title={current.title}
              style={{
                width:  '850px',
                height: '1130px',
                border: 'none',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                background: 'white',
                borderRadius: '4px',
              }}
            />
          )
          : (
            <div style={{ color: '#ef4444', padding: '40px', fontSize: '13px' }}>
              ⚠ No se pudo capturar el HTML del documento. Comprueba la consola.
            </div>
          )
        }
      </div>
    </div>
  );
}
