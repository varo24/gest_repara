import { RepairItem, AppSettings, Budget, FullInvoice } from '../types';

const PAY_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum', transferencia: 'Transferencia',
};

export function printAlbaranEntrega(
  repair: RepairItem,
  settings: AppSettings,
  invoice: FullInvoice | null = null,
  budget: Budget | null = null,
  payMethod = 'efectivo',
): void {
  const rma = `RMA-${String(repair.rmaNumber).padStart(5, '0')}`;
  const now = new Date();
  const fechaEntrega = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaEntrega = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const warrantyMonths = settings.warrantyMonths ?? 3;

  // Totals — prefer invoice, fall back to budget
  const items  = invoice?.items  ?? budget?.items  ?? [];
  const labor  = invoice?.laborItems ?? budget?.laborItems ?? [];
  const taxRate = invoice?.taxRate ?? (budget?.taxEnabled === false ? 0 : (budget?.taxRate ?? settings.taxRate ?? 21));
  const subtotalRaw = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    + labor.reduce((s, i) => s + i.hours * i.hourlyRate, 0);
  const taxAmount = taxRate > 0 ? subtotalRaw * taxRate / 100 : 0;
  const total = invoice?.total ?? (subtotalRaw + taxAmount);

  const itemsHTML = [...items.map(i => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #eee">${i.description}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${(i.unitPrice).toFixed(2)} €</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${(i.quantity * i.unitPrice).toFixed(2)} €</td>
    </tr>`),
  ...labor.map(i => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #eee">${i.description} (${i.hours}h)</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center">—</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${(i.hourlyRate).toFixed(2)} €/h</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${(i.hours * i.hourlyRate).toFixed(2)} €</td>
    </tr>`)].join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Albarán de Entrega ${rma}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; background: white; color: #000; width: 210mm; padding: 14mm 14mm 12mm 14mm; }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #000; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .shop-info { font-size: 10px; color: #333; margin-top: 4px; line-height: 1.8; }
  .doc-ref { text-align: right; }
  .doc-title-box { text-align: center; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; border: 2px solid #000; padding: 6px; margin-bottom: 14px; }
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
  .totals-row { display: flex; justify-content: flex-end; }
  .totals-box { min-width: 220px; margin-top: 8px; }
  .totals-line { display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; color: #555; padding: 3px 0; border-bottom: 1px solid #eee; }
  .totals-final { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; padding: 8px 0 0 0; border-top: 2px solid #000; margin-top: 4px; }
  .pay-badge { display: inline-block; border: 2px solid #000; padding: 2px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 3px; }
  .conformidad { border: 2px solid #000; border-radius: 4px; padding: 12px 14px; margin-bottom: 10px; }
  .conformidad-title { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 6px; }
  .conformidad-text { font-size: 10px; line-height: 1.8; color: #333; margin-bottom: 12px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
  .sig-col { text-align: center; }
  .sig-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 6px; }
  .sig-empty { height: 60px; border-bottom: 1px solid #000; margin-bottom: 4px; }
  .sig-name { font-size: 9px; color: #666; }
  .warranty-box { border: 1px solid #aaa; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; background: #f9f9f9; font-size: 9px; color: #333; line-height: 1.8; }
  .warranty-title { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .footer { border-top: 2px solid #000; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #555; }
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
  <div class="doc-ref" style="text-align:right">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#555">Nº de Trabajo</div>
    <div style="font-size:26px;font-weight:900;border:2px solid #000;padding:2px 10px;display:inline-block;margin:4px 0">${rma}</div>
    ${invoice ? `<div style="font-size:10px;color:#333;margin-top:2px">Factura: ${invoice.invoiceNumber}</div>` : ''}
    <div style="font-size:10px;color:#333">📅 ${fechaEntrega} · 🕐 ${horaEntrega}</div>
  </div>
</div>

<!-- TÍTULO -->
<div class="doc-title-box">■ ALBARÁN DE ENTREGA ■</div>

<!-- CLIENTE + EQUIPO -->
<div class="two-col">
  <div class="section">
    <div class="section-title">▶ Datos del Cliente</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Nombre</div>
        <div class="field-value field-value-big">${repair.customerName}</div>
      </div>
      <div class="field">
        <div class="field-label">Teléfono</div>
        <div class="field-value">📞 ${repair.customerPhone}</div>
      </div>
      ${repair.technician ? `<div class="field"><div class="field-label">Técnico responsable</div><div class="field-value">${repair.technician}</div></div>` : ''}
    </div>
  </div>
  <div class="section">
    <div class="section-title">▶ Equipo Entregado</div>
    <div class="section-body">
      <div class="field">
        <div class="field-label">Marca y Modelo</div>
        <div class="field-value field-value-big">${repair.brand} ${repair.model}</div>
      </div>
      <div class="field">
        <div class="field-label">Tipo</div>
        <div class="field-value">${repair.deviceType}</div>
      </div>
      ${repair.serialNumber ? `<div class="field"><div class="field-label">N/S · IMEI</div><div class="field-value">${repair.serialNumber}</div></div>` : ''}
    </div>
  </div>
</div>

<!-- TRABAJOS REALIZADOS -->
<div class="section" style="margin-bottom:10px">
  <div class="section-title">▶ Trabajos Realizados</div>
  <div class="section-body">
    ${items.length === 0 && labor.length === 0
      ? `<div style="font-size:11px;color:#333;padding:4px 0">${repair.problemDescription}</div>`
      : `<table>
          <thead><tr>
            <th>Descripción</th>
            <th style="text-align:center;width:40px">Ud.</th>
            <th style="text-align:right;width:80px">P. Unit.</th>
            <th style="text-align:right;width:80px">Total</th>
          </tr></thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <div class="totals-row">
          <div class="totals-box">
            ${taxRate > 0 ? `<div class="totals-line"><span>Base imponible</span><span>${subtotalRaw.toFixed(2)} €</span></div>
            <div class="totals-line"><span>IVA ${taxRate}%</span><span>${taxAmount.toFixed(2)} €</span></div>` : ''}
            <div class="totals-final"><span>TOTAL</span><span>${total.toFixed(2)} €</span></div>
          </div>
        </div>`
    }
  </div>
</div>

<!-- PAGO -->
<div class="section" style="margin-bottom:10px">
  <div class="section-title">▶ Pago</div>
  <div class="section-body" style="display:flex;align-items:center;gap:16px">
    <div>
      <div class="field-label">Importe cobrado</div>
      <div style="font-size:20px;font-weight:900">${total.toFixed(2)} €</div>
    </div>
    <div>
      <div class="field-label">Forma de pago</div>
      <div class="pay-badge">${PAY_LABELS[payMethod] ?? payMethod}</div>
    </div>
    ${invoice ? `<div style="margin-left:auto">
      <div class="field-label">Nº Factura</div>
      <div style="font-size:12px;font-weight:800">${invoice.invoiceNumber}</div>
    </div>` : ''}
  </div>
</div>

<!-- GARANTÍA -->
<div class="warranty-box">
  <div class="warranty-title">🛡 Garantía de la Reparación</div>
  Garantía de <strong>${warrantyMonths} meses</strong> desde la fecha de entrega. La garantía cubre mano de obra y piezas sustituidas en la presente reparación.
  No cubre daños físicos, por líquidos, negligencia del usuario o intervenciones no autorizadas.
  Para hacer efectiva la garantía, el cliente deberá presentar este documento y el equipo en el establecimiento.
  ${settings.letterhead ? `<br><br>${settings.letterhead}` : ''}
</div>

<!-- CONFORMIDAD -->
<div class="conformidad">
  <div class="conformidad-title">✍ Conformidad del Cliente</div>
  <div class="conformidad-text">
    El cliente declara recibir el equipo descrito en perfecto estado de funcionamiento con respecto a los trabajos realizados, en conformidad con el presupuesto previamente autorizado y los servicios descritos en este albarán.
    La entrega del equipo implica la aceptación de los trabajos realizados y del importe total cobrado.
  </div>
  <div class="sig-grid">
    <div class="sig-col">
      <div class="sig-label">Firma del Cliente</div>
      <div class="sig-empty"></div>
      <div class="sig-name">${repair.customerName}</div>
    </div>
    <div class="sig-col">
      <div class="sig-label">Firma del Técnico / Sello</div>
      <div class="sig-empty"></div>
      <div class="sig-name">${repair.technician || settings.appName}</div>
    </div>
  </div>
</div>

<!-- PIE -->
<div class="footer">
  <span>${settings.appName}${settings.taxId ? ` · NIF/CIF: ${settings.taxId}` : ''}${settings.address ? ` · ${settings.address}` : ''}</span>
  <span>Albarán generado el ${fechaEntrega} · ReparaPro</span>
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
  const id = 'print-frame-albaran';
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
