import React from 'react';
import { RepairItem, AppSettings } from '../types';
import { Smartphone, User, Wrench, Clock, ShieldCheck, MapPin, Phone } from 'lucide-react';

interface LabelPrintViewProps {
  repair: RepairItem;
  settings: AppSettings;
}

const LabelPrintView: React.FC<LabelPrintViewProps> = ({ repair, settings }) => {
  const formatRMA = (num: number, prefix?: string) => `${prefix || 'A'}-${num.toString().padStart(5, '0')}`;
  const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div className="thermal-mode bg-white text-black font-sans leading-none flex flex-col h-full border-0 overflow-hidden px-1 py-1" style={{ width: '80mm', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      
      {/* 1. CABECERA CORPORATIVA (NUEVA) */}
      <div className="flex items-center gap-3 mb-3 border-b-2 border-black pb-3">
        {settings.logoUrl ? (
          <img 
            src={settings.logoUrl} 
            className="h-10 w-10 object-contain grayscale" 
            style={{ filter: 'contrast(1.5) brightness(0.8)' }}
          />
        ) : (
          <div className="w-10 h-10 bg-black rounded flex items-center justify-center text-white font-black text-xl italic shrink-0">
            {settings.appName.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[11px] font-black uppercase tracking-tight truncate">{settings.appName}</h1>
          <p className="text-[6px] font-bold text-gray-600 flex items-center gap-1 mt-0.5">
            <MapPin size={6} /> {settings.address.split(',')[0]}
          </p>
          <p className="text-[6px] font-bold text-gray-600 flex items-center gap-1">
            <Phone size={6} /> {settings.phone}
          </p>
        </div>
        <div className="bg-black text-white px-3 py-2 rounded-lg text-right shadow-md">
          <p className="text-[6px] font-black uppercase tracking-[0.2em] opacity-70">RMA</p>
          <p className="text-[18px] font-black tracking-tighter leading-none">{formatRMA(repair.rmaNumber, repair.rmaPrefix)}</p>
        </div>
      </div>

      {/* 2. IDENTIFICACIÓN TÉCNICA DEL EQUIPO */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1.5">
            <Smartphone size={10} strokeWidth={3} />
            <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-0.5 rounded">
              {repair.deviceType}
            </span>
          </div>
          <p className="text-[8px] font-black bg-gray-200 px-2 py-0.5 rounded uppercase">{dateStr}</p>
        </div>
        <h2 className="text-[15px] font-black uppercase leading-tight truncate mt-1">
          {repair.brand} {repair.model}
        </h2>
        {repair.serialNumber && (
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 w-1 bg-black"></div>
            <p className="text-[8px] font-bold text-gray-700 tracking-widest">S/N: {repair.serialNumber.toUpperCase()}</p>
          </div>
        )}
      </div>

      {/* 3. DIAGNÓSTICO DE ENTRADA (MÁXIMA VISIBILIDAD) */}
      <div className="flex-1 border-2 border-black p-3 rounded-xl bg-gray-50 mb-4 overflow-hidden relative">
        <p className="text-[7px] font-black uppercase text-gray-500 mb-2 flex items-center gap-1.5">
          <Wrench size={8} className="text-black" /> SÍNTOMAS Y AVERÍA:
        </p>
        <p className="text-[12px] font-black uppercase leading-[1.3] italic text-justify">
          "{repair.problemDescription || "SIN DESCRIPCIÓN TÉCNICA"}"
        </p>
        {/* Decorativo técnico tipo código de barras */}
        <div className="absolute right-2 top-2 opacity-10 flex gap-0.5">
          {[1,3,1,2,4,1,3].map((w, i) => <div key={i} className="bg-black h-4" style={{ width: `${w}px` }}></div>)}
        </div>
      </div>

      {/* 4. PROTOCOLO DE REPARACIÓN (CHECKLIST) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 py-3 border-y-2 border-dashed border-gray-400">
        {[
          'Diagnóstico', 'Presupuesto', 'Intervención', 'Control OK'
        ].map(task => (
          <div key={task} className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-black rounded flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-gray-100 rounded-sm"></div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight">{task}</span>
          </div>
        ))}
      </div>

      {/* 5. TITULAR Y CONTACTO */}
      <div className="flex justify-between items-end border-t-2 border-black pt-3 mb-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-gray-400">
            <User size={8} strokeWidth={3} />
            <p className="text-[7px] font-black uppercase">CLIENTE</p>
          </div>
          <p className="text-[12px] font-black uppercase truncate max-w-[50mm] leading-none">{repair.customerName}</p>
          <p className="text-[10px] font-bold text-gray-800 tracking-tight">{repair.customerPhone}</p>
        </div>
        <div className="text-right flex flex-col items-end">
           <div className="flex items-center gap-1 text-black mb-1">
              <Clock size={8} strokeWidth={3} />
              <span className="text-[7px] font-black uppercase tracking-widest">NORMAL</span>
           </div>
           <p className="text-[8px] font-black bg-black text-white px-2 py-1 rounded uppercase leading-none">
             {repair.status.toUpperCase().slice(0, 15)}
           </p>
        </div>
      </div>

      {/* 6. PIE DE CONTROL Y SEGURIDAD */}
      <div className="mt-4 pt-2 flex justify-between items-center opacity-60 border-t border-dotted border-black">
        <div className="flex items-center gap-2">
          <ShieldCheck size={10} className="text-black" />
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">{settings.appName}</span>
        </div>
        <span className="text-[6px] font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">ID: {repair.id.toUpperCase().slice(0,12)}</span>
      </div>
    </div>
  );
};

export default LabelPrintView;