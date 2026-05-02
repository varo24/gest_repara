import React from 'react';
import {
  Wrench, PlusCircle, FileText, Users, Calendar,
  TrendingUp, ClipboardCheck, AppWindow, Settings,
  Zap, Package, ShieldCheck, Receipt, PackagePlus
} from 'lucide-react';
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

  const modules: Module[] = [
    { label: 'Nueva Reparación', desc: 'Registrar entrada de equipo',          icon: PlusCircle,     iconBg: '#1565c0', action: onNewRepair },
    { label: 'Reparaciones',     desc: `${activeRepairs} activas en taller`,    icon: Wrench,         iconBg: '#e65100', action: () => setView('repairs'),          badge: activeRepairs },
    { label: 'Despacho',         desc: `${readyRepairs} listos para entregar`,  icon: Zap,            iconBg: '#2e7d32', action: () => setView('despacho'),         badge: readyRepairs },
    { label: 'Presupuestos',     desc: `${pendingBudgets} pendientes`,          icon: FileText,       iconBg: '#6a1b9a', action: () => setView('budgets') },
    { label: 'Facturas',         desc: 'Emisión y cobro',                       icon: Receipt,        iconBg: '#f57f17', action: () => setView('invoices') },
    { label: 'Clientes',         desc: 'Agenda y ficha de cliente',             icon: Users,          iconBg: '#00695c', action: () => setView('customers') },
    { label: 'Inventario',       desc: 'Stock de piezas',                       icon: Package,        iconBg: '#4e342e', action: () => setView('inventory') },
    { label: 'Entrada Stock',    desc: 'Registrar entradas de almacén',         icon: PackagePlus,    iconBg: '#1a237e', action: () => setView('inventory-entrada') },
    { label: 'Garantías',        desc: 'Control de vencimientos',               icon: ShieldCheck,    iconBg: '#b71c1c', action: () => setView('garantias') },
    { label: 'Planificador',     desc: `${todayCitas} citas hoy`,               icon: Calendar,       iconBg: '#1b5e20', action: () => setView('calendar') },
    { label: 'Rendimiento',      desc: 'Estadísticas del taller',               icon: TrendingUp,     iconBg: '#37474f', action: () => setView('stats') },
    { label: 'Panel Campo',      desc: 'Reparaciones a domicilio',              icon: ClipboardCheck, iconBg: '#283593', action: () => setView('tech-field') },
    { label: 'Módulos Ext.',     desc: 'Aplicaciones integradas',               icon: AppWindow,      iconBg: '#424242', action: () => setView('external-apps') },
    { label: 'Ajustes',          desc: 'Configuración del sistema',             icon: Settings,       iconBg: '#455a64', action: () => setView('settings') },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#111111', fontFamily: "'Barlow Condensed', sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 py-5" style={{ borderBottom: '1px solid #2a2a2a', background: '#111111' }}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white shrink-0"
          style={{ background: '#e65100' }}
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
      <div className="grid grid-cols-4" style={{ background: '#2a2a2a', gap: 1 }}>
        {[
          { label: 'Activas',      value: activeRepairs,  color: '#ff6b00' },
          { label: 'Listas',       value: readyRepairs,   color: '#00e676' },
          { label: 'Presupuestos', value: pendingBudgets, color: '#ce93d8' },
          { label: 'Citas hoy',    value: todayCitas,     color: '#ffd54f' },
        ].map(s => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center py-4"
            style={{ background: '#1a1a1a' }}
          >
            <span className="text-3xl font-black leading-none" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: '#555' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Module grid ── */}
      <div className="grid grid-cols-2" style={{ background: '#2a2a2a', gap: 1 }}>
        {modules.map(mod => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.label}
              onClick={mod.action}
              className="module-btn flex items-center gap-4 px-5 text-left active:brightness-75"
              style={{
                height: 90,
                background: '#111111',
                '--module-color': mod.iconBg,
              } as React.CSSProperties}
            >
              {/* Icon box with optional badge */}
              <div className="relative shrink-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: mod.iconBg }}
                >
                  <Icon size={24} color="#fff" />
                </div>
                {mod.badge !== undefined && mod.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black text-white px-1"
                    style={{ background: '#d32f2f', lineHeight: 1 }}
                  >
                    {mod.badge > 99 ? '99+' : mod.badge}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p className="text-[14px] font-black uppercase tracking-wider text-white leading-tight">
                  {mod.label}
                </p>
                <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#888' }}>
                  {mod.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
