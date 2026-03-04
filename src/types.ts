
export enum RepairStatus {
  PENDING = 'Pendiente',
  DIAGNOSING = 'En Diagnóstico',
  BUDGET_PENDING = 'Presupuesto Enviado',
  BUDGET_ACCEPTED = 'Presupuesto Aceptado',
  BUDGET_REJECTED = 'Presupuesto Rechazado',
  WAITING_PARTS = 'Esperando Repuestos',
  IN_PROGRESS = 'En Reparación',
  READY = 'Listo para Entrega',
  DELIVERED = 'Entregado',
  CANCELLED = 'Cancelado'
}

export interface RepairItem {
  id: string;
  rmaNumber: number;
  rmaPrefix?: string;
  customerName: string;
  customerPhone: string;
  customerSignature?: string;
  deviceType: string;
  brand: string;
  model: string;
  serialNumber: string;
  problemDescription: string;
  entryDate: string;
  status: RepairStatus;
  technician?: string;
  updatedAt?: string;
  notes?: string;
  images?: string[];
  estimatedParts?: number;
  estimatedHours?: number;
}

export interface BudgetItem {
  id: string;
  repairId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface LaborItem {
  id: string;
  description: string;
  hours: number;
  hourlyRate: number;
}

export interface Budget {
  id: string;
  repairId: string;
  rmaNumber: number;
  items: BudgetItem[];
  laborItems: LaborItem[];
  taxRate: number;
  total: number;
  date: string;
  signature?: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  date: string;
  items: BudgetItem[];
  laborItems: LaborItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface AppSettings {
  appName: string;
  address: string;
  phone: string;
  taxId: string;
  technicians?: string[];
  hourlyRate?: number;
  taxRate?: number;
  logoUrl?: string;
  letterhead?: string;
  email?: string;
}

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export type ViewType = 'dashboard' | 'repairs' | 'new-repair' | 'budgets' | 'customers' | 'settings' | 'stats' | 'calendar' | 'external-apps' | 'external-app-view';

// ─── Módulos Integrados (de gestion-repara) ─────────────────────────────

export enum CitaEstado {
  Confirmada = 'Confirmada',
  Cancelada = 'Cancelada',
  Completada = 'Completada',
}

export enum EstadoVisita {
  Pendiente = 'Pendiente',
  EnCamino = 'En Camino',
  EnSitio = 'En Sitio',
  Finalizada = 'Finalizada'
}

export interface Cita {
  id: string;
  clienteNombre: string;
  fecha: string; // ISO date string
  servicio: string;
  estado: CitaEstado;
  estadoVisita: EstadoVisita;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  notas?: string;
  rmaId?: string; // link to repair
}

export interface ExternalApp {
  id: string;
  nombre: string;
  url: string;
  icono: string;
  categoria: string;
  activa: boolean;
  descripcion: string;
  fechaAnadida: string;
}
