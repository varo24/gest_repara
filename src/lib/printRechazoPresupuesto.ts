import { Budget, RepairItem, AppSettings } from '../types';

export function printRechazoPresupuesto(
  budget: Budget,
  repair: RepairItem | null,
  settings: AppSettings,
  motivo?: string,
): void {
  const rma = repair
    ? `RMA-${String(repair.rmaNumber).padStart(5, '0')}`
    : 'PRES. LIBRE';
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora  = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const customerName  = repair?.customerName  || budget.customerName  || '—';
  const customerPhone = repair?.customerPhone || budget.customerPhone || '—';
  const deviceStr = repair ? `${repair.deviceType ? repair.deviceType + ' · ' : ''}${repair.brand} ${repair.model}` : '—';
  const serial    = repair?.serialNumber ?? '';

  const efectiveTax = budget.taxEnabled === false ? 0 : (budget.taxRate ?? 21);
  const subtotal = budget.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    + budget.laborItems.reduce((s, i) => s + i.hours * i.hourlyRate, 0);
  const taxAmount = efectiveTax > 0 ? subtotal * efectiveTax / 100 : 0;
  const total = subtotal + taxAmount;

  const itemsRows = [
    ...budget.items.map(i => `
      <tr>
        <td style="padding:4px 6px;border-bottom:1px solid #eee">${i.description}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${i.unitPrice.toFixed(2)} €</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${(i.quantity * i.unitPrice).toFixed(2)} €</td>
      </tr>`),
    ...budget.laborItems.map(i => `
      <tr>
        <td style="padding:4px 6px;border-bottom:1px solid #eee">${i.description} (${i.hours}h)</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center">—</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${i.hourlyRate.toFixed(2)} €/h</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${(i.hours * i.hourlyRate).toFixed(2)} €</td>
      </tr>`),
  ].join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Rechazo de Presupuesto ${rma}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; background: white; color: #000; width: 210mm; padding: 14mm 14mm 12mm 14mm; }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #000; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .shop-info { font-size: 10px; color: #333; margin-top: 4px; line-height: 1.8; }
  .doc-title { text-align: center; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; border: 2px solid #c00; padding: 6px; margin-bottom: 14px; color: #c00; }
  .section { border: 1px solid #000; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
  .section-title { background: #000; color: white; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; }
  .section-body { padding: 10px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .field { margin-bottom: 6px; }
  .field-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 2px; }
  .field-value { font-size: 12px; font-weight: 700; border-bottom: 1px solid #aaa; padding-bottom: 2px; min-height: 18px; }
  .field-value-big { font-size: 14px; font-weight: 900; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f5f5f5; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 5px 6px; text-align: left; border-bottom: 2px solid #000; }
  .totals-box { min-width: 200px; margin-left: auto; margin-top: 8px; }
  .totals-line { display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; color: #555; padding: 3px 0; border-bottom: 1px solid #eee; }
  .totals-final { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; padding: 6px 0 0 0; border-top: 2px solid #000; margin-top: 4px; text-decoration: line-through; color: #c00; }
  .motivo-box { border: 2px dashed #c00; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; background: #fff5f5; }
  .motivo-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #c00; margin-bottom: 5px; }
  .motivo-text { font-size: 11px; font-weight: 700; color: #333; min-height: 20px; }
  .conformidad { border: 2px solid #000; border-radius: 4px; padding: 12px 14px; margin-bottom: 10px; }
  .conformidad-title { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 6px; }
  .conformidad-text { font-size: 10px; line-height: 1.8; color: #333; margin-bottom: 12px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
  .sig-col { text-align: center; }
  .sig-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 6px; }
  .sig-empty { height: 55px; border-bottom: 1px solid #000; margin-bottom: 4px; }
  .sig-name { font-size: 9px; color: #666; }
  .badge-reject { display: inline-block; background: #fee2e2; color: #991b1b; border: 2px solid #991b1b; padding: 3px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 3px; }
  .footer { border-top: 2px solid #000; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #555; margin-top: 4px; }
</style>
</head>
<body>

<!-- CABECERA -->
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    ${settings.logoUrl
      ? `<img src="${settings.logoUrl}" style="width:56px;height:56px;border:2px solid #000;border-radius:6px;object-fit:contain;padding:3px" alt="Logo">`
      : `<div style="width:56px;height:56px;border:2px solid #000;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:26px">🔧</div>`}
    <div>
      <div class="shop-name">${settings.appName}</div>
      <div class="shop-info">
        ${settings.address ? `📍 ${settings.address}<br>` : ''}
        ${settings.phone ? `📞 ${settings.phone}` : ''}
        ${settings.email ? ` · ✉️ ${settings.email}` : ''}
        ${settings.taxId ? `<br>NIF/CIF: ${settings.taxId}` : ''}
      </div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#555">Nº de Trabajo</div>
    <div style="font-size:22px;font-weight:900;border:2px solid #000;padding:2px 10px;display:inline-block;margin:4px 0">${rma}</div>
    <div style="margin-top:4px"><span class="badge-reject">✗ Presupuesto Rechazado</span></div>
    <div style="font-size:10px;color:#333;margin-top:4px">📅 ${fecha} · 🕐 ${hora}</div>
  </div>
</div>

<!-- TÍTULO -->
<div class="doc-title">■ Documento de Rechazo de Presupuesto ■</div>

<!-- CLIENTE + EQUIPO -->
<div class="two-col">
  <div class="section">
    <div class="section-title">▶ Datos del Cliente</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Nombre</div>
        <div class="field-value field-value-big">${customerName}</div>
      </div>
      <div class="field">
        <div class="field-label">Teléfono</div>
        <div class="field-value">📞 ${customerPhone}</div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">▶ Equipo</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Descripción</div>
        <div class="field-value field-value-big">${deviceStr}</div>
      </div>
      ${serial ? `<div class="field"><div class="field-label">N/S · IMEI</div><div class="field-value">${serial}</div></div>` : ''}
      ${repair?.problemDescription ? `<div class="field"><div class="field-label">Avería declarada</div><div class="field-value" style="font-size:10px;font-weight:600">${repair.problemDescription}</div></div>` : ''}
    </div>
  </div>
</div>

<!-- PRESUPUESTO RECHAZADO -->
<div class="section" style="margin-bottom:10px">
  <div class="section-title">▶ Detalle del Presupuesto Rechazado</div>
  <div class="section-body">
    ${itemsRows.length > 0 ? `
    <table>
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:center;width:40px">Ud.</th>
        <th style="text-align:right;width:80px">P. Unit.</th>
        <th style="text-align:right;width:80px">Total</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end">
      <div class="totals-box">
        ${efectiveTax > 0 ? `<div class="totals-line"><span>Base imponible</span><span>${subtotal.toFixed(2)} €</span></div>
        <div class="totals-line"><span>IVA ${efectiveTax}%</span><span>${taxAmount.toFixed(2)} €</span></div>` : ''}
        <div class="totals-final"><span>TOTAL NO ACEPTADO</span><span>${total.toFixed(2)} €</span></div>
      </div>
    </div>` : '<div style="font-size:10px;color:#aaa">Sin líneas de presupuesto</div>'}
  </div>
</div>

<!-- MOTIVO DEL RECHAZO -->
<div class="motivo-box">
  <div class="motivo-title">✗ Motivo del Rechazo</div>
  <div class="motivo-text">${motivo || 'El cliente no ha indicado motivo específico.'}</div>
</div>

<!-- CONFORMIDAD -->
<div class="conformidad">
  <div class="conformidad-title">✍ Conformidad del Cliente con el Rechazo</div>
  <div class="conformidad-text">
    El cliente confirma que ha sido informado del presupuesto detallado anteriormente y declara expresamente no autorizar la realización de los trabajos descritos.
    El equipo queda en custodia del taller hasta su retirada. ${settings.appName} no se responsabiliza del equipo transcurridos 90 días desde esta notificación.
  </div>
  <div class="sig-grid">
    <div class="sig-col">
      <div class="sig-label">Firma del Cliente — Confirma el rechazo</div>
      <div class="sig-empty"></div>
      <div class="sig-name">${customerName}</div>
    </div>
    <div class="sig-col">
      <div class="sig-label">Firma del Técnico / Sello</div>
      <div class="sig-empty" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:4px">
        ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="height:35px;object-fit:contain;opacity:0.7" alt="Logo">` : ''}
        <div style="text-align:left;font-size:8px;line-height:1.6;color:#333">
          <div style="font-weight:900;font-size:9px">${settings.appName}</div>
          ${settings.taxId ? `<div>CIF/NIF: ${settings.taxId}</div>` : ''}
        </div>
      </div>
      <div class="sig-name">${repair?.technician ? `Técnico: ${repair.technician}` : ''}</div>
    </div>
  </div>
</div>

<!-- PIE -->
<div class="footer">
  <span>${settings.appName}${settings.taxId ? ` · NIF/CIF: ${settings.taxId}` : ''}</span>
  <span>Documento de rechazo generado el ${fecha} · ${settings.appName}</span>
</div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=850,height=1100');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch (_) {} }, 800);
    return;
  }
  const id = 'print-frame-rechazo';
  let iframe = document.getElementById(id) as HTMLIFrameElement | null;
  if (iframe) iframe.remove();
  iframe = document.createElement('iframe');
  iframe.id = id;
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try { iframe!.contentWindow?.focus(); iframe!.contentWindow?.print(); } catch (_) {}
    setTimeout(() => iframe!.remove(), 3000);
  }, 800);
}
