import React from 'react';
import {
  Wrench, PlusCircle, FileText, Users, Calendar,
  TrendingUp, ClipboardCheck, AppWindow, Settings,
  Zap, Package, ShieldCheck, Receipt
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
  iconColor: string;
  action: () => void;
  badge?: number;
  badgeBg?: string;
  badgeText?: string;
};

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair }) => {
  const activeRepairs  = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;
  const readyRepairs   = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const pendingBudgets = budgets.filter(b => b.status === 'pending').length;
  const todayCitas     = citas.filter(c => c.fecha?.startsWith(new Date().toISOString().slice(0, 10))).length;

  const modules: Module[] = [
    { label: 'Nueva Reparación', desc: 'Registrar entrada de equipo',         icon: PlusCircle,    iconColor: '#ff6b00', action: onNewRepair },
    { label: 'Reparaciones',     desc: `${activeRepairs} activas en taller`,   icon: Wrench,        iconColor: '#00d4ff', action: () => setView('repairs'),      badge: activeRepairs },
    { label: 'Despacho',         desc: `${readyRepairs} listos para entregar`, icon: Zap,           iconColor: '#00ff88', action: () => setView('despacho'),     badge: readyRepairs,   badgeBg: '#00ff88', badgeText: '#000' },
    { label: 'Presupuestos',     desc: `${pendingBudgets} pendientes`,         icon: FileText,      iconColor: '#9b59b6', action: () => setView('budgets') },
    { label: 'Facturas',         desc: 'Emisión y cobro',                      icon: Receipt,       iconColor: '#f1c40f', action: () => setView('invoices') },
    { label: 'Clientes',         desc: 'Agenda y ficha de cliente',            icon: Users,         iconColor: '#ff6b9d', action: () => setView('customers') },
    { label: 'Inventario',       desc: 'Stock de piezas',                      icon: Package,       iconColor: '#ff9500', action: () => setView('inventory') },
    { label: 'Garantías',        desc: 'Control de vencimientos',              icon: ShieldCheck,   iconColor: '#00d4ff', action: () => setView('garantias') },
    { label: 'Planificador',     desc: `${todayCitas} citas hoy`,              icon: Calendar,      iconColor: '#2ecc71', action: () => setView('calendar') },
    { label: 'Panel de Campo',   desc: 'Reparaciones a domicilio',             icon: ClipboardCheck,iconColor: '#aaaaaa', action: () => setView('tech-field') },
    { label: 'Estadísticas',     desc: 'Rendimiento del taller',               icon: TrendingUp,    iconColor: '#3498db', action: () => setView('stats') },
    { label: 'Ajustes',          desc: 'Configuración general',                icon: Settings,      iconColor: '#95a5a6', action: () => setView('settings') },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f', fontFamily: "'Barlow Condensed', sans-serif" }}>

      {/* ── Header ── */}
      <div className="px-8 py-5" style={{ background: 'linear-gradient(135deg, #ff6b00 0%, #ff9500 100%)' }}>
        <h1 className="text-4xl font-black uppercase tracking-widest leading-none" style={{ color: '#000' }}>
          {settings.appName}
        </h1>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
          {settings.address} · {settings.phone}
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div
        className="flex items-center gap-10 px-8 py-4"
        style={{ background: '#1a1a1a', borderBottom: '1px solid #333' }}
      >
        {[
          { label: 'Activas',       value: activeRepairs,  color: '#ffffff' },
          { label: 'Listas',        value: readyRepairs,   color: '#00ff88' },
          { label: 'Presupuestos',  value: pendingBudgets, color: '#9b59b6' },
          { label: 'Citas hoy',     value: todayCitas,     color: '#f1c40f' },
        ].map(s => (
          <div key={s.label} className="flex items-baseline gap-2">
            <span className="text-4xl font-black leading-none" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#555' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Module grid ── */}
      <div className="p-8">
        <div className="grid grid-cols-3 gap-3 max-w-4xl">
          {modules.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.label}
                onClick={mod.action}
                className="industrial-card relative flex items-center gap-4 p-5 text-left active:scale-95"
                style={{ background: '#1a1a1a', border: '1px solid #333' }}
              >
                {/* Badge */}
                {mod.badge !== undefined && mod.badge > 0 && (
                  <span
                    className="absolute top-2.5 right-2.5 text-[10px] font-black px-2 py-px leading-none animate-pulse"
                    style={{ background: mod.badgeBg || '#ff6b00', color: mod.badgeText || '#000' }}
                  >
                    {mod.badge}
                  </span>
                )}

                {/* Icon box */}
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 52, height: 52, background: '#0f0f0f', border: '1px solid #2a2a2a' }}
                >
                  <Icon size={28} style={{ color: mod.iconColor }} />
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <p className="text-[13px] font-black uppercase tracking-widest text-white leading-tight">{mod.label}</p>
                  <p className="text-[11px] mt-1 font-medium leading-snug" style={{ color: '#666' }}>{mod.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
