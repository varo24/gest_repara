import React, { useState } from 'react';
import { Search, Printer, Receipt, Trash2, Eye, Download, Building2 } from 'lucide-react';
import { Invoice, AppSettings } from '../types';

interface InvoiceListProps {
  invoices: Invoice[];
  settings: AppSettings;
  onDelete: (id: string) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, settings, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filtered = invoices.filter(i => 
    i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedInvoice) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setSelectedInvoice(null)} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Volver al Listado</button>
          <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Printer size={14} /> Imprimir Factura</button>
        </div>
        
        <div className="bg-white p-12 shadow-2xl rounded-[3rem] border border-slate-100 max-w-4xl mx-auto print:shadow-none print:border-none print:p-0 print:m-0">
          <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-10">
            <div className="flex items-center gap-6">
              {settings.logoUrl ? <img src={settings.logoUrl} className="w-24 h-24 object-contain" /> : <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-black text-3xl"><Building2 size={32} /></div>}
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">{settings.appName}</h2>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">CIF: {settings.taxId} | Telf: {settings.phone}</p>
                <p className="text-[9px] text-slate-400 mt-2 max-w-[200px] uppercase">{settings.address}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-950 text-white px-8 py-5 rounded-[1.5rem] mb-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Factura Oficial</p>
                <p className="text-3xl font-black tracking-tighter">{selectedInvoice.invoiceNumber}</p>
              </div>
              <p className="text-[11px] font-black text-slate-900 uppercase">Fecha: {selectedInvoice.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente</p>
              <p className="text-sm font-black uppercase text-slate-900">{selectedInvoice.customerName}</p>
              <p className="text-[11px] font-bold text-slate-500 mt-1">{selectedInvoice.customerPhone}</p>
            </div>
          </div>

          <table className="w-full mb-12 border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest">
                <th className="py-4 px-6 text-left">Concepto / Material</th>
                <th className="py-4 px-6 text-center">Cant</th>
                <th className="py-4 px-6 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedInvoice.items.map((item, idx) => (
                <tr key={idx} className="text-xs font-bold uppercase">
                  <td className="py-4 px-6 text-slate-800">{item.description}</td>
                  <td className="py-4 px-6 text-center text-slate-500">{item.quantity}</td>
                  <td className="py-4 px-6 text-right text-slate-900">{(item.unitPrice * item.quantity).toFixed(2)}€</td>
                </tr>
              ))}
              {selectedInvoice.laborItems.map((item, idx) => (
                <tr key={idx} className="text-xs font-bold uppercase">
                  <td className="py-4 px-6 text-slate-800">{item.description}</td>
                  <td className="py-4 px-6 text-center text-slate-500">{item.hours}h</td>
                  <td className="py-4 px-6 text-right text-slate-900">{(item.hourlyRate * item.hours).toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-80 space-y-3">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase px-4">
                <span>Base Imponible</span>
                <span>{selectedInvoice.subtotal.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase px-4 border-b border-slate-100 pb-3">
                <span>IVA Aplicado</span>
                <span>{selectedInvoice.taxAmount.toFixed(2)}€</span>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-[1.5rem] flex justify-between items-center shadow-xl">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Factura</span>
                <span className="text-3xl font-black tracking-tighter">{selectedInvoice.total.toFixed(2)}€</span>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-100 text-[8px] font-bold text-slate-400 text-center uppercase tracking-widest">
             Gracias por su confianza. Este documento es una factura legal emitida por {settings.appName}.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
      <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Libro de Facturas</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ingresos registrados en el sistema</p>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Buscar por factura o cliente..." className="pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
            <tr>
              <th className="px-8 py-5">Nº Factura</th>
              <th className="px-4 py-5">Fecha</th>
              <th className="px-4 py-5">Cliente</th>
              <th className="px-4 py-5">Importe Total</th>
              <th className="px-8 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(i => (
              <tr key={i.id} className="hover:bg-slate-50 transition-all group">
                <td className="px-8 py-6">
                  <p className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">{i.invoiceNumber}</p>
                </td>
                <td className="px-4 py-6 text-xs font-bold text-slate-500">{i.date}</td>
                <td className="px-4 py-6 text-xs font-black text-slate-900 uppercase">{i.customerName}</td>
                <td className="px-4 py-6 text-sm font-black text-slate-900">{i.total.toFixed(2)}€</td>
                <td className="px-8 py-6 text-right flex justify-end gap-2">
                  <button onClick={() => setSelectedInvoice(i)} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-md"><Eye size={14} /></button>
                  <button onClick={() => onDelete(i.id)} className="p-2.5 bg-white text-slate-300 rounded-xl hover:bg-red-600 hover:text-white border border-slate-100 transition-all"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold uppercase text-[10px]">Sin facturas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceList;