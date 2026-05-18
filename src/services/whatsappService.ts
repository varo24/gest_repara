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
  const mode = ((import.meta.env.VITE_WA_MODE as string | undefined) || 'web') as 'api' | 'web';
  return {
    mode,
    phoneNumberId: import.meta.env.VITE_WA_PHONE_NUMBER_ID as string | undefined,
    accessToken: import.meta.env.VITE_WA_ACCESS_TOKEN as string | undefined,
    fromPhone: import.meta.env.VITE_WA_FROM_PHONE as string | undefined,
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

  // Detalle de piezas/materiales
  let detailLines = '';
  if (budget.items && budget.items.length > 0) {
    detailLines += '\n🔧 *Trabajos y materiales:*\n';
    for (const item of budget.items) {
      const lineTotal = (item.quantity * item.unitPrice).toFixed(2);
      detailLines += `  • ${item.description}${item.quantity > 1 ? ` (x${item.quantity})` : ''} — ${lineTotal}€\n`;
    }
  }

  // Detalle de mano de obra
  if (budget.laborItems && budget.laborItems.length > 0) {
    detailLines += '\n👨‍🔧 *Mano de obra:*\n';
    for (const labor of budget.laborItems) {
      const lineTotal = (labor.hours * labor.hourlyRate).toFixed(2);
      detailLines += `  • ${labor.description} (${labor.hours}h) — ${lineTotal}€\n`;
    }
  }

  // Base imponible
  const subtotal = (budget.total / (1 + budget.taxRate / 100)).toFixed(2);
  const iva = (budget.total - parseFloat(subtotal)).toFixed(2);

  return `💰 *Presupuesto de reparación - ${settings.appName}*

Hola *${repair.customerName}*, hemos completado el diagnóstico de tu equipo.

📋 *Número de trabajo:* ${rma}
📱 *Equipo:* ${repair.brand} ${repair.model}
${detailLines}
💶 *Base imponible:* ${subtotal}€
💶 *IVA (${budget.taxRate}%):* ${iva}€
💶 *TOTAL: ${total}€*
⏳ *Validez del presupuesto:* 15 días

${budgetUrl ? `🔗 Ver presupuesto detallado:\n${budgetUrl}\n` : ''}Por favor, confirma si deseas proceder con la reparación respondiendo *SÍ* o *NO*.

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
// ENVÍO VÍA WHATSAPP — app nativa con fallback a wa.me
// ============================================================

const sendViaWeb = (phone: string, message: string): void => {
  const cleanedPhone = cleanPhone(phone);
  const encoded = encodeURIComponent(message);
  const nativeUrl = `whatsapp://send?phone=${cleanedPhone}&text=${encoded}`;
  const webUrl    = `https://wa.me/${cleanedPhone}?text=${encoded}`;

  // Disparar el protocolo nativo (WhatsApp Desktop en PC, WhatsApp en móvil)
  // usando <a> click para no navegar fuera de la SPA.
  const a = document.createElement('a');
  a.href = nativeUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Fallback: si tras 1.5s la página sigue en primer plano (la app no se abrió),
  // abrimos WhatsApp Web como red de seguridad.
  const fallback = setTimeout(() => window.open(webUrl, '_blank'), 1500);
  const cancel = () => clearTimeout(fallback);
  window.addEventListener('blur', cancel, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel();
  }, { once: true });
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

export const buildFirmaMessage = (
  budget: Budget,
  repair: RepairItem | null,
  firmaUrl: string,
  settings: AppSettings,
): string => {
  const customerName = repair?.customerName || budget.customerName || 'Cliente';
  const rmaLabel = repair
    ? `RMA-${String(repair.rmaNumber).padStart(5, '0')}`
    : 'Presupuesto libre';

  const deviceLine = repair
    ? `📱 *Equipo:* ${[repair.deviceType, repair.brand, repair.model].filter(Boolean).join(' ')}`
    : '';

  let detailLines = '';
  if (budget.items?.length) {
    for (const item of budget.items) {
      const lineTotal = (item.quantity * item.unitPrice).toFixed(2);
      detailLines += `  • ${item.description}${item.quantity > 1 ? ` (x${item.quantity})` : ''}: ${lineTotal}€\n`;
    }
  }
  if (budget.laborItems?.length) {
    for (const labor of budget.laborItems) {
      const lineTotal = (labor.hours * labor.hourlyRate).toFixed(2);
      detailLines += `  • ${labor.description} (${labor.hours}h): ${lineTotal}€\n`;
    }
  }

  const effectiveTax = budget.taxEnabled === false ? 0 : (budget.taxRate ?? 21);
  const subtotal = effectiveTax > 0
    ? budget.total / (1 + effectiveTax / 100)
    : budget.total;
  const taxAmount = budget.total - subtotal;

  const totalsBlock = effectiveTax > 0
    ? `💰 *Base imponible:* ${subtotal.toFixed(2)}€
💰 *IVA (${effectiveTax}%):* ${taxAmount.toFixed(2)}€
💰 *TOTAL: ${budget.total.toFixed(2)}€*`
    : `💰 *TOTAL: ${budget.total.toFixed(2)}€* (sin IVA)`;

  return `Estimado/a *${customerName}*,

Le informamos que hemos realizado el diagnóstico de su equipo y le enviamos el presupuesto para proceder con la reparación.

🔧 *Número de trabajo:* ${rmaLabel}
${deviceLine ? `${deviceLine}\n` : ''}
📋 *Detalle del presupuesto:*
${detailLines}
${totalsBlock}

⏳ Validez del presupuesto: 15 días

Para *AUTORIZAR* la reparación, firme digitalmente aquí:
👉 ${firmaUrl}

Si tiene alguna pregunta, no dude en contactarnos.

*${settings.appName}*
${settings.phone || ''}`;
};

export const notifyReception = (repair: RepairItem, settings: AppSettings) =>
  sendWhatsApp(repair.customerPhone, buildReceptionMessage(repair, settings));

export const notifyBudget = (repair: RepairItem, budget: Budget, settings: AppSettings, url?: string) =>
  sendWhatsApp(repair.customerPhone, buildBudgetMessage(repair, budget, settings, url));

export const notifyReady = (repair: RepairItem, settings: AppSettings) =>
  sendWhatsApp(repair.customerPhone, buildReadyMessage(repair, settings));

export const notifyCancelled = (repair: RepairItem, settings: AppSettings) =>
  sendWhatsApp(repair.customerPhone, buildCancelledMessage(repair, settings));
