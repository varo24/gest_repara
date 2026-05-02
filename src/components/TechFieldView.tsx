import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft, MapPin, Navigation, Phone, MessageCircle, Camera,
  Send, CheckCircle2, User, ChevronDown,
  Trash2, X, Flag, PenTool, Wrench,
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings, FieldNote } from '../types';
import SignaturePad from './SignaturePad';
import CameraCapture from './CameraCapture';

interface TechFieldViewProps {
  repairs: RepairItem[];
  settings: AppSettings;
  onUpdateRepair: (repair: RepairItem) => void;
  onBack: () => void;
}

const GREEN = '#2e7d32';

// Statuses available when working from the field
const FIELD_STATUSES: RepairStatus[] = [
  RepairStatus.DIAGNOSING,
  RepairStatus.IN_PROGRESS,
  RepairStatus.WAITING_PARTS,
  RepairStatus.READY,
  RepairStatus.CANCELLED,
];

const FIELD_STATUS_LABELS: Partial<Record<RepairStatus, string>> = {
  [RepairStatus.DIAGNOSING]:    'Diagnóstico',
  [RepairStatus.IN_PROGRESS]:   'En Reparación',
  [RepairStatus.WAITING_PARTS]: 'Esp. Repuestos',
  [RepairStatus.READY]:         '✓ Listo',
  [RepairStatus.CANCELLED]:     '✗ Cancelado',
};

interface StatusTheme { bg: string; text: string; label: string }
const STATUS_THEME: Record<string, StatusTheme> = {
  [RepairStatus.PENDING]:         { bg: '#78350f', text: '#fbbf24', label: 'Pendiente' },
  [RepairStatus.DIAGNOSING]:      { bg: '#164e63', text: '#67e8f9', label: 'Diagnóstico' },
  [RepairStatus.BUDGET_PENDING]:  { bg: '#3b0764', text: '#e879f9', label: 'Presupuesto' },
  [RepairStatus.BUDGET_ACCEPTED]: { bg: '#1e3a5f', text: '#60a5fa', label: 'Aceptado' },
  [RepairStatus.BUDGET_REJECTED]: { bg: '#450a0a', text: '#f87171', label: 'Rechazado' },
  [RepairStatus.WAITING_PARTS]:   { bg: '#431407', text: '#fb923c', label: 'Esp. Repuestos' },
  [RepairStatus.IN_PROGRESS]:     { bg: '#1e3a5f', text: '#60a5fa', label: 'En Reparación' },
  [RepairStatus.READY]:           { bg: '#052e16', text: '#4ade80', label: 'Listo' },
  [RepairStatus.DELIVERED]:       { bg: '#1e293b', text: '#94a3b8', label: 'Entregado' },
  [RepairStatus.CANCELLED]:       { bg: '#450a0a', text: '#f87171', label: 'Cancelado' },
};
const getTheme = (s: RepairStatus): StatusTheme =>
  STATUS_THEME[s] || { bg: '#1a1a1a', text: '#888', label: s };

const TechFieldView: React.FC<TechFieldViewProps> = ({ repairs, settings, onUpdateRepair, onBack }) => {
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(null);
  const [filterType, setFilterType] = useState<'domicilio' | 'taller' | 'all'>('domicilio');
  const [noteText, setNoteText] = useState('');
  const [notePhotos, setNotePhotos] = useState<string[]>([]);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRepairs = useMemo(() => {
    return repairs
      .filter(r => r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED)
      .filter(r => filterType === 'all' || r.repairType === filterType)
      .sort((a, b) => {
        if (a.repairType === 'domicilio' && b.repairType !== 'domicilio') return -1;
        if (a.repairType !== 'domicilio' && b.repairType === 'domicilio') return 1;
        return new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
      });
  }, [repairs, filterType]);

  const openMaps = (r: RepairItem) => {
    const dir = [r.address, r.city, 'España'].filter(Boolean).join(', ');
    window.open(`https://maps.google.com/?q=${encodeURIComponent(dir)}`, '_blank');
  };

  const handleCall = (r: RepairItem) => window.open(`tel:${r.customerPhone}`, '_self');

  const handleWhatsApp = (r: RepairItem) => {
    const phone = r.customerPhone.replace(/\D/g, '');
    const text = `Hola ${r.customerName}, soy técnico de ${settings.appName}. Me pongo en contacto respecto a tu ${r.brand} ${r.model}.`;
    window.open(`whatsapp://send?phone=34${phone}&text=${encodeURIComponent(text)}`);
  };

  const handleStatusChange = (status: RepairStatus) => {
    if (!selectedRepair) return;
    const updated = { ...selectedRepair, status, updatedAt: new Date().toISOString() };
    onUpdateRepair(updated);
    setSelectedRepair(updated);
    setShowStatusPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setNotePhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddNote = () => {
    if (!selectedRepair || (!noteText.trim() && notePhotos.length === 0)) return;
    const newNote: FieldNote = {
      id: `note-${Date.now()}`,
      text: noteText.trim(),
      timestamp: new Date().toISOString(),
      photos: notePhotos.length > 0 ? [...notePhotos] : undefined,
    };
    const updated = {
      ...selectedRepair,
      fieldNotes: [...(selectedRepair.fieldNotes || []), newNote],
      updatedAt: new Date().toISOString(),
    };
    onUpdateRepair(updated);
    setSelectedRepair(updated);
    setNoteText('');
    setNotePhotos([]);
  };

  const handleDeleteNote = (noteId: string) => {
    if (!selectedRepair) return;
    const updated = {
      ...selectedRepair,
      fieldNotes: (selectedRepair.fieldNotes || []).filter(n => n.id !== noteId),
      updatedAt: new Date().toISOString(),
    };
    onUpdateRepair(updated);
    setSelectedRepair(updated);
  };

  const handleSignatureSave = (sig: string) => {
    if (!selectedRepair || !sig) return;
    const updated = { ...selectedRepair, customerSignature: sig, updatedAt: new Date().toISOString() };
    onUpdateRepair(updated);
    setSelectedRepair(updated);
  };

  const handleCompleteService = () => {
    if (!selectedRepair) return;
    if (selectedRepair.repairType === 'domicilio' && !selectedRepair.customerSignature) {
      setShowSignature(true);
      return;
    }
    handleStatusChange(RepairStatus.DELIVERED);
  };

  // ─── LISTA ────────────────────────────────────────────────────────────────
  if (!selectedRepair) {
    return (
      <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
        {/* Header */}
        <div
          className="px-4 py-5 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32, #388e3c)' }}
        >
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl text-white active:scale-95 transition-all"
            style={{ background: 'rgba(0,0,0,0.25)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight leading-none">Panel de Campo</h1>
            <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {activeRepairs.length} servicio{activeRepairs.length !== 1 ? 's' : ''} activo{activeRepairs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pt-4">
          {([
            ['domicilio', '🏠 Domicilio'],
            ['all',       'Todos'],
            ['taller',    '🔧 Taller'],
          ] as const).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
              style={filterType === f
                ? { background: GREEN, color: '#fff' }
                : { background: '#1e1e1e', color: '#555', border: '1px solid #2a2a2a' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Repair list */}
        <div className="px-4 pt-4 pb-24 space-y-3">
          {activeRepairs.length === 0 ? (
            <div className="rounded-2xl py-16 text-center" style={{ background: '#1a1a1a', border: '1px dashed #2a2a2a' }}>
              <Wrench size={32} className="mx-auto mb-3" style={{ color: '#333' }} />
              <p className="text-[10px] font-black uppercase" style={{ color: '#444' }}>Sin servicios activos</p>
            </div>
          ) : (
            activeRepairs.map(r => {
              const theme = getTheme(r.status);
              const isDom = r.repairType === 'domicilio';
              return (
                <div
                  key={r.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                >
                  {/* Card main — tap to open detail */}
                  <button
                    onClick={() => setSelectedRepair(r)}
                    className="w-full text-left p-4 active:bg-white/5 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* RMA badge */}
                      <div
                        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-white"
                        style={{ background: isDom ? '#7c4a0066' : '#1e3a5f66', border: `1px solid ${isDom ? '#7c4a00' : '#1e3a5f'}` }}
                      >
                        <span className="text-[8px] opacity-60">{isDom ? '🏠' : '🔧'}</span>
                        <span className="text-[10px] leading-none">{String(r.rmaNumber).padStart(4, '0').slice(-4)}</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="font-black text-white text-sm uppercase truncate">{r.brand} {r.model}</p>
                          <span
                            className="text-[7px] font-black uppercase px-2 py-0.5 rounded-md shrink-0"
                            style={{ background: theme.bg, color: theme.text }}
                          >
                            {theme.label}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold truncate" style={{ color: '#aaa' }}>{r.customerName}</p>
                        {r.customerPhone && (
                          <p className="text-[10px]" style={{ color: '#666' }}>{r.customerPhone}</p>
                        )}
                        {r.address && (
                          <p className="text-[10px] flex items-center gap-1 mt-0.5 truncate" style={{ color: '#666' }}>
                            <MapPin size={9} style={{ color: '#fbbf24', flexShrink: 0 }} />
                            {r.address}{r.city ? `, ${r.city}` : ''}
                          </p>
                        )}
                        {r.problemDescription && (
                          <p className="text-[10px] mt-1 line-clamp-2 leading-snug" style={{ color: '#555' }}>
                            {r.problemDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Quick action buttons */}
                  <div
                    className="flex gap-1.5 px-3 pb-3"
                    onClick={e => e.stopPropagation()}
                  >
                    {r.customerPhone && (
                      <button
                        onClick={() => handleCall(r)}
                        className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase active:scale-95 transition-all"
                        style={{ background: '#1e3a5f44', color: '#60a5fa', border: '1px solid #1e3a5f' }}
                      >
                        <Phone size={12} /> Llamar
                      </button>
                    )}
                    {r.customerPhone && (
                      <button
                        onClick={() => handleWhatsApp(r)}
                        className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase active:scale-95 transition-all"
                        style={{ background: '#052e1644', color: '#4ade80', border: '1px solid #166534' }}
                      >
                        <MessageCircle size={12} /> WA
                      </button>
                    )}
                    {r.address && (
                      <button
                        onClick={() => openMaps(r)}
                        className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase active:scale-95 transition-all"
                        style={{ background: '#78350f44', color: '#fbbf24', border: '1px solid #78350f' }}
                      >
                        <Navigation size={12} /> GPS
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedRepair(r)}
                      className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase active:scale-95 transition-all"
                      style={{ background: '#2e7d3222', color: '#4ade80', border: `1px solid ${GREEN}` }}
                    >
                      Ver →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── FICHA ────────────────────────────────────────────────────────────────
  const notes = selectedRepair.fieldNotes || [];
  const isDom = selectedRepair.repairType === 'domicilio';
  const theme = getTheme(selectedRepair.status);

  return (
    <div className="min-h-screen pb-28" style={{ background: '#0f0f0f' }}>
      {showCamera && (
        <CameraCapture
          onCapture={(base64) => { setNotePhotos(prev => [...prev, base64]); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div
        className="px-4 py-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32, #388e3c)' }}
      >
        <button
          onClick={() => { setSelectedRepair(null); setShowSignature(false); }}
          className="p-2.5 rounded-xl text-white active:scale-95"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white uppercase truncate leading-none text-sm">
            {selectedRepair.brand} {selectedRepair.model}
          </p>
          <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
            RMA-{String(selectedRepair.rmaNumber).padStart(5, '0')} · {isDom ? '🏠 Domicilio' : '🔧 Taller'}
          </p>
        </div>
        {/* Status selector dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStatusPicker(!showStatusPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase"
            style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: theme.text }}
            />
            {theme.label} <ChevronDown size={10} />
          </button>
          {showStatusPicker && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl z-50 p-1.5 min-w-[200px]"
              style={{ background: '#1a1a1a', border: '1px solid #3a3a3a' }}
            >
              {FIELD_STATUSES.map(s => {
                const st = getTheme(s);
                const isActive = selectedRepair.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-2.5 transition-all"
                    style={isActive
                      ? { background: st.bg, color: st.text }
                      : { color: '#666' }
                    }
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.text }} />
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* Cliente + contacto rápido */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <User size={14} style={{ color: GREEN, flexShrink: 0 }} />
              <div className="min-w-0">
                <p className="font-black text-white text-sm truncate">{selectedRepair.customerName}</p>
                {selectedRepair.customerPhone && (
                  <p className="text-[10px]" style={{ color: '#888' }}>{selectedRepair.customerPhone}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {selectedRepair.customerPhone && (
                <button
                  onClick={() => handleCall(selectedRepair)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                  style={{ background: '#1e3a5f55', color: '#60a5fa', border: '1px solid #1e3a5f' }}
                  title="Llamar"
                >
                  <Phone size={18} />
                </button>
              )}
              {selectedRepair.customerPhone && (
                <button
                  onClick={() => handleWhatsApp(selectedRepair)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                  style={{ background: '#052e1655', color: '#4ade80', border: '1px solid #166534' }}
                  title="WhatsApp"
                >
                  <MessageCircle size={18} />
                </button>
              )}
            </div>
          </div>

          {/* GPS button */}
          {selectedRepair.address && (
            <button
              onClick={() => openMaps(selectedRepair)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left active:scale-[0.98] transition-all"
              style={{ background: '#78350f22', border: '1px solid #78350f88' }}
            >
              <Navigation size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase" style={{ color: '#fbbf24' }}>Cómo llegar · Google Maps</p>
                <p className="text-xs font-bold text-white truncate mt-0.5">
                  {selectedRepair.address}{selectedRepair.city ? `, ${selectedRepair.city}` : ''}
                </p>
              </div>
            </button>
          )}

          {/* Avería */}
          <div className="rounded-xl p-3" style={{ background: '#111' }}>
            <p className="text-[9px] font-black uppercase mb-1.5" style={{ color: '#444' }}>Avería reportada</p>
            <p className="text-xs font-medium leading-relaxed" style={{ color: '#aaa' }}>
              {selectedRepair.problemDescription || '—'}
            </p>
          </div>

          {/* Device info grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5" style={{ background: '#111' }}>
              <p className="text-[8px] font-black uppercase" style={{ color: '#444' }}>Tipo de equipo</p>
              <p className="text-xs font-bold text-white mt-0.5">{selectedRepair.deviceType || '—'}</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: '#111' }}>
              <p className="text-[8px] font-black uppercase" style={{ color: '#444' }}>Entrada</p>
              <p className="text-xs font-bold text-white mt-0.5">
                {selectedRepair.entryDate
                  ? new Date(selectedRepair.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Estado — botones de cambio rápido */}
        <div>
          <p className="text-[9px] font-black uppercase px-1 mb-2" style={{ color: '#555' }}>Cambiar estado</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FIELD_STATUSES.map(s => {
              const st = getTheme(s);
              const isActive = selectedRepair.status === s;
              return (
                <button
                  key={s}
                  onClick={() => !isActive && handleStatusChange(s)}
                  disabled={isActive}
                  className="py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                  style={isActive
                    ? { background: st.bg, color: st.text, border: `1.5px solid ${st.text}66` }
                    : { background: '#1a1a1a', color: '#444', border: '1px solid #2a2a2a' }
                  }
                >
                  {FIELD_STATUS_LABELS[s] ?? s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Finalizar servicio */}
        {selectedRepair.status !== RepairStatus.DELIVERED
          && selectedRepair.status !== RepairStatus.CANCELLED && (
          <button
            onClick={handleCompleteService}
            className="w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{ background: GREEN, color: '#fff', boxShadow: '0 4px 20px rgba(46,125,50,0.4)' }}
          >
            <CheckCircle2 size={18} />
            Finalizar Servicio{isDom ? ' (requiere firma)' : ''}
          </button>
        )}

        {/* Firma digital */}
        {showSignature && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center gap-2">
              <PenTool size={14} style={{ color: '#60a5fa' }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#888' }}>
                Firma del Cliente
              </span>
            </div>
            <SignaturePad
              label="Firma del cliente para completar servicio"
              onSave={(sig) => {
                if (sig) {
                  handleSignatureSave(sig);
                  setShowSignature(false);
                  handleStatusChange(RepairStatus.DELIVERED);
                }
              }}
              initialValue={selectedRepair.customerSignature}
            />
            <p className="text-[9px] text-center italic" style={{ color: '#555' }}>
              El cliente firma conforme al servicio recibido
            </p>
          </div>
        )}

        {/* Firma guardada */}
        {selectedRepair.customerSignature && !showSignature && (
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: '#052e16', border: '1px solid #166534' }}
          >
            <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#4ade80' }}>
              Servicio firmado por el cliente
            </span>
          </div>
        )}

        {/* Notas de campo */}
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest px-1 flex items-center gap-1.5" style={{ color: '#555' }}>
            <Flag size={10} /> Notas de Campo ({notes.length})
          </p>
          {notes.slice().reverse().map(note => (
            <div key={note.id} className="rounded-xl p-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[8px] font-bold" style={{ color: '#444' }}>
                  {new Date(note.timestamp).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1 active:scale-95"
                  style={{ color: '#333' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {note.text && <p className="text-xs font-medium" style={{ color: '#ccc' }}>{note.text}</p>}
              {note.photos && note.photos.length > 0 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto">
                  {note.photos.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoPreview(p)}
                      className="w-14 h-14 rounded-lg overflow-hidden shrink-0"
                      style={{ border: '1px solid #2a2a2a' }}
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Fotos pendientes de adjuntar */}
        {notePhotos.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {notePhotos.map((p, i) => (
              <div
                key={i}
                className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0"
                style={{ border: `2px solid ${GREEN}` }}
              >
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setNotePhotos(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-bl flex items-center justify-center"
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra inferior fija — input de notas */}
      <div
        className="fixed bottom-0 left-0 right-0 p-3 z-50"
        style={{ background: '#0d0d0d', borderTop: '1px solid #1e1e1e' }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button
            onClick={() => setShowCamera(true)}
            className="p-3 rounded-xl shrink-0 active:scale-95 transition-all"
            style={{ background: '#1a1a1a', color: '#666', border: '1px solid #2a2a2a' }}
          >
            <Camera size={18} />
          </button>
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            placeholder="Nota de campo..."
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none text-white placeholder:text-[#333]"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim() && notePhotos.length === 0}
            className="p-3 rounded-xl shrink-0 disabled:opacity-30 active:scale-95 transition-all"
            style={{ background: GREEN, color: '#fff', boxShadow: '0 4px 12px rgba(46,125,50,0.4)' }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Previsualización de foto a pantalla completa */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.95)' }}
          onClick={() => setPhotoPreview(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <X size={20} />
          </button>
          <img src={photoPreview} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default TechFieldView;
