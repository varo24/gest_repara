import React, { useState, useRef, useMemo } from 'react';
import {
  X, Camera, Trash2, User, Smartphone,
  BrainCircuit, Loader2, Save,
  Building2, Home, MapPin, Navigation, Image, Plus, Search, Users,
  Eye, Upload, ClipboardCheck, FlaskConical,
} from 'lucide-react';
import { RepairItem, RepairStatus, AppSettings } from '../types';
import { logError } from '../lib/errorLogger';
import { getSmartDiagnosis } from '../services/geminiService';
import CameraCapture from './CameraCapture';
import { uploadRepairPhoto } from '../lib/storageService';

interface CustomerSuggestion {
  name: string;
  phone: string;
  address?: string;
  city?: string;
  repairCount: number;
}

interface RepairFormProps {
  onSave: (repair: Omit<RepairItem, 'rmaNumber'>, rma?: number) => void;
  onCancel: () => void;
  initialData?: RepairItem;
  settings?: AppSettings;
  repairs?: RepairItem[];
  prefillCustomer?: { name: string; phone: string; address?: string; city?: string } | null;
}

type Tab = 'general' | 'estetico' | 'fotos' | 'diagnostico';
type RepairPhoto = NonNullable<RepairItem['photos']>[number];

const TIPO_COLOR: Record<string, string> = {
  entrada: '#1565c0',
  diagnostico: '#7b1fa2',
  salida: '#2e7d32',
};
const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  diagnostico: 'Diagnóstico',
  salida: 'Salida',
};

const DIFICULTAD = [
  { value: 'facil', label: 'Fácil', color: '#16a34a' },
  { value: 'medio', label: 'Medio', color: '#d97706' },
  { value: 'dificil', label: 'Difícil', color: '#dc2626' },
  { value: 'no-reparable', label: 'No reparable', color: '#6b7280' },
] as const;

const genId = () => `RMA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const RepairForm: React.FC<RepairFormProps> = ({
  onSave, onCancel, initialData, settings, repairs = [], prefillCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const [formData, setFormData] = useState<Partial<RepairItem>>(() => {
    if (initialData) {
      return {
        ...initialData,
        repairType: initialData.repairType || 'taller',
        images: initialData.images || [],
        photos: initialData.photos || [],
      };
    }
    return {
      id: genId(),
      customerName: prefillCustomer?.name || '',
      customerPhone: prefillCustomer?.phone || '',
      deviceType: '', brand: '', model: '', serialNumber: '',
      problemDescription: '', status: RepairStatus.PENDING,
      entryDate: new Date().toISOString().split('T')[0],
      technician: settings?.technicians?.[0] || '',
      images: [], photos: [], repairType: 'taller',
      address: prefillCustomer?.address || '',
      city: prefillCustomer?.city || '',
      fieldNotes: [],
    };
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');

  // Photo upload
  const [pendingPhoto, setPendingPhoto] = useState<{
    dataUrl: string;
    tipo: 'entrada' | 'salida' | 'diagnostico';
    caption: string;
    mimeType: string;
  } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [defaultTipo, setDefaultTipo] = useState<'entrada' | 'salida' | 'diagnostico'>('entrada');

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);

  // ── Customer DB ──
  const customerDB = useMemo((): CustomerSuggestion[] => {
    const map = new Map<string, CustomerSuggestion>();
    for (const r of repairs) {
      if (!r.customerPhone) continue;
      const ex = map.get(r.customerPhone);
      if (!ex) {
        map.set(r.customerPhone, { name: r.customerName || '', phone: r.customerPhone, address: r.address, city: r.city, repairCount: 1 });
      } else {
        ex.repairCount++;
        if (r.customerName && r.customerName.length > ex.name.length) ex.name = r.customerName;
        if (r.address && !ex.address) ex.address = r.address;
        if (r.city && !ex.city) ex.city = r.city;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [repairs]);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) return customerDB.slice(0, 20);
    const q = customerQuery.toLowerCase();
    return customerDB.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 10);
  }, [customerDB, customerQuery]);

  const handleSelectCustomer = (c: CustomerSuggestion) => {
    setFormData(prev => ({ ...prev, customerName: c.name, customerPhone: c.phone, ...(c.address ? { address: c.address } : {}), ...(c.city ? { city: c.city } : {}) }));
    setShowCustomerSearch(false);
    setCustomerQuery('');
  };

  const isDomicilio = formData.repairType === 'domicilio';
  const photos = formData.photos || [];
  const estético = formData.estadoEstetico;
  const diag = formData.diagnostico;

  const hasEstético = !!estético && (!!estético.pantalla || !!estético.carcasa);
  const hasDiag = !!diag?.problema;

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isDomicilio && !formData.address) { setActiveTab('general'); return; }
    setIsSubmitting(true);
    try {
      await onSave(formData as Omit<RepairItem, 'rmaNumber'>, initialData?.rmaNumber);
    } catch (err) {
      console.error('Save error:', err);
      logError('uncaught', err instanceof Error ? err : new Error(String(err)));
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
        const m = String(result.estimatedTime).match(/(\d+(\.\d+)?)/);
        if (m) setFormData(prev => ({ ...prev, estimatedHours: parseFloat(m[0]) }));
      }
    } catch {}
    finally { setAiLoading(false); }
  };

  const handleOpenMaps = () => {
    const dir = [formData.address, formData.city, 'España'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`, '_blank');
  };

  // ── Photo handlers ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingPhoto({ dataUrl: reader.result as string, tipo: defaultTipo, caption: '', mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCameraCapture = (base64: string) => {
    setPendingPhoto({ dataUrl: base64, tipo: defaultTipo, caption: '', mimeType: 'image/png' });
    setShowCamera(false);
  };

  const confirmUpload = async () => {
    if (!pendingPhoto || !formData.id) return;
    if (photos.length >= 10) { setPendingPhoto(null); return; }
    setUploadingPhoto(true);
    try {
      const url = await uploadRepairPhoto(formData.id, pendingPhoto.dataUrl, pendingPhoto.tipo, pendingPhoto.mimeType);
      const p: RepairPhoto = { url, tipo: pendingPhoto.tipo, caption: pendingPhoto.caption || undefined, uploadedAt: new Date().toISOString() };
      setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), p] }));
      setPendingPhoto(null);
    } catch (err) {
      console.error('Photo upload error:', err);
      logError('uncaught', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (idx: number) => setFormData(prev => ({ ...prev, photos: (prev.photos || []).filter((_, i) => i !== idx) }));

  // ── Estético / Diagnóstico helpers ──
  const setEst = (field: string, value: string) =>
    setFormData(prev => ({
      ...prev,
      estadoEstetico: {
        pantalla: 'perfecto', carcasa: 'perfecto', botones: 'perfecto', puertos: 'perfecto',
        ...prev.estadoEstetico,
        [field]: value,
      } as RepairItem['estadoEstetico'],
    }));

  const setDiag = (field: string, value: unknown) =>
    setFormData(prev => ({
      ...prev,
      diagnostico: { problema: '', ...prev.diagnostico, [field]: value },
    }));

  // ── Reusable button-group ──
  const BtnGroup = ({ value, options, onChange }: {
    value: string | undefined;
    options: readonly { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
            value === o.value ? 'bg-slate-800 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const tabs: { id: Tab; label: string; dot?: boolean }[] = [
    { id: 'general',     label: 'General' },
    { id: 'estetico',    label: hasEstético ? '✅ Estado' : 'Estado Estético' },
    { id: 'fotos',       label: photos.length > 0 ? `📷 Fotos (${photos.length})` : 'Fotos' },
    { id: 'diagnostico', label: hasDiag ? '🔬 Diagnóstico' : 'Diagnóstico' },
  ];

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden max-w-5xl mx-auto flex flex-col">
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

      {/* ── Header ── */}
      <div className="bg-slate-900 px-8 py-5 flex justify-between items-center text-white shrink-0">
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

      {/* ── Tab Bar ── */}
      <div className="flex border-b border-slate-100 bg-slate-50 shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-white/60'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-8 md:p-10 space-y-8 overflow-y-auto flex-1 max-h-[72vh]">

          {/* ════════════ GENERAL ════════════ */}
          {activeTab === 'general' && (<>
            {/* Tipo servicio */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Servicio</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: 'taller', label: 'En Taller', sub: 'Cliente trae el equipo', Icon: Building2, active: !isDomicilio, cls: 'border-blue-500 bg-blue-50 shadow-blue-500/10', btnCls: 'bg-blue-600', textCls: 'text-blue-700', dot: 'bg-blue-600' },
                  { type: 'domicilio', label: 'A Domicilio', sub: 'Técnico se desplaza', Icon: Home, active: isDomicilio, cls: 'border-amber-500 bg-amber-50 shadow-amber-500/10', btnCls: 'bg-amber-500', textCls: 'text-amber-700', dot: 'bg-amber-500' },
                ].map(opt => (
                  <button key={opt.type} type="button" onClick={() => setFormData({ ...formData, repairType: opt.type as any })}
                    className={`relative p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${opt.active ? `${opt.cls} shadow-lg` : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${opt.active ? `${opt.btnCls} text-white shadow-lg` : 'bg-slate-100 text-slate-400'}`}>
                      <opt.Icon size={22} />
                    </div>
                    <div className="text-left">
                      <p className={`font-black text-sm uppercase tracking-tight ${opt.active ? opt.textCls : 'text-slate-700'}`}>{opt.label}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">{opt.sub}</p>
                    </div>
                    {opt.active && (
                      <div className={`absolute top-3 right-3 w-5 h-5 ${opt.dot} rounded-full flex items-center justify-center`}>
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Cliente */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2"><User size={14}/> Cliente</h3>
                  {!initialData && customerDB.length > 0 && (
                    <button type="button" onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${showCustomerSearch ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                      <Users size={12}/> {showCustomerSearch ? 'Cerrar' : `Buscar (${customerDB.length})`}
                    </button>
                  )}
                </div>
                {showCustomerSearch && !initialData && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={14}/>
                      <input autoFocus type="text" placeholder="Buscar por nombre o teléfono..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl font-bold text-sm outline-none" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}/>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredCustomers.length === 0 ? (
                        <p className="text-[10px] text-blue-400 font-bold text-center py-3">Sin resultados</p>
                      ) : filteredCustomers.map(c => (
                        <button key={c.phone} type="button" onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left px-4 py-2.5 bg-white rounded-xl border border-blue-100 hover:border-blue-400 transition-all flex items-center gap-3 group">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-[10px] font-black group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-xs uppercase truncate">{c.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{c.phone} · {c.repairCount} rep.</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <input required type="text" placeholder="Nombre completo" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})}/>
                  <input required type="tel"  placeholder="Teléfono"         className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})}/>
                </div>
              </div>

              {/* Equipo */}
              <div className="space-y-5">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2"><Smartphone size={14}/> Equipo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input required type="text" placeholder="Tipo (Lavadora...)" className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.deviceType}   onChange={e => setFormData({...formData, deviceType: e.target.value})}/>
                  <input required type="text" placeholder="Marca"             className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.brand}       onChange={e => setFormData({...formData, brand: e.target.value})}/>
                </div>
                <input type="text" placeholder="Modelo"           className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.model}        onChange={e => setFormData({...formData, model: e.target.value})}/>
                <input type="text" placeholder="Nº Serie / IMEI"  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})}/>
              </div>
            </div>

            {isDomicilio && (
              <div className="space-y-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2"><MapPin size={14}/> Dirección</h3>
                  {formData.address && (
                    <button type="button" onClick={handleOpenMaps} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-amber-600">
                      <Navigation size={12}/> Maps
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <input required type="text" placeholder="Calle, número, piso" className="w-full px-5 py-3.5 bg-white border border-amber-200 rounded-xl font-bold outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}/>
                  </div>
                  <input type="text" placeholder="Ciudad" className="w-full px-5 py-3.5 bg-white border border-amber-200 rounded-xl font-bold outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}/>
                </div>
              </div>
            )}

            {/* Avería */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
                <span>Descripción de la Avería</span>
                <button type="button" onClick={handleAiDiagnosis} disabled={aiLoading} className="text-blue-600 flex items-center gap-1.5 hover:underline disabled:opacity-50 text-[10px]">
                  {aiLoading ? <Loader2 size={12} className="animate-spin"/> : <BrainCircuit size={14}/>}
                  {aiLoading ? 'Analizando...' : 'IA'}
                </button>
              </h3>
              <textarea required rows={3} placeholder="Fallo reportado por el cliente..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none" value={formData.problemDescription} onChange={e => setFormData({...formData, problemDescription: e.target.value})}/>
            </div>

            {/* Opciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: 'Estado Técnico', content: (
                  <select className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as RepairStatus})}>
                    {Object.values(RepairStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )},
                { label: 'Técnico', content: (
                  <select className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})}>
                    <option value="">Sin asignar</option>
                    {settings?.technicians?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )},
                { label: 'Fecha Entrada', content: (
                  <input type="date" className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})}/>
                )},
              ].map(({ label, content }) => (
                <div key={label} className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                  {content}
                </div>
              ))}
            </div>
          </>)}

          {/* ════════════ ESTADO ESTÉTICO ════════════ */}
          {activeTab === 'estetico' && (
            <div className="space-y-7">
              <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <Eye size={20} className="text-blue-600 mt-0.5 shrink-0"/>
                <div>
                  <p className="text-[11px] font-black text-blue-800 uppercase tracking-wide">Documentación del estado estético</p>
                  <p className="text-[10px] text-blue-600 mt-1">Aparecerá en el resguardo del cliente para evitar reclamaciones posteriores.</p>
                </div>
              </div>

              {([
                { field: 'pantalla', label: 'Pantalla', options: [
                  { value: 'perfecto', label: 'Perfecto' }, { value: 'rayado', label: 'Rayado' },
                  { value: 'roto', label: 'Roto' }, { value: 'na', label: 'N/A' },
                ] as const },
                { field: 'carcasa', label: 'Carcasa / Chasis', options: [
                  { value: 'perfecto', label: 'Perfecto' }, { value: 'rayado', label: 'Rayado' },
                  { value: 'golpes', label: 'Golpes' }, { value: 'roto', label: 'Roto' },
                ] as const },
                { field: 'botones', label: 'Botones', options: [
                  { value: 'perfecto', label: 'Perfecto' }, { value: 'fallo-parcial', label: 'Fallo parcial' },
                  { value: 'no-funciona', label: 'No funciona' },
                ] as const },
                { field: 'puertos', label: 'Puertos / Conectores', options: [
                  { value: 'perfecto', label: 'Perfecto' }, { value: 'dano-visible', label: 'Daño visible' },
                  { value: 'no-funciona', label: 'No funciona' },
                ] as const },
              ] as const).map(({ field, label, options }) => (
                <div key={field} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                  <BtnGroup value={estético?.[field] as string | undefined} options={options} onChange={v => setEst(field, v)}/>
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observaciones Estéticas</label>
                <textarea rows={3} placeholder="Arañazos adicionales, daños preexistentes no listados arriba..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none" value={estético?.observaciones || ''} onChange={e => setEst('observaciones', e.target.value)}/>
              </div>

              {hasEstético && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-3">✅ Resumen del estado documentado</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Pantalla', estético?.pantalla],
                      ['Carcasa', estético?.carcasa],
                      ['Botones', estético?.botones],
                      ['Puertos', estético?.puertos],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="flex items-center gap-2">
                        <span className="text-[9px] text-emerald-600 font-bold uppercase w-16 shrink-0">{lbl}:</span>
                        <span className="text-[10px] font-black text-emerald-900 uppercase">{val || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {estético?.observaciones && <p className="text-[9px] text-emerald-700 mt-2 font-medium">{estético.observaciones}</p>}
                </div>
              )}
            </div>
          )}

          {/* ════════════ FOTOS ════════════ */}
          {activeTab === 'fotos' && (
            <div className="space-y-6">
              {pendingPhoto ? (
                /* Pending photo confirmation */
                <div className="border-2 border-blue-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Confirmar foto</span>
                    <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{photos.length}/10</span>
                  </div>
                  <div className="p-5 space-y-4">
                    <img src={pendingPhoto.dataUrl} alt="Preview" className="w-full max-h-60 object-contain rounded-xl border border-slate-100"/>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                        <div className="flex gap-2">
                          {(['entrada', 'diagnostico', 'salida'] as const).map(t => (
                            <button key={t} type="button"
                              onClick={() => setPendingPhoto(p => p ? { ...p, tipo: t } : null)}
                              className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${pendingPhoto.tipo === t ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                              style={pendingPhoto.tipo === t ? { background: TIPO_COLOR[t] } : {}}>
                              {TIPO_LABEL[t]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción (opcional)</label>
                        <input type="text" placeholder="Ej: Pantalla rota lado derecho" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none" value={pendingPhoto.caption} onChange={e => setPendingPhoto(p => p ? { ...p, caption: e.target.value } : null)}/>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setPendingPhoto(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                        Cancelar
                      </button>
                      <button type="button" onClick={confirmUpload} disabled={uploadingPhoto || photos.length >= 10}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all">
                        {uploadingPhoto ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                        {uploadingPhoto ? 'Subiendo a Firebase...' : 'Confirmar y Subir'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Header + tipo por defecto */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Camera size={14}/> Fotos ({photos.length}/10)
                      </h3>
                      <p className="text-[9px] text-slate-400 mt-1">Las fotos se guardan en Firebase Storage</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo al añadir</p>
                      <div className="flex gap-1">
                        {(['entrada', 'diagnostico', 'salida'] as const).map(t => (
                          <button key={t} type="button" onClick={() => setDefaultTipo(t)}
                            className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${defaultTipo === t ? 'text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                            style={defaultTipo === t ? { background: TIPO_COLOR[t] } : {}}>
                            {TIPO_LABEL[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Upload buttons */}
                  {photos.length < 10 && (
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => cameraRef.current?.click()}
                        className="flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all active:scale-95">
                        <Camera size={16}/> Tomar Foto
                      </button>
                      <button type="button" onClick={() => galleryRef.current?.click()}
                        className="flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all active:scale-95">
                        <Image size={16}/> Subir Imagen
                      </button>
                    </div>
                  )}

                  {/* Gallery */}
                  {photos.length === 0 ? (
                    <div className="py-16 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-4 text-slate-300">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center"><Image size={28}/></div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest">Sin fotos</p>
                        <p className="text-[9px] font-bold mt-1">Máximo 10 fotos por reparación</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {photos.map((photo, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                          <div className="aspect-square">
                            <img src={photo.url} alt={photo.caption || `Foto ${idx+1}`} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setPhotoPreview(photo.url)}/>
                          </div>
                          <div className="absolute top-1.5 left-1.5">
                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ background: TIPO_COLOR[photo.tipo] }}>
                              {TIPO_LABEL[photo.tipo]}
                            </span>
                          </div>
                          <button type="button" onClick={() => removePhoto(idx)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                            <Trash2 size={11}/>
                          </button>
                          {photo.caption && (
                            <div className="px-2 py-1 bg-white border-t border-slate-100">
                              <p className="text-[8px] text-slate-500 font-medium truncate">{photo.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {photos.length < 10 && (
                        <button type="button" onClick={() => galleryRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-blue-300 hover:text-blue-500 transition-all">
                          <Plus size={24}/><span className="text-[8px] font-black uppercase mt-1">Añadir</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════ DIAGNÓSTICO ════════════ */}
          {activeTab === 'diagnostico' && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                <ClipboardCheck size={20} className="text-purple-600 mt-0.5 shrink-0"/>
                <div>
                  <p className="text-[11px] font-black text-purple-800 uppercase tracking-wide">Informe Técnico de Diagnóstico</p>
                  <p className="text-[10px] text-purple-600 mt-1">Documentación interna del proceso técnico de reparación.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { field: 'problema',          label: 'Problema detectado',  ph: 'Descripción técnica del fallo encontrado...' },
                  { field: 'causaRaiz',          label: 'Causa raíz',          ph: 'Motivo principal del fallo...' },
                  { field: 'solucionAplicada',   label: 'Solución aplicada',   ph: 'Procedimiento técnico realizado...' },
                  { field: 'piezasSustituidas',  label: 'Piezas sustituidas',  ph: 'Referencias de componentes reemplazados...' },
                ].map(({ field, label, ph }) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                    <textarea rows={3} placeholder={ph} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none resize-none"
                      value={(diag as Record<string, string> | undefined)?.[field] || ''}
                      onChange={e => setDiag(field, e.target.value)}/>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observaciones Técnicas</label>
                <textarea rows={2} placeholder="Notas adicionales del técnico..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none resize-none" value={diag?.observaciones || ''} onChange={e => setDiag('observaciones', e.target.value)}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nivel de Dificultad</label>
                  <div className="flex gap-2">
                    {DIFICULTAD.map(({ value, label, color }) => (
                      <button key={value} type="button" onClick={() => setDiag('nivelDificultad', value)}
                        className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${diag?.nivelDificultad === value ? 'text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        style={diag?.nivelDificultad === value ? { background: color } : {}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiempo real (h)</label>
                  <input type="number" min="0" step="0.5" placeholder="0.0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-center"
                    value={diag?.tiempoEstimado || ''} onChange={e => setDiag('tiempoEstimado', parseFloat(e.target.value) || 0)}/>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Técnico Responsable</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                  value={diag?.tecnico || formData.technician || ''} onChange={e => setDiag('tecnico', e.target.value)}>
                  <option value="">Sin asignar</option>
                  {settings?.technicians?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Acciones siempre visibles ── */}
        <div className="flex gap-4 px-8 md:px-10 py-5 border-t border-slate-100 bg-white shrink-0">
          <button type="button" onClick={onCancel} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-50">Cancelar</button>
          <button type="submit" disabled={isSubmitting}
            className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all ${isDomicilio ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200' : 'bg-slate-900 text-white hover:bg-black'}`}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
            {initialData ? 'Actualizar Ficha' : isDomicilio ? 'Registrar Domicilio' : 'Registrar Reparación'}
          </button>
        </div>
      </form>

      {/* Photo fullscreen */}
      {photoPreview && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full"><X size={24}/></button>
          <img src={photoPreview} alt="" className="max-w-full max-h-[85vh] rounded-2xl object-contain"/>
        </div>
      )}
    </div>
  );
};

export default RepairForm;
