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

  const printBudget = () => {
    const pSubtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) + laborItems.reduce((s, i) => s + i.hours * i.hourlyRate, 0);
    const pTaxAmount = Math.round(pSubtotal * (tax / 100) * 100) / 100;
    const pTotal = Math.round((pSubtotal + pTaxAmount) * 100) / 100;
    const allRows = [
      ...items.map(i => `<tr><td style="padding:10px 16px;font-weight:700;text-transform:uppercase;font-size:11px">${i.description}</td><td style="padding:10px 16px;text-align:center;color:#94a3b8;font-size:11px">${i.quantity}</td><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:11px">${(i.quantity * i.unitPrice).toFixed(2)}€</td></tr>`),
      ...laborItems.map(i => `<tr><td style="padding:10px 16px;font-weight:700;text-transform:uppercase;font-size:11px">${i.description} (M.O.)</td><td style="padding:10px 16px;text-align:center;color:#94a3b8;font-size:11px">${i.hours}h</td><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:11px">${(i.hours * i.hourlyRate).toFixed(2)}€</td></tr>`)
    ].join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto ${formatRMA(repair.rmaNumber)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#fff;color:#000;width:210mm;padding:14mm}
@page{size:A4 portrait;margin:0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:20px}
.shop-name{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em}
.shop-info{font-size:10px;color:#555;margin-top:4px;line-height:1.8}
.rma{font-size:28px;font-weight:900;text-align:right}
.rma-label{font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.info-box{padding:16px;background:#f8fafc;border-radius:12px}
.info-label{font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px}
.info-val{font-size:13px;font-weight:900;text-transform:uppercase}
.info-sub{font-size:10px;font-weight:600;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead tr{background:#0f172a;color:#fff}
thead th{padding:8px 16px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em}
thead th:first-child{border-radius:8px 0 0 8px;text-align:left}
thead th:last-child{border-radius:0 8px 8px 0;text-align:right}
tbody tr{border-bottom:1px solid #f1f5f9}
.totals{display:flex;justify-content:flex-end;margin-top:20px}
.totals-box{background:#f8fafc;padding:20px;border-radius:12px;min-width:260px}
.total-row{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px}
.total-final{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid #e2e8f0;padding-top:10px;margin-top:8px}
.total-label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em}
.total-amount{font-size:28px;font-weight:900}
.sig-box{width:180px;height:70px;border-bottom:1px solid #ccc;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sig-box img{max-height:100%;mix-blend-mode:multiply}
.footer{margin-top:40px;font-size:8px;font-weight:600;color:#94a3b8;text-align:justify;text-transform:uppercase;line-height:1.5}
</style></head><body>
<div class="header">
  <div>
    <div class="shop-name">${settings.appName}</div>
    <div class="shop-info">${settings.taxId || ''} ${settings.phone ? '| ' + settings.phone : ''}<br>${settings.address || ''}</div>
  </div>
  <div style="text-align:right">
    <div class="rma-label">Presupuesto Técnico</div>
    <div class="rma">${formatRMA(repair.rmaNumber)}</div>
    <div style="font-size:10px;font-weight:600;color:#64748b;margin-top:4px">Fecha: ${new Date().toLocaleDateString('es-ES')}</div>
  </div>
</div>
<div class="grid2">
  <div class="info-box">
    <div class="info-label">Cliente</div>
    <div class="info-val">${repair.customerName}</div>
    <div class="info-sub">${repair.customerPhone}</div>
  </div>
  <div class="info-box">
    <div class="info-label">Equipo</div>
    <div class="info-val">${repair.brand} ${repair.model}</div>
    <div class="info-sub">${repair.deviceType}</div>
  </div>
</div>
<table>
  <thead><tr><th>Descripción</th><th style="text-align:center;width:70px">Cant</th><th style="text-align:right;width:100px">Subtotal</th></tr></thead>
  <tbody>${allRows}</tbody>
</table>
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <div style="text-align:center">
    <div class="sig-box">${signature ? `<img src="${signature}" />` : ''}</div>
    <div style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;margin-top:8px">Aceptación del Cliente</div>
  </div>
  <div class="totals-box">
    <div class="total-row"><span>Subtotal</span><span>${pSubtotal.toFixed(2)}€</span></div>
    <div class="total-row"><span>IVA (${tax}%)</span><span>${pTaxAmount.toFixed(2)}€</span></div>
    <div class="total-final"><span class="total-label">Total</span><span class="total-amount">${pTotal.toFixed(2)}€</span></div>
  </div>
</div>
<div class="footer">${settings.letterhead || 'Garantía de 3 meses en reparaciones según legislación vigente. Este presupuesto es meramente informativo y tiene una validez limitada.'}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=850,height=1100');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { try { win.print(); } catch(e) {} }, 800);
      return;
    }
    // Fallback: iframe
    const id = 'print-frame-budget';
    let iframe = document.getElementById(id) as HTMLIFrameElement;
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch(e) {}
      setTimeout(() => iframe.remove(), 3000);
    }, 800);
  };

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
          <div className="py-4 px-2 space-y-3">
             <SignaturePad onSave={setSignature} initialValue={signature} label="Firma de conformidad del presupuesto" />
             <button onClick={() => setActiveTab('resumen')} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all">
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
               <button onClick={printBudget} className="px-8 py-4 bg-slate-900 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-black transition-all">
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