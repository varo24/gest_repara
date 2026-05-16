
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
  CANCELLED = 'Cancelado',
  SIN_REPARACION = 'Sin Reparación'
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
  // Fotos Firebase Storage
  photos?: { url: string; tipo: 'entrada' | 'salida' | 'diagnostico'; caption?: string; uploadedAt: string }[];
  // Informe técnico
  diagnostico?: {
    problema: string;
    causaRaiz?: string;
    solucionAplicada?: string;
    piezasSustituidas?: string;
    observaciones?: string;
    nivelDificultad?: 'facil' | 'medio' | 'dificil' | 'no-reparable';
    tiempoEstimado?: number;
    tecnico?: string;
  };
  // Firma digital del cliente
  firmaClienteUrl?: string;
  firmaClienteDate?: string;
  // Estado estético al ingreso
  estadoEstetico?: {
    pantalla: 'perfecto' | 'rayado' | 'roto' | 'na';
    carcasa: 'perfecto' | 'rayado' | 'golpes' | 'roto';
    botones: 'perfecto' | 'fallo-parcial' | 'no-funciona';
    puertos: 'perfecto' | 'dano-visible' | 'no-funciona';
    observaciones?: string;
  };
}

export interface FieldNote {
  id: string;
  text: string;
  timestamp: string;
  photos?: string[]; // base64 images
}

export interface BudgetItem {
  id: string;
  repairId?: string;
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
  motivoRechazo?: string;
  stockDescontado?: boolean;
  lastContactedAt?: string;
  archivado?: boolean;
  documentoGenerado?: { tipo: 'factura' | 'recibo'; numero: string; id: string };
  // Campos para presupuestos libres (sin reparación asociada)
  customerName?: string;
  customerPhone?: string;
  customerTaxId?: string;
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
  geminiApiKey?: string;
  legalTerms?: string;
  dashboardModules?: string[];
  warrantyMonths?: number;
  budgetFollowUpDays?: number;
  whatsappRemindersEnabled?: boolean;
  whatsappReminderHour?: number;
  whatsappReminderMessage?: string;
  imapServerUrl?: string;
  imapApiKey?: string;
  imapDays?: number;
  verifactuEnabled?: boolean;
  verifactuNIF?: string;
  verifactuSerie?: string;
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
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export type ViewType = 'dashboard' | 'repairs' | 'new-repair' | 'budgets' | 'customers' | 'settings' | 'stats' | 'estadisticas' | 'calendar' | 'external-apps' | 'external-app-view' | 'diagnostic' | 'despacho' | 'inventory' | 'inventory-entrada' | 'invoices' | 'garantias' | 'correos' | 'archivo-facturas' | 'suppliers' | 'informes' | 'caja';

export interface MovimientoCaja {
  id: string;
  tipo: 'ingreso' | 'gasto' | 'apertura' | 'cierre' | 'retirada';
  concepto: string;
  importe: number;
  payMethod?: 'efectivo' | 'tarjeta' | 'bizum' | 'transferencia';
  categoria?: 'reparacion' | 'venta' | 'proveedor' | 'gasto-fijo' | 'gasto-variable' | 'otros';
  facturaId?: string;
  rmaNumber?: number;
  fecha: string;
  hora: string;
  tecnico?: string;
  notas?: string;
  createdAt: string;
}

export interface DetalleBilletes {
  b200: number; b100: number; b50: number;
  b20: number;  b10: number;  b5: number;
  m200: number; m100: number; m050: number;
  m020: number; m010: number;
}

export interface CierreCaja {
  id: string;
  fecha: string;
  apertura: number;
  totalIngresos: number;
  totalGastos: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalBizum: number;
  totalTransferencia: number;
  saldoFinal: number;
  saldoEsperado: number;
  diferencia: number;
  movimientos: string[];
  detalleBilletes?: DetalleBilletes;
  notas?: string;
  cerradoPor?: string;
  dismissed?: boolean;
  createdAt: string;
}

// ─── Módulos Integrados (de gestion-repara) ─────────────────────────────

// Legacy enums — kept for backward compat with old stored data
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
  tipo: 'taller' | 'domicilio' | 'interno';
  titulo: string;
  clienteName?: string;
  clientePhone?: string;
  clienteId?: string;
  repairId?: string;
  fecha: string;        // YYYY-MM-DD
  horaInicio: string;   // HH:MM
  horaFin: string;      // HH:MM
  descripcion?: string;
  direccion?: string;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  recordatorioEnviado?: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
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
  origin: 'manual' | 'entrada-stock' | 'presupuesto' | 'factura' | 'correo';
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
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  comercialName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  iban?: string;
  paymentTerms?: string;
  notes?: string;
  categories?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Notificacion {
  id: string;
  tipo: 'garantia' | 'stock' | 'cita' | 'reparacion' | 'factura' | 'presupuesto';
  prioridad: 'alta' | 'media' | 'baja';
  titulo: string;
  mensaje: string;
  enlace?: string;
  vistaDestino?: string;
  leida: boolean;
  createdAt: string;
}

export interface InformeRecord {
  id: string;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  url?: string;
  stats: {
    totalFacturado: number;
    nReparaciones: number;
    valorStock: number;
    totalCompras: number;
  };
  generadoEn: string;
  createdAt: string;
  updatedAt: string;
}

export interface FullInvoice {
  id: string;
  invoiceNumber: string;
  repairId?: string;
  rmaNumber?: number;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerTaxId?: string;
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
  stockDescontado?: boolean;
  createdAt: string;
  verifactu?: {
    enabled: boolean;
    huella: string;
    fechaHuella: string;
    tipoHuella: 'SHA-256';
    numSerieFactura: string;
    fechaExpedicion: string;
    enviado: boolean;
    fechaEnvio?: string;
    respuestaAEAT?: string;
    qrUrl?: string;
  };
}
