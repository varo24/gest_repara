import React, { useState } from 'react';
import { 
  X, Camera, Trash2, User, Smartphone, 
  BrainCircuit, Sparkles, Loader2, Save
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings } from '../types';
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
    images: []
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
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

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 max-w-5xl mx-auto flex flex-col">
      <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white">
        <h2 className="text-xl font-black uppercase tracking-tight">
          {initialData ? `Ficha RMA-${initialData.rmaNumber}` : 'Nueva Reparación Técnica'}
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-lg"><X size={24} /></button>
      </div>

      <form onSubmit={handleSubmit} className="p-10 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
              <User size={14} /> Información del Cliente
            </h3>
            <div className="space-y-4">
              <input required type="text" placeholder="Nombre completo" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
              <input required type="tel" placeholder="Teléfono" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
              <Smartphone size={14} /> Detalles del Equipo
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input required type="text" placeholder="Equipo (ej: Lavadora)" className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value})} />
              <input required type="text" placeholder="Marca" className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
            </div>
            <input type="text" placeholder="Modelo / Número de Serie" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
            <span>Síntomas y Avería Reportada</span>
            <button type="button" onClick={handleAiDiagnosis} disabled={aiLoading} className="text-blue-600 flex items-center gap-2 hover:underline disabled:opacity-50">
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={14} />}
              {aiLoading ? 'Analizando...' : 'Asistente IA'}
            </button>
          </h3>
          <textarea required rows={4} placeholder="Describa el fallo reportado..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-none resize-none" value={formData.problemDescription} onChange={e => setFormData({...formData, problemDescription: e.target.value})} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado Técnico</label>
            <select className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as RepairStatus})}>
              {Object.values(RepairStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Técnico Asignado</label>
            <select className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs" value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})}>
              {settings?.technicians?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Entrada</label>
            <input type="date" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs" value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} />
          </div>
        </div>

        <div className="flex gap-4 pt-10 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-10 py-5 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 py-5 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl flex items-center justify-center gap-4 hover:bg-black transition-all">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {initialData ? 'Actualizar Ficha Técnica' : 'Registrar Reparación'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RepairForm;