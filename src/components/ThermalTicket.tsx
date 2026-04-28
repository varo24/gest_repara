import React from 'react';
import { Printer, Download, X } from 'lucide-react';
import { RepairItem, AppSettings } from '../types';

interface ThermalTicketProps {
  repair: RepairItem;
  settings: AppSettings;
  onClose: () => void;
}

const ThermalTicket: React.FC<ThermalTicketProps> = ({ repair, settings, onClose }) => {
  const rmaFormatted = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  const dateFormatted = new Date(repair.entryDate).toLocaleDateString('es-ES');
  const barcodeDigits = repair.rmaNumber.toString().padStart(8, '0');

  const printContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ticket ${rmaFormatted}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Courier New', Courier, monospace;
    background: white;
    color: #000;
    width: 80mm;
    height: 120mm;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page { size: 80mm 120mm; margin: 0; }

  /* SECCIONES QUE SE REPARTEN EL LARGO */
  .sec-top    { flex: 0 0 auto; padding: 4mm 5mm 2mm; text-align: center; }
  .sec-rma    { flex: 2 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 5mm; }
  .sec-data   { flex: 3 1 auto; display: flex; flex-direction: column; justify-content: space-evenly; padding: 2mm 5mm; }
  .sec-foot   { flex: 0 0 auto; padding: 2mm 5mm 3mm; text-align: center; }

  .line-thick { border-top: 2px solid #000; margin: 0; }
  .line-thin  { border-top: 1px solid #555; }

  /* CABECERA */
  .shop-name  { font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .shop-phone { font-size: 9pt;  font-weight: 700; margin-top: 1mm; }

  /* RMA — protagonista */
  .rma-label {
    font-size: 7pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 3px;
    margin-bottom: 2mm;
  }
  .rma-box {
    border: 3px solid #000;
    padding: 3mm 8mm;
    display: inline-block;
  }
  .rma-number {
    font-size: 30pt; font-weight: 700;
    letter-spacing: 2px; line-height: 1;
  }
  .barcode-num {
    font-size: 8pt; font-weight: 700;
    letter-spacing: 5px; margin-top: 2mm;
    color: #333;
  }

  /* FILAS DE DATOS */
  .data-row { display: flex; flex-direction: column; }
  .data-lbl {
    font-size: 6.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px;
    color: #555; margin-bottom: 0.5mm;
  }
  .data-val-xl {
    font-size: 14pt; font-weight: 700;
    text-transform: uppercase; line-height: 1.1;
  }
  .data-val-lg {
    font-size: 11pt; font-weight: 700;
    text-transform: uppercase; line-height: 1.2;
  }
  .data-val-md {
    font-size: 9.5pt; font-weight: 700; line-height: 1.3;
  }
  .data-val-sm {
    font-size: 8.5pt; font-weight: 700; line-height: 1.5; color: #000;
  }

  /* PIE */
  .footer-box {
    background: #000; color: #fff;
    padding: 2mm 4mm;
    font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .footer-date { font-size: 7pt; color: #444; margin-top: 1mm; }
</style>
</head>
<body>

  <!-- TALLER -->
  <div class="sec-top">
    <div class="shop-name">${settings.appName}</div>
    ${settings.phone ? `<div class="shop-phone">${settings.phone}</div>` : ''}
  </div>

  <div class="line-thick"></div>

  <!-- RMA GRANDE -->
  <div class="sec-rma">
    <div class="rma-label">Número de Trabajo</div>
    <div class="rma-box">
      <div class="rma-number">${rmaFormatted}</div>
    </div>
    <div class="barcode-num">${barcodeDigits}</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(rmaFormatted)}&color=000000&bgcolor=ffffff" width="100" height="100" style="margin:3mm auto 0;display:block" alt="QR" />
  </div>

  <div class="line-thick"></div>

  <!-- DATOS DISTRIBUIDOS -->
  <div class="sec-data">

    <div class="data-row">
      <div class="data-lbl">Fecha · Técnico</div>
      <div class="data-val-md">${dateFormatted}${repair.technician ? '  ·  ' + repair.technician : ''}</div>
    </div>

    <div class="line-thin"></div>

    <div class="data-row">
      <div class="data-lbl">Cliente</div>
      <div class="data-val-xl">${repair.customerName}</div>
      <div class="data-val-md">${repair.customerPhone}</div>
    </div>

    <div class="line-thin"></div>

    <div class="data-row">
      <div class="data-lbl">Equipo</div>
      <div class="data-val-lg">${repair.brand} ${repair.model}</div>
      <div class="data-val-md">${repair.deviceType}${repair.serialNumber ? '  ·  S/N: ' + repair.serialNumber : ''}</div>
    </div>

    <div class="line-thin"></div>

    <div class="data-row">
      <div class="data-lbl">Avería declarada</div>
      <div class="data-val-sm">${repair.problemDescription.substring(0, 110)}${repair.problemDescription.length > 110 ? '...' : ''}</div>
    </div>

  </div>

  <div class="line-thick"></div>

  <!-- PIE -->
  <div class="sec-foot">
    <div class="footer-box">TICKET INTERNO — NO ENTREGAR AL CLIENTE</div>
    <div class="footer-date">${new Date().toLocaleString('es-ES')}</div>
  </div>

</body>
</html>`;

  const openPrint = () => {
    const win = window.open('', '_blank', 'width=420,height=580');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.focus();
      setTimeout(() => { try { win.print(); } catch(e) {} }, 1500);
      return;
    }
    // Fallback: hidden iframe
    const id = 'print-frame-ticket';
    let iframe = document.getElementById(id) as HTMLIFrameElement;
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:auto;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(printContent);
    doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch(e) {}
      setTimeout(() => iframe.remove(), 3000);
    }, 600);
  };

  // Preview a escala 2.5x (80mm→200px, 120mm→300px)
  const scale = 2.5;
  const pw = 80 * scale;  // 200px
  const ph = 120 * scale; // 300px

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm">

        {/* Acciones */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Ticket 80×120mm</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{rmaFormatted}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openPrint} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={openPrint} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all">
              <Download size={14} /> PDF
            </button>
            <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview proporcional */}
        <div className="p-5 flex flex-col items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vista previa 80×120mm</p>

          <div style={{ width: `${pw}px`, height: `${ph}px`, border: '2px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Courier New', Courier, monospace", color: '#000', fontSize: '9px' }}>

            {/* Top */}
            <div style={{ padding: '6px 8px 4px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{settings.appName}</div>
              {settings.phone && <div style={{ fontSize: '9px', marginTop: '1px' }}>{settings.phone}</div>}
            </div>

            <div style={{ borderTop: '2px solid #000' }}></div>

            {/* RMA */}
            <div style={{ flex: '2 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}>
              <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '3px' }}>Número de Trabajo</div>
              <div style={{ border: '3px solid #000', padding: '3px 10px', display: 'inline-block' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '2px', lineHeight: 1 }}>{rmaFormatted}</div>
              </div>
              <div style={{ fontSize: '8px', letterSpacing: '4px', marginTop: '3px', color: '#333' }}>{barcodeDigits}</div>
            </div>

            <div style={{ borderTop: '2px solid #000' }}></div>

            {/* Datos */}
            <div style={{ flex: '3 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '3px 8px' }}>

              <div>
                <div style={{ fontSize: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#555' }}>Fecha · Técnico</div>
                <div style={{ fontSize: '9px' }}>{dateFormatted}{repair.technician ? ' · ' + repair.technician : ''}</div>
              </div>

              <div style={{ borderTop: '1px solid #aaa' }}></div>

              <div>
                <div style={{ fontSize: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#555' }}>Cliente</div>
                <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 }}>{repair.customerName}</div>
                <div style={{ fontSize: '9px' }}>{repair.customerPhone}</div>
              </div>

              <div style={{ borderTop: '1px solid #aaa' }}></div>

              <div>
                <div style={{ fontSize: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#555' }}>Equipo</div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 }}>{repair.brand} {repair.model}</div>
                <div style={{ fontSize: '9px' }}>{repair.deviceType}</div>
              </div>

              <div style={{ borderTop: '1px solid #aaa' }}></div>

              <div>
                <div style={{ fontSize: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#555' }}>Avería</div>
                <div style={{ fontSize: '8px', lineHeight: 1.3 }}>{repair.problemDescription.substring(0, 80)}{repair.problemDescription.length > 80 ? '...' : ''}</div>
              </div>

            </div>

            <div style={{ borderTop: '2px solid #000' }}></div>

            {/* Pie */}
            <div style={{ padding: '3px 8px 4px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ background: '#000', color: '#fff', padding: '3px 5px', fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>TICKET INTERNO — NO ENTREGAR</div>
              <div style={{ fontSize: '7px', color: '#444', marginTop: '2px' }}>{new Date().toLocaleString('es-ES')}</div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ThermalTicket;
