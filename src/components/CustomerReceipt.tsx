import React, { useRef } from 'react';
import { Printer, Download, X } from 'lucide-react';
import { RepairItem, AppSettings } from '../types';
import SignaturePad from './SignaturePad';

interface CustomerReceiptProps {
  repair: RepairItem;
  settings: AppSettings;
  onClose: () => void;
  onSignatureUpdate: (sig: string) => void;
}

const CustomerReceipt: React.FC<CustomerReceiptProps> = ({ repair, settings, onClose, onSignatureUpdate }) => {
  const rmaFormatted = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  const dateFormatted = new Date(repair.entryDate).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const printHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Resguardo ${rmaFormatted}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    background: white;
    color: #000;
    width: 210mm;
    padding: 14mm 14mm 10mm 14mm;
  }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }

  /* CABECERA */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 10px;
    border-bottom: 3px solid #000;
    margin-bottom: 14px;
  }
  .shop-logo {
    width: 60px; height: 60px;
    object-fit: contain;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 4px;
  }
  .shop-name {
    font-size: 20px; font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .shop-info { font-size: 10px; color: #333; margin-top: 4px; line-height: 1.8; }
  .rma-block { text-align: right; }
  .rma-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #555; }
  .rma-number { font-size: 28px; font-weight: 900; letter-spacing: 0.05em; border: 2px solid #000; padding: 2px 10px; display: inline-block; margin: 4px 0; }
  .rma-date { font-size: 10px; color: #333; }

  /* TÍTULO DOCUMENTO */
  .doc-title {
    text-align: center;
    font-size: 11px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.2em;
    border: 1px solid #000;
    padding: 5px;
    margin-bottom: 14px;
  }

  /* SECCIONES */
  .section {
    border: 1px solid #000;
    border-radius: 4px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .section-title {
    background: #000;
    color: white;
    font-size: 8px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.15em;
    padding: 4px 10px;
  }
  .section-body { padding: 10px; }

  /* GRID 2 COLUMNAS */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }

  /* CAMPOS */
  .field { margin-bottom: 6px; }
  .field-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 2px; }
  .field-value { font-size: 12px; font-weight: 700; border-bottom: 1px solid #aaa; padding-bottom: 2px; min-height: 18px; }
  .field-value-big { font-size: 14px; font-weight: 900; text-transform: uppercase; }

  /* AVERÍA */
  .fault-text {
    font-size: 11px; line-height: 1.7;
    border: 1px dashed #666;
    padding: 8px;
    border-radius: 4px;
    min-height: 40px;
  }

  /* FIRMA */
  .sig-area {
    border: 1px solid #000;
    border-radius: 4px;
    padding: 10px;
    margin-bottom: 10px;
  }
  .sig-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 6px; }
  .sig-img { height: 70px; max-width: 300px; object-fit: contain; display: block; }
  .sig-line { border-top: 1px solid #aaa; margin-top: 10px; padding-top: 4px; font-size: 9px; color: #666; }
  .sig-empty { height: 50px; border-bottom: 1px solid #000; margin-bottom: 4px; }

  /* CONDICIONES */
  .conditions {
    border: 1px solid #aaa;
    border-radius: 4px;
    padding: 8px 10px;
    margin-bottom: 10px;
    background: #f9f9f9;
  }
  .conditions-title { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; }
  .conditions-text { font-size: 9px; color: #333; line-height: 1.8; }

  /* ESTADO */
  .status-badge {
    display: inline-block;
    border: 2px solid #000;
    padding: 2px 10px;
    font-size: 10px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.1em;
    border-radius: 3px;
    margin-top: 4px;
  }

  /* PIE */
  .footer {
    border-top: 2px solid #000;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 9px; color: #555;
  }
</style>
</head>
<body>

  <!-- CABECERA -->
  <div class="header">
    <div style="display:flex; align-items:center; gap:12px;">
      ${settings.logoUrl
        ? `<img src="${settings.logoUrl}" class="shop-logo" alt="Logo">`
        : `<div style="width:56px;height:56px;border:2px solid #000;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:26px;">🔧</div>`
      }
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
    <div class="rma-block">
      <div class="rma-label">Nº de Trabajo</div>
      <div class="rma-number">${rmaFormatted}</div>
      <div class="rma-date">📅 ${dateFormatted}</div>
    </div>
  </div>

  <!-- TÍTULO -->
  <div class="doc-title">■ Resguardo de Depósito de Equipo ■</div>

  <!-- CLIENTE + EQUIPO -->
  <div class="two-col">
    <div class="section">
      <div class="section-title">▶ Datos del Cliente</div>
      <div class="section-body">
        <div class="field">
          <div class="field-label">Nombre completo</div>
          <div class="field-value field-value-big">${repair.customerName}</div>
        </div>
        <div class="field">
          <div class="field-label">Teléfono de contacto</div>
          <div class="field-value">📞 ${repair.customerPhone}</div>
        </div>
        ${repair.technician ? `
        <div class="field">
          <div class="field-label">Técnico asignado</div>
          <div class="field-value">${repair.technician}</div>
        </div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">▶ Equipo Depositado</div>
      <div class="section-body">
        <div class="field">
          <div class="field-label">Marca y Modelo</div>
          <div class="field-value field-value-big">${repair.brand} ${repair.model}</div>
        </div>
        <div class="field">
          <div class="field-label">Tipo de equipo</div>
          <div class="field-value">${repair.deviceType}</div>
        </div>
        ${repair.serialNumber ? `
        <div class="field">
          <div class="field-label">Número de Serie / IMEI</div>
          <div class="field-value">${repair.serialNumber}</div>
        </div>` : ''}
        <div class="field">
          <div class="field-label">Estado al ingreso</div>
          <div class="status-badge">${repair.status}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- AVERÍA -->
  <div class="section">
    <div class="section-title">▶ Avería / Síntomas Declarados por el Cliente</div>
    <div class="section-body">
      <div class="fault-text">${repair.problemDescription}</div>
    </div>
  </div>

  <!-- FIRMA -->
  <div class="sig-area">
    <div class="sig-label">✍ Firma del Cliente — Conforme con el depósito del equipo</div>
    ${repair.customerSignature
      ? `<img src="${repair.customerSignature}" class="sig-img" alt="Firma del cliente">`
      : `<div class="sig-empty"></div><div style="font-size:9px;color:#aaa;">Firma del cliente</div>`
    }
    <div class="sig-line">
      El abajo firmante declara haber entregado voluntariamente el equipo descrito para su diagnóstico y/o reparación,
      y acepta las condiciones del servicio indicadas a continuación.
    </div>
  </div>

  <!-- CONDICIONES -->
  <div class="conditions">
    <div class="conditions-title">📋 Condiciones del Servicio</div>
    <div class="conditions-text">
      ${settings.letterhead || 'Garantía de 3 meses en mano de obra. Validez del presupuesto: 15 días.'}
      Los equipos no retirados en un plazo de <strong>90 días</strong> desde la notificación de finalización podrán considerarse abandonados.
      El taller no se responsabiliza de daños preexistentes no declarados. Los presupuestos requieren autorización expresa del cliente antes de proceder.
    </div>
  </div>

  <!-- PIE -->
  <div class="footer">
    <span>Conserve este resguardo para retirar su equipo · ${settings.appName}</span>
    <span>Documento generado por ReparaPro Master</span>
  </div>

</body>
</html>`;

  const openPrintWindow = () => {
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (!win) return;
    win.document.write(printHTML);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-start justify-center p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl my-8">

        {/* Barra de acciones */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Resguardo del Cliente</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{rmaFormatted} · {dateFormatted}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openPrintWindow} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">
              <Printer size={16} /> Imprimir
            </button>
            <button onClick={openPrintWindow} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all">
              <Download size={16} /> PDF
            </button>
            <button onClick={onClose} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Firma del cliente */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">✍️ Firma del cliente antes de imprimir</p>
          <SignaturePad onSave={onSignatureUpdate} initialValue={repair.customerSignature} height="h-32" />
        </div>

        {/* Vista previa del documento */}
        <div className="p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Vista previa</p>
          <div className="border-2 border-slate-200 rounded-xl p-6 bg-white text-sm" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>

            {/* Preview cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '16px', textTransform: 'uppercase' }}>{settings.appName}</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>{settings.phone} · {settings.address}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nº de Trabajo</div>
                <div style={{ fontSize: '20px', fontWeight: 900, border: '2px solid #000', padding: '1px 8px', display: 'inline-block', marginTop: '3px' }}>{rmaFormatted}</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>{dateFormatted}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', border: '1px solid #000', padding: '4px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>
              ■ Resguardo de Depósito de Equipo ■
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={{ border: '1px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: '#000', color: 'white', fontSize: '8px', fontWeight: 800, padding: '3px 8px', textTransform: 'uppercase' }}>▶ Cliente</div>
                <div style={{ padding: '8px' }}>
                  <div style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase' }}>{repair.customerName}</div>
                  <div style={{ fontSize: '10px', color: '#333', marginTop: '3px' }}>{repair.customerPhone}</div>
                </div>
              </div>
              <div style={{ border: '1px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: '#000', color: 'white', fontSize: '8px', fontWeight: 800, padding: '3px 8px', textTransform: 'uppercase' }}>▶ Equipo</div>
                <div style={{ padding: '8px' }}>
                  <div style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase' }}>{repair.brand} {repair.model}</div>
                  <div style={{ fontSize: '10px', color: '#333', marginTop: '3px' }}>{repair.deviceType}</div>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid #000', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ background: '#000', color: 'white', fontSize: '8px', fontWeight: 800, padding: '3px 8px', textTransform: 'uppercase' }}>▶ Avería declarada</div>
              <div style={{ padding: '8px', fontSize: '11px', borderStyle: 'dashed', borderColor: '#aaa' }}>{repair.problemDescription}</div>
            </div>

            {repair.customerSignature && (
              <div style={{ border: '1px solid #999', borderRadius: '4px', padding: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>✍ Firma del cliente</div>
                <img src={repair.customerSignature} alt="Firma" style={{ height: '45px', objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ border: '1px solid #aaa', borderRadius: '4px', padding: '8px', background: '#f9f9f9', marginBottom: '8px' }}>
              <div style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>📋 Condiciones</div>
              <div style={{ fontSize: '9px', color: '#444', lineHeight: 1.7 }}>{settings.letterhead || 'Garantía de 3 meses en mano de obra.'}</div>
            </div>

            <div style={{ borderTop: '2px solid #000', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
              <span>Conserve este resguardo · {settings.appName}</span>
              <span>ReparaPro Master</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomerReceipt;
