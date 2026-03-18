import React, { useState, useRef, useMemo } from 'react';
import { 
  ArrowLeft, MapPin, Navigation, Phone, MessageCircle, Camera, 
  Send, Clock, User, ChevronDown, CheckCircle2,
  Home, Building2, Trash2, X, Flag, PenTool
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

const statusColors: Record<string, string> = {
  [RepairStatus.PENDING]: 'bg-yellow-400 text-yellow-900',
  [RepairStatus.DIAGNOSING]: 'bg-cyan-400 text-cyan-900',
  [RepairStatus.IN_PROGRESS]: 'bg-blue-500 text-white',
  [RepairStatus.WAITING_PARTS]: 'bg-orange-500 text-white',
  [RepairStatus.READY]: 'bg-emerald-500 text-white',
  [RepairStatus.DELIVERED]: 'bg-slate-400 text-white',
  [RepairStatus.CANCELLED]: 'bg-red-600 text-white',
};

const TechFieldView: React.FC<TechFieldViewProps> = ({ repairs, settings, onUpdateRepair, onBack }) => {
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'domicilio' | 'taller'>('all');
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

  const handleOpenMaps = (r: RepairItem) => {
    const dir = [r.address, r.city, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  const handleCall = (r: RepairItem) => window.open(`tel:${r.customerPhone}`, '_self');

  const handleWhatsApp = (r: RepairItem) => {
    const phone = r.customerPhone.replace(/\D/g, '');
    window.open(`whatsapp://send?phone=34${phone}&text=${encodeURIComponent(`Hola ${r.customerName}, soy técnico de ${settings.appName}.`)}`);
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

  // ─── LISTA ──
  if (!selectedRepair) {
    return (
      <div className="max-w-lg mx-auto space-y-4 pb-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Panel de Campo</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em]">{activeRepairs.length} servicios</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['all', 'domicilio', 'taller'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                filterType === f 
                  ? (f === 'domicilio' ? 'bg-amber-500 text-white' : f === 'taller' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white')
                  : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'domicilio' ? '🏠 Dom.' : '🔧 Taller'}
            </button>
          ))}
        </div>

        {activeRepairs.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
            <p className="text-[10px] font-black text-slate-300 uppercase">Sin servicios activos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeRepairs.map(r => (
              <button key={r.id} onClick={() => setSelectedRepair(r)}
                className="w-full bg-white rounded-xl p-4 border border-slate-100 hover:border-blue-200 transition-all text-left active:scale-[0.98] flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-black text-white ${r.repairType === 'domicilio' ? 'bg-amber-500' : 'bg-slate-800'}`}>
                  {r.rmaNumber.toString().padStart(3, '0').slice(-3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-xs uppercase truncate">{r.brand} {r.model}</p>
                  <p className="text-[9px] text-slate-400 truncate">{r.customerName}{r.address ? ` · ${r.address}` : ''}</p>
                </div>
                <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${statusColors[r.status] || 'bg-slate-100 text-slate-500'}`}>
                  {r.status.split(' ').pop()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── FICHA ──
  const notes = selectedRepair.fieldNotes || [];
  const isDom = selectedRepair.repairType === 'domicilio';

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-28">
      {showCamera && (
        <CameraCapture
          onCapture={(base64) => { setNotePhotos(prev => [...prev, base64]); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      {/* Header mínimo */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setSelectedRepair(null); setShowSignature(false); }} className="p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 shadow-sm">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black text-slate-900 uppercase tracking-tight truncate">{selectedRepair.brand} {selectedRepair.model}</p>
          <p className="text-[9px] text-slate-400 font-black uppercase">RMA-{selectedRepair.rmaNumber.toString().padStart(5, '0')} · {isDom ? '🏠 Domicilio' : '🔧 Taller'}</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowStatusPicker(!showStatusPicker)} className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase border ${statusColors[selectedRepair.status] || 'bg-slate-100'}`}>
            {selectedRepair.status} <ChevronDown size={10} className="inline" />
          </button>
          {showStatusPicker && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border z-50 p-1 min-w-[180px]">
              {Object.values(RepairStatus).filter(s => s !== RepairStatus.CANCELLED).map(s => (
                <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-3 py-2 rounded-lg text-[9px] font-black uppercase ${selectedRepair.status === s ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info esencial */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
        {/* Cliente + acciones rápidas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <User size={14} className="text-slate-400 shrink-0" />
            <span className="font-bold text-slate-700 text-sm truncate">{selectedRepair.customerName}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => handleCall(selectedRepair)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Phone size={14} /></button>
            <button onClick={() => handleWhatsApp(selectedRepair)} className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><MessageCircle size={14} /></button>
          </div>
        </div>

        {/* Dirección con GPS */}
        {isDom && selectedRepair.address && (
          <button onClick={() => handleOpenMaps(selectedRepair)} className="w-full flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left active:scale-[0.98]">
            <Navigation size={16} className="text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 truncate">{selectedRepair.address}{selectedRepair.city ? `, ${selectedRepair.city}` : ''}</span>
          </button>
        )}

        {/* Avería — colapsada */}
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Avería</p>
          <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-3">{selectedRepair.problemDescription}</p>
        </div>
      </div>

      {/* Botón finalizar servicio */}
      {selectedRepair.status !== RepairStatus.DELIVERED && (
        <button onClick={handleCompleteService}
          className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98] shadow-lg shadow-emerald-200 transition-all"
        >
          <CheckCircle2 size={18} /> Finalizar Servicio {isDom ? '(requiere firma)' : ''}
        </button>
      )}

      {/* Firma digital (domicilio) */}
      {showSignature && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PenTool size={14} className="text-blue-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Firma del Cliente</span>
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
          <p className="text-[9px] text-slate-400 italic text-center">
            El cliente firma conforme al servicio recibido
          </p>
        </div>
      )}

      {/* Firma guardada */}
      {selectedRepair.customerSignature && !showSignature && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Servicio firmado por el cliente</span>
        </div>
      )}

      {/* Bitácora */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
          <Flag size={10} /> Notas de Campo ({notes.length})
        </p>
        {notes.slice().reverse().map(note => (
          <div key={note.id} className="bg-white rounded-xl border border-slate-100 p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] font-bold text-slate-300">
                {new Date(note.timestamp).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <button onClick={() => handleDeleteNote(note.id)} className="p-1 text-slate-200 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
            {note.text && <p className="text-xs text-slate-600 font-medium">{note.text}</p>}
            {note.photos && note.photos.length > 0 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto">
                {note.photos.map((p, i) => (
                  <button key={i} onClick={() => setPhotoPreview(p)} className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview fotos pendientes */}
      {notePhotos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {notePhotos.map((p, i) => (
            <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 border-blue-300">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setNotePhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-bl flex items-center justify-center"><X size={8} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Input fijo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button onClick={() => setShowCamera(true)} className="p-3 bg-slate-100 text-slate-500 rounded-xl shrink-0 active:scale-95">
            <Camera size={18} />
          </button>
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            placeholder="Nota de campo..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
          />
          <button onClick={handleAddNote} disabled={!noteText.trim() && notePhotos.length === 0}
            className="p-3 bg-blue-600 text-white rounded-xl shrink-0 disabled:opacity-30 active:scale-95 shadow-lg shadow-blue-200"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Photo preview fullscreen */}
      {photoPreview && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full"><X size={20} /></button>
          <img src={photoPreview} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default TechFieldView;
