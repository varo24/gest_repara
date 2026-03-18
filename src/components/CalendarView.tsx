import React, { useState, useMemo } from 'react';
import { Cita, CitaEstado, EstadoVisita, RepairItem, AppSettings } from '../types';
import {
  Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Plus, Edit2, Trash2, X,
  Phone, Navigation, MessageCircle, CheckCircle2, Wrench, ClipboardList,
  FileText, ArrowRight, AlertCircle
} from 'lucide-react';

interface CalendarViewProps {
  citas: Cita[];
  repairs: RepairItem[];
  settings: AppSettings;
  onSaveCita: (cita: Cita) => void;
  onDeleteCita: (id: string) => void;
  onNavigateToRepair: (repair: RepairItem) => void;
  onCreateRepairFromCita?: (cita: Cita) => void;
}

const formatDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--:--'; }
};
const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const CalendarView: React.FC<CalendarViewProps> = ({
  citas, repairs, settings, onSaveCita, onDeleteCita, onNavigateToRepair, onCreateRepairFromCita
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [editingCita, setEditingCita] = useState<Cita | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cita | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<Cita | null>(null);
  const [expandedCita, setExpandedCita] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clienteNombre: '', telefono: '', direccion: '', ciudad: '',
    servicio: '', hora: '10:00', fecha: '', notas: '',
  });

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 3)), []);

  const citasDia = useMemo(() => {
    return citas
      .filter(c => { try { return isSameDay(new Date(c.fecha), selectedDate); } catch { return false; } })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [citas, selectedDate]);

  const agendaHoy = useMemo(() => {
    return citas
      .filter(c => { try { return isSameDay(new Date(c.fecha), today) && c.estado === CitaEstado.Confirmada; } catch { return false; } })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [citas]);

  const proximaCita = useMemo(() => agendaHoy.find(c => c.estadoVisita !== EstadoVisita.Finalizada), [agendaHoy]);

  // ── Open create/edit modal ──
  const handleOpenCreate = () => {
    setEditingCita(null);
    setFormData({
      clienteNombre: '', telefono: '', direccion: '', ciudad: '',
      servicio: '', hora: '10:00', notas: '',
      fecha: selectedDate.toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleOpenEdit = (cita: Cita) => {
    setEditingCita(cita);
    setFormData({
      clienteNombre: cita.clienteNombre,
      telefono: cita.telefono || '',
      direccion: cita.direccion || '',
      ciudad: cita.ciudad || '',
      servicio: cita.servicio,
      hora: formatTime(cita.fecha),
      fecha: new Date(cita.fecha).toISOString().split('T')[0],
      notas: cita.notas || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.clienteNombre || !formData.servicio) return;
    const [h, m] = formData.hora.split(':').map(Number);
    const fechaCita = formData.fecha ? new Date(formData.fecha) : new Date(selectedDate);
    fechaCita.setHours(h || 0, m || 0, 0, 0);

    const cita: Cita = {
      id: editingCita?.id || `cita-${Date.now()}`,
      clienteNombre: formData.clienteNombre,
      fecha: fechaCita.toISOString(),
      servicio: formData.servicio,
      estado: editingCita?.estado || CitaEstado.Confirmada,
      estadoVisita: editingCita?.estadoVisita || EstadoVisita.Pendiente,
      direccion: formData.direccion,
      ciudad: formData.ciudad,
      telefono: formData.telefono,
      notas: formData.notas,
      rmaId: editingCita?.rmaId,
    };
    onSaveCita(cita);
    setShowModal(false);
  };

  // ── Convert cita → repair ──
  const handleConvertToRepair = (cita: Cita) => {
    if (onCreateRepairFromCita) {
      onCreateRepairFromCita(cita);
    }
  };

  // ── Check if cita already has a linked repair ──
  const getLinkedRepair = (cita: Cita): RepairItem | undefined => {
    if (cita.rmaId) return repairs.find(r => r.id === cita.rmaId);
    return undefined;
  };

  // ── External actions ──
  const handleOpenMaps = (cita: Cita) => {
    const dir = [cita.direccion, cita.ciudad, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  const handleWhatsApp = (cita: Cita) => {
    const phone = (cita.telefono || '').replace(/\D/g, '');
    if (!phone) return;
    const msg = encodeURIComponent(`Hola ${cita.clienteNombre}, soy el técnico de ${settings.appName}. Te informo que voy de camino. Estaré allí en breve.`);
    window.open(`whatsapp://send?phone=${phone}&text=${msg}`);
  };

  const handleGoogleCalendar = (cita: Cita) => {
    const start = new Date(cita.fecha);
    const end = new Date(start.getTime() + 3600000);
    const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${settings.appName}: ${cita.servicio}`)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(`Cliente: ${cita.clienteNombre}\nDirección: ${cita.direccion || 'N/A'}`)}&location=${encodeURIComponent(cita.direccion || '')}&sf=true&output=xml`;
    window.open(url, 'GoogleCalendar', 'width=800,height=700,scrollbars=yes,resizable=yes');
  };

  // ── Estado visita badge ──
  const estadoBadge = (ev: EstadoVisita) => {
    const m: Record<string, string> = {
      [EstadoVisita.Pendiente]: 'bg-yellow-400 text-yellow-900',
      [EstadoVisita.EnCamino]: 'bg-sky-500 text-white',
      [EstadoVisita.EnSitio]: 'bg-violet-500 text-white',
      [EstadoVisita.Finalizada]: 'bg-emerald-500 text-white',
    };
    return m[ev] || 'bg-slate-100 text-slate-500';
  };

  // ── Cycle estado visita ──
  const cycleEstadoVisita = (cita: Cita) => {
    const order = [EstadoVisita.Pendiente, EstadoVisita.EnCamino, EstadoVisita.EnSitio, EstadoVisita.Finalizada];
    const idx = order.indexOf(cita.estadoVisita);
    const next = order[(idx + 1) % order.length]; // loops back to Pendiente after Finalizada
    const updated: Cita = {
      ...cita,
      estadoVisita: next,
      estado: next === EstadoVisita.Finalizada ? CitaEstado.Completada : CitaEstado.Confirmada,
    };
    onSaveCita(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Planificador</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{formatDate(selectedDate)}</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          <Plus size={16} /> Agendar Visita
        </button>
      </div>

      {/* Próxima cita del día (hero card) */}
      {proximaCita && isSameDay(selectedDate, today) && (
        <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white shadow-2xl relative overflow-hidden group border border-slate-800">
          <div className="absolute -top-12 -right-12 opacity-[0.05] group-hover:scale-110 transition-transform duration-1000">
            <Navigation size={220} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 rounded-full border border-blue-500/30">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Objetivo en Curso</span>
              </div>
              <span className="text-xl font-mono font-black text-white/90 bg-white/5 px-3 py-1 rounded-lg">{formatTime(proximaCita.fecha)}</span>
            </div>
            <div className="mb-8">
              <h2 className="text-3xl font-black mb-2 tracking-tighter truncate uppercase">{proximaCita.clienteNombre}</h2>
              <p className="text-sm font-bold text-slate-400 mb-1">{proximaCita.servicio}</p>
              {proximaCita.direccion && (
                <div className="flex items-start gap-2 text-slate-400">
                  <MapPin size={18} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold truncate italic">{proximaCita.direccion}{proximaCita.ciudad ? `, ${proximaCita.ciudad}` : ''}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => handleOpenMaps(proximaCita)} className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[9px] tracking-[0.15em] bg-white text-slate-900 hover:bg-slate-100 shadow-lg transition-all active:scale-95">
                <Navigation size={16} /> GPS
              </button>
              <button onClick={() => handleWhatsApp(proximaCita)} className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[9px] tracking-[0.15em] bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg transition-all active:scale-95">
                <MessageCircle size={16} /> WhatsApp
              </button>
              <button onClick={() => handleGoogleCalendar(proximaCita)} className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[9px] tracking-[0.15em] bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all active:scale-95">
                <Calendar size={16} /> Agendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: 'none' }}>
        {days.map(day => {
          const active = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          const citasCount = citas.filter(c => { try { return isSameDay(new Date(c.fecha), day); } catch { return false; } }).length;
          return (
            <button key={day.toISOString()} onClick={() => setSelectedDate(new Date(day))}
              className={`flex flex-col items-center min-w-[64px] p-3 rounded-2xl transition-all shrink-0 relative ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : isToday ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-200'}`}>
              <span className="text-[10px] font-black uppercase mb-1">{dayNames[day.getDay()]}</span>
              <span className="text-xl font-black">{day.getDate()}</span>
              {citasCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center ${active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                  {citasCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Citas del día */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agenda del día</h2>
          <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black">{citasDia.length} Tareas</span>
        </div>

        {citasDia.length === 0 ? (
          <div className="bg-white py-20 rounded-[2rem] text-center border-2 border-dashed border-slate-100 flex flex-col items-center">
            <Calendar size={48} className="text-slate-100 mb-4" />
            <p className="text-slate-400 font-bold text-sm">Sin visitas programadas para este día</p>
          </div>
        ) : (
          <div className="space-y-3">
            {citasDia.map(cita => {
              const isDone = cita.estadoVisita === EstadoVisita.Finalizada;
              const linked = getLinkedRepair(cita);
              const isExpanded = expandedCita === cita.id;

              return (
                <div key={cita.id} className={`bg-white rounded-[1.8rem] border transition-all ${isDone ? 'border-emerald-100' : 'border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}>
                  {/* Main row */}
                  <div className="p-5 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedCita(isExpanded ? null : cita.id)}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600 shadow-inner'}`}>
                        {formatTime(cita.fecha)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{cita.clienteNombre}</h4>
                          {linked && (
                            <span className="text-[7px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase shrink-0">
                              RMA-{linked.rmaNumber.toString().padStart(5, '0')}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-black uppercase truncate tracking-widest text-slate-400">{cita.servicio}</p>
                        {cita.direccion && (
                          <p className="text-[9px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                            <MapPin size={10} /> {cita.direccion}{cita.ciudad ? `, ${cita.ciudad}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {/* Estado visita badge — click to advance */}
                      <button onClick={(e) => { e.stopPropagation(); cycleEstadoVisita(cita); }}
                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${estadoBadge(cita.estadoVisita)}`}
                        title="Cambiar estado de visita">
                        {cita.estadoVisita}
                      </button>
                      {isDone && <CheckCircle2 size={18} className="text-emerald-500" />}
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-50 space-y-4 animate-in slide-in-from-top duration-200">
                      {/* Notas de inspección */}
                      {cita.notas && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-3">
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">
                            <ClipboardList size={12} className="inline mr-1" /> Notas de Inspección
                          </p>
                          <p className="text-xs text-amber-800 leading-relaxed">{cita.notas}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenMaps(cita); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 text-[9px] font-black uppercase tracking-widest transition-all">
                          <Navigation size={14} /> GPS
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleWhatsApp(cita); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 text-[9px] font-black uppercase tracking-widest transition-all">
                          <MessageCircle size={14} /> WhatsApp
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(cita); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 text-[9px] font-black uppercase tracking-widest transition-all">
                          <Edit2 size={14} /> Editar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(cita); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-600 text-[9px] font-black uppercase tracking-widest transition-all">
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>

                      {/* ═══ CREAR ORDEN DE TRABAJO ═══ */}
                      {linked ? (
                        <button onClick={(e) => { e.stopPropagation(); onNavigateToRepair(linked); }}
                          className="w-full py-4 bg-blue-50 text-blue-700 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all border border-blue-200">
                          <FileText size={16} />
                          Ver Orden de Trabajo — RMA-{linked.rmaNumber.toString().padStart(5, '0')}
                          <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmConvert(cita); }}
                          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]">
                          <Wrench size={16} />
                          Crear Orden de Trabajo
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Modal Crear/Editar Cita ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-50 bg-slate-50/50 shrink-0">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingCita ? 'Editar Visita' : 'Agendar Visita'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-full hover:bg-white transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Nombre del Cliente</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none" placeholder="Nombre completo" value={formData.clienteNombre} onChange={e => setFormData({ ...formData, clienteNombre: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Teléfono</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="600 000 000" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Dirección</label>
                  <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Calle y número" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Ciudad</label>
                  <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Valencia" value={formData.ciudad} onChange={e => setFormData({ ...formData, ciudad: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Hora de Cita</label>
                  <input type="time" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Fecha</label>
                  <input type="date" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Motivo de la Visita</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Revisión Caldera, Presupuesto Lavadora..." value={formData.servicio} onChange={e => setFormData({ ...formData, servicio: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">
                  <ClipboardList size={12} className="inline mr-1" />
                  Notas de Inspección / Observaciones
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={4}
                  placeholder="Apunte aquí los detalles de la inspección: estado del equipo, diagnóstico previo, materiales necesarios, problemas detectados..."
                  value={formData.notas}
                  onChange={e => setFormData({ ...formData, notas: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="px-5 py-3 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                  {editingCita ? 'Guardar Cambios' : 'Agendar Visita'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Confirm Convert to Repair Modal ═══ */}
      {confirmConvert && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setConfirmConvert(null)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-emerald-50 rounded-2xl">
                <Wrench size={28} className="text-emerald-600" />
              </div>
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Crear Orden de Trabajo</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Se creará una nueva reparación con los datos de esta cita.
                El formulario se abrirá pre-rellenado para que pueda completar los detalles del equipo.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Cliente:</span>
                <span className="font-black text-slate-700">{confirmConvert.clienteNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Teléfono:</span>
                <span className="font-black text-slate-700">{confirmConvert.telefono || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Servicio:</span>
                <span className="font-black text-slate-700">{confirmConvert.servicio}</span>
              </div>
              {confirmConvert.direccion && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Dirección:</span>
                  <span className="font-black text-slate-700">{confirmConvert.direccion}</span>
                </div>
              )}
              {confirmConvert.notas && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 font-bold block mb-1">Notas inspección:</span>
                  <span className="text-slate-700 leading-relaxed">{confirmConvert.notas}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConfirmConvert(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
                Cancelar
              </button>
              <button onClick={() => { handleConvertToRepair(confirmConvert); setConfirmConvert(null); }}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                Crear OT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">¿Eliminar esta cita?</p>
              <p className="text-xs text-slate-500">{confirmDelete.clienteNombre} — {confirmDelete.servicio}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={() => { onDeleteCita(confirmDelete.id); setConfirmDelete(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
