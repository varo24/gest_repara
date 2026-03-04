import React, { useState, useMemo, useCallback } from 'react';
import { Cita, CitaEstado, EstadoVisita, RepairItem, AppSettings } from '../types';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Plus, Edit2, Trash2, X, Phone, Building2, Navigation, MessageCircle, CheckCircle2 } from 'lucide-react';

interface CalendarViewProps {
  citas: Cita[];
  repairs: RepairItem[];
  settings: AppSettings;
  onSaveCita: (cita: Cita) => void;
  onDeleteCita: (id: string) => void;
  onNavigateToRepair: (repair: RepairItem) => void;
}

const formatDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--:--'; }
};
const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const CalendarView: React.FC<CalendarViewProps> = ({ citas, repairs, settings, onSaveCita, onDeleteCita, onNavigateToRepair }) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [editingCita, setEditingCita] = useState<Cita | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cita | null>(null);

  const [formData, setFormData] = useState({
    clienteNombre: '', telefono: '', direccion: '', ciudad: '', servicio: '', hora: '10:00'
  });

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 3)), []);

  const citasDia = useMemo(() => {
    return citas
      .filter(c => {
        try { return isSameDay(new Date(c.fecha), selectedDate); }
        catch { return false; }
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [citas, selectedDate]);

  const agendaHoy = useMemo(() => {
    return citas
      .filter(c => {
        try { return isSameDay(new Date(c.fecha), today) && c.estado === CitaEstado.Confirmada; }
        catch { return false; }
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [citas]);

  const proximaCita = useMemo(() => agendaHoy.find(c => c.estadoVisita !== EstadoVisita.Finalizada), [agendaHoy]);

  const handleOpenCreate = () => {
    setEditingCita(null);
    setFormData({ clienteNombre: '', telefono: '', direccion: '', ciudad: '', servicio: '', hora: '10:00' });
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
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.clienteNombre || !formData.servicio) return;
    const [h, m] = formData.hora.split(':').map(Number);
    const fechaCita = new Date(selectedDate);
    fechaCita.setHours(h, m, 0, 0);

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
    };
    onSaveCita(cita);
    setShowModal(false);
  };

  const handleOpenMaps = (cita: Cita) => {
    const dir = [cita.direccion, cita.ciudad, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  const handleWhatsApp = (cita: Cita) => {
    const phone = (cita.telefono || '').replace(/\D/g, '');
    if (!phone) return;
    const msg = encodeURIComponent(`Hola ${cita.clienteNombre}, soy el técnico de ${settings.appName}. Te informo que voy de camino. Estaré allí en breve.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleGoogleCalendar = (cita: Cita) => {
    const start = new Date(cita.fecha);
    const end = new Date(start.getTime() + 3600000);
    const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${settings.appName}: ${cita.servicio}`)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(`Cliente: ${cita.clienteNombre}\nDirección: ${cita.direccion || 'N/A'}`)}&location=${encodeURIComponent(cita.direccion || '')}&sf=true&output=xml`;
    window.open(url, 'GoogleCalendar', 'width=800,height=700,scrollbars=yes,resizable=yes');
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
          const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(new Date(day))}
              className={`flex flex-col items-center min-w-[64px] p-3 rounded-2xl transition-all shrink-0 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : isToday ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-200'}`}
            >
              <span className="text-[10px] font-black uppercase mb-1">{dayNames[day.getDay()]}</span>
              <span className="text-xl font-black">{day.getDate()}</span>
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
              return (
                <div key={cita.id} className={`bg-white p-5 rounded-[1.8rem] border flex items-center justify-between transition-all group ${isDone ? 'border-transparent opacity-60' : 'border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${isDone ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600 shadow-inner'}`}>
                      {formatTime(cita.fecha)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{cita.clienteNombre}</h4>
                      <p className="text-[9px] font-black uppercase truncate tracking-widest text-slate-400">{cita.servicio}</p>
                      {cita.direccion && (
                        <p className="text-[9px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                          <MapPin size={10} /> {cita.direccion}{cita.ciudad ? `, ${cita.ciudad}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => handleOpenMaps(cita)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="GPS">
                      <Navigation size={16} />
                    </button>
                    <button onClick={() => handleGoogleCalendar(cita)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Google Calendar">
                      <Calendar size={16} />
                    </button>
                    <button onClick={() => handleOpenEdit(cita)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete(cita)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                    {isDone && <CheckCircle2 size={18} className="text-emerald-500 ml-1" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar Cita */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingCita ? 'Editar Visita' : 'Agendar Visita'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-full hover:bg-white transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Nombre del Cliente</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none" placeholder="Nombre completo" value={formData.clienteNombre} onChange={e => setFormData({...formData, clienteNombre: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Teléfono</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="600 000 000" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Dirección</label>
                  <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Calle y número" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Ciudad</label>
                  <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Madrid" value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Hora de Cita</label>
                  <input type="time" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Fecha</label>
                  <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-bold text-slate-600 text-center">
                    {selectedDate.toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Motivo de la Visita</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Revisión Caldera, Presupuesto Lavadora..." value={formData.servicio} onChange={e => setFormData({...formData, servicio: e.target.value})} />
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
