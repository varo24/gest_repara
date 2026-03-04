import React, { useState } from 'react';
import { 
  X, Camera, Trash2, User, Smartphone, 
  BrainCircuit, Sparkles, Loader2, Save,
  Building2, Home, MapPin, Navigation
} from 'lucide-react';
import { RepairItem, RepairStatus, RepairType, AppSettings } from '../types';
import { getSmartDiagnosis } from '../services/geminiService';

interface RepairFormProps {
  onSave: (repair: Omit<RepairItem, 'rmaNumber'>, rma?: number) => void;
  onCancel: () => void;
  initialData?: RepairItem;
  settings?: AppSettings;
}

const RepairForm: React.FC<RepairFormProps> = ({ onSave, onCancel, initialData, settings }) => {
  const [formData, setFormData] = useState<Partial<RepairItem>>(initialData || {
    customerName: '',
    customerPhone: '',
    deviceType: '',
    brand: '',
    model: '',
    serialNumber: '',
    problemDescription: '',
    status: RepairStatus.PENDING,
    entryDate: new Date().toISOString().split('T')[0],
    technician: settings?.technicians?.[0] || '',
    images: [],
    repairType: 'taller',
    address: '',
    city: '',
    fieldNotes: [],
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDomicilio = formData.repairType === 'domicilio';

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

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 max-w-5xl mx-auto flex flex-col">
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

      <form onSubmit={handleSubmit} className="p-10 space-y-10">
        
        {/* ── SELECTOR TIPO REPARACIÓN ── */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Servicio</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({...formData, repairType: 'taller'})}
              className={`relative p-6 rounded-2xl border-2 transition-all flex items-center gap-5 group ${
                !isDomicilio 
                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10' 
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${!isDomicilio ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                <Building2 size={24} />
              </div>
              <div className="text-left">
                <p className={`font-black text-sm uppercase tracking-tight ${!isDomicilio ? 'text-blue-700' : 'text-slate-700'}`}>Reparación en Taller</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">El cliente trae el equipo al local</p>
              </div>
              {!isDomicilio && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFormData({...formData, repairType: 'domicilio'})}
              className={`relative p-6 rounded-2xl border-2 transition-all flex items-center gap-5 group ${
                isDomicilio 
                  ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/10' 
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDomicilio ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                <Home size={24} />
              </div>
              <div className="text-left">
                <p className={`font-black text-sm uppercase tracking-tight ${isDomicilio ? 'text-amber-700' : 'text-slate-700'}`}>Reparación a Domicilio</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">El técnico se desplaza al cliente</p>
              </div>
              {isDomicilio && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* ── CLIENTE ── */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
              <User size={14} /> Información del Cliente
            </h3>
            <div className="space-y-4">
              <input required type="text" placeholder="Nombre completo" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
              <input required type="tel" placeholder="Teléfono" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
            </div>
          </div>

          {/* ── EQUIPO ── */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
              <Smartphone size={14} /> Detalles del Equipo
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input required type="text" placeholder="Equipo (ej: Lavadora)" className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value})} />
              <input required type="text" placeholder="Marca" className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
            <input type="text" placeholder="Modelo / Número de Serie" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
          </div>
        </div>

        {/* ── DIRECCIÓN DOMICILIO ── */}
        {isDomicilio && (
          <div className="space-y-4 p-6 bg-amber-50 border-2 border-amber-200 rounded-[1.5rem] animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                <MapPin size={14} /> Dirección del Domicilio
              </h3>
              {formData.address && (
                <button type="button" onClick={handleOpenMaps} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-md">
                  <Navigation size={14} /> Abrir en Maps
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <input 
                  required 
                  type="text" 
                  placeholder="Calle, número, piso y puerta" 
                  className="w-full px-6 py-4 bg-white border border-amber-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all" 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                />
              </div>
              <div>
                <input 
                  type="text" 
                  placeholder="Ciudad" 
                  className="w-full px-6 py-4 bg-white border border-amber-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all" 
                  value={formData.city} 
                  onChange={e => setFormData({...formData, city: e.target.value})} 
                />
              </div>
            </div>
            <p className="text-[9px] text-amber-500 font-bold italic px-1">
              Esta dirección será visible para el técnico en su tablet/móvil con acceso a GPS.
            </p>
          </div>
        )}

        {/* ── AVERÍA ── */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
            <span>Síntomas y Avería Reportada</span>
            <button type="button" onClick={handleAiDiagnosis} disabled={aiLoading} className="text-blue-600 flex items-center gap-2 hover:underline disabled:opacity-50">
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={14} />}
              {aiLoading ? 'Analizando...' : 'Asistente IA'}
            </button>
          </h3>
          <textarea required rows={4} placeholder="Describa el fallo reportado..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={formData.problemDescription} onChange={e => setFormData({...formData, problemDescription: e.target.value})} />
        </div>

        {/* ── OPCIONES ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado Técnico</label>
            <select className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as RepairStatus})}>
              {Object.values(RepairStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Técnico Asignado</label>
            <select className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none" value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})}>
              {settings?.technicians?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Entrada</label>
            <input type="date" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none" value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} />
          </div>
        </div>

        {/* ── ACCIONES ── */}
        <div className="flex gap-4 pt-10 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-10 py-5 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-50 transition-all">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className={`flex-1 py-5 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl flex items-center justify-center gap-4 transition-all ${isDomicilio ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200' : 'bg-slate-900 text-white hover:bg-black'}`}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {initialData ? 'Actualizar Ficha Técnica' : (isDomicilio ? 'Registrar Servicio a Domicilio' : 'Registrar Reparación')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RepairForm;
