import React, { useMemo, useState } from 'react';
import { 
  UserPlus, Wrench, CheckCircle2, ArrowRight, Activity, Users, ClipboardList, Clock,
  Home, Building2, MapPin, Calendar, FileText, AlertCircle, Navigation, X, ChevronDown
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings, ViewType, Budget, Cita, CitaEstado } from '../types';

interface DashboardProps {
  repairs: RepairItem[];
  budgets: Budget[];
  citas: Cita[];
  settings: AppSettings;
  setView: (view: ViewType) => void;
  onNewRepair: () => void;
  onEditRepair: (repair: RepairItem) => void;
}

type Section = null | 'ready' | 'inprogress' | 'domicilio' | 'waiting' | 'budgets';

const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); } catch { return '--:--'; } };

const statusColor = (s: RepairStatus | string) => {
  const c: Record<string, string> = {
    [RepairStatus.PENDING]: "bg-yellow-400 text-yellow-900",
    [RepairStatus.DIAGNOSING]: "bg-cyan-400 text-cyan-900",
    [RepairStatus.BUDGET_PENDING]: "bg-violet-500 text-white",
    [RepairStatus.BUDGET_ACCEPTED]: "bg-lime-400 text-lime-900",
    [RepairStatus.BUDGET_REJECTED]: "bg-rose-500 text-white",
    [RepairStatus.WAITING_PARTS]: "bg-orange-500 text-white",
    [RepairStatus.IN_PROGRESS]: "bg-blue-500 text-white",
    [RepairStatus.READY]: "bg-emerald-500 text-white",
    [RepairStatus.DELIVERED]: "bg-slate-400 text-white",
    [RepairStatus.CANCELLED]: "bg-red-600 text-white",
  };
  return c[s] || "bg-slate-200 text-slate-600";
};

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair, onEditRepair }) => {
  if (!settings) return null;
  const [expandedSection, setExpandedSection] = useState<Section>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingDiagnose = repairs.filter(r => r.status === RepairStatus.PENDING).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const readyToDeliver = repairs.filter(r => r.status === RepairStatus.READY).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const inProgress = repairs.filter(r =>
    r.status === RepairStatus.DIAGNOSING || r.status === RepairStatus.IN_PROGRESS ||
    r.status === RepairStatus.WAITING_PARTS || r.status === RepairStatus.BUDGET_ACCEPTED
  ).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const domicilioPending = repairs.filter(r => r.repairType === 'domicilio' && r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED);
  const pendingBudgets = budgets.filter(b => b.status === 'pending');
  const waitingParts = repairs.filter(r => r.status === RepairStatus.WAITING_PARTS);
  const citasHoy = useMemo(() => (citas || []).filter(c => {
    try { return isSameDay(new Date(c.fecha), today) && c.estado !== CitaEstado.Cancelada; } catch { return false; }
  }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [citas]);

  const citasProximas = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);
    return (citas || []).filter(c => {
      try {
        const d = new Date(c.fecha);
        return d >= tomorrow && d <= limit && c.estado !== CitaEstado.Cancelada;
      } catch { return false; }
    }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [citas]);
  const uniqueClients = [...new Set(repairs.map(r => r.customerPhone))].length;

  const toggleSection = (s: Section) => setExpandedSection(prev => prev === s ? null : s);

  // Repair row component
  const RepairRow = ({ r }: { r: RepairItem }) => (
    <div onClick={() => onEditRepair(r)} className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group">
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white shrink-0 text-[10px] ${r.repairType === 'domicilio' ? 'bg-amber-500' : 'bg-slate-800'}`}>
        {r.repairType === 'domicilio' ? <Home size={14} className="opacity-60" /> : <Building2 size={14} className="opacity-60" />}
        <span className="leading-none mt-0.5">{r.rmaNumber.toString().padStart(5,'0').slice(-3)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-slate-800 text-sm uppercase truncate">{r.brand} {r.model}</p>
        <p className="text-[10px] text-slate-400 font-bold truncate">{r.customerName}{r.address ? ` · ${r.address}` : ''}</p>
      </div>
      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${statusColor(r.status)}`}>{r.status}</span>
      <ArrowRight size={16} className="text-slate-200 group-hover:text-blue-500 shrink-0" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-600/20"><Activity size={24} /></div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Estado del Taller</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Resumen de Actividad</p>
          </div>
        </div>
        <button onClick={onNewRepair} className="px-6 py-3 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-black shadow-2xl active:scale-95">
          <UserPlus size={18} /> Nueva Reparación
        </button>
      </div>

      {/* ── KPI CARDS — clickable to expand section ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => toggleSection('ready')} className={`p-5 rounded-[2rem] text-left transition-all group ${expandedSection === 'ready' ? 'bg-emerald-600 ring-4 ring-emerald-200' : 'bg-emerald-500'} text-white shadow-xl shadow-emerald-500/20`}>
          <CheckCircle2 size={20} className="opacity-40 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-3xl font-black tracking-tighter">{readyToDeliver.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">Listos Entrega</p>
        </button>
        <button onClick={() => toggleSection('inprogress')} className={`p-5 rounded-[2rem] text-left transition-all group ${expandedSection === 'inprogress' ? 'bg-indigo-700 ring-4 ring-indigo-200' : 'bg-indigo-600'} text-white shadow-xl shadow-indigo-600/20`}>
          <Wrench size={20} className="opacity-40 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-3xl font-black tracking-tighter">{inProgress.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">En Banco</p>
        </button>
        <button onClick={() => toggleSection('domicilio')} className={`p-5 rounded-[2rem] text-left transition-all group ${expandedSection === 'domicilio' ? 'bg-amber-600 ring-4 ring-amber-200' : 'bg-amber-500'} text-white shadow-xl shadow-amber-500/20`}>
          <Home size={20} className="opacity-40 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-3xl font-black tracking-tighter">{domicilioPending.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">A Domicilio</p>
        </button>
        <button onClick={() => setView('customers')} className="p-5 rounded-[2rem] bg-white border border-slate-100 shadow-sm text-left">
          <Users size={20} className="text-slate-300 mb-2" />
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{uniqueClients}</p>
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Clientes</p>
        </button>
      </div>

      {/* ── EXPANDED SECTION ── */}
      {expandedSection && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 bg-slate-50/50">
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              {expandedSection === 'ready' && <><CheckCircle2 size={16} className="text-emerald-500" /> Listos para Entrega ({readyToDeliver.length})</>}
              {expandedSection === 'inprogress' && <><Wrench size={16} className="text-indigo-500" /> En Banco de Trabajo ({inProgress.length})</>}
              {expandedSection === 'domicilio' && <><Home size={16} className="text-amber-500" /> Servicios a Domicilio ({domicilioPending.length})</>}
              {expandedSection === 'waiting' && <><Clock size={16} className="text-orange-500" /> Esperando Repuestos ({waitingParts.length})</>}
              {expandedSection === 'budgets' && <><FileText size={16} className="text-purple-500" /> Presupuestos Pendientes ({pendingBudgets.length})</>}
            </h3>
            <button onClick={() => setExpandedSection(null)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {expandedSection === 'ready' && readyToDeliver.map(r => <RepairRow key={r.id} r={r} />)}
            {expandedSection === 'inprogress' && inProgress.map(r => <RepairRow key={r.id} r={r} />)}
            {expandedSection === 'domicilio' && domicilioPending.map(r => <RepairRow key={r.id} r={r} />)}
            {expandedSection === 'waiting' && waitingParts.map(r => <RepairRow key={r.id} r={r} />)}
            {expandedSection === 'budgets' && pendingBudgets.map(b => {
              const r = repairs.find(rep => rep.id === b.repairId);
              return (
                <div key={b.id} onClick={() => setView('budgets')} className="bg-white p-4 rounded-xl border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                    {b.rmaNumber.toString().padStart(5,'0').slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm uppercase truncate">{r?.customerName || '—'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">RMA-{b.rmaNumber.toString().padStart(5, '0')}</p>
                  </div>
                  <span className="font-black text-purple-700 text-sm">{b.total.toFixed(2)}€</span>
                </div>
              );
            })}
            {((expandedSection === 'ready' && readyToDeliver.length === 0) ||
              (expandedSection === 'inprogress' && inProgress.length === 0) ||
              (expandedSection === 'domicilio' && domicilioPending.length === 0) ||
              (expandedSection === 'waiting' && waitingParts.length === 0) ||
              (expandedSection === 'budgets' && pendingBudgets.length === 0)) && (
              <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-12">Sin elementos</p>
            )}
          </div>
        </section>
      )}

      {/* ── VISITAS DE HOY — full panel below KPIs ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-xl text-white"><Calendar size={18} /></div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Visitas de Hoy</h3>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}{citasHoy.length} visita{citasHoy.length !== 1 ? 's' : ''} programada{citasHoy.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={() => setView('calendar')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1">
            Planificador <ArrowRight size={14} />
          </button>
        </div>

        {citasHoy.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {citasHoy.map(c => {
              const estadoColors: Record<string, string> = {
                'Pendiente': 'bg-yellow-400 text-yellow-900',
                'En Camino': 'bg-sky-500 text-white',
                'En Sitio': 'bg-violet-500 text-white',
                'Finalizada': 'bg-emerald-500 text-white',
              };
              const isDone = c.estadoVisita === 'Finalizada';
              return (
                <div key={c.id} onClick={() => setView('calendar')}
                  className={`bg-white p-4 rounded-2xl border shadow-sm hover:shadow-lg transition-all cursor-pointer ${isDone ? 'border-emerald-100 opacity-60' : 'border-slate-100 hover:border-blue-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-black text-sm shrink-0 ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      <span className="text-base font-black leading-none">{fmtTime(c.fecha)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-slate-900 text-sm uppercase truncate">{c.clienteNombre}</p>
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${estadoColors[c.estadoVisita] || 'bg-slate-100 text-slate-500'}`}>
                          {c.estadoVisita}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 truncate">{c.servicio}</p>
                      {c.direccion && (
                        <p className="text-[9px] text-slate-400 flex items-center gap-1 mt-1 truncate">
                          <MapPin size={10} className="shrink-0" /> {c.direccion}{c.ciudad ? `, ${c.ciudad}` : ''}
                        </p>
                      )}
                      {c.telefono && (
                        <p className="text-[9px] text-slate-400 mt-0.5">{c.telefono}</p>
                      )}
                    </div>
                  </div>
                  {c.notas && (
                    <div className="mt-2 pt-2 border-t border-slate-50">
                      <p className="text-[9px] text-slate-400 line-clamp-2">{c.notas}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white py-12 rounded-2xl border-2 border-dashed border-slate-100 text-center flex flex-col items-center gap-3">
            <Calendar size={32} className="text-slate-200" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin visitas programadas hoy</p>
            <button onClick={() => setView('calendar')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
              Agendar Visita
            </button>
          </div>
        )}

        {/* Próximas visitas (mañana y pasado) */}
        {citasProximas.length > 0 && (
          <div className="pt-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Próximas visitas</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {citasProximas.slice(0, 6).map(c => (
                <div key={c.id} onClick={() => setView('calendar')}
                  className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-white hover:shadow-sm transition-all shrink-0 min-w-[200px]">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                    {new Date(c.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(c.fecha)}
                  </p>
                  <p className="text-xs font-black text-slate-800 uppercase truncate mt-0.5">{c.clienteNombre}</p>
                  <p className="text-[9px] text-slate-400 font-bold truncate">{c.servicio}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── ALERTS (clickable) ── */}
      {(waitingParts.length > 0 || pendingBudgets.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {waitingParts.length > 0 && (
            <button onClick={() => toggleSection('waiting')} className={`text-left bg-orange-50 p-5 rounded-2xl border transition-all ${expandedSection === 'waiting' ? 'border-orange-400 shadow-lg' : 'border-orange-200 hover:shadow-md'}`}>
              <div className="flex items-center gap-2 mb-2"><Clock size={16} className="text-orange-500" /><span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Esperando Repuestos</span></div>
              <p className="text-2xl font-black text-orange-700">{waitingParts.length}</p>
            </button>
          )}
          {pendingBudgets.length > 0 && (
            <button onClick={() => toggleSection('budgets')} className={`text-left bg-purple-50 p-5 rounded-2xl border transition-all ${expandedSection === 'budgets' ? 'border-purple-400 shadow-lg' : 'border-purple-200 hover:shadow-md'}`}>
              <div className="flex items-center gap-2 mb-2"><FileText size={16} className="text-purple-500" /><span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Presupuestos Pendientes</span></div>
              <p className="text-2xl font-black text-purple-700">{pendingBudgets.length}</p>
            </button>
          )}
        </section>
      )}

      {/* ── COLA DE TRABAJO ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg"><Wrench size={18} /></div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Cola de Diagnóstico</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{pendingDiagnose.length} pendientes</p>
          </div>
        </div>
        {pendingDiagnose.length > 0 ? (
          <div className="space-y-2">
            {pendingDiagnose.slice(0, 5).map(r => <RepairRow key={r.id} r={r} />)}
            {pendingDiagnose.length > 5 && (
              <button onClick={() => setView('repairs')} className="w-full py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-blue-600">
                Ver los {pendingDiagnose.length} pendientes →
              </button>
            )}
          </div>
        ) : (
          <div className="py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
            <ClipboardList size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin reparaciones en espera</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
