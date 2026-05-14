import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Phone, MessageCircle,
  MapPin, Edit2, Trash2, CheckCircle2, Wrench, FileText, ArrowRight,
  AlertCircle, Search, Clock, Home, Store, Settings2, List, Grid3X3,
  Bell, User, CalendarDays, BellRing,
} from 'lucide-react';
import { Cita, RepairItem, AppSettings, Customer } from '../types';
import { storage } from '../lib/dataService';

interface CalendarViewProps {
  citas: Cita[];
  repairs: RepairItem[];
  customers: Customer[];
  settings: AppSettings;
  onSaveCita: (cita: Cita) => void;
  onDeleteCita: (id: string) => void;
  onNavigateToRepair: (repair: RepairItem) => void;
  onCreateRepairFromCita?: (cita: Cita) => void;
  onNotify?: (type: 'success' | 'error' | 'info', msg: string) => void;
  onBack?: () => void;
}

type ViewMode = 'month' | 'week' | 'day' | 'list';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize old and new cita formats for display */
function norm(c: any): Cita & { _clienteName: string; _titulo: string; _phone: string; _desc: string; _repairId?: string } {
  let horaInicio = c.horaInicio || '';
  let horaFin = c.horaFin || '';
  if (!horaInicio && c.fecha && c.fecha.length > 10) {
    try {
      const d = new Date(c.fecha);
      horaInicio = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      horaFin = pad2(d.getHours() + 1 > 23 ? 23 : d.getHours() + 1) + ':' + pad2(d.getMinutes());
    } catch {}
  }
  let fecha = c.fecha || '';
  if (fecha.length > 10) fecha = fecha.slice(0, 10);

  let estado = c.estado || 'pendiente';
  if (estado === 'Confirmada') estado = 'confirmada';
  else if (estado === 'Cancelada') estado = 'cancelada';
  else if (estado === 'Completada') estado = 'completada';

  return {
    ...c,
    fecha,
    horaInicio: horaInicio || '09:00',
    horaFin: horaFin || '10:00',
    tipo: c.tipo || (c.direccion ? 'domicilio' : 'taller'),
    titulo: c.titulo || c.servicio || 'Sin título',
    estado,
    createdAt: c.createdAt || c.fecha || new Date().toISOString(),
    updatedAt: c.updatedAt || c.fecha || new Date().toISOString(),
    _clienteName: c.clienteName || c.clienteNombre || '',
    _titulo: c.titulo || c.servicio || 'Sin título',
    _phone: c.clientePhone || c.telefono || '',
    _desc: c.descripcion || c.notas || '',
    _repairId: c.repairId || c.rmaId,
  };
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const days: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: last.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (days.length % 7 !== 0) days.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function getWeekStart(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // Mon=0
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const TIPO_COLOR: Record<string, { bg: string; light: string; border: string }> = {
  taller:   { bg: '#1565c0', light: '#e3f2fd', border: '#90caf9' },
  domicilio:{ bg: '#2e7d32', light: '#e8f5e9', border: '#a5d6a7' },
  interno:  { bg: '#607d8b', light: '#eceff1', border: '#b0bec5' },
};

const ESTADO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pendiente:  { bg: '#fff8e1', text: '#f57f17', label: '⏳ Pendiente' },
  confirmada: { bg: '#e8f5e9', text: '#2e7d32', label: '✅ Confirmada' },
  completada: { bg: '#e5e7eb', text: '#9ca3af', label: '✓ Completada' },
  cancelada:  { bg: '#fee2e2', text: '#ef4444', label: '✗ Cancelada'  },
};

const fmtDate = (s: string) => {
  try { return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); }
  catch { return s; }
};

// ── CitaChip — tiny colored chip for month/week cells ─────────────────────
const CitaChip = ({ c, onClick }: { c: ReturnType<typeof norm>; onClick: () => void }) => {
  const col = TIPO_COLOR[c.tipo] || TIPO_COLOR.taller;
  const isComp = c.estado === 'completada';
  const isCan  = c.estado === 'cancelada';
  const chipBg     = isComp ? '#e5e7eb' : isCan ? '#fee2e2' : col.light;
  const chipColor  = isComp ? '#9ca3af' : isCan ? '#ef4444' : col.bg;
  const chipBorder = isComp ? '#9ca3af' : isCan ? '#ef4444' : col.bg;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="w-full text-left text-[10px] font-black truncate px-1.5 py-0.5 rounded-md mb-0.5 leading-tight transition-opacity hover:opacity-80"
      style={{ background: chipBg, color: chipColor, borderLeft: `3px solid ${chipBorder}`, textDecoration: (isComp || isCan) ? 'line-through' : 'none' }}
      title={`${c.horaInicio} ${c._titulo} — ${c._clienteName}`}
    >
      {c.horaInicio} {c._titulo}
    </button>
  );
};

// ── CitaFormModal ─────────────────────────────────────────────────────────────
interface FormState {
  tipo: 'taller' | 'domicilio' | 'interno';
  titulo: string;
  clienteName: string;
  clientePhone: string;
  clienteId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  descripcion: string;
  direccion: string;
  estado: 'pendiente' | 'confirmada';
  repairSearch: string;
  repairId: string;
}

function blankForm(fecha: string): FormState {
  return {
    tipo: 'taller', titulo: '', clienteName: '', clientePhone: '', clienteId: '',
    fecha, horaInicio: '09:00', horaFin: '10:00',
    descripcion: '', direccion: '', estado: 'confirmada',
    repairSearch: '', repairId: '',
  };
}

interface CitaFormModalProps {
  initial?: ReturnType<typeof norm> | null;
  defaultFecha: string;
  customers: Customer[];
  repairs: RepairItem[];
  settings: AppSettings;
  onSave: (c: Cita) => void;
  onClose: () => void;
}

function CitaFormModal({ initial, defaultFecha, customers, repairs, settings, onSave, onClose }: CitaFormModalProps) {
  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return blankForm(defaultFecha);
    return {
      tipo: initial.tipo || 'taller',
      titulo: initial._titulo,
      clienteName: initial._clienteName,
      clientePhone: initial._phone,
      clienteId: initial.clienteId || '',
      fecha: initial.fecha,
      horaInicio: initial.horaInicio,
      horaFin: initial.horaFin,
      descripcion: initial._desc,
      direccion: initial.direccion || '',
      estado: (initial.estado === 'pendiente' || initial.estado === 'confirmada') ? initial.estado : 'confirmada',
      repairSearch: initial._repairId ? `RMA-${repairs.find(r => r.id === initial._repairId)?.rmaNumber?.toString().padStart(5,'0') || ''}` : '',
      repairId: initial._repairId || '',
    };
  });

  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteSugg, setShowClienteSugg] = useState(false);
  const [repairSugg, setRepairSugg] = useState<RepairItem[]>([]);
  const [error, setError] = useState('');

  const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));

  const clienteSugg = useMemo(() => {
    if (!clienteSearch.trim() || clienteSearch.length < 2) return [];
    const q = clienteSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 5);
  }, [clienteSearch, customers]);

  const handleClienteSelect = (c: Customer) => {
    set('clienteName', c.name);
    set('clientePhone', c.phone);
    set('clienteId', c.id);
    if (c.address && form.tipo === 'domicilio') set('direccion', [c.address, c.city].filter(Boolean).join(', '));
    setClienteSearch(c.name);
    setShowClienteSugg(false);
  };

  useEffect(() => {
    if (!form.repairSearch.trim()) { setRepairSugg([]); return; }
    const q = form.repairSearch.toLowerCase();
    setRepairSugg(repairs.filter(r =>
      r.rmaNumber.toString().includes(q) ||
      r.customerName.toLowerCase().includes(q)
    ).slice(0, 4));
  }, [form.repairSearch, repairs]);

  const handleSave = () => {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return; }
    if (!form.fecha) { setError('La fecha es obligatoria'); return; }
    const now = new Date().toISOString();
    const cita: Cita = {
      id: initial?.id || `CITA-${Date.now()}`,
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      clienteName: form.clienteName || undefined,
      clientePhone: form.clientePhone || undefined,
      clienteId: form.clienteId || undefined,
      repairId: form.repairId || undefined,
      fecha: form.fecha,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      descripcion: form.descripcion || undefined,
      direccion: form.direccion || undefined,
      estado: form.estado,
      recordatorioEnviado: initial?.recordatorioEnviado,
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    };
    onSave(cita);
  };

  const inp = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white';
  const lbl = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1';

  const tipoOpts: { value: 'taller' | 'domicilio' | 'interno'; label: string; icon: React.ReactNode; col: string }[] = [
    { value: 'taller',    label: 'Taller',    icon: <Store size={14} />,    col: '#1565c0' },
    { value: 'domicilio', label: 'Domicilio', icon: <Home size={14} />,     col: '#2e7d32' },
    { value: 'interno',   label: 'Interno',   icon: <Settings2 size={14} />, col: '#607d8b' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            {initial ? 'Editar cita' : 'Nueva cita'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="px-7 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertCircle size={14} className="text-red-500" />
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Tipo */}
          <div>
            <label className={lbl}>Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {tipoOpts.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('tipo', o.value)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 transition-all ${form.tipo === o.value ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 hover:border-slate-300'}`}
                  style={form.tipo === o.value ? { background: o.col, borderColor: o.col } : {}}
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className={lbl}>Título *</label>
            <input
              className={inp}
              value={form.titulo}
              onChange={e => { set('titulo', e.target.value); setError(''); }}
              placeholder="Revisión caldera, Presupuesto TV…"
            />
          </div>

          {/* Cliente */}
          <div className="relative">
            <label className={lbl}>Cliente</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={inp + ' pl-8'}
                value={clienteSearch || form.clienteName}
                onChange={e => { setClienteSearch(e.target.value); set('clienteName', e.target.value); setShowClienteSugg(true); }}
                onFocus={() => setShowClienteSugg(true)}
                placeholder="Buscar cliente…"
              />
            </div>
            {showClienteSugg && clienteSugg.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {clienteSugg.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleClienteSelect(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-bold text-slate-900">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.phone}{c.city ? ` · ${c.city}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} value={form.clientePhone} onChange={e => set('clientePhone', e.target.value)} placeholder="600 000 000" />
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select className={inp} value={form.estado} onChange={e => set('estado', e.target.value as any)}>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
              </select>
            </div>
          </div>

          {/* Fecha y horas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={lbl}>Fecha</label>
              <input type="date" className={inp} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Inicio</label>
              <input type="time" className={inp} value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fin</label>
              <input type="time" className={inp} value={form.horaFin} onChange={e => set('horaFin', e.target.value)} />
            </div>
          </div>

          {/* Dirección (solo domicilio) */}
          {form.tipo === 'domicilio' && (
            <div>
              <label className={lbl}>Dirección</label>
              <input className={inp} value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, ciudad…" />
            </div>
          )}

          {/* Reparación vinculada */}
          <div className="relative">
            <label className={lbl}>Reparación vinculada (opcional)</label>
            <input
              className={inp}
              value={form.repairSearch}
              onChange={e => { set('repairSearch', e.target.value); if (!e.target.value) set('repairId', ''); }}
              placeholder="Buscar por RMA o cliente…"
            />
            {repairSugg.length > 0 && form.repairSearch && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {repairSugg.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { set('repairId', r.id); set('repairSearch', `RMA-${r.rmaNumber.toString().padStart(5,'0')} — ${r.customerName}`); setRepairSugg([]); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-bold text-slate-900">RMA-{r.rmaNumber.toString().padStart(5,'0')}</p>
                    <p className="text-[10px] text-slate-400">{r.customerName} · {r.status}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className={lbl}>Notas / Descripción</label>
            <textarea
              className={inp + ' resize-none'}
              rows={3}
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Observaciones, detalles de la visita…"
            />
          </div>
        </div>

        <div className="flex gap-3 px-7 pb-7">
          <button onClick={onClose} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all"
            style={{ background: '#2e7d32' }}
          >
            {initial ? 'Guardar cambios' : 'Crear cita'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CitaDetailModal ────────────────────────────────────────────────────────────
interface CitaDetailModalProps {
  cita: ReturnType<typeof norm>;
  repair?: RepairItem;
  settings: AppSettings;
  onEdit: () => void;
  onDelete: () => void;
  onMarkComplete: () => void;
  onMarkCancelled: () => void;
  onSendReminder?: () => void;
  onNavigateToRepair?: (r: RepairItem) => void;
  onCreateRepair?: () => void;
  onClose: () => void;
}

function CitaDetailModal({ cita, repair, settings, onEdit, onDelete, onMarkComplete, onMarkCancelled, onSendReminder, onNavigateToRepair, onCreateRepair, onClose }: CitaDetailModalProps) {
  const col = TIPO_COLOR[cita.tipo] || TIPO_COLOR.taller;
  const est = ESTADO_STYLE[cita.estado] || ESTADO_STYLE.pendiente;

  const sendWhatsApp = (msg: string, phone: string) => {
    const p = phone.replace(/\D/g, '');
    if (!p) return;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const reminderMsg = `Hola ${cita._clienteName}, le recordamos su cita ${cita.tipo === 'domicilio' ? 'a domicilio' : `en ${settings.appName}`} el ${fmtDate(cita.fecha)} a las ${cita.horaInicio}. Por favor confírmenos su asistencia. Gracias. ${settings.appName} 📞${settings.phone}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header colored strip */}
        <div className="px-7 pt-7 pb-5" style={{ background: col.light, borderBottom: `3px solid ${col.border}` }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white" style={{ background: col.bg }}>
                  {cita.tipo}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: est.bg, color: est.text }}>
                  {est.label}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{cita._titulo}</h2>
              {cita._clienteName && <p className="text-sm text-slate-600 font-bold mt-1">{cita._clienteName}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/60 transition-colors shrink-0">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="px-7 py-5 space-y-4">
          {/* Date/time */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3">
            <Clock size={16} className="text-slate-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-slate-900 capitalize">{fmtDate(cita.fecha)}</p>
              <p className="text-[10px] font-bold text-slate-500">{cita.horaInicio} – {cita.horaFin}</p>
            </div>
          </div>

          {/* Phone */}
          {cita._phone && (
            <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3">
              <Phone size={16} className="text-slate-400 shrink-0" />
              <a href={`tel:${cita._phone}`} className="text-sm font-bold text-blue-600 hover:underline">{cita._phone}</a>
            </div>
          )}

          {/* Address */}
          {cita.direccion && (
            <div className="flex items-start gap-3 bg-slate-50 rounded-2xl px-4 py-3">
              <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900">{cita.direccion}</p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cita.direccion)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[10px] font-black uppercase text-blue-600 hover:underline tracking-widest"
                >
                  Abrir en Google Maps →
                </a>
              </div>
            </div>
          )}

          {/* Descripción */}
          {cita._desc && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Notas</p>
              <p className="text-xs text-amber-900 leading-relaxed">{cita._desc}</p>
            </div>
          )}

          {/* Linked repair */}
          {repair && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">Reparación vinculada</p>
                <p className="text-sm font-black text-slate-900">RMA-{repair.rmaNumber.toString().padStart(5,'0')}</p>
                <p className="text-[10px] text-slate-500">{repair.status}</p>
              </div>
              {onNavigateToRepair && (
                <button onClick={() => { onNavigateToRepair(repair); onClose(); }} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-700 transition-colors">
                  Ver <ArrowRight size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-7 pb-7 space-y-2">
          {/* WhatsApp */}
          {cita._phone && onSendReminder && (
            <button
              onClick={onSendReminder}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
              style={{ background: '#25d366' }}
            >
              <MessageCircle size={15} /> Enviar recordatorio WhatsApp
            </button>
          )}

          {/* Create repair */}
          {!repair && onCreateRepair && cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
            <button
              onClick={() => { onCreateRepair(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
            >
              <Wrench size={15} /> Crear orden de trabajo
            </button>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button onClick={onEdit} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
              <Edit2 size={13} /> Editar
            </button>
            {cita.estado !== 'completada' && (
              <button onClick={onMarkComplete} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all">
                <CheckCircle2 size={13} /> Hecha
              </button>
            )}
            {cita.estado !== 'cancelada' && (
              <button onClick={onMarkCancelled} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-100 transition-all">
                <X size={13} /> Cancelar
              </button>
            )}
          </div>

          <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase bg-red-50 text-red-500 hover:bg-red-100 transition-all">
            <Trash2 size={13} /> Eliminar cita
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main CalendarView ─────────────────────────────────────────────────────────
const CalendarView: React.FC<CalendarViewProps> = ({
  citas, repairs, customers, settings, onSaveCita, onDeleteCita,
  onNavigateToRepair, onCreateRepairFromCita, onNotify, onBack,
}) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = toDateStr(today);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date(today));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showForm, setShowForm] = useState(false);
  const [editingCita, setEditingCita] = useState<ReturnType<typeof norm> | null>(null);
  const [detailCita, setDetailCita] = useState<ReturnType<typeof norm> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReturnType<typeof norm> | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [listTipo, setListTipo] = useState('');
  const [listEstado, setListEstado] = useState('');
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [waConfirmModal, setWaConfirmModal] = useState<{ cita: Cita; msg: string } | null>(null);
  const [reminderConfirm, setReminderConfirm] = useState<ReturnType<typeof norm> | null>(null);

  const normalized = useMemo(() => citas.map(norm), [citas]);

  // Citas mañana sin recordatorio
  const tomorrowStr = toDateStr(addDays(today, 1));
  const pendingReminders = useMemo(() =>
    normalized.filter(c => c.fecha === tomorrowStr && c.estado !== 'cancelada' && !c.recordatorioEnviado && c._phone),
    [normalized, tomorrowStr]
  );

  // Stats
  const todayCitas  = useMemo(() => normalized.filter(c => c.fecha === todayStr && c.estado !== 'cancelada').length, [normalized, todayStr]);
  const weekStart   = getWeekStart(today);
  const weekEnd     = addDays(weekStart, 6);
  const weekEndStr  = toDateStr(weekEnd);
  const weekStartStr = toDateStr(weekStart);
  const weekCitas   = useMemo(() => normalized.filter(c => c.fecha >= weekStartStr && c.fecha <= weekEndStr && c.estado !== 'cancelada').length, [normalized, weekStartStr, weekEndStr]);

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const navigate = (dir: 1 | -1) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
      else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const navLabel = useMemo(() => {
    if (viewMode === 'month') return `${MONTHS_ES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === 'week') {
      const ws = getWeekStart(currentDate);
      const we = addDays(ws, 6);
      return `${ws.getDate()} – ${we.getDate()} ${MONTHS_ES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return fmtDate(toDateStr(currentDate));
  }, [viewMode, currentDate]);

  // ── Cita actions ──────────────────────────────────────────────────────────────
  const handleSave = (c: Cita) => {
    onSaveCita(c);
    setShowForm(false);
    setEditingCita(null);
    onNotify?.('success', `Cita "${c.titulo}" guardada.`);

    if ((c.tipo === 'taller' || c.tipo === 'domicilio') && c.clientePhone) {
      const msg = `Hola ${c.clienteName || ''}, su cita ${c.tipo === 'domicilio' ? 'a domicilio' : `en ${settings.appName}`} está confirmada para el ${fmtDate(c.fecha)} a las ${c.horaInicio}. ${settings.appName} 📞${settings.phone}`;
      setWaConfirmModal({ cita: c, msg });
    }
  };

  const updateEstado = (c: ReturnType<typeof norm>, estado: Cita['estado']) => {
    const now = new Date().toISOString();
    onSaveCita({ ...c, estado, updatedAt: now } as Cita);
    setDetailCita(null);
    onNotify?.('success', `Cita marcada como ${ESTADO_STYLE[estado]?.label || estado}.`);
  };

  const handleDelete = (c: ReturnType<typeof norm>) => {
    onDeleteCita(c.id);
    setDetailCita(null);
    setConfirmDelete(null);
    onNotify?.('info', 'Cita eliminada.');
  };

  const handleCreateRepairFromCita = (c: ReturnType<typeof norm>) => {
    if (!onCreateRepairFromCita) return;
    const now = new Date().toISOString();
    const cita: Cita = {
      ...c,
      createdAt: c.createdAt || now,
      updatedAt: now,
    };
    onCreateRepairFromCita(cita);
  };

  const handleSendReminder = (c: ReturnType<typeof norm>) => {
    if (!c._phone) return;
    setReminderConfirm(c);
  };

  const doSendReminder = (c: ReturnType<typeof norm>) => {
    const msg = `Hola ${c._clienteName}, le recordamos su cita ${c.tipo === 'domicilio' ? 'a domicilio' : `en ${settings.appName}`} mañana ${fmtDate(tomorrowStr)} a las ${c.horaInicio}. Por favor confírmenos su asistencia. Gracias. ${settings.appName} 📞${settings.phone}`;
    window.open(`https://wa.me/${c._phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    const now = new Date().toISOString();
    onSaveCita({ ...c, recordatorioEnviado: true, updatedAt: now } as Cita);
    onNotify?.('success', `Recordatorio enviado a ${c._clienteName}.`);
    setReminderConfirm(null);
  };

  const openNew = (fecha?: string) => {
    setEditingCita(null);
    setSelectedDate(fecha || toDateStr(currentDate));
    setShowForm(true);
  };

  const openDetail = (c: ReturnType<typeof norm>) => {
    setDetailCita(c);
  };

  const openEdit = (c: ReturnType<typeof norm>) => {
    setEditingCita(c);
    setDetailCita(null);
    setShowForm(true);
  };

  // ── MONTH VIEW ────────────────────────────────────────────────────────────────
  const monthGrid = useMemo(() => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

  const MonthView = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_ES.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{d}</div>
        ))}
      </div>
      {/* Weeks */}
      {monthGrid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-50 last:border-0" style={{ minHeight: 90 }}>
          {week.map((day, di) => {
            if (!day) return <div key={di} className="p-1.5 bg-slate-50/50 border-r border-slate-50 last:border-0" />;
            const ds = toDateStr(day);
            const isToday = ds === todayStr;
            const isOtherMonth = day.getMonth() !== currentDate.getMonth();
            const dayCitas = normalized.filter(c => c.fecha === ds);
            return (
              <div
                key={di}
                onClick={() => { setCurrentDate(day); setSelectedDate(ds); setViewMode('day'); }}
                className="p-1.5 border-r border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/80 transition-colors"
                style={isToday ? { background: '#e8f5e9' } : {}}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full leading-none ${isToday ? 'bg-green-600 text-white' : isOtherMonth ? 'text-slate-300' : 'text-slate-700'}`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                {dayCitas.slice(0, 3).map(c => (
                  <CitaChip key={c.id} c={c} onClick={() => openDetail(c)} />
                ))}
                {dayCitas.length > 3 && (
                  <p className="text-[9px] font-black text-slate-400 pl-1">+{dayCitas.length - 3} más</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────────
  const WeekView = () => {
    const ws = getWeekStart(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {weekDays.map((day, i) => {
            const ds = toDateStr(day);
            const isToday = ds === todayStr;
            return (
              <div
                key={i}
                className="p-3 text-center border-r border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                style={isToday ? { background: '#e8f5e9' } : {}}
                onClick={() => { setCurrentDate(day); setSelectedDate(ds); setViewMode('day'); }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{DAYS_ES[i]}</p>
                <p className={`text-lg font-black mt-0.5 ${isToday ? 'text-green-600' : 'text-slate-700'}`}>{day.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDays.map((day, i) => {
            const ds = toDateStr(day);
            const dayCitas = normalized.filter(c => c.fecha === ds).sort((a,b) => a.horaInicio.localeCompare(b.horaInicio));
            return (
              <div key={i} className="p-2 border-r border-slate-50 last:border-0 space-y-1"
                onClick={() => openNew(ds)}>
                {dayCitas.map(c => {
                  const col = TIPO_COLOR[c.tipo] || TIPO_COLOR.taller;
                  const isComp = c.estado === 'completada';
                  const isCan  = c.estado === 'cancelada';
                  const wBg     = isComp ? '#e5e7eb' : isCan ? '#fee2e2' : col.light;
                  const wBorder = isComp ? '#9ca3af' : isCan ? '#ef4444' : col.bg;
                  const wText   = isComp ? '#9ca3af' : isCan ? '#ef4444' : col.bg;
                  return (
                    <button
                      key={c.id}
                      onClick={e => { e.stopPropagation(); openDetail(c); }}
                      className="w-full text-left rounded-xl px-2 py-1.5 transition-opacity hover:opacity-80"
                      style={{ background: wBg, borderLeft: `3px solid ${wBorder}` }}
                    >
                      <p className="text-[10px] font-black truncate" style={{ color: wText, textDecoration: (isComp || isCan) ? 'line-through' : 'none' }}>{c.horaInicio}</p>
                      <p className="text-[11px] font-black truncate" style={{ color: wText, textDecoration: (isComp || isCan) ? 'line-through' : 'none' }}>{c._titulo}</p>
                      {c._clienteName && <p className="text-[9px] truncate" style={{ color: isComp || isCan ? wText : '#9ca3af' }}>{c._clienteName}</p>}
                    </button>
                  );
                })}
                {dayCitas.length === 0 && (
                  <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Plus size={14} className="text-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── DAY VIEW ──────────────────────────────────────────────────────────────────
  const DayView = () => {
    const ds = toDateStr(currentDate);
    const dayCitas = normalized
      .filter(c => c.fecha === ds)
      .sort((a,b) => a.horaInicio.localeCompare(b.horaInicio));
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8-20

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-black text-slate-900 capitalize">{fmtDate(ds)}</p>
          <button onClick={() => openNew(ds)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-white" style={{ background: '#2e7d32' }}>
            <Plus size={12} /> Nueva
          </button>
        </div>
        {dayCitas.length === 0 ? (
          <div className="py-20 text-center">
            <CalendarDays size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin citas para este día</p>
            <button onClick={() => openNew(ds)} className="mt-4 text-[10px] font-black uppercase text-green-600 hover:underline tracking-widest">+ Añadir cita</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {dayCitas.map(c => {
              const col = TIPO_COLOR[c.tipo] || TIPO_COLOR.taller;
              const est = ESTADO_STYLE[c.estado] || ESTADO_STYLE.pendiente;
              const isComp = c.estado === 'completada';
              const isCan  = c.estado === 'cancelada';
              const lineColor = isComp ? '#9ca3af' : isCan ? '#ef4444' : col.bg;
              return (
                <button key={c.id} onClick={() => openDetail(c)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  style={isComp ? { background: '#f9fafb' } : isCan ? { background: '#fff5f5' } : {}}>
                  <div className="text-center shrink-0 w-14">
                    <p className="text-sm font-black" style={{ color: lineColor }}>{c.horaInicio}</p>
                    <p className="text-[10px] text-slate-400">{c.horaFin}</p>
                  </div>
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: lineColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-black truncate" style={{ color: isComp || isCan ? lineColor : '#0f172a', textDecoration: (isComp || isCan) ? 'line-through' : 'none' }}>{c._titulo}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: est.bg, color: est.text }}>{est.label}</span>
                    </div>
                    {c._clienteName && <p className="text-xs" style={{ color: isComp || isCan ? lineColor : '#64748b' }}>{c._clienteName}{c._phone ? ` · ${c._phone}` : ''}</p>}
                    {c.direccion && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10} />{c.direccion}</p>}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  const ListView = () => {
    const filtered = useMemo(() => {
      let list = normalized.filter(c => c.fecha >= todayStr);
      if (listSearch.trim()) {
        const q = listSearch.toLowerCase();
        list = list.filter(c => c._clienteName.toLowerCase().includes(q) || c._titulo.toLowerCase().includes(q) || c._phone.includes(q));
      }
      if (listTipo) list = list.filter(c => c.tipo === listTipo);
      if (listEstado) list = list.filter(c => c.estado === listEstado);
      return [...list].sort((a,b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));
    }, [normalized, listSearch, listTipo, listEstado, todayStr]);

    const byDay = useMemo(() => {
      const map: Record<string, typeof filtered> = {};
      filtered.forEach(c => { (map[c.fecha] ||= []).push(c); });
      return map;
    }, [filtered]);

    return (
      <div className="space-y-3">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="Buscar cliente, título…"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
          </div>
          <select value={listTipo} onChange={e => setListTipo(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none">
            <option value="">Todos los tipos</option>
            <option value="taller">Taller</option>
            <option value="domicilio">Domicilio</option>
            <option value="interno">Interno</option>
          </select>
          <select value={listEstado} onChange={e => setListEstado(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        {Object.keys(byDay).length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
            <List size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin citas próximas</p>
          </div>
        )}

        {Object.entries(byDay).map(([fecha, dCitas]) => {
          const isToday = fecha === todayStr;
          const isTomorrow = fecha === tomorrowStr;
          return (
            <div key={fecha} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100" style={isToday ? { background: '#e8f5e9' } : {}}>
                <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-green-500' : 'bg-slate-300'}`} />
                <p className={`text-sm font-black uppercase tracking-tight ${isToday ? 'text-green-700' : 'text-slate-700'}`}>
                  {isToday ? 'HOY — ' : isTomorrow ? 'MAÑANA — ' : ''}{fmtDate(fecha)}
                </p>
                <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{dCitas.length} cita{dCitas.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {dCitas.map(c => {
                  const col = TIPO_COLOR[c.tipo] || TIPO_COLOR.taller;
                  const est = ESTADO_STYLE[c.estado] || ESTADO_STYLE.pendiente;
                  const isComp = c.estado === 'completada';
                  const isCan  = c.estado === 'cancelada';
                  const lColor = isComp ? '#9ca3af' : isCan ? '#ef4444' : col.bg;
                  return (
                    <button key={c.id} onClick={() => openDetail(c)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                      style={isComp ? { background: '#f9fafb' } : isCan ? { background: '#fff5f5' } : {}}>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full shrink-0 text-white" style={{ background: lColor }}>{c.tipo}</span>
                      <Clock size={12} className="text-slate-300 shrink-0" />
                      <span className="text-xs font-black shrink-0 w-10" style={{ color: lColor }}>{c.horaInicio}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: isComp || isCan ? lColor : '#0f172a', textDecoration: (isComp || isCan) ? 'line-through' : 'none' }}>{c._titulo}</p>
                        {c._clienteName && <p className="text-[10px] truncate" style={{ color: isComp || isCan ? lColor : '#94a3b8' }}>{c._clienteName}{c._phone ? ` · ${c._phone}` : ''}</p>}
                      </div>
                      <span className="text-[9px] font-black px-2 py-1 rounded-full shrink-0" style={{ background: est.bg, color: est.text }}>{est.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const ChevronRight = ({ size, className }: { size: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-10">
      {/* Reminder banner */}
      {!reminderDismissed && pendingReminders.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
          <BellRing size={16} className="text-amber-600 shrink-0 animate-bounce" />
          <div className="flex-1">
            <p className="text-sm font-black text-amber-800">
              {pendingReminders.length} cita{pendingReminders.length !== 1 ? 's' : ''} mañana sin recordatorio enviado
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {pendingReminders.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSendReminder(c)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border border-amber-200"
                >
                  <MessageCircle size={10} /> {c._clienteName || c._titulo} {c.horaInicio}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setReminderDismissed(true)} className="p-1 rounded-lg hover:bg-amber-100 transition-colors">
            <X size={14} className="text-amber-500" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Calendar size={22} className="text-green-600" /> Planificador
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            <span className="font-black text-green-700">{todayCitas}</span> citas hoy ·{' '}
            <span className="font-black text-slate-600">{weekCitas}</span> esta semana
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {([['month','Mes',<Grid3X3 size={13}/>],['week','Sem',<CalendarDays size={13}/>],['day','Día',<Clock size={13}/>],['list','Lista',<List size={13}/>]] as const).map(([m, label, icon]) => (
              <button
                key={m}
                onClick={() => setViewMode(m as ViewMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => openNew()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase text-white shadow-lg hover:opacity-90 transition-all"
            style={{ background: '#2e7d32' }}
          >
            <Plus size={16} /> Nueva Cita
          </button>
        </div>
      </div>

      {/* Nav (month/week/day) */}
      {viewMode !== 'list' && (
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ChevronLeft size={16} className="text-slate-600" />
          </button>
          <button
            onClick={() => { setCurrentDate(new Date(today)); setSelectedDate(todayStr); }}
            className="flex-1 text-center text-sm font-black text-slate-900 uppercase tracking-tight"
          >
            {navLabel}
          </button>
          <button onClick={() => navigate(1)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </div>
      )}

      {/* View content */}
      {viewMode === 'month' && <MonthView />}
      {viewMode === 'week'  && <WeekView />}
      {viewMode === 'day'   && <DayView />}
      {viewMode === 'list'  && <ListView />}

      {/* Form modal */}
      {showForm && (
        <CitaFormModal
          initial={editingCita}
          defaultFecha={selectedDate}
          customers={customers}
          repairs={repairs}
          settings={settings}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingCita(null); }}
        />
      )}

      {/* Detail modal */}
      {detailCita && (
        <CitaDetailModal
          cita={detailCita}
          repair={repairs.find(r => r.id === detailCita._repairId)}
          settings={settings}
          onEdit={() => { openEdit(detailCita); }}
          onDelete={() => setConfirmDelete(detailCita)}
          onMarkComplete={() => updateEstado(detailCita, 'completada')}
          onMarkCancelled={() => updateEstado(detailCita, 'cancelada')}
          onSendReminder={detailCita._phone ? () => { setDetailCita(null); setReminderConfirm(detailCita); } : undefined}
          onNavigateToRepair={onNavigateToRepair}
          onCreateRepair={onCreateRepairFromCita ? () => handleCreateRepairFromCita(detailCita) : undefined}
          onClose={() => setDetailCita(null)}
        />
      )}

      {/* WA confirm after save */}
      {waConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-green-50 rounded-2xl">
                <MessageCircle size={28} className="text-green-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase">¿Confirmar la cita?</h2>
              <p className="text-xs text-slate-600">
                ¿Deseas enviar un mensaje de confirmación a <strong>{(waConfirmModal.cita as any).clienteName || ''}</strong> por WhatsApp?
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const phone = ((waConfirmModal.cita as any).clientePhone || '').replace(/\D/g, '');
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waConfirmModal.msg)}`, '_blank');
                  setWaConfirmModal(null);
                }}
                className="w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all flex items-center justify-center gap-2"
                style={{ background: '#25d366' }}
              >
                <MessageCircle size={14} /> Confirmar y enviar WhatsApp
              </button>
              <button
                onClick={() => setWaConfirmModal(null)}
                className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Confirmar sin WhatsApp
              </button>
              <button
                onClick={() => setWaConfirmModal(null)}
                className="w-full py-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder confirm modal */}
      {reminderConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-amber-50 rounded-2xl">
                <Bell size={28} className="text-amber-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase">¿Enviar recordatorio?</h2>
              <p className="text-xs text-slate-600">
                ¿Enviar recordatorio a <strong>{reminderConfirm._clienteName}</strong> por WhatsApp?
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => doSendReminder(reminderConfirm)}
                className="w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all flex items-center justify-center gap-2"
                style={{ background: '#25d366' }}
              >
                <MessageCircle size={14} /> Sí, enviar
              </button>
              <button
                onClick={() => setReminderConfirm(null)}
                className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Omitir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase">Eliminar cita</h2>
              <p className="text-xs text-slate-600">¿Eliminar <strong>{confirmDelete._titulo}</strong>?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
