import { RepairItem, Budget, AppSettings } from '../types';

// ============================================================
// ReparaPro - Servicio WhatsApp Business
// Soporta dos modos:
//   1. WhatsApp Business API (Meta Cloud API) — requiere cuenta verificada
//   2. WhatsApp Web (wa.me) — funciona sin cuenta de empresa
// ============================================================

export interface WhatsAppConfig {
  mode: 'api' | 'web';
  phoneNumberId?: string;   // ID del número en Meta Business (modo api)
  accessToken?: string;     // Token de acceso permanente (modo api)
  fromPhone?: string;       // Número del taller con código de país (ej: 34612345678)
}

const getConfig = (): WhatsAppConfig => {
  const mode = (process.env.VITE_WA_MODE || 'web') as 'api' | 'web';
  return {
    mode,
    phoneNumberId: process.env.VITE_WA_PHONE_NUMBER_ID,
    accessToken: process.env.VITE_WA_ACCESS_TOKEN,
    fromPhone: process.env.VITE_WA_FROM_PHONE,
  };
};

// Limpiar número de teléfono (solo dígitos, con código de país)
const cleanPhone = (phone: string, countryCode = '34'): string => {
  const digits = phone.replace(/\D/g, '');
  // Si ya tiene código de país (empieza por 34, 1, etc.)
  if (digits.length > 9) return digits;
  return countryCode + digits;
};

// ============================================================
// PLANTILLAS DE MENSAJES
// ============================================================

export const buildReceptionMessage = (repair: RepairItem, settings: AppSettings): string => {
  const rma = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  return `✅ *Confirmación de recepción - ${settings.appName}*

Hola *${repair.customerName}*, hemos recibido tu equipo correctamente.

📋 *Número de trabajo:* ${rma}
📱 *Equipo:* ${repair.brand} ${repair.model}
🔧 *Avería reportada:* ${repair.problemDescription}
📅 *Fecha de entrada:* ${new Date(repair.entryDate).toLocaleDateString('es-ES')}

Te avisaremos en cuanto tengamos el diagnóstico.

_${settings.appName} · ${settings.phone || ''}_`;
};

export const buildBudgetMessage = (repair: RepairItem, budget: Budget, settings: AppSettings, budgetUrl?: string): string => {
  const rma = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  const total = budget.total.toFixed(2);
  return `💰 *Presupuesto de reparación - ${settings.appName}*

Hola *${repair.customerName}*, hemos completado el diagnóstico de tu equipo.

📋 *Número de trabajo:* ${rma}
📱 *Equipo:* ${repair.brand} ${repair.model}
💶 *Importe total: ${total}€*
⏳ *Validez del presupuesto:* 15 días

${budgetUrl ? `🔗 Ver presupuesto detallado:\n${budgetUrl}\n` : ''}
Por favor, confirma si deseas proceder con la reparación respondiendo *SÍ* o *NO*.

_${settings.appName} · ${settings.phone || ''}_`;
};

export const buildReadyMessage = (repair: RepairItem, settings: AppSettings): string => {
  const rma = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  return `🎉 *¡Tu equipo está listo! - ${settings.appName}*

Hola *${repair.customerName}*, nos complace informarte de que tu reparación ha finalizado con éxito.

📋 *Número de trabajo:* ${rma}
📱 *Equipo:* ${repair.brand} ${repair.model}
✅ *Estado:* Listo para retirar

📍 *Dirección:* ${settings.address || ''}
📞 *Teléfono:* ${settings.phone || ''}
🕐 *Horario:* Consultar con el taller

Recuerda traer este mensaje o el resguardo de depósito para retirar tu equipo.

_${settings.appName}_`;
};

export const buildCancelledMessage = (repair: RepairItem, settings: AppSettings): string => {
  const rma = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;
  return `ℹ️ *Aviso sobre tu reparación - ${settings.appName}*

Hola *${repair.customerName}*, te informamos sobre el estado de tu equipo.

📋 *Número de trabajo:* ${rma}
📱 *Equipo:* ${repair.brand} ${repair.model}
❌ *Estado:* Reparación no realizada

Tu equipo está disponible para ser retirado en nuestras instalaciones. Si tienes alguna pregunta, no dudes en contactarnos.

📞 *Teléfono:* ${settings.phone || ''}

_${settings.appName}_`;
};

// ============================================================
// ENVÍO VÍA WHATSAPP WEB (wa.me) — sin configuración previa
// ============================================================

const sendViaWeb = (phone: string, message: string): void => {
  const cleanedPhone = cleanPhone(phone);
  const encoded = encodeURIComponent(message);
  // Use whatsapp:// protocol to open native app instead of web browser
  window.open(`whatsapp://send?phone=${cleanedPhone}&text=${encoded}`, '_self');
};

// ============================================================
// ENVÍO VÍA WHATSAPP BUSINESS API (Meta Cloud API)
// ============================================================

const sendViaAPI = async (phone: string, message: string, config: WhatsAppConfig): Promise<boolean> => {
  if (!config.phoneNumberId || !config.accessToken) {
    console.warn('WhatsApp API: faltan credenciales. Usando WhatsApp Web como fallback.');
    sendViaWeb(phone, message);
    return false;
  }

  try {
    const cleanedPhone = cleanPhone(phone);
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanedPhone,
          type: 'text',
          text: { body: message }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp API error:', error);
      // Fallback a WhatsApp Web si la API falla
      sendViaWeb(phone, message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('WhatsApp API error:', err);
    sendViaWeb(phone, message);
    return false;
  }
};

// ============================================================
// FUNCIÓN PRINCIPAL DE ENVÍO
// ============================================================

export const sendWhatsApp = async (
  phone: string,
  message: string
): Promise<{ success: boolean; method: 'api' | 'web' }> => {
  const config = getConfig();

  if (config.mode === 'api' && config.phoneNumberId && config.accessToken) {
    const ok = await sendViaAPI(phone, message, config);
    return { success: ok, method: 'api' };
  } else {
    sendViaWeb(phone, message);
    return { success: true, method: 'web' };
  }
};

// ============================================================
// HELPERS ESPECÍFICOS POR TIPO DE NOTIFICACIÓN
// ============================================================

export const notifyReception = (repair: RepairItem, settings: AppSettings) =>
  sendWhatsApp(repair.customerPhone, buildReceptionMessage(repair, settings));

export const notifyBudget = (repair: RepairItem, budget: Budget, settings: AppSettings, url?: string) =>
  sendWhatsApp(repair.customerPhone, buildBudgetMessage(repair, budget, settings, url));

export const notifyReady = (repair: RepairItem, settings: AppSettings) =>
  sendWhatsApp(repair.customerPhone, buildReadyMessage(repair, settings));

export const notifyCancelled = (repair: RepairItem, settings: AppSettings) =>
  sendWhatsApp(repair.customerPhone, buildCancelledMessage(repair, settings));
