import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Users, FileText, Wrench, ArrowRight, Calendar } from 'lucide-react';
import { RepairItem, Budget, Cita, ViewType } from '../types';

interface GlobalSearchProps {
  repairs: RepairItem[];
  budgets: Budget[];
  citas: Cita[];
  onNavigate: (view: ViewType) => void;
  onEditRepair: (repair: RepairItem) => void;
}

interface SearchResult {
  type: 'repair' | 'customer' | 'cita';
  id: string;
  title: string;
  subtitle: string;
  action: () => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ repairs, budgets, citas, onNavigate, onEditRepair }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo((): SearchResult[] => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();

    // Search repairs
    const repairResults: SearchResult[] = repairs
      .filter(r =>
        r.customerName.toLowerCase().includes(q) ||
        r.rmaNumber.toString().includes(q) ||
        r.brand?.toLowerCase().includes(q) ||
        r.model?.toLowerCase().includes(q) ||
        r.problemDescription?.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map(r => ({
        type: 'repair',
        id: r.id,
        title: `RMA-${r.rmaNumber.toString().padStart(5, '0')}`,
        subtitle: `${r.customerName} · ${r.status}`,
        action: () => { onEditRepair(r); close(); },
      }));

    // Search unique customers
    const customerMap = new Map<string, RepairItem>();
    repairs.forEach(r => {
      if (r.customerName.toLowerCase().includes(q) || r.customerPhone?.includes(q)) {
        if (!customerMap.has(r.customerName)) customerMap.set(r.customerName, r);
      }
    });
    const customerResults: SearchResult[] = Array.from(customerMap.values())
      .slice(0, 3)
      .map(r => ({
        type: 'customer',
        id: `cust-${r.customerName}`,
        title: r.customerName,
        subtitle: `${r.customerPhone || ''} · ${repairs.filter(rep => rep.customerName === r.customerName).length} reparaciones`,
        action: () => { onNavigate('customers'); close(); },
      }));

    // Search citas
    const citaResults: SearchResult[] = citas
      .filter(c =>
        c.clienteNombre.toLowerCase().includes(q) ||
        c.servicio?.toLowerCase().includes(q) ||
        c.direccion?.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .map(c => ({
        type: 'cita',
        id: c.id,
        title: c.clienteNombre,
        subtitle: `${c.servicio} · ${new Date(c.fecha).toLocaleDateString('es-ES')}`,
        action: () => { onNavigate('calendar'); close(); },
      }));

    return [...repairResults, ...customerResults, ...citaResults];
  }, [query, repairs, citas]);

  const close = () => { setIsOpen(false); setQuery(''); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const typeIcon = (type: SearchResult['type']) => {
    if (type === 'repair') return <Wrench size={14} className="text-blue-500" />;
    if (type === 'customer') return <Users size={14} className="text-emerald-500" />;
    return <Calendar size={14} className="text-amber-500" />;
  };

  const typeLabel = (type: SearchResult['type']) => {
    if (type === 'repair') return 'RMA';
    if (type === 'customer') return 'Cliente';
    return 'Cita';
  };

  return (
    <>
      {/* Trigger Button (inside sidebar or header) */}
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 text-xs font-bold transition-all border border-white/5 hover:border-white/10"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh] px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

          <div ref={containerRef} className="relative w-full max-w-lg bg-white rounded-[1.5rem] shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <Search size={20} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar reparaciones, clientes, citas..."
                className="flex-1 text-sm font-bold text-slate-900 placeholder-slate-300 outline-none bg-transparent"
                autoComplete="off"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Results */}
            {query.length >= 2 && (
              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="py-10 text-center text-slate-300">
                    <Search size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin resultados</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {results.map(r => (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={r.action}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group"
                      >
                        <div className="p-2 bg-slate-100 rounded-xl shrink-0 group-hover:bg-white transition-colors">
                          {typeIcon(r.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{r.title}</p>
                          <p className="text-[10px] text-slate-400 font-bold truncate">{r.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest">{typeLabel(r.type)}</span>
                          <ArrowRight size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {query.length < 2 && (
              <div className="px-5 py-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Escribe al menos 2 caracteres
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
