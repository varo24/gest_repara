import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, CheckCircle2, X, Printer, MessageCircle } from 'lucide-react';
import { RepairItem, RepairStatus, Budget, AppSettings } from '../types';
import { storage } from '../services/persistence';
import { localDB } from '../services/localDB';

interface DespachoProps {
  repairs: RepairItem[];
  budgets: Budget[];
  settings: AppSettings;
  onStatusChange: (id: string, status: RepairStatus) => void;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

type Phase = 'idle' | 'scanning' | 'found' | 'notfound' | 'done';
type PayMethod = 'efectivo' | 'tarjeta' | 'bizum' | 'transferencia';

const PAY_LABELS: Record<PayMethod, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum', transferencia: 'Transferencia'
};

const fmtRMA = (n: number) => `RMA-${String(n).padStart(5, '0')}`;
const fmtMoney = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(n) + ' €';

const Despacho: React.FC<DespachoProps> = ({ repairs, budgets, settings, onStatusChange, onNotify }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rawCode, setRawCode] = useState('');
  const [repair, setRepair] = useState<RepairItem | null>(null);
  const [pay, setPay] = useState<PayMethod>('efectivo');
  const inputRef = useRef<HTMLInputElement>(null);
  const bufRef = useRef('');
  const tmrRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = [...repairs.filter(r => r.status === RepairStatus.READY)]
    .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

  const refocus = useCallback(() => setTimeout(() => inputRef.current?.focus(), 30), []);

  useEffect(() => {
    refocus();
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, [refocus]);

  const resolve = useCallback((code: string): RepairItem | null => {
    const c = code.trim().toUpperCase();
    const qm = c.match(/QR[-]?0*(\d+)/); if (qm) return repairs.find(r => r.rmaNumber === parseInt(qm[1])) ?? null;
    const rm = c.match(/RMA[-]?0*(\d+)/); if (rm) return repairs.find(r => r.rmaNumber === parseInt(rm[1])) ?? null;
    if (/^\d+$/.test(c)) return repairs.find(r => r.rmaNumber === parseInt(c)) ?? null;
    const ph = c.replace(/\D/g, ''); if (ph.length >= 9) return repairs.find(r => r.customerPhone.replace(/\D/g, '').includes(ph)) ?? null;
    return repairs.find(r => r.customerName.toUpperCase().includes(c)) ?? null;
  }, [repairs]);

  const processCode = (raw: string) => {
    if (inputRef.current) inputRef.current.value = '';
    bufRef.current = '';
    const found = resolve(raw);
    setRawCode(raw);
    if (found) { setRepair(found); setPhase('found'); setPay('efectivo'); }
    else { setPhase('notfound'); setTimeout(() => { setPhase('idle'); refocus(); }, 2000); }
  };

  const getBudget = (repairId: string) =>
    [...budgets.filter(b => b.repairId === repairId)].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  const getTotals = (r: RepairItem) => {
    const b = getBudget(r.id);
    if (b) {
      const sub = b.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        + b.laborItems.reduce((s, i) => s + i.hours * i.hourlyRate, 0);
      const tax = Math.round(sub * ((b.taxRate || settings.taxRate || 21) / 100) * 100) / 100;
      return { budget: b, subtotal: sub, taxAmount: tax, total: Math.round((sub + tax) * 100) / 100 };
    }
    const sub = (r.estimatedParts || 0) + (r.estimatedHours || 0) * (settings.hourlyRate || 45);
    const tax = Math.round(sub * ((settings.taxRate || 21) / 100) * 100) / 100;
    return { budget: null, subtotal: sub, taxAmount: tax, total: Math.round((sub + tax) * 100) / 100 };
  };

  const cobrar = async () => {
    if (!repair) return;
    const { subtotal, taxAmount, total, budget } = getTotals(repair);
    const now = new Date().toISOString();
    const allInvoices = localDB.getAll('invoices');
    const nums = allInvoices.map((i: any) => parseInt(i.invoiceNumber?.replace(/\D/g, '') || '0')).filter(Boolean);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    const invoiceNumber = `FAC-${String(nextNum).padStart(5, '0')}`;

    const invoice = {
      id: `INV-${Date.now()}`,
      invoiceNumber,
      repairId: repair.id,
      rmaNumber: repair.rmaNumber,
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      date: now.slice(0, 10),
      items: budget?.items ?? [],
      laborItems: budget?.laborItems ?? [],
      subtotal,
      taxRate: settings.taxRate || 21,
      taxAmount,
      total,
      status: 'cobrada',
      payMethod: pay,
      paidAt: now,
      isRectificativa: false,
      createdAt: now,
    };

    storage.save('invoices', invoice.id, invoice);
    storage.save('cash_movements', `CASH-${Date.now()}`, {
      id: `CASH-${Date.now()}`,
      type: 'ingreso',
      invoiceId: invoice.id,
      description: `${invoiceNumber} — ${repair.customerName}`,
      amount: total,
      payMethod: pay,
      date: now.slice(0, 10),
      category: 'reparacion',
      createdAt: now,
    });

    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + 3);
    storage.save('warranties', `WAR-${Date.now()}`, {
      id: `WAR-${Date.now()}`,
      repairId: repair.id,
      rmaNumber: repair.rmaNumber,
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      deviceDescription: `${repair.brand} ${repair.model}`,
      deliveryDate: now.slice(0, 10),
      expiryDate: expiryDate.toISOString().slice(0, 10),
      months: 3,
      status: 'activa',
      createdAt: now,
    });

    storage.save('repairs', repair.id, { ...repair, status: RepairStatus.DELIVERED, updatedAt: now });
    onStatusChange(repair.id, RepairStatus.DELIVERED);
    onNotify('success', `${invoiceNumber} — ${repair.customerName} despachado`);
    setPhase('done');
  };

  const printTicket = (r: RepairItem) => {
    const { subtotal, taxAmount, total } = getTotals(r);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;width:80mm;padding:5mm;font-size:11px}@page{size:80mm auto;margin:0}.c{text-align:center}.b{font-weight:700}.big{font-size:20px;font-weight:700;text-align:center;letter-spacing:2px;margin:6px 0}.total{font-size:22px;font-weight:700;text-align:center}.hr{border:none;border-top:1px dashed #000;margin:5px 0}.row{display:flex;justify-content:space-between;margin:2px 0;font-size:10px}.footer{font-size:8px;text-align:center;margin-top:6px;color:#555;line-height:1.5}</style>
</head><body>
<div class="c b" style="font-size:14px;text-transform:uppercase">${settings.appName}</div>
<div class="c" style="font-size:9px;color:#555">${settings.phone} · ${settings.address}</div>
<hr class="hr">
<div class="c" style="font-size:9px;text-transform:uppercase;letter-spacing:1px">Ticket de entrega</div>
<div class="big">${fmtRMA(r.rmaNumber)}</div>
<hr class="hr">
<div class="row"><span>Cliente:</span><span class="b">${r.customerName}</span></div>
<div class="row"><span>Teléfono:</span><span>${r.customerPhone}</span></div>
<div class="row"><span>Equipo:</span><span>${r.brand} ${r.model}</span></div>
<hr class="hr">
<div class="row"><span>Base imponible</span><span>${subtotal.toFixed(2)}€</span></div>
<div class="row"><span>IVA ${settings.taxRate || 21}%</span><span>${taxAmount.toFixed(2)}€</span></div>
<hr class="hr">
<div class="c" style="font-size:9px;text-transform:uppercase;letter-spacing:1px">Total a cobrar</div>
<div class="total">${total.toFixed(2)} €</div>
<hr class="hr">
<div class="c" style="margin:8px 0">
  <canvas id="qrcode" style="width:120px;height:120px"></canvas>
  <div style="font-size:8px;margin-top:4px">Escanea para abrir ficha · ${fmtRMA(r.rmaNumber)}</div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
 <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  setTimeout(function() {
    new QRCode(document.getElementById('qrcode'), {
      text: '${fmtRMA(r.rmaNumber)}',
      width: 120,
      height: 120,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    setTimeout(function() { window.print(); }, 500);
  }, 800);
</script>
<div class="footer">${settings.letterhead || 'Garantía 3 meses en mano de obra'}<br>${new Date().toLocaleDateString('es-ES')}</div>
</body></html>`;
    const w = window.open('', '_blank', 'width=340,height=700');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
  };

  const zoneCls = phase === 'found' ? 'border-emerald-500' : phase === 'notfound' ? 'border-red-500' : phase === 'scanning' ? 'border-blue-500' : 'border-slate-700';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Despacho Rápido</h1>
        <p className="text-sm text-slate-400 mt-0.5">Pistola lectora HID — escanea el ticket del equipo</p>
      </div>

      <input ref={inputRef} className="fixed opacity-0 w-px h-px top-0 left-0 pointer-events-none"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        onChange={e => {
          bufRef.current = e.target.value; setRawCode(e.target.value); setPhase('scanning');
          if (tmrRef.current) clearTimeout(tmrRef.current);
          tmrRef.current = setTimeout(() => { if (bufRef.current.trim()) processCode(bufRef.current.trim()); }, 80);
        }}
        onKeyDown={e => {
          if (e.key !== 'Enter') return;
          if (tmrRef.current) clearTimeout(tmrRef.current);
          const v = inputRef.current?.value?.trim() || '';
          if (v) processCode(v);
        }} />

      <div className={`bg-slate-950 rounded-2xl p-7 border-2 transition-all cursor-pointer select-none ${zoneCls}`} onClick={refocus}>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full transition-all ${phase === 'found' ? 'bg-emerald-400' : phase === 'notfound' ? 'bg-red-400' : phase === 'scanning' ? 'bg-blue-400 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {phase === 'idle' ? 'Pistola lista — escanea el ticket' : phase === 'scanning' ? 'Leyendo...' : phase === 'found' ? `✓ ${fmtRMA(repair!.rmaNumber)} — ${repair!.customerName}` : phase === 'done' ? '✓ Despachado' : '✗ No encontrado'}
          </span>
        </div>
        <p className={`text-center font-mono text-xl font-black tracking-widest transition-colors ${phase === 'found' ? 'text-emerald-400' : phase === 'notfound' ? 'text-red-400' : phase === 'scanning' ? 'text-blue-400' : 'text-slate-700'}`}>
          {rawCode || '_ _ _ _ _ _ _ _ _'}
        </p>
        <p className="text-center text-[9px] text-slate-700 mt-2">Acepta: QR-XXXXX · RMA-XXXXX · número · teléfono</p>
      </div>

      {phase === 'found' && repair && (() => {
        const { budget, subtotal, taxAmount, total } = getTotals(repair);
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-950 px-7 py-5 flex justify-between items-start">
              <div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Listo para entregar</p>
                <p className="text-3xl font-black text-white font-mono">{fmtRMA(repair.rmaNumber)}</p>
                <p className="text-sm text-slate-400 mt-1">{repair.brand} {repair.model} · {repair.deviceType}</p>
              </div>
              <button onClick={() => { setPhase('idle'); setRepair(null); refocus(); }} className="text-slate-600 hover:text-white transition-colors mt-1"><X size={18} /></button>
            </div>
            <div className="p-7 space-y-5">
              <div className="grid grid-cols-4 gap-3">
                {[['Cliente', repair.customerName], ['Teléfono', repair.customerPhone], ['Equipo', `${repair.brand} ${repair.model}`], ['Técnico', repair.technician || '—']].map(([l, v]) => (
                  <div key={l} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{l}</p>
                    <p className="text-xs font-bold text-slate-900 truncate">{v}</p>
                  </div>
                ))}
              </div>
              {budget && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                  {budget.items.map(i => <div key={i.id} className="flex justify-between text-xs text-slate-600"><span>{i.description} ×{i.quantity}</span><span className="font-bold">{(i.quantity * i.unitPrice).toFixed(2)} €</span></div>)}
                  {budget.laborItems.map(i => <div key={i.id} className="flex justify-between text-xs text-slate-600"><span>{i.description} {i.hours}h</span><span className="font-bold">{(i.hours * i.hourlyRate).toFixed(2)} €</span></div>)}
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-xs text-slate-400"><span>Subtotal</span><span>{subtotal.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-xs text-slate-400"><span>IVA {settings.taxRate || 21}%</span><span>{taxAmount.toFixed(2)} €</span></div>
                </div>
              )}
              <div className="bg-slate-950 rounded-xl px-6 py-5 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total a cobrar</span>
                <span className="text-4xl font-black text-white font-mono">{fmtMoney(total)}</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Forma de cobro</p>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(PAY_LABELS) as [PayMethod, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => setPay(k)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${pay === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={cobrar} className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-sm hover:bg-emerald-700 transition-all active:scale-95">
                  <CheckCircle2 size={18} /> Cobrar {fmtMoney(total)} y entregar
                </button>
                <button onClick={() => printTicket(repair)} className="flex items-center gap-2 px-5 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs hover:bg-slate-200 transition-all">
                  <Printer size={14} /> Ticket
                </button>
                <button onClick={() => {
                  const msg = `Hola ${repair.customerName}, su ${repair.brand} ${repair.model} está listo. Total: ${fmtMoney(total)}. ${settings.appName}`;
                  window.open(`https://wa.me/${repair.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                }} className="flex items-center gap-2 px-5 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs hover:bg-slate-200 transition-all">
                  <MessageCircle size={14} /> WA
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {phase === 'done' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
          <p className="text-lg font-black text-slate-900 mb-1">Despachado correctamente</p>
          <p className="text-xs text-slate-400 mb-6">Factura generada · Garantía activada</p>
          <div className="flex gap-3 justify-center">
            {repair && <button onClick={() => printTicket(repair)} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs hover:bg-slate-200"><Printer size={13} /> Ticket</button>}
            <button onClick={() => { setPhase('idle'); setRepair(null); setRawCode(''); refocus(); }} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-xs hover:bg-black">
              Siguiente cliente
            </button>
          </div>
        </div>
      )}

      {phase === 'idle' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">Listos para entregar</p>
            <span className="text-xs text-slate-400">{ready.length} equipos</span>
          </div>
          {ready.length === 0 ? (
            <div className="py-12 text-center"><p className="text-xs text-slate-300 font-bold uppercase tracking-widest">Ningún equipo listo</p></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {ready.map(r => {
                const { total } = getTotals(r);
                const days = Math.floor((Date.now() - new Date(r.entryDate).getTime()) / 86400000);
                return (
                  <div key={r.id} onClick={() => { setRepair(r); setPhase('found'); setPay('efectivo'); refocus(); }}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer transition-all group">
                    <span className="font-mono text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full min-w-[88px] text-center">{fmtRMA(r.rmaNumber)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.customerName}</p>
                      <p className="text-xs text-slate-400 truncate">{r.brand} {r.model}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-emerald-600">{fmtMoney(total)}</p>
                      <p className={`text-[10px] ${days > 7 ? 'text-red-400' : days > 3 ? 'text-amber-400' : 'text-slate-400'}`}>{days}d esperando</p>
                    </div>
                    <Zap size={14} className="text-slate-200 group-hover:text-blue-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Despacho;
