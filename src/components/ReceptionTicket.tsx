import React from 'react';
import { RepairItem, AppSettings } from '../types';
import { 
  User, Smartphone, MapPin, Phone, 
  Calendar, Clock, ClipboardCheck, 
  Wrench, ShieldCheck, Info, FileText,
  PenTool, Building, Hash, Printer
} from 'lucide-react';

interface ReceptionTicketProps {
  repair: RepairItem;
  settings: AppSettings;
}

const ReceptionTicket: React.FC<ReceptionTicketProps> = ({ repair, settings }) => {
  const formatRMA = (num: number) => `RMA-${num.toString().padStart(5, '0')}`;
  const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col bg-white text-slate-900 font-sans p-2 overflow-hidden" style={{ width: '190mm', height: '277mm', margin: 'auto' }}>
      
      {/* 1. ENCABEZADO CORPORATIVO PREMIUM */}
      <header className="flex justify-between items-start mb-8 border-b-4 border-slate-950 pb-8">
        <div className="flex items-center gap-8">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
          ) : (
            <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-white font-black text-3xl italic shadow-xl">
              {settings.appName.charAt(0)}
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-950 leading-none">{settings.appName}</h1>
            <div className="flex flex-col text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-950" /> {settings.address}</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2"><Phone size={12} className="text-slate-950" /> {settings.phone}</span>
                <span className="text-slate-200">|</span>
                <span className="flex items-center gap-2"><Building size={12} className="text-slate-950" /> NIF: {settings.taxId}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="bg-slate-950 text-white px-8 py-4 rounded-2xl inline-block shadow-2xl">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Nº ORDEN DE TRABAJO</p>
             <p className="text-4xl font-black tracking-tighter leading-none">{formatRMA(repair.rmaNumber)}</p>
          </div>
          <p className="text-[11px] font-black text-slate-400 uppercase mt-4 tracking-[0.4em]">RESGUARDO DE DEPÓSITO OFICIAL</p>
        </div>
      </header>

      {/* 2. BARRA TÉCNICA DE METADATOS */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { icon: Calendar, label: 'Fecha Recepción', value: dateStr },
          { icon: Clock, label: 'Hora Registro', value: timeStr },
          { icon: ClipboardCheck, label: 'Estado Inicial', value: repair.status },
          { icon: User, label: 'Gestor Recepción', value: repair.technician || 'Central' }
        ].map((item, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
              <item.icon size={10} className="text-slate-950" /> {item.label}
            </p>
            <p className="text-[11px] font-black uppercase text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>

      {/* 3. INFORMACIÓN DEL TITULAR Y DEL EQUIPO */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-2">
            <User size={14} className="text-slate-950" /> Identificación del Titular
          </h3>
          <div className="p-6 border-2 border-slate-100 rounded-3xl bg-slate-50/30">
            <p className="text-2xl font-black text-slate-950 uppercase tracking-tight leading-none mb-2">{repair.customerName}</p>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black bg-slate-950 text-white px-2 py-0.5 rounded uppercase">Contacto</span>
              <p className="text-sm font-bold text-slate-600">{repair.customerPhone}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-2">
            <Smartphone size={14} className="text-slate-950" /> Especificaciones del Equipo
          </h3>
          <div className="p-6 border-2 border-slate-100 rounded-3xl bg-slate-50/30">
            <p className="text-2xl font-black text-slate-950 uppercase tracking-tight leading-none mb-2">{repair.brand} {repair.model}</p>
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-black bg-white border border-slate-200 px-3 py-1 rounded-xl uppercase text-slate-500">
                 {repair.deviceType}
               </span>
               {repair.serialNumber && (
                 <p className="text-[10px] font-bold text-slate-400 uppercase">S/N: <span className="text-slate-950 font-black">{repair.serialNumber.toUpperCase()}</span></p>
               )}
            </div>
          </div>
        </section>
      </div>

      {/* 4. INFORME DE RECEPCIÓN Y DIAGNÓSTICO */}
      <div className="flex-1 flex flex-col mb-8 min-h-0">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 flex items-center gap-2 px-2">
          <Wrench size={14} className="text-slate-950" /> Informe Técnico y Avería Reportada
        </h3>
        <div className="flex-1 border-4 border-slate-950 p-10 rounded-[3rem] bg-white relative flex flex-col shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
          <div className="text-xl font-bold text-slate-950 uppercase leading-relaxed italic text-justify">
            {repair.problemDescription || "No se ha proporcionado una descripción detallada de la avería."}
          </div>
          
          {repair.notes && (
            <div className="mt-auto pt-8 border-t-2 border-dashed border-slate-100">
              <span className="text-[9px] font-black uppercase text-slate-400 block mb-3 tracking-widest">Observaciones y Accesorios entregados:</span>
              <p className="text-sm font-bold text-slate-600 uppercase italic leading-tight p-4 bg-slate-50 rounded-2xl inline-block">{repair.notes}</p>
            </div>
          )}

          {/* Marca de agua sutil */}
          <div className="absolute -bottom-12 -right-12 opacity-[0.03] pointer-events-none rotate-12">
             <Hash size={300} />
          </div>
        </div>
      </div>

      {/* 5. CLÁUSULAS CONTRACTUALES */}
      <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-3xl">
        <div className="flex items-center gap-3 mb-3">
          <FileText size={14} className="text-slate-950" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Condiciones Generales del Servicio</h3>
        </div>
        <p className="text-[8.5px] font-bold text-slate-500 leading-relaxed text-justify uppercase">
          {settings.letterhead || "1. DEPÓSITO: El cliente entrega el equipo para diagnóstico. 2. PRESUPUESTO: Todo diagnóstico conlleva un coste si no se acepta la reparación. 3. DATOS: No nos responsabilizamos de la pérdida de información. 4. RETIRADA: Transcurridos 6 meses desde el aviso, el equipo pasará a ser propiedad del taller. 5. GARANTÍA: 3 meses en mano de obra según legislación. ES IMPRESCINDIBLE PRESENTAR ESTE RESGUARDO PARA RETIRAR EL EQUIPO."}
        </p>
      </div>

      {/* 6. BLOQUE DE FIRMAS Y VALIDACIÓN */}
      <div className="grid grid-cols-2 gap-12 mb-6">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-center">Conformidad del Cliente</p>
          <div className="h-32 border-2 border-slate-100 rounded-3xl bg-slate-50/20 flex items-center justify-center overflow-hidden">
             {repair.customerSignature ? (
               <img src={repair.customerSignature} className="max-h-full mix-blend-multiply opacity-90" alt="Firma Cliente" />
             ) : (
               <div className="flex flex-col items-center gap-2 opacity-20">
                 <PenTool size={32} />
                 <span className="text-[8px] font-black uppercase tracking-widest">Firma Digital Registrada</span>
               </div>
             )}
          </div>
          <p className="text-[8px] text-center text-slate-400 uppercase font-bold">Acepto los términos y condiciones del servicio</p>
        </div>
        
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-center">Sello y Firma del Comercio</p>
          <div className="h-32 border-2 border-slate-100 rounded-3xl bg-slate-50/20 flex flex-col items-center justify-center">
             <div className="text-center opacity-30">
               <ShieldCheck size={40} className="mx-auto text-slate-900" />
               <p className="text-[9px] font-black mt-2 tracking-widest uppercase">Validación de Recepción</p>
             </div>
          </div>
          <p className="text-[8px] text-center text-slate-400 uppercase font-bold">Documento generado electrónicamente</p>
        </div>
      </div>

      {/* 7. PIE DE PÁGINA PROFESIONAL */}
      <footer className="mt-auto border-t-4 border-slate-950 pt-6 flex justify-between items-end">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-slate-950 text-white rounded-2xl flex items-center justify-center shadow-lg">
             <Info size={24} />
           </div>
           <div>
             <p className="text-[11px] font-black uppercase text-slate-950 leading-none">Copia Oficial para el Cliente</p>
             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1.5 tracking-widest">Sistema ReparaPro Master Terminal v5.4.4 • {new Date().getFullYear()}</p>
           </div>
        </div>
        <div className="text-right">
           <p className="text-xl font-black text-slate-950 leading-none">{formatRMA(repair.rmaNumber)}</p>
           <div className="flex items-center gap-2 justify-end mt-1.5">
             <Printer size={10} className="text-slate-300" />
             <p className="text-[7px] font-mono font-bold text-slate-300 uppercase tracking-tighter">ID: {repair.id.toUpperCase()}</p>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default ReceptionTicket;