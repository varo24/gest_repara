import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, User, Phone, Wrench, Clock, ChevronRight, ArrowLeft, 
  Save, X, MessageCircle, MapPin, Home, Building2, Pencil,
  Plus, UserPlus
} from 'lucide-react';
import { RepairItem, RepairStatus, Customer } from '../types';

interface CustomerListProps {
  repairs: RepairItem[];
  customers: Customer[];
  onSelectCustomer: (phone: string) => void;
  onEditRepair?: (repair: RepairItem) => void;
  onSaveCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onNewRepairForCustomer?: (customer: { name: string; phone: string; address?: string; city?: string }) => void;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  email?: string;
  notes?: string;
  repairs: RepairItem[];
  lastVisit: string;
  addresses: string[];
  isStandalone: boolean;
}

const CustomerList: React.FC<CustomerListProps> = ({ repairs, customers, onSelectCustomer, onEditRepair, onSaveCustomer, onDeleteCustomer, onNewRepairForCustomer }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editingCity, setEditingCity] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', city: '', address: '', email: '', notes: '' });
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // ── Merge customers from repairs + standalone customers DB ──
  const allCustomers = useMemo((): CustomerRecord[] => {
    const map = new Map<string, CustomerRecord>();

    for (const c of customers) {
      map.set(c.phone, {
        id: c.id, name: c.name, phone: c.phone, city: c.city, address: c.address,
        email: c.email, notes: c.notes, repairs: [], lastVisit: c.createdAt || '',
        addresses: c.address ? [c.address] : [], isStandalone: true,
      });
    }

    for (const r of repairs) {
      const key = r.customerPhone;
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: `repair-${key}`, name: r.customerName, phone: r.customerPhone,
          city: r.city, address: r.address, repairs: [r], lastVisit: r.entryDate,
          addresses: r.address ? [r.address] : [], isStandalone: false,
        });
      } else {
        existing.repairs.push(r);
        if (new Date(r.entryDate) > new Date(existing.lastVisit)) existing.lastVisit = r.entryDate;
        if (r.customerName && r.customerName.length > existing.name.length) existing.name = r.customerName;
        if (r.address && !existing.addresses.includes(r.address)) existing.addresses.push(r.address);
        if (r.city && !existing.city) existing.city = r.city;
      }
    }

    let arr = Array.from(map.values());
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      arr = arr.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.city || '').toLowerCase().includes(q));
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [repairs, customers, searchTerm]);

  const allLetters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ#'.split('');
  const grouped = useMemo(() => {
    const g: Record<string, CustomerRecord[]> = {};
    allCustomers.forEach(c => {
      const first = c.name.charAt(0).toUpperCase();
      const letter = allLetters.includes(first) ? first : '#';
      if (!g[letter]) g[letter] = [];
      g[letter].push(c);
    });
    return g;
  }, [allCustomers]);
  const letters = allLetters.filter(l => grouped[l]);

  const scrollToLetter = (l: string) => {
    setActiveLetter(l);
    sectionRefs.current[l]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const statusColor = (s: RepairStatus) => {
    const c: Record<string, string> = {
      [RepairStatus.PENDING]: 'bg-yellow-400 text-yellow-900',
      [RepairStatus.DIAGNOSING]: 'bg-cyan-400 text-cyan-900',
      [RepairStatus.IN_PROGRESS]: 'bg-blue-500 text-white',
      [RepairStatus.WAITING_PARTS]: 'bg-orange-500 text-white',
      [RepairStatus.READY]: 'bg-emerald-500 text-white',
      [RepairStatus.DELIVERED]: 'bg-slate-400 text-white',
      [RepairStatus.CANCELLED]: 'bg-red-600 text-white',
    };
    return c[s] || 'bg-slate-200 text-slate-600';
  };

  const handleOpenCustomer = (c: CustomerRecord) => {
    setSelectedCustomer(c); setEditingName(false); setEditingCity(false);
    setEditName(c.name); setEditCity(c.city || '');
  };

  const handleSaveField = (field: 'name' | 'city') => {
    if (!selectedCustomer) return;
    const updated = { ...selectedCustomer, ...(field === 'name' ? { name: editName.trim() } : { city: editCity.trim() }) };
    if (onSaveCustomer) {
      onSaveCustomer({
        id: selectedCustomer.isStandalone ? selectedCustomer.id : `cust-${Date.now()}`,
        name: updated.name, phone: updated.phone, city: updated.city,
        address: updated.address, email: updated.email, notes: updated.notes,
        updatedAt: new Date().toISOString(),
      });
    }
    setSelectedCustomer(updated);
    if (field === 'name') setEditingName(false); else setEditingCity(false);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const p = phone.replace(/\D/g, '');
    const fullPhone = p.length > 9 ? p : `34${p}`;
    window.open(`whatsapp://send?phone=${fullPhone}&text=${encodeURIComponent(`Hola ${name}`)}`, '_self');
  };

  const handleCall = (phone: string) => window.open(`tel:${phone}`, '_self');

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;
    if (onSaveCustomer) {
      onSaveCustomer({
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: newCustomer.name.trim(), phone: newCustomer.phone.trim(),
        city: newCustomer.city.trim() || undefined, address: newCustomer.address.trim() || undefined,
        email: newCustomer.email.trim() || undefined, notes: newCustomer.notes.trim() || undefined,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
    setNewCustomer({ name: '', phone: '', city: '', address: '', email: '', notes: '' });
    setShowAddForm(false);
  };

  // ─── CUSTOMER DETAIL ──
  if (selectedCustomer) {
    const c = selectedCustomer;
    const activeRepairs = c.repairs.filter(r => r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED);
    const completedRepairs = c.repairs.filter(r => r.status === RepairStatus.DELIVERED || r.status === RepairStatus.CANCELLED);

    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedCustomer(null)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ficha de Cliente</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
              {c.repairs.length > 0 ? `${c.repairs.length} reparaciones` : 'Sin reparaciones'}
            </p>
          </div>
          {onNewRepairForCustomer && (
            <button onClick={() => onNewRepairForCustomer({ name: c.name, phone: c.phone, address: c.address, city: c.city })}
              className="px-5 py-3 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center gap-2 hover:bg-black shadow-xl active:scale-95">
              <Plus size={16} /> Nueva Reparación
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-8 py-6 flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveField('name')}
                    className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-black text-lg uppercase outline-none w-full max-w-sm" />
                  <button onClick={() => handleSaveField('name')} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"><Save size={16} /></button>
                  <button onClick={() => setEditingName(false)} className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">{c.name}</h3>
                  <button onClick={() => { setEditName(c.name); setEditingName(true); }} className="p-1.5 bg-white/10 text-white/60 rounded-lg hover:bg-white/20 hover:text-white transition-colors">
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2"><Phone size={14} /> {c.phone}</p>
              {/* Ciudad editable */}
              <div className="mt-1">
                {editingCity ? (
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin size={12} className="text-amber-400 shrink-0" />
                    <input autoFocus type="text" value={editCity} onChange={e => setEditCity(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveField('city')} placeholder="Ciudad..."
                      className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-white font-bold text-xs outline-none w-40" />
                    <button onClick={() => handleSaveField('city')} className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"><Save size={12} /></button>
                    <button onClick={() => setEditingCity(false)} className="p-1 bg-white/10 text-white rounded-md hover:bg-white/20"><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditCity(c.city || ''); setEditingCity(true); }}
                    className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-amber-400 transition-colors mt-0.5">
                    <MapPin size={12} />
                    {c.city ? <span className="font-bold">{c.city}</span> : <span className="italic opacity-60">Añadir ciudad</span>}
                    <Pencil size={10} className="opacity-40" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex gap-3">
              <button onClick={() => handleCall(c.phone)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                <Phone size={16} /> Llamar
              </button>
              <button onClick={() => handleWhatsApp(c.phone, c.name)} className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all">
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Reparaciones</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{c.repairs.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Activas</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{activeRepairs.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Ciudad</p>
                <p className="text-sm font-black text-slate-600 mt-2">{c.city || '—'}</p>
              </div>
            </div>

            {c.addresses.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin size={12} /> Direcciones</p>
                {c.addresses.map((addr, i) => <p key={i} className="text-xs font-bold text-slate-600">{addr}</p>)}
              </div>
            )}
            {c.notes && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Notas</p>
                <p className="text-xs text-slate-600">{c.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Repairs */}
        <div className="space-y-4">
          {activeRepairs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1 flex items-center gap-2"><Wrench size={12} /> Activas ({activeRepairs.length})</h4>
              {activeRepairs.map(r => (
                <div key={r.id} onClick={() => onEditRepair?.(r)} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white shrink-0 ${r.repairType === 'domicilio' ? 'bg-amber-500' : 'bg-slate-800'}`}>
                    {r.repairType === 'domicilio' ? <Home size={14} className="opacity-60" /> : <Building2 size={14} className="opacity-60" />}
                    <span className="text-[9px] leading-none mt-0.5">{r.rmaNumber.toString().padStart(5,'0').slice(-3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm uppercase truncate">{r.brand} {r.model}</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{r.problemDescription}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${statusColor(r.status)}`}>{r.status}</span>
                  <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-500 shrink-0" />
                </div>
              ))}
            </div>
          )}
          {completedRepairs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2"><Clock size={12} /> Historial ({completedRepairs.length})</h4>
              {completedRepairs.slice(0, 5).map(r => (
                <div key={r.id} onClick={() => onEditRepair?.(r)} className="bg-white p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center gap-4 opacity-60 hover:opacity-100">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-[10px] font-black shrink-0">{r.rmaNumber.toString().padStart(5,'0').slice(-3)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-600 text-xs uppercase truncate">{r.brand} {r.model}</p>
                    <p className="text-[9px] text-slate-400">{new Date(r.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${statusColor(r.status)}`}>{r.status === RepairStatus.DELIVERED ? 'Entregado' : 'Cancelado'}</span>
                </div>
              ))}
              {completedRepairs.length > 5 && <p className="text-[9px] text-slate-400 font-bold text-center">+{completedRepairs.length - 5} anteriores</p>}
            </div>
          )}
          {c.repairs.length === 0 && (
            <div className="bg-white py-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
              <Wrench size={28} className="mx-auto text-slate-200 mb-3" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin reparaciones registradas</p>
              {onNewRepairForCustomer && (
                <button onClick={() => onNewRepairForCustomer({ name: c.name, phone: c.phone, address: c.address, city: c.city })}
                  className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700">
                  <Plus size={14} className="inline mr-1" /> Crear Reparación
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── ADD CUSTOMER FORM ──
  if (showAddForm) {
    return (
      <div className="max-w-lg mx-auto animate-in fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setShowAddForm(false)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm"><ArrowLeft size={20} /></button>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nuevo Cliente</h2>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre *</label>
            <input type="text" placeholder="Nombre completo" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono *</label>
            <input type="tel" placeholder="Teléfono" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Ciudad</label>
              <input type="text" placeholder="Ciudad" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <input type="email" placeholder="Email" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</label>
            <input type="text" placeholder="Calle, número, piso" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas</label>
            <textarea rows={2} placeholder="Notas sobre el cliente..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              value={newCustomer.notes} onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})} />
          </div>
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button onClick={() => setShowAddForm(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50">Cancelar</button>
            <button onClick={handleAddCustomer} disabled={!newCustomer.name.trim() || !newCustomer.phone.trim()}
              className="flex-1 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
              <Save size={16} /> Guardar Cliente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN LIST ──
  return (
    <div className="flex gap-6 animate-in fade-in">
      <div className="hidden md:flex flex-col items-center py-2 sticky top-0 self-start">
        {allLetters.map(l => {
          const hasClients = !!grouped[l];
          return (
            <button key={l} onClick={() => hasClients && scrollToLetter(l)}
              className={`w-8 h-7 flex items-center justify-center text-[10px] font-black rounded-lg transition-all ${
                activeLetter === l ? 'bg-blue-600 text-white shadow-md' :
                hasClients ? 'text-slate-600 hover:bg-slate-100 cursor-pointer' : 'text-slate-200 cursor-default'
              }`}>{l}</button>
          );
        })}
      </div>

      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Agenda de Clientes</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{allCustomers.length} registrados</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-60">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Nombre, teléfono o ciudad..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveLetter(null); }} />
            </div>
            <button onClick={() => setShowAddForm(true)}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95">
              <UserPlus size={16} /> Nuevo
            </button>
          </div>
        </div>

        <div className="md:hidden flex gap-1 overflow-x-auto pb-2 px-1">
          {letters.map(l => (
            <button key={l} onClick={() => scrollToLetter(l)}
              className={`w-8 h-8 flex items-center justify-center text-[10px] font-black rounded-lg shrink-0 transition-all ${
                activeLetter === l ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-100'
              }`}>{l}</button>
          ))}
        </div>

        {allCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <User size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin resultados</p>
            <button onClick={() => setShowAddForm(true)} className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700">
              <UserPlus size={14} className="inline mr-1" /> Añadir cliente
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {letters.map(letter => (
              <div key={letter} ref={el => { sectionRefs.current[letter] = el; }}>
                <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-4 py-2 rounded-lg mb-1">
                  <span className="text-sm font-black text-blue-600 uppercase">{letter}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">({grouped[letter].length})</span>
                </div>
                {grouped[letter].map(c => (
                  <div key={c.phone} onClick={() => handleOpenCustomer(c)}
                    className="bg-white rounded-xl px-5 py-3.5 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group mb-1.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                      c.isStandalone && c.repairs.length === 0 ? 'bg-violet-100 text-violet-500 group-hover:bg-violet-600 group-hover:text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-600 group-hover:text-white'
                    }`}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm uppercase tracking-tight truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>
                        {c.repairs.length > 0 && <span className="flex items-center gap-1"><Wrench size={10} /> {c.repairs.length}</span>}
                        {c.city && <span className="flex items-center gap-1"><MapPin size={10} /> {c.city}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      {c.lastVisit && (
                        <p className="text-[9px] font-bold text-slate-300 flex items-center gap-1 justify-end">
                          <Clock size={9} /> {new Date(c.lastVisit).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-500 shrink-0 transition-colors" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerList;
