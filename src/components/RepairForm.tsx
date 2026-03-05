import React, { useState, useRef } from 'react';
import { 
  X, Camera, Trash2, User, Smartphone, 
  BrainCircuit, Loader2, Save,
  Building2, Home, MapPin, Navigation, Image, Plus
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings } from '../types';
import { getSmartDiagnosis } from '../services/geminiService';
import CameraCapture from './CameraCapture';

interface RepairFormProps {
  onSave: (repair: Omit<RepairItem, 'rmaNumber'>, rma?: number) => void;
  onCancel: () => void;
  initialData?: RepairItem;
  settings?: AppSettings;
}

const RepairForm: React.FC<RepairFormProps> = ({ onSave, onCancel, initialData, settings }) => {
  const [formData, setFormData] = useState<Partial<RepairItem>>(() => {
    if (initialData) {
      return { ...initialData, repairType: initialData.repairType || 'taller', images: initialData.images || [] };
    }
    return {
      customerName: '', customerPhone: '', deviceType: '', brand: '', model: '', serialNumber: '',
      problemDescription: '', status: RepairStatus.PENDING,
      entryDate: new Date().toISOString().split('T')[0],
      technician: settings?.technicians?.[0] || '',
      images: [], repairType: 'taller', address: '', city: '', fieldNotes: [],
    };
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDomicilio = formData.repairType === 'domicilio';
  const images = formData.images || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isDomicilio && !formData.address) return;
    setIsSubmitting(true);
    try {
      await onSave(formData as Omit<RepairItem, 'rmaNumber'>, initialData?.rmaNumber);
    } catch(err) {
      console.error('Save error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiDiagnosis = async () => {
    if (!formData.deviceType || !formData.problemDescription) return;
    setAiLoading(true);
    try {
      const result = await getSmartDiagnosis(formData.deviceType, formData.brand || '', formData.problemDescription);
      if (result) {
        const hMatch = String(result.estimatedTime).match(/(\d+(\.\d+)?)/);
        if (hMatch) setFormData(prev => ({ ...prev, estimatedHours: parseFloat(hMatch[0]) }));
      }
    } catch (error) {
      console.error("AI Diagnosis error:", error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenMaps = () => {
    const dir = [formData.address, formData.city, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) return; // Max 5MB
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handlePhotoRemove = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 max-w-5xl mx-auto flex flex-col">
      {/* Camera capture fullscreen */}
      {showCamera && (
        <CameraCapture
          onCapture={(base64) => {
            setFormData(prev => ({ ...prev, images: [...(prev.images || []), base64] }));
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      {/* Gallery input */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />

      <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black uppercase tracking-tight">
            {initialData ? `Ficha RMA-${initialData.rmaNumber}` : 'Nueva Reparación Técnica'}
          </h2>
          {initialData && (
            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isDomicilio ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {isDomicilio ? '🏠 Domicilio' : '🔧 Taller'}
            </span>
          )}
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-lg"><X size={24} /></button>
      </div>

      <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto max-h-[80vh]">
        
        {/* ── SELECTOR TIPO REPARACIÓN ── */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Servicio</h3>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setFormData({...formData, repairType: 'taller'})}
              className={`relative p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${!isDomicilio ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${!isDomicilio ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                <Building2 size={22} />
              </div>
              <div className="text-left">
                <p className={`font-black text-sm uppercase tracking-tight ${!isDomicilio ? 'text-blue-700' : 'text-slate-700'}`}>En Taller</p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">Cliente trae el equipo</p>
              </div>
              {!isDomicilio && <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>}
            </button>
            <button type="button" onClick={() => setFormData({...formData, repairType: 'domicilio'})}
              className={`relative p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${isDomicilio ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/10' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDomicilio ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                <Home size={22} />
              </div>
              <div className="text-left">
                <p className={`font-black text-sm uppercase tracking-tight ${isDomicilio ? 'text-amber-700' : 'text-slate-700'}`}>A Domicilio</p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">Técnico se desplaza</p>
              </div>
              {isDomicilio && <div className="absolute top-3 right-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* ── CLIENTE ── */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2"><User size={14} /> Cliente</h3>
            <div className="space-y-4">
              <input required type="text" placeholder="Nombre completo" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
              <input required type="tel" placeholder="Teléfono" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
            </div>
          </div>
          {/* ── EQUIPO ── */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2"><Smartphone size={14} /> Equipo</h3>
            <div className="grid grid-cols-2 gap-4">
              <input required type="text" placeholder="Tipo (Lavadora...)" className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value})} />
              <input required type="text" placeholder="Marca" className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
            <input type="text" placeholder="Modelo / Nº de Serie" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
          </div>
        </div>

        {/* ── DIRECCIÓN DOMICILIO ── */}
        {isDomicilio && (
          <div className="space-y-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2"><MapPin size={14} /> Dirección</h3>
              {formData.address && (
                <button type="button" onClick={handleOpenMaps} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-amber-600 shadow-md">
                  <Navigation size={12} /> Maps
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <input required type="text" placeholder="Calle, número, piso" className="w-full px-5 py-3.5 bg-white border border-amber-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-amber-400/30" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <input type="text" placeholder="Ciudad" className="w-full px-5 py-3.5 bg-white border border-amber-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-amber-400/30" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
          </div>
        )}

        {/* ── AVERÍA ── */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
            <span>Descripción de la Avería</span>
            <button type="button" onClick={handleAiDiagnosis} disabled={aiLoading} className="text-blue-600 flex items-center gap-1.5 hover:underline disabled:opacity-50 text-[10px]">
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={14} />}
              {aiLoading ? 'Analizando...' : 'IA'}
            </button>
          </h3>
          <textarea required rows={3} placeholder="Fallo reportado por el cliente..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.problemDescription} onChange={e => setFormData({...formData, problemDescription: e.target.value})} />
        </div>

        {/* ── FOTOS DEL EQUIPO / AVERÍA ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Camera size={14} /> Fotos del Equipo ({images.length})
            </h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowCamera(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all">
                <Camera size={14} /> Cámara
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all">
                <Image size={14} /> Galería
              </button>
            </div>
          </div>

          {images.length === 0 ? (
            <div className="w-full py-10 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-4 text-slate-300">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Image size={24} />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest">Sin fotos registradas</p>
                <p className="text-[9px] font-bold mt-1">Fotografíe el equipo o la avería</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowCamera(true)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-200">
                  <Camera size={16} /> Abrir Cámara
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-200">
                  <Image size={16} /> Galería
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => setPhotoPreview(img)} />
                  <button type="button" onClick={() => handlePhotoRemove(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setShowCamera(true)} className="aspect-square rounded-xl border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center text-emerald-400 hover:border-emerald-400 hover:text-emerald-600 transition-all cursor-pointer gap-1">
                <Camera size={20} />
                <span className="text-[7px] font-black uppercase">Cámara</span>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-blue-300 hover:text-blue-500 transition-all cursor-pointer gap-1">
                <Plus size={20} />
                <span className="text-[7px] font-black uppercase">Galería</span>
              </button>
            </div>
          )}
        </div>

        {/* ── OPCIONES ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado Técnico</label>
            <select className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as RepairStatus})}>
              {Object.values(RepairStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Técnico</label>
            <select className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})}>
              <option value="">Sin asignar</option>
              {settings?.technicians?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Entrada</label>
            <input type="date" className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} />
          </div>
        </div>

        {/* ── ACCIONES ── */}
        <div className="flex gap-4 pt-8 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-50">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all ${isDomicilio ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200' : 'bg-slate-900 text-white hover:bg-black'}`}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {initialData ? 'Actualizar Ficha' : (isDomicilio ? 'Registrar Domicilio' : 'Registrar Reparación')}
          </button>
        </div>
      </form>

      {/* Photo preview fullscreen */}
      {photoPreview && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20"><X size={24} /></button>
          <img src={photoPreview} alt="" className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default RepairForm;
