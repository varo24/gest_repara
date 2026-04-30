import React, { useState, useMemo } from 'react';
import {
  Package, Plus, Edit2, Trash2, Search, X, AlertTriangle,
  TrendingUp, TrendingDown, BarChart2, Save, History,
  Boxes
} from 'lucide-react';
import { InventoryItem, StockMovement, AppSettings } from '../types';
import { storage } from '../lib/dataService';

interface InventarioProps {
  settings: AppSettings;
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const DEFAULT_CATEGORIES = ['pantallas', 'baterias', 'conectores', 'camaras', 'mecanica', 'otros'];

type FormData = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: FormData = {
  ref: '',
  description: '',
  category: 'otros',
  ean: '',
  supplierRef: '',
  stock: 0,
  minStock: 1,
  costPrice: 0,
  salePrice: 0,
  location: '',
};

const Inventario: React.FC<InventarioProps> = ({ settings, inventoryItems, stockMovements, onNotify }) => {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'historial'>('catalogo');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAlert, setFilterAlert] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categories = settings.inventoryCategories?.length ? settings.inventoryCategories : DEFAULT_CATEGORIES;

  const filtered = useMemo(() => inventoryItems.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.ref.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.ean || '').toLowerCase().includes(q);
    const matchCat = !filterCategory || item.category === filterCategory;
    const matchAlert = !filterAlert || item.stock <= item.minStock;
    return matchSearch && matchCat && matchAlert;
  }), [inventoryItems, search, filterCategory, filterAlert]);

  const totalValue = inventoryItems.reduce((s, i) => s + i.stock * i.costPrice, 0);
  const lowStockCount = inventoryItems.filter(i => i.stock > 0 && i.stock <= i.minStock).length;
  const outOfStockCount = inventoryItems.filter(i => i.stock === 0).length;

  const openNew = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_FORM, category: categories[0] || 'otros' });
    setShowForm(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      ref: item.ref,
      description: item.description,
      category: item.category,
      ean: item.ean || '',
      supplierRef: item.supplierRef || '',
      stock: item.stock,
      minStock: item.minStock,
      costPrice: item.costPrice,
      salePrice: item.salePrice || 0,
      location: item.location || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.ref.trim() || !formData.description.trim()) {
      onNotify('error', 'Referencia y descripción son obligatorios');
      return;
    }
    const now = new Date().toISOString();
    const id = editingItem?.id || crypto.randomUUID();
    const item: InventoryItem = {
      id,
      ...formData,
      ref: formData.ref.trim(),
      description: formData.description.trim(),
      createdAt: editingItem?.createdAt || now,
      updatedAt: now,
    };
    // Record adjustment if stock changed on edit
    if (editingItem && editingItem.stock !== formData.stock) {
      const diff = formData.stock - editingItem.stock;
      const movement: StockMovement = {
        id: crypto.randomUUID(),
        itemId: id,
        ref: item.ref,
        description: item.description,
        type: 'ajuste',
        qty: diff,
        costPrice: item.costPrice,
        date: now.slice(0, 10),
        origin: 'manual',
        notes: 'Ajuste manual de stock',
        createdAt: now,
      };
      await storage.save('stock_movements', movement.id, movement);
    }
    await storage.save('inventory', id, item);
    onNotify('success', editingItem ? 'Artículo actualizado' : 'Artículo añadido al catálogo');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await storage.remove('inventory', id);
    onNotify('success', 'Artículo eliminado');
    setDeletingId(null);
  };

  const stockBadgeClass = (item: InventoryItem) => {
    if (item.stock === 0) return 'text-red-600 bg-red-50';
    if (item.stock <= item.minStock) return 'text-amber-600 bg-amber-50';
    return 'text-emerald-600 bg-emerald-50';
  };

  const stockDotClass = (item: InventoryItem) => {
    if (item.stock === 0) return 'bg-red-500';
    if (item.stock <= item.minStock) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Inventario</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Almacén · Catálogo de Repuestos</p>
        </div>
        <button
          onClick={openNew}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={16} /> Nuevo Artículo
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total artículos</p>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-500"><Boxes size={14} /></div>
          </div>
          <p className="text-2xl font-black mt-2 text-slate-900">{inventoryItems.length}</p>
        </div>
        <div className={`bg-white p-5 rounded-2xl border shadow-sm ${lowStockCount > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
          <div className="flex items-start justify-between">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stock bajo</p>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-500"><AlertTriangle size={14} /></div>
          </div>
          <p className={`text-2xl font-black mt-2 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{lowStockCount}</p>
        </div>
        <div className={`bg-white p-5 rounded-2xl border shadow-sm ${outOfStockCount > 0 ? 'border-red-200' : 'border-slate-100'}`}>
          <div className="flex items-start justify-between">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin stock</p>
            <div className="p-2 rounded-xl bg-red-50 text-red-500"><TrendingDown size={14} /></div>
          </div>
          <p className={`text-2xl font-black mt-2 ${outOfStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{outOfStockCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor en stock</p>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-500"><BarChart2 size={14} /></div>
          </div>
          <p className="text-2xl font-black mt-2 text-slate-900">{totalValue.toFixed(0)}€</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-t-2xl border-b border-slate-200 overflow-hidden">
        {([
          { id: 'catalogo', label: 'Catálogo', icon: Package },
          { id: 'historial', label: 'Historial de Movimientos', icon: History },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all relative ${
              activeTab === tab.id ? 'text-blue-600 bg-white' : 'text-slate-400 bg-slate-50 hover:text-slate-600'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
          </button>
        ))}
      </div>

      {activeTab === 'catalogo' && (
        <div className="bg-white rounded-b-2xl border border-t-0 border-slate-100 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ref, descripción, EAN..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
            >
              <option value="">Todas las categorías</option>
              {categories.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <button
              onClick={() => setFilterAlert(v => !v)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                filterAlert ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={14} />
              Solo alertas
            </button>
          </div>

          {/* Item rows */}
          <div className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Package size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {inventoryItems.length === 0 ? 'Catálogo vacío — añade tu primer artículo' : 'Sin resultados para esta búsqueda'}
                </p>
              </div>
            ) : (
              filtered.map(item => (
                <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-all group">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${stockDotClass(item)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 uppercase">{item.description}</span>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.ref}</span>
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full capitalize">{item.category}</span>
                    </div>
                    {item.location && <p className="text-[9px] text-slate-400 mt-0.5">📍 {item.location}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-black px-3 py-1 rounded-lg ${stockBadgeClass(item)}`}>
                      {item.stock} uds
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1">mín: {item.minStock}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-700">{item.costPrice.toFixed(2)}€</p>
                    {item.salePrice ? <p className="text-[9px] text-slate-400">PVP: {item.salePrice.toFixed(2)}€</p> : null}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeletingId(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-3 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            {filtered.length} de {inventoryItems.length} artículos
          </div>
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="bg-white rounded-b-2xl border border-t-0 border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {stockMovements.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <History size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin movimientos registrados</p>
              </div>
            ) : (
              [...stockMovements]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 150)
                .map(m => (
                  <div key={m.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-all">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      m.type === 'entrada' ? 'bg-emerald-100 text-emerald-600' :
                      m.type === 'salida' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {m.type === 'entrada' ? <TrendingUp size={14} /> : m.type === 'salida' ? <TrendingDown size={14} /> : <BarChart2 size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 uppercase truncate">{m.description}</p>
                      <p className="text-[9px] text-slate-400">{m.ref} · {m.notes || m.origin}</p>
                    </div>
                    <div className={`text-sm font-black shrink-0 ${m.qty >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.qty > 0 ? '+' : ''}{m.qty}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold text-slate-500">{m.date}</p>
                      <p className="text-[9px] text-slate-300 capitalize">{m.origin}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* New/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight">{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Referencia *</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.ref}
                  onChange={e => setFormData(f => ({ ...f, ref: e.target.value }))}
                  placeholder="REF-001"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  value={formData.category}
                  onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción *</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Pantalla LCD iPhone 13 Pro Original"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EAN / Código barras</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  value={formData.ean}
                  onChange={e => setFormData(f => ({ ...f, ean: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ref. Proveedor</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  value={formData.supplierRef}
                  onChange={e => setFormData(f => ({ ...f, supplierRef: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stock actual</label>
                <input
                  type="number" min="0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:outline-none"
                  value={formData.stock}
                  onChange={e => setFormData(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stock mínimo</label>
                <input
                  type="number" min="0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:outline-none"
                  value={formData.minStock}
                  onChange={e => setFormData(f => ({ ...f, minStock: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio coste (€)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:outline-none"
                  value={formData.costPrice}
                  onChange={e => setFormData(f => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio venta (€)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:outline-none"
                  value={formData.salePrice ?? 0}
                  onChange={e => setFormData(f => ({ ...f, salePrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ubicación</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  value={formData.location}
                  onChange={e => setFormData(f => ({ ...f, location: e.target.value }))}
                  placeholder="Ej: Estante A3, Cajón 2"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Save size={14} /> {editingItem ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-6">
            <div className="text-center">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl mb-3">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <p className="text-sm font-black uppercase">¿Eliminar artículo?</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Esta acción no se puede deshacer</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
