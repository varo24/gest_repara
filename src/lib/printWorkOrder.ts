import { RepairItem, Budget, AppSettings, FieldNote } from '../types';

const fmtRMA   = (n: number) => `RMA-${n.toString().padStart(5, '0')}`;
const fmtDate  = (d?: string) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const esc      = (s?: string | null) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STATUS_COLORS: Record<string, string> = {
  'Pendiente':             '#f57f17',
  'En Diagnóstico':        '#0277bd',
  'Presupuesto Enviado':   '#6a1b9a',
  'Presupuesto Aceptado':  '#2e7d32',
  'Presupuesto Rechazado': '#c62828',
  'Esperando Repuestos':   '#e65100',
  'En Reparación':         '#1565c0',
  'Listo para Entrega':    '#2e7d32',
  'Entregado':             '#546e7a',
  'Cancelado':             '#c62828',
  'Sin Reparación':        '#78909c',
};

const DIFF_LABELS: Record<string, string> = {
  facil: 'Fácil', medio: 'Medio', dificil: 'Difícil', 'no-reparable': 'No reparable',
};
const DIFF_COLORS: Record<string, string> = {
  facil: '#2e7d32', medio: '#f57f17', dificil: '#e65100', 'no-reparable': '#c62828',
};

export const printWorkOrder = (
  repair: RepairItem,
  budget?: Budget,
  settings?: AppSettings,
  repairs?: RepairItem[],
): void => {
  const s = (settings ?? { appName: 'Taller', address: '', phone: '', taxId: '' }) as AppSettings;
  const rma = fmtRMA(repair.rmaNumber);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(rma)}&color=000000&bgcolor=ffffff`;

  const repairCount = repairs
    ? repairs.filter(r =>
        r.customerPhone === repair.customerPhone ||
        r.customerName.toLowerCase() === repair.customerName.toLowerCase()
      ).length
    : 0;

  // ── Aesthetic condition table ──────────────────────────────────────────────
  const est = repair.estadoEstetico;
  const ck = (val: boolean) =>
    val
      ? `<span style="color:#2e7d32;font-weight:900;font-size:14px">✓</span>`
      : `<span style="color:#d0d0d0;font-size:12px">○</span>`;

  const esteticoHTML = est ? `
<table class="estetic">
  <thead><tr>
    <th class="left" style="width:90px">Componente</th>
    <th>Perfecto</th>
    <th>Rayado / Fallo</th>
    <th>Golpes</th>
    <th>Roto / No funciona</th>
    <th>N/A</th>
  </tr></thead>
  <tbody>
    <tr>
      <td class="label">Pantalla</td>
      <td>${ck(est.pantalla === 'perfecto')}</td>
      <td>${ck(est.pantalla === 'rayado')}</td>
      <td>—</td>
      <td>${ck(est.pantalla === 'roto')}</td>
      <td>${ck(est.pantalla === 'na')}</td>
    </tr>
    <tr>
      <td class="label">Carcasa</td>
      <td>${ck(est.carcasa === 'perfecto')}</td>
      <td>${ck(est.carcasa === 'rayado')}</td>
      <td>${ck(est.carcasa === 'golpes')}</td>
      <td>${ck(est.carcasa === 'roto')}</td>
      <td>—</td>
    </tr>
    <tr>
      <td class="label">Botones</td>
      <td>${ck(est.botones === 'perfecto')}</td>
      <td>${ck(est.botones === 'fallo-parcial')}</td>
      <td>—</td>
      <td>${ck(est.botones === 'no-funciona')}</td>
      <td>—</td>
    </tr>
    <tr>
      <td class="label">Puertos</td>
      <td>${ck(est.puertos === 'perfecto')}</td>
      <td>${ck(est.puertos === 'dano-visible')}</td>
      <td>—</td>
      <td>${ck(est.puertos === 'no-funciona')}</td>
      <td>—</td>
    </tr>
  </tbody>
</table>
${est.observaciones ? `<p style="margin-top:5px;font-size:9px;color:#555"><strong>Observaciones:</strong> ${esc(est.observaciones)}</p>` : ''}
` : `<p style="color:#aaa;font-size:9px;font-style:italic">No se registró estado estético al ingreso</p>`;

  // ── Diagnostics ──────────────────────────────────────────────────────────
  const diag = repair.diagnostico;
  const diagHTML = diag ? `
<div class="field-group">
  <span class="field-label">Problema detectado</span>
  <div class="field-value">${esc(diag.problema)}</div>
</div>
${diag.causaRaiz ? `<div class="field-group"><span class="field-label">Causa raíz</span><div class="field-value">${esc(diag.causaRaiz)}</div></div>` : ''}
${diag.solucionAplicada ? `<div class="field-group"><span class="field-label">Solución aplicada</span><div class="field-value">${esc(diag.solucionAplicada)}</div></div>` : ''}
${diag.piezasSustituidas ? `<div class="field-group"><span class="field-label">Piezas sustituidas</span><div class="field-value">${esc(diag.piezasSustituidas)}</div></div>` : ''}
<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:4px">
  ${diag.tiempoEstimado ? `<div><span class="field-label">Tiempo est.: </span><strong>${diag.tiempoEstimado}h</strong></div>` : ''}
  ${diag.tecnico ? `<div><span class="field-label">Técnico: </span><strong>${esc(diag.tecnico)}</strong></div>` : ''}
  ${diag.nivelDificultad ? `<div><span class="field-label">Dificultad: </span><strong style="color:${DIFF_COLORS[diag.nivelDificultad] || '#333'}">${DIFF_LABELS[diag.nivelDificultad] || diag.nivelDificultad}</strong></div>` : ''}
</div>
` : `
<div class="field-group">
  <span class="field-label">Problema detectado</span>
  <div class="blank-line"></div><div class="blank-line"></div>
</div>
<div class="info-grid info-grid-2">
  <div class="field-group">
    <span class="field-label">Causa raíz</span>
    <div class="blank-line"></div>
  </div>
  <div class="field-group">
    <span class="field-label">Piezas necesarias</span>
    <div class="blank-line"></div>
  </div>
</div>
<div class="field-group">
  <span class="field-label">Solución a aplicar</span>
  <div class="blank-line"></div><div class="blank-line"></div>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;flex-wrap:wrap;gap:8px">
  <div><span class="field-label">Tiempo estimado: </span><span style="border-bottom:1px solid #bbb;display:inline-block;width:60px">&nbsp;</span> horas</div>
  <div style="display:flex;gap:14px;align-items:center">
    <span class="field-label">Dificultad:</span>
    ${['Fácil', 'Medio', 'Difícil', 'No reparable'].map(d => `<span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:11px;height:11px;border:1.5px solid #777;border-radius:2px"></span>${d}</span>`).join('')}
  </div>
</div>
`;

  // ── Budget section ────────────────────────────────────────────────────────
  const budgetHTML = budget ? (() => {
    const sub = budget.items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0)
              + budget.laborItems.reduce((acc, i) => acc + i.hours * i.hourlyRate, 0);
    const taxRate = budget.taxEnabled === false ? 0 : (budget.taxRate ?? 21);
    const tax  = Math.round(sub * taxRate / 100 * 100) / 100;
    const statusLabel = budget.status === 'accepted' ? 'ACEPTADO' : budget.status === 'rejected' ? 'RECHAZADO' : 'PENDIENTE';
    const statusBg    = budget.status === 'accepted' ? '#2e7d32' : budget.status === 'rejected' ? '#c62828' : '#f57f17';
    return `
<div class="section">
  <div class="section-header" style="background:#4a148c;display:flex;justify-content:space-between;align-items:center">
    <span>§7 — Presupuesto</span>
    <span style="font-size:8px;background:${statusBg};padding:1px 8px;border-radius:10px">${statusLabel}</span>
  </div>
  <div class="section-body">
    <table class="budget">
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:center;width:50px">Cant.</th>
        <th style="text-align:right;width:75px">P. Unit.</th>
        <th style="text-align:right;width:75px">Total</th>
      </tr></thead>
      <tbody>
        ${budget.items.map(i => `<tr>
          <td>${esc(i.description)}</td>
          <td style="text-align:center">${i.quantity}</td>
          <td style="text-align:right">${i.unitPrice.toFixed(2)} €</td>
          <td style="text-align:right">${(i.quantity * i.unitPrice).toFixed(2)} €</td>
        </tr>`).join('')}
        ${budget.laborItems.map(i => `<tr>
          <td>${esc(i.description)} <span style="color:#888">(${i.hours}h × ${i.hourlyRate}€/h)</span></td>
          <td style="text-align:center">1</td>
          <td style="text-align:right">${(i.hours * i.hourlyRate).toFixed(2)} €</td>
          <td style="text-align:right">${(i.hours * i.hourlyRate).toFixed(2)} €</td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${sub.toFixed(2)} €</td></tr>
        ${taxRate > 0 ? `<tr><td colspan="3" style="text-align:right">IVA ${taxRate}%</td><td style="text-align:right">${tax.toFixed(2)} €</td></tr>` : ''}
        <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL</td><td style="text-align:right">${budget.total.toFixed(2)} €</td></tr>
      </tfoot>
    </table>
    ${budget.motivoRechazo ? `<p style="margin-top:6px;font-size:9px;color:#c62828"><strong>Motivo rechazo:</strong> ${esc(budget.motivoRechazo)}</p>` : ''}
  </div>
</div>`;
  })() : '';

  // ── HTML ─────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Orden de Trabajo ${rma}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
@page { size: A4; margin: 12mm 14mm 15mm 14mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: #fff; line-height: 1.35; }

/* Header */
.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #1a1a1a; margin-bottom: 10px; }
.shop-name { font-size: 17px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
.shop-info { font-size: 8.5px; color: #666; margin-top: 3px; line-height: 1.5; }
.header-right { display: flex; align-items: flex-start; gap: 10px; }
.doc-area { text-align: right; }
.doc-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #555; margin-bottom: 3px; }
.rma-code { font-size: 26px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 2px; line-height: 1; }
.status-badge { display: inline-block; padding: 2px 9px; border-radius: 4px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #fff; margin-top: 4px; }
img.qr { width: 78px; height: 78px; border: 1px solid #e8e8e8; border-radius: 4px; }

/* Sections */
.section { margin-bottom: 7px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
.section-header { padding: 4px 10px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #fff; background: #1a1a1a; }
.section-body { padding: 8px 10px; }

/* Info grids */
.info-grid { display: grid; gap: 7px; }
.info-grid-2 { grid-template-columns: repeat(2, 1fr); }
.info-grid-3 { grid-template-columns: repeat(3, 1fr); }
.info-grid-4 { grid-template-columns: repeat(4, 1fr); }
.info-item .lbl { font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 1px; display: block; margin-bottom: 1px; }
.info-item .val { font-size: 10px; font-weight: 700; color: #1a1a1a; padding-bottom: 1px; border-bottom: 1px dotted #ccc; min-height: 15px; }
.info-item .val.empty { color: #aaa; font-weight: 400; font-style: italic; }

/* Aesthetic table */
table.estetic { width: 100%; border-collapse: collapse; }
table.estetic th { background: #f5f5f5; padding: 4px 6px; text-align: center; font-weight: 700; font-size: 8.5px; border: 1px solid #ddd; text-transform: uppercase; letter-spacing: 0.5px; }
table.estetic th.left { text-align: left; }
table.estetic td { padding: 4px 6px; text-align: center; border: 1px solid #ddd; }
table.estetic td.label { text-align: left; font-weight: 700; font-size: 10px; }

/* Blank fields */
.blank-line { display: block; border-bottom: 1px solid #c0c0c0; height: 17px; width: 100%; margin-bottom: 3px; }
.field-group { margin-bottom: 6px; }
.field-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #888; letter-spacing: 1px; display: block; margin-bottom: 2px; }
.field-value { font-size: 10px; font-weight: 700; padding: 3px 6px; background: #f8f8f8; border-radius: 3px; border-left: 3px solid #ddd; min-height: 18px; color: #1a1a1a; }

/* Work log */
table.log { width: 100%; border-collapse: collapse; }
table.log th { background: #f0f0f0; padding: 4px 7px; text-align: left; font-weight: 700; font-size: 8.5px; border: 1px solid #ddd; text-transform: uppercase; letter-spacing: 0.5px; }
table.log td { padding: 5px 7px; border: 1px solid #ddd; height: 21px; }

/* Budget */
table.budget { width: 100%; border-collapse: collapse; }
table.budget th { background: #f5f5f5; padding: 4px 8px; text-align: left; font-weight: 700; font-size: 8.5px; border: 1px solid #ddd; }
table.budget td { padding: 4px 8px; border: 1px solid #ddd; }
table.budget tfoot td { background: #f5f5f5; font-weight: 700; text-align: right; }
table.budget .total-row td { background: #1a1a1a; color: #fff; font-size: 12px; font-weight: 900; }

/* Footer */
.footer { margin-top: 8px; padding-top: 7px; border-top: 1px solid #eee; }
.footer-legal { font-size: 7px; color: #bbb; line-height: 1.5; margin-bottom: 5px; }
.footer-bar { display: flex; justify-content: space-between; align-items: center; }
.internal-badge { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #bbb; border: 1px solid #e0e0e0; padding: 2px 8px; border-radius: 4px; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div style="display:flex;align-items:center;gap:10px">
    ${s.logoUrl ? `<img src="${s.logoUrl}" style="width:52px;height:52px;border:1.5px solid #ddd;border-radius:6px;object-fit:contain;padding:2px;flex-shrink:0" alt="Logo">` : ''}
    <div>
      <div class="shop-name">${esc(s.appName)}</div>
      <div class="shop-info">
        ${[s.address, s.phone ? `Tel. ${s.phone}` : '', s.email ? s.email : '', s.taxId ? `NIF ${s.taxId}` : ''].filter(Boolean).join(' · ')}
      </div>
    </div>
  </div>
  <div class="header-right">
    <div class="doc-area">
      <div class="doc-title">Orden de Trabajo</div>
      <div class="rma-code">${rma}</div>
      <div style="margin-top:5px">
        <span class="status-badge" style="background:${STATUS_COLORS[repair.status] || '#555'}">${esc(repair.status)}</span>
      </div>
      <div style="font-size:8px;color:#999;margin-top:4px;line-height:1.6">
        Entrada: ${fmtDate(repair.entryDate)}<br>
        ${repair.technician ? `Técnico: ${esc(repair.technician)}` : ''}
      </div>
    </div>
    <img class="qr" src="${qrUrl}" alt="${rma}" />
  </div>
</div>

<!-- §1 CLIENTE -->
<div class="section">
  <div class="section-header">§1 — Datos del Cliente</div>
  <div class="section-body">
    <div class="info-grid info-grid-3">
      <div class="info-item">
        <span class="lbl">Nombre</span>
        <div class="val">
          ${esc(repair.customerName)}
          ${repairCount > 1 ? `<span style="font-size:7.5px;color:#888;font-weight:400"> · cliente habitual (${repairCount} reparaciones)</span>` : ''}
        </div>
      </div>
      <div class="info-item">
        <span class="lbl">Teléfono</span>
        <div class="val">${esc(repair.customerPhone)}</div>
      </div>
      <div class="info-item">
        <span class="lbl">Tipo de servicio</span>
        <div class="val">${repair.repairType === 'domicilio' ? '🏠 A domicilio' : '🔧 Taller'}</div>
      </div>
      ${repair.address || repair.city ? `
      <div class="info-item" style="grid-column:1/-1">
        <span class="lbl">Dirección</span>
        <div class="val">${[repair.address, repair.city].filter(Boolean).map(esc).join(', ')}</div>
      </div>` : ''}
    </div>
  </div>
</div>

<!-- §2 EQUIPO -->
<div class="section">
  <div class="section-header">§2 — Datos del Equipo</div>
  <div class="section-body">
    <div class="info-grid info-grid-4">
      <div class="info-item">
        <span class="lbl">Tipo</span>
        <div class="val">${esc(repair.deviceType)}</div>
      </div>
      <div class="info-item">
        <span class="lbl">Marca</span>
        <div class="val">${esc(repair.brand)}</div>
      </div>
      <div class="info-item">
        <span class="lbl">Modelo</span>
        <div class="val">${esc(repair.model)}</div>
      </div>
      <div class="info-item">
        <span class="lbl">Núm. de serie</span>
        <div class="val ${!repair.serialNumber ? 'empty' : ''}">
          ${repair.serialNumber ? esc(repair.serialNumber) : 'No registrado'}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- §3 ESTADO ESTÉTICO -->
<div class="section">
  <div class="section-header">§3 — Estado Estético al Ingreso</div>
  <div class="section-body">${esteticoHTML}</div>
</div>

<!-- §4 AVERÍA -->
<div class="section">
  <div class="section-header">§4 — Avería Reportada por el Cliente</div>
  <div class="section-body">
    <div class="field-group">
      <span class="field-label">Descripción del problema</span>
      ${repair.problemDescription
        ? `<div class="field-value">${esc(repair.problemDescription)}</div>`
        : `<div class="blank-line"></div><div class="blank-line"></div>`
      }
    </div>
    ${repair.notes ? `<div class="field-group"><span class="field-label">Notas adicionales</span><div class="field-value">${esc(repair.notes)}</div></div>` : ''}
    ${repair.fieldNotes && repair.fieldNotes.length > 0 ? `
    <div class="field-group" style="margin-top:6px">
      <span class="field-label">Notas de campo del técnico</span>
      ${repair.fieldNotes.map((fn: FieldNote) => `
        <div class="field-value" style="margin-bottom:5px">
          <span style="font-size:7.5px;color:#888;display:block;margin-bottom:2px">${new Date(fn.timestamp).toLocaleString('es-ES')}</span>
          ${esc(fn.text)}
        </div>`).join('')}
    </div>` : ''}
  </div>
</div>

<!-- §5 DIAGNÓSTICO -->
<div class="section">
  <div class="section-header" style="background:#0d47a1">
    §5 — Diagnóstico Técnico ${diag ? '<span style="font-size:8px;font-weight:400;opacity:0.7">(registrado en sistema)</span>' : '<span style="font-size:8px;font-weight:400;opacity:0.7">(rellenar a mano)</span>'}
  </div>
  <div class="section-body">${diagHTML}</div>
</div>

<!-- §6 SEGUIMIENTO -->
<div class="section">
  <div class="section-header" style="background:#37474f">§6 — Seguimiento de la Reparación</div>
  <div class="section-body">
    <table class="log">
      <thead><tr>
        <th style="width:115px">Fecha / Hora</th>
        <th>Acción realizada</th>
        <th style="width:95px">Técnico</th>
        <th style="width:95px">Estado</th>
      </tr></thead>
      <tbody>
        ${Array(5).fill(0).map(() => `<tr><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>

<!-- §7 PRESUPUESTO -->
${budgetHTML}

<!-- FOOTER -->
<div class="footer">
  ${s.legalTerms ? `<div class="footer-legal">${s.legalTerms}</div>` : ''}
  <div class="footer-bar">
    <span class="internal-badge">⚙ Documento interno — No válido como resguardo para el cliente</span>
    <span style="font-size:8px;color:#ccc">Impreso: ${new Date().toLocaleString('es-ES')}</span>
  </div>
</div>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=794,height=1123');
  if (!w) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm';
    document.body.appendChild(iframe);
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch {}
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 1000);
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => { try { w.print(); } catch {} }, 600);
  setTimeout(() => { try { w.print(); } catch {} }, 2500);
};
