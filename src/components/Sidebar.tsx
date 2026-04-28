import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Wrench, PlusCircle, FileText,
  Settings, TrendingUp, Users, Cpu, Wifi, WifiOff,
  Calendar, AppWindow, ClipboardCheck, RefreshCw,
  Zap, Package, Receipt, ShieldCheck
} from 'lucide-react';
import { ViewType, RepairItem, Budget, Cita } from '../types';
import { storage } from '../services/persistence';
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
}

type NavItem = { id: ViewType | 'new-repair'; label: string; icon: React.ElementType; badge?: number; badgeColor?: string };
type NavGroup = { label: string; items: NavItem[] };

const Sidebar: React.FC<SidebarProps> = ({
  currentView, setView, onNewRepair, onEditRepair,
  appName, version, repairs, budgets, citas
}) => {
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const check = () => setOnline(storage.isOnline());
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  const readyCount = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const activeCount = repairs.filter(r => !['Entregado','Cancelado'].includes(r.status)).length;

  const groups: NavGroup[] = [
    {
      label: 'Principal',
      items: [
        { id: 'dashboard',   label: 'Monitor Central',  icon: LayoutDashboard },
        { id: 'new-repair',  label: 'Nueva Reparación', icon: PlusCircle },
        { id: 'repairs',     label: 'Reparaciones',     icon: Wrench, badge: activeCount },
        { id: 'despacho',    label: 'Despacho',         icon: Zap, badge: readyCount, badgeColor: 'bg-emerald-500' },
      ]
    },
    {
      label: 'Gestión',
      items: [
        { id: 'budgets',     label: 'Presupuestos',     icon: FileText },
        { id: 'invoices',    label: 'Facturas',         icon: Receipt },
        { id: 'customers',   label: 'Clientes',         icon: Users },
        { id: 'calendar',    label: 'Planificador',     icon: Calendar },
      ]
    },
    {
      label: 'Almacén',
      items: [
        { id: 'inventory',         label: 'Inventario',    icon: Package },
        { id: 'inventory-entrada', label: 'Entrada Stock', icon: Package },
        { id: 'garantias',         label: 'Garantías',     icon: ShieldCheck },
      ]
    },
    {
      label: 'Sistema',
      items: [
        { id: 'stats',        label: 'Rendimiento',     icon: TrendingUp },
        { id: 'tech-field',   label: 'Panel de Campo',  icon: ClipboardCheck },
        { id: 'external-apps',label: 'Módulos Ext.',    icon: AppWindow },
        { id: 'settings',     label: 'Ajustes',         icon: Settings },
      ]
    },
  ];

  return (
    <aside className="w-56 bg-slate-950 text-white h-screen flex flex-col fixed left-0 top-0 z-40 no-print border-r border-slate-800/50 shadow-2xl">
      <div className="p-5 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl w-9 h-9 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
            <Cpu size={18} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-black tracking-tighter truncate uppercase leading-none">{appName}</span>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">v8 · Taller Pro</span>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-1">
        <GlobalSearch
          repairs={repairs} budgets={budgets} citas={citas}
          onNavigate={setView} onEditRepair={onEditRepair}
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-2.5 pt-3 pb-1 text-[8px] font-bold text-slate-600 uppercase tracking-widest">{group.label}</p>
            {group.items.map(item => {
              const Icon = item.icon;
              const isNew = item.id === 'new-repair';
              const isActive = !isNew && currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => isNew ? onNewRepair() : setView(item.id as ViewType)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all mb-0.5 group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : 'text-slate-600 group-hover:text-blue-400'} />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full text-white ${item.badgeColor || 'bg-blue-500'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-900">
        <button
          onClick={async () => {
            setSyncing(true);
            try { await storage.syncNow(); } catch {}
            finally { setSyncing(false); setOnline(storage.isOnline()); }
          }}
          disabled={syncing}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
            online ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' : 'border-slate-800 bg-slate-900/50'
          }`}
        >
          {syncing
            ? <RefreshCw size={11} className="text-blue-400 shrink-0 animate-spin" />
            : online
              ? <Wifi size={11} className="text-emerald-500 shrink-0" />
              : <WifiOff size={11} className="text-slate-600 shrink-0" />
          }
          <span className={`text-[9px] font-bold ${online ? 'text-emerald-500' : 'text-slate-600'}`}>
            {syncing ? 'Sincronizando...' : online ? 'Conectado' : 'Local'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

export default Sidebar;
