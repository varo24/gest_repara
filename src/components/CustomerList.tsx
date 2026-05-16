import React, { useState, useMemo, useRef } from 'react';
import {
  Search, User, Phone, Wrench, Clock, ChevronRight, ArrowLeft,
  Save, X, MessageCircle, MapPin, Pencil, Plus, UserPlus, Trash2,
  Receipt, FileText, ShieldCheck, Calendar, Star, Award,
  Mail, ClipboardList, Printer
} from 'lucide-react';
import { RepairItem, RepairStatus, Customer, Budget, Warranty, Cita, AppSettings, FullInvoice, ViewType } from '../types';

interface CustomerListProps {
  repairs: RepairItem[];
  customers: Customer[];
  invoices?: FullInvoice[];
  budgets?: Budget[];
  warranties?: Warranty[];
  citas?: Cita[];
  settings?: AppSettings;
  onSelectCustomer: (phone: string) => void;
  onEditRepair?: (repair: RepairItem) => void;
  onSaveCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onNewRepairForCustomer?: (customer: { name: string; phone: string; address?: string; city?: string }) => void;
  onNewBudgetForCustomer?: (customer: { name: string; phone: string }) => void;
  onNewCitaForCustomer?: (customer: { name: string; phone: string }) => void;
  setView?: (view: ViewType) => void;
  onBack?: () => void;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  email?: string;
  taxId?: string;
  notes?: string;
  createdAt?: string;
  repairs: RepairItem[];
  lastVisit: string;
  addresses: string[];
  isStandalone: boolean;
}

type Tab = 'reparaciones' | 'facturas' | 'presupuestos' | 'garantias' | 'citas';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const STATUS_COLOR: Record<string, string> = {
  [RepairStatus.PENDING]:         'bg-yellow-400 text-yellow-900',
  [RepairStatus.DIAGNOSING]:      'bg-cyan-400 text-cyan-900',
  [RepairStatus.IN_PROGRESS]:     'bg-blue-500 text-white',
  [RepairStatus.WAITING_PARTS]:   'bg-orange-500 text-white',
  [RepairStatus.READY]:           'bg-emerald-500 text-white',
  [RepairStatus.DELIVERED]:       'bg-slate-400 text-white',
  [RepairStatus.CANCELLED]:       'bg-red-600 text-white',
  [RepairStatus.BUDGET_PENDING]:  'bg-violet-500 text-white',
  [RepairStatus.BUDGET_ACCEPTED]: 'bg-lime-400 text-lime-900',
  [RepairStatus.BUDGET_REJECTED]: 'bg-rose-500 text-white',
  [RepairStatus.SIN_REPARACION]:  'bg-slate-200 text-slate-600',
};

// ── Print customer history ────────────────────────────────────────────────────
const printCustomerHistory = (
  c: CustomerRecord,
  invoices: FullInvoice[],
  warranties: Warranty[],
  settings?: AppSettings,
) => {
  const esc = (s?: string | null) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const s = settings ?? { appName: 'Taller', address: '', phone: '', taxId: '' };
  const totalSpent = invoices.filter(i => i.status === 'cobrada').reduce((acc, i) => acc + (i.total || 0), 0);
  const activeWarranties = warranties.filter(w => w.status === 'activa');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Historial ${esc(c.name)}</title>
<style>
@page{size:A4;margin:14mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a}
.hdr{display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:3px solid #1a1a1a;margin-bottom:12px}
.shop{font-size:15px;font-weight:900;text-transform:uppercase}
.shop-info{font-size:8px;color:#666;margin-top:2px}
.title{text-align:right;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#555}
.cname{font-size:22px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-left:6px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
.metric{background:#f5f5f5;border-radius:6px;padding:10px;text-align:center}
.metric .lbl{font-size:8px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:1px}
.metric .val{font-size:18px;font-weight:900;margin-top:2px}
.section{margin-bottom:14px;border:1px solid #ddd;border-radius:5px;overflow:hidden}
.sh{background:#1a1a1a;color:#fff;padding:4px 10px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px}
table{width:100%;border-collapse:collapse}
th{background:#f5f5f5;padding:4px 8px;text-align:left;font-size:8.5px;font-weight:700;border:1px solid #ddd;text-transform:uppercase}
td{padding:4px 8px;border:1px solid #ddd;font-size:9.5px}
.footer{margin-top:14px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:7.5px;color:#bbb}
</style></head><body>
<div class="hdr">
  <div><div class="shop">${esc(s.appName)}</div><div class="shop-info">${[s.address,s.phone,s.taxId].filter(Boolean).join(' · ')}</div></div>
  <div><div class="title">Ficha de Cliente</div><div style="font-size:8px;color:#999;margin-top:4px">Generado: ${new Date().toLocaleString('es-ES')}</div></div>
</div>
<div class="cname">${esc(c.name)}
  ${totalSpent > 500 ? '<span class="badge" style="background:#fef3c7;color:#92400e">VIP</span>' : ''}
  ${c.repairs.length > 3 ? '<span class="badge" style="background:#dcfce7;color:#15803d">Habitual</span>' : ''}
</div>
<div style="font-size:9px;color:#666;margin-top:4px">${[c.phone, c.email, c.city].filter(Boolean).join(' · ')}${c.taxId ? ` · NIF ${c.taxId}` : ''}</div>
<div class="metrics">
  <div class="metric"><div class="lbl">Total gastado</div><div class="val" style="font-size:14px">${fmtMoney(totalSpent)}</div></div>
  <div class="metric"><div class="lbl">Reparaciones</div><div class="val">${c.repairs.length}</div></div>
  <div class="metric"><div class="lbl">Facturas</div><div class="val">${invoices.length}</div></div>
  <div class="metric"><div class="lbl">Garantías activas</div><div class="val" style="color:#2e7d32">${activeWarranties.length}</div></div>
</div>
${c.repairs.length > 0 ? `<div class="section"><div class="sh">Reparaciones</div><table><thead><tr><th>RMA</th><th>Fecha</th><th>Equipo</th><th>Avería</th><th>Estado</th></tr></thead><tbody>
${c.repairs.map(r => `<tr><td>RMA-${r.rmaNumber.toString().padStart(5,'0')}</td><td>${fmtDate(r.entryDate)}</td><td>${esc(r.brand)} ${esc(r.model)}</td><td>${esc(r.problemDescription)}</td><td>${esc(r.status)}</td></tr>`).join('')}
</tbody></table></div>` : ''}
${invoices.length > 0 ? `<div class="section"><div class="sh">Facturas</div><table><thead><tr><th>Nº Factura</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead><tbody>
${invoices.map(i => `<tr><td>${esc(i.invoiceNumber)}</td><td>${fmtDate(i.date)}</td><td style="font-weight:700">${fmtMoney(i.total||0)}</td><td>${esc(i.status)}</td></tr>`).join('')}
</tbody></table></div>` : ''}
${activeWarranties.length > 0 ? `<div class="section"><div class="sh">Garantías activas</div><table><thead><tr><th>Equipo</th><th>Entrega</th><th>Vence</th><th>Meses</th></tr></thead><tbody>
${activeWarranties.map(w => `<tr><td>${esc(w.deviceDescription)}</td><td>${fmtDate(w.deliveryDate)}</td><td>${fmtDate(w.expiryDate)}</td><td>${w.months}</td></tr>`).join('')}
</tbody></table></div>` : ''}
<div class="footer"><span>${esc(s.appName)} · ${[s.address,s.phone].filter(Boolean).join(' · ')}</span><span>Documento generado el ${new Date().toLocaleDateString('es-ES')}</span></div>
</body></html>`;

  const w = window.open('', '_blank', 'width=794,height=1123');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => { try { w.print(); } catch {} }, 500);
};

// ─────────────────────────────────────────────────────────────────────────────

const CustomerList: React.FC<CustomerListProps> = ({
  repairs, customers,
  invoices = [], budgets = [], warranties = [], citas = [],
  settings,
  onSelectCustomer, onEditRepair, onSaveCustomer, onDeleteCustomer,
  onNewRepairForCustomer, onNewBudgetForCustomer, onNewCitaForCustomer,
  setView, onBack,
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'lastVisit' | 'total'>('name');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', city: '', address: '', email: '', taxId: '', notes: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', city: '', address: '', email: '', notes: '' });
  const [activeTab, setActiveTab] = useState<Tab>('reparaciones');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // ── Merge customers from repairs + standalone customers DB ─────────────────
  const allCustomers = useMemo((): CustomerRecord[] => {
    const map = new Map<string, CustomerRecord>();

    for (const c of customers) {
      map.set(c.phone, {
        id: c.id, name: c.name, phone: c.phone, city: c.city, address: c.address,
        email: c.email, taxId: c.taxId, notes: c.notes, createdAt: c.createdAt,
        repairs: [], lastVisit: c.createdAt || '',
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
      arr = arr.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.taxId || '').toLowerCase().includes(q)
      );
    }

    // Attach invoices for sort
    if (sortBy === 'total') {
      return arr.sort((a, b) => {
        const aTotal = invoices.filter(i => i.customerPhone === a.phone && i.status === 'cobrada').reduce((s, i) => s + (i.total || 0), 0);
        const bTotal = invoices.filter(i => i.customerPhone === b.phone && i.status === 'cobrada').reduce((s, i) => s + (i.total || 0), 0);
        return bTotal - aTotal;
      });
    }
    if (sortBy === 'lastVisit') {
      return arr.sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [repairs, customers, searchTerm, sortBy, invoices]);

  const allLetters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ#'.split('');
  const grouped = useMemo(() => {
    if (sortBy !== 'name') return {};
    const g: Record<string, CustomerRecord[]> = {};
    allCustomers.forEach(c => {
      const first = c.name.charAt(0).toUpperCase();
      const letter = allLetters.includes(first) ? first : '#';
      if (!g[letter]) g[letter] = [];
      g[letter].push(c);
    });
    return g;
  }, [allCustomers, sortBy]);
  const letters = allLetters.filter(l => grouped[l]);

  const scrollToLetter = (l: string) => {
    setActiveLetter(l);
    sectionRefs.current[l]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOpenCustomer = (c: CustomerRecord) => {
    setSelectedCustomer(c);
    setEditingCustomer(false);
    setActiveTab('reparaciones');
  };

  const handleEditOpen = () => {
    if (!selectedCustomer) return;
    setEditForm({
      name: selectedCustomer.name || '',
      phone: selectedCustomer.phone || '',
      city: selectedCustomer.city || '',
      address: selectedCustomer.address || '',
      email: selectedCustomer.email || '',
      taxId: selectedCustomer.taxId || '',
      notes: selectedCustomer.notes || '',
    });
    setEditingCustomer(true);
  };

  const handleEditSave = () => {
    if (!selectedCustomer || !editForm.name.trim() || !editForm.phone.trim()) return;
    const customerId = selectedCustomer.isStandalone
      ? selectedCustomer.id
      : `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    onSaveCustomer?.({
      id: customerId,
      name: editForm.name.trim(), phone: editForm.phone.trim(),
      city: editForm.city.trim() || undefined, address: editForm.address.trim() || undefined,
      email: editForm.email.trim() || undefined, taxId: editForm.taxId.trim() || undefined,
      notes: editForm.notes.trim() || undefined, updatedAt: new Date().toISOString(),
    });
    setSelectedCustomer({
      ...selectedCustomer, id: customerId, isStandalone: true,
      name: editForm.name.trim(), phone: editForm.phone.trim(),
      city: editForm.city.trim() || undefined, address: editForm.address.trim() || undefined,
      email: editForm.email.trim() || undefined, taxId: editForm.taxId.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
    });
    setEditingCustomer(false);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const p = phone.replace(/\D/g, '');
    const fullPhone = p.length > 9 ? p : `34${p}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(`Hola ${name}`)}`, '_blank');
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;
    onSaveCustomer?.({
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newCustomer.name.trim(), phone: newCustomer.phone.trim(),
      city: newCustomer.city.trim() || undefined, address: newCustomer.address.trim() || undefined,
      email: newCustomer.email.trim() || undefined, notes: newCustomer.notes.trim() || undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setNewCustomer({ name: '', phone: '', city: '', address: '', email: '', notes: '' });
    setShowAddForm(false);
  };

  // ── Edit form ──────────────────────────────────────────────────────────────
  if (editingCustomer && selectedCustomer) {
    const inp = 'w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm';
    const lbl = 'block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1';
    return (
      <div className="max-w-lg animate-in fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setEditingCustomer(false)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Editar Cliente</h2>
            <p className="text-sm text-slate-400 mt-0.5">{selectedCustomer.name}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-4">
          <div className="space-y-1.5"><label className={lbl}>Nombre *</label>
            <input type="text" className={inp} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className={lbl}>Teléfono *</label>
              <input type="tel" className={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><label className={lbl}>Email</label>
              <input type="email" className={inp} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><label className={lbl}>Dirección</label>
            <input type="text" className={inp} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className={lbl}>Ciudad</label>
              <input type="text" className={inp} value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1.5"><label className={lbl}>NIF / CIF</label>
              <input type="text" className={inp} value={editForm.taxId} onChange={e => setEditForm(f => ({ ...f, taxId: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><label className={lbl}>Notas</label>
            <textarea rows={3} className={`${inp} resize-none`} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button onClick={() => setEditingCustomer(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50">Cancelar</button>
            <button onClick={handleEditSave} disabled={!editForm.name.trim() || !editForm.phone.trim()}
              className="flex-1 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
              <Save size={16} /> Guardar cambios
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Customer detail ────────────────────────────────────────────────────────
  if (selectedCustomer) {
    const c = selectedCustomer;

    // Data for this customer
    const custRepairs  = [...c.repairs].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
    const custInvoices = invoices.filter(i =>
      i.customerPhone === c.phone || i.customerName?.toLowerCase() === c.name.toLowerCase()
    ).sort((a, b) => b.date.localeCompare(a.date));
    const custBudgets  = budgets.filter(b =>
      (b.customerPhone && b.customerPhone === c.phone) ||
      custRepairs.some(r => r.id === b.repairId)
    ).sort((a, b) => b.date.localeCompare(a.date));
    const custWarranties = warranties.filter(w => w.customerPhone === c.phone)
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
    const custCitas = citas.filter(ci =>
      ci.clientePhone === c.phone || ci.clienteName?.toLowerCase() === c.name.toLowerCase()
    ).sort((a, b) => `${b.fecha}${b.horaInicio}`.localeCompare(`${a.fecha}${a.horaInicio}`));

    const totalSpent    = custInvoices.filter(i => i.status === 'cobrada').reduce((s, i) => s + (i.total || 0), 0);
    const activeWarranties = custWarranties.filter(w => w.status === 'activa');
    const isVIP         = totalSpent > 500;
    const isHabitual    = custRepairs.length > 3;
    const lastVisit     = custRepairs[0]?.entryDate;
    const today         = new Date().setHours(0, 0, 0, 0);

    const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
      { id: 'reparaciones', label: 'Reparaciones', icon: Wrench,      count: custRepairs.length },
      { id: 'facturas',     label: 'Facturas',     icon: Receipt,     count: custInvoices.length },
      { id: 'presupuestos', label: 'Presupuestos', icon: ClipboardList, count: custBudgets.length },
      { id: 'garantias',    label: 'Garantías',    icon: ShieldCheck, count: custWarranties.length },
      { id: 'citas',        label: 'Citas',        icon: Calendar,    count: custCitas.length },
    ];

    return (
      <div className="space-y-5 animate-in fade-in max-w-4xl pb-24">

        {/* Back */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCustomer(null)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ficha de Cliente</h2>
          </div>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-7 py-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(135deg,#2e7d32,#4caf50)' }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">{c.name}</h3>
                  {isVIP     && <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-[8px] font-black uppercase rounded-full flex items-center gap-1"><Star size={9} />VIP</span>}
                  {isHabitual && <span className="px-2 py-0.5 bg-emerald-400 text-emerald-900 text-[8px] font-black uppercase rounded-full flex items-center gap-1"><Award size={9} />Habitual</span>}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-300 mt-1">
                  <span className="flex items-center gap-1.5"><Phone size={13} /> {c.phone}</span>
                  {c.email && <span className="flex items-center gap-1.5"><Mail size={13} /> {c.email}</span>}
                  {c.city  && <span className="flex items-center gap-1.5"><MapPin size={13} /> {c.city}</span>}
                  {c.taxId && <span className="text-slate-500 text-xs">NIF: {c.taxId}</span>}
                </div>
                {c.createdAt && (
                  <p className="text-[9px] text-slate-600 mt-1.5">Alta: {fmtDate(c.createdAt)}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleEditOpen} className="p-2 bg-white/10 text-white/60 rounded-lg hover:bg-white/20 hover:text-white transition-colors" title="Editar"><Pencil size={14} /></button>
                {c.isStandalone && onDeleteCustomer && (
                  <button onClick={() => setConfirmDeleteCustomer(true)} className="p-2 bg-white/10 text-white/40 rounded-lg hover:bg-red-500/80 hover:text-white transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 mt-5">
              <button onClick={() => window.open(`tel:${c.phone}`, '_self')}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-blue-700 transition-all">
                <Phone size={13} /> Llamar
              </button>
              <button onClick={() => handleWhatsApp(c.phone, c.name)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-emerald-700 transition-all">
                <MessageCircle size={13} /> WhatsApp
              </button>
              {c.email && (
                <button onClick={() => window.open(`mailto:${c.email}`, '_self')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/10 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-white/20 transition-all">
                  <Mail size={13} /> Email
                </button>
              )}
              <button
                onClick={() => printCustomerHistory(c, custInvoices, custWarranties, settings)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-white/20 transition-all"
              >
                <Printer size={13} /> Imprimir ficha
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
            {[
              { label: 'Total gastado', value: fmtMoney(totalSpent), color: totalSpent > 0 ? 'text-emerald-600' : 'text-slate-400' },
              { label: 'Reparaciones', value: String(custRepairs.length), color: 'text-blue-600' },
              { label: 'Última visita', value: lastVisit ? fmtDate(lastVisit) : '—', color: 'text-slate-700', small: true },
              { label: 'Garantías activas', value: String(activeWarranties.length), color: activeWarranties.length > 0 ? 'text-amber-600' : 'text-slate-400' },
            ].map(m => (
              <div key={m.label} className="p-5 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                <p className={`${m.small ? 'text-sm' : 'text-2xl'} font-black ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {c.notes && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Notas</p>
            <p className="text-xs text-slate-600">{c.notes}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-100">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                    activeTab === t.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5">

            {/* ── REPARACIONES tab ── */}
            {activeTab === 'reparaciones' && (
              <div className="space-y-3">
                {custRepairs.length === 0 ? (
                  <div className="py-10 text-center">
                    <Wrench size={28} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin reparaciones</p>
                  </div>
                ) : custRepairs.map(r => (
                  <div key={r.id} onClick={() => onEditRepair?.(r)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 text-[10px] font-black shrink-0">
                      {r.rmaNumber.toString().padStart(5,'0').slice(-3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm uppercase truncate">{r.brand} {r.model}</p>
                      <p className="text-[9px] text-slate-400 font-bold truncate mt-0.5">{r.problemDescription}</p>
                      <p className="text-[8px] text-slate-300 mt-0.5">{fmtDate(r.entryDate)}</p>
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                    <ChevronRight size={15} className="text-slate-200 group-hover:text-blue-500 shrink-0" />
                  </div>
                ))}
                {onNewRepairForCustomer && (
                  <button onClick={() => onNewRepairForCustomer({ name: c.name, phone: c.phone, address: c.address, city: c.city })}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Nueva reparación
                  </button>
                )}
              </div>
            )}

            {/* ── FACTURAS tab ── */}
            {activeTab === 'facturas' && (
              <div className="space-y-3">
                {custInvoices.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total facturado</span>
                    <span className="text-lg font-black text-emerald-600">{fmtMoney(custInvoices.reduce((s, i) => s + (i.total || 0), 0))}</span>
                  </div>
                )}
                {custInvoices.length === 0 ? (
                  <div className="py-10 text-center">
                    <Receipt size={28} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin facturas</p>
                  </div>
                ) : custInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                      <Receipt size={16} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm font-mono">{inv.invoiceNumber}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">{fmtDate(inv.date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-800">{fmtMoney(inv.total || 0)}</p>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        inv.status === 'cobrada' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'anulada' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>{inv.status}</span>
                    </div>
                  </div>
                ))}
                {setView && (
                  <button onClick={() => setView('invoices')}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-amber-300 hover:text-amber-500 transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Nueva factura manual
                  </button>
                )}
              </div>
            )}

            {/* ── PRESUPUESTOS tab ── */}
            {activeTab === 'presupuestos' && (
              <div className="space-y-3">
                {custBudgets.length > 0 && (() => {
                  const accepted = custBudgets.filter(b => b.status === 'accepted');
                  const totalAccepted = accepted.reduce((s, b) => s + (b.total || 0), 0);
                  const totalAll = custBudgets.reduce((s, b) => s + (b.total || 0), 0);
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total presupuestado</p>
                        <p className="text-lg font-black text-slate-700 mt-1">{fmtMoney(totalAll)}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl text-center">
                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Aceptado</p>
                        <p className="text-lg font-black text-emerald-700 mt-1">{fmtMoney(totalAccepted)}</p>
                      </div>
                    </div>
                  );
                })()}
                {custBudgets.length === 0 ? (
                  <div className="py-10 text-center">
                    <ClipboardList size={28} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin presupuestos</p>
                  </div>
                ) : custBudgets.map(b => (
                  <div key={b.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                    <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm">
                        {b.rmaNumber ? `RMA-${b.rmaNumber.toString().padStart(5,'0')}` : b.customerName || 'Presupuesto libre'}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">{fmtDate(b.date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-800">{fmtMoney(b.total || 0)}</p>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        b.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                        b.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>{b.status === 'accepted' ? 'Aceptado' : b.status === 'rejected' ? 'Rechazado' : 'Pendiente'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── GARANTÍAS tab ── */}
            {activeTab === 'garantias' && (
              <div className="space-y-3">
                {custWarranties.length === 0 ? (
                  <div className="py-10 text-center">
                    <ShieldCheck size={28} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin garantías</p>
                  </div>
                ) : custWarranties.map(w => {
                  const expMs = new Date(w.expiryDate).setHours(0, 0, 0, 0);
                  const daysLeft = Math.floor((expMs - today) / 86400000);
                  const expired = daysLeft < 0;
                  const urgent = !expired && daysLeft <= 7;
                  return (
                    <div key={w.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      expired ? 'border-slate-100 opacity-60' : urgent ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-100 bg-emerald-50/20'
                    }`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        expired ? 'bg-slate-100' : urgent ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                        <ShieldCheck size={16} className={expired ? 'text-slate-400' : urgent ? 'text-amber-600' : 'text-emerald-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate">{w.deviceDescription}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">Entrega: {fmtDate(w.deliveryDate)}</p>
                        <p className={`text-[9px] font-bold mt-0.5 ${expired ? 'text-slate-400' : urgent ? 'text-amber-600' : 'text-emerald-600'}`}>
                          Vence: {fmtDate(w.expiryDate)} {!expired && daysLeft <= 30 ? `(${daysLeft}d)` : ''}
                        </p>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${
                        expired || w.status === 'vencida' ? 'bg-slate-100 text-slate-500' :
                        w.status === 'reclamada' ? 'bg-red-100 text-red-600' :
                        urgent ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>{w.status === 'activa' ? (expired ? 'Vencida' : 'Activa') : w.status}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── CITAS tab ── */}
            {activeTab === 'citas' && (
              <div className="space-y-3">
                {(() => {
                  const upcoming = custCitas.filter(ci => ci.fecha >= new Date().toISOString().slice(0, 10) && ci.estado !== 'cancelada');
                  const past     = custCitas.filter(ci => ci.fecha < new Date().toISOString().slice(0, 10) || ci.estado === 'cancelada' || ci.estado === 'completada');
                  return (
                    <>
                      {upcoming.length > 0 && (
                        <>
                          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={11} /> Próximas ({upcoming.length})</p>
                          {upcoming.map(ci => (
                            <div key={ci.id} className="flex items-center gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/30">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <Calendar size={16} className="text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-800 text-sm truncate">{ci.titulo}</p>
                                <p className="text-[9px] text-blue-500 font-bold">{ci.fecha} · {ci.horaInicio}–{ci.horaFin}</p>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${
                                ci.estado === 'confirmada' ? 'bg-emerald-100 text-emerald-700' :
                                ci.estado === 'pendiente'  ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>{ci.estado}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {past.length > 0 && (
                        <>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-2"><Clock size={11} /> Historial ({past.length})</p>
                          {past.slice(0, 5).map(ci => (
                            <div key={ci.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 opacity-60 hover:opacity-100 transition-all">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                <Calendar size={16} className="text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-600 text-sm truncate">{ci.titulo}</p>
                                <p className="text-[9px] text-slate-400">{ci.fecha} · {ci.horaInicio}</p>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${
                                ci.estado === 'completada' ? 'bg-slate-100 text-slate-500' :
                                ci.estado === 'cancelada'  ? 'bg-red-100 text-red-500' :
                                'bg-slate-100 text-slate-500'
                              }`}>{ci.estado}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {custCitas.length === 0 && (
                        <div className="py-10 text-center">
                          <Calendar size={28} className="mx-auto text-slate-200 mb-3" />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin citas</p>
                        </div>
                      )}
                    </>
                  );
                })()}
                {onNewCitaForCustomer && (
                  <button onClick={() => onNewCitaForCustomer({ name: c.name, phone: c.phone })}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Nueva cita
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating action bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-2 px-4 py-3 bg-slate-900 rounded-2xl shadow-2xl">
          {onNewRepairForCustomer && (
            <button
              onClick={() => onNewRepairForCustomer({ name: c.name, phone: c.phone, address: c.address, city: c.city })}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-blue-700 transition-all active:scale-95"
            >
              <Wrench size={14} /> Nueva reparación
            </button>
          )}
          {onNewBudgetForCustomer && (
            <button
              onClick={() => onNewBudgetForCustomer({ name: c.name, phone: c.phone })}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-violet-700 transition-all active:scale-95"
            >
              <ClipboardList size={14} /> Presupuesto
            </button>
          )}
          {onNewCitaForCustomer && (
            <button
              onClick={() => onNewCitaForCustomer({ name: c.name, phone: c.phone })}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-amber-600 transition-all active:scale-95"
            >
              <Calendar size={14} /> Cita
            </button>
          )}
          <button
            onClick={() => handleWhatsApp(c.phone, c.name)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-emerald-700 transition-all active:scale-95"
          >
            <MessageCircle size={14} />
          </button>
        </div>

        {/* Confirm delete modal */}
        {confirmDeleteCustomer && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-6">
              <div className="text-center">
                <div className="inline-flex p-4 bg-red-50 rounded-2xl mb-3"><Trash2 size={24} className="text-red-600" /></div>
                <p className="text-sm font-black uppercase">¿Eliminar a {c.name}?</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Se perderán sus datos del directorio.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteCustomer(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={() => { setConfirmDeleteCustomer(false); onDeleteCustomer?.(c.id); setSelectedCustomer(null); }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] hover:bg-red-700">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Add customer form ──────────────────────────────────────────────────────
  if (showAddForm) {
    const inp = 'w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
    const lbl = 'text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1';
    return (
      <div className="max-w-lg mx-auto animate-in fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setShowAddForm(false)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm"><ArrowLeft size={20} /></button>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nuevo Cliente</h2>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-5">
          <div className="space-y-2"><label className={lbl}>Nombre *</label>
            <input type="text" placeholder="Nombre completo" className={inp} value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} /></div>
          <div className="space-y-2"><label className={lbl}>Teléfono *</label>
            <input type="tel" placeholder="600 000 000" className={inp} value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className={lbl}>Ciudad</label>
              <input type="text" className={inp} value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} /></div>
            <div className="space-y-2"><label className={lbl}>Email</label>
              <input type="email" className={inp} value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} /></div>
          </div>
          <div className="space-y-2"><label className={lbl}>Dirección</label>
            <input type="text" className={inp} value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} /></div>
          <div className="space-y-2"><label className={lbl}>Notas</label>
            <textarea rows={2} className={`${inp} resize-none`} value={newCustomer.notes} onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})} /></div>
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button onClick={() => setShowAddForm(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50">Cancelar</button>
            <button onClick={handleAddCustomer} disabled={!newCustomer.name.trim() || !newCustomer.phone.trim()}
              className="flex-1 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
              <Save size={16} /> Guardar Cliente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 animate-in fade-in">
      {/* Alphabet sidebar */}
      {sortBy === 'name' && (
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
      )}

      <div className="flex-1 space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            {onBack && <button onClick={onBack} className="back-to-dash mb-2">← INICIO</button>}
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Agenda de Clientes</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{allCustomers.length} registrados</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-60">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Nombre, teléfono, email, NIF..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveLetter(null); }} />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
            >
              <option value="name">A–Z</option>
              <option value="lastVisit">Última visita</option>
              <option value="total">Mayor gasto</option>
            </select>
            <button onClick={() => setShowAddForm(true)}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95">
              <UserPlus size={16} /> Nuevo
            </button>
          </div>
        </div>

        {/* Mobile alphabet strip */}
        {sortBy === 'name' && (
          <div className="md:hidden flex gap-1 overflow-x-auto pb-2 px-1">
            {letters.map(l => (
              <button key={l} onClick={() => scrollToLetter(l)}
                className={`w-8 h-8 flex items-center justify-center text-[10px] font-black rounded-lg shrink-0 transition-all ${
                  activeLetter === l ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-100'
                }`}>{l}</button>
            ))}
          </div>
        )}

        {allCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <User size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin resultados</p>
            <button onClick={() => setShowAddForm(true)} className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700">
              <UserPlus size={14} className="inline mr-1" /> Añadir cliente
            </button>
          </div>
        ) : sortBy === 'name' ? (
          /* Grouped by letter */
          <div className="space-y-2">
            {letters.map(letter => (
              <div key={letter} ref={el => { sectionRefs.current[letter] = el; }}>
                <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-4 py-2 rounded-lg mb-1">
                  <span className="text-sm font-black text-blue-600 uppercase">{letter}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">({grouped[letter].length})</span>
                </div>
                {grouped[letter].map(c => <CustomerRow key={c.phone} c={c} invoices={invoices} onClick={() => handleOpenCustomer(c)} />)}
              </div>
            ))}
          </div>
        ) : (
          /* Flat sorted list */
          <div className="space-y-1.5">
            {allCustomers.map(c => <CustomerRow key={c.phone} c={c} invoices={invoices} onClick={() => handleOpenCustomer(c)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Row sub-component ─────────────────────────────────────────────────────────
const CustomerRow: React.FC<{ c: CustomerRecord; invoices: FullInvoice[]; onClick: () => void }> = ({ c, invoices, onClick }) => {
  const spent = invoices
    .filter(i => (i.customerPhone === c.phone) && i.status === 'cobrada')
    .reduce((s, i) => s + (i.total || 0), 0);
  const isVIP = spent > 500;
  const isHabitual = c.repairs.length > 3;
  return (
    <div onClick={onClick}
      className="bg-white rounded-xl px-5 py-3.5 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group mb-1.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
        c.isStandalone && c.repairs.length === 0 ? 'bg-violet-100 text-violet-500 group-hover:bg-violet-600 group-hover:text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-600 group-hover:text-white'
      }`}>
        {c.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-black text-slate-800 text-sm uppercase tracking-tight truncate">{c.name}</p>
          {isVIP && <span className="text-[7px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full shrink-0">VIP</span>}
          {isHabitual && !isVIP && <span className="text-[7px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">★</span>}
        </div>
        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>
          {c.repairs.length > 0 && <span className="flex items-center gap-1"><Wrench size={10} /> {c.repairs.length}</span>}
          {c.city && <span className="flex items-center gap-1"><MapPin size={10} /> {c.city}</span>}
          {spent > 0 && <span className="text-emerald-600 font-black">{fmtMoney(spent)}</span>}
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
  );
};

export default CustomerList;
