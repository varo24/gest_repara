import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Wrench, Users, FileText, Receipt, ArrowRight } from 'lucide-react';
import { RepairItem, Budget, Customer, ViewType } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultType = 'repair' | 'customer' | 'budget' | 'invoice';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  action: () => void;
}

interface Group {
  type: ResultType;
  label: string;
  color: string;
  Icon: React.ElementType;
  items: SearchResult[];
}

interface Props {
  repairs:    RepairItem[];
  budgets:    Budget[];
  customers:  Customer[];
  invoices:   any[];
  onNavigate: (view: ViewType) => void;
  onEditRepair: (repair: RepairItem) => void;
  // Controlled open — lets App.tsx open via header lupa or Ctrl+K
  externalOpen?:    boolean;
  onExternalClose?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PER_GROUP = 4;
const MIN_CHARS     = 2;
const DEBOUNCE_MS   = 200;

const GREEN = '#2e7d32';

// ── Component ─────────────────────────────────────────────────────────────────

const GlobalSearch: React.FC<Props> = ({
  repairs, budgets, customers, invoices,
  onNavigate, onEditRepair,
  externalOpen, onExternalClose,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery]               = useState('');
  const [debouncedQ, setDebouncedQ]     = useState('');
  const [focusedIdx, setFocusedIdx]     = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = externalOpen === true || internalOpen;

  // ── Open / close ────────────────────────────────────────────────────────────

  const openSearch = useCallback(() => {
    setInternalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setInternalOpen(false);
    setQuery('');
    setDebouncedQ('');
    setFocusedIdx(-1);
    onExternalClose?.();
  }, [onExternalClose]);

  // Focus when externally opened
  useEffect(() => {
    if (externalOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [externalOpen]);

  // ── Debounce ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setFocusedIdx(-1); }, [debouncedQ]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape' && isOpen) closeSearch();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, openSearch, closeSearch]);

  // ── Search ───────────────────────────────────────────────────────────────────

  const groups = useMemo((): Group[] => {
    const q = debouncedQ.trim().toLowerCase();
    if (q.length < MIN_CHARS) return [];

    const repairItems: SearchResult[] = repairs
      .filter(r =>
        `${r.rmaNumber}`.includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.serialNumber  || '').toLowerCase().includes(q) ||
        (r.brand         || '').toLowerCase().includes(q) ||
        (r.model         || '').toLowerCase().includes(q) ||
        (r.problemDescription || '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP)
      .map(r => ({
        type: 'repair' as const,
        id: r.id,
        title: `RMA-${String(r.rmaNumber).padStart(5, '0')}  ${r.brand || ''} ${r.model || ''}`.trimEnd(),
        subtitle: `${r.customerName} · ${r.status}`,
        action: () => { onEditRepair(r); closeSearch(); },
      }));

    const customerItems: SearchResult[] = customers
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP)
      .map(c => ({
        type: 'customer' as const,
        id: c.id,
        title: c.name,
        subtitle: [c.phone, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto',
        action: () => { onNavigate('customers'); closeSearch(); },
      }));

    const budgetItems: SearchResult[] = budgets
      .filter(b =>
        (b.rmaNumber ? `${b.rmaNumber}` : '').includes(q) ||
        (b.customerName || '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP)
      .map(b => ({
        type: 'budget' as const,
        id: b.id,
        title: b.rmaNumber
          ? `Presupuesto RMA-${String(b.rmaNumber).padStart(5, '0')}`
          : `Presupuesto · ${b.customerName || '—'}`,
        subtitle: `${b.customerName || '—'} · ${b.status === 'pending' ? 'Pendiente' : b.status === 'accepted' ? 'Aceptado' : 'Rechazado'} · ${Number(b.total ?? 0).toFixed(2)} €`,
        action: () => { onNavigate('budgets'); closeSearch(); },
      }));

    const invoiceItems: SearchResult[] = (invoices as any[])
      .filter(inv =>
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.customerName  || '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP)
      .map(inv => ({
        type: 'invoice' as const,
        id: inv.id,
        title: inv.invoiceNumber || inv.id,
        subtitle: `${inv.customerName || '—'} · ${inv.date || ''} · ${Number(inv.total ?? 0).toFixed(2)} €`,
        action: () => { onNavigate('invoices'); closeSearch(); },
      }));

    const result: Group[] = [];
    if (repairItems.length)  result.push({ type: 'repair',   label: 'Reparaciones', color: '#1565c0', Icon: Wrench,   items: repairItems });
    if (customerItems.length) result.push({ type: 'customer', label: 'Clientes',     color: GREEN,     Icon: Users,    items: customerItems });
    if (budgetItems.length)  result.push({ type: 'budget',   label: 'Presupuestos', color: '#6a1b9a', Icon: FileText, items: budgetItems });
    if (invoiceItems.length) result.push({ type: 'invoice',  label: 'Facturas',     color: '#e65100', Icon: Receipt,  items: invoiceItems });
    return result;
  }, [debouncedQ, repairs, customers, budgets, invoices, onEditRepair, onNavigate, closeSearch]);

  // Flat list used to map focusedIdx ↔ visual position
  const flatResults = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // ── Arrow-key / Enter navigation ─────────────────────────────────────────────

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && focusedIdx >= 0) flatResults[focusedIdx]?.action();
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Sidebar trigger ──────────────────────────────────────────────────── */}
      <button
        onClick={openSearch}
        className="sidebar-search-btn w-full flex items-center gap-3 px-4 py-[9px] rounded-xl font-bold transition-all"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}
      >
        <Search size={14} style={{ flexShrink: 0 }} />
        <span className="sidebar-label flex-1 text-left">Buscar…</span>
        <kbd className="sidebar-label text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(255,255,255,0.08)' }}>⌘K</kbd>
      </button>

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[550] flex justify-center gs-search-wrap"
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda global"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeSearch}
          />

          {/* Panel */}
          <div
            className="relative bg-white overflow-hidden flex flex-col"
            style={{
              width: '92vw',
              minWidth: 280,
              maxWidth: 680,
              borderRadius: 16,
              maxHeight: '82vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              animation: 'gs-slide-down 0.18s ease',
            }}
          >
            {/* ── Input ─────────────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 shrink-0"
              style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}
            >
              <Search size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar reparaciones, clientes, facturas…"
                className="flex-1 text-slate-900 placeholder-slate-300 outline-none bg-transparent"
                style={{ fontSize: 16, fontWeight: 600 }}
                autoComplete="off"
                spellCheck={false}
              />
              {query ? (
                <button
                  onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                  className="p-1 rounded-lg text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd
                  className="text-[9px] px-2 py-1 rounded-lg font-mono text-slate-300 shrink-0"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                >
                  ESC
                </kbd>
              )}
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <div className="overflow-y-auto flex-1">
              {debouncedQ.length < MIN_CHARS ? (
                <p className="px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: '#cbd5e1' }}>
                  Escribe al menos {MIN_CHARS} caracteres…
                </p>
              ) : groups.length === 0 ? (
                <div className="py-12 text-center">
                  <Search size={28} style={{ color: '#e2e8f0', margin: '0 auto 10px' }} />
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#cbd5e1' }}>
                    Sin resultados para "{debouncedQ}"
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {(() => {
                    let offset = 0;
                    return groups.map((group, gi) => {
                      const GroupIcon = group.Icon;
                      const groupOffset = offset;
                      offset += group.items.length;

                      return (
                        <div key={group.type}>
                          {/* Group label with separator */}
                          <div
                            className="flex items-center gap-2 px-4"
                            style={{
                              paddingTop: gi > 0 ? 10 : 8,
                              paddingBottom: 4,
                              marginTop: gi > 0 ? 8 : 0,
                              borderTop: gi > 0 ? '1px solid #f1f5f9' : 'none',
                            }}
                          >
                            <GroupIcon size={11} style={{ color: group.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: group.color }}>
                              {group.label}
                            </span>
                          </div>

                          {/* Items */}
                          <div className="px-2 pb-1">
                            {group.items.map((item, itemIdx) => {
                              const flatIdx  = groupOffset + itemIdx;
                              const isFocused = flatIdx === focusedIdx;

                              return (
                                <button
                                  key={item.id}
                                  onClick={item.action}
                                  onMouseEnter={() => setFocusedIdx(flatIdx)}
                                  className="w-full flex items-center gap-3 text-left transition-colors"
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    background: isFocused ? '#f0f7f0' : 'transparent',
                                  }}
                                >
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `${group.color}18` }}
                                  >
                                    <GroupIcon size={14} style={{ color: group.color }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate" style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>{item.title}</p>
                                    <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', marginTop: 1 }}>{item.subtitle}</p>
                                  </div>
                                  <ArrowRight
                                    size={13}
                                    style={{
                                      color: isFocused ? group.color : '#e2e8f0',
                                      flexShrink: 0,
                                      transition: 'color 0.15s',
                                    }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* ── Footer hints ──────────────────────────────────────────────── */}
            {groups.length > 0 && (
              <div
                className="flex items-center gap-4 shrink-0"
                style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9' }}
              >
                {[['↑↓', 'navegar'], ['↵', 'abrir']].map(([k, label]) => (
                  <span key={k} className="flex items-center gap-1">
                    <kbd className="text-[9px] px-1.5 py-0.5 rounded font-mono text-slate-400" style={{ background: '#f1f5f9' }}>{k}</kbd>
                    <span className="text-[9px] font-bold text-slate-300">{label}</span>
                  </span>
                ))}
                <span className="ml-auto text-[9px] font-bold text-slate-300">ESC cierra</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
