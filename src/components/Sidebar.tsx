import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Wrench, PlusCircle, FileText, 
  Settings, TrendingUp, Users, Cpu, Wifi, WifiOff,
  Calendar, AppWindow, Search, ClipboardCheck, RefreshCw
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

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onNewRepair, onEditRepair, appName, version, repairs, budgets, citas }) => {
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const check = () => setOnline(storage.isOnline());
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  const menuItems = [
    { id: 'dashboard',   label: 'Monitor Central',  icon: LayoutDashboard },
    { id: 'new-repair',  label: 'Nueva Reparación',  icon: PlusCircle },
    { id: 'repairs',     label: 'Banco de Trabajo',  icon: Wrench },
    { id: 'budgets',     label: 'Presupuestos',       icon: FileText },
    { id: 'customers',   label: 'Agenda Clientes',   icon: Users },
    { id: 'calendar',    label: 'Planificador',       icon: Calendar },
    { id: 'stats',       label: 'Rendimiento',        icon: TrendingUp },
    { id: 'tech-field',  label: 'Panel de Campo',     icon: ClipboardCheck },
    { id: 'external-apps', label: 'Módulos Externos', icon: AppWindow },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-white h-screen flex flex-col fixed left-0 top-0 z-40 no-print border-r border-slate-800/50 shadow-2xl">
      <div className="p-8 border-b border-slate-900">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600 p-2.5 rounded-2xl w-12 h-12 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Cpu size={24} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-black tracking-tighter truncate uppercase leading-none">{appName}</span>
            <span className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2 leading-none">Terminal de Taller</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 mt-4 px-4 space-y-1 overflow-y-auto">
        {/* Global Search */}
        <div className="mb-4 px-1">
          <GlobalSearch
            repairs={repairs}
            budgets={budgets}
            citas={citas}
            onNavigate={setView}
            onEditRepair={onEditRepair}
          />
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => item.id === 'new-repair' ? onNewRepair() : setView(item.id as ViewType)}
              className={`w-full flex items-center space-x-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
                isActive 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 translate-x-1' 
                : 'text-slate-500 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-white' : 'group-hover:text-blue-400 transition-colors'} />
              <span className="font-black uppercase text-[10px] tracking-[0.15em]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-900 space-y-3">
        {/* Sync indicator + button */}
        <button
          onClick={async () => {
            setSyncing(true);
            try {
              const result = await storage.syncNow();
              console.log('[Sidebar] Sync result:', result);
            } catch (e) { console.warn('[Sidebar] Sync error:', e); }
            finally { setSyncing(false); setOnline(storage.isOnline()); }
          }}
          disabled={syncing}
          className={`w-full flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all active:scale-95 ${
            online ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800'
          }`}
        >
          {syncing
            ? <RefreshCw size={14} className="text-blue-400 shrink-0 animate-spin" />
            : online
              ? <Wifi size={14} className="text-emerald-500 shrink-0" />
              : <WifiOff size={14} className="text-slate-600 shrink-0" />
          }
          <div className="text-left">
            <span className={`text-[8px] font-black uppercase tracking-widest block ${syncing ? 'text-blue-400' : online ? 'text-emerald-500' : 'text-slate-600'}`}>
              {syncing ? 'Sincronizando...' : online ? 'Supabase conectado' : 'Modo local'}
            </span>
            <span className="text-[7px] text-slate-700 uppercase tracking-widest">
              {syncing ? 'Enviando y recibiendo datos' : `Pulsar para sincronizar${storage.getPendingCount() > 0 ? ` · ${storage.getPendingCount()} pendientes` : ''}`}
            </span>
          </div>
        </button>

        <button 
          onClick={() => setView('settings')} 
          className={`w-full flex items-center space-x-4 px-5 py-3.5 rounded-2xl transition-all ${
            currentView === 'settings' ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Settings size={18} />
          <span className="text-[10px] font-black uppercase tracking-[0.15em]">Ajustes</span>
        </button>

        <button 
          onClick={() => setView('diagnostic' as any)} 
          className={`w-full flex items-center space-x-4 px-5 py-3 rounded-2xl transition-all text-slate-600 hover:text-amber-400 hover:bg-slate-900`}
        >
          <Cpu size={16} />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Diagnóstico</span>
        </button>

        {version && (
          <div className="text-center">
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">v {version}</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
