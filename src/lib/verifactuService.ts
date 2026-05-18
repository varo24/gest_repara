import CryptoJS from 'crypto-js';
import QRCode from 'qrcode';
import { FullInvoice, AppSettings } from '../types';
import { localDB } from './dataService';

// Genera la huella SHA-256 encadenada con la factura anterior
export const generarHuella = (
  invoice: FullInvoice,
  settings: AppSettings,
  huellaAnterior = '0',
): string => {
  const createdAtUTC = invoice.createdAt
    ? new Date(invoice.createdAt).toISOString()
    : '';
  const data = [
    settings.verifactuNIF || settings.taxId || '',
    invoice.invoiceNumber,
    invoice.date,
    invoice.customerName,
    (invoice.total || 0).toFixed(2),
    createdAtUTC,
    huellaAnterior,
  ].join('|');
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex).toUpperCase();
};

// Genera la URL de verificación AEAT (para texto y QR)
export const generarQRVerificacion = (invoice: FullInvoice, settings: AppSettings): string => {
  const params = new URLSearchParams({
    nif:      settings.verifactuNIF || settings.taxId || '',
    numserie: invoice.invoiceNumber,
    fecha:    invoice.date,
    importe:  (invoice.total || 0).toFixed(2),
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${params.toString()}`;
};

// Genera un QR como data URL base64 (sin dependencia de red)
export const generarQRDataUrl = async (contenido: string): Promise<string> => {
  return QRCode.toDataURL(contenido, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
};

// Genera el XML del registro de factura (formato AEAT)
export const generarXMLFactura = (invoice: FullInvoice, settings: AppSettings): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<RegistroFactura>
  <IDVersion>1.0</IDVersion>
  <IDFactura>
    <IDEmisorFactura>${settings.verifactuNIF || settings.taxId || ''}</IDEmisorFactura>
    <NumSerieFactura>${invoice.invoiceNumber}</NumSerieFactura>
    <FechaExpedicionFactura>${invoice.date}</FechaExpedicionFactura>
  </IDFactura>
  <NombreRazonSocial>${settings.appName}</NombreRazonSocial>
  <TipoFactura>${invoice.isRectificativa ? 'R1' : 'F1'}</TipoFactura>
  <CuotaTotal>${(invoice.total || 0).toFixed(2)}</CuotaTotal>
  <ImporteTotal>${(invoice.total || 0).toFixed(2)}</ImporteTotal>
  <Huella>${invoice.verifactu?.huella || ''}</Huella>
  <FechaHoraHusoGenRegistro>${invoice.createdAt}</FechaHoraHusoGenRegistro>
  <TipoHuella>SHA-256</TipoHuella>
  <Verifactu>S</Verifactu>
</RegistroFactura>`;
};

// ENVÍO A AEAT — DESACTIVADO hasta julio 2027
export const enviarFacturaAEAT = async (
  _invoice: FullInvoice,
  _settings: AppSettings,
): Promise<{ ok: boolean; respuesta?: string; error?: string }> => {
  // TODO: Activar cuando VeriFactu sea obligatorio (julio 2027 autónomos)
  // URL producción: https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSistemaFacturacion
  // URL pruebas: https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSistemaFacturacion
  return { ok: false, error: 'VeriFactu no activado todavía' };
};

// Prepara una factura con datos VeriFactu (huella encadenada + QR local) sin enviar
export const prepararFacturaVeriFactu = async (
  invoice: FullInvoice,
  settings: AppSettings,
): Promise<FullInvoice> => {
  if (!settings.verifactuEnabled) return invoice;

  // Encadenamiento: buscar la huella de la última factura VeriFactu (por fecha de creación)
  const allInvoices = localDB.getAll('invoices') as FullInvoice[];
  const sorted = allInvoices
    .filter(inv => inv.verifactu?.huella && inv.id !== invoice.id)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const huellaAnterior = sorted[0]?.verifactu?.huella ?? '0';

  const huella = generarHuella(invoice, settings, huellaAnterior);
  const aeatUrl = generarQRVerificacion(invoice, settings);
  const qrUrl = await generarQRDataUrl(aeatUrl);

  return {
    ...invoice,
    verifactu: {
      enabled:         true,
      huella,
      huellaAnterior,
      fechaHuella:     new Date().toISOString(),
      tipoHuella:      'SHA-256',
      numSerieFactura: invoice.invoiceNumber,
      fechaExpedicion: invoice.date,
      enviado:         false,
      qrUrl,
    },
    // Marcar como pendiente de envío (el envío se activará en julio 2027)
    verifactu_pendiente_envio: true,
  };
};
