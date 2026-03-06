import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, User, Phone, Wrench, Clock, ChevronRight, ArrowLeft, 
  Save, X, MessageCircle, MapPin, Home, Building2, Pencil,
  ChevronDown, Mail
} from 'lucide-react';
import { RepairItem, RepairStatus } from '../types';

interface CustomerListProps {
  repairs: RepairItem[];
  onSelectCustomer: (phone: string) => void;
  onEditRepair?: (repair: RepairItem) => void;
  onSaveCustomerName?: (phone: string, newName: string) => void;
}

interface CustomerRecord {
  name: string;
  phone: string;
  repairs: RepairItem[];
  lastVisit: string;
  totalSpent: number;
  addresses: string[];
}

const CustomerList: React.FC<CustomerListProps> = ({ repairs, onSelectCustomer, onEditRepair, onSaveCustomerName }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerRecord>();
    repairs.forEach(r => {
      const key = r.customerPhone;
      if (!map.has(key)) {
        map.set(key, {
          name: r.customerName, phone: r.customerPhone, repairs: [],
          lastVisit: r.entryDate, totalSpent: 0,
          addresses: [],
        });
      }
      const c = map.get(key)!;
      c.repairs.push(r);
      if (new Date(r.entryDate) > new Date(c.lastVisit)) c.lastVisit = r.entryDate;
      if (r.customerName && r.customerName.length > c.name.length) c.name = r.customerName;
      if (r.address && !c.addresses.includes(r.address)) c.addresses.push(r.address);
    });
    let arr = Array.from(map.values());
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      arr = arr.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [repairs, searchTerm]);

  const allLetters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ#'.split('');

  const grouped = useMemo(() => {
    const g: Record<string, CustomerRecord[]> = {};
    customers.forEach(c => {
      const first = c.name.charAt(0).toUpperCase();
      const letter = allLetters.includes(first) ? first : '#';
      if (!g[letter]) g[letter] = [];
      g[letter].push(c);
    });
    return g;
  }, [customers]);

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
    setSelectedCustomer(c);
    setEditingName(false);
    setEditName(c.name);
  };

  const handleSaveName = () => {
    if (!selectedCustomer || !editName.trim()) return;
    if (onSaveCustomerName) {
      onSaveCustomerName(selectedCustomer.phone, editName.trim());
    }
    setSelectedCustomer({ ...selectedCustomer, name: editName.trim() });
    setEditingName(false);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const p = phone.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=34${p}&text=${encodeURIComponent(`Hola ${name}`)}`);
  };

  const handleCall = (phone: string) => window.open(`tel:${phone}`, '_self');

  // ─── CUSTOMER DETAIL ──
  if (selectedCustomer) {
    const c = selectedCustomer;
    const activeRepairs = c.repairs.filter(r => r.status !== RepairStatus.DELIVERED && r.status !== RepairStatus.CANCELLED);
    const completedRepairs = c.repairs.filter(r => r.status === RepairStatus.DELIVERED || r.status === RepairStatus.CANCELLED);

    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedCustomer(null)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ficha de Cliente</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{c.repairs.length} reparaciones registradas</p>
          </div>
        </div>

        {/* Customer Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-8 py-6 flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-black text-lg uppercase outline-none w-full max-w-sm" />
                  <button onClick={handleSaveName} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"><Save size={16} /></button>
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
              <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2">
                <Phone size={14} /> {c.phone}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Quick Actions */}
            <div className="flex gap-3">
              <button onClick={() => handleCall(c.phone)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                <Phone size={16} /> Llamar
              </button>
              <button onClick={() => handleWhatsApp(c.phone, c.name)} className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all">
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Total Reparaciones</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{c.repairs.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Activas</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{activeRepairs.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Primera Visita</p>
                <p className="text-sm font-black text-slate-600 mt-2">
                  {new Date(c.repairs.reduce((min, r) => new Date(r.entryDate) < new Date(min) ? r.entryDate : min, c.lastVisit)).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Addresses */}
            {c.addresses.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin size={12} /> Direcciones conocidas</p>
                {c.addresses.map((addr, i) => (
                  <p key={i} className="text-xs font-bold text-slate-600">{addr}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Repair History */}
        <div className="space-y-4">
          {activeRepairs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1 flex items-center gap-2">
                <Wrench size={12} /> Reparaciones Activas ({activeRepairs.length})
              </h4>
              {activeRepairs.map(r => (
                <div key={r.id} onClick={() => onEditRepair?.(r)}
                  className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white shrink-0 ${r.repairType === 'domicilio' ? 'bg-amber-500' : 'bg-slate-800'}`}>
                    {r.repairType === 'domicilio' ? <Home size={14} className="opacity-60" /> : <Building2 size={14} className="opacity-60" />}
                    <span className="text-[9px] leading-none mt-0.5">{r.rmaNumber.toString().padStart(5,'0').slice(-3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm uppercase truncate">{r.brand} {r.model}</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{r.problemDescription}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                  <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-500 shrink-0 transition-colors" />
                </div>
              ))}
            </div>
          )}

          {completedRepairs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Clock size={12} /> Historial ({completedRepairs.length})
              </h4>
              {completedRepairs.slice(0, 5).map(r => (
                <div key={r.id} onClick={() => onEditRepair?.(r)}
                  className="bg-white p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center gap-4 opacity-60 hover:opacity-100">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-[10px] font-black shrink-0">
                    {r.rmaNumber.toString().padStart(5,'0').slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-600 text-xs uppercase truncate">{r.brand} {r.model}</p>
                    <p className="text-[9px] text-slate-400">{new Date(r.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${statusColor(r.status)}`}>
                    {r.status === RepairStatus.DELIVERED ? 'Entregado' : 'Cancelado'}
                  </span>
                </div>
              ))}
              {completedRepairs.length > 5 && (
                <p className="text-[9px] text-slate-400 font-bold text-center">+{completedRepairs.length - 5} anteriores</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MAIN LIST WITH LETTER SIDEBAR ──
  return (
    <div className="flex gap-6 animate-in fade-in">
      {/* Letter Index Sidebar */}
      <div className="hidden md:flex flex-col items-center py-2 sticky top-0 self-start">
        {allLetters.map(l => {
          const hasClients = !!grouped[l];
          return (
            <button key={l} onClick={() => hasClients && scrollToLetter(l)}
              className={`w-8 h-7 flex items-center justify-center text-[10px] font-black rounded-lg transition-all ${
                activeLetter === l ? 'bg-blue-600 text-white shadow-md' :
                hasClients ? 'text-slate-600 hover:bg-slate-100 cursor-pointer' :
                'text-slate-200 cursor-default'
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Clientes</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{customers.length} registrados</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar nombre o teléfono..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveLetter(null); }} />
          </div>
        </div>

        {/* Mobile Letter Bar */}
        <div className="md:hidden flex gap-1 overflow-x-auto pb-2 px-1">
          {letters.map(l => (
            <button key={l} onClick={() => scrollToLetter(l)}
              className={`w-8 h-8 flex items-center justify-center text-[10px] font-black rounded-lg shrink-0 transition-all ${
                activeLetter === l ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-100'
              }`}>{l}</button>
          ))}
        </div>

        {/* Grouped List */}
        {customers.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <User size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin resultados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {letters.map(letter => (
              <div key={letter} ref={el => { sectionRefs.current[letter] = el; }}>
                {/* Letter Header */}
                <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-4 py-2 rounded-lg mb-1">
                  <span className="text-sm font-black text-blue-600 uppercase">{letter}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">({grouped[letter].length})</span>
                </div>

                {/* Customers in this letter */}
                {grouped[letter].map(c => (
                  <div key={c.phone} onClick={() => handleOpenCustomer(c)}
                    className="bg-white rounded-xl px-5 py-3.5 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group mb-1.5">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 text-xs font-black group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm uppercase tracking-tight truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>
                        <span className="flex items-center gap-1"><Wrench size={10} /> {c.repairs.length}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-[9px] font-bold text-slate-300 flex items-center gap-1 justify-end">
                        <Clock size={9} /> {new Date(c.lastVisit).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </p>
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
