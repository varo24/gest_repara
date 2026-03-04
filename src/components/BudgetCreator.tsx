import React, { useState } from 'react';
import { 
  Plus as PlusIcon, 
  Trash2 as TrashIcon, 
  Printer as PrinterIcon, 
  X as XIcon, 
  Package as PackageIcon, 
  Clock as ClockIcon, 
  FileText as FileTextIcon, 
  ArrowLeft as ArrowLeftIcon,
  CheckCircle2,
  PenTool,
  Save,
  Building2,
  AlertCircle
} from 'lucide-react';
import { RepairItem, BudgetItem, LaborItem, Budget, AppSettings } from '../types';
import SignaturePad from './SignaturePad';

interface BudgetCreatorProps {
  repair: RepairItem;
  settings: AppSettings;
  initialBudget?: Budget;
  onSave: (budget: Budget) => void;
  onClose: () => void;
}

const BudgetCreator: React.FC<BudgetCreatorProps> = ({ repair, settings, initialBudget, onSave, onClose }) => {
  const [items, setItems] = useState<BudgetItem[]>(initialBudget?.items || []);
  const [laborItems, setLaborItems] = useState<LaborItem[]>(initialBudget?.laborItems || []);
  const [signature, setSignature] = useState(initialBudget?.signature || '');
  const [tax, setTax] = useState(initialBudget?.taxRate || settings.taxRate || 21);
  const [activeTab, setActiveTab] = useState<'repuestos' | 'mano-obra' | 'firma' | 'resumen'>(initialBudget?.id ? 'resumen' : 'repuestos');
  const [isSaving, setIsSaving] = useState(false);

  const formatRMA = (num: number) => `RMA-${num.toString().padStart(5, '0')}`;

  const addPiece = () => {
    const newItem: BudgetItem = { id: crypto.randomUUID(), repairId: repair.id, description: '', quantity: 1, unitPrice: 0 };
    setItems([...items, newItem]);
  };

  const addLabor = () => {
    const newItem: LaborItem = { id: crypto.randomUUID(), description: 'Intervención técnica básica', hours: 1, hourlyRate: settings.hourlyRate || 45 };
    setLaborItems([...laborItems, newItem]);
  };

  const updatePiece = (id: string, field: keyof BudgetItem, value: any) => setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  const updateLabor = (id: string, field: keyof LaborItem, value: any) => setLaborItems(laborItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  const removePiece = (id: string) => setItems(items.filter(i => i.id !== id));
  const removeLabor = (id: string) => setLaborItems(laborItems.filter(i => i.id !== id));

  const subtotalPieces = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const subtotalLabor = laborItems.reduce((acc, item) => acc + (item.hours * item.hourlyRate), 0);
  const subtotal = Math.round((subtotalPieces + subtotalLabor) * 100) / 100;
  const taxAmount = Math.round((subtotal * (tax / 100)) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const budget: Budget = {
        id: initialBudget?.id || crypto.randomUUID(),
        repairId: repair.id,
        rmaNumber: repair.rmaNumber,
        items,
        laborItems,
        taxRate: tax,
        total,
        signature,
        date: initialBudget?.date || new Date().toISOString().split('T')[0]
      };
      onSave(budget);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-w-5xl mx-auto print:shadow-none print:border-none print:p-0 mb-20">
      
      <div className="bg-slate-900 text-white p-6 flex justify-between items-center no-print">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
            <ArrowLeftIcon size={20} />
          </button>
          <h2 className="text-lg font-black uppercase tracking-tight">Presupuesto Técnico {formatRMA(repair.rmaNumber)}</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
             <p className="text-[9px] font-black text-slate-500 uppercase">Total Estimado</p>
             <p className="text-xl font-black text-blue-400">{total.toFixed(2)}€</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl"><XIcon size={20} /></button>
        </div>
      </div>

      <div className="flex border-b border-slate-100 no-print bg-slate-50">
        {[
          { id: 'repuestos', label: 'Repuestos', icon: PackageIcon },
          { id: 'mano-obra', label: 'Servicios', icon: ClockIcon },
          { id: 'firma', label: 'Conformidad', icon: PenTool },
          { id: 'resumen', label: 'Vista Previa', icon: FileTextIcon }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all relative ${
              activeTab === tab.id ? 'text-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600" />}
          </button>
        ))}
      </div>

      <div className="p-8">
        {activeTab === 'repuestos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black uppercase text-slate-800">Materiales y Repuestos</h3>
              <button onClick={addPiece} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center gap-2">
                <PlusIcon size={14} /> Añadir Artículo
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex-1">
                    <input type="text" placeholder="Descripción del repuesto..." className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" value={item.description} onChange={(e) => updatePiece(item.id, 'description', e.target.value)} />
                  </div>
                  <div className="w-20">
                    <input type="number" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-center" value={item.quantity} onChange={(e) => updatePiece(item.id, 'quantity', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="w-28">
                    <input type="number" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right" value={item.unitPrice} onChange={(e) => updatePiece(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  </div>
                  <button onClick={() => removePiece(item.id)} className="p-2 text-red-400 hover:text-red-600"><TrashIcon size={16} /></button>
                </div>
              ))}
              {items.length === 0 && <p className="text-center py-10 text-[10px] text-slate-400 font-black uppercase tracking-widest italic">No hay repuestos añadidos</p>}
            </div>
          </div>
        )}

        {activeTab === 'mano-obra' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black uppercase text-slate-800">Servicios y Mano de Obra</h3>
              <button onClick={addLabor} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black flex items-center gap-2">
                <PlusIcon size={14} /> Añadir Servicio
              </button>
            </div>

            <div className="space-y-3">
              {laborItems.map(item => (
                <div key={item.id} className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex-1">
                    <input type="text" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" value={item.description} onChange={(e) => updateLabor(item.id, 'description', e.target.value)} />
                  </div>
                  <div className="w-20">
                    <input type="number" step="0.5" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-center" value={item.hours} onChange={(e) => updateLabor(item.id, 'hours', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="w-28">
                    <input type="number" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right" value={item.hourlyRate} onChange={(e) => updateLabor(item.id, 'hourlyRate', parseFloat(e.target.value) || 0)} />
                  </div>
                  <button onClick={() => removeLabor(item.id)} className="p-2 text-red-400 hover:text-red-600"><TrashIcon size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'firma' && (
          <div className="w-full flex flex-col py-2 px-1" style={{ minHeight: 'calc(100vh - 280px)' }}>
             <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-center mb-2 shrink-0">
               <h3 className="text-sm font-black uppercase text-blue-900">Firma de Conformidad</h3>
               <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Digitalice la aceptación del cliente</p>
             </div>
             <div className="bg-slate-50 p-1 rounded-2xl border border-slate-200 flex-1 flex items-center justify-center" style={{ minHeight: '500px' }}>
               <div className="w-full h-full">
                 <SignaturePad onSave={setSignature} initialValue={signature} height="h-full" />
               </div>
             </div>
             <button onClick={() => setActiveTab('resumen')} className="w-full py-4 mt-2 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shrink-0">
                <CheckCircle2 size={16} /> Validar Datos
             </button>
          </div>
        )}

        {activeTab === 'resumen' && (
          <div className="space-y-8">
             <div className="bg-white p-12 border-2 border-slate-900 rounded-[2rem] print:border-none print:p-0">
               <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                  <div className="flex items-center gap-6">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} className="h-16 w-auto object-contain" />
                    ) : (
                      <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-3xl italic">R</div>
                    )}
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tight">{settings.appName}</h2>
                      <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">{settings.taxId} | {settings.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Presupuesto Técnico</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{formatRMA(repair.rmaNumber)}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Fecha: {new Date().toLocaleDateString('es-ES')}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="p-6 bg-slate-50 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                    <p className="text-sm font-black uppercase">{repair.customerName}</p>
                    <p className="text-[10px] font-bold text-slate-500">{repair.customerPhone}</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Equipo / Dispositivo</p>
                    <p className="text-sm font-black uppercase">{repair.brand} {repair.model}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{repair.deviceType}</p>
                  </div>
               </div>

               <table className="w-full mb-8">
                 <thead>
                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                      <th className="py-3 px-6 text-left rounded-l-lg">Descripción</th>
                      <th className="py-3 px-6 text-center w-20">Cant</th>
                      <th className="py-3 px-6 text-right w-28 rounded-r-lg">Subtotal</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {items.map(i => (
                      <tr key={i.id} className="text-[11px] uppercase font-bold text-slate-700">
                        <td className="py-4 px-6">{i.description}</td>
                        <td className="py-4 px-6 text-center text-slate-400">{i.quantity}</td>
                        <td className="py-4 px-6 text-right">{(i.quantity * i.unitPrice).toFixed(2)}€</td>
                      </tr>
                    ))}
                    {laborItems.map(i => (
                      <tr key={i.id} className="text-[11px] uppercase font-bold text-slate-700">
                        <td className="py-4 px-6">{i.description} (MANO DE OBRA)</td>
                        <td className="py-4 px-6 text-center text-slate-400">{i.hours}h</td>
                        <td className="py-4 px-6 text-right">{(i.hours * i.hourlyRate).toFixed(2)}€</td>
                      </tr>
                    ))}
                 </tbody>
               </table>

               <div className="flex justify-between items-end pt-8 border-t border-slate-100">
                 <div className="w-48 text-center space-y-2">
                   <div className="h-20 flex items-center justify-center border-b border-slate-200 overflow-hidden">
                     {signature && <img src={signature} className="max-h-full mix-blend-multiply" />}
                   </div>
                   <p className="text-[8px] font-black uppercase text-slate-400">Aceptación del Cliente</p>
                 </div>
                 <div className="text-right space-y-2 bg-slate-50 p-6 rounded-2xl min-w-[250px]">
                   <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>Subtotal</span> <span>{subtotal.toFixed(2)}€</span></div>
                   <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>IVA ({tax}%)</span> <span>{taxAmount.toFixed(2)}€</span></div>
                   <div className="h-px bg-slate-200 my-2" />
                   <div className="flex justify-between items-baseline">
                     <span className="text-[10px] font-black uppercase tracking-widest">Total Presupuesto</span>
                     <span className="text-3xl font-black">{total.toFixed(2)}€</span>
                   </div>
                 </div>
               </div>

               <div className="mt-12 text-[8px] font-bold text-slate-400 text-justify uppercase leading-tight">
                 {settings.letterhead || "Garantía de 3 meses en reparaciones según legislación vigente. Este presupuesto es meramente informativo y tiene una validez limitada."}
               </div>
             </div>

             <div className="flex gap-4 no-print">
               <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-blue-700 transition-all">
                 <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Presupuesto'}
               </button>
               <button onClick={() => window.print()} className="px-8 py-4 bg-slate-900 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-black transition-all">
                 <PrinterIcon size={18} /> Imprimir A4
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetCreator;