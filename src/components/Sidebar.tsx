import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Wrench, PlusCircle, FileText,
  Settings, TrendingUp, Users,
  Calendar, AppWindow, ClipboardCheck, RefreshCw,
  Zap, Package, Receipt, ShieldCheck
} from 'lucide-react';
import { ViewType, RepairItem, Budget, Cita, Warranty } from '../types';
import { storage } from '../lib/dataService';
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
  warranties?: Warranty[];
}

type NavItem = { id: ViewType | 'new-repair'; label: string; icon: React.ElementType; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

const Sidebar: React.FC<SidebarProps> = ({
  currentView, setView, onNewRepair, onEditRepair,
  appName, repairs, budgets, citas, warranties = []
}) => {
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const check = () => setOnline(storage.isOnline());
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  const readyCount  = repairs.filter(r => r.status === 'Listo para Entrega').length;
  const activeCount = repairs.filter(r => !['Entregado', 'Cancelado'].includes(r.status)).length;

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
        { id: 'customers',         label: 'Clientes',         icon: Users },
        { id: 'calendar',          label: 'Planificador',     icon: Calendar },
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
        { id: 'stats',             label: 'Rendimiento',      icon: TrendingUp },
        { id: 'tech-field',        label: 'Panel Campo',      icon: ClipboardCheck },
        { id: 'external-apps',     label: 'Módulos Ext.',     icon: AppWindow },
        { id: 'settings',          label: 'Ajustes',          icon: Settings },
      ]
    },
  ];

  const getBadgeStyle = (id: string): React.CSSProperties => {
    if (id === 'garantias') return { background: '#b71c1c', color: '#fff' };
    return { background: '#2e7d32', color: '#fff' };
  };

  return (
    <aside
      className="h-screen flex flex-col fixed left-0 top-0 z-40 no-print"
      style={{ width: 210, background: '#0d0d0d', borderRight: '1px solid #2a2a2a', fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      {/* ── Logo ── */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid #222' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-lg leading-none text-white"
            style={{ background: '#2e7d32' }}
          >
            {appName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-black tracking-widest uppercase text-white truncate leading-none">{appName}</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-0.5" style={{ color: '#2e7d32' }}>v8 · Taller Pro</div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 pt-3 pb-1">
        <GlobalSearch
          repairs={repairs} budgets={budgets} citas={citas}
          onNavigate={setView} onEditRepair={onEditRepair}
        />
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="mx-2 my-1.5" style={{ borderTop: '1px solid #1e1e1e' }} />}
            <p
              className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-[0.22em]"
              style={{ color: '#444' }}
            >
              {group.label}
            </p>
            {group.items.map(item => {
              const Icon = item.icon;
              const isNew    = item.id === 'new-repair';
              const isActive = !isNew && currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => isNew ? onNewRepair() : setView(item.id as ViewType)}
                  className={`sidebar-nav-btn w-full flex items-center gap-2.5 px-3 py-[7px] text-[11px] font-black uppercase tracking-wider mb-px group${isActive ? ' is-active' : ''}`}
                  style={isActive ? { background: '#2e7d32', color: '#fff' } : { color: '#888' }}
                >
                  <Icon
                    size={15}
                    style={{ color: isActive ? '#fff' : '#555', flexShrink: 0 }}
                    className={isActive ? '' : 'group-hover:!text-[#43a047]'}
                  />
                  <span className="flex-1 text-left truncate group-hover:text-white">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-px leading-none rounded-sm"
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

      {/* ── Sync ── */}
      <div className="p-3" style={{ borderTop: '1px solid #1e1e1e' }}>
        <button
          onClick={async () => {
            setSyncing(true);
            try { await storage.syncNow(); } catch {}
            finally { setSyncing(false); setOnline(storage.isOnline()); }
          }}
          disabled={syncing}
          className="sync-btn w-full flex items-center gap-2.5 px-3 py-2 transition-colors"
          style={{ background: '#161616', border: '1px solid #2a2a2a' }}
        >
          {syncing ? (
            <RefreshCw size={11} style={{ color: '#43a047', flexShrink: 0 }} className="animate-spin" />
          ) : online ? (
            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: '#00e676' }} />
          ) : (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#444' }} />
          )}
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: online ? '#00e676' : '#555' }}
          >
            {syncing ? 'Sincronizando...' : online ? 'Conectado' : 'Local'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
