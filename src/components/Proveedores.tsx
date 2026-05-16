import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Truck, Search, Plus, ArrowLeft, Phone, Mail, Globe, Building2,
  Edit2, Trash2, Save, FileText, Package, BarChart2,
  Euro, TrendingUp, Clock, ExternalLink,
} from 'lucide-react';
import { Supplier, StockMovement } from '../types';
import { storage } from '../lib/dataService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ProveedoresProps {
  suppliers: Supplier[];
  facturasImportadas: any[];
  stockMovements: StockMovement[];
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
  onBack: () => void;
  initialSupplierName?: string | null;
  settings?: any;
}

const PAYMENT_TERMS = ['Contado', '15 días', '30 días', '60 días', '90 días'];
const CATEGORIES    = ['piezas', 'herramientas', 'consumibles', 'servicios', 'electrónica', 'otros'];
const MONTHS        = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmtDate  = (iso: string) => { try { return new Date(iso).toLocaleDateString('es-ES'); } catch { return iso ?? '—'; } };
const fmtEuros = (n?: number)  => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

const matchesSupplier = (factura: any, supplier: Supplier): boolean => {
  const prov = (factura.proveedor || '').toLowerCase();
  const name = supplier.name.toLowerCase();
  const com  = (supplier.comercialName || '').toLowerCase();
  return prov.includes(name) || name.includes(prov) || (com && (prov.includes(com) || com.includes(prov)));
};

const emptyForm = (): Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '', comercialName: '', taxId: '', email: '', phone: '',
  address: '', city: '', country: 'España', website: '', iban: '',
  paymentTerms: 'Contado', notes: '', categories: [],
});

type View = 'list' | 'detail' | 'form';

export default function Proveedores({
  suppliers, facturasImportadas, stockMovements, onNotify, onBack, initialSupplierName,
}: ProveedoresProps) {
  const [view, setView]                   = useState<View>(() => {
    if (initialSupplierName) return 'detail';
    return 'list';
  });
  const [selected, setSelected]           = useState<Supplier | null>(() => {
    if (!initialSupplierName) return null;
    return suppliers.find(s =>
      s.name.toLowerCase().includes(initialSupplierName.toLowerCase()) ||
      initialSupplierName.toLowerCase().includes(s.name.toLowerCase())
    ) || null;
  });

  // Respond to prop changes (e.g., navigation from ArchivoFacturas with a supplier name)
  useEffect(() => {
    if (!initialSupplierName) return;
    const found = suppliers.find(s =>
      s.name.toLowerCase().includes(initialSupplierName.toLowerCase()) ||
      initialSupplierName.toLowerCase().includes(s.name.toLowerCase())
    );
    if (found) { setSelected(found); setView('detail'); }
  }, [initialSupplierName]); // eslint-disable-line
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm]                   = useState(emptyForm());
  const [search, setSearch]               = useState('');
  const [filterCat, setFilterCat]         = useState('');
  const [activeTab, setActiveTab]         = useState<'facturas' | 'stock'>('facturas');
  const [isSaving, setIsSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);

  // ── Computed per supplier ────────────────────────────────────────────────────

  const facturasBySupplier = useCallback((s: Supplier) =>
    facturasImportadas.filter(f => matchesSupplier(f, s))
  , [facturasImportadas]);

  const totalBySupplier = useCallback((s: Supplier) =>
    facturasBySupplier(s).reduce((acc, f) => acc + (f.total ?? 0), 0)
  , [facturasBySupplier]);

  const lastBuyDate = useCallback((s: Supplier) => {
    const dates = facturasBySupplier(s).map(f => f.fecha).filter(Boolean).sort().reverse();
    return dates[0] || null;
  }, [facturasBySupplier]);

  // ── Global stats ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const yearSpend = facturasImportadas
      .filter(f => f.fecha && new Date(f.fecha).getFullYear() === thisYear)
      .reduce((acc, f) => acc + (f.total ?? 0), 0);

    const bySupplier = suppliers.map(s => ({ s, total: totalBySupplier(s) })).sort((a, b) => b.total - a.total);
    const topSupplier = bySupplier[0]?.s?.name ?? '—';

    const pendingFacturas = facturasImportadas.filter(f => !f.pagada && !f.pdfUrl?.includes('pagada')).length;

    return { total: suppliers.length, yearSpend, topSupplier, pendingFacturas };
  }, [suppliers, facturasImportadas, totalBySupplier]);

  // ── List filtered ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = suppliers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.comercialName || '').toLowerCase().includes(q) ||
        (s.taxId || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q)
      );
    }
    if (filterCat) list = list.filter(s => s.categories?.includes(filterCat));
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [suppliers, search, filterCat]);

  // ── Chart data for selected supplier ─────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!selected) return [];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const mo = d.getMonth();
      const yr = d.getFullYear();
      const total = facturasBySupplier(selected)
        .filter(f => {
          const fd = new Date(f.fecha);
          return fd.getMonth() === mo && fd.getFullYear() === yr;
        })
        .reduce((acc, f) => acc + (f.total ?? 0), 0);
      return { name: MONTHS[mo], total };
    });
  }, [selected, facturasBySupplier]);

  // ── Entrada stock movements (global, for context) ─────────────────────────────

  const entradaMovements = useMemo(() =>
    [...stockMovements]
      .filter(m => (m.origin === 'entrada-stock' || m.origin === 'correo') && m.supplierId === selected?.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50)
  , [stockMovements, selected]);

  // ── Form handlers ─────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingSupplier(null);
    setForm(emptyForm());
    setView('form');
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setForm({
      name: s.name, comercialName: s.comercialName || '', taxId: s.taxId || '',
      email: s.email || '', phone: s.phone || '', address: s.address || '',
      city: s.city || '', country: s.country || 'España', website: s.website || '',
      iban: s.iban || '', paymentTerms: s.paymentTerms || 'Contado',
      notes: s.notes || '', categories: s.categories || [],
    });
    setView('form');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { onNotify('error', 'El nombre del proveedor es obligatorio'); return; }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const id  = editingSupplier?.id || `SUPP-${Date.now()}`;
      const supplier: Supplier = {
        ...form,
        name: form.name.trim(),
        id,
        createdAt: editingSupplier?.createdAt || now,
        updatedAt: now,
      };
      await storage.save('suppliers', id, supplier);
      onNotify('success', editingSupplier ? `${supplier.name} actualizado` : `${supplier.name} añadido`);
      if (editingSupplier) { setSelected(supplier); setView('detail'); }
      else setView('list');
    } catch {
      onNotify('error', 'Error al guardar el proveedor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    try {
      await storage.remove('suppliers', s.id);
      onNotify('success', `${s.name} eliminado`);
      setConfirmDelete(null);
      setView('list');
      setSelected(null);
    } catch {
      onNotify('error', 'Error al eliminar el proveedor');
    }
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories?.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...(prev.categories || []), cat],
    }));
  };

  const inp = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition';
  const lbl = 'block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5';

  // ────────────────────────────────────────────────────────────────────────────
  // FORM VIEW
  // ────────────────────────────────────────────────────────────────────────────

  if (view === 'form') return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => setView(editingSupplier ? 'detail' : 'list')} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proveedores</p>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="md:col-span-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Identificación</p>
        </div>
        <div>
          <label className={lbl}>Nombre / Razón social *</label>
          <input className={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Distribuciones García S.L." />
        </div>
        <div>
          <label className={lbl}>Nombre comercial</label>
          <input className={inp} value={form.comercialName} onChange={e => setForm(p => ({ ...p, comercialName: e.target.value }))} placeholder="García Repuestos" />
        </div>
        <div>
          <label className={lbl}>CIF / NIF</label>
          <input className={inp} value={form.taxId} onChange={e => setForm(p => ({ ...p, taxId: e.target.value }))} placeholder="B-12345678" />
        </div>
        <div>
          <label className={lbl}>Condiciones de pago</label>
          <select className={inp} value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}>
            {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="md:col-span-2 mt-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Contacto</p>
        </div>
        <div>
          <label className={lbl}>Teléfono</label>
          <input className={inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="900 000 000" />
        </div>
        <div>
          <label className={lbl}>Email</label>
          <input className={inp} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="pedidos@proveedor.com" />
        </div>
        <div>
          <label className={lbl}>Sitio web</label>
          <input className={inp} value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://proveedor.com" />
        </div>
        <div>
          <label className={lbl}>IBAN</label>
          <input className={inp} value={form.iban} onChange={e => setForm(p => ({ ...p, iban: e.target.value }))} placeholder="ES12 1234 5678 90 1234567890" />
        </div>

        <div className="md:col-span-2 mt-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Dirección</p>
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>Dirección</label>
          <input className={inp} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Calle Ejemplo 1, Nave 5" />
        </div>
        <div>
          <label className={lbl}>Ciudad</label>
          <input className={inp} value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Madrid" />
        </div>
        <div>
          <label className={lbl}>País</label>
          <input className={inp} value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
        </div>

        <div className="md:col-span-2 mt-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Categorías de producto</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  form.categories?.includes(cat)
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-green-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 mt-2">
          <label className={lbl}>Notas internas</label>
          <textarea className={inp + ' resize-none'} rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observaciones, persona de contacto habitual, etc." />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setView(editingSupplier ? 'detail' : 'list')} className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3.5 bg-green-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-green-800 transition-all disabled:opacity-60">
          <Save size={15} /> {isSaving ? 'Guardando…' : 'Guardar Proveedor'}
        </button>
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ────────────────────────────────────────────────────────────────────────────

  if (view === 'detail' && selected) {
    const supplierFacturas = facturasBySupplier(selected).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const totalComprado    = supplierFacturas.reduce((acc, f) => acc + (f.total ?? 0), 0);

    return (
      <div className="space-y-5 animate-in fade-in duration-200 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('list'); setSelected(null); }} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proveedor</p>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{selected.name}</h2>
              {selected.comercialName && <p className="text-xs text-slate-500">{selected.comercialName}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEdit(selected)} className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">
              <Edit2 size={13} /> Editar
            </button>
            <button onClick={() => setConfirmDelete(selected)} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total comprado', value: fmtEuros(totalComprado), icon: Euro, color: '#2e7d32' },
            { label: 'Facturas', value: String(supplierFacturas.length), icon: FileText, color: '#0277bd' },
            { label: 'Última compra', value: lastBuyDate(selected) ? fmtDate(lastBuyDate(selected)!) : '—', icon: Clock, color: '#6a1b9a' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: k.color + '15' }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-tight">{k.value}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Supplier info + quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Datos</p>
            {selected.taxId     && <p className="text-sm"><span className="text-[9px] font-black text-slate-400 uppercase mr-2">CIF</span><span className="font-bold">{selected.taxId}</span></p>}
            {selected.address   && <p className="text-sm text-slate-600">{selected.address}{selected.city ? `, ${selected.city}` : ''}</p>}
            {selected.paymentTerms && <p className="text-sm"><span className="text-[9px] font-black text-slate-400 uppercase mr-2">Pago</span><span className="font-bold">{selected.paymentTerms}</span></p>}
            {selected.iban      && <p className="text-xs font-mono text-slate-500 break-all">{selected.iban}</p>}
            {selected.categories && selected.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selected.categories.map(c => (
                  <span key={c} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase">{c}</span>
                ))}
              </div>
            )}
            {selected.notes && <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">{selected.notes}</p>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Contacto rápido</p>
            {selected.phone && (
              <a href={`tel:${selected.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                <Phone size={16} className="text-green-600 shrink-0" />
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{selected.phone}</span>
              </a>
            )}
            {selected.email && (
              <>
                <a href={`mailto:${selected.email}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                  <Mail size={16} className="text-blue-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate">{selected.email}</span>
                </a>
                {selected.phone && (
                  <a
                    href={`https://wa.me/${selected.phone.replace(/\D/g, '').replace(/^0/, '34')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors group"
                  >
                    <span className="text-sm font-black text-green-700 group-hover:text-green-900">WhatsApp</span>
                  </a>
                )}
              </>
            )}
            {selected.website && (
              <a href={selected.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                <Globe size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 truncate">{selected.website}</span>
                <ExternalLink size={12} className="ml-auto text-slate-400" />
              </a>
            )}
            {!selected.phone && !selected.email && !selected.website && (
              <p className="text-xs text-slate-400 text-center py-4">Sin datos de contacto</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {(['facturas', 'stock'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab === 'facturas' ? <><FileText size={12} className="inline mr-1.5" />Facturas ({supplierFacturas.length})</> : <><Package size={12} className="inline mr-1.5" />Entradas Stock</>}
              </button>
            ))}
          </div>

          {/* Facturas tab */}
          {activeTab === 'facturas' && (
            <div className="p-5 space-y-5">
              {/* Bar chart */}
              {chartData.some(d => d.total > 0) && (
                <div className="h-40">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Compras últimos 6 meses</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}€`} />
                      <Tooltip formatter={(v: number) => [fmtEuros(v), 'Compras']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 11 }} />
                      <Bar dataKey="total" fill="#2e7d32" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {supplierFacturas.length === 0 ? (
                <div className="text-center py-10">
                  <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin facturas importadas</p>
                  <p className="text-xs text-slate-400 mt-1">Las facturas de este proveedor aparecerán aquí cuando se importen desde Correos</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <span>Nº Factura</span><span>Fecha</span><span className="text-right">Total</span><span>PDF</span>
                  </div>
                  {supplierFacturas.map(f => (
                    <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-bold text-slate-900 truncate">{f.numeroFactura || '—'}</p>
                      <p className="text-xs text-slate-500">{f.fecha ? fmtDate(f.fecha) : '—'}</p>
                      <p className="text-xs font-black text-slate-700 text-right">{fmtEuros(f.total)}</p>
                      {f.pdfUrl ? (
                        <a href={f.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors" title="Ver PDF">
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="w-7 h-7 flex items-center justify-center text-slate-200"><FileText size={12} /></span>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center px-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total comprado</span>
                    <span className="text-lg font-black text-green-700">{fmtEuros(totalComprado)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stock tab */}
          {activeTab === 'stock' && (
            <div className="p-5">
              {entradaMovements.length === 0 ? (
                <div className="text-center py-10">
                  <Package size={32} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin entradas de stock registradas</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Últimas entradas de stock del sistema (50 más recientes)
                  </p>
                  <div className="grid grid-cols-[2fr_1fr_auto_1fr] gap-3 px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <span>Artículo</span><span>Ref</span><span className="text-right">Cant.</span><span>Fecha</span>
                  </div>
                  {entradaMovements.map(m => (
                    <div key={m.id} className="grid grid-cols-[2fr_1fr_auto_1fr] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-bold text-slate-900 truncate">{m.description}</p>
                      <p className="text-xs font-mono text-slate-500 truncate">{m.ref}</p>
                      <p className="text-xs font-black text-green-700 text-right">+{m.qty}</p>
                      <p className="text-xs text-slate-500">{fmtDate(m.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-3">
                <div className="inline-flex p-4 bg-red-50 rounded-2xl"><Trash2 size={26} className="text-red-500" /></div>
                <h2 className="text-base font-black text-slate-900 uppercase">Eliminar proveedor</h2>
                <p className="text-xs text-slate-600">¿Eliminar <strong>{confirmDelete.name}</strong>? Las facturas vinculadas no se borran.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px]">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-in fade-in duration-200 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Truck size={22} className="text-green-700" /> Proveedores
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Agenda y ficha de proveedores con historial de compras</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-3 bg-green-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-green-800 transition-all shadow-lg shadow-green-700/20">
          <Plus size={15} /> Nuevo Proveedor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Proveedores',       value: stats.total,             color: '#2e7d32', icon: Truck },
          { label: 'Compras este año',  value: fmtEuros(stats.yearSpend), color: '#1565c0', icon: Euro },
          { label: 'Proveedor top',     value: stats.topSupplier,       color: '#6a1b9a', icon: TrendingUp },
          { label: 'Facturas recibidas',value: String(facturasImportadas.length), color: '#e65100', icon: FileText },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: s.color + '15' }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-slate-900 leading-tight truncate">{s.value}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, CIF, ciudad…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
          />
        </div>
        <select
          value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <Building2 size={40} className="text-slate-200 mx-auto mb-4" />
          <p className="font-black text-slate-400 uppercase text-sm tracking-widest">
            {search || filterCat ? 'Sin resultados' : 'Sin proveedores aún'}
          </p>
          {!search && !filterCat && (
            <button onClick={openNew} className="mt-4 px-5 py-2.5 bg-green-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-green-800 transition-all">
              <Plus size={13} className="inline mr-1.5" /> Añadir primer proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <span>Proveedor</span><span>CIF</span><span>Ciudad</span><span>Total comprado</span><span>Facturas</span><span></span>
          </div>
          {filtered.map(s => {
            const total   = totalBySupplier(s);
            const nFacts  = facturasBySupplier(s).length;
            return (
              <div
                key={s.id}
                onClick={() => { setSelected(s); setView('detail'); setActiveTab('facturas'); }}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-3 items-center px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate group-hover:text-green-700 transition-colors">{s.name}</p>
                  {s.comercialName && <p className="text-[10px] text-slate-400 truncate">{s.comercialName}</p>}
                  {s.categories && s.categories.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {s.categories.slice(0, 2).map(c => (
                        <span key={c} className="px-1.5 py-px bg-green-50 text-green-700 rounded text-[9px] font-black uppercase">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono truncate">{s.taxId || '—'}</p>
                <p className="text-xs text-slate-600 truncate">{s.city || '—'}</p>
                <p className="text-sm font-black text-slate-700">{total > 0 ? fmtEuros(total) : '—'}</p>
                <span className={`text-xs font-black px-2 py-1 rounded-full ${nFacts > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                  {nFacts}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); openEdit(s); }}
                  className="p-2 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
