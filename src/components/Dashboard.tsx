import React from 'react';
import {
  FaWrench, FaCogs, FaBolt, FaFileInvoiceDollar, FaUsers,
  FaBoxes, FaShieldAlt, FaCalendarAlt, FaChartBar, FaTools,
  FaPuzzlePiece, FaSlidersH, FaTruck, FaClipboardList, FaCheckCircle
} from 'react-icons/fa';
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
  label: string;
  desc: string;
  icon: React.ElementType;
  iconBg: string;
  action: () => void;
  badge?: number;
};

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair }) => {
  const activeRepairs  = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;
  const readyRepairs   = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const pendingBudgets = budgets.filter(b => b.status === 'pending').length;
  const todayCitas     = citas.filter(c => c.fecha?.startsWith(new Date().toISOString().slice(0, 10))).length;

  const stats = [
    { label: 'Activas',       value: activeRepairs,  color: '#43a047', icon: FaCogs },
    { label: 'Listas',        value: readyRepairs,   color: '#00e676', icon: FaCheckCircle },
    { label: 'Presupuestos',  value: pendingBudgets, color: '#ce93d8', icon: FaClipboardList },
    { label: 'Citas hoy',     value: todayCitas,     color: '#ffd54f', icon: FaCalendarAlt },
  ];

  const modules: Module[] = [
    { label: 'Nueva Reparación', desc: 'Registrar entrada de equipo',          icon: FaWrench,            iconBg: '#1565c0', action: onNewRepair },
    { label: 'Reparaciones',     desc: `${activeRepairs} activas en taller`,    icon: FaCogs,              iconBg: '#e65100', action: () => setView('repairs'),          badge: activeRepairs },
    { label: 'Despacho',         desc: `${readyRepairs} listos para entregar`,  icon: FaBolt,              iconBg: '#2e7d32', action: () => setView('despacho'),         badge: readyRepairs },
    { label: 'Presupuestos',     desc: `${pendingBudgets} pendientes`,          icon: FaClipboardList,     iconBg: '#6a1b9a', action: () => setView('budgets') },
    { label: 'Facturas',         desc: 'Emisión y cobro',                       icon: FaFileInvoiceDollar, iconBg: '#f57f17', action: () => setView('invoices') },
    { label: 'Clientes',         desc: 'Agenda y ficha de cliente',             icon: FaUsers,             iconBg: '#00695c', action: () => setView('customers') },
    { label: 'Inventario',       desc: 'Stock de piezas',                       icon: FaBoxes,             iconBg: '#4e342e', action: () => setView('inventory') },
    { label: 'Entrada Stock',    desc: 'Registrar entradas de almacén',         icon: FaTruck,             iconBg: '#1a237e', action: () => setView('inventory-entrada') },
    { label: 'Garantías',        desc: 'Control de vencimientos',               icon: FaShieldAlt,         iconBg: '#b71c1c', action: () => setView('garantias') },
    { label: 'Planificador',     desc: `${todayCitas} citas hoy`,               icon: FaCalendarAlt,       iconBg: '#1b5e20', action: () => setView('calendar') },
    { label: 'Rendimiento',      desc: 'Estadísticas del taller',               icon: FaChartBar,          iconBg: '#37474f', action: () => setView('stats') },
    { label: 'Panel Campo',      desc: 'Reparaciones a domicilio',              icon: FaTools,             iconBg: '#283593', action: () => setView('tech-field') },
    { label: 'Módulos Ext.',     desc: 'Aplicaciones integradas',               icon: FaPuzzlePiece,       iconBg: '#424242', action: () => setView('external-apps') },
    { label: 'Ajustes',          desc: 'Configuración del sistema',             icon: FaSlidersH,          iconBg: '#455a64', action: () => setView('settings') },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#111111', fontFamily: "'Barlow Condensed', sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 py-5" style={{ borderBottom: '1px solid #2a2a2a' }}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white shrink-0"
          style={{ background: '#2e7d32' }}
        >
          {(settings.appName || 'T').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-[22px] font-black uppercase tracking-widest text-white leading-none">
            {settings.appName}
          </h1>
          <p className="text-[11px] font-medium mt-1" style={{ color: '#666' }}>
            {[settings.address, settings.phone ? `Tel. ${settings.phone}` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4 px-6 pt-6 pb-2">
        {stats.map(s => {
          const StatIcon = s.icon;
          return (
            <div
              key={s.label}
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div className="flex items-center gap-2">
                <StatIcon size={14} style={{ color: s.color, flexShrink: 0 }} />
                <span className="text-[28px] font-black leading-none" style={{ color: s.color }}>{s.value}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] block mt-2" style={{ color: '#555' }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Module grid ── */}
      <div
        className="grid grid-cols-3"
        style={{ gap: 16, padding: 24 }}
      >
        {modules.map(mod => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.label}
              onClick={mod.action}
              className="module-card relative flex flex-col items-center text-center active:scale-95"
              style={{
                padding: 24,
                borderRadius: 16,
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                '--module-color': mod.iconBg,
              } as React.CSSProperties}
            >
              {/* Badge at card top-right */}
              {mod.badge !== undefined && mod.badge > 0 && (
                <span
                  className="absolute top-3 right-3 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1.5"
                  style={{ background: '#d32f2f', lineHeight: 1 }}
                >
                  {mod.badge > 99 ? '99+' : mod.badge}
                </span>
              )}

              {/* Icon box — semi-transparent bg + colored icon */}
              <div
                className="relative flex items-center justify-center"
                style={{ width: 56, height: 56, borderRadius: 14 }}
              >
                <div
                  className="absolute inset-0"
                  style={{ borderRadius: 14, background: mod.iconBg, opacity: 0.15 }}
                />
                <Icon size={28} style={{ color: mod.iconBg, position: 'relative' }} />
              </div>

              {/* Title */}
              <p
                className="font-bold uppercase tracking-wider text-white leading-tight"
                style={{ fontSize: 13, marginTop: 12 }}
              >
                {mod.label}
              </p>

              {/* Description */}
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
