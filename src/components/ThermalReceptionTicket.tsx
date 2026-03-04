import React from 'react';
import { RepairItem, AppSettings } from '../types';

interface ThermalReceptionTicketProps {
  repair: RepairItem;
  settings: AppSettings;
}

const ThermalReceptionTicket: React.FC<ThermalReceptionTicketProps> = ({ repair, settings }) => {
  const formatRMA = (num: number, prefix?: string) => `${prefix || 'A'}-${num.toString().padStart(5, '0')}`;
  const dateStr = new Date().toLocaleDateString('es-ES');
  const timeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white text-black font-sans flex flex-col overflow-hidden" 
         style={{ 
            width: '80mm', 
            height: '120mm', 
            padding: '4mm', 
            boxSizing: 'border-box',
            backgroundColor: '#fff',
            color: '#000'
         }}>
      
      {/* CABECERA */}
      <div className="flex flex-col items-center text-center mb-1 border-b-2 border-black pb-1 shrink-0">
        <h1 className="text-[13px] font-[900] uppercase tracking-tighter leading-none" style={{ color: '#000' }}>{settings.appName}</h1>
        <p className="text-[8px] font-bold mt-1 uppercase leading-none truncate w-full" style={{ color: '#000' }}>{settings.address.split(',')[0]}</p>
        <p className="text-[9px] font-black mt-1 leading-none" style={{ color: '#000' }}>TEL: {settings.phone}</p>
      </div>

      {/* RMA BOX - RESALTADO */}
      <div className="bg-black text-white p-3 rounded-md text-center mb-1 shrink-0" 
           style={{ backgroundColor: '#000', color: '#fff' }}>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-0.5">NÚMERO DE ORDEN</p>
        <p className="text-[32px] font-[900] tracking-tighter leading-none">
          {formatRMA(repair.rmaNumber, repair.rmaPrefix)}
        </p>
      </div>

      <div className="flex justify-between mb-1 border-b border-black border-dashed pb-0.5 shrink-0">
        <p className="text-[10px] font-black" style={{ color: '#000' }}>FECHA: {dateStr}</p>
        <p className="text-[10px] font-black" style={{ color: '#000' }}>{timeStr}</p>
      </div>

      {/* DATOS EQUIPO Y CLIENTE */}
      <div className="mb-2 space-y-1.5 shrink-0 px-0.5 pt-1">
        <div>
          <p className="text-[7px] font-black uppercase leading-none opacity-60" style={{ color: '#000' }}>CLIENTE:</p>
          <p className="text-[12px] font-black uppercase leading-tight truncate" style={{ color: '#000' }}>{repair.customerName}</p>
          <p className="text-[11px] font-black leading-none" style={{ color: '#000' }}>{repair.customerPhone}</p>
        </div>

        <div>
          <p className="text-[7px] font-black uppercase leading-none opacity-60" style={{ color: '#000' }}>EQUIPO:</p>
          <p className="text-[12px] font-black uppercase leading-tight truncate" style={{ color: '#000' }}>{repair.brand} {repair.model}</p>
          <p className="text-[9px] font-bold leading-none mt-0.5" style={{ color: '#000' }}>S/N: {repair.serialNumber || 'N/A'}</p>
        </div>
      </div>

      {/* DESCRIPCIÓN DEL FALLO */}
      <div className="border-2 border-black p-2 rounded-lg mb-2 flex-1 flex flex-col overflow-hidden" 
           style={{ borderWidth: '1.5px', borderColor: '#000' }}>
        <p className="text-[7px] font-black uppercase mb-1 leading-none" style={{ color: '#000' }}>SÍNTOMAS / FALLO:</p>
        <p className="text-[11px] font-black uppercase leading-[1.2] italic text-justify overflow-hidden" style={{ color: '#000' }}>
          "{repair.problemDescription}"
        </p>
      </div>

      {/* PIE LEGAL SIN FIRMA */}
      <div className="mt-auto pt-2 border-t border-black border-dotted shrink-0 text-center" style={{ borderColor: '#000' }}>
        <p className="text-[6px] font-bold uppercase leading-tight" style={{ color: '#000' }}>
          Este ticket identifica su equipo en nuestro sistema.<br/>
          Conserve este resguardo para la recogida.<br/>
          Garantía de 3 meses en mano de obra.
        </p>
        <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
          <span className="text-[6px] font-black uppercase" style={{ color: '#000' }}>ReparaPro Master v5.4.4</span>
          <span className="text-[6px] font-mono" style={{ color: '#000' }}>RMA: {formatRMA(repair.rmaNumber, repair.rmaPrefix)}</span>
        </div>
      </div>
    </div>
  );
};

export default ThermalReceptionTicket;