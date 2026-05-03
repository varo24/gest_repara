import React from 'react';
import {
  GiAutoRepair, GiGearStickPattern,
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
  gradient: string;
  accentColor: string;
  action: () => void;
  badge?: number;
};

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair }) => {
  const activeRepairs  = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;
  const readyRepairs   = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const pendingBudgets = budgets.filter(b => b.status === 'pending').length;
  const todayCitas     = citas.filter(c => c.fecha?.startsWith(new Date().toISOString().slice(0, 10))).length;

  const stats = [
    { label: 'Activas',      value: activeRepairs,  color: '#1976d2', icon: GiGearStickPattern, action: () => setView('repairs') },
    { label: 'Listas',       value: readyRepairs,   color: '#2e7d32', icon: FaCheckCircle,      action: () => setView('despacho') },
    { label: 'Presupuestos', value: pendingBudgets, color: '#7b1fa2', icon: FaClipboardCheck,   action: () => setView('budgets') },
    { label: 'Citas hoy',    value: todayCitas,     color: '#f57f17', icon: GiCalendar,         action: () => setView('calendar') },
  ];

  const allModules: Module[] = [
    {
      id: 'new-repair', label: 'Nueva Reparación', desc: 'Registrar entrada de equipo',
      icon: GiAutoRepair, gradient: 'linear-gradient(135deg, #1565c0, #1976d2)', accentColor: '#1565c0',
      action: onNewRepair,
    },
    {
      id: 'repairs', label: 'Reparaciones', desc: `${activeRepairs} activas en taller`,
      icon: GiGearStickPattern, gradient: 'linear-gradient(135deg, #e65100, #f57c00)', accentColor: '#e65100',
      action: () => setView('repairs'), badge: activeRepairs,
    },
    {
      id: 'despacho', label: 'Despacho', desc: `${readyRepairs} listos para entregar`,
      icon: MdElectricBolt, gradient: 'linear-gradient(135deg, #2e7d32, #43a047)', accentColor: '#2e7d32',
      action: () => setView('despacho'), badge: readyRepairs,
    },
    {
      id: 'budgets', label: 'Presupuestos', desc: `${pendingBudgets} pendientes`,
      icon: FaClipboardCheck, gradient: 'linear-gradient(135deg, #6a1b9a, #8e24aa)', accentColor: '#6a1b9a',
      action: () => setView('budgets'),
    },
    {
      id: 'invoices', label: 'Facturas', desc: 'Emisión y cobro',
      icon: FaFileInvoiceDollar, gradient: 'linear-gradient(135deg, #f57f17, #ffa000)', accentColor: '#f57f17',
      action: () => setView('invoices'),
    },
    {
      id: 'customers', label: 'Clientes', desc: 'Agenda y ficha de cliente',
      icon: FaUserFriends, gradient: 'linear-gradient(135deg, #00695c, #00897b)', accentColor: '#00695c',
      action: () => setView('customers'),
    },
    {
      id: 'inventory', label: 'Inventario', desc: 'Stock de piezas',
      icon: GiCardboardBox, gradient: 'linear-gradient(135deg, #4e342e, #6d4c41)', accentColor: '#4e342e',
      action: () => setView('inventory'),
    },
    {
      id: 'inventory-entrada', label: 'Entrada Stock', desc: 'Registrar entradas de almacén',
      icon: GiTruck, gradient: 'linear-gradient(135deg, #1a237e, #283593)', accentColor: '#1a237e',
      action: () => setView('inventory-entrada'),
    },
    {
      id: 'garantias', label: 'Garantías', desc: 'Control de vencimientos',
      icon: GiShield, gradient: 'linear-gradient(135deg, #b71c1c, #c62828)', accentColor: '#b71c1c',
      action: () => setView('garantias'),
    },
    {
      id: 'calendar', label: 'Planificador', desc: `${todayCitas} citas hoy`,
      icon: GiCalendar, gradient: 'linear-gradient(135deg, #1b5e20, #2e7d32)', accentColor: '#1b5e20',
      action: () => setView('calendar'),
    },
    {
      id: 'stats', label: 'Rendimiento', desc: 'Estadísticas del taller',
      icon: GiChart, gradient: 'linear-gradient(135deg, #37474f, #455a64)', accentColor: '#37474f',
      action: () => setView('stats'),
    },
    {
      id: 'external-apps', label: 'Módulos Ext.', desc: 'Aplicaciones integradas',
      icon: FaPuzzlePiece, gradient: 'linear-gradient(135deg, #4a148c, #6a1b9a)', accentColor: '#4a148c',
      action: () => setView('external-apps'),
    },
    {
      id: 'settings', label: 'Ajustes', desc: 'Configuración del sistema',
      icon: FaSlidersH, gradient: 'linear-gradient(135deg, #263238, #37474f)', accentColor: '#263238',
      action: () => setView('settings'),
    },
  ];

  const visibleIds = settings.dashboardModules && settings.dashboardModules.length > 0
    ? settings.dashboardModules
    : allModules.map(m => m.id);

  const modules = allModules.filter(m => visibleIds.includes(m.id));

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f5' }}>

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
                background: '#ffffff',
                border: '1px solid #e0e0e0',
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
                padding: 20,
                borderRadius: 16,
                background: mod.gradient,
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                transition: 'all 0.2s ease',
              }}
            >
              {mod.badge !== undefined && mod.badge > 0 && (
                <span
                  className="absolute top-3 right-3 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-black px-1.5"
                  style={{ background: '#ffffff', color: mod.accentColor, lineHeight: 1 }}
                >
                  {mod.badge > 99 ? '99+' : mod.badge}
                </span>
              )}
              <div
                className="flex items-center justify-center"
                style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(255,255,255,0.15)' }}
              >
                <Icon size={32} style={{ color: '#ffffff' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, marginTop: 12, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
                {mod.label}
              </p>
              <p style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
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
