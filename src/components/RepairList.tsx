import React, { useState, useMemo } from 'react';
import {
  Search, Trash2, Filter, Pencil, ChevronDown, ChevronLeft, ChevronRight,
  User, Smartphone, FilePlus, FileEdit, FileText, Ticket, MessageCircle,
  Archive, Zap
} from 'lucide-react';
import { RepairItem, RepairStatus, Budget, AppSettings } from '../types';
import WhatsAppPanel from './WhatsAppPanel';

interface RepairListProps {
  repairs: RepairItem[];
  budgets: Budget[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onStatusChange: (id: string, status: RepairStatus, noteAppend?: string) => void;
  onEdit: (repair: RepairItem) => void;
  onCreateBudget: (repair: RepairItem) => void;
  onEditBudget: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onPrintReceipt?: (repair: RepairItem) => void;
  onPrintTicket?: (repair: RepairItem) => void;
  settings?: AppSettings;
  initialSearch?: string;
  onBack?: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ARCHIVED_STATUSES = [RepairStatus.DELIVERED, RepairStatus.CANCELLED, RepairStatus.SIN_REPARACION];

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const getMonthKey   = (d: string) => d?.slice(0, 7) || 'sin-fecha';
const getMonthLabel = (key: string) => {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [yr, mo] = key.split('-');
  return `${MONTH_NAMES_ES[parseInt(mo, 10) - 1]} ${yr}`;
};

const RepairList: React.FC<RepairListProps> = ({
  repairs, budgets, onStatusChange, onEdit, onCreateBudget, onEditBudget, onDelete,
  onPrintReceipt, onPrintTicket, settings, onBack,
  initialSearch = ''
}) => {
  const [searchTerm, setSearchTerm]   = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'Todos'>('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [whatsappRepair, setWhatsappRepair] = useState<RepairItem | null>(null);
  const [viewMode, setViewMode]       = useState<'active' | 'history'>('active');
  const [sinReparacionPending, setSinReparacionPending] = useState<{ id: string; repair: RepairItem } | null>(null);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([currentMonthKey]));

  const handleSearch       = (val: string) => { setSearchTerm(val); setCurrentPage(1); };
  const handleStatusFilter = (val: RepairStatus | 'Todos') => { setStatusFilter(val); setCurrentPage(1); };
  const switchView         = (mode: 'active' | 'history') => { setViewMode(mode); setCurrentPage(1); setStatusFilter('Todos'); };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const activeRepairs   = useMemo(() => repairs.filter(r => !ARCHIVED_STATUSES.includes(r.status)), [repairs]);
  const archivedRepairs = useMemo(() => repairs.filter(r =>  ARCHIVED_STATUSES.includes(r.status)), [repairs]);
  const baseRepairs     = viewMode === 'active' ? activeRepairs : archivedRepairs;

  const availableStatuses = useMemo(() => {
    if (viewMode === 'active') return Object.values(RepairStatus).filter(s => !ARCHIVED_STATUSES.includes(s));
    return ARCHIVED_STATUSES;
  }, [viewMode]);

  const filteredRepairs = useMemo(() => {
    return baseRepairs.filter(r => {
      const searchStr = `${r.rmaNumber} ${r.customerName} ${r.deviceType} ${r.brand} ${r.model} ${r.customerPhone}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (viewMode === 'history') return (b.entryDate || '').localeCompare(a.entryDate || '');
      return a.rmaNumber - b.rmaNumber;
    });
  }, [baseRepairs, searchTerm, statusFilter, viewMode]);

  // Active mode pagination
  const totalPages       = Math.max(1, Math.ceil(filteredRepairs.length / pageSize));
  const safePage         = Math.min(currentPage, totalPages);
  const paginatedRepairs = filteredRepairs.slice((safePage - 1) * pageSize, safePage * pageSize);

  // History mode grouping
  const isHistoryFiltered = searchTerm.trim().length > 0 || statusFilter !== 'Todos';
  const groupedHistory: [string, RepairItem[]][] = useMemo(() => {
    if (viewMode !== 'history') return [];
    const map = new Map<string, RepairItem[]>();
    for (const r of filteredRepairs) {
      const key = getMonthKey(r.entryDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filteredRepairs, viewMode]);

  const getStatusColor = (status: RepairStatus) => {
    const c: Record<string, string> = {
      [RepairStatus.PENDING]:          'bg-yellow-400 text-yellow-900',
      [RepairStatus.DIAGNOSING]:       'bg-cyan-400 text-cyan-900',
      [RepairStatus.BUDGET_PENDING]:   'bg-violet-500 text-white',
      [RepairStatus.BUDGET_ACCEPTED]:  'bg-lime-400 text-lime-900',
      [RepairStatus.BUDGET_REJECTED]:  'bg-rose-500 text-white',
      [RepairStatus.WAITING_PARTS]:    'bg-orange-500 text-white',
      [RepairStatus.IN_PROGRESS]:      'bg-blue-500 text-white',
      [RepairStatus.READY]:            'bg-emerald-500 text-white',
      [RepairStatus.DELIVERED]:        'bg-slate-400 text-white',
      [RepairStatus.CANCELLED]:        'bg-red-600 text-white',
      [RepairStatus.SIN_REPARACION]:   'bg-slate-200 text-slate-700',
    };
    return c[status] || 'bg-slate-200 text-slate-600';
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  const defaultSettings: AppSettings = { appName: 'ReparaPro', address: '', phone: '', taxId: '' };

  const renderRepairRow = (repair: RepairItem) => {
    const budget     = budgets.find(b => b.repairId === repair.id);
    const isArchived = ARCHIVED_STATUSES.includes(repair.status);
    return (
      <tr key={repair.id} className={`transition-colors group border-b border-slate-50 ${isArchived ? 'opacity-70 hover:opacity-100' : 'hover:bg-blue-50/20'}`}>
        <td className="px-8 py-7">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[12px] font-black text-slate-900 leading-none">
              RMA-{repair.rmaNumber.toString().padStart(5, '0')}
            </p>
            {repair.repairType === 'domicilio' && (
              <span className="text-[7px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black uppercase">DOM</span>
            )}
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(repair.entryDate).toLocaleDateString()}</p>
        </td>
        <td className="px-4 py-7">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><User size={16} /></div>
            <div>
              <p className="text-xs font-black text-slate-800 uppercase leading-none tracking-tight">{repair.customerName}</p>
              <p className="text-[9px] text-slate-400 font-bold mt-1.5">{repair.customerPhone}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-7">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center"><Smartphone size={16} /></div>
            <div>
              <p className="text-xs font-black text-slate-900 uppercase leading-none tracking-tight">{repair.brand} {repair.model}</p>
              <p className="text-[9px] text-slate-400 font-bold mt-1.5 uppercase">{repair.deviceType}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-7">
          <div className="relative inline-block">
            <select
              value={repair.status}
              onChange={(e) => {
                const newStatus = e.target.value as RepairStatus;
                if (newStatus === RepairStatus.SIN_REPARACION) {
                  setSinReparacionPending({ id: repair.id, repair });
                } else {
                  onStatusChange(repair.id, newStatus);
                }
              }}
              className={`text-[9px] pl-4 pr-10 py-2.5 rounded-xl font-black uppercase border-none cursor-pointer outline-none appearance-none tracking-widest ${getStatusColor(repair.status)}`}
            >
              {Object.values(RepairStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>
        </td>
        <td className="px-8 py-7 text-right">
          <div className="flex items-center justify-end gap-2">
            {budget ? (
              <button onClick={() => onEditBudget(budget)} title="Editar Presupuesto" className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"><FileEdit size={16} /></button>
            ) : (
              <button onClick={() => onCreateBudget(repair)} title="Crear Presupuesto" className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"><FilePlus size={16} /></button>
            )}
            <button onClick={() => setWhatsappRepair(repair)} title="Enviar WhatsApp" className="p-3 bg-white text-green-500 rounded-xl hover:bg-green-500 hover:text-white border border-slate-100 transition-all"><MessageCircle size={16} /></button>
            {onPrintReceipt && (
              <button onClick={() => onPrintReceipt(repair)} title="Resguardo Cliente" className="p-3 bg-white text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white border border-slate-100 transition-all"><FileText size={16} /></button>
            )}
            {onPrintTicket && (
              <button onClick={() => onPrintTicket(repair)} title="Ticket Térmico" className="p-3 bg-white text-purple-400 rounded-xl hover:bg-purple-600 hover:text-white border border-slate-100 transition-all"><Ticket size={16} /></button>
            )}
            <button onClick={() => onEdit(repair)} title="Ficha Técnica" className="p-3 bg-white text-slate-400 rounded-xl hover:bg-slate-100 border border-slate-100 transition-all"><Pencil size={16} /></button>
            <button onClick={() => onDelete(repair.id)} title="Eliminar" className="p-3 bg-white text-red-200 rounded-xl hover:bg-red-600 hover:text-white border border-slate-100 transition-all"><Trash2 size={16} /></button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">

        {/* Cabecera */}
        <div className="p-8 md:p-10 border-b border-slate-50 space-y-6 no-print">
          {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Banco de Trabajo</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">
                {filteredRepairs.length} reparación{filteredRepairs.length !== 1 ? 'es' : ''}
                {viewMode === 'active' ? ' activa' : ' en historial'}{filteredRepairs.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative">
                <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  className="pl-12 pr-10 py-4 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none cursor-pointer outline-none"
                  value={statusFilter}
                  onChange={(e) => handleStatusFilter(e.target.value as RepairStatus | 'Todos')}
                >
                  <option value="Todos">Todos los estados</option>
                  {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="relative md:w-80">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por RMA, cliente, marca..."
                  className="pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold w-full outline-none placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabs: Activas / Historial */}
          <div className="flex gap-2">
            <button onClick={() => switchView('active')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'active'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}>
              <Zap size={14} /> Activas
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${viewMode === 'active' ? 'bg-white/20' : 'bg-slate-200'}`}>{activeRepairs.length}</span>
            </button>
            <button onClick={() => switchView('history')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'history'
                  ? 'bg-slate-700 text-white shadow-lg shadow-slate-300'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}>
              <Archive size={14} /> Historial
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${viewMode === 'history' ? 'bg-white/20' : 'bg-slate-200'}`}>{archivedRepairs.length}</span>
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
                <th className="px-8 py-5">RMA / Fecha</th>
                <th className="px-4 py-5">Cliente</th>
                <th className="px-4 py-5">Equipo</th>
                <th className="px-4 py-5">Estado Técnico</th>
                <th className="px-8 py-5 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody>
              {viewMode === 'history' ? (
                /* ── HISTORIAL: agrupado por meses ── */
                filteredRepairs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <Archive size={32} className="text-slate-200" />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                          {searchTerm || statusFilter !== 'Todos' ? 'No hay resultados para este filtro' : 'No hay órdenes en el historial'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedHistory.map(([monthKey, monthRepairs]) => {
                    const isCurrentMonth   = monthKey === currentMonthKey;
                    const isExpanded       = isHistoryFiltered || expandedMonths.has(monthKey);
                    const deliveredCount      = monthRepairs.filter(r => r.status === RepairStatus.DELIVERED).length;
                    const cancelledCount      = monthRepairs.filter(r => r.status === RepairStatus.CANCELLED).length;
                    const sinReparacionCount  = monthRepairs.filter(r => r.status === RepairStatus.SIN_REPARACION).length;
                    const monthBudgetTotal = monthRepairs.reduce((s, r) => {
                      const b = budgets.find(bd => bd.repairId === r.id);
                      return s + (b?.total || 0);
                    }, 0);

                    return (
                      <React.Fragment key={monthKey}>
                        {/* Month header */}
                        <tr
                          onClick={() => !isHistoryFiltered && toggleMonth(monthKey)}
                          className={`select-none bg-slate-50 hover:bg-slate-100/80 transition-all border-b border-slate-100 ${!isHistoryFiltered ? 'cursor-pointer' : ''}`}
                        >
                          <td colSpan={5} className="px-8 py-3.5">
                            <div className="flex items-center gap-3 flex-wrap">
                              {isExpanded
                                ? <ChevronDown size={13} className="text-slate-400 shrink-0" />
                                : <ChevronRight size={13} className="text-slate-400 shrink-0" />
                              }
                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                {getMonthLabel(monthKey)}
                              </span>
                              {isCurrentMonth && (
                                <span className="text-[8px] font-black bg-slate-700 text-white px-2 py-0.5 rounded-full tracking-widest">ACTUAL</span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400">
                                {monthRepairs.length} reparación{monthRepairs.length !== 1 ? 'es' : ''}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                  ✓ {deliveredCount} entregadas
                                </span>
                                {cancelledCount > 0 && (
                                  <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                                    ✗ {cancelledCount} canceladas
                                  </span>
                                )}
                                {sinReparacionCount > 0 && (
                                  <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                    ⊘ {sinReparacionCount} sin reparación
                                  </span>
                                )}
                              </div>
                              {monthBudgetTotal > 0 && (
                                <span className="ml-auto text-xs font-black text-blue-600">
                                  {monthBudgetTotal.toFixed(2)} €
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Repair rows */}
                        {isExpanded && monthRepairs.map(renderRepairRow)}
                      </React.Fragment>
                    );
                  })
                )
              ) : (
                /* ── ACTIVAS: comportamiento actual paginado ── */
                paginatedRepairs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <Smartphone size={32} className="text-slate-200" />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                          {searchTerm || statusFilter !== 'Todos' ? 'No hay resultados para este filtro' : 'No hay reparaciones activas'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRepairs.map(renderRepairRow)
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación — solo en modo Activas */}
        {viewMode === 'active' && filteredRepairs.length > 0 && (
          <div className="px-8 py-6 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-3 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest border-none outline-none cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">de {filteredRepairs.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="px-2 text-slate-400 text-[11px] font-bold">…</span>
                ) : (
                  <button key={p} onClick={() => setCurrentPage(p as number)} className={`w-9 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${safePage === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                    {p}
                  </button>
                )
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal — Sin Reparación */}
      {sinReparacionPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-5">
              <Archive size={26} className="text-slate-500" />
            </div>
            <h3 className="text-[15px] font-black text-slate-900 uppercase tracking-tight text-center mb-2">
              ¿Sin Reparación?
            </h3>
            <p className="text-[12px] text-slate-500 text-center leading-relaxed mb-6">
              La reparación se cerrará <strong>sin cargo</strong>. No se generará factura ni garantía.
              Se registrará automáticamente en las notas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSinReparacionPending(null)}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const { id, repair } = sinReparacionPending;
                  const today = new Date().toLocaleDateString('es-ES');
                  const note = `Cerrado: Sin reparación posible - ${today}`;
                  onStatusChange(id, RepairStatus.SIN_REPARACION, note);
                  setSinReparacionPending(null);
                }}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-slate-700 text-white hover:bg-slate-900 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Panel */}
      {whatsappRepair && (
        <WhatsAppPanel
          repair={whatsappRepair}
          budget={budgets.find(b => b.repairId === whatsappRepair.id)}
          settings={settings || defaultSettings}
          onClose={() => setWhatsappRepair(null)}
        />
      )}
    </>
  );
};

export default RepairList;
