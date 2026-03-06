import React, { useState, useEffect, useCallback } from 'react';
import {
  Navigation, Calendar, Wrench, ClipboardList, MapPin, Phone, MessageCircle,
  ChevronRight, Camera, Plus, CheckCircle2, ArrowLeft, Clock, FileText,
  RefreshCw, LogOut, Wifi, WifiOff, Home, User, AlertCircle
} from 'lucide-react';
import { RepairItem, RepairStatus, Budget, AppSettings, Cita, CitaEstado, EstadoVisita } from '../types';
import { storage } from '../services/persistence';
import RepairForm from './RepairForm';
import BudgetCreator from './BudgetCreator';
import SignaturePad from './SignaturePad';

interface FieldModeAppProps {
  onExit: () => void;
}

const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); } catch { return '--:--'; } };

type FieldView = 'home' | 'repair-form' | 'budget' | 'signature';

const FieldModeApp: React.FC<FieldModeAppProps> = ({ onExit }) => {
  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ appName: 'ReparaPro', address: '', phone: '', taxId: '' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<FieldView>('home');
  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);
  const [activeBudgetRepair, setActiveBudgetRepair] = useState<RepairItem | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);
  const [signatureRepair, setSignatureRepair] = useState<RepairItem | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const init = async () => {
      await storage.init();
      storage.subscribe('repairs', (d) => { setRepairs(d); setLoading(false); });
      storage.subscribe('budgets', setBudgets);
      storage.subscribe('settings', (d) => { if (d.length > 0) setSettings(d[0]); });
      storage.subscribe('citas', setCitas);
    };
    init();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try { await storage.syncNow(); } catch {}
    finally { setSyncing(false); }
  };

  // Filter: only domicilio repairs that are active
  const domRepairs = repairs.filter(r =>
    r.repairType === 'domicilio' &&
    r.status !== RepairStatus.DELIVERED &&
    r.status !== RepairStatus.CANCELLED
  ).sort((a, b) => a.rmaNumber - b.rmaNumber);

  // Today's citas
  const citasHoy = citas.filter(c => {
    try { return isSameDay(new Date(c.fecha), today) && c.estado !== CitaEstado.Cancelada; } catch { return false; }
  }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const nextCita = citasHoy.find(c => c.estadoVisita !== EstadoVisita.Finalizada);

  const openMaps = (addr: string, city?: string) => {
    const dir = [addr, city, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  const openWhatsApp = (phone: string, name: string) => {
    const p = phone.replace(/\D/g, '');
    if (!p) return;
    window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(`Hola ${name}, soy el técnico de ${settings.appName}. Voy de camino.`)}`);
  };

  const cycleEstado = (cita: Cita) => {
    const order = [EstadoVisita.Pendiente, EstadoVisita.EnCamino, EstadoVisita.EnSitio, EstadoVisita.Finalizada];
    const next = order[(order.indexOf(cita.estadoVisita) + 1) % order.length];
    storage.save('citas', cita.id, {
      ...cita,
      estadoVisita: next,
      estado: next === EstadoVisita.Finalizada ? CitaEstado.Completada : CitaEstado.Confirmada,
    });
  };

  const createRepairFromCita = (cita: Cita) => {
    const newRma = storage.nextRmaNumber();
    const newRepair: RepairItem = {
      id: `RMA-${Date.now()}`,
      rmaNumber: newRma,
      repairType: 'domicilio',
      customerName: cita.clienteNombre,
      customerPhone: cita.telefono || '',
      deviceType: '', brand: '', model: '', serialNumber: '',
      problemDescription: [cita.servicio, cita.notas ? `\n--- Inspección ---\n${cita.notas}` : ''].filter(Boolean).join(''),
      entryDate: new Date().toISOString(),
      status: RepairStatus.PENDING,
      address: cita.direccion || '',
      city: cita.ciudad || '',
    };
    storage.save('citas', cita.id, { ...cita, rmaId: newRepair.id });
    setEditingRepair(newRepair);
    setView('repair-form');
  };

  const handleSaveRepair = async (data: Partial<RepairItem>, rma?: number) => {
    const id = data.id || `RMA-${Date.now()}`;
    const rmaNum = rma || storage.nextRmaNumber();
    const saved: RepairItem = { ...data as RepairItem, id, rmaNumber: rmaNum, repairType: data.repairType || 'domicilio' };
    await storage.save('repairs', id, saved);
    setView('home');
    setEditingRepair(null);
  };

  const handleSaveBudget = async (budget: Budget) => {
    await storage.save('budgets', budget.id, budget);
    setView('home');
    setActiveBudgetRepair(null);
    setEditingBudget(undefined);
  };

  const estadoColor: Record<string, string> = {
    'Pendiente': 'bg-yellow-400 text-yellow-900',
    'En Camino': 'bg-sky-500 text-white',
    'En Sitio': 'bg-violet-500 text-white',
    'Finalizada': 'bg-emerald-500 text-white',
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <RefreshCw size={32} className="animate-spin text-blue-500" />
    </div>
  );

  // ── Sub-views ──
  if (view === 'repair-form') return (
    <RepairForm
      settings={settings}
      onSave={handleSaveRepair}
      onCancel={() => { setView('home'); setEditingRepair(null); }}
      initialData={editingRepair || undefined}
    />
  );

  if (view === 'budget' && activeBudgetRepair) return (
    <BudgetCreator
      repair={activeBudgetRepair}
      settings={settings}
      initialBudget={editingBudget}
      onSave={handleSaveBudget}
      onClose={() => { setView('home'); setActiveBudgetRepair(null); }}
    />
  );

  if (view === 'signature' && signatureRepair) return (
    <SignaturePad
      label="Firma del cliente — servicio completado"
      onSave={(sig) => {
        if (sig) {
          storage.save('repairs', signatureRepair.id, { ...signatureRepair, customerSignature: sig, status: RepairStatus.DELIVERED });
          setSignatureRepair(null);
          setView('home');
        }
      }}
    />
  );

  // ── HOME VIEW ──
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Navigation size={20} className="text-amber-400" />
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight">{settings.appName}</h1>
            <p className="text-[8px] text-amber-400 font-black uppercase tracking-widest">Modo Campo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all">
            <RefreshCw size={16} className={syncing ? 'animate-spin text-blue-400' : 'text-slate-400'} />
          </button>
          <button onClick={onExit} className="p-2 rounded-xl bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-400 transition-all">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-24">
        {/* Date */}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* ═══ NEXT VISIT — Hero ═══ */}
        {nextCita && (
          <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Próxima Visita</span>
              <span className="ml-auto font-mono font-black text-lg">{fmtTime(nextCita.fecha)}</span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight mb-1">{nextCita.clienteNombre}</h2>
            <p className="text-xs text-slate-400 font-bold mb-1">{nextCita.servicio}</p>
            {nextCita.direccion && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-4">
                <MapPin size={12} /> {nextCita.direccion}{nextCita.ciudad ? `, ${nextCita.ciudad}` : ''}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => openMaps(nextCita.direccion || '', nextCita.ciudad)}
                className="py-3 bg-white text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95">
                <Navigation size={14} /> GPS
              </button>
              <button onClick={() => openWhatsApp(nextCita.telefono || '', nextCita.clienteNombre)}
                className="py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95">
                <MessageCircle size={14} /> WhatsApp
              </button>
              <button onClick={() => cycleEstado(nextCita)}
                className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 ${estadoColor[nextCita.estadoVisita] || 'bg-slate-700 text-white'}`}>
                {nextCita.estadoVisita}
              </button>
            </div>
          </div>
        )}

        {/* ═══ TODAY'S VISITS ═══ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
              <Calendar size={14} className="text-blue-500" /> Visitas Hoy
            </h3>
            <span className="text-[9px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded">{citasHoy.length}</span>
          </div>

          {citasHoy.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
              <Calendar size={28} className="text-slate-200 mx-auto mb-2" />
              <p className="text-[10px] font-black text-slate-300 uppercase">Sin visitas hoy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {citasHoy.map(c => {
                const linked = c.rmaId ? repairs.find(r => r.id === c.rmaId) : undefined;
                const isDone = c.estadoVisita === EstadoVisita.Finalizada;
                return (
                  <div key={c.id} className={`bg-white rounded-xl border p-4 space-y-3 ${isDone ? 'border-emerald-100 opacity-70' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        {fmtTime(c.fecha)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-900 uppercase truncate">{c.clienteNombre}</p>
                        <p className="text-[9px] text-slate-400 font-bold truncate">{c.servicio}</p>
                      </div>
                      <button onClick={() => cycleEstado(c)}
                        className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase shrink-0 active:scale-95 ${estadoColor[c.estadoVisita] || 'bg-slate-100'}`}>
                        {c.estadoVisita}
                      </button>
                    </div>
                    {c.direccion && (
                      <p className="text-[9px] text-slate-400 flex items-center gap-1">
                        <MapPin size={10} /> {c.direccion}{c.ciudad ? `, ${c.ciudad}` : ''}
                      </p>
                    )}
                    {c.notas && (
                      <p className="text-[9px] text-slate-500 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">{c.notas}</p>
                    )}
                    <div className="flex gap-2">
                      {c.direccion && (
                        <button onClick={() => openMaps(c.direccion || '', c.ciudad)}
                          className="flex-1 py-2.5 bg-slate-50 rounded-lg text-[9px] font-black uppercase text-slate-600 flex items-center justify-center gap-1 active:scale-95">
                          <Navigation size={12} /> GPS
                        </button>
                      )}
                      {c.telefono && (
                        <button onClick={() => openWhatsApp(c.telefono || '', c.clienteNombre)}
                          className="flex-1 py-2.5 bg-slate-50 rounded-lg text-[9px] font-black uppercase text-slate-600 flex items-center justify-center gap-1 active:scale-95">
                          <MessageCircle size={12} /> WhatsApp
                        </button>
                      )}
                      {linked ? (
                        <button onClick={() => { setEditingRepair(linked); setView('repair-form'); }}
                          className="flex-1 py-2.5 bg-blue-50 rounded-lg text-[9px] font-black uppercase text-blue-600 flex items-center justify-center gap-1 active:scale-95">
                          <FileText size={12} /> RMA-{linked.rmaNumber.toString().padStart(5,'0').slice(-3)}
                        </button>
                      ) : (
                        <button onClick={() => createRepairFromCita(c)}
                          className="flex-1 py-2.5 bg-emerald-50 rounded-lg text-[9px] font-black uppercase text-emerald-700 flex items-center justify-center gap-1 active:scale-95">
                          <Plus size={12} /> Crear OT
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ═══ DOMICILIO REPAIRS ═══ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
              <Home size={14} className="text-amber-500" /> Reparaciones a Domicilio
            </h3>
            <span className="text-[9px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded">{domRepairs.length}</span>
          </div>

          {domRepairs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
              <Wrench size={28} className="text-slate-200 mx-auto mb-2" />
              <p className="text-[10px] font-black text-slate-300 uppercase">Sin reparaciones a domicilio activas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domRepairs.map(r => {
                const budget = budgets.find(b => b.repairId === r.id);
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex flex-col items-center justify-center shrink-0">
                        <Home size={14} className="opacity-50" />
                        <span className="text-[9px] font-black leading-none">{r.rmaNumber.toString().padStart(5,'0').slice(-3)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-900 uppercase truncate">{r.brand} {r.model}</p>
                        <p className="text-[9px] text-slate-400 font-bold truncate">{r.customerName} · {r.deviceType}</p>
                      </div>
                      <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${
                        r.status === RepairStatus.READY ? 'bg-emerald-500 text-white' :
                        r.status === RepairStatus.PENDING ? 'bg-yellow-400 text-yellow-900' :
                        r.status === RepairStatus.IN_PROGRESS ? 'bg-blue-500 text-white' :
                        'bg-slate-400 text-white'
                      }`}>{r.status}</span>
                    </div>
                    {r.address && (
                      <p className="text-[9px] text-slate-400 flex items-center gap-1">
                        <MapPin size={10} /> {r.address}{r.city ? `, ${r.city}` : ''}
                      </p>
                    )}
                    {/* Quick actions: GPS, WhatsApp, Call */}
                    <div className="flex gap-2">
                      {r.address && (
                        <button onClick={() => openMaps(r.address || '', r.city)}
                          className="flex-1 py-2.5 bg-blue-50 rounded-lg text-[9px] font-black uppercase text-blue-600 flex items-center justify-center gap-1 active:scale-95">
                          <Navigation size={12} /> GPS
                        </button>
                      )}
                      {r.customerPhone && (
                        <button onClick={() => openWhatsApp(r.customerPhone, r.customerName)}
                          className="flex-1 py-2.5 bg-emerald-50 rounded-lg text-[9px] font-black uppercase text-emerald-600 flex items-center justify-center gap-1 active:scale-95">
                          <MessageCircle size={12} /> WhatsApp
                        </button>
                      )}
                      {r.customerPhone && (
                        <a href={`tel:${r.customerPhone}`}
                          className="flex-1 py-2.5 bg-slate-50 rounded-lg text-[9px] font-black uppercase text-slate-600 flex items-center justify-center gap-1 active:scale-95">
                          <Phone size={12} /> Llamar
                        </a>
                      )}
                    </div>
                    {/* Management actions */}
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingRepair(r); setView('repair-form'); }}
                        className="flex-1 py-2.5 bg-slate-50 rounded-lg text-[9px] font-black uppercase text-slate-600 flex items-center justify-center gap-1 active:scale-95">
                        <ClipboardList size={12} /> Ficha
                      </button>
                      <button onClick={() => { setActiveBudgetRepair(r); setEditingBudget(budget); setView('budget'); }}
                        className="flex-1 py-2.5 bg-slate-50 rounded-lg text-[9px] font-black uppercase text-slate-600 flex items-center justify-center gap-1 active:scale-95">
                        <FileText size={12} /> {budget ? 'Presupuesto' : 'Presupuestar'}
                      </button>
                      {r.status === RepairStatus.READY && (
                        <button onClick={() => { setSignatureRepair(r); setView('signature'); }}
                          className="flex-1 py-2.5 bg-emerald-50 rounded-lg text-[9px] font-black uppercase text-emerald-700 flex items-center justify-center gap-1 active:scale-95">
                          <CheckCircle2 size={12} /> Firmar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* New repair button */}
        <button onClick={() => { setEditingRepair(null); setView('repair-form'); }}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all">
          <Plus size={16} /> Nueva Orden de Trabajo
        </button>
      </div>
    </div>
  );
};

export default FieldModeApp;
