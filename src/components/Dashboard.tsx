import React from 'react';
import { 
  UserPlus, Wrench, CheckCircle2, 
  ArrowRight, Activity, Users, ClipboardList, Clock, Cloud, CloudOff
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings, ViewType } from '../types';
import { storage } from '../services/persistence';

interface DashboardProps {
  repairs: RepairItem[];
  settings: AppSettings;
  setView: (view: ViewType) => void;
  onNewRepair: () => void;
  onEditRepair: (repair: RepairItem) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ repairs, settings, setView, onNewRepair, onEditRepair }) => {
  if (!settings) return null;

  const pendingDiagnose = repairs.filter(r => r.status === RepairStatus.PENDING).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const readyToDeliver = repairs.filter(r => r.status === RepairStatus.READY).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const inProgress = repairs.filter(r =>
    r.status === RepairStatus.DIAGNOSING ||
    r.status === RepairStatus.IN_PROGRESS ||
    r.status === RepairStatus.WAITING_PARTS ||
    r.status === RepairStatus.BUDGET_ACCEPTED
  ).sort((a, b) => a.rmaNumber - b.rmaNumber);
  const online = storage.isOnline();

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      
      {/* SECCIÓN ESTADO DEL TALLER */}
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
            <UserPlus size={18} /> Registrar Reparación
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-500/20 flex items-center justify-between group cursor-pointer" onClick={() => setView('repairs')}>
            <div>
              <p className="text-4xl font-black tracking-tighter">{readyToDeliver.length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">Listos para Entrega</p>
            </div>
            <CheckCircle2 size={40} className="opacity-30 group-hover:scale-110 transition-transform" />
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer" onClick={() => setView('customers')}>
            <div>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{[...new Set(repairs.map(r => r.customerPhone))].length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Clientes Registrados</p>
            </div>
            <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center">
              <Users size={28} />
            </div>
          </div>

          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-600/20 flex items-center justify-between group cursor-pointer" onClick={() => setView('repairs')}>
            <div>
              <p className="text-4xl font-black tracking-tighter">{inProgress.length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">Equipos en Banco</p>
            </div>
            <Activity size={40} className="opacity-30 group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </section>

      {/* COLA DE TRABAJO */}
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

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 flex items-center gap-2 px-2">
              <Clock size={14} /> Cola de Trabajo ({pendingDiagnose.length})
            </h3>
            {pendingDiagnose.length > 0 ? (
              pendingDiagnose.slice(0, 5).map(repair => (
                <div key={repair.id} onClick={() => onEditRepair(repair)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer flex items-center gap-6 group">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex flex-col items-center justify-center font-black text-white shrink-0 group-hover:bg-indigo-600 transition-colors">
                    <span className="text-[8px] opacity-40 uppercase">RMA</span>
                    <span className="text-sm leading-none">{repair.rmaNumber.toString().padStart(5, '0')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 uppercase text-sm truncate">{repair.brand} {repair.model}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-2">
                      <span className="text-indigo-600">CLI:</span> {repair.customerName}
                    </p>
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
            {pendingDiagnose.length > 5 && (
              <button onClick={() => setView('repairs')} className="w-full py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-blue-600 transition-colors">
                Ver los {pendingDiagnose.length} pendientes →
              </button>
            )}
          </div>

          {/* Panel estado sincronización */}
          <div className="xl:col-span-4">
            <div className="bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl border border-white/5 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-3">
                  {online
                    ? <Cloud size={20} className="text-emerald-400" />
                    : <CloudOff size={20} className="text-slate-600" />
                  }
                  {online ? 'Supabase Cloud' : 'Modo Local'}
                </h3>
                <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase">
                  {online
                    ? 'Datos sincronizados en la nube. Todos los terminales comparten información en tiempo real.'
                    : 'Sin conexión a Supabase. Los datos se guardan localmente y se sincronizarán al recuperar la conexión.'}
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase">Estado</span>
                  <span className={`text-[9px] font-black uppercase ${online ? 'text-emerald-500' : 'text-slate-600'}`}>
                    {online ? '● ACTIVO' : '○ LOCAL'}
                  </span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${online ? 'bg-emerald-500 w-full animate-pulse' : 'bg-slate-700 w-1/3'}`} />
                </div>
                <div className="mt-4 text-center">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    {repairs.length} reparaciones · {[...new Set(repairs.map(r => r.customerPhone))].length} clientes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
