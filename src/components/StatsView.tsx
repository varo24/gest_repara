import React from 'react';
import { Package, Clock, Activity, CheckCircle, TrendingUp, AlertCircle, Euro, Users } from 'lucide-react';
import { RepairItem, RepairStatus, Budget } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

interface StatsViewProps {
  repairs: RepairItem[];
  budgets?: Budget[];
  onBack?: () => void;
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const StatsView: React.FC<StatsViewProps> = ({ repairs, budgets = [], onBack }) => {
  const activeRepairs = repairs.filter(r => r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED && r.status !== RepairStatus.SIN_REPARACION);
  const deliveredRepairs = repairs.filter(r => r.status === RepairStatus.DELIVERED);
  const readyCount = repairs.filter(r => r.status === RepairStatus.READY).length;
  const totalRevenue = budgets.reduce((acc, b) => acc + (b.total || 0), 0);
  const efficiency = repairs.length > 0 ? Math.round((deliveredRepairs.length / repairs.length) * 100) : 0;
  const uniqueCustomers = new Set(repairs.map(r => r.customerPhone)).size;

  // Reparaciones por estado
  const byStatus = Object.values(RepairStatus).map(s => ({
    name: s,
    val: repairs.filter(r => r.status === s).length,
  })).filter(d => d.val > 0);

  // Reparaciones por mes (últimos 6 meses)
  const now = new Date();
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: MONTHS[d.getMonth()], year: d.getFullYear(), month_idx: d.getMonth() };
  });
  const byMonth = last6.map(({ month, year, month_idx }) => ({
    name: month,
    reparaciones: repairs.filter(r => {
      const d = new Date(r.entryDate);
      return d.getMonth() === month_idx && d.getFullYear() === year;
    }).length,
  }));

  const stats = [
    { label: 'Ingresos presupuestados', value: `${totalRevenue.toFixed(0)}€`, icon: Euro,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Clientes únicos',          value: uniqueCustomers,               icon: Users,        color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'Activos en taller',         value: activeRepairs.length,          icon: Activity,     color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'Tasa de entrega',           value: `${efficiency}%`,              icon: CheckCircle,  color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ];

  const statusColors: Record<string, string> = {
    [RepairStatus.PENDING]:         '#f59e0b',
    [RepairStatus.DIAGNOSING]:      '#6366f1',
    [RepairStatus.BUDGET_PENDING]:  '#8b5cf6',
    [RepairStatus.BUDGET_ACCEPTED]: '#3b82f6',
    [RepairStatus.BUDGET_REJECTED]: '#ef4444',
    [RepairStatus.WAITING_PARTS]:   '#f97316',
    [RepairStatus.IN_PROGRESS]:     '#0ea5e9',
    [RepairStatus.READY]:           '#10b981',
    [RepairStatus.DELIVERED]:       '#64748b',
    [RepairStatus.CANCELLED]:       '#dc2626',
    [RepairStatus.SIN_REPARACION]:  '#94a3b8',
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div>
        {onBack && <button onClick={onBack} className="back-to-dash mb-3">← INICIO</button>}
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Análisis y Estadísticas</h1>
        <p className="text-slate-500 font-medium text-sm mt-1">Métricas de rendimiento técnico del taller</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
            <div className="flex items-center space-x-4">
              <div className={`${stat.bg} ${stat.color} p-4 rounded-2xl group-hover:scale-110 transition-transform shrink-0`}>
                <stat.icon size={22} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfica mensual */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight mb-8">
          <TrendingUp size={22} className="text-blue-500" /> Reparaciones por mes (últimos 6 meses)
        </h3>
        <div className="h-64">
          {repairs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <AlertCircle size={40} className="mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-400">Sin datos aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byMonth} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgb(0 0 0 / 0.15)', padding: '12px' }} />
                <Line type="monotone" dataKey="reparaciones" stroke="#2563eb" strokeWidth={3} dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Distribución por estado */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight mb-8">
          <Activity size={22} className="text-indigo-500" /> Distribución por Estado Técnico
        </h3>
        <div className="h-72">
          {byStatus.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <AlertCircle size={40} className="mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-400">Sin datos aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b', textAnchor: 'end' }} angle={-35} interval={0} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgb(0 0 0 / 0.15)', padding: '12px' }} />
                <Bar dataKey="val" radius={[10, 10, 0, 0]} barSize={40} name="Reparaciones">
                  {byStatus.map((entry, i) => (
                    <Cell key={i} fill={statusColors[entry.name] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Resumen totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Total registradas', value: repairs.length },
          { label: 'Entregadas', value: deliveredRepairs.length },
          { label: 'Listas entrega', value: readyCount },
          { label: 'Presupuestos', value: budgets.length },
        ].map((item, i) => (
          <div key={i} className="bg-slate-950 p-6 rounded-3xl text-white text-center">
            <p className="text-3xl font-black">{item.value}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsView;
