import { Cita, AppSettings } from '../types';

const STORAGE_KEY = 'gestrepara_reminder_date';

export function getReminderDate(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setReminderDate(date: string): void {
  try { localStorage.setItem(STORAGE_KEY, date); } catch {}
}

export function shouldShowReminders(settings: AppSettings): boolean {
  if (!settings.whatsappRemindersEnabled) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (getReminderDate() === today) return false;
  const hour = settings.whatsappReminderHour ?? 17;
  return new Date().getHours() >= hour;
}

export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function getCitasPendingReminder(citas: Cita[]): Cita[] {
  const manana = tomorrowStr();
  return citas.filter(c =>
    c.fecha === manana &&
    (c.estado === 'pendiente' || c.estado === 'confirmada') &&
    !c.recordatorioEnviado &&
    !!c.clientePhone,
  );
}

const DEFAULT_TEMPLATE =
  'Hola {nombre}, te recordamos tu cita mañana {fecha} a las {hora} en {taller}. ' +
  'Para cancelar o cambiar hora llámanos al {telefono}.';

export function buildReminderMessage(cita: Cita, settings: AppSettings): string {
  const template = settings.whatsappReminderMessage || DEFAULT_TEMPLATE;
  const fecha = new Date(cita.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return template
    .replace(/{nombre}/g,   cita.clienteName || 'cliente')
    .replace(/{fecha}/g,    fecha)
    .replace(/{hora}/g,     cita.horaInicio)
    .replace(/{taller}/g,   settings.appName)
    .replace(/{telefono}/g, settings.phone || '');
}

export function openWhatsAppReminder(cita: Cita, settings: AppSettings): void {
  const raw    = cita.clientePhone!.replace(/\D/g, '');
  const phone  = raw.length > 9 ? raw : '34' + raw;
  const text   = encodeURIComponent(buildReminderMessage(cita, settings));
  window.open(`whatsapp://send?phone=${phone}&text=${text}`, '_blank');
}
