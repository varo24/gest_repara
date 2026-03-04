import React, { useState, useMemo } from 'react';
import { Search, User, Phone, Wrench, Clock, ChevronRight } from 'lucide-react';
import { RepairItem } from '../types';

interface CustomerListProps {
  repairs: RepairItem[];
  onSelectCustomer: (phone: string) => void;
}

interface CustomerRecord {
  name: string;
  phone: string;
  repairs: RepairItem[];
  lastVisit: string;
}

const CustomerList: React.FC<CustomerListProps> = ({ repairs, onSelectCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const customers = useMemo(() => {
    const map = repairs.reduce((acc, repair) => {
      const phone = repair.customerPhone;
      if (!acc[phone]) {
        acc[phone] = { name: repair.customerName, phone, repairs: [], lastVisit: repair.entryDate };
      }
      acc[phone].repairs.push(repair);
      if (new Date(repair.entryDate) > new Date(acc[phone].lastVisit)) {
        acc[phone].lastVisit = repair.entryDate;
      }
      return acc;
    }, {} as Record<string, CustomerRecord>);

    return (Object.values(map) as CustomerRecord[])
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [repairs, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header compacto */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Clientes</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{customers.length} registrados</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar nombre o teléfono..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla compacta */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">Cliente</th>
              <th className="px-4 py-4">Teléfono</th>
              <th className="px-4 py-4 text-center">Reparaciones</th>
              <th className="px-4 py-4">Última Visita</th>
              <th className="px-4 py-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-slate-300">
                  <User size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin resultados</p>
                </td>
              </tr>
            ) : customers.map(c => (
              <tr key={c.phone} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => onSelectCustomer(c.phone)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-black group-hover:bg-slate-900 group-hover:text-white transition-colors shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-black text-slate-800 text-sm uppercase tracking-tight truncate max-w-[180px]">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-300" /> {c.phone}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black">
                    <Wrench size={10} /> {c.repairs.length}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock size={10} /> {new Date(c.lastVisit).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerList;
