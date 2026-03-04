
import React from 'react';
import { Printer, Tag, Trash2, Info, ArrowLeft } from 'lucide-react';
import { RepairItem, AppSettings } from '../types';

interface LabelGridViewProps {
  repairs: RepairItem[];
  settings: AppSettings;
  onRemove: (id: string) => void;
  onPrintAll: () => void;
  onBack: () => void;
}

const LabelGridView: React.FC<LabelGridViewProps> = ({ repairs, settings, onRemove, onPrintAll, onBack }) => {
  const formatRMA = (num: number, prefix?: string) => `${prefix || 'A'}-${num.toString().padStart(5, '0')}`;

  if (repairs.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center animate-in fade-in duration-500">
        <div className="flex justify-start mb-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 bg-slate-50 text-slate-600 rounded-full"><ArrowLeft size={20} /></button>
        </div>
        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Tag size={40} className="text-slate-300" /></div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No hay etiquetas seleccionadas</h2>
        <p className="text-slate-500 text-sm">Selecciona reparaciones en el listado para imprimir sus etiquetas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 bg-slate-100 text-slate-600 rounded-full"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Impresión Térmica en Lote</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">
              <Info size={16} className="text-blue-500" /> {repairs.length} etiquetas optimizadas para 80mm
            </p>
          </div>
        </div>
        <button 
          onClick={onPrintAll} 
          className="px-8 py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl flex items-center gap-3 transition-all shadow-xl shadow-slate-900/20 uppercase tracking-widest text-xs"
        >
          <Printer size={20} /> Imprimir Lote
        </button>
      </header>

      {/* Grid de previsualización (No se imprime) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
        {repairs.map((repair) => (
          <div key={repair.id} className="group relative bg-white border-2 border-slate-100 rounded-[2rem] p-8 hover:border-blue-300 transition-all shadow-sm">
            <button 
              onClick={() => onRemove(repair.id)} 
              className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Quitar de la lista"
            >
              <Trash2 size={18} />
            </button>
            <div className="border-b-2 border-slate-50 pb-6 mb-6">
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{formatRMA(repair.rmaNumber, repair.rmaPrefix)}</span>
              <h3 className="font-black text-slate-900 truncate text-xl mt-3 tracking-tight uppercase leading-tight">{repair.brand} {repair.model}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                {repair.customerName}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contenedor de impresión real (Optimizado para rollo continuo) */}
      <div className="print-only">
        {repairs.map((repair) => (
          <div key={`print-${repair.id}`} className="w-[80mm] m-0 p-1 text-black font-sans bg-white break-inside-avoid border-b-4 border-dashed border-black pb-8">
             {/* Reutilización del estilo compacto */}
             <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2">
                <p className="text-[10px] font-black uppercase text-black">{settings.appName}</p>
                <p className="text-[20px] font-black text-black">{formatRMA(repair.rmaNumber, repair.rmaPrefix)}</p>
             </div>
             
             <div className="mb-2">
                <p className="text-[11px] font-black uppercase text-black">{repair.deviceType}</p>
                <h2 className="text-[16px] font-black uppercase text-black leading-tight">
                  {repair.brand} {repair.model}
                </h2>
             </div>

             <div className="py-1 border-y border-black mb-2">
                <p className="text-[12px] font-black uppercase italic text-black leading-tight">
                  {repair.problemDescription}
                </p>
             </div>

             <div className="flex justify-between text-[10px] font-bold text-black uppercase">
                <span>{repair.customerName}</span>
                <span>{repair.entryDate}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LabelGridView;
