import React, { useState, useRef } from 'react';
import {
  LayoutDashboard, Wrench, PlusCircle, FileText,
  Settings, TrendingUp, Users,
  Calendar, AppWindow,
  Zap, Package, Receipt, ShieldCheck, FolderOpen, Inbox, Truck, FileBarChart,
  Bell, X, ArrowRight, ShieldAlert, Wallet
} from 'lucide-react';
import { ViewType, RepairItem, Budget, Cita, Warranty, Notificacion, Customer } from '../types';
import { storage } from '../lib/dataService';
import SyncIndicator from './SyncIndicator';
import GlobalSearch from './GlobalSearch';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onNewRepair: () => void;
  onEditRepair: (repair: RepairItem) => void;
  appName: string;
  version?: string;
  repairs: RepairItem[];
  budgets: Budget[];
  citas: Cita[];
  customers?: Customer[];
  invoices?: any[];
  warranties?: Warranty[];
  notificaciones?: Notificacion[];
  onMarcarLeida?: (id: string) => void;
  onMarcarTodasLeidas?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  cashMovements?: any[];
  cierresCaja?: any[];
  searchOpen?: boolean;
  onSearchClose?: () => void;
}

type NavItem = { id: ViewType | 'new-repair'; label: string; icon: React.ElementType; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

const GREEN = '#2e7d32';

const NOTIF_ICONS: Record<string, React.ElementType> = {
  garantia: ShieldAlert,
  stock: Package,
  cita: Calendar,
  reparacion: Wrench,
  factura: Receipt,
};
const NOTIF_COLORS: Record<string, string> = {
  garantia: '#c62828',
  stock: '#f57f17',
  cita: '#1565c0',
  reparacion: '#e65100',
  factura: '#6a1b9a',
};
const PRIO_DOT: Record<string, string> = { alta: '#c62828', media: '#f57f17', baja: '#388e3c' };
const TIPO_LABEL: Record<string, string> = {
  garantia: 'Garantías', stock: 'Stock', cita: 'Citas', reparacion: 'Reparaciones', factura: 'Facturas',
};

const Sidebar: React.FC<SidebarProps> = ({
  currentView, setView, onNewRepair, onEditRepair,
  appName, repairs, budgets, citas, customers = [], invoices = [], warranties = [],
  notificaciones = [], onMarcarLeida, onMarcarTodasLeidas,
  isOpen = false, onClose, cashMovements = [], cierresCaja = [],
  searchOpen, onSearchClose,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  const unreadNotifs = notificaciones.filter(n => !n.leida);
  const altaCount = unreadNotifs.filter(n => n.prioridad === 'alta').length;

  const readyCount  = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const activeCount = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;
  const todayCitasCount = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return citas.filter(c => c.fecha === today && c.estado !== 'cancelada' && c.estado !== 'completada').length;
  })();

  const warrantyAlertCount = (() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    return warranties.filter(w => {
      if (w.status === 'reclamada') return false;
      const exp = new Date(w.expiryDate);
      exp.setHours(0, 0, 0, 0);
      const days = Math.floor((exp.getTime() - todayMs) / 86400000);
      return days >= 0 && days <= 7;
    }).length;
  })();

  const cajaBadge = (() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().slice(0, 10);
    const cierreAyer = cierresCaja.find((c: any) => c.fecha === ayerStr);
    const aperturaAyer = cashMovements.some((m: any) =>
      (m.fecha || m.date || '').slice(0, 10) === ayerStr && (m.tipo || m.type) === 'apertura'
    );
    return (aperturaAyer && !cierreAyer) ? 1 : 0;
  })();

  const groups: NavGroup[] = [
    {
      label: 'Principal',
      items: [
        { id: 'dashboard',         label: 'Monitor',          icon: LayoutDashboard },
        { id: 'new-repair',        label: 'Nueva Reparación', icon: PlusCircle },
        { id: 'repairs',           label: 'Reparaciones',     icon: Wrench,      badge: activeCount },
        { id: 'despacho',          label: 'Despacho',         icon: Zap,         badge: readyCount },
      ]
    },
    {
      label: 'Gestión',
      items: [
        { id: 'budgets',           label: 'Presupuestos',     icon: FileText },
        { id: 'invoices',          label: 'Facturas',         icon: Receipt },
        { id: 'caja',              label: 'Caja Diaria',      icon: Wallet,      badge: cajaBadge || undefined },
        { id: 'customers',         label: 'Clientes',         icon: Users },
        { id: 'correos',           label: 'Facturas Recibidas', icon: Inbox },
        { id: 'archivo-facturas',  label: 'Archivo Facturas', icon: FolderOpen },
        { id: 'suppliers',         label: 'Proveedores',       icon: Truck },
        { id: 'calendar',          label: 'Planificador',     icon: Calendar,    badge: todayCitasCount },
      ]
    },
    {
      label: 'Almacén',
      items: [
        { id: 'inventory',         label: 'Inventario',       icon: Package },
        { id: 'inventory-entrada', label: 'Entrada Stock',    icon: Package },
        { id: 'garantias',         label: 'Garantías',        icon: ShieldCheck, badge: warrantyAlertCount },
      ]
    },
    {
      label: 'Sistema',
      items: [
        { id: 'informes',          label: 'Informes',         icon: FileBarChart },
        { id: 'estadisticas',      label: 'Estadísticas',     icon: TrendingUp },
        { id: 'external-apps',     label: 'Módulos Ext.',     icon: AppWindow },
        { id: 'settings',          label: 'Ajustes',          icon: Settings },
      ]
    },
  ];

  const getBadgeStyle = (id: string): React.CSSProperties =>
    id === 'garantias'
      ? { background: '#b71c1c', color: '#fff' }
      : { background: GREEN, color: '#fff' };

  const handleNav = (id: string) => {
    if (id === 'new-repair') { onNewRepair(); } else { setView(id as ViewType); }
    onClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[39] md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar-responsive h-screen flex flex-col fixed left-0 top-0 z-40 no-print transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0`}
        style={{ width: 220, background: '#0a0a0a', borderRight: '1px solid #1e1e1e', fontFamily: "'Barlow Condensed', sans-serif" }}
      >
      {/* ── Logo ── */}
      <div className="px-4 py-5 flex items-center" style={{ borderBottom: '1px solid #1a1a1a', minHeight: 64 }}>
        <button
          onClick={() => handleNav('dashboard')}
          className="flex items-center gap-3 w-full text-left group"
        >
          <div
            className="sidebar-logo-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xl leading-none text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${GREEN}, #4caf50)` }}
          >
            {appName.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-logo-text min-w-0 flex-1">
            <div className="text-[12px] font-black tracking-widest uppercase text-white leading-tight break-words line-clamp-2 group-hover:opacity-90 transition-opacity">
              {appName}
            </div>
            <div className="text-[8px] font-bold uppercase tracking-[0.18em] mt-1" style={{ color: '#4caf50' }}>
              v8 · Taller Pro
            </div>
          </div>
        </button>
      </div>

      {/* ── Search ── */}
      <div className="sidebar-search-wrap px-3 pt-3 pb-1">
        <GlobalSearch
          repairs={repairs} budgets={budgets}
          customers={customers} invoices={invoices}
          onNavigate={(v) => { setView(v); onClose?.(); }}
          onEditRepair={onEditRepair}
          externalOpen={searchOpen}
          onExternalClose={onSearchClose}
        />
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && (
              <div className="sidebar-section-header mx-3 my-2 flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: '#1e1e1e' }} />
                <span className="text-[7px] font-black uppercase tracking-[0.25em]" style={{ color: '#2a2a2a' }}>
                  {group.label}
                </span>
                <div className="flex-1 h-px" style={{ background: '#1e1e1e' }} />
              </div>
            )}
            {gi === 0 && (
              <p className="sidebar-section-header px-3 pt-0 pb-1 text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: '#333' }}>
                {group.label}
              </p>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isNew    = item.id === 'new-repair';
              const isActive = !isNew && currentView === item.id;
              return (
                <button
                  key={item.id}
                  title={item.label}
                  onClick={() => handleNav(item.id)}
                  className={`sidebar-nav-btn w-full flex items-center gap-2.5 px-3 py-[7px] text-[11px] font-black uppercase tracking-wide mb-px group${isActive ? ' is-active' : ''}`}
                  style={isActive ? { color: '#4caf50' } : { color: '#777' }}
                >
                  <Icon
                    size={14}
                    style={{ color: isActive ? '#4caf50' : '#444', flexShrink: 0 }}
                    className={isActive ? '' : 'group-hover:!text-[#4caf50]'}
                  />
                  <span className="sidebar-label flex-1 text-left truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="sidebar-label text-[9px] font-black px-1.5 py-px leading-none rounded-full"
                      style={getBadgeStyle(item.id as string)}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bell ── */}
      <div className="px-3 pt-2 pb-1" style={{ borderTop: '1px solid #1e1e1e' }}>
        <button
          ref={bellRef}
          onClick={() => setNotifOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
          style={{ background: notifOpen ? '#1e1e1e' : 'transparent', color: altaCount > 0 ? '#ff5252' : '#666' }}
        >
          <Bell size={14} style={{ flexShrink: 0 }} />
          <span className="sidebar-label flex-1 text-left text-[10px] font-black uppercase tracking-widest">Notificaciones</span>
          {unreadNotifs.length > 0 && (
            <span className="text-[9px] font-black px-1.5 py-px rounded-full"
              style={{ background: altaCount > 0 ? '#c62828' : '#555', color: '#fff' }}>
              {unreadNotifs.length > 99 ? '99+' : unreadNotifs.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Notification panel overlay ── */}
      {notifOpen && (
        <>
          <div className="fixed inset-0 z-[490]" onClick={() => setNotifOpen(false)} />
          <div
            className="fixed top-0 bottom-0 z-[491] flex flex-col left-0 right-0 md:left-[220px] md:right-auto md:w-[320px] lg:left-[220px]"
            style={{ background: '#fff', boxShadow: '6px 0 24px rgba(0,0,0,0.18)' }}
          >
            {/* Panel header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
              <Bell size={16} style={{ color: '#1565c0' }} />
              <p className="flex-1 text-sm font-black uppercase tracking-widest text-slate-900">Notificaciones</p>
              {unreadNotifs.length > 0 && (
                <button
                  onClick={() => { onMarcarTodasLeidas?.(); }}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors px-2 py-1"
                >
                  Leer todas
                </button>
              )}
              <button onClick={() => setNotifOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={15} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              {unreadNotifs.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Bell size={20} style={{ color: '#2e7d32' }} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Todo en orden</p>
                </div>
              ) : (
                <div className="py-2">
                  {(['cita', 'garantia', 'reparacion', 'stock', 'factura'] as const).map(tipo => {
                    const group = unreadNotifs.filter(n => n.tipo === tipo);
                    if (!group.length) return null;
                    const Icon = NOTIF_ICONS[tipo];
                    const color = NOTIF_COLORS[tipo];
                    return (
                      <div key={tipo}>
                        <p className="px-4 py-1.5 text-[8px] font-black uppercase tracking-widest"
                          style={{ color, background: `${color}10` }}>
                          {TIPO_LABEL[tipo]} ({group.length})
                        </p>
                        {group.map(n => (
                          <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${color}15` }}>
                              <Icon size={13} style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: PRIO_DOT[n.prioridad] }} />
                                <p className="text-[11px] font-black text-slate-900 truncate">{n.titulo}</p>
                              </div>
                              <p className="text-[9px] text-slate-500 font-bold truncate">{n.mensaje}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              {n.vistaDestino && (
                                <button
                                  onClick={() => {
                                    onMarcarLeida?.(n.id);
                                    setView(n.vistaDestino as ViewType);
                                    setNotifOpen(false);
                                  }}
                                  className="p-1 rounded hover:bg-slate-100 transition-colors"
                                  title="Ver">
                                  <ArrowRight size={12} style={{ color }} />
                                </button>
                              )}
                              <button
                                onClick={() => onMarcarLeida?.(n.id)}
                                className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                                title="Marcar como leída">
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Sync ── */}
      <div className="p-3" style={{ borderTop: '1px solid #1e1e1e' }}>
        <SyncIndicator
          variant="full"
          onClick={async () => { try { await storage.syncNow(); } catch {} }}
        />
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
