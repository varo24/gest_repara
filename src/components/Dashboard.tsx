import React, { useMemo } from 'react';
import { 
  UserPlus, Wrench, CheckCircle2, ArrowRight, Activity, Users, ClipboardList, Clock,
  Home, Building2, MapPin, Calendar, FileText, AlertCircle, Navigation, Phone
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

const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--:--'; }
};

const Dashboard: React.FC<DashboardProps> = ({ repairs, budgets, citas, settings, setView, onNewRepair, onEditRepair }) => {
  if (!settings) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ─── Métricas ──
  const pendingDiagnose = repairs.filter(r => r.status === RepairStatus.PENDING).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const readyToDeliver = repairs.filter(r => r.status === RepairStatus.READY).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const inProgress = repairs.filter(r =>
    r.status === RepairStatus.DIAGNOSING ||
    r.status === RepairStatus.IN_PROGRESS ||
    r.status === RepairStatus.WAITING_PARTS ||
    r.status === RepairStatus.BUDGET_ACCEPTED
  ).sort((a, b) => a.rmaNumber - b.rmaNumber);

  const domicilioPending = repairs.filter(r => r.repairType === 'domicilio' && r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED);
  const pendingBudgets = budgets.filter(b => b.status === 'pending');
  const citasHoy = useMemo(() => (citas || []).filter(c => {
    try { return isSameDay(new Date(c.fecha), today) && c.estado === CitaEstado.Confirmada; }
    catch { return false; }
  }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [citas]);
  const uniqueClients = [...new Set(repairs.map(r => r.customerPhone))].length;
  const waitingParts = repairs.filter(r => r.status === RepairStatus.WAITING_PARTS);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      
      {/* ── ESTADO DEL TALLER ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-600/20">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Estado del Taller</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Resumen de Actividad Técnica</p>
            </div>
          </div>
          <button 
            onClick={onNewRepair}
            className="px-8 py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-black transition-all shadow-2xl active:scale-95"
          >
            <UserPlus size={18} /> Nueva Reparación
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-500 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 cursor-pointer group" onClick={() => setView('repairs')}>
            <CheckCircle2 size={24} className="opacity-40 mb-3 group-hover:scale-110 transition-transform" />
            <p className="text-3xl font-black tracking-tighter">{readyToDeliver.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">Listos Entrega</p>
          </div>

          <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-600/20 cursor-pointer group" onClick={() => setView('repairs')}>
            <Wrench size={24} className="opacity-40 mb-3 group-hover:scale-110 transition-transform" />
            <p className="text-3xl font-black tracking-tighter">{inProgress.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">En Banco</p>
          </div>

          <div className="bg-amber-500 p-6 rounded-[2rem] text-white shadow-xl shadow-amber-500/20 cursor-pointer group" onClick={() => setView('tech-field')}>
            <Home size={24} className="opacity-40 mb-3 group-hover:scale-110 transition-transform" />
            <p className="text-3xl font-black tracking-tighter">{domicilioPending.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">A Domicilio</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm cursor-pointer" onClick={() => setView('customers')}>
            <Users size={24} className="text-slate-300 mb-3" />
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{uniqueClients}</p>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Clientes</p>
          </div>
        </div>
      </section>

      {/* ── CITAS DE HOY ── */}
      {citasHoy.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white"><Calendar size={18} /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Agenda de Hoy</h3>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{citasHoy.length} cita{citasHoy.length !== 1 ? 's' : ''} confirmada{citasHoy.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => setView('calendar')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1">
              Ver Todo <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {citasHoy.slice(0, 3).map(cita => (
              <div key={cita.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => setView('calendar')}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner">
                    {formatTime(cita.fecha)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 text-sm uppercase truncate">{cita.clienteNombre}</h4>
                    <p className="text-[9px] text-slate-400 font-bold truncate">{cita.servicio}</p>
                    {cita.direccion && (
                      <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-0.5 truncate">
                        <MapPin size={9} /> {cita.direccion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── VISITAS A DOMICILIO PENDIENTES ── */}
      {domicilioPending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 p-2.5 rounded-xl text-white"><Home size={18} /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Servicios a Domicilio</h3>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{domicilioPending.length} pendiente{domicilioPending.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => setView('tech-field')} className="text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline flex items-center gap-1">
              Panel de Campo <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {domicilioPending.slice(0, 3).map(repair => (
              <div key={repair.id} onClick={() => onEditRepair(repair)} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 hover:shadow-lg transition-all cursor-pointer flex items-center gap-5 group">
                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Home size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-slate-400">RMA-{repair.rmaNumber.toString().padStart(5, '0')}</span>
                    <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">{repair.status}</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-sm uppercase truncate">{repair.brand} {repair.model}</h4>
                  <p className="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1"><Users size={10} /> {repair.customerName}</span>
                    {repair.address && <span className="flex items-center gap-1 text-amber-500"><MapPin size={10} /> {repair.address}{repair.city ? `, ${repair.city}` : ''}</span>}
                  </p>
                </div>
                <ArrowRight size={18} className="text-slate-200 group-hover:text-amber-500 shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── ALERTAS PENDIENTES ── */}
      {(waitingParts.length > 0 || pendingBudgets.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 p-2.5 rounded-xl text-white"><AlertCircle size={18} /></div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Atención Requerida</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitingParts.length > 0 && (
              <div className="bg-orange-50 p-5 rounded-2xl border border-orange-200 cursor-pointer hover:shadow-md transition-all" onClick={() => setView('repairs')}>
                <div className="flex items-center gap-3 mb-3">
                  <Clock size={18} className="text-orange-500" />
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Esperando Repuestos</p>
                </div>
                <p className="text-2xl font-black text-orange-700">{waitingParts.length}</p>
                <div className="mt-3 space-y-1">
                  {waitingParts.slice(0, 2).map(r => (
                    <p key={r.id} className="text-[10px] text-orange-500 font-bold truncate">
                      RMA-{r.rmaNumber.toString().padStart(5, '0')} · {r.brand} {r.model}
                    </p>
                  ))}
                  {waitingParts.length > 2 && <p className="text-[9px] text-orange-400">+{waitingParts.length - 2} más</p>}
                </div>
              </div>
            )}
            {pendingBudgets.length > 0 && (
              <div className="bg-purple-50 p-5 rounded-2xl border border-purple-200 cursor-pointer hover:shadow-md transition-all" onClick={() => setView('budgets')}>
                <div className="flex items-center gap-3 mb-3">
                  <FileText size={18} className="text-purple-500" />
                  <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Presupuestos Pendientes</p>
                </div>
                <p className="text-2xl font-black text-purple-700">{pendingBudgets.length}</p>
                <div className="mt-3 space-y-1">
                  {pendingBudgets.slice(0, 2).map(b => {
                    const r = repairs.find(rep => rep.id === b.repairId);
                    return (
                      <p key={b.id} className="text-[10px] text-purple-500 font-bold truncate">
                        RMA-{b.rmaNumber.toString().padStart(5, '0')} · {r?.customerName || '—'} · {b.total.toFixed(2)}€
                      </p>
                    );
                  })}
                  {pendingBudgets.length > 2 && <p className="text-[9px] text-purple-400">+{pendingBudgets.length - 2} más</p>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── COLA DE TRABAJO ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Laboratorio Técnico</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Equipos Pendientes de Diagnóstico</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 flex items-center gap-2 px-2">
            <Clock size={14} /> Cola de Trabajo ({pendingDiagnose.length})
          </h3>
          {pendingDiagnose.length > 0 ? (
            pendingDiagnose.slice(0, 6).map(repair => (
              <div key={repair.id} onClick={() => onEditRepair(repair)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer flex items-center gap-6 group">
                <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-white shrink-0 transition-colors ${repair.repairType === 'domicilio' ? 'bg-amber-500 group-hover:bg-amber-600' : 'bg-slate-900 group-hover:bg-indigo-600'}`}>
                  {repair.repairType === 'domicilio' ? <Home size={16} className="opacity-50 mb-0.5" /> : <span className="text-[8px] opacity-40 uppercase">RMA</span>}
                  <span className="text-sm leading-none">{repair.rmaNumber.toString().padStart(5, '0')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900 uppercase text-sm truncate">{repair.brand} {repair.model}</h4>
                    {repair.repairType === 'domicilio' && (
                      <span className="text-[8px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded font-black uppercase shrink-0">Domicilio</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-2">
                    <span className="text-indigo-600">CLI:</span> {repair.customerName}
                  </p>
                  {repair.repairType === 'domicilio' && repair.address && (
                    <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-1 truncate">
                      <MapPin size={9} /> {repair.address}{repair.city ? `, ${repair.city}` : ''}
                    </p>
                  )}
                </div>
                <div className="hidden md:block px-6 border-l border-slate-50 max-w-xs">
                  <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Avería Reportada</p>
                  <p className="text-[10px] font-bold text-slate-600 italic line-clamp-1">{repair.problemDescription}</p>
                </div>
                <ArrowRight size={20} className="text-slate-200 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>
            ))
          ) : (
            <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
              <ClipboardList size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay reparaciones en espera</p>
            </div>
          )}
          {pendingDiagnose.length > 6 && (
            <button onClick={() => setView('repairs')} className="w-full py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-blue-600 transition-colors">
              Ver los {pendingDiagnose.length} pendientes →
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
