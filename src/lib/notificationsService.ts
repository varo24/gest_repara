import { Notificacion, Warranty, InventoryItem, Cita, RepairItem, Budget } from '../types';
import { workingDaysSince } from './budgetAlerts';

function stableId(tipo: string, titulo: string, mensaje: string): string {
  return `${tipo}:${titulo}:${mensaje}`.replace(/[^a-zA-Z0-9:]/g, '-').slice(0, 100);
}

export function generarNotificaciones(data: {
  garantias: Warranty[];
  inventory: InventoryItem[];
  citas: Cita[];
  repairs: RepairItem[];
  invoices: any[];
  budgets?: Budget[];
  budgetFollowUpDays?: number;
}): Notificacion[] {
  const { garantias, inventory, citas, repairs, invoices, budgets = [], budgetFollowUpDays = 3 } = data;
  const raw: Omit<Notificacion, 'id' | 'leida' | 'createdAt'>[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyStr = new Date().toISOString().slice(0, 10);

  // 1. Garantías próximas a vencer (<=7 días) o vencidas
  garantias.filter(g => g.status === 'activa').forEach(g => {
    const exp = new Date(g.expiryDate);
    exp.setHours(0, 0, 0, 0);
    const dias = Math.floor((exp.getTime() - hoy.getTime()) / 86400000);
    if (dias >= 0 && dias <= 7) {
      raw.push({
        tipo: 'garantia',
        prioridad: dias <= 2 ? 'alta' : 'media',
        titulo: `Garantía vence en ${dias} día${dias !== 1 ? 's' : ''}`,
        mensaje: `${g.customerName} — ${g.deviceDescription}`,
        vistaDestino: 'garantias',
      });
    } else if (dias < 0) {
      raw.push({
        tipo: 'garantia',
        prioridad: 'baja',
        titulo: 'Garantía vencida',
        mensaje: `${g.customerName} — ${g.deviceDescription}`,
        vistaDestino: 'garantias',
      });
    }
  });

  // 2. Stock bajo o agotado (solo si minStock > 0, para no alertar de ítems sin mínimo definido)
  inventory.filter(i => i.minStock > 0 && i.stock <= i.minStock).forEach(i => {
    raw.push({
      tipo: 'stock',
      prioridad: i.stock === 0 ? 'alta' : 'media',
      titulo: i.stock === 0 ? 'Sin stock' : 'Stock bajo',
      mensaje: `${i.ref} — ${i.description} (${i.stock} uds)`,
      vistaDestino: 'inventory',
    });
  });

  // 3. Citas de hoy
  citas
    .filter(c => c.fecha === hoyStr && c.estado !== 'cancelada' && c.estado !== 'completada')
    .forEach(c => {
      raw.push({
        tipo: 'cita',
        prioridad: 'alta',
        titulo: `Cita hoy a las ${c.horaInicio}`,
        mensaje: `${c.titulo}${c.clienteName ? ' — ' + c.clienteName : ''}`,
        vistaDestino: 'calendar',
      });
    });

  // 4. Reparaciones listas sin recoger ≥7 días
  repairs.filter(r => r.status === 'Listo para Entrega').forEach(r => {
    const dias = Math.floor((Date.now() - new Date(r.updatedAt || r.entryDate).getTime()) / 86400000);
    if (dias >= 7) {
      raw.push({
        tipo: 'reparacion',
        prioridad: dias >= 14 ? 'alta' : 'media',
        titulo: `Equipo sin recoger ${dias} días`,
        mensaje: `${r.customerName} — ${r.brand} ${r.model} (${String(r.rmaNumber).padStart(5, '0')})`,
        vistaDestino: 'despacho',
      });
    }
  });

  // 5. Presupuestos sin respuesta
  budgets
    .filter(b => !b.status || b.status === 'pending')
    .forEach(b => {
      const ref = b.lastContactedAt || b.date;
      if (!ref) return;
      const days = workingDaysSince(ref);
      if (days < budgetFollowUpDays) return;
      const isRed = days >= budgetFollowUpDays * 2 + 1;
      const name = b.customerName || 'Cliente';
      raw.push({
        tipo: 'presupuesto',
        prioridad: isRed ? 'alta' : 'media',
        titulo: `${days}d sin respuesta`,
        mensaje: `${name} — ${Number(b.total ?? 0).toFixed(2)}€`,
        vistaDestino: 'budgets',
      });
    });

  // 6. Facturas pendientes ≥30 días
  invoices.filter(i => i.status === 'pendiente').forEach(i => {
    const dias = Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 86400000);
    if (dias >= 30) {
      raw.push({
        tipo: 'factura',
        prioridad: 'media',
        titulo: `Factura pendiente ${dias} días`,
        mensaje: `${i.invoiceNumber} — ${i.customerName} — ${(Number(i.total) || 0).toFixed(2)}€`,
        vistaDestino: 'invoices',
      });
    }
  });

  const createdAt = new Date().toISOString();
  return raw.map(n => ({
    ...n,
    id: stableId(n.tipo, n.titulo, n.mensaje),
    leida: false,
    createdAt,
  }));
}

// ── Browser notifications ────────────────────────────────────────────────────

const SHOWN_KEY = 'gestrepara_notif_shown_';

function todayKey(): string {
  return SHOWN_KEY + new Date().toISOString().slice(0, 10);
}

function getShownToday(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(todayKey()) || '[]')); }
  catch { return new Set(); }
}

function markShown(ids: string[]): void {
  try {
    const shown = getShownToday();
    ids.forEach(id => shown.add(id));
    localStorage.setItem(todayKey(), JSON.stringify([...shown]));
    // Purge old keys
    const today = todayKey();
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(SHOWN_KEY) && k !== today) localStorage.removeItem(k);
    });
  } catch {}
}

export async function solicitarPermiso(): Promise<void> {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function enviarNotificacionesBrowser(notifs: Notificacion[]): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const shown = getShownToday();
  const pendientes = notifs.filter(n => n.prioridad === 'alta' && !n.leida && !shown.has(n.id));
  if (!pendientes.length) return;
  pendientes.forEach(n => {
    try { new Notification('GestRepara Pro', { body: n.mensaje, icon: '/icon-192.png' }); } catch {}
  });
  markShown(pendientes.map(n => n.id));
}
