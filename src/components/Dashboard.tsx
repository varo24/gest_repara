import React, { useMemo } from 'react';
import {
  Wrench, Calendar, Wallet, CheckCircle2, Clock, ChevronRight,
  Package, ShieldAlert, FileText, AlertTriangle, Phone,
  TrendingUp, PlusCircle,
} from 'lucide-react';
import { ViewType, RepairItem, Budget, Cita, AppSettings, InventoryItem, Warranty } from '../types';
import { getBudgetAlertLevel } from '../lib/budgetAlerts';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  'Pendiente':             { label: 'Pendiente',         color: '#64748b', bg: '#f1f5f9' },
  'En Diagnóstico':        { label: 'Diagnóstico',       color: '#d97706', bg: '#fef3c7' },
  'Presupuesto Enviado':   { label: 'Presup. Enviado',   color: '#2563eb', bg: '#dbeafe' },
  'Presupuesto Aceptado':  { label: 'Presup. Aceptado',  color: '#0891b2', bg: '#cffafe' },
  'Presupuesto Rechazado': { label: 'Presup. Rechazado', color: '#dc2626', bg: '#fee2e2' },
  'Esperando Repuestos':   { label: 'Esperando',         color: '#7c3aed', bg: '#ede9fe' },
  'En Reparación':         { label: 'En Reparación',     color: '#ea580c', bg: '#ffedd5' },
  'Listo para Entrega':    { label: 'Listo',             color: '#16a34a', bg: '#dcfce7' },
};

const DONE = new Set(['Entregado', 'Cancelado', 'Sin Reparación']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function calendarDaysSince(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86_400_000));
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Card shell ────────────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`bg-white rounded-2xl overflow-hidden ${className}`}
    style={{ border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
  >
    {children}
  </div>
);

const SectionHeader: React.FC<{
  icon: React.ElementType;
  label: string;
  color: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, label, color, action }) => (
  <div
    className="flex items-center justify-between px-5 py-3"
    style={{ borderBottom: '1px solid #f8fafc' }}
  >
    <div className="flex items-center gap-2">
      <Icon size={13} style={{ color }} />
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#64748b' }}>
        {label}
      </span>
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors"
        style={{ fontSize: 11, fontWeight: 700 }}
      >
        {action.label} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

interface DashboardProps {
  repairs:        RepairItem[];
  budgets:        Budget[];
  citas:          Cita[];
  settings:       AppSettings;
  inventoryItems?: InventoryItem[];
  warranties?:    Warranty[];
  cashMovements?: any[];
  cierresCaja?:   any[];
  setView:        (view: ViewType) => void;
  onNewRepair:    () => void;
  onEditRepair:   (repair: RepairItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Dashboard: React.FC<DashboardProps> = ({
  repairs, budgets, citas, settings,
  inventoryItems = [], warranties = [],
  cashMovements = [], cierresCaja = [],
  setView, onNewRepair, onEditRepair,
}) => {
  const todayStr    = today();
  const tomorrowStr = tomorrow();
  const threshold   = settings.budgetFollowUpDays ?? 3;

  // ── Resumen del día ─────────────────────────────────────────────────────────

  const activeRepairs = useMemo(
    () => repairs.filter(r => !DONE.has(r.status)),
    [repairs],
  );

  const deliveredToday = useMemo(
    () => repairs.filter(r =>
      r.status === 'Entregado' &&
      (r.updatedAt || '').slice(0, 10) === todayStr,
    ),
    [repairs, todayStr],
  );

  const citasHoy = useMemo(
    () => citas.filter(c =>
      c.fecha === todayStr &&
      c.estado !== 'cancelada' && c.estado !== 'completada',
    ),
    [citas, todayStr],
  );

  const cajaInfo = useMemo(() => {
    const todayMovs = cashMovements.filter(
      m => (m.fecha || m.date || '').slice(0, 10) === todayStr && !m.ignorada,
    );
    const apertura = todayMovs.find(m => (m.tipo || m.type) === 'apertura');
    if (!apertura) return { estado: 'sin-abrir' as const, balance: 0 };
    const cierreHoy = cierresCaja.find(c => c.fecha === todayStr);
    const saldo   = apertura.importe ?? apertura.amount ?? 0;
    const ing     = todayMovs.filter(m => (m.tipo || m.type) === 'ingreso').reduce((s, m) => s + (m.importe ?? m.amount ?? 0), 0);
    const gasto   = todayMovs.filter(m => ['gasto', 'retirada', 'cierre'].includes(m.tipo || m.type || '')).reduce((s, m) => s + (m.importe ?? m.amount ?? 0), 0);
    return {
      estado: cierreHoy ? 'cerrada' as const : 'abierta' as const,
      balance: saldo + ing - gasto,
    };
  }, [cashMovements, cierresCaja, todayStr]);

  // ── Reparaciones activas (lista) ────────────────────────────────────────────

  const activeList = useMemo(
    () => [...activeRepairs]
      .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))
      .slice(0, 5),
    [activeRepairs],
  );

  // ── Próximas citas ──────────────────────────────────────────────────────────

  const upcomingCitas = useMemo(
    () => citas
      .filter(c =>
        (c.fecha === todayStr || c.fecha === tomorrowStr) &&
        c.estado !== 'cancelada' && c.estado !== 'completada',
      )
      .sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`))
      .slice(0, 3),
    [citas, todayStr, tomorrowStr],
  );

  // ── Alertas ─────────────────────────────────────────────────────────────────

  const alertas = useMemo(() => {
    const presupuestosSinResp = budgets.filter(
      b => getBudgetAlertLevel(b, threshold) !== 'none',
    ).length;

    const repSinActualizar = activeRepairs.filter(r =>
      calendarDaysSince(r.updatedAt || r.entryDate) >= 7,
    ).length;

    const stockBajo = inventoryItems.filter(i => i.stock <= i.minStock).length;

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const garantiasVencen = warranties.filter(w => {
      if (w.status === 'reclamada') return false;
      const exp = new Date(w.expiryDate); exp.setHours(0, 0, 0, 0);
      const dias = Math.floor((exp.getTime() - hoy.getTime()) / 86_400_000);
      return dias >= 0 && dias <= 30;
    }).length;

    return { presupuestosSinResp, repSinActualizar, stockBajo, garantiasVencen };
  }, [budgets, activeRepairs, inventoryItems, warranties, threshold]);

  const totalAlertas = Object.values(alertas).reduce((s, v) => s + v, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── Header (desktop only) ── */}
      <div
        className="hidden md:flex items-center justify-between px-6 py-4"
        style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32, #388e3c)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-xl text-white"
            style={{ background: 'rgba(0,0,0,0.22)' }}
          >
            {(settings.appName || 'T').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-white leading-none">
              {settings.appName}
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {[settings.address, settings.phone ? `Tel. ${settings.phone}` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button
          onClick={onNewRepair}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all hover:opacity-90"
          style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <PlusCircle size={15} /> Nueva Reparación
        </button>
      </div>

      <div className="px-4 md:px-6 py-4 space-y-4">

        {/* ── RESUMEN DEL DÍA ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* Activas */}
          <button
            onClick={() => setView('repairs')}
            className="text-left active:scale-95 transition-transform"
          >
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#eff6ff' }}>
                    <Wrench size={14} style={{ color: '#2563eb' }} />
                  </div>
                </div>
                <p className="text-3xl font-black leading-none" style={{ color: '#2563eb' }}>
                  {activeRepairs.length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: '#64748b' }}>
                  Activas
                </p>
              </div>
            </Card>
          </button>

          {/* Entregadas hoy */}
          <button
            onClick={() => setView('repairs')}
            className="text-left active:scale-95 transition-transform"
          >
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                    <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                  </div>
                </div>
                <p className="text-3xl font-black leading-none" style={{ color: '#16a34a' }}>
                  {deliveredToday.length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: '#64748b' }}>
                  Entregadas hoy
                </p>
              </div>
            </Card>
          </button>

          {/* Caja */}
          <button
            onClick={() => setView('caja')}
            className="text-left active:scale-95 transition-transform"
          >
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cajaInfo.estado === 'abierta' ? '#f0fdf4' : '#f8fafc' }}>
                    <Wallet size={14} style={{ color: cajaInfo.estado === 'abierta' ? '#16a34a' : '#94a3b8' }} />
                  </div>
                </div>
                {cajaInfo.estado === 'sin-abrir' ? (
                  <p className="text-base font-black leading-none" style={{ color: '#94a3b8' }}>Sin abrir</p>
                ) : (
                  <p className="text-xl font-black leading-none" style={{ color: cajaInfo.estado === 'abierta' ? '#16a34a' : '#64748b' }}>
                    {cajaInfo.balance.toFixed(2)}€
                  </p>
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: '#64748b' }}>
                  {cajaInfo.estado === 'abierta' ? 'Caja abierta' : cajaInfo.estado === 'cerrada' ? 'Caja cerrada' : 'Caja del día'}
                </p>
              </div>
            </Card>
          </button>

          {/* Citas hoy */}
          <button
            onClick={() => setView('calendar')}
            className="text-left active:scale-95 transition-transform"
          >
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#fff7ed' }}>
                    <Calendar size={14} style={{ color: '#ea580c' }} />
                  </div>
                </div>
                <p className="text-3xl font-black leading-none" style={{ color: '#ea580c' }}>
                  {citasHoy.length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5" style={{ color: '#64748b' }}>
                  Citas hoy
                </p>
              </div>
            </Card>
          </button>
        </div>

        {/* ── GRID PRINCIPAL ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LEFT: Reparaciones activas */}
          <Card>
            <SectionHeader
              icon={Wrench}
              label="Reparaciones activas"
              color="#2563eb"
              action={{ label: 'Ver todas', onClick: () => setView('repairs') }}
            />
            {activeList.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 size={28} style={{ color: '#e2e8f0', margin: '0 auto 8px' }} />
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#cbd5e1' }}>
                  Sin reparaciones activas
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {activeList.map(r => {
                  const cfg = STATUS_CFG[r.status] ?? { label: r.status, color: '#64748b', bg: '#f1f5f9' };
                  const dias = calendarDaysSince(r.entryDate);
                  return (
                    <button
                      key={r.id}
                      onClick={() => onEditRepair(r)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      {/* RMA */}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#eff6ff' }}>
                        <span className="text-[9px] font-black" style={{ color: '#2563eb' }}>
                          {String(r.rmaNumber).padStart(3, '0')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[12px] font-black text-slate-800 truncate">
                            {r.brand} {r.model}
                          </p>
                          <span
                            className="shrink-0 text-[8px] font-black px-1.5 py-px rounded-full"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                          {r.customerName}
                        </p>
                      </div>

                      {/* Days */}
                      <div className="shrink-0 text-right">
                        <p
                          className="text-[11px] font-black"
                          style={{ color: dias >= 7 ? '#dc2626' : dias >= 3 ? '#d97706' : '#94a3b8' }}
                        >
                          {dias}d
                        </p>
                        <p className="text-[9px] text-slate-300 font-medium">en taller</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* RIGHT: Citas + Alertas */}
          <div className="space-y-4">

            {/* Próximas citas */}
            <Card>
              <SectionHeader
                icon={Calendar}
                label="Próximas citas"
                color="#ea580c"
                action={{ label: 'Ver agenda', onClick: () => setView('calendar') }}
              />
              {upcomingCitas.length === 0 ? (
                <div className="py-8 text-center">
                  <Calendar size={24} style={{ color: '#e2e8f0', margin: '0 auto 8px' }} />
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#cbd5e1' }}>
                    No hay citas próximas
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {upcomingCitas.map(c => {
                    const esHoy = c.fecha === todayStr;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setView('calendar')}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                      >
                        {/* Time block */}
                        <div
                          className="w-12 shrink-0 text-center py-1 rounded-lg"
                          style={{ background: esHoy ? '#fff7ed' : '#f8fafc' }}
                        >
                          <p className="text-[12px] font-black leading-tight" style={{ color: esHoy ? '#ea580c' : '#475569' }}>
                            {c.horaInicio}
                          </p>
                          <p className="text-[8px] font-bold uppercase" style={{ color: esHoy ? '#fb923c' : '#94a3b8' }}>
                            {esHoy ? 'Hoy' : 'Mañana'}
                          </p>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-slate-800 truncate">{c.titulo}</p>
                          {c.clienteName && (
                            <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5 flex items-center gap-1">
                              <Phone size={9} />
                              {c.clienteName}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Alertas rápidas */}
            {totalAlertas > 0 && (
              <Card>
                <SectionHeader icon={AlertTriangle} label="Alertas rápidas" color="#dc2626" />
                <div className="divide-y divide-slate-50">
                  {alertas.presupuestosSinResp > 0 && (
                    <button
                      onClick={() => setView('budgets')}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-amber-50 transition-colors"
                    >
                      <FileText size={14} style={{ color: '#d97706', flexShrink: 0 }} />
                      <span className="flex-1 text-[12px] font-semibold text-slate-700">
                        Presupuestos sin respuesta
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                        {alertas.presupuestosSinResp}
                      </span>
                    </button>
                  )}
                  {alertas.repSinActualizar > 0 && (
                    <button
                      onClick={() => setView('repairs')}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-red-50 transition-colors"
                    >
                      <Clock size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                      <span className="flex-1 text-[12px] font-semibold text-slate-700">
                        Reparaciones sin actualizar +7d
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        {alertas.repSinActualizar}
                      </span>
                    </button>
                  )}
                  {alertas.stockBajo > 0 && (
                    <button
                      onClick={() => setView('inventory')}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-orange-50 transition-colors"
                    >
                      <Package size={14} style={{ color: '#ea580c', flexShrink: 0 }} />
                      <span className="flex-1 text-[12px] font-semibold text-slate-700">
                        Artículos con stock bajo
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: '#ffedd5', color: '#9a3412' }}>
                        {alertas.stockBajo}
                      </span>
                    </button>
                  )}
                  {alertas.garantiasVencen > 0 && (
                    <button
                      onClick={() => setView('garantias')}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-red-50 transition-colors"
                    >
                      <ShieldAlert size={14} style={{ color: '#b91c1c', flexShrink: 0 }} />
                      <span className="flex-1 text-[12px] font-semibold text-slate-700">
                        Garantías vencen en 30 días
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        {alertas.garantiasVencen}
                      </span>
                    </button>
                  )}
                </div>
              </Card>
            )}

            {/* Acceso rápido cuando no hay alertas */}
            {totalAlertas === 0 && (
              <Card>
                <div className="px-5 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                    <TrendingUp size={14} style={{ color: '#16a34a' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-black text-slate-800">Sin alertas</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Todo en orden</p>
                  </div>
                </div>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
