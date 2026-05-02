import React from 'react';
import {
  GiAutoRepair, GiGearStickPattern, GiMoneyStack,
  GiShield, GiCardboardBox, GiTruck, GiCalendar, GiChart
} from 'react-icons/gi';
import {
  FaUserFriends, FaFileInvoiceDollar, FaClipboardCheck,
  FaPuzzlePiece, FaSlidersH, FaCheckCircle
} from 'react-icons/fa';
import { MdElectricBolt } from 'react-icons/md';
import { ViewType, RepairItem, Budget, Cita, AppSettings } from '../types';

interface DashboardProps {
  repairs: RepairItem[];
  budgets: Budget[];
  citas: Cita[];
  settings: AppSettings;
  setView: (view: ViewType) => void;
  onNewRepair: () => void;
  onEditRepair: (repair: RepairItem) => void;
}

type Module = {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  iconColor: string;
  action: () => void;
  badge?: number;
};

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair }) => {
  const activeRepairs  = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;
  const readyRepairs   = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const pendingBudgets = budgets.filter(b => b.status === 'pending').length;
  const todayCitas     = citas.filter(c => c.fecha?.startsWith(new Date().toISOString().slice(0, 10))).length;

  const stats = [
    { label: 'Activas',      value: activeRepairs,  color: '#66bb6a', icon: GiGearStickPattern, action: () => setView('repairs') },
    { label: 'Listas',       value: readyRepairs,   color: '#00e676', icon: FaCheckCircle,      action: () => setView('despacho') },
    { label: 'Presupuestos', value: pendingBudgets, color: '#ce93d8', icon: FaClipboardCheck,   action: () => setView('budgets') },
    { label: 'Citas hoy',    value: todayCitas,     color: '#ffd54f', icon: GiCalendar,         action: () => setView('calendar') },
  ];

  const allModules: Module[] = [
    { id: 'new-repair',        label: 'Nueva Reparación', desc: 'Registrar entrada de equipo',          icon: GiAutoRepair,        iconColor: '#42a5f5', action: onNewRepair },
    { id: 'repairs',           label: 'Reparaciones',     desc: `${activeRepairs} activas en taller`,    icon: GiGearStickPattern,  iconColor: '#ff7043', action: () => setView('repairs'),          badge: activeRepairs },
    { id: 'despacho',          label: 'Despacho',         desc: `${readyRepairs} listos para entregar`,  icon: MdElectricBolt,      iconColor: '#66bb6a', action: () => setView('despacho'),         badge: readyRepairs },
    { id: 'budgets',           label: 'Presupuestos',     desc: `${pendingBudgets} pendientes`,          icon: FaClipboardCheck,    iconColor: '#ab47bc', action: () => setView('budgets') },
    { id: 'invoices',          label: 'Facturas',         desc: 'Emisión y cobro',                       icon: FaFileInvoiceDollar, iconColor: '#ffca28', action: () => setView('invoices') },
    { id: 'customers',         label: 'Clientes',         desc: 'Agenda y ficha de cliente',             icon: FaUserFriends,       iconColor: '#26c6da', action: () => setView('customers') },
    { id: 'inventory',         label: 'Inventario',       desc: 'Stock de piezas',                       icon: GiCardboardBox,      iconColor: '#ffa726', action: () => setView('inventory') },
    { id: 'inventory-entrada', label: 'Entrada Stock',    desc: 'Registrar entradas de almacén',         icon: GiTruck,             iconColor: '#5c6bc0', action: () => setView('inventory-entrada') },
    { id: 'garantias',         label: 'Garantías',        desc: 'Control de vencimientos',               icon: GiShield,            iconColor: '#ef5350', action: () => setView('garantias') },
    { id: 'calendar',          label: 'Planificador',     desc: `${todayCitas} citas hoy`,               icon: GiCalendar,          iconColor: '#26a69a', action: () => setView('calendar') },
    { id: 'stats',             label: 'Rendimiento',      desc: 'Estadísticas del taller',               icon: GiChart,             iconColor: '#78909c', action: () => setView('stats') },
    { id: 'external-apps',     label: 'Módulos Ext.',     desc: 'Aplicaciones integradas',               icon: FaPuzzlePiece,       iconColor: '#8d6e63', action: () => setView('external-apps') },
    { id: 'settings',          label: 'Ajustes',          desc: 'Configuración del sistema',             icon: FaSlidersH,          iconColor: '#90a4ae', action: () => setView('settings') },
  ];

  const visibleIds = settings.dashboardModules && settings.dashboardModules.length > 0
    ? settings.dashboardModules
    : allModules.map(m => m.id);

  const modules = allModules.filter(m => visibleIds.includes(m.id));

  return (
    <div className="min-h-screen" style={{ background: '#111111' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32, #388e3c)' }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white shrink-0"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          {(settings.appName || 'T').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-[22px] font-black uppercase tracking-widest text-white leading-none">
            {settings.appName}
          </h1>
          <p className="text-[11px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {[settings.address, settings.phone ? `Tel. ${settings.phone}` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4 px-6 pt-6 pb-2">
        {stats.map(s => {
          const StatIcon = s.icon;
          return (
            <button
              key={s.label}
              onClick={s.action}
              className="stat-card text-left active:scale-95"
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: 20,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '--stat-color': s.color,
              } as React.CSSProperties}
            >
              <div className="flex items-center gap-2">
                <StatIcon size={14} style={{ color: s.color, flexShrink: 0 }} />
                <span className="text-[28px] font-black leading-none" style={{ color: s.color }}>{s.value}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] block mt-2" style={{ color: '#555' }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Module grid ── */}
      <div className="grid grid-cols-3" style={{ gap: 16, padding: 24 }}>
        {modules.map(mod => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              onClick={mod.action}
              className="module-card relative flex flex-col items-center text-center active:scale-95"
              style={{
                padding: 24,
                borderRadius: 16,
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                '--module-color': mod.iconColor,
              } as React.CSSProperties}
            >
              {mod.badge !== undefined && mod.badge > 0 && (
                <span
                  className="absolute top-3 right-3 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1.5"
                  style={{ background: '#d32f2f', lineHeight: 1 }}
                >
                  {mod.badge > 99 ? '99+' : mod.badge}
                </span>
              )}
              <div className="relative flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 14 }}>
                <div className="absolute inset-0" style={{ borderRadius: 14, background: mod.iconColor, opacity: 0.15 }} />
                <Icon size={32} style={{ color: mod.iconColor, position: 'relative' }} />
              </div>
              <p className="font-bold uppercase tracking-wider text-white leading-tight" style={{ fontSize: 13, marginTop: 12 }}>
                {mod.label}
              </p>
              <p className="font-medium leading-snug" style={{ fontSize: 11, marginTop: 4, color: '#888' }}>
                {mod.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
