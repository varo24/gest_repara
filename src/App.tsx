import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RepairList from './components/RepairList';
import RepairForm from './components/RepairForm';
import BudgetCreator from './components/BudgetCreator';
import BudgetList from './components/BudgetList';
import SettingsForm from './components/SettingsForm';
import CustomerList from './components/CustomerList';
import PinScreen from './components/PinScreen';
import CustomerReceipt from './components/CustomerReceipt';
import ThermalTicket from './components/ThermalTicket';
import CalendarView from './components/CalendarView';
import ExternalAppsView from './components/ExternalAppsView';
import ExternalAppViewer from './components/ExternalAppViewer';
import Despacho from './components/Despacho';
const Facturacion    = lazy(() => import('./components/Facturacion'));
const Inventario     = lazy(() => import('./components/Inventario'));
const EntradaStock   = lazy(() => import('./components/EntradaStock'));
const Garantias      = lazy(() => import('./components/Garantias'));
const Correos        = lazy(() => import('./components/Correos'));
const ArchivoFacturas = lazy(() => import('./components/ArchivoFacturas'));
const Proveedores    = lazy(() => import('./components/Proveedores'));
const Informes       = lazy(() => import('./components/Informes'));
const Caja           = lazy(() => import('./components/Caja'));
const Estadisticas   = lazy(() => import('./components/Estadisticas'));
import { ViewType, RepairItem, Budget, AppSettings, AppNotification, RepairStatus, Cita, ExternalApp, Customer, InventoryItem, StockMovement, Warranty, Supplier, InformeRecord, Notificacion } from './types';
import { generarNotificaciones, solicitarPermiso, enviarNotificacionesBrowser } from './lib/notificationsService';
import { storage } from './lib/dataService';
import { SyncStatusProvider } from './lib/syncStatusContext';
import SyncIndicator from './components/SyncIndicator';
import { descontarStock } from './lib/inventoryService';
import { notifyReady, notifyCancelled, buildBudgetMessage, sendWhatsApp } from './services/whatsappService';
import CitaReminderModal from './components/CitaReminderModal';
import { shouldShowReminders, getCitasPendingReminder, setReminderDate } from './lib/citaReminders';
import { isPinEnabled, clearSession } from './lib/pinAuth';
import {
  requestPermissionIfNeeded, checkRepairsReady, checkCitasReminder,
  checkStockLow, purgeOldNotifIds, setBadge,
} from './lib/pushNotifications';
import { Loader2, FileText, Ticket, Menu, Bell, ClipboardList, Search } from 'lucide-react';
import { logError } from './lib/errorLogger';
import { printWorkOrder } from './lib/printWorkOrder';

const APP_VERSION = __APP_VERSION__;

const LazyFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
  </div>
);

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'ReparaPro Master',
  address: 'Calle Técnica 123, Local 5',
  phone: '900 000 000',
  taxId: 'B-12345678',
  technicians: ['Técnico Senior', 'Ayudante'],
  hourlyRate: 45,
  taxRate: 21,
  letterhead: 'Garantía de 3 meses en mano de obra. Validez del presupuesto: 15 días.',
  dashboardModules: ['new-repair','repairs','despacho','budgets','invoices','caja','customers','inventory','inventory-entrada','garantias','correos','archivo-facturas','suppliers','calendar','informes','stats','external-apps','settings'],
  legalTerms: 'LOS PRESUPUESTOS QUE NO SUPEREN LOS 40€ NO REQUIEREN FIRMA DEL CLIENTE. EL TALLER NO SE HACE RESPONSABLE DE LA PÉRDIDA DE DATOS. SE RECOMIENDA REALIZAR UNA COPIA DE SEGURIDAD ANTES DE ENTREGAR EL EQUIPO. LOS EQUIPOS NO RETIRADOS EN UN PLAZO DE 6 MESES DESDE LA NOTIFICACIÓN AL CLIENTE PODRÁN SER OBJETO DE TRATAMIENTO CONFORME A LA NORMATIVA VIGENTE. EL PRESUPUESTO TIENE UNA VALIDEZ DE 15 DÍAS DESDE SU EMISIÓN. SE APLICARÁ EL IVA VIGENTE EN EL MOMENTO DE LA FACTURACIÓN.',
  geminiApiKey: '',
  warrantyMonths: 3,
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);
  const [prefillCustomer, setPrefillCustomer] = useState<{ name: string; phone: string; address?: string; city?: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{msg: string; onYes: () => void} | null>(null);

  const confirm2 = (msg: string, onYes: () => void) => setConfirmModal({ msg, onYes });
  const [activeBudgetRepair, setActiveBudgetRepair] = useState<RepairItem | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [freeBudgetMode, setFreeBudgetMode] = useState(false);

  // New module states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [externalApps, setExternalApps] = useState<ExternalApp[]>([]);
  const [activeExternalApp, setActiveExternalApp] = useState<ExternalApp | null>(null);
  const [customersDB, setCustomersDB] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [facturasImportadas, setFacturasImportadas] = useState<any[]>([]);
  const [informes, setInformes] = useState<InformeRecord[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [supplierToOpen, setSupplierToOpen] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reminderCitas, setReminderCitas] = useState<Cita[]>([]);
  const reminderChecked = useRef(false);
  const [cashMovements, setCashMovements] = useState<any[]>([]);
  const [cierresCaja, setCierresCaja] = useState<any[]>([]);

  const [preFillEntrada, setPreFillEntrada] = useState<any>(null);

  // Estados para los documentos post-guardado
  const [showReceiptFor, setShowReceiptFor] = useState<RepairItem | null>(null);
  const [showTicketFor, setShowTicketFor] = useState<RepairItem | null>(null);
  const [pendingDocRepair, setPendingDocRepair] = useState<RepairItem | null>(null);

  // ── Inactivity auto-lock ───────────────────────────────────────────────────
  const lastActivityRef   = useRef(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const INACTIVITY_MS = 10 * 60 * 1000;

  const lock = useCallback(() => {
    if (!isPinEnabled()) return;
    clearSession();
    setUnlocked(false);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(lock, INACTIVITY_MS);
  }, [lock]);

  // Start timer once unlocked; clear on lock
  useEffect(() => {
    if (!unlocked) { clearTimeout(inactivityTimerRef.current); return; }
    const events = ['click', 'keydown', 'scroll', 'touchstart', 'pointermove'] as const;
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      clearTimeout(inactivityTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
    };
  }, [unlocked, resetInactivityTimer]);

  // Lock when tab becomes visible after long absence
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && unlocked && isPinEnabled()) {
        if (Date.now() - lastActivityRef.current > INACTIVITY_MS) lock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [unlocked, lock]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── SW notification click → navigate to the right view ───────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'NOTIF_CLICK') return;
      const { view } = event.data.data ?? {};
      if (view) navigateTo(view as any);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // ── Ask notification permission once, then check conditions ──────────────
  const notifCheckedRef = useRef(false);
  useEffect(() => {
    if (!unlocked || loading) return;
    if (notifCheckedRef.current) return;
    notifCheckedRef.current = true;

    requestPermissionIfNeeded();

    // Run checks after a short delay to let data settle
    const t = setTimeout(async () => {
      await checkRepairsReady(repairs);
      await checkCitasReminder(citas);
      await checkStockLow(inventoryItems);
      purgeOldNotifIds(
        new Set(repairs.map(r => r.id)),
        new Set(citas.map(c => c.id)),
      );
      // Update PWA badge with count of "ready" repairs
      const readyCount = repairs.filter(r => r.status === RepairStatus.READY).length;
      setBadge(readyCount);
    }, 3000);
    return () => clearTimeout(t);
  }, [unlocked, loading, repairs, citas, inventoryItems]);

  const handleInstallPWA = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
      setDeferredInstallPrompt(null);
      notify('success', '¡ReparaPro instalada como app de escritorio!');
    }
  };

  const notify = useCallback((type: AppNotification['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const initApp = async () => {
      try {
        await storage.init();
        unsubs.push(storage.subscribe('repairs', (data) => {
          setRepairs(data);
          setLoading(false);
        }));
        unsubs.push(storage.subscribe('budgets', setBudgets));
        unsubs.push(storage.subscribe('settings', (data) => {
          if (data && data.length > 0) setSettings(data[0]);
        }));
        unsubs.push(storage.subscribe('invoices', setInvoices));
        unsubs.push(storage.subscribe('citas', setCitas));
        unsubs.push(storage.subscribe('apps_externas', setExternalApps));
        unsubs.push(storage.subscribe('customers', setCustomersDB));
        unsubs.push(storage.subscribe('inventory', setInventoryItems));
        unsubs.push(storage.subscribe('stock_movements', setStockMovements));
        unsubs.push(storage.subscribe('warranties', setWarranties));
        unsubs.push(storage.subscribe('suppliers', setSuppliers));
        unsubs.push(storage.subscribe('facturas_importadas', setFacturasImportadas));
        unsubs.push(storage.subscribe('informes', setInformes));
        unsubs.push(storage.subscribe('cash_movements', setCashMovements));
        unsubs.push(storage.subscribe('cierres_caja', setCierresCaja));
      } catch (err) {
        console.error('Init Error:', err);
        setLoading(false);
      }
    };

    initApp();
    return () => unsubs.forEach(fn => fn());
  }, []);

  const handleMarkBudgetContacted = useCallback((budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;
    storage.save('budgets', budgetId, { ...budget, lastContactedAt: new Date().toISOString().slice(0, 10) });
    notify('success', 'Presupuesto marcado como contactado.');
  }, [budgets]);

  // Regenerate notifications whenever source data changes
  useEffect(() => {
    const nuevas = generarNotificaciones({
      garantias: warranties,
      inventory: inventoryItems,
      citas,
      repairs,
      invoices,
      budgets,
      budgetFollowUpDays: settings.budgetFollowUpDays ?? 3,
    });
    setNotificaciones(prev => {
      const leidasIds = new Set(prev.filter(n => n.leida).map(n => n.id));
      return nuevas.map(n => ({ ...n, leida: leidasIds.has(n.id) }));
    });
  }, [warranties, inventoryItems, citas, repairs, invoices]);

  useEffect(() => { solicitarPermiso(); }, []);

  useEffect(() => {
    if (notificaciones.length > 0) enviarNotificacionesBrowser(notificaciones);
  }, [notificaciones]);

  const marcarLeida = useCallback((id: string) => {
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }, []);

  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  }, []);

  // ── WhatsApp reminder check (once per day, after configured hour) ───────────

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      if (reminderChecked.current) return;
      reminderChecked.current = true;
      if (!shouldShowReminders(settings)) return;
      const pending = getCitasPendingReminder(citas);
      setReminderDate(new Date().toISOString().slice(0, 10));
      if (pending.length > 0) setReminderCitas(pending);
    }, 2500);

    return () => clearTimeout(timer);
  }, [loading, settings, citas]);

  // ── Migración one-time: archivar presupuestos con factura/recibo previos ──────
  // ── Integridad: reactivar presupuestos huérfanos (documento borrado) ──────────
  const integrityCheckRef = useRef(false);
  useEffect(() => {
    if (integrityCheckRef.current) return;
    if (budgets.length === 0 && invoices.length === 0) return;
    integrityCheckRef.current = true;

    const invoiceIds = new Set(invoices.map((inv: any) => inv.id));
    for (const budget of budgets) {
      if (!budget.archivado || !budget.documentoGenerado) continue;
      if (!invoiceIds.has(budget.documentoGenerado.id)) {
        storage.save('budgets', budget.id, { archivado: false, documentoGenerado: null });
        console.log(`[Integrity] Presupuesto ${budget.id} reactivado — ${budget.documentoGenerado.tipo} ${budget.documentoGenerado.numero} no existe`);
      }
    }
  }, [budgets, invoices]);

  const migrationDoneRef = useRef(false);
  useEffect(() => {
    const MIGRATION_KEY = 'gestrepara_migration_archivado_v1';
    if (localStorage.getItem(MIGRATION_KEY)) return;
    if (migrationDoneRef.current) return;
    if (budgets.length === 0 && invoices.length === 0) return;

    migrationDoneRef.current = true;
    localStorage.setItem(MIGRATION_KEY, '1');

    const invoiceByRepairId = new Map<string, any>();
    for (const inv of invoices) {
      if (inv.repairId && !invoiceByRepairId.has(inv.repairId)) {
        invoiceByRepairId.set(inv.repairId, inv);
      }
    }

    let count = 0;
    for (const budget of budgets) {
      if (budget.archivado || !budget.repairId) continue;
      const inv = invoiceByRepairId.get(budget.repairId);
      if (!inv) continue;
      storage.save('budgets', budget.id, {
        archivado: true,
        documentoGenerado: {
          tipo: (inv.taxRate ?? 0) > 0 ? 'factura' : 'recibo',
          numero: inv.invoiceNumber,
          id: inv.id,
        },
      });
      count++;
    }
    if (count) console.log(`[Migration v1] Archivados ${count} presupuestos con factura/recibo`);
  }, [budgets, invoices]);

  // ── Migración: restaurar facturas borradas como duplicados que quedaron con _deleted ──
  const dupRestoreDoneRef = useRef(false);
  useEffect(() => {
    const MIGRATION_KEY = 'gestrepara_migration_restaurar_duplicados_v1';
    if (localStorage.getItem(MIGRATION_KEY)) return;
    if (dupRestoreDoneRef.current) return;
    if (!invoices.length) return;

    dupRestoreDoneRef.current = true;
    localStorage.setItem(MIGRATION_KEY, '1');

    // Mapa repairId → factura activa (no borrada)
    const activeByRepairId = new Map<string, any>();
    for (const inv of invoices) {
      if (!(inv as any)._deleted && inv.status !== 'anulada' && inv.repairId) {
        // Guardar la de número más bajo
        const existing = activeByRepairId.get(inv.repairId);
        if (!existing || (inv.invoiceNumber ?? '').localeCompare(existing.invoiceNumber ?? '') < 0) {
          activeByRepairId.set(inv.repairId, inv);
        }
      }
    }

    let count = 0;
    for (const inv of invoices) {
      if (!(inv as any)._deleted || !inv.repairId) continue;
      const sibling = activeByRepairId.get(inv.repairId);
      if (!sibling) continue;
      storage.save('invoices', inv.id, {
        ...inv,
        _deleted: false,
        motivoAnulacion: `duplicado de ${sibling.invoiceNumber}`,
      });
      count++;
    }
    if (count) console.log(`[Migration v2] Restaurados ${count} duplicados como anulados con motivo`);
  }, [invoices]);

  // ── Migration v3: restaurar facturas incorrectamente anuladas (algoritmo corregido) ──
  const correctionDoneRef = useRef(false);
  useEffect(() => {
    const MIGRATION_KEY = 'gestrepara_migration_correccion_duplicados_v3';
    if (localStorage.getItem(MIGRATION_KEY)) return;
    if (correctionDoneRef.current) return;
    if (!invoices.length) return;

    correctionDoneRef.current = true;
    localStorage.setItem(MIGRATION_KEY, '1');

    const getSeries = (n: string) => (n ?? '').split('-')[0]; // 'FAC' | 'REC'

    // Incluir las anuladas-con-motivo en el análisis para detectar duplicados reales
    const forAnalysis = (invoices as any[]).filter(inv =>
      !(inv._deleted) &&
      (inv.status !== 'anulada' || (inv.motivoAnulacion ?? '').startsWith('duplicado de'))
    );

    const grupos: Record<string, any[]> = {};
    for (const inv of forAnalysis) {
      if (!inv.repairId) continue;
      const key = `${inv.repairId}:${getSeries(inv.invoiceNumber)}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(inv);
    }

    const trueToRemove = new Set<string>();
    for (const group of Object.values(grupos)) {
      if (group.length > 1) {
        const sorted = [...group].sort((a: any, b: any) =>
          (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '')
        );
        sorted.slice(1).forEach((inv: any) => trueToRemove.add(inv.id));
      }
    }

    let count = 0;
    for (const inv of invoices as any[]) {
      if (inv.status !== 'anulada') continue;
      if (!(inv.motivoAnulacion ?? '').startsWith('duplicado de')) continue;
      if (trueToRemove.has(inv.id)) continue; // duplicado real — dejar anulado
      // Duplicado incorrecto — restaurar
      const restoredStatus = inv.paidAt ? 'cobrada' : 'pendiente';
      storage.save('invoices', inv.id, { ...inv, status: restoredStatus, motivoAnulacion: null });
      count++;
    }
    if (count) console.log(`[Migration v3] Restauradas ${count} facturas incorrectamente anuladas`);
  }, [invoices]);

  // ── Migration v4: fix/create FAC-00008 y FAC-00009 como anuladas ──────────
  const fixDupFacRef = useRef(false);
  useEffect(() => {
    const MIGRATION_KEY = 'gestrepara_migration_fix_fac_duplicados_v4';
    if (localStorage.getItem(MIGRATION_KEY)) return;
    if (fixDupFacRef.current) return;
    if (!invoices.length || !repairs.length) return;

    fixDupFacRef.current = true;
    localStorage.setItem(MIGRATION_KEY, '1');

    const targets = [
      { invoiceNumber: 'FAC-00008', rmaNumber: 59, customerName: 'SONIA BERNABEU', customerPhone: '665 31 49 29', total: 111.93, motivoAnulacion: 'duplicado de FAC-00002', payMethod: 'efectivo' as const },
      { invoiceNumber: 'FAC-00009', rmaNumber: 58, customerName: 'JUAN BLANCO',    customerPhone: '697770846',   total: 84.70,  motivoAnulacion: 'duplicado de FAC-00003', payMethod: 'bizum'    as const },
    ];

    for (const t of targets) {
      const existing = (invoices as any[]).find(inv => inv.invoiceNumber === t.invoiceNumber);
      if (existing) {
        storage.save('invoices', existing.id, {
          status: 'anulada',
          _deleted: false,
          motivoAnulacion: t.motivoAnulacion,
        });
        console.log(`[Migration v4] Fijada ${t.invoiceNumber} como anulada`);
      } else {
        const repair = repairs.find(r => r.rmaNumber === t.rmaNumber);
        const now = new Date().toISOString();
        const newId = `fix-v4-${t.invoiceNumber.toLowerCase()}`;
        storage.save('invoices', newId, {
          id: newId,
          invoiceNumber: t.invoiceNumber,
          repairId: repair?.id ?? '',
          rmaNumber: t.rmaNumber,
          customerName: t.customerName,
          customerPhone: t.customerPhone,
          date: now.slice(0, 10),
          items: [],
          laborItems: [],
          subtotal: t.total,
          taxRate: 21,
          taxAmount: 0,
          total: t.total,
          status: 'anulada',
          payMethod: t.payMethod,
          motivoAnulacion: t.motivoAnulacion,
          createdAt: now,
        });
        console.log(`[Migration v4] Creada ${t.invoiceNumber} como anulada (nueva)`);
      }
    }
  }, [invoices, repairs]);

  // ── Migration: restaurar citas de los últimos 60 días con 'completada' incorrecto ─
  const citasResetRef = useRef(false);
  useEffect(() => {
    const MIGRATION_KEY = 'gestrepara_migration_citas_reset_completadas_v1';
    if (localStorage.getItem(MIGRATION_KEY)) return;
    if (citasResetRef.current) return;
    if (!citas.length) return;

    citasResetRef.current = true;
    localStorage.setItem(MIGRATION_KEY, '1');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    let count = 0;
    for (const c of citas) {
      const fecha = ((c as any).fecha || '').slice(0, 10);
      const estado = (c as any).estado;
      if (fecha >= cutoffStr && (estado === 'completada' || estado === 'Completada')) {
        storage.save('citas', c.id, { estado: 'confirmada' });
        count++;
      }
    }
    if (count) console.log(`[Migration citas] Restauradas ${count} citas — estado 'completada' → 'confirmada'`);
  }, [citas]);

  const handleReminderSent = useCallback((citaId: string) => {
    const cita = citas.find(c => c.id === citaId);
    if (cita) storage.save('citas', citaId, { ...cita, recordatorioEnviado: true });
    setReminderCitas(prev => prev.filter(c => c.id !== citaId));
  }, [citas]);

  // ─────────────────────────────────────────────────────────────────────────────

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    setSidebarOpen(false);
    if (view !== 'new-repair') { setEditingRepair(null); setPrefillCustomer(null); }
    setEditingBudget(null);
    setActiveBudgetRepair(null);
    if (view !== 'external-app-view') setActiveExternalApp(null);
  };

  // Citas handlers
  const handleSaveCita = async (cita: Cita) => {
    storage.save('citas', cita.id, cita);
    notify('success', `Cita "${cita.titulo || cita.clienteName || 'nueva'}" guardada.`);
  };

  const handleDeleteCita = async (id: string) => {
    storage.remove('citas', id);
    notify('info', 'Cita eliminada.');
  };

  // External Apps handlers
  const handleSaveExternalApp = async (app: ExternalApp) => {
    storage.save('apps_externas', app.id, app);
    notify('success', `${app.nombre} guardado.`);
  };

  const handleDeleteExternalApp = async (id: string) => {
    storage.remove('apps_externas', id);
    notify('info', 'Módulo eliminado.');
  };

  const handleViewExternalApp = (app: ExternalApp) => {
    setActiveExternalApp(app);
    setCurrentView('external-app-view');
  };

  const handleSaveRepair = async (data: Partial<RepairItem>, rma?: number) => {
    const id = data.id || `RMA-${Date.now()}`;
    const rmaNum = rma || storage.nextRmaNumber();
    const savedRepair: RepairItem = {
      ...data as RepairItem,
      id,
      rmaNumber: rmaNum,
      repairType: data.repairType || 'taller',
    };

    // Guardar (local-first, no bloquea)
    storage.save('repairs', id, savedRepair);

    // Respuesta inmediata
    notify('success', `RMA-${rmaNum.toString().padStart(5, '0')} guardado correctamente.`);
    navigateTo('repairs');

    if (!data.id) {
      setPendingDocRepair(savedRepair);
    }
  };

  const handleSaveBudget = async (budget: Budget) => {
    storage.save('budgets', budget.id, budget);
    const label = budget.rmaNumber
      ? `RMA-${String(budget.rmaNumber).padStart(5, '0')}`
      : budget.customerName || 'libre';
    notify('success', `Presupuesto ${label} guardado.`);
    setFreeBudgetMode(false);
    navigateTo('budgets');
  };

  // Pantalla de carga
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}>
      <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: '#2e7d32' }} />
      <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: '#555' }}>Inicializando ReparaPro...</p>
    </div>
  );

  // Pantalla de PIN — solo si hay PIN configurado y la sesión no está activa
  if (!unlocked && isPinEnabled()) return (
    <PinScreen
      onUnlock={() => setUnlocked(true)}
      settings={settings}
    />
  );

  const unreadCount = notificaciones.filter(n => !n.leida).length;
  const hasAlta = notificaciones.some(n => !n.leida && n.prioridad === 'alta');

  return (
    <SyncStatusProvider>
    <div className="flex min-h-screen no-print" style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}>

      {/* ── Mobile header (hidden on md+) ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-[35] flex items-center gap-3 px-3 no-print"
        style={{ height: 56, background: '#0a0a0a', borderBottom: '1px solid #1e1e1e' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center justify-center w-11 h-11 rounded-xl text-white"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <Menu size={20} />
        </button>
        <span className="flex-1 text-white font-black text-sm uppercase tracking-widest truncate">
          {settings.appName}
        </span>
        <SyncIndicator variant="dot" />
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <Search size={17} style={{ color: '#fff' }} />
        </button>
        <button
          onClick={() => setSidebarOpen(true)}
          className="relative flex items-center justify-center w-11 h-11 rounded-xl text-white"
          style={{ background: 'rgba(255,255,255,0.06)', color: hasAlta ? '#ff5252' : '#aaa' }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: hasAlta ? '#c62828' : '#555' }}
            />
          )}
        </button>
      </header>

      <Sidebar
        currentView={currentView}
        setView={navigateTo}
        onNewRepair={() => { navigateTo('new-repair'); setSidebarOpen(false); }}
        onEditRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); setSidebarOpen(false); }}
        appName={settings.appName}
        version={APP_VERSION}
        repairs={repairs}
        budgets={budgets}
        citas={citas}
        customers={customersDB}
        invoices={invoices}
        warranties={warranties}
        notificaciones={notificaciones}
        onMarcarLeida={marcarLeida}
        onMarcarTodasLeidas={marcarTodasLeidas}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        cashMovements={cashMovements}
        cierresCaja={cierresCaja}
        searchOpen={searchOpen}
        onSearchClose={() => setSearchOpen(false)}
      />

      <main className="flex-1 min-h-screen p-4 lg:p-8 pt-[72px] md:pt-4 ml-0 md:ml-14 lg:ml-[220px]" style={{ backgroundColor: '#f5f5f5' }}>

        {/* Notificaciones */}
        <div className="fixed top-6 right-6 z-[110] space-y-3 pointer-events-none">
          {notifications.map(n => (
            <div key={n.id} className="px-6 py-4 rounded-2xl bg-slate-900 text-white shadow-2xl border border-white/10 flex items-center gap-4 pointer-events-auto">
              <div className={`w-2 h-2 rounded-full shrink-0 ${n.type === 'success' ? 'bg-emerald-400' : n.type === 'error' ? 'bg-red-400' : 'bg-blue-400'}`} />
              <p className="text-[10px] font-black uppercase tracking-widest">{n.message}</p>
            </div>
          ))}
        </div>

        {/* Modal selector de documentos tras guardar RMA */}
        {pendingDocRepair && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 space-y-6">
              <div className="text-center">
                <div className="inline-flex p-4 bg-emerald-100 rounded-2xl mb-4">
                  <FileText size={32} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  RMA-{pendingDocRepair.rmaNumber.toString().padStart(5, '0')} Registrado
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                  ¿Qué documentos quieres generar?
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { setShowReceiptFor(pendingDocRepair); setPendingDocRepair(null); }}
                  className="flex flex-col items-center gap-3 p-5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-2xl transition-all group"
                >
                  <FileText size={26} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Resguardo</div>
                    <div className="text-[8px] text-blue-500 mt-1">Cliente · A4</div>
                  </div>
                </button>

                <button
                  onClick={() => { setShowTicketFor(pendingDocRepair); setPendingDocRepair(null); }}
                  className="flex flex-col items-center gap-3 p-5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl transition-all group"
                >
                  <Ticket size={26} className="text-slate-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Ticket</div>
                    <div className="text-[8px] text-slate-500 mt-1">Interno · 80mm</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const bud = budgets.find(b => b.repairId === pendingDocRepair.id);
                    printWorkOrder(pendingDocRepair, bud, settings, repairs);
                    setPendingDocRepair(null);
                  }}
                  className="flex flex-col items-center gap-3 p-5 bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 rounded-2xl transition-all group"
                >
                  <ClipboardList size={26} className="text-orange-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Orden trabajo</div>
                    <div className="text-[8px] text-orange-500 mt-1">Técnico · A4</div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setShowReceiptFor(pendingDocRepair);
                    // Después de cerrar el resguardo, mostrar el ticket
                  }}
                  className="py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all"
                >
                  Ambos documentos
                </button>
                <button
                  onClick={() => setPendingDocRepair(null)}
                  className="py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Ahora no
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resguardo del cliente */}
        {showReceiptFor && (
          <CustomerReceipt
            repair={showReceiptFor}
            settings={settings}
            onClose={() => {
              const repair = showReceiptFor;
              setShowReceiptFor(null);
              // Si venía de "Ambos documentos", mostrar el ticket a continuación
              if (repair) setShowTicketFor(repair);
            }}
            onSignatureUpdate={async (sig) => {
              if (showReceiptFor) {
                await storage.save('repairs', showReceiptFor.id, { ...showReceiptFor, customerSignature: sig });
                setShowReceiptFor(prev => prev ? { ...prev, customerSignature: sig } : null);
              }
            }}
            onFirmaUploaded={async (url, date) => {
              if (showReceiptFor) {
                await storage.save('repairs', showReceiptFor.id, { ...showReceiptFor, firmaClienteUrl: url, firmaClienteDate: date });
                setShowReceiptFor(prev => prev ? { ...prev, firmaClienteUrl: url, firmaClienteDate: date } : null);
              }
            }}
          />
        )}

        {/* Ticket térmico */}
        {showTicketFor && (
          <ThermalTicket
            repair={showTicketFor}
            settings={settings}
            onClose={() => setShowTicketFor(null)}
          />
        )}

        {(activeBudgetRepair || freeBudgetMode) ? (
          <BudgetCreator
            repair={activeBudgetRepair || undefined}
            settings={settings}
            initialBudget={editingBudget || undefined}
            inventoryItems={inventoryItems}
            customers={customersDB}
            onSave={handleSaveBudget}
            onSaveCustomer={async (c) => {
              await storage.save('customers', c.id, c);
            }}
            onClose={() => {
              if (freeBudgetMode) {
                setFreeBudgetMode(false);
              } else {
                navigateTo('repairs');
              }
            }}
          />
        ) : (
          <>
            {currentView === 'dashboard' && (
              <Dashboard
                repairs={repairs}
                budgets={budgets}
                citas={citas}
                settings={settings}
                setView={navigateTo}
                onNewRepair={() => navigateTo('new-repair')}
                onEditRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
                notificaciones={notificaciones}
              />
            )}
            {currentView === 'repairs' && (
              <RepairList
                repairs={repairs}
                budgets={budgets}
                onBack={() => navigateTo('dashboard')}
                onStatusChange={async (id, status, noteAppend) => {
                  const repair = repairs.find(r => r.id === id);
                  if (!repair) return;
                  const updatedNotes = noteAppend
                    ? [repair.notes, noteAppend].filter(Boolean).join('\n')
                    : repair.notes;
                  await storage.save('repairs', id, { ...repair, status, notes: updatedNotes });
                  if (status === RepairStatus.READY) {
                    confirm2(`¿Avisar a ${repair.customerName} por WhatsApp de que su equipo está listo?`, () => {
                      notifyReady({ ...repair, status }, settings);
                    });
                    checkRepairsReady([{ ...repair, status }]);
                  }
                  if (status === RepairStatus.CANCELLED) {
                    confirm2(`¿Avisar a ${repair.customerName} por WhatsApp de que la reparación no se realizó?`, () => {
                      notifyCancelled({ ...repair, status }, settings);
                    })
                  }
                  if (status === RepairStatus.SIN_REPARACION) {
                    notify('info', 'Reparación cerrada — Sin reparación');
                  }
                }}
                onDelete={id => confirm2('¿Eliminar esta reparación?', () => storage.remove('repairs', id))}
                onEdit={r => { setEditingRepair(r); navigateTo('new-repair'); }}
                onCreateBudget={r => setActiveBudgetRepair(r)}
                onEditBudget={b => {
                  const r = repairs.find(rep => rep.id === b.repairId);
                  if (r) { setEditingBudget(b); setActiveBudgetRepair(r); }
                }}
                onPrintReceipt={r => setShowReceiptFor(r)}
                onPrintTicket={r => setShowTicketFor(r)}
                onPrintWorkOrder={r => {
                  const bud = budgets.find(b => b.repairId === r.id);
                  printWorkOrder(r, bud, settings, repairs);
                }}
                settings={settings}
              />
            )}
            {currentView === 'new-repair' && (
              <RepairForm
                settings={settings}
                onSave={handleSaveRepair}
                onCancel={() => navigateTo('repairs')}
                initialData={editingRepair || undefined}
                repairs={repairs}
                prefillCustomer={prefillCustomer}
              />
            )}
            {currentView === 'budgets' && (
              <BudgetList
                budgets={budgets}
                repairs={repairs}
                customers={customersDB}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onNewFreeBudget={() => { setEditingBudget(null); setFreeBudgetMode(true); }}
                onViewBudget={(b) => {
                  const r = repairs.find(rep => rep.id === b.repairId);
                  if (r) {
                    setEditingBudget(b);
                    setActiveBudgetRepair(r);
                  } else {
                    setEditingBudget(b);
                    setFreeBudgetMode(true);
                  }
                }}
                onPrintBudget={(budget) => {
                  const r = repairs.find(rep => rep.id === budget.repairId);
                  if (r) {
                    setEditingBudget(budget);
                    setActiveBudgetRepair(r);
                  } else {
                    setEditingBudget(budget);
                    setFreeBudgetMode(true);
                  }
                }}
                onDeleteBudget={id => confirm2('¿Eliminar presupuesto?', () => storage.remove('budgets', id))}
                onMarkContacted={handleMarkBudgetContacted}
                onViewInvoices={() => navigateTo('invoices')}
                onReactivarBudget={(budget) => {
                  const docId = budget.documentoGenerado?.id;
                  const exists = docId && invoices.some((inv: any) => inv.id === docId);
                  if (!exists) {
                    storage.save('budgets', budget.id, { archivado: false, documentoGenerado: null });
                    notify('success', 'Presupuesto reactivado');
                  } else {
                    const docLabel = budget.documentoGenerado?.tipo === 'factura' ? 'una factura' : 'un recibo';
                    confirm2(
                      `Este presupuesto tiene ${docLabel} generado (${budget.documentoGenerado?.numero}). ¿Reactivar igualmente?`,
                      () => {
                        storage.save('budgets', budget.id, { archivado: false, documentoGenerado: null });
                        notify('success', 'Presupuesto reactivado');
                      },
                    );
                  }
                }}
                onSendWhatsApp={async (budget, repair) => {
                  const msg = buildBudgetMessage(repair, budget, settings);
                  await sendWhatsApp(repair.customerPhone, msg);
                  notify('success', `Presupuesto enviado a ${repair.customerName}`);
                }}
                onUpdateBudgetStatus={async (budget, status, motivo) => {
                  await storage.save('budgets', budget.id, {
                    ...budget,
                    status,
                    ...(motivo !== undefined ? { motivoRechazo: motivo } : {}),
                  });
                  notify('success', status === 'accepted' ? 'Presupuesto aceptado' : status === 'rejected' ? 'Presupuesto rechazado' : 'Presupuesto reactivado');
                }}
                onConvertToInvoice={async (budget, repair, tipo) => {
                  // Anti-duplicado: si ya tiene documento generado, navegar al existente
                  if (budget.archivado && budget.documentoGenerado) {
                    const { numero, tipo: docTipo } = budget.documentoGenerado;
                    confirm2(
                      `Este presupuesto ya tiene ${docTipo === 'factura' ? 'una factura' : 'un recibo'} generado (${numero}). ¿Ver el documento?`,
                      () => navigateTo('invoices'),
                    );
                    return;
                  }
                  // Anti-duplicado por repairId+serie: FAC y REC de la misma RMA son independientes
                  if (repair?.id) {
                    const newSerie = tipo ?? (budget.taxEnabled === false ? 'REC' : 'FAC');
                    const getS = (n: string) => (n ?? '').split('-')[0];
                    const existingInv = (invoices as any[]).find(inv =>
                      inv.repairId === repair.id &&
                      inv.status !== 'anulada' &&
                      getS(inv.invoiceNumber) === newSerie
                    );
                    if (existingInv) {
                      notify('error', `Ya existe ${existingInv.invoiceNumber} para esta reparación (${repair.customerName})`);
                      return;
                    }
                  }
                  const effectiveTaxRate = tipo === 'REC' ? 0 : tipo === 'FAC' ? (settings.taxRate || 21) : (budget.taxEnabled === false ? 0 : (budget.taxRate || 21));
                  const budgetSubtotal = [
                    ...budget.items.map(i => i.quantity * i.unitPrice),
                    ...budget.laborItems.map(i => i.hours * i.hourlyRate),
                  ].reduce((s, v) => s + v, 0);
                  const budgetTaxAmount = Math.round(budgetSubtotal * (effectiveTaxRate / 100) * 100) / 100;
                  const budgetTotal = Math.round((budgetSubtotal + budgetTaxAmount) * 100) / 100;
                  const invoiceNumber = storage.nextInvoiceNumber(tipo ?? (effectiveTaxRate === 0 ? 'REC' : 'FAC'));
                  const now = new Date().toISOString();
                  const rmaRef = repair ? `RMA-${String(repair.rmaNumber).padStart(5, '0')}` : 'LIBRE';

                  // Descontar stock (usa inventoryItemId si disponible, sino busca por descripción)
                  // Solo si el presupuesto no había descontado ya (budget.stockDescontado)
                  if (!budget.stockDescontado) {
                    try {
                      await descontarStock(budget.items, 'presupuesto', rmaRef);
                      storage.save('budgets', budget.id, { ...budget, status: 'accepted', stockDescontado: true });
                    } catch (stockErr) {
                      notify('error', 'Error al descontar stock — la factura se creó igualmente. Ajusta el inventario manualmente.');
                      logError('uncaught', stockErr instanceof Error ? stockErr : new Error(String(stockErr)));
                    }
                  }

                  const invoice = {
                    id: `INV-${Date.now()}`,
                    invoiceNumber,
                    repairId: repair?.id,
                    rmaNumber: repair?.rmaNumber,
                    customerName: repair?.customerName ?? budget.customerName ?? '',
                    customerPhone: repair?.customerPhone ?? budget.customerPhone ?? '',
                    customerTaxId: budget.customerTaxId,
                    date: now.slice(0, 10),
                    items: budget.items,
                    laborItems: budget.laborItems,
                    subtotal: budgetSubtotal,
                    taxAmount: budgetTaxAmount,
                    total: budgetTotal,
                    taxRate: effectiveTaxRate,
                    status: 'pendiente',
                    isRectificativa: false,
                    createdAt: now,
                    // Stock ya descontado en el paso del presupuesto
                    stockDescontado: true,
                  };
                  storage.save('invoices', invoice.id, invoice);

                  // Archivar el presupuesto (storage.save hace merge, no hace falta ...budget)
                  const tipoDoc = effectiveTaxRate === 0 ? 'recibo' : 'factura';
                  storage.save('budgets', budget.id, {
                    archivado: true,
                    documentoGenerado: { tipo: tipoDoc, numero: invoiceNumber, id: invoice.id },
                  });

                  notify('success', `${invoiceNumber} creada desde presupuesto ${rmaRef}`);
                  navigateTo('invoices');
                }}
              />
            )}
            {currentView === 'customers' && (
              <CustomerList
                repairs={repairs}
                customers={customersDB}
                invoices={invoices}
                budgets={budgets}
                warranties={warranties}
                citas={citas}
                settings={settings}
                setView={navigateTo}
                onBack={() => navigateTo('dashboard')}
                onSelectCustomer={() => {}}
                onEditRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
                onSaveCustomer={async (customer) => {
                  await storage.save('customers', customer.id, customer);
                  // Also update name in all repairs with same phone
                  const customerRepairs = (repairs).filter(r => r.customerPhone === customer.phone);
                  for (const r of customerRepairs) {
                    if (r.customerName !== customer.name) {
                      await storage.save('repairs', r.id, { ...r, customerName: customer.name });
                    }
                  }
                  notify('success', 'Cliente guardado correctamente.');
                }}
                onDeleteCustomer={async (id) => {
                  await storage.remove('customers', id);
                  notify('success', 'Cliente eliminado.');
                }}
                onNewRepairForCustomer={(customer) => {
                  setPrefillCustomer(customer);
                  setEditingRepair(null);
                  navigateTo('new-repair');
                }}
                onNewBudgetForCustomer={(customer) => {
                  setPrefillCustomer(customer);
                  setEditingBudget(null);
                  setFreeBudgetMode(true);
                  navigateTo('budgets');
                }}
                onNewCitaForCustomer={(_customer) => {
                  navigateTo('calendar');
                }}
              />
            )}
            {(currentView === 'stats' || currentView === 'estadisticas') && (
              <Suspense fallback={<LazyFallback />}>
                <Estadisticas
                  repairs={repairs}
                  invoices={invoices}
                  inventory={inventoryItems}
                  stockMovements={stockMovements}
                  cashMovements={cashMovements}
                  cierresCaja={cierresCaja}
                  settings={settings}
                  onBack={() => navigateTo('dashboard')}
                />
              </Suspense>
            )}
            {currentView === 'calendar' && (
              <CalendarView
                citas={citas}
                repairs={repairs}
                customers={customersDB}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onSaveCita={handleSaveCita}
                onDeleteCita={handleDeleteCita}
                onNotify={notify}
                onNavigateToRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
                onCreateRepairFromCita={(cita) => {
                  const newRma = storage.nextRmaNumber();
                  const repairId = `RMA-${Date.now()}`;

                  const newRepair: RepairItem = {
                    id: repairId,
                    rmaNumber: newRma,
                    repairType: cita.tipo === 'domicilio' ? 'domicilio' : 'taller',
                    customerName: cita.clienteName || '',
                    customerPhone: cita.clientePhone || '',
                    deviceType: '',
                    brand: '',
                    model: '',
                    serialNumber: '',
                    problemDescription: [
                      cita.titulo,
                      cita.descripcion ? `\nNotas: ${cita.descripcion}` : '',
                    ].filter(Boolean).join(''),
                    entryDate: new Date().toISOString(),
                    status: RepairStatus.PENDING,
                    address: cita.direccion || '',
                    city: '',
                  };

                  const updatedCita: Cita = { ...cita, repairId };
                  storage.save('citas', cita.id, updatedCita);

                  setEditingRepair(newRepair);
                  navigateTo('new-repair');
                  notify('success', `Orden creada desde cita de ${cita.clienteName}. Complete los datos del equipo.`);
                }}
              />
            )}
            {currentView === 'external-apps' && (
              <ExternalAppsView
                apps={externalApps}
                onSaveApp={handleSaveExternalApp}
                onDeleteApp={handleDeleteExternalApp}
                onViewApp={handleViewExternalApp}
                onBack={() => navigateTo('dashboard')}
              />
            )}
            {currentView === 'external-app-view' && activeExternalApp && (
              <ExternalAppViewer
                app={activeExternalApp}
                onBack={() => navigateTo('external-apps')}
              />
            )}
            {currentView === 'settings' && (
              <SettingsForm
                settings={settings}
                canInstall={canInstall}
                onInstall={handleInstallPWA}
                version={APP_VERSION}
                onSave={s => {
                  storage.save('settings', 'global', { ...s, id: 'global' });
                  notify('success', 'Configuración actualizada.');
                }}
                onBack={() => navigateTo('dashboard')}
              />
            )}
            {currentView === 'despacho' && (
              <Despacho
                repairs={repairs}
                budgets={budgets}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onStatusChange={async (id, status) => {
                  const repair = repairs.find(r => r.id === id);
                  if (repair) await storage.save('repairs', id, { ...repair, status });
                }}
                onNotify={notify}
              />
            )}
            {currentView === 'invoices' && (
              <Suspense fallback={<LazyFallback />}>
                <Facturacion
                  settings={settings}
                  customers={customersDB}
                  invoices={invoices}
                  inventoryItems={inventoryItems}
                  repairs={repairs}
                  onBack={() => navigateTo('dashboard')}
                  onNotify={notify}
                  onSaveCustomer={async (customer) => {
                    await storage.save('customers', customer.id, customer);
                    notify('success', `${customer.name} guardado en la agenda`);
                  }}
                />
              </Suspense>
            )}
            {currentView === 'inventory' && (
              <Suspense fallback={<LazyFallback />}>
                <Inventario
                  settings={settings}
                  inventoryItems={inventoryItems}
                  stockMovements={stockMovements}
                  onBack={() => navigateTo('dashboard')}
                  onNotify={notify}
                />
              </Suspense>
            )}
            {currentView === 'inventory-entrada' && (
              <Suspense fallback={<LazyFallback />}>
                <EntradaStock
                  settings={settings}
                  inventoryItems={inventoryItems}
                  onNotify={notify}
                  onBack={() => navigateTo('dashboard')}
                  preFillData={preFillEntrada}
                  onPreFillConsumed={() => setPreFillEntrada(null)}
                />
              </Suspense>
            )}
            {currentView === 'correos' && (
              <Suspense fallback={<LazyFallback />}>
                <Correos
                  settings={settings}
                  onImportToStock={(datos) => {
                    setPreFillEntrada(datos);
                    navigateTo('inventory-entrada');
                  }}
                  onBack={() => navigateTo('dashboard')}
                />
              </Suspense>
            )}
            {currentView === 'archivo-facturas' && (
              <Suspense fallback={<LazyFallback />}>
                <ArchivoFacturas
                  settings={settings}
                  onBack={() => navigateTo('dashboard')}
                  onViewSupplier={(name) => {
                    setSupplierToOpen(name);
                    navigateTo('suppliers');
                  }}
                />
              </Suspense>
            )}
            {currentView === 'suppliers' && (
              <Suspense fallback={<LazyFallback />}>
                <Proveedores
                  settings={settings}
                  suppliers={suppliers}
                  facturasImportadas={facturasImportadas}
                  stockMovements={stockMovements}
                  onBack={() => navigateTo('dashboard')}
                  onNotify={notify}
                  initialSupplierName={supplierToOpen}
                />
              </Suspense>
            )}
            {currentView === 'informes' && (
              <Suspense fallback={<LazyFallback />}>
                <Informes
                  invoices={invoices}
                  repairs={repairs}
                  inventory={inventoryItems}
                  stockMovements={stockMovements}
                  facturasImportadas={facturasImportadas}
                  settings={settings}
                  informes={informes}
                  onBack={() => navigateTo('dashboard')}
                  onNotify={notify}
                />
              </Suspense>
            )}
            {currentView === 'garantias' && (
              <Suspense fallback={<LazyFallback />}>
                <Garantias
                  warranties={warranties}
                  repairs={repairs}
                  settings={settings}
                  onBack={() => navigateTo('dashboard')}
                  onNotify={notify}
                  onViewRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
                />
              </Suspense>
            )}
            {currentView === 'caja' && (
              <Suspense fallback={<LazyFallback />}>
                <Caja
                  cashMovements={cashMovements}
                  cierresCaja={cierresCaja}
                  facturasImportadas={facturasImportadas}
                  settings={settings}
                  onBack={() => navigateTo('dashboard')}
                  onViewArchivo={() => navigateTo('archivo-facturas')}
                  onNotify={notify}
                />
              </Suspense>
            )}
          </>
        )}

        {/* Modal de confirmación */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-3">
                <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{confirmModal.msg}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Esta acción no se puede deshacer</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { confirmModal.onYes(); setConfirmModal(null); }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

    {/* ── WhatsApp reminder modal ── */}
    {reminderCitas.length > 0 && (
      <CitaReminderModal
        citas={reminderCitas}
        settings={settings}
        onSent={handleReminderSent}
        onClose={() => setReminderCitas([])}
      />
    )}
    </SyncStatusProvider>
  );
};

export default App;
