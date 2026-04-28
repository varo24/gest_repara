import React from 'react';
import {
  Wrench, PlusCircle, FileText, Users, Calendar,
  TrendingUp, ClipboardCheck, AppWindow, Settings,
  Zap, Package, ShieldCheck, Receipt, LayoutDashboard
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

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair }) => {
  const activeRepairs = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;
  const readyRepairs = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const pendingBudgets = budgets.filter(b => b.status === 'pending').length;
  const todayCitas = citas.filter(c => c.fecha?.startsWith(new Date().toISOString().slice(0, 10))).length;

  const modules = [
    {
      label: 'Nueva Reparación',
      desc: 'Registrar entrada de equipo',
      icon: PlusCircle,
      color: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      action: onNewRepair,
    },
    {
      label: 'Reparaciones',
      desc: `${activeRepairs} activas en taller`,
      icon: Wrench,
      color: 'bg-slate-700',
      hover: 'hover:bg-slate-800',
      action: () => setView('repairs'),
      badge: activeRepairs,
    },
    {
      label: 'Despacho',
      desc: `${readyRepairs} listos para entregar`,
      icon: Zap,
      color: 'bg-emerald-600',
      hover: 'hover:bg-emerald-700',
      action: () => setView('despacho'),
      badge: readyRepairs,
      badgeColor: 'bg-yellow-400 text-yellow-900',
    },
    {
      label: 'Presupuestos',
      desc: `${pendingBudgets} pendientes de aceptar`,
      icon: FileText,
      color: 'bg-violet-600',
      hover: 'hover:bg-violet-700',
      action: () => setView('budgets'),
    },
    {
      label: 'Clientes',
      desc: 'Agenda y ficha de cliente',
      icon: Users,
      color: 'bg-slate-700',
      hover: 'hover:bg-slate-800',
      action: () => setView('customers'),
    },
    {
      label: 'Planificador',
      desc: `${todayCitas} citas hoy`,
      icon: Calendar,
      color: 'bg-amber-600',
      hover: 'hover:bg-amber-700',
      action: () => setView('calendar'),
    },
    {
      label: 'Facturas',
      desc: 'Emisión y cobro',
      icon: Receipt,
      color: 'bg-slate-700',
      hover: 'hover:bg-slate-800',
      action: () => setView('invoices'),
    },
    {
      label: 'Inventario',
      desc: 'Stock de piezas',
      icon: Package,
      color: 'bg-orange-600',
      hover: 'hover:bg-orange-700',
      action: () => setView('inventory'),
    },
    {
      label: 'Garantías',
      desc: 'Control de vencimientos',
      icon: ShieldCheck,
      color: 'bg-teal-600',
      hover: 'hover:bg-teal-700',
      action: () => setView('garantias'),
    },
    {
      label: 'Panel de Campo',
      desc: 'Reparaciones a domicilio',
      icon: ClipboardCheck,
      color: 'bg-slate-700',
      hover: 'hover:bg-slate-800',
      action: () => setView('tech-field'),
    },
    {
      label: 'Estadísticas',
      desc: 'Rendimiento del taller',
      icon: TrendingUp,
      color: 'bg-slate-700',
      hover: 'hover:bg-slate-800',
      action: () => setView('stats'),
    },
    {
      label: 'Ajustes',
      desc: 'Configuración general',
      icon: Settings,
      color: 'bg-slate-700',
      hover: 'hover:bg-slate-800',
      action: () => setView('settings'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-slate-950 px-8 py-6">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">{settings.appName}</h1>
        <p className="text-sm text-slate-500 mt-1">{settings.address} · {settings.phone}</p>
      </div>

      {/* Stats strip */}
      <div className="bg-slate-900 px-8 py-4 flex gap-8 border-b border-slate-800">
        {[
          { label: 'Activas', value: activeRepairs, color: 'text-white' },
          { label: 'Listas', value: readyRepairs, color: 'text-emerald-400' },
          { label: 'Presupuestos', value: pendingBudgets, color: 'text-violet-400' },
          { label: 'Citas hoy', value: todayCitas, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3">
            <span className={`text-2xl font-black ${s.color}`}>{s.value}</span>
            <span className="text-xs text-slate-500 uppercase tracking-widest">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Module grid */}
      <div className="p-8">
        <div className="grid grid-cols-3 gap-4 max-w-4xl">
          {modules.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.label}
                onClick={mod.action}
                className={`relative flex items-center gap-4 p-5 rounded-2xl ${mod.color} ${mod.hover} text-white transition-all active:scale-95 shadow-lg text-left group`}
              >
                {/* Badge */}
                {mod.badge !== undefined && mod.badge > 0 && (
                  <span className={`absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full ${mod.badgeColor || 'bg-white/20 text-white'}`}>
                    {mod.badge}
                  </span>
                )}

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-all">
                  <Icon size={24} className="text-white" />
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-tight leading-none">{mod.label}</p>
                  <p className="text-[11px] text-white/60 mt-1 leading-snug">{mod.desc}</p>
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
