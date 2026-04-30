
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

export type RepairType = 'taller' | 'domicilio';

export interface RepairItem {
  id: string;
  rmaNumber: number;
  rmaPrefix?: string;
  repairType: RepairType;
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
  // Campos domicilio
  address?: string;
  city?: string;
  // Notas de campo del técnico
  fieldNotes?: FieldNote[];
}

export interface FieldNote {
  id: string;
  text: string;
  timestamp: string;
  photos?: string[]; // base64 images
}

export interface BudgetItem {
  id: string;
  repairId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string;
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
  taxEnabled?: boolean;
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
  inventoryCategories?: string[];
  anthropicApiKey?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  email?: string;
  taxId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export type ViewType = 'dashboard' | 'repairs' | 'new-repair' | 'budgets' | 'customers' | 'settings' | 'stats' | 'calendar' | 'external-apps' | 'external-app-view' | 'tech-field' | 'diagnostic' | 'despacho' | 'inventory' | 'inventory-entrada' | 'invoices' | 'garantias';

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
// ── Nuevos módulos v8 ─────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  ref: string;
  description: string;
  category: string;
  ean?: string;
  supplierRef?: string;
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice?: number;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  ref: string;
  description: string;
  type: 'entrada' | 'salida' | 'ajuste';
  qty: number;
  costPrice: number;
  date: string;
  origin: 'manual' | 'entrada-stock' | 'presupuesto';
  notes?: string;
  createdAt: string;
}

export interface Warranty {
  id: string;
  repairId: string;
  rmaNumber: number;
  customerName: string;
  customerPhone: string;
  deviceDescription: string;
  deliveryDate: string;
  expiryDate: string;
  months: number;
  status: 'activa' | 'vencida' | 'reclamada';
  createdAt: string;
}

export interface FullInvoice {
  id: string;
  invoiceNumber: string;
  repairId?: string;
  rmaNumber?: number;
  customerName: string;
  customerPhone: string;
  date: string;
  items: BudgetItem[];
  laborItems: LaborItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: 'pendiente' | 'cobrada' | 'vencida' | 'anulada';
  payMethod?: 'efectivo' | 'tarjeta' | 'bizum' | 'transferencia';
  paidAt?: string;
  isRectificativa?: boolean;
  createdAt: string;
}
