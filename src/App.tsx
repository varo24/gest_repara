import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StatsView from './components/StatsView';
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
import SupabaseDiagnostic from './components/SupabaseDiagnostic';
import Despacho from './components/Despacho';
import Facturacion from './components/Facturacion';
import Inventario from './components/Inventario';
import EntradaStock from './components/EntradaStock';
import Garantias from './components/Garantias';
import { ViewType, RepairItem, Budget, AppSettings, AppNotification, RepairStatus, Cita, ExternalApp, Customer, InventoryItem, StockMovement, Warranty } from './types';
import { storage } from './lib/dataService';
import { notifyReady, notifyCancelled, buildBudgetMessage, sendWhatsApp } from './services/whatsappService';
import { Loader2, FileText, Ticket } from 'lucide-react';

const APP_VERSION = '6.6.0 UNIFIED';

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'ReparaPro Master',
  address: 'Calle Técnica 123, Local 5',
  phone: '900 000 000',
  taxId: 'B-12345678',
  technicians: ['Técnico Senior', 'Ayudante'],
  hourlyRate: 45,
  taxRate: 21,
  letterhead: 'Garantía de 3 meses en mano de obra. Validez del presupuesto: 15 días.',
  dashboardModules: ['new-repair','repairs','despacho','budgets','invoices','customers','inventory','inventory-entrada','garantias','calendar','stats','external-apps','settings'],
  legalTerms: 'LOS PRESUPUESTOS QUE NO SUPEREN LOS 40€ NO REQUIEREN FIRMA DEL CLIENTE. EL TALLER NO SE HACE RESPONSABLE DE LA PÉRDIDA DE DATOS. SE RECOMIENDA REALIZAR UNA COPIA DE SEGURIDAD ANTES DE ENTREGAR EL EQUIPO. LOS EQUIPOS NO RETIRADOS EN UN PLAZO DE 6 MESES DESDE LA NOTIFICACIÓN AL CLIENTE PODRÁN SER OBJETO DE TRATAMIENTO CONFORME A LA NORMATIVA VIGENTE. EL PRESUPUESTO TIENE UNA VALIDEZ DE 15 DÍAS DESDE SU EMISIÓN. SE APLICARÁ EL IVA VIGENTE EN EL MOMENTO DE LA FACTURACIÓN.',
  geminiApiKey: 'AIzaSyCWd8-GlAYySsWrLRrQzLpvoDSRqWfqGKE',
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [repairs, setRepairs] = useState<RepairItem[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
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
  const [citas, setCitas] = useState<Cita[] | null>(null);
  const [externalApps, setExternalApps] = useState<ExternalApp[] | null>(null);
  const [activeExternalApp, setActiveExternalApp] = useState<ExternalApp | null>(null);
  const [customersDB, setCustomersDB] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);

  // Estados para los documentos post-guardado
  const [showReceiptFor, setShowReceiptFor] = useState<RepairItem | null>(null);
  const [showTicketFor, setShowTicketFor] = useState<RepairItem | null>(null);
  const [pendingDocRepair, setPendingDocRepair] = useState<RepairItem | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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
    const initApp = async () => {
      try {
        await storage.init();
        storage.subscribe('repairs', (data) => { 
          console.log('[App] repairs subscription fired:', data.length, 'items');
          setRepairs(data); 
          setLoading(false); 
        });
        storage.subscribe('budgets', setBudgets);
        storage.subscribe('settings', (data) => {
          if (data && data.length > 0) setSettings(data[0]);
        });
        storage.subscribe('invoices', setInvoices);
        storage.subscribe('citas', setCitas);
        storage.subscribe('apps_externas', setExternalApps);
        storage.subscribe('customers', setCustomersDB);
        storage.subscribe('inventory', setInventoryItems);
        storage.subscribe('stock_movements', setStockMovements);
        storage.subscribe('warranties', setWarranties);
      } catch (err) {
        console.error('Init Error:', err);
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    if (view !== 'new-repair') { setEditingRepair(null); setPrefillCustomer(null); }
    setEditingBudget(null);
    setActiveBudgetRepair(null);
    if (view !== 'external-app-view') setActiveExternalApp(null);
  };

  // Citas handlers
  const handleSaveCita = async (cita: Cita) => {
    storage.save('citas', cita.id, cita);
    notify('success', `Cita para ${cita.clienteNombre} guardada.`);
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
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em]">Inicializando ReparaPro...</p>
    </div>
  );

  // Pantalla de PIN
  if (!unlocked) return (
    <PinScreen
      onUnlock={() => setUnlocked(true)}
    />
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 no-print">
      <Sidebar
        currentView={currentView}
        setView={navigateTo}
        onNewRepair={() => navigateTo('new-repair')}
        onEditRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
        appName={settings.appName}
        version={APP_VERSION}
        repairs={repairs ?? []}
        budgets={budgets ?? []}
        citas={citas ?? []}
        warranties={warranties}
      />

      <main className="flex-1 p-4 md:p-6 ml-64 md:p-10 min-h-screen">

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

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setShowReceiptFor(pendingDocRepair); setPendingDocRepair(null); }}
                  className="flex flex-col items-center gap-3 p-6 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-2xl transition-all group"
                >
                  <FileText size={28} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Resguardo</div>
                    <div className="text-[9px] text-blue-500 mt-1">Para el cliente · A4</div>
                  </div>
                </button>

                <button
                  onClick={() => { setShowTicketFor(pendingDocRepair); setPendingDocRepair(null); }}
                  className="flex flex-col items-center gap-3 p-6 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl transition-all group"
                >
                  <Ticket size={28} className="text-slate-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ticket</div>
                    <div className="text-[9px] text-slate-500 mt-1">Interno · 80mm</div>
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
                repairs={repairs ?? []}
                budgets={budgets ?? []}
                citas={citas ?? []}
                settings={settings}
                setView={navigateTo}
                onNewRepair={() => navigateTo('new-repair')}
                onEditRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
              />
            )}
            {currentView === 'repairs' && (
              <RepairList
                repairs={repairs ?? []}
                budgets={budgets ?? []}
                selectedIds={[]}
                onToggleSelect={() => {}}
                onSelectAll={() => {}}
                onBack={() => navigateTo('dashboard')}
                onStatusChange={async (id, status) => {
                  console.log(`[App] STATUS CHANGE requested: ${id} → ${status}`);
                  const repair = repairs?.find(r => r.id === id);
                  if (!repair) { console.error('[App] Repair not found:', id); return; }
                  console.log(`[App] Saving status: ${repair.status} → ${status}`);
                  await storage.save('repairs', id, { ...repair, status });
                  console.log(`[App] Save complete for ${id}`);
                  if (status === RepairStatus.READY) {
                    confirm2(`¿Avisar a ${repair.customerName} por WhatsApp de que su equipo está listo?`, () => {
                      notifyReady({ ...repair, status }, settings);
                    })
                  }
                  if (status === RepairStatus.CANCELLED) {
                    confirm2(`¿Avisar a ${repair.customerName} por WhatsApp de que la reparación no se realizó?`, () => {
                      notifyCancelled({ ...repair, status }, settings);
                    })
                  }
                }}
                onDelete={id => confirm2('¿Eliminar esta reparación?', () => storage.remove('repairs', id))}
                onEdit={r => { setEditingRepair(r); navigateTo('new-repair'); }}
                onCreateBudget={r => setActiveBudgetRepair(r)}
                onEditBudget={b => {
                  const r = repairs?.find(rep => rep.id === b.repairId);
                  if (r) { setEditingBudget(b); setActiveBudgetRepair(r); }
                }}
                onPrintReceipt={r => setShowReceiptFor(r)}
                onPrintTicket={r => setShowTicketFor(r)}
                settings={settings}
              />
            )}
            {currentView === 'new-repair' && (
              <RepairForm
                settings={settings}
                onSave={handleSaveRepair}
                onCancel={() => navigateTo('repairs')}
                initialData={editingRepair || undefined}
                repairs={repairs ?? []}
                prefillCustomer={prefillCustomer}
              />
            )}
            {currentView === 'budgets' && (
              <BudgetList
                budgets={budgets ?? []}
                repairs={repairs ?? []}
                customers={customersDB}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onNewFreeBudget={() => { setEditingBudget(null); setFreeBudgetMode(true); }}
                onViewBudget={(b) => {
                  const r = repairs?.find(rep => rep.id === b.repairId);
                  if (r) {
                    setEditingBudget(b);
                    setActiveBudgetRepair(r);
                  } else {
                    setEditingBudget(b);
                    setFreeBudgetMode(true);
                  }
                }}
                onPrintBudget={(budget) => {
                  const r = repairs?.find(rep => rep.id === budget.repairId);
                  if (r) {
                    setEditingBudget(budget);
                    setActiveBudgetRepair(r);
                  } else {
                    setEditingBudget(budget);
                    setFreeBudgetMode(true);
                  }
                }}
                onDeleteBudget={id => confirm2('¿Eliminar presupuesto?', () => storage.remove('budgets', id))}
                onSendWhatsApp={async (budget, repair) => {
                  const msg = buildBudgetMessage(repair, budget, settings);
                  await sendWhatsApp(repair.customerPhone, msg);
                  notify('success', `Presupuesto enviado a ${repair.customerName}`);
                }}
                onConvertToInvoice={async (budget, repair) => {
                  const effectiveTaxRate = budget.taxEnabled === false ? 0 : (budget.taxRate || 21);
                  const budgetSubtotal = [
                    ...budget.items.map(i => i.quantity * i.unitPrice),
                    ...budget.laborItems.map(i => i.hours * i.hourlyRate),
                  ].reduce((s, v) => s + v, 0);
                  const budgetTaxAmount = Math.round(budgetSubtotal * (effectiveTaxRate / 100) * 100) / 100;
                  const budgetTotal = Math.round((budgetSubtotal + budgetTaxAmount) * 100) / 100;
                  const invoiceNumber = storage.nextInvoiceNumber(effectiveTaxRate === 0 ? 'REC' : 'FAC');
                  const now = new Date().toISOString();
                  const invoice = {
                    id: `INV-${Date.now()}`,
                    invoiceNumber,
                    repairId: repair.id,
                    rmaNumber: repair.rmaNumber,
                    customerName: repair.customerName,
                    customerPhone: repair.customerPhone,
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
                  };
                  storage.save('invoices', invoice.id, invoice);
                  // Deduct inventory stock for linked items
                  for (const item of budget.items) {
                    if (!item.inventoryItemId) continue;
                    const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
                    if (!invItem) continue;
                    const newStock = Math.max(0, invItem.stock - item.quantity);
                    await storage.save('inventory', invItem.id, { ...invItem, stock: newStock, updatedAt: now });
                    const movement: StockMovement = {
                      id: crypto.randomUUID(),
                      itemId: invItem.id,
                      ref: invItem.ref,
                      description: invItem.description,
                      type: 'salida',
                      qty: -item.quantity,
                      costPrice: invItem.costPrice,
                      date: now.slice(0, 10),
                      origin: 'presupuesto',
                      notes: `RMA-${String(repair.rmaNumber).padStart(5, '0')}`,
                      createdAt: now,
                    };
                    await storage.save('stock_movements', movement.id, movement);
                  }
                  notify('success', `${invoiceNumber} creada desde presupuesto RMA-${String(repair.rmaNumber).padStart(5,'0')}`);
                  navigateTo('invoices');
                }}
              />
            )}
            {currentView === 'customers' && (
              <CustomerList
                repairs={repairs ?? []}
                customers={customersDB}
                onBack={() => navigateTo('dashboard')}
                onSelectCustomer={() => {}}
                onEditRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
                onSaveCustomer={async (customer) => {
                  await storage.save('customers', customer.id, customer);
                  // Also update name in all repairs with same phone
                  const customerRepairs = (repairs ?? []).filter(r => r.customerPhone === customer.phone);
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
              />
            )}
            {currentView === 'stats' && <StatsView repairs={repairs ?? []} budgets={budgets ?? []} onBack={() => navigateTo('dashboard')} />}
            {currentView === 'calendar' && (
              <CalendarView
                citas={citas ?? []}
                repairs={repairs ?? []}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onSaveCita={handleSaveCita}
                onDeleteCita={handleDeleteCita}
                onNavigateToRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
                onCreateRepairFromCita={(cita) => {
                  // Generate new RMA number
                  const newRma = storage.nextRmaNumber();
                  const repairId = `RMA-${Date.now()}`;

                  // Create repair from cita data
                  const newRepair: RepairItem = {
                    id: repairId,
                    rmaNumber: newRma,
                    repairType: cita.direccion ? 'domicilio' : 'taller',
                    customerName: cita.clienteNombre,
                    customerPhone: cita.telefono || '',
                    deviceType: '',
                    brand: '',
                    model: '',
                    serialNumber: '',
                    problemDescription: [
                      cita.servicio,
                      cita.notas ? `\n--- Notas de inspección ---\n${cita.notas}` : '',
                    ].filter(Boolean).join(''),
                    entryDate: new Date().toISOString(),
                    status: RepairStatus.PENDING,
                    address: cita.direccion || '',
                    city: cita.ciudad || '',
                  };

                  // Link cita → repair
                  const updatedCita: Cita = { ...cita, rmaId: repairId };
                  storage.save('citas', cita.id, updatedCita);

                  // Open repair form pre-filled
                  setEditingRepair(newRepair);
                  navigateTo('new-repair');
                  notify('success', `Orden de trabajo creada desde cita de ${cita.clienteNombre}. Complete los datos del equipo.`);
                }}
              />
            )}
            {currentView === 'external-apps' && (
              <ExternalAppsView
                apps={externalApps ?? []}
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
                repairs={repairs ?? []}
                budgets={budgets ?? []}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onStatusChange={async (id, status) => {
                  const repair = repairs?.find(r => r.id === id);
                  if (repair) await storage.save('repairs', id, { ...repair, status });
                }}
                onNotify={notify}
              />
            )}
            {currentView === 'invoices' && (
              <Facturacion
                settings={settings}
                customers={customersDB}
                invoices={invoices}
                inventoryItems={inventoryItems}
                onBack={() => navigateTo('dashboard')}
                onNotify={notify}
                onSaveCustomer={async (customer) => {
                  await storage.save('customers', customer.id, customer);
                  notify('success', `${customer.name} guardado en la agenda`);
                }}
              />
            )}
            {currentView === 'inventory' && (
              <Inventario
                settings={settings}
                inventoryItems={inventoryItems}
                stockMovements={stockMovements}
                onBack={() => navigateTo('dashboard')}
                onNotify={notify}
              />
            )}
            {currentView === 'inventory-entrada' && (
              <EntradaStock
                settings={settings}
                inventoryItems={inventoryItems}
                onNotify={notify}
                onBack={() => navigateTo('dashboard')}
              />
            )}
            {currentView === 'garantias' && (
              <Garantias
                warranties={warranties}
                repairs={repairs ?? []}
                settings={settings}
                onBack={() => navigateTo('dashboard')}
                onNotify={notify}
                onViewRepair={(r) => { setEditingRepair(r); navigateTo('new-repair'); }}
              />
            )}
            {currentView === 'diagnostic' && (
              <SupabaseDiagnostic onClose={() => navigateTo('settings')} />
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
  );
};

export default App;
