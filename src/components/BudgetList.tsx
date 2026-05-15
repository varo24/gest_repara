import React, { useState } from 'react';
import { Search, Printer, Trash2, Eye, FileText, MessageCircle, Receipt, Plus, ChevronDown, ChevronRight, RotateCcw, FileCheck, X as XIcon, Phone, Archive } from 'lucide-react';
import { Budget, RepairItem, AppSettings, Customer } from '../types';
import { getBudgetAlertLevel, workingDaysSince } from '../lib/budgetAlerts';

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
  onConvertToInvoice?: (budget: Budget, repair: RepairItem | null, tipo?: 'FAC' | 'REC') => void;
  onUpdateBudgetStatus?: (budget: Budget, status: 'accepted' | 'rejected' | 'pending', motivo?: string) => void;
  onMarkContacted?: (budgetId: string) => void;
  onViewInvoices?: () => void;
  onBack?: () => void;
}

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const getMonthKey   = (d: string) => d?.slice(0, 7) || 'sin-fecha';
const getMonthLabel = (key: string) => {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [yr, mo] = key.split('-');
  return `${MONTH_NAMES_ES[parseInt(mo, 10) - 1]} ${yr}`;
};

function isExpired(budget: Budget): boolean {
  if (budget.status && budget.status !== 'pending') return false;
  const days = (Date.now() - new Date(budget.date).getTime()) / (1000 * 60 * 60 * 24);
  return days > 30;
}

function getBadgeInfo(budget: Budget): { label: string; bg: string; color: string } {
  if (budget.status === 'accepted') return { label: '✅ Aceptado',  bg: '#dcfce7', color: '#166534' };
  if (budget.status === 'rejected') return { label: '✗ Rechazado', bg: '#fee2e2', color: '#991b1b' };
  if (isExpired(budget))            return { label: '⌛ Expirado',  bg: '#f3f4f6', color: '#4b5563' };
  return                                   { label: '⏳ Pendiente', bg: '#fef3c7', color: '#92400e' };
}

const BudgetList: React.FC<BudgetListProps> = ({
  budgets, repairs, customers = [], settings, onViewBudget, onPrintBudget, onDeleteBudget,
  onNewFreeBudget, onSendWhatsApp, onConvertToInvoice, onUpdateBudgetStatus, onMarkContacted,
  onViewInvoices, onBack,
}) => {
  const followUpThreshold = settings?.budgetFollowUpDays ?? 3;
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchivados, setShowArchivados] = useState(false);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([currentMonthKey]));

  // Modal state
  const [rejectModal, setRejectModal] = useState<{ budget: Budget; repair: RepairItem | null } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acceptModal, setAcceptModal] = useState<{ budget: Budget; repair: RepairItem } | null>(null);

  const formatRMA = (num: number) => `RMA-${num.toString().padStart(5, '0')}`;
  const getRepairInfo = (repairId?: string) => repairId ? repairs.find(r => r.id === repairId) : undefined;

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isSearching = searchTerm.trim().length > 0;

  const archivedCount = budgets.filter(b => b.archivado).length;

  const filteredBudgets = budgets
    .filter(budget => {
      if (!showArchivados && budget.archivado) return false;
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

  const handleAccept = (budget: Budget, repair: RepairItem | null) => {
    if (repair) {
      setAcceptModal({ budget, repair });
    } else {
      onUpdateBudgetStatus?.(budget, 'accepted');
    }
  };

  const handleReject = (budget: Budget, repair: RepairItem | null) => {
    setRejectReason('');
    setRejectModal({ budget, repair });
  };

  const confirmReject = () => {
    if (!rejectModal) return;
    onUpdateBudgetStatus?.(rejectModal.budget, 'rejected', rejectReason || undefined);
    setRejectModal(null);
    setRejectReason('');
  };

  const confirmAcceptWithDoc = (tipo: 'FAC' | 'REC') => {
    if (!acceptModal) return;
    onUpdateBudgetStatus?.(acceptModal.budget, 'accepted');
    onConvertToInvoice?.(acceptModal.budget, acceptModal.repair, tipo);
    setAcceptModal(null);
  };

  const confirmAcceptOnly = () => {
    if (!acceptModal) return;
    onUpdateBudgetStatus?.(acceptModal.budget, 'accepted');
    setAcceptModal(null);
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {onBack && <button onClick={onBack} className="back-to-dash mb-3">← INICIO</button>}
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Archivo de Presupuestos</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Histórico de valoraciones técnicas</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar presupuesto o cliente..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchivados(v => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                showArchivados
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Archive size={13} />
              {showArchivados ? 'Ocultar archivados' : `Archivados (${archivedCount})`}
            </button>
          )}
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
              <th className="px-4 py-5">Total / Estado</th>
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
                    {isExpanded && monthBudgets.map(budget => {
                      const repair = getRepairInfo(budget.repairId);
                      const displayName = repair?.customerName || budget.customerName || 'N/A';
                      const isFreeBudget = !repair;
                      const badge = getBadgeInfo(budget);
                      const isPending   = !budget.status || budget.status === 'pending';
                      const isAccepted  = budget.status === 'accepted';
                      const isRejected  = budget.status === 'rejected';

                      const alertLevel = isPending ? getBudgetAlertLevel(budget, followUpThreshold) : 'none';
                      const alertDays  = alertLevel !== 'none' ? workingDaysSince(budget.lastContactedAt || budget.date) : 0;

                      const isArchivado = !!budget.archivado;
                      const docGenerado = budget.documentoGenerado;

                      return (
                        <tr key={budget.id} className="hover:bg-slate-50 transition-all group border-b border-slate-50" style={{ opacity: isArchivado ? 0.5 : 1 }}>
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
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span
                                className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: badge.bg, color: badge.color }}
                                title={isRejected && budget.motivoRechazo ? `Motivo: ${budget.motivoRechazo}` : undefined}
                              >
                                {badge.label}
                              </span>
                              {alertLevel !== 'none' && (
                                <span
                                  className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full"
                                  style={{
                                    background: alertLevel === 'red' ? '#fee2e2' : '#fef3c7',
                                    color:      alertLevel === 'red' ? '#991b1b' : '#92400e',
                                  }}
                                  title={`${alertDays} días laborables sin respuesta`}
                                >
                                  {alertDays}d
                                </span>
                              )}
                            </div>
                            {isRejected && budget.motivoRechazo && (
                              <p className="text-[8px] text-red-400 mt-0.5 max-w-[120px] truncate" title={budget.motivoRechazo}>
                                {budget.motivoRechazo}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-6 text-[10px] font-bold text-slate-500">{new Date(budget.date).toLocaleDateString('es-ES')}</td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-1.5 flex-wrap">
                              {/* Status actions */}
                              {isPending && onUpdateBudgetStatus && (
                                <>
                                  <button
                                    onClick={() => handleAccept(budget, repair || null)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-all"
                                    title="Aceptar presupuesto"
                                  >
                                    ✅ Aceptar
                                  </button>
                                  <button
                                    onClick={() => handleReject(budget, repair || null)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-600 transition-all"
                                    title="Rechazar presupuesto"
                                  >
                                    ✗ Rechazar
                                  </button>
                                </>
                              )}
                              {isArchivado && docGenerado ? (
                                <button
                                  onClick={() => onViewInvoices?.()}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all"
                                  style={{ background: docGenerado.tipo === 'factura' ? '#eff6ff' : '#f8fafc', color: docGenerado.tipo === 'factura' ? '#1d4ed8' : '#475569', border: `1px solid ${docGenerado.tipo === 'factura' ? '#bfdbfe' : '#e2e8f0'}` }}
                                  title={`Ver ${docGenerado.tipo} ${docGenerado.numero}`}
                                >
                                  {docGenerado.tipo === 'factura' ? '🧾' : '📄'} {docGenerado.numero}
                                </button>
                              ) : isAccepted && onConvertToInvoice && (
                                <>
                                  <button
                                    onClick={() => onConvertToInvoice(budget, repair ?? null, 'FAC')}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-blue-700 transition-all"
                                    title="Crear factura con IVA"
                                  >
                                    🧾 FAC-
                                  </button>
                                  <button
                                    onClick={() => onConvertToInvoice(budget, repair ?? null, 'REC')}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-slate-600 transition-all"
                                    title="Crear recibo sin IVA"
                                  >
                                    📄 REC-
                                  </button>
                                </>
                              )}
                              {isRejected && onUpdateBudgetStatus && (
                                <button
                                  onClick={() => onUpdateBudgetStatus(budget, 'pending')}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-amber-600 transition-all"
                                  title="Reactivar como pendiente"
                                >
                                  <RotateCcw size={11} /> Reactivar
                                </button>
                              )}

                              {/* Contactado — resets follow-up counter */}
                              {isPending && alertLevel !== 'none' && onMarkContacted && (
                                <button
                                  onClick={() => onMarkContacted(budget.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all"
                                  style={{
                                    background: alertLevel === 'red' ? '#fff7ed' : '#fffbeb',
                                    color:      alertLevel === 'red' ? '#c2410c' : '#b45309',
                                    borderColor: alertLevel === 'red' ? '#fed7aa' : '#fde68a',
                                  }}
                                  title="Marcar como contactado (resetea el contador)"
                                >
                                  <Phone size={11} /> Contactado
                                </button>
                              )}

                              {/* Standard actions */}
                              {repair && onSendWhatsApp && (
                                <button onClick={() => onSendWhatsApp(budget, repair)} className="p-2.5 bg-white text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white border border-slate-100 transition-all" title="Enviar WhatsApp"><MessageCircle size={14} /></button>
                              )}
                              <button onClick={() => onViewBudget(budget)} className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white border border-slate-100 transition-all" title="Ver / Editar"><Eye size={14} /></button>
                              <button onClick={() => onPrintBudget(budget)} className="p-2.5 bg-white text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white border border-slate-100 transition-all" title="Imprimir"><Printer size={14} /></button>
                              {isAccepted && onConvertToInvoice && !isArchivado && (
                                <button onClick={() => onConvertToInvoice(budget, repair ?? null)} className="p-2.5 bg-white text-violet-400 rounded-xl hover:bg-violet-600 hover:text-white border border-slate-100 transition-all" title="Convertir a factura"><Receipt size={14} /></button>
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

      {/* Accept modal */}
      {acceptModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-emerald-50 rounded-2xl">
                <FileCheck size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase">Presupuesto aceptado</h2>
              <p className="text-xs text-slate-600">
                ¿Deseas crear un documento ahora para <strong>{acceptModal.repair.customerName}</strong>?
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => confirmAcceptWithDoc('FAC')}
                className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all"
              >
                🧾 Crear Factura con IVA (FAC-)
              </button>
              <button
                onClick={() => confirmAcceptWithDoc('REC')}
                className="w-full py-3.5 bg-slate-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all"
              >
                📄 Crear Recibo sin IVA (REC-)
              </button>
              <button
                onClick={confirmAcceptOnly}
                className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Solo aceptar, crear documento después
              </button>
              <button
                onClick={() => setAcceptModal(null)}
                className="w-full py-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl">
                <XIcon size={28} className="text-red-500" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase">Rechazar presupuesto</h2>
              <p className="text-xs text-slate-600">¿Confirmar rechazo?</p>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Motivo del rechazo (opcional)</label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Cliente no aceptó el precio, esperará, etc."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
                Cancelar
              </button>
              <button onClick={confirmReject} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all">
                ✗ Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetList;
