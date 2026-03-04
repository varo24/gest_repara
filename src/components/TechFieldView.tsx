import React, { useState, useRef, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, MapPin, Navigation, Phone, MessageCircle, Camera, 
  Send, Clock, Wrench, User, ChevronDown, CheckCircle2, 
  AlertCircle, Image, X, Play, Pause, Flag, ChevronRight,
  Home, Building2, Trash2
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings, FieldNote, RepairType } from '../types';

interface TechFieldViewProps {
  repairs: RepairItem[];
  settings: AppSettings;
  onUpdateRepair: (repair: RepairItem) => void;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  [RepairStatus.PENDING]: 'bg-amber-100 text-amber-700 border-amber-200',
  [RepairStatus.DIAGNOSING]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  [RepairStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-700 border-blue-200',
  [RepairStatus.WAITING_PARTS]: 'bg-orange-100 text-orange-700 border-orange-200',
  [RepairStatus.READY]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [RepairStatus.DELIVERED]: 'bg-slate-100 text-slate-500 border-slate-200',
  [RepairStatus.CANCELLED]: 'bg-red-100 text-red-500 border-red-200',
};

const TechFieldView: React.FC<TechFieldViewProps> = ({ repairs, settings, onUpdateRepair, onBack }) => {
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'domicilio' | 'taller'>('all');
  const [noteText, setNoteText] = useState('');
  const [notePhotos, setNotePhotos] = useState<string[]>([]);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter active repairs (not delivered/cancelled)
  const activeRepairs = useMemo(() => {
    return repairs
      .filter(r => r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED)
      .filter(r => filterType === 'all' || r.repairType === filterType)
      .sort((a, b) => {
        // Domicilio first, then by date
        if (a.repairType === 'domicilio' && b.repairType !== 'domicilio') return -1;
        if (a.repairType !== 'domicilio' && b.repairType === 'domicilio') return 1;
        return new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
      });
  }, [repairs, filterType]);

  const handleOpenMaps = (repair: RepairItem) => {
    const dir = [repair.address, repair.city, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  const handleCallCustomer = (repair: RepairItem) => {
    window.open(`tel:${repair.customerPhone}`, '_self');
  };

  const handleWhatsApp = (repair: RepairItem) => {
    const phone = repair.customerPhone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hola ${repair.customerName}, soy el técnico de ${settings.appName}. Le informo sobre su reparación RMA-${repair.rmaNumber.toString().padStart(5, '0')}.`);
    window.open(`https://wa.me/34${phone}?text=${msg}`, '_blank');
  };

  const handleStatusChange = (status: RepairStatus) => {
    if (!selectedRepair) return;
    const updated = { ...selectedRepair, status, updatedAt: new Date().toISOString() };
    onUpdateRepair(updated);
    setSelectedRepair(updated);
    setShowStatusPicker(false);
  };

  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNotePhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setNotePhotos(prev => prev.filter((_, i) => i !== idx));
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

  // ─── LISTA DE REPARACIONES ──
  if (!selectedRepair) {
    return (
      <div className="max-w-lg mx-auto space-y-5 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Panel de Campo</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Modo Técnico · {activeRepairs.length} servicios activos</p>
          </div>
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2">
          {(['all', 'domicilio', 'taller'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filterType === f 
                  ? (f === 'domicilio' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : f === 'taller' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-900 text-white shadow-lg')
                  : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              {f === 'domicilio' && <Home size={14} />}
              {f === 'taller' && <Building2 size={14} />}
              {f === 'all' ? 'Todos' : f === 'domicilio' ? 'Domicilio' : 'Taller'}
            </button>
          ))}
        </div>

        {/* Lista */}
        {activeRepairs.length === 0 ? (
          <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 py-16 text-center">
            <Wrench size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin servicios activos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRepairs.map(repair => (
              <button
                key={repair.id}
                onClick={() => setSelectedRepair(repair)}
                className="w-full bg-white rounded-[1.5rem] p-5 border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all text-left group active:scale-[0.98]"
              >
                <div className="flex items-start gap-4">
                  {/* Badge tipo */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${repair.repairType === 'domicilio' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    {repair.repairType === 'domicilio' ? <Home size={20} /> : <Building2 size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RMA-{repair.rmaNumber.toString().padStart(5, '0')}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${statusColors[repair.status] || 'bg-slate-100 text-slate-500'}`}>
                        {repair.status}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight truncate">{repair.brand} {repair.model}</h3>
                    <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-1">
                      <User size={10} /> {repair.customerName}
                    </p>
                    {repair.repairType === 'domicilio' && repair.address && (
                      <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1 mt-1">
                        <MapPin size={10} /> {repair.address}{repair.city ? `, ${repair.city}` : ''}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-slate-200 group-hover:text-blue-500 shrink-0 mt-3 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── FICHA DE REPARACIÓN ──
  const isDomicilio = selectedRepair.repairType === 'domicilio';
  const notes = selectedRepair.fieldNotes || [];

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-24">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedRepair(null)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate">
            RMA-{selectedRepair.rmaNumber.toString().padStart(5, '0')}
          </h1>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em]">
            {isDomicilio ? '🏠 Servicio a Domicilio' : '🔧 Reparación en Taller'}
          </p>
        </div>
        <div className="relative">
          <button onClick={() => setShowStatusPicker(!showStatusPicker)} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-1 ${statusColors[selectedRepair.status] || 'bg-slate-100'}`}>
            {selectedRepair.status} <ChevronDown size={12} />
          </button>
          {showStatusPicker && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-2 min-w-[200px]">
              {Object.values(RepairStatus).map(s => (
                <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${selectedRepair.status === s ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ficha del equipo */}
      <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className={`p-5 ${isDomicilio ? 'bg-amber-50 border-b border-amber-100' : 'bg-blue-50 border-b border-blue-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg ${isDomicilio ? 'bg-amber-500' : 'bg-blue-600'}`}>
              {selectedRepair.brand?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none truncate">{selectedRepair.brand} {selectedRepair.model}</h2>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{selectedRepair.deviceType}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Cliente */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><User size={18} /></div>
              <div className="min-w-0">
                <p className="font-black text-slate-800 text-sm uppercase truncate">{selectedRepair.customerName}</p>
                <p className="text-[10px] text-slate-400 font-bold">{selectedRepair.customerPhone}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleCallCustomer(selectedRepair)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-colors">
                <Phone size={18} />
              </button>
              <button onClick={() => handleWhatsApp(selectedRepair)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-colors">
                <MessageCircle size={18} />
              </button>
            </div>
          </div>

          {/* Dirección (domicilio) */}
          {isDomicilio && selectedRepair.address && (
            <button onClick={() => handleOpenMaps(selectedRepair)} className="w-full flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl group hover:bg-amber-100 transition-all active:scale-[0.98]">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-md">
                <Navigation size={18} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Dirección del cliente</p>
                <p className="font-bold text-slate-800 text-sm truncate">{selectedRepair.address}{selectedRepair.city ? `, ${selectedRepair.city}` : ''}</p>
              </div>
              <ChevronRight size={18} className="text-amber-400 group-hover:text-amber-600 transition-colors" />
            </button>
          )}

          {/* Avería */}
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Avería Reportada</p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">{selectedRepair.problemDescription}</p>
          </div>

          {/* Info row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Fecha</p>
              <p className="text-[11px] font-black text-slate-700 mt-1">{new Date(selectedRepair.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Técnico</p>
              <p className="text-[11px] font-black text-slate-700 mt-1 truncate">{selectedRepair.technician || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Notas</p>
              <p className="text-[11px] font-black text-blue-600 mt-1">{notes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notas del Técnico */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
          <Flag size={12} /> Bitácora de Campo ({notes.length})
        </h3>

        {notes.length > 0 && (
          <div className="space-y-3">
            {notes.slice().reverse().map(note => (
              <div key={note.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    <Clock size={10} className="inline mr-1" />
                    {new Date(note.timestamp).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={() => handleDeleteNote(note.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
                {note.text && <p className="text-sm text-slate-700 font-medium leading-relaxed">{note.text}</p>}
                {note.photos && note.photos.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {note.photos.map((photo, idx) => (
                      <button key={idx} onClick={() => setPhotoPreview(photo)} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100 hover:border-blue-300 transition-colors">
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo preview pending */}
      {notePhotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-1">
          {notePhotos.map((p, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 border-blue-300">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removePhoto(i)} className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input zona - sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 safe-area-bottom z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="max-w-lg mx-auto flex items-end gap-3">
          <button onClick={handlePhotoCapture} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0 active:scale-95">
            <Camera size={22} />
          </button>
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Escribir nota de campo..."
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              style={{ minHeight: '52px', maxHeight: '120px' }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
            />
          </div>
          <button 
            onClick={handleAddNote} 
            disabled={!noteText.trim() && notePhotos.length === 0}
            className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-blue-200"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {photoPreview && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20">
            <X size={24} />
          </button>
          <img src={photoPreview} alt="" className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default TechFieldView;
