import React, { useState } from 'react';
import { Search, Printer, Trash2, Eye, FileText } from 'lucide-react';
import { Budget, RepairItem } from '../types';

interface BudgetListProps {
  budgets: Budget[];
  repairs: RepairItem[];
  onViewBudget: (budget: Budget) => void;
  onPrintBudget: (budget: Budget) => void;
  onDeleteBudget: (budgetId: string) => void;
}

const BudgetList: React.FC<BudgetListProps> = ({ budgets, repairs, onViewBudget, onPrintBudget, onDeleteBudget }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatRMA = (num: number) => `RMA-${num.toString().padStart(5, '0')}`;
  const getRepairInfo = (repairId: string) => repairs.find(r => r.id === repairId);

  const filteredBudgets = budgets.filter(budget => {
    const repair = getRepairInfo(budget.repairId);
    const searchStr = `${budget.id} ${repair ? formatRMA(repair.rmaNumber) : ''} ${repair?.customerName}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  }).sort((a, b) => {
    const repairA = getRepairInfo(a.repairId);
    const repairB = getRepairInfo(b.repairId);
    const rmaA = repairA ? repairA.rmaNumber : 0;
    const rmaB = repairB ? repairB.rmaNumber : 0;
    return rmaA - rmaB;
  });

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Archivo de Presupuestos</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Histórico de valoraciones técnicas</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Buscar presupuesto o RMA..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
            <tr>
              <th className="px-8 py-5">Identificador</th>
              <th className="px-4 py-5">Cliente / Equipo</th>
              <th className="px-4 py-5">Total Valoración</th>
              <th className="px-4 py-5">Fecha</th>
              <th className="px-8 py-5 text-right">Gestión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredBudgets.map(budget => {
              const repair = getRepairInfo(budget.repairId);

              return (
                <tr key={budget.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center"><FileText size={14} /></div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900">{repair ? formatRMA(repair.rmaNumber) : 'S/RMA'}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">ID: {budget.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-xs font-black text-slate-900 uppercase truncate max-w-[150px]">{repair?.customerName || 'N/A'}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[150px] mt-1">{repair?.brand} {repair?.model}</p>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-sm font-black text-blue-600">{budget.total.toFixed(2)}€</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">IVA {budget.taxRate}% INCL.</p>
                  </td>
                  <td className="px-4 py-6 text-[10px] font-bold text-slate-500">{new Date(budget.date).toLocaleDateString('es-ES')}</td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => onViewBudget(budget)} className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white border border-slate-100 transition-all" title="Ver / Editar"><Eye size={14} /></button>
                      <button onClick={() => onPrintBudget(budget)} className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white border border-slate-100 transition-all" title="Imprimir"><Printer size={14} /></button>
                      <button onClick={() => onDeleteBudget(budget.id)} className="p-2.5 bg-white text-slate-200 rounded-xl hover:bg-red-600 hover:text-white border border-slate-100 transition-all" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredBudgets.length === 0 && (
              <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">No se encontraron presupuestos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BudgetList;