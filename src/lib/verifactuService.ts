import CryptoJS from 'crypto-js';
import { FullInvoice, AppSettings } from '../types';

// Genera la huella SHA-256 del registro de factura
export const generarHuella = (invoice: FullInvoice, settings: AppSettings): string => {
  // Normalize createdAt to UTC ISO to guarantee the same hash across devices/timezones.
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
  ].join('|');
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex).toUpperCase();
};

// Genera el QR de verificación AEAT
export const generarQRVerificacion = (invoice: FullInvoice, settings: AppSettings): string => {
  const params = new URLSearchParams({
    nif:      settings.verifactuNIF || settings.taxId || '',
    numserie: invoice.invoiceNumber,
    fecha:    invoice.date,
    importe:  (invoice.total || 0).toFixed(2),
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${params.toString()}`;
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
  console.warn('[VeriFactu] Envío desactivado hasta julio 2027');
  return { ok: false, error: 'VeriFactu no activado todavía' };
};

// Prepara una factura con datos VeriFactu (huella + QR) sin enviar
export const prepararFacturaVeriFactu = (
  invoice: FullInvoice,
  settings: AppSettings,
): FullInvoice => {
  if (!settings.verifactuEnabled) return invoice;

  const huella = generarHuella(invoice, settings);
  const qrUrl  = generarQRVerificacion(invoice, settings);

  return {
    ...invoice,
    verifactu: {
      enabled:          true,
      huella,
      fechaHuella:      new Date().toISOString(),
      tipoHuella:       'SHA-256',
      numSerieFactura:  invoice.invoiceNumber,
      fechaExpedicion:  invoice.date,
      enviado:          false,
      qrUrl,
    },
  };
};
