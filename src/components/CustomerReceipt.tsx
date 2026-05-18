import React, { useState } from 'react';
import { Printer, Download, X, Loader2, CheckCircle2 } from 'lucide-react';
import { RepairItem, AppSettings } from '../types';
import SignaturePad from './SignaturePad';
import { uploadSignature } from '../lib/storageService';
import { logError } from '../lib/errorLogger';

interface CustomerReceiptProps {
  repair: RepairItem;
  settings: AppSettings;
  onClose: () => void;
  onSignatureUpdate: (sig: string) => void;
  onFirmaUploaded?: (url: string, date: string) => void;
}

const EST_LABELS: Record<string, Record<string, string>> = {
  pantalla: { perfecto: 'Perfecto ✓', rayado: 'Rayado', roto: 'Roto ⚠', na: 'N/A' },
  carcasa:  { perfecto: 'Perfecto ✓', rayado: 'Rayado', golpes: 'Golpes', roto: 'Roto ⚠' },
  botones:  { perfecto: 'Perfecto ✓', 'fallo-parcial': 'Fallo parcial', 'no-funciona': 'No funciona ⚠' },
  puertos:  { perfecto: 'Perfecto ✓', 'dano-visible': 'Daño visible', 'no-funciona': 'No funciona ⚠' },
};

const CustomerReceipt: React.FC<CustomerReceiptProps> = ({
  repair, settings, onClose, onSignatureUpdate, onFirmaUploaded,
}) => {
  const rmaFormatted  = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  const dateFormatted = new Date(repair.entryDate).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const fechaSola = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const fechaLugar = settings.city ? `${settings.city}, ${fechaSola}` : fechaSola;

  const [sigBase64, setSigBase64]       = useState(repair.customerSignature || '');
  const [uploadingFirma, setUploadingFirma] = useState(false);
  const [firmaGuardada, setFirmaGuardada]   = useState(!!repair.firmaClienteUrl);

  const handleSignatureUpdate = (sig: string) => {
    setSigBase64(sig);
    onSignatureUpdate(sig);
    setFirmaGuardada(false);
  };

  const handleUploadFirma = async () => {
    if (!sigBase64) return;
    setUploadingFirma(true);
    try {
      const url = await uploadSignature(repair.id, sigBase64);
      const date = new Date().toISOString();
      onFirmaUploaded?.(url, date);
      setFirmaGuardada(true);
    } catch (e) {
      console.error('Firma upload error:', e);
      logError('uncaught', e instanceof Error ? e : new Error(String(e)));
    } finally {
      setUploadingFirma(false);
    }
  };

  // ── Estado estético HTML section ──
  const est = repair.estadoEstetico;
  const estéticoHTML = est ? `
  <div class="section" style="margin-bottom:10px">
    <div class="section-title">▶ Estado Estético al Ingreso</div>
    <div class="section-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
        <div class="field"><div class="field-label">Pantalla</div><div class="field-value">${EST_LABELS.pantalla[est.pantalla] || est.pantalla}</div></div>
        <div class="field"><div class="field-label">Carcasa</div><div class="field-value">${EST_LABELS.carcasa[est.carcasa] || est.carcasa}</div></div>
        <div class="field"><div class="field-label">Botones</div><div class="field-value">${EST_LABELS.botones[est.botones] || est.botones}</div></div>
        <div class="field"><div class="field-label">Puertos</div><div class="field-value">${EST_LABELS.puertos[est.puertos] || est.puertos}</div></div>
      </div>
      ${est.observaciones ? `<div class="field"><div class="field-label">Observaciones</div><div style="font-size:10px;font-weight:500;padding:4px 0">${est.observaciones}</div></div>` : ''}
      <div style="margin-top:6px;padding:5px 8px;background:#f5f5f5;border-radius:3px;font-size:8px;color:#555;line-height:1.6">
        ⚖️ El cliente confirma el estado estético descrito al entregar el equipo para su reparación.
      </div>
    </div>
  </div>` : '';

  // ── Fotos de entrada ──
  const fotosEntrada = (repair.photos || []).filter(p => p.tipo === 'entrada');
  const fotosHTML = fotosEntrada.length > 0 ? `
  <div class="section" style="margin-bottom:10px">
    <div class="section-title">▶ Fotos de Entrada (${fotosEntrada.length})</div>
    <div class="section-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${fotosEntrada.slice(0, 6).map(f => `
          <div style="text-align:center">
            <img src="${f.url}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd" alt="Foto entrada"/>
            ${f.caption ? `<div style="font-size:7px;color:#666;margin-top:2px;max-width:80px">${f.caption}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>
  </div>` : '';

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
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #000; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .shop-info { font-size: 10px; color: #333; margin-top: 4px; line-height: 1.8; }
  .rma-block { text-align: right; }
  .rma-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #555; }
  .rma-number { font-size: 28px; font-weight: 900; letter-spacing: 0.05em; border: 2px solid #000; padding: 2px 10px; display: inline-block; margin: 4px 0; }
  .rma-date { font-size: 10px; color: #333; }
  .doc-title { text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; border: 1px solid #000; padding: 5px; margin-bottom: 14px; }
  .section { border: 1px solid #000; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
  .section-title { background: #000; color: white; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; padding: 4px 10px; }
  .section-body { padding: 10px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .field { margin-bottom: 6px; }
  .field-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 2px; }
  .field-value { font-size: 12px; font-weight: 700; border-bottom: 1px solid #aaa; padding-bottom: 2px; min-height: 18px; }
  .field-value-big { font-size: 14px; font-weight: 900; text-transform: uppercase; }
  .fault-text { font-size: 11px; line-height: 1.7; border: 1px dashed #666; padding: 8px; border-radius: 4px; min-height: 40px; }
  .sig-area { border: 1px solid #000; border-radius: 4px; padding: 10px; margin-bottom: 10px; }
  .sig-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 6px; }
  .sig-img { height: 70px; max-width: 300px; object-fit: contain; display: block; }
  .sig-line { border-top: 1px solid #aaa; margin-top: 10px; padding-top: 4px; font-size: 9px; color: #666; }
  .sig-empty { height: 50px; border-bottom: 1px solid #000; margin-bottom: 4px; }
  .conditions { border: 1px solid #aaa; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; background: #f9f9f9; }
  .conditions-title { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; }
  .conditions-text { font-size: 9px; color: #333; line-height: 1.8; }
  .status-badge { display: inline-block; border: 2px solid #000; padding: 2px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 3px; margin-top: 4px; }
  .footer { border-top: 2px solid #000; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #555; }
  .rgpd { border: 1px solid #aaa; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; background: #f0f4f8; }
  .rgpd-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color: #1e3a5f; margin-bottom: 5px; }
  .rgpd-text { font-size: 8.5px; color: #333; line-height: 1.75; margin-bottom: 8px; }
  .rgpd-consent-row { display: flex; align-items: flex-start; gap: 7px; font-size: 9px; font-weight: 700; color: #111; margin-bottom: 8px; }
  .rgpd-checkbox { width: 13px; height: 13px; border: 1.5px solid #000; border-radius: 2px; flex-shrink: 0; margin-top: 1px; }
  .rgpd-sig { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
  .rgpd-sig-col { text-align: center; }
  .rgpd-sig-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 5px; }
  .rgpd-sig-empty { height: 35px; border-bottom: 1px solid #000; }
</style>
</head>
<body>

  <!-- CABECERA -->
  <div class="header">
    <div style="display:flex; align-items:center; gap:12px;">
      ${settings.logoUrl
        ? `<img src="${settings.logoUrl}" style="width:56px;height:56px;border:2px solid #000;border-radius:6px;object-fit:contain;padding:3px" alt="Logo">`
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
        ${repair.technician ? `<div class="field"><div class="field-label">Técnico asignado</div><div class="field-value">${repair.technician}</div></div>` : ''}
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
        ${repair.serialNumber ? `<div class="field"><div class="field-label">Número de Serie / IMEI</div><div class="field-value">${repair.serialNumber}</div></div>` : ''}
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

  <!-- ESTADO ESTÉTICO -->
  ${estéticoHTML}

  <!-- FOTOS ENTRADA -->
  ${fotosHTML}

  <!-- FIRMA -->
  <div class="sig-area">
    <div class="sig-label">✍ Firma del Cliente — Conforme con el depósito del equipo</div>
    ${repair.firmaClienteUrl
      ? `<img src="${repair.firmaClienteUrl}" class="sig-img" alt="Firma digital del cliente" style="border:1px solid #ddd;border-radius:3px;padding:4px"><div style="font-size:8px;color:#555;margin-top:4px">Firmado digitalmente el ${new Date(repair.firmaClienteDate || repair.entryDate).toLocaleDateString('es-ES')}</div>`
      : repair.customerSignature
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
      ${settings.letterhead || `Garantía de ${settings.warrantyMonths ?? 3} meses en mano de obra. Validez del presupuesto: 15 días.`}
      Los equipos no retirados en un plazo de <strong>90 días</strong> desde la notificación de finalización podrán considerarse abandonados.
      El taller no se responsabiliza de daños preexistentes no declarados. Los presupuestos requieren autorización expresa del cliente antes de proceder.
      <br><br><strong style="font-weight:800">Averías ocultas:</strong>
      Durante la inspección y reparación del equipo pueden detectarse averías ocultas no visibles en la revisión inicial.
      El taller se compromete a comunicar al cliente cualquier avería adicional en un plazo máximo de 48 horas para obtener su autorización previa.
      El cliente podrá aceptar o rechazar la ampliación del presupuesto sin coste adicional por la comunicación.
    </div>
  </div>

  <!-- RGPD -->
  <div class="rgpd">
    <div class="rgpd-title">🔒 Protección de Datos — RGPD / LOPDGDD</div>
    <div class="rgpd-text">
      De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD), le informamos que sus datos personales serán tratados por <strong>${settings.appName}</strong>${settings.taxId ? `, con CIF/NIF ${settings.taxId}` : ''},
      con la finalidad de gestionar la reparación de su equipo y la relación comercial. Sus datos no serán cedidos a terceros salvo obligación legal.
      Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a
      ${[settings.address, settings.email].filter(Boolean).length > 0 ? [settings.address, settings.email].filter(Boolean).join(' o ') : 'este establecimiento'}.
      Sus datos se conservarán durante el tiempo necesario para cumplir con las obligaciones legales y contractuales.
    </div>
    <div class="rgpd-consent-row">
      <div class="rgpd-checkbox">${(repair.firmaClienteUrl || sigBase64) ? '✓' : ''}</div>
      <span>La firma del cliente en este documento implica su consentimiento para el tratamiento de sus datos personales conforme al RGPD.</span>
    </div>
    <div class="rgpd-sig">
      <div class="rgpd-sig-col">
        <div class="rgpd-sig-label">Firma del cliente — Consentimiento RGPD</div>
        ${(repair.firmaClienteUrl || sigBase64)
          ? `<img src="${repair.firmaClienteUrl || sigBase64}" style="height:35px;max-width:100%;object-fit:contain;display:block;margin:0 auto">`
          : '<div class="rgpd-sig-empty"></div>'
        }
      </div>
      <div class="rgpd-sig-col">
        <div class="rgpd-sig-label">Fecha y lugar</div>
        <div style="height:35px;border-bottom:1px solid #000;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;font-size:9px;font-weight:700;color:#111">${fechaLugar}</div>
      </div>
    </div>
  </div>

  <!-- QR -->
  <div style="display:flex;align-items:center;gap:16px;border:1px solid #000;border-radius:4px;padding:8px 12px;margin-bottom:10px;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(rmaFormatted)}&color=000000&bgcolor=ffffff" width="80" height="80" alt="QR ${rmaFormatted}" style="flex-shrink:0" />
    <div>
      <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:#555;margin-bottom:4px;">Código QR de recogida</div>
      <div style="font-size:13px;font-weight:900;letter-spacing:2px;">${rmaFormatted}</div>
      <div style="font-size:9px;color:#333;margin-top:4px;">Muestre este código al recoger su equipo.<br>El técnico lo escaneará para acceder a su ficha.</div>
    </div>
  </div>

  <!-- PIE -->
  <div class="footer">
    <span>Conserve este resguardo para retirar su equipo · ${settings.appName}</span>
    <span>Generado el ${fechaSola}</span>
  </div>

</body>
</html>`;

  const openPrintWindow = () => {
    console.log('[Receipt] cláusula averías ocultas en HTML:', printHTML.includes('Averías ocultas'));
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (win) {
      win.document.write(printHTML);
      win.document.close();
      win.focus();
      setTimeout(() => { try { win.print(); } catch(e) {} }, 800);
      return;
    }
    const id = 'print-frame-receipt';
    let iframe = document.getElementById(id) as HTMLIFrameElement;
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(printHTML);
    doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch(e) {}
      setTimeout(() => iframe.remove(), 3000);
    }, 800);
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
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">✍️ Firma del cliente antes de imprimir</p>
          <SignaturePad onSave={handleSignatureUpdate} initialValue={repair.customerSignature} inline={true} inlineHeight={150} />
          {sigBase64 && onFirmaUploaded && (
            <button
              onClick={handleUploadFirma}
              disabled={uploadingFirma || firmaGuardada}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                firmaGuardada
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-900 text-white hover:bg-black disabled:opacity-60'
              }`}
            >
              {firmaGuardada
                ? <><CheckCircle2 size={14}/> Firma guardada en servidor</>
                : uploadingFirma
                  ? <><Loader2 size={14} className="animate-spin"/> Subiendo firma...</>
                  : <>☁️ Guardar Firma en Servidor</>
              }
            </button>
          )}
          {repair.firmaClienteUrl && (
            <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={12}/> Firma digital guardada · {new Date(repair.firmaClienteDate || repair.entryDate).toLocaleDateString('es-ES')}
            </p>
          )}
        </div>

        {/* Vista previa */}
        <div className="p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Vista previa</p>
          <div className="border-2 border-slate-200 rounded-xl p-6 bg-white text-sm" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
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

            <div style={{ textAlign: 'center', border: '1px solid #000', padding: '4px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>■ Resguardo de Depósito de Equipo ■</div>

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

            {/* Estado estético preview */}
            {est && (
              <div style={{ border: '1px solid #000', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ background: '#000', color: 'white', fontSize: '8px', fontWeight: 800, padding: '3px 8px', textTransform: 'uppercase' }}>▶ Estado Estético al Ingreso</div>
                <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {[['Pantalla', EST_LABELS.pantalla[est.pantalla]], ['Carcasa', EST_LABELS.carcasa[est.carcasa]], ['Botones', EST_LABELS.botones[est.botones]], ['Puertos', EST_LABELS.puertos[est.puertos]]].map(([lbl, val]) => (
                    <div key={lbl} style={{ fontSize: '9px' }}>
                      <span style={{ color: '#777', fontWeight: 700 }}>{lbl}: </span>
                      <span style={{ fontWeight: 800 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ border: '1px solid #000', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ background: '#000', color: 'white', fontSize: '8px', fontWeight: 800, padding: '3px 8px', textTransform: 'uppercase' }}>▶ Avería declarada</div>
              <div style={{ padding: '8px', fontSize: '11px' }}>{repair.problemDescription}</div>
            </div>

            {(repair.firmaClienteUrl || sigBase64) && (
              <div style={{ border: '1px solid #999', borderRadius: '4px', padding: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>✍ Firma del cliente</div>
                <img src={repair.firmaClienteUrl || sigBase64} alt="Firma" style={{ height: '45px', objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ border: '1px solid #aaa', borderRadius: '4px', padding: '8px', background: '#f9f9f9', marginBottom: '8px' }}>
              <div style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>📋 Condiciones</div>
              <div style={{ fontSize: '9px', color: '#444', lineHeight: 1.7 }}>
                {settings.letterhead || `Garantía de ${settings.warrantyMonths ?? 3} meses en mano de obra.`}
                {' '}<strong>Averías ocultas:</strong> Durante la inspección y reparación del equipo pueden detectarse averías ocultas no visibles en la revisión inicial. El taller se compromete a comunicar al cliente cualquier avería adicional en un plazo máximo de 48 horas para obtener su autorización previa. El cliente podrá aceptar o rechazar la ampliación del presupuesto sin coste adicional por la comunicación.
              </div>
            </div>

            <div style={{ border: '1px solid #aaa', borderRadius: '4px', padding: '8px', background: '#f0f4f8', marginBottom: '8px' }}>
              <div style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1e3a5f', marginBottom: '4px' }}>🔒 Protección de Datos — RGPD / LOPDGDD</div>
              <div style={{ fontSize: '8px', color: '#444', lineHeight: 1.7, marginBottom: '6px' }}>
                De conformidad con el RGPD y la LOPDGDD, sus datos serán tratados por <strong>{settings.appName}</strong>{settings.taxId ? ` (CIF ${settings.taxId})` : ''} para gestionar la reparación. Puede ejercer sus derechos en {settings.address || '[dirección]'}{settings.email ? ` o ${settings.email}` : ''}.
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '8px', fontWeight: 700, marginBottom: '6px' }}>
                <div style={{ width: '11px', height: '11px', border: '1.5px solid #000', borderRadius: '2px', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>{(repair.firmaClienteUrl || sigBase64) ? '✓' : ''}</div>
                <span>La firma del cliente en este documento implica su consentimiento para el tratamiento de sus datos personales conforme al RGPD.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: '4px' }}>Firma — Consentimiento RGPD</div>
                  {(repair.firmaClienteUrl || sigBase64)
                    ? <img src={repair.firmaClienteUrl || sigBase64} alt="Firma RGPD" style={{ height: '28px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                    : <div style={{ height: '28px', borderBottom: '1px solid #000' }}></div>
                  }
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: '4px' }}>Fecha y lugar</div>
                  <div style={{ height: '28px', borderBottom: '1px solid #000', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2px', fontSize: '8px', fontWeight: 700 }}>{fechaLugar}</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #000', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
              <span>Conserve este resguardo · {settings.appName}</span>
              <span>{settings.appName}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerReceipt;
