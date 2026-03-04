
import React, { useState } from 'react';
import { Search, User, Smartphone, Clock, ChevronRight } from 'lucide-react';
import { RepairItem } from '../types';

interface CustomerListProps {
  repairs: RepairItem[];
  onSelectCustomer: (phone: string) => void;
}

// Fix: Defined CustomerRecord interface to properly type the customer map and avoid unknown type errors
interface CustomerRecord {
  name: string;
  phone: string;
  repairs: RepairItem[];
  lastVisit: string;
}

const CustomerList: React.FC<CustomerListProps> = ({ repairs, onSelectCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Agrupar clientes por teléfono
  // Fix: Explicitly typed the accumulator as Record<string, CustomerRecord> to resolve type inference issues
  const customerMap = repairs.reduce((acc, repair) => {
    const phone = repair.customerPhone;
    if (!acc[phone]) {
      acc[phone] = {
        name: repair.customerName,
        phone,
        repairs: [],
        lastVisit: repair.entryDate
      };
    }
    acc[phone].repairs.push(repair);
    if (new Date(repair.entryDate) > new Date(acc[phone].lastVisit)) {
      acc[phone].lastVisit = repair.entryDate;
    }
    return acc;
  }, {} as Record<string, CustomerRecord>);

  // Fix: Typed customers as CustomerRecord[] to resolve property access errors on type 'unknown'
  const customers = (Object.values(customerMap) as CustomerRecord[]).filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o teléfono..." 
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[2rem] font-bold text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map(c => (
          <div key={c.phone} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase truncate max-w-[150px]">{c.name}</h3>
                  <p className="text-xs font-bold text-slate-400">{c.phone}</p>
                </div>
              </div>
              <button onClick={() => onSelectCustomer(c.phone)} className="p-3 bg-slate-50 text-slate-300 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all"><ChevronRight size={20} /></button>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl">
              <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-2"><Smartphone size={10} /> Equipos Registrados</p>
              <p className="text-xl font-black text-blue-900 leading-none">{c.repairs.length}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-slate-300" />
                <span className="text-[9px] font-black text-slate-400 uppercase">Última Visita: {c.lastVisit}</span>
              </div>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white border-2 border-dashed border-slate-100 rounded-[3rem]">
            <p className="text-slate-300 font-black uppercase text-xs tracking-widest">No hay clientes que coincidan</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerList;
