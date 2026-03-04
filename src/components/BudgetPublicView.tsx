
import React from 'react';
import { FileText, CheckCircle, XCircle, Printer, Phone, AlertCircle, Building2, Calendar, Hash, User } from 'lucide-react';
import { Budget, RepairItem, AppSettings, RepairStatus } from '../types';

interface BudgetPublicViewProps {
  budget: Budget;
  repair: RepairItem;
  settings: AppSettings;
}

const BudgetPublicView: React.FC<BudgetPublicViewProps> = ({ budget, repair, settings }) => {
  const handleAction = (type: 'accept' | 'reject') => {
    const url = new URL(window.location.href);
    url.searchParams.set('action', type);
    window.location.href = url.toString();
  };

  const formatRMA = (num: number) => `RMA-${num.toString().padStart(5, '0')}`;
  
  const subtotalPieces = budget.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const subtotalLabor = budget.laborItems.reduce((acc, item) => acc + (item.hours * item.hourlyRate), 0);
  const subtotal = subtotalPieces + subtotalLabor;
  const taxAmount = subtotal * (budget.taxRate / 100);

  const isAccepted = repair.status === RepairStatus.BUDGET_ACCEPTED;
  const isRejected = repair.status === RepairStatus.BUDGET_REJECTED;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-12 font-sans text-slate-900 print:bg-white print:p-0">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Barra de Herramientas Flotante */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center shadow-2xl no-print">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none">Visor de Documentos</p>
              <p className="text-sm font-bold mt-1">Presupuesto Técnico #{formatRMA(repair.rmaNumber)}</p>
            </div>
          </div>
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
          >
             <Printer size={18} /> Imprimir / Guardar PDF
          </button>
        </div>

        {/* Hoja de Presupuesto Real */}
        <div className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] overflow-hidden print:shadow-none print:rounded-none rounded-[2.5rem] relative">
          
          {/* Cabecera Profesional */}
          <div className="p-10 md:p-16 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="space-y-6 max-w-lg">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-xl">R</div>
              )}
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tighter leading-none">{settings.appName}</h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{settings.taxId}</p>
                <div className="pt-4 text-[11px] text-slate-500 font-medium leading-relaxed uppercase">
                  <p>{settings.address}</p>
                  <p className="flex items-center gap-2 mt-1">
                    <span className="text-blue-600 font-black">T:</span> {settings.phone} 
                    <span className="text-slate-200">|</span> 
                    <span className="text-blue-600 font-black">E:</span> {settings.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right space-y-4 w-full md:w-auto">
              <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2rem] inline-block min-w-[280px]">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-2">Presupuesto Oficial</p>
                <p className="text-5xl font-black tracking-tighter text-slate-950 leading-none mb-4">{formatRMA(repair.rmaNumber)}</p>
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                  <div className="flex justify-between gap-4"><span>FECHA EMISIÓN:</span> <span className="text-slate-900">{budget.date}</span></div>
                  <div className="flex justify-between gap-4"><span>VÁLIDO HASTA:</span> <span className="text-slate-900">15 DÍAS POST-EMISIÓN</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-10 md:p-16 space-y-12">
            
            {/* Bloque Info Cliente / Equipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><User size={14} /> Cliente Final</h3>
                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="text-xl font-black text-slate-900 uppercase leading-none">{repair.customerName}</p>
                  <p className="text-sm font-bold text-slate-500 mt-2">{repair.customerPhone}</p>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><Hash size={14} /> Identificación de Equipo</h3>
                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xl font-black text-slate-900 uppercase leading-none">{repair.brand} {repair.model}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{repair.deviceType}</p>
                    </div>
                    {repair.serialNumber && (
                       <span className="text-[9px] font-black bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-500">S/N: {repair.serialNumber}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de Conceptos */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalle de Intervención</h3>
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950 text-white">
                      <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest">Concepto Técnico</th>
                      <th className="py-5 px-8 text-center text-[10px] font-black uppercase tracking-widest w-24">Cant.</th>
                      <th className="py-5 px-8 text-right text-[10px] font-black uppercase tracking-widest w-32">Precio Un.</th>
                      <th className="py-5 px-8 text-right text-[10px] font-black uppercase tracking-widest w-32">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold uppercase text-xs">
                    {/* Sección Repuestos */}
                    {budget.items.length > 0 && (
                      <>
                        <tr className="bg-slate-50/50">
                          <td colSpan={4} className="py-3 px-8 text-[9px] font-black text-blue-600 tracking-widest">MATERIALES Y REPUESTOS</td>
                        </tr>
                        {budget.items.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-6 px-8 text-slate-800 leading-snug">{item.description}</td>
                            <td className="py-6 px-8 text-center text-slate-500">{item.quantity}</td>
                            <td className="py-6 px-8 text-right text-slate-500">{item.unitPrice.toFixed(2)}€</td>
                            <td className="py-6 px-8 text-right text-slate-950">{(item.quantity * item.unitPrice).toFixed(2)}€</td>
                          </tr>
                        ))}
                      </>
                    )}
                    
                    {/* Sección Mano de Obra */}
                    {budget.laborItems.length > 0 && (
                      <>
                        <tr className="bg-slate-50/50">
                          <td colSpan={4} className="py-3 px-8 text-[9px] font-black text-indigo-600 tracking-widest">MANO DE OBRA Y SERVICIOS TÉCNICOS</td>
                        </tr>
                        {budget.laborItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-6 px-8 text-slate-800 leading-snug">{item.description}</td>
                            <td className="py-6 px-8 text-center text-slate-500">{item.hours}h</td>
                            <td className="py-6 px-8 text-right text-slate-500">{item.hourlyRate.toFixed(2)}€/h</td>
                            <td className="py-6 px-8 text-right text-slate-950">{(item.hours * item.hourlyRate).toFixed(2)}€</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloque Financiero y Firmas */}
            <div className="flex flex-col xl:flex-row justify-between items-start gap-12 pt-8">
              
              {/* Bloque Legal y Notas */}
              <div className="flex-1 space-y-8 max-w-lg">
                <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2rem]">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-800 mb-4 flex items-center gap-2">
                    <AlertCircle size={14} /> Términos y Garantía
                  </h3>
                  <p className="text-[10px] text-blue-900 leading-relaxed font-bold uppercase text-justify">
                    {settings.letterhead || "Este presupuesto tiene una validez de 15 días naturales. Las piezas sustituidas estarán sujetas a la garantía del fabricante. La mano de obra tiene una garantía de 3 meses según normativa vigente."}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="text-center space-y-2">
                    <div className="h-24 border-b border-slate-200 flex items-center justify-center">
                       <p className="text-[8px] text-slate-300 font-black uppercase tracking-tighter transform -rotate-12 border border-slate-100 px-4 py-1">SELLO AUTORIZADO</p>
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Servicio Técnico</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="h-24 border-b border-slate-200 flex items-center justify-center overflow-hidden">
                       {budget.signature && <img src={budget.signature} className="max-h-full mix-blend-multiply scale-125" />}
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Aceptado por Cliente</p>
                  </div>
                </div>
              </div>

              {/* Bloque Totales */}
              <div className="w-full xl:w-[400px] space-y-4">
                <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm space-y-4">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase">
                    <span>Suma Base Imponible</span>
                    <span className="text-slate-900">{subtotal.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase">
                    <span>IVA Aplicado ({budget.taxRate}%)</span>
                    <span className="text-slate-900">{taxAmount.toFixed(2)}€</span>
                  </div>
                  <div className="h-px bg-slate-100 my-4" />
                  <div className="bg-slate-950 text-white p-8 rounded-[2rem] text-center shadow-xl transform translate-x-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-2">Total Presupuestado</p>
                    <p className="text-6xl font-black tracking-tighter leading-none">{budget.total.toFixed(2)}€</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de Documento */}
            <div className="pt-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-[8px] font-black text-slate-300 uppercase tracking-widest">
              <p>Generado por ReparaPro Master Terminal - Software Profesional de Taller</p>
              <p>ID DOC: {budget.id.toUpperCase()}</p>
            </div>
          </div>

          {/* Acciones para el Cliente (No se imprimen) */}
          {(!isAccepted && !isRejected) && (
            <div className="bg-slate-950 p-10 md:p-16 text-center no-print">
              <div className="max-w-2xl mx-auto space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Gestión del Presupuesto</h3>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Puede aceptar o rechazar esta valoración online</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-6">
                  <button 
                    onClick={() => handleAction('accept')} 
                    className="flex-1 py-8 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95"
                  >
                    <CheckCircle size={28} /> Aceptar Presupuesto
                  </button>
                  <button 
                    onClick={() => handleAction('reject')} 
                    className="flex-1 py-8 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-4 transition-all active:scale-95"
                  >
                    <XCircle size={28} /> Rechazar Valoración
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center py-10 no-print">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Documento Oficial con Validez Legal</p>
        </footer>
      </div>
    </div>
  );
};

export default BudgetPublicView;
