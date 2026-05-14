import { AppSettings } from '../types';

const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('es-ES') : '—';
const fmtRMA  = (n: number)   => `RMA-${String(n).padStart(5, '0')}`;
const PAY_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum', transferencia: 'Transferencia',
};

export const printInvoice = (inv: any, settings: AppSettings, warranty?: any, repair?: any) => {
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
    <div style="margin-top:6px;text-align:right">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(inv.invoiceNumber)}&color=000000&bgcolor=ffffff" style="width:80px;height:80px;border:1px solid #ddd;border-radius:4px" alt="QR ${inv.invoiceNumber}"/>
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

${repair?.firmaClienteUrl ? `
<div style="border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;margin-bottom:6mm">
  <div style="background:#111;color:#fff;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 8px">Firmado por el cliente</div>
  <div style="padding:8px;display:flex;align-items:center;gap:10px">
    <img src="${repair.firmaClienteUrl}" style="height:50px;max-width:120px;object-fit:contain;border:1px solid #e0e0e0;border-radius:3px" alt="Firma"/>
    <div>
      <div style="font-size:9px;font-weight:700;color:#111">${inv.customerName}</div>
      <div style="font-size:8px;color:#666">Firmado digitalmente el ${new Date(repair.firmaClienteDate || Date.now()).toLocaleDateString('es-ES')}</div>
    </div>
  </div>
</div>` : ''}

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
