import React, { useState } from 'react';
import { Search, Printer, Trash2, Eye, FileText, MessageCircle, Receipt, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Budget, RepairItem, AppSettings, Customer } from '../types';

interface BudgetListProps {
  budgets: Budget[];
  repairs: RepairItem[];
  customers?: Customer[];
  settings?: AppSettings;
  onViewBudget: (budget: Budget) => void;
  onPrintBudget: (budget: Budget) => void;
  onDeleteBudget: (budgetId: string) => void;
  onNewFreeBudget?: () => void;
  onSendWhatsApp?: (budget: Budget, repair: RepairItem) => void;
  onConvertToInvoice?: (budget: Budget, repair: RepairItem) => void;
  onBack?: () => void;
}

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const getMonthKey   = (d: string) => d?.slice(0, 7) || 'sin-fecha';
const getMonthLabel = (key: string) => {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [yr, mo] = key.split('-');
  return `${MONTH_NAMES_ES[parseInt(mo, 10) - 1]} ${yr}`;
};

const BudgetList: React.FC<BudgetListProps> = ({ budgets, repairs, customers = [], settings, onViewBudget, onPrintBudget, onDeleteBudget, onNewFreeBudget, onSendWhatsApp, onConvertToInvoice, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([currentMonthKey]));

  const formatRMA = (num: number) => `RMA-${num.toString().padStart(5, '0')}`;
  const getRepairInfo = (repairId: string) => repairs.find(r => r.id === repairId);

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isSearching = searchTerm.trim().length > 0;

  const filteredBudgets = budgets
    .filter(budget => {
      const repair = getRepairInfo(budget.repairId);
      const customerName = repair?.customerName || budget.customerName || '';
      const searchStr = `${budget.id} ${repair ? formatRMA(repair.rmaNumber) : ''} ${customerName}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const groupedByMonth: [string, Budget[]][] = (() => {
    const map = new Map<string, Budget[]>();
    for (const b of filteredBudgets) {
      const key = getMonthKey(b.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  })();

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-3">← INICIO</button>}
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Archivo de Presupuestos</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Histórico de valoraciones técnicas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar presupuesto o cliente..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {onNewFreeBudget && (
            <button
              onClick={onNewFreeBudget}
              className="flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all whitespace-nowrap"
            >
              <Plus size={14} /> Presupuesto libre
            </button>
          )}
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
          <tbody>
            {filteredBudgets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">
                  No se encontraron presupuestos
                </td>
              </tr>
            ) : (
              groupedByMonth.map(([monthKey, monthBudgets]) => {
                const isCurrentMonth = monthKey === currentMonthKey;
                const isExpanded = isSearching || expandedMonths.has(monthKey);
                const monthTotal = monthBudgets.reduce((s, b) => s + (b.total || 0), 0);

                return (
                  <React.Fragment key={monthKey}>
                    {/* Month header */}
                    <tr
                      onClick={() => !isSearching && toggleMonth(monthKey)}
                      className={`select-none bg-slate-50 hover:bg-slate-100/80 transition-all border-b border-slate-100 ${!isSearching ? 'cursor-pointer' : ''}`}
                    >
                      <td colSpan={5} className="px-8 py-3">
                        <div className="flex items-center gap-3">
                          {isExpanded
                            ? <ChevronDown size={13} className="text-slate-400 shrink-0" />
                            : <ChevronRight size={13} className="text-slate-400 shrink-0" />
                          }
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                            {getMonthLabel(monthKey)}
                          </span>
                          {isCurrentMonth && (
                            <span className="text-[8px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full tracking-widest">ACTUAL</span>
                          )}
                          <span className="text-[10px] font-bold text-slate-400">
                            {monthBudgets.length} presupuesto{monthBudgets.length !== 1 ? 's' : ''}
                          </span>
                          <span className="ml-auto text-xs font-black text-blue-600">
                            {monthTotal.toFixed(2)}€
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Budget rows */}
                    {isExpanded && monthBudgets.map(budget => {
                      const repair = getRepairInfo(budget.repairId);
                      const displayName = repair?.customerName || budget.customerName || 'N/A';
                      const isFreeBudget = !repair;

                      return (
                        <tr key={budget.id} className="hover:bg-slate-50 transition-all group border-b border-slate-50">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isFreeBudget ? 'bg-violet-50 text-violet-500' : 'bg-blue-50 text-blue-500'}`}>
                                <FileText size={14} />
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-slate-900">
                                  {repair ? formatRMA(repair.rmaNumber) : <span className="text-violet-600">LIBRE</span>}
                                </p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">ID: {budget.id.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-xs font-black text-slate-900 uppercase truncate max-w-[150px]">{displayName}</p>
                            {repair
                              ? <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[150px] mt-1">{repair.brand} {repair.model}</p>
                              : <p className="text-[9px] text-violet-400 font-bold uppercase mt-1">Sin RMA</p>
                            }
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-sm font-black text-blue-600">{(budget.total || 0).toFixed(2)}€</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">IVA {budget.taxRate}% INCL.</p>
                          </td>
                          <td className="px-4 py-6 text-[10px] font-bold text-slate-500">{new Date(budget.date).toLocaleDateString('es-ES')}</td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-2">
                              {repair && onSendWhatsApp && (
                                <button onClick={() => onSendWhatsApp(budget, repair)} className="p-2.5 bg-white text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white border border-slate-100 transition-all" title="Enviar WhatsApp"><MessageCircle size={14} /></button>
                              )}
                              <button onClick={() => onViewBudget(budget)} className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white border border-slate-100 transition-all" title="Ver / Editar"><Eye size={14} /></button>
                              <button onClick={() => onPrintBudget(budget)} className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white border border-slate-100 transition-all" title="Imprimir"><Printer size={14} /></button>
                              {repair && onConvertToInvoice && (
                                <button onClick={() => onConvertToInvoice(budget, repair)} className="p-2.5 bg-white text-violet-400 rounded-xl hover:bg-violet-600 hover:text-white border border-slate-100 transition-all" title="Convertir a factura"><Receipt size={14} /></button>
                              )}
                              <button onClick={() => onDeleteBudget(budget.id)} className="p-2.5 bg-white text-slate-200 rounded-xl hover:bg-red-600 hover:text-white border border-slate-100 transition-all" title="Eliminar"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BudgetList;
