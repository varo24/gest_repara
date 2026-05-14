import React, { useState, useMemo } from 'react';
import {
  Wallet, Plus, X, Printer, ArrowLeft,
  AlertTriangle, CheckCircle, Eye
} from 'lucide-react';
import { AppSettings, CierreCaja as CierreCajaType } from '../types';
import { storage } from '../lib/dataService';

interface NormMov {
  id: string;
  tipo: 'ingreso' | 'gasto' | 'apertura' | 'cierre' | 'retirada';
  concepto: string;
  importe: number;
  payMethod: string;
  categoria?: string;
  facturaId?: string;
  fecha: string;
  hora: string;
  tecnico?: string;
  notas?: string;
  createdAt: string;
}

interface CajaProps {
  cashMovements: any[];
  cierresCaja: CierreCajaType[];
  settings: AppSettings;
  onBack: () => void;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const normalizeMov = (m: any): NormMov => ({
  id: m.id,
  tipo: m.tipo || m.type || 'ingreso',
  concepto: m.concepto || m.description || '',
  importe: m.importe ?? m.amount ?? 0,
  payMethod: m.payMethod || 'efectivo',
  categoria: m.categoria || m.category,
  facturaId: m.facturaId || m.invoiceId,
  fecha: m.fecha || m.date || (m.createdAt ? m.createdAt.slice(0, 10) : ''),
  hora: m.hora || (m.createdAt ? m.createdAt.slice(11, 16) : '00:00'),
  tecnico: m.tecnico,
  notas: m.notas,
  createdAt: m.createdAt || '',
});

const TIPO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  ingreso:  { label: '↑ Ingreso',   color: '#1b5e20', bg: '#e8f5e9' },
  gasto:    { label: '↓ Gasto',     color: '#b71c1c', bg: '#ffebee' },
  retirada: { label: '↙ Retirada',  color: '#e65100', bg: '#fff3e0' },
  apertura: { label: '⊕ Apertura',  color: '#1565c0', bg: '#e3f2fd' },
  cierre:   { label: '⊘ Cierre',   color: '#37474f', bg: '#eceff1' },
};

const PAY_LABELS: Record<string, string> = {
  efectivo: '💵 Efectivo',
  tarjeta: '💳 Tarjeta',
  bizum: '📱 Bizum',
  transferencia: '🏦 Transferencia',
};

const CAT_LABELS: Record<string, string> = {
  'reparacion': 'Reparación',
  'venta': 'Venta',
  'proveedor': 'Proveedor',
  'gasto-fijo': 'Gasto fijo',
  'gasto-variable': 'Gasto variable',
  'otros': 'Otros',
};

const Caja: React.FC<CajaProps> = ({ cashMovements, cierresCaja, settings, onBack, onNotify }) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [activeTab, setActiveTab] = useState<'hoy' | 'historial'>('hoy');
  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cierreStep, setCierreStep] = useState<1 | 2>(1);
  const [efectivoContado, setEfectivoContado] = useState('');
  const [cierreNotas, setCierreNotas] = useState('');
  const [cierrePor, setCierrePor] = useState('');
  const [selectedCierre, setSelectedCierre] = useState<CierreCajaType | null>(null);
  const [historialMes, setHistorialMes] = useState(() => new Date().toISOString().slice(0, 7));

  // Apertura modal
  const [saldoInicial, setSaldoInicial] = useState('');
  const [aperTecnico, setAperTecnico] = useState('');

  // Movimiento modal
  const [movTipo, setMovTipo] = useState<'ingreso' | 'gasto' | 'retirada'>('ingreso');
  const [movConcepto, setMovConcepto] = useState('');
  const [movImporte, setMovImporte] = useState('');
  const [movPayMethod, setMovPayMethod] = useState('efectivo');
  const [movCategoria, setMovCategoria] = useState('otros');
  const [movNotas, setMovNotas] = useState('');

  const allMovements = useMemo(() => cashMovements.map(normalizeMov), [cashMovements]);

  const todayMovements = useMemo(() =>
    allMovements
      .filter(m => m.fecha === today)
      .sort((a, b) => (a.createdAt || a.hora).localeCompare(b.createdAt || b.hora)),
    [allMovements, today]
  );

  const aperturaHoy = todayMovements.find(m => m.tipo === 'apertura');
  const saldoApertura = aperturaHoy?.importe ?? 0;
  const cierreHoy = cierresCaja.find(c => c.fecha === today);
  const cajaAbierta = !!aperturaHoy && !cierreHoy;

  // Alert: yesterday not closed
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const cierreAyer = cierresCaja.find(c => c.fecha === yesterdayStr);
  const aperturaAyer = allMovements.find(m => m.fecha === yesterdayStr && m.tipo === 'apertura');
  const cajaAyerSinCerrar = !!aperturaAyer && !cierreAyer;

  // Today summary
  const todayIngresos = todayMovements.filter(m => m.tipo === 'ingreso');
  const todayGastos   = todayMovements.filter(m => m.tipo === 'gasto');
  const todayRetiros  = todayMovements.filter(m => m.tipo === 'retirada');

  const totalIngresos      = todayIngresos.reduce((s, m) => s + m.importe, 0);
  const totalGastos        = todayGastos.reduce((s, m) => s + m.importe, 0) + todayRetiros.reduce((s, m) => s + m.importe, 0);
  const totalEfectivo      = todayIngresos.filter(m => m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const totalTarjeta       = todayIngresos.filter(m => m.payMethod === 'tarjeta').reduce((s, m) => s + m.importe, 0);
  const totalBizum         = todayIngresos.filter(m => m.payMethod === 'bizum').reduce((s, m) => s + m.importe, 0);
  const totalTransferencia = todayIngresos.filter(m => m.payMethod === 'transferencia').reduce((s, m) => s + m.importe, 0);

  const gastoEfectivo  = todayGastos.filter(m => !m.payMethod || m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const retiroEfectivo = todayRetiros.reduce((s, m) => s + m.importe, 0);
  const saldoEfectivoEsperado = saldoApertura + totalEfectivo - gastoEfectivo - retiroEfectivo;
  const saldoFinalEsperado    = saldoApertura + totalIngresos - totalGastos;

  const efectivoContadoNum = parseFloat(efectivoContado.replace(',', '.')) || 0;
  const diferencia = efectivoContadoNum - saldoEfectivoEsperado;

  const handleAbrirCaja = async () => {
    if (!saldoInicial.trim()) { onNotify('error', 'Introduce el saldo inicial'); return; }
    const importe = parseFloat(saldoInicial.replace(',', '.')) || 0;
    const now = new Date().toISOString();
    const id = `CAJA-APR-${Date.now()}`;
    await storage.save('cash_movements', id, {
      id, tipo: 'apertura',
      concepto: `Apertura de caja — ${aperTecnico || 'Responsable'}`,
      importe, payMethod: 'efectivo', categoria: 'otros',
      fecha: today, hora: now.slice(11, 16),
      tecnico: aperTecnico, createdAt: now,
    });
    onNotify('success', `Caja abierta con ${fmt(importe)} de saldo inicial`);
    setShowAperturaModal(false); setSaldoInicial(''); setAperTecnico('');
  };

  const handleAddMovimiento = async () => {
    if (!movConcepto.trim()) { onNotify('error', 'Introduce un concepto'); return; }
    const importe = parseFloat(movImporte.replace(',', '.')) || 0;
    if (importe <= 0) { onNotify('error', 'El importe debe ser mayor que 0'); return; }
    const now = new Date().toISOString();
    const id = `CAJA-MOV-${Date.now()}`;
    await storage.save('cash_movements', id, {
      id, tipo: movTipo, concepto: movConcepto, importe,
      payMethod: movPayMethod, categoria: movCategoria,
      fecha: today, hora: now.slice(11, 16),
      notas: movNotas || undefined, createdAt: now,
    });
    onNotify('success', `Movimiento añadido: ${fmt(importe)}`);
    setShowMovimientoModal(false);
    setMovConcepto(''); setMovImporte(''); setMovPayMethod('efectivo'); setMovCategoria('otros'); setMovNotas('');
  };

  const handleCerrarCaja = async () => {
    const now = new Date().toISOString();
    const id = `CIERRE-${today}`;
    const cierre: CierreCajaType = {
      id, fecha: today,
      apertura: saldoApertura,
      totalIngresos, totalGastos,
      totalEfectivo, totalTarjeta, totalBizum, totalTransferencia,
      saldoFinal: efectivoContadoNum,
      saldoEsperado: saldoEfectivoEsperado,
      diferencia,
      movimientos: todayMovements.map(m => m.id),
      notas: cierreNotas || undefined,
      cerradoPor: cierrePor || undefined,
      createdAt: now,
    };
    await storage.save('cierres_caja', id, cierre);
    const movId = `CAJA-CIE-${Date.now()}`;
    await storage.save('cash_movements', movId, {
      id: movId, tipo: 'cierre',
      concepto: `Cierre de caja — ${cierrePor || 'Responsable'}`,
      importe: efectivoContadoNum, payMethod: 'efectivo', categoria: 'otros',
      fecha: today, hora: now.slice(11, 16),
      tecnico: cierrePor, notas: cierreNotas, createdAt: now,
    });
    onNotify('success', 'Caja cerrada correctamente');
    setShowCierreModal(false); setCierreStep(1);
    setEfectivoContado(''); setCierreNotas(''); setCierrePor('');
  };

  const printCierre = (cierre: CierreCajaType, movs: NormMov[]) => {
    const esc = (s?: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Cierre de Caja ${cierre.fecha}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #1a1a1a; }
  h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; }
  .header { text-align: center; padding-bottom: 16px; border-bottom: 2px solid #000; margin-bottom: 16px; }
  .shop { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
  .subtitle { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.1em; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; text-align: left; padding: 4px 6px; background: #f0f0f0; border: 1px solid #ddd; }
  td { font-size: 10px; padding: 4px 6px; border: 1px solid #ddd; }
  .sum td { font-weight: bold; font-size: 12px; border-top: 2px solid #000; }
  .diff td { font-weight: bold; font-size: 12px; }
  .pos { color: #1b5e20; } .neg { color: #b71c1c; }
  .signature { margin-top: 40px; border-top: 1px solid #000; padding-top: 8px; text-align: center; font-size: 10px; }
  .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #888; }
</style></head><body>
<div class="header">
  <div class="shop">${esc(settings.appName)}</div>
  <div class="subtitle">${esc(settings.address)} · ${esc(settings.phone)}</div>
  <div style="margin-top:8px"><h1>CIERRE DE CAJA</h1></div>
  <div class="subtitle" style="margin-top:4px">${cierre.fecha}${cierre.cerradoPor ? ` · Responsable: ${esc(cierre.cerradoPor)}` : ''}</div>
</div>
<div class="section">
  <div class="section-title">Resumen del día</div>
  <table>
    <tr><td>Saldo inicial (apertura)</td><td style="text-align:right">${fmt(cierre.apertura)}</td></tr>
    <tr><td>Ingresos en efectivo</td><td style="text-align:right;color:#1b5e20">+${fmt(cierre.totalEfectivo)}</td></tr>
    <tr><td>Ingresos tarjeta</td><td style="text-align:right;color:#1565c0">+${fmt(cierre.totalTarjeta)}</td></tr>
    <tr><td>Ingresos Bizum</td><td style="text-align:right;color:#6a1b9a">+${fmt(cierre.totalBizum)}</td></tr>
    <tr><td>Ingresos transferencia</td><td style="text-align:right;color:#00695c">+${fmt(cierre.totalTransferencia)}</td></tr>
    <tr><td>Total gastos/salidas</td><td style="text-align:right;color:#b71c1c">-${fmt(cierre.totalGastos)}</td></tr>
    <tr class="sum"><td>SALDO ESPERADO EN CAJA</td><td style="text-align:right">${fmt(cierre.saldoEsperado)}</td></tr>
    <tr class="sum"><td>SALDO CONTADO FÍSICAMENTE</td><td style="text-align:right">${fmt(cierre.saldoFinal)}</td></tr>
    <tr class="diff"><td>DIFERENCIA</td><td style="text-align:right" class="${cierre.diferencia >= 0 ? 'pos' : 'neg'}">${cierre.diferencia >= 0 ? '+' : ''}${fmt(cierre.diferencia)}</td></tr>
  </table>
</div>
<div class="section">
  <div class="section-title">Movimientos del día (${movs.length})</div>
  <table>
    <thead><tr><th>Hora</th><th>Concepto</th><th>Tipo</th><th>Pago</th><th style="text-align:right">Importe</th></tr></thead>
    <tbody>${movs.map(m => `<tr>
      <td>${esc(m.hora)}</td><td>${esc(m.concepto)}</td><td>${esc(m.tipo)}</td>
      <td>${esc(m.payMethod)}</td>
      <td style="text-align:right;color:${m.tipo === 'ingreso' ? '#1b5e20' : '#b71c1c'}">${m.tipo === 'ingreso' ? '+' : '−'}${fmt(m.importe)}</td>
    </tr>`).join('')}</tbody>
  </table>
</div>
${cierre.notas ? `<div class="section"><div class="section-title">Notas</div><p>${esc(cierre.notas)}</p></div>` : ''}
<div class="signature">
  <p>Firma del responsable: ${esc(cierre.cerradoPor || '___________________')}</p>
  <div style="height:40px"></div><p>___________________________</p>
</div>
<div class="footer">Generado el ${new Date().toLocaleString('es-ES')} · ${esc(settings.appName)}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  const historialFiltered = useMemo(() =>
    cierresCaja.filter(c => c.fecha.startsWith(historialMes)).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [cierresCaja, historialMes]
  );

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f5' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', padding: '20px 24px' }}>
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-[22px] font-black uppercase tracking-widest text-white leading-none">Caja Diaria</h1>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1 capitalize">{todayLabel}</p>
          </div>
          {cajaAbierta ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              Abierta
            </span>
          ) : cierreHoy ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider" style={{ background: 'rgba(0,0,0,0.3)', color: '#fff' }}>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Cerrada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
              Sin abrir
            </span>
          )}
        </div>

        <div className="flex items-end gap-4">
          <div>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Saldo esperado</p>
            <p className="text-4xl font-black text-white">{fmt(saldoFinalEsperado)}</p>
          </div>
          <div className="flex-1" />
          {cajaAbierta && (
            <button
              onClick={() => { setCierreStep(1); setShowCierreModal(true); }}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90"
              style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Cerrar Caja
            </button>
          )}
          {!aperturaHoy && !cierreHoy && (
            <button
              onClick={() => setShowAperturaModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              style={{ background: '#fff', color: '#1b5e20' }}
            >
              Abrir Caja
            </button>
          )}
        </div>
      </div>

      {/* Alert: yesterday not closed */}
      {cajaAyerSinCerrar && (
        <div className="flex items-center gap-3 px-5 py-3" style={{ background: '#ff6f00', color: '#fff' }}>
          <AlertTriangle size={16} className="shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest">
            La caja del {yesterdayStr} no fue cerrada — revisa el historial
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4">
        {(['hoy', 'historial'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'border-b-2 border-green-600 text-green-700' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab === 'hoy' ? '📅 Hoy' : '📚 Historial'}
          </button>
        ))}
      </div>

      {/* ── TAB HOY ── */}
      {activeTab === 'hoy' && (
        <div className="p-4 space-y-4">

          {/* Sin apertura */}
          {!aperturaHoy && !cierreHoy && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet size={48} className="text-slate-300 mb-4" />
              <p className="text-xl font-black text-slate-700 uppercase tracking-tight">Caja sin abrir</p>
              <p className="text-sm text-slate-400 mt-2">Abre la caja para registrar los movimientos de hoy</p>
              <button
                onClick={() => setShowAperturaModal(true)}
                className="mt-6 px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
                style={{ background: '#2e7d32' }}
              >
                Abrir Caja Ahora
              </button>
            </div>
          )}

          {/* Caja cerrada */}
          {cierreHoy && (
            <div className="flex flex-col items-center py-8 text-center bg-white rounded-2xl shadow-sm">
              <CheckCircle size={40} className="text-emerald-500 mb-3" />
              <p className="text-lg font-black text-slate-700 uppercase tracking-tight">Caja Cerrada</p>
              <p className="text-xs text-slate-400 mt-1">
                Cerrada el {cierreHoy.fecha} · Diferencia: <span className={cierreHoy.diferencia >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmt(cierreHoy.diferencia)}</span>
              </p>
              <button
                onClick={() => printCierre(cierreHoy, todayMovements)}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: '#263238', color: '#fff' }}
              >
                <Printer size={14} /> Reimprimir resumen
              </button>
            </div>
          )}

          {/* Resumen + movimientos */}
          {aperturaHoy && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '💵 Efectivo',   value: totalEfectivo,      color: '#2e7d32', sub: `Saldo inicial: ${fmt(saldoApertura)}` },
                  { label: '💳 Tarjeta',    value: totalTarjeta,       color: '#1565c0', sub: '' },
                  { label: '📱 Bizum',      value: totalBizum,         color: '#6a1b9a', sub: '' },
                  { label: '🏦 Transf.',    value: totalTransferencia, color: '#00695c', sub: '' },
                ].map(card => (
                  <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{card.label}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: card.color }}>{fmt(card.value)}</p>
                    {card.sub && <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">📈 Total ingresos</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{fmt(totalIngresos)}</p>
                </div>
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                  <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">📉 Total gastos</p>
                  <p className="text-2xl font-black text-red-700 mt-1">{fmt(totalGastos)}</p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: '#e8f5e9', border: '1px solid #a5d6a7' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#1b5e20' }}>💰 Saldo esperado</p>
                  <p className="text-2xl font-black mt-1" style={{ color: '#1b5e20' }}>{fmt(saldoFinalEsperado)}</p>
                </div>
              </div>

              {/* Movements list */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                    Movimientos de hoy ({todayMovements.length})
                  </h2>
                  {cajaAbierta && (
                    <button
                      onClick={() => setShowMovimientoModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
                      style={{ background: '#2e7d32', color: '#fff' }}
                    >
                      <Plus size={14} /> Añadir
                    </button>
                  )}
                </div>

                {todayMovements.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">Sin movimientos registrados hoy</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {todayMovements.map(m => {
                      const badge = TIPO_BADGE[m.tipo] || TIPO_BADGE.ingreso;
                      return (
                        <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 shrink-0">{m.hora}</span>
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                            style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{m.concepto}</p>
                            {m.payMethod && (
                              <p className="text-[10px] text-slate-400">{PAY_LABELS[m.payMethod] || m.payMethod}</p>
                            )}
                          </div>
                          <span className="text-sm font-black tabular-nums shrink-0"
                            style={{ color: m.tipo === 'ingreso' ? '#1b5e20' : m.tipo === 'apertura' ? '#1565c0' : '#b71c1c' }}>
                            {m.tipo === 'ingreso' ? '+' : m.tipo === 'apertura' ? '' : '−'}{fmt(m.importe)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB HISTORIAL ── */}
      {activeTab === 'historial' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Mes:</label>
            <input
              type="month"
              value={historialMes}
              onChange={e => setHistorialMes(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:outline-none"
            />
          </div>

          {historialFiltered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sin cierres en este período</div>
          ) : (
            <div className="space-y-3">
              {historialFiltered.map(c => {
                const diff = c.diferencia ?? 0;
                return (
                  <div key={c.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-800">{c.fecha}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Ingresos {fmt(c.totalIngresos)} · Gastos {fmt(c.totalGastos)}
                          {c.cerradoPor ? ` · ${c.cerradoPor}` : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-black tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {diff >= 0 ? '+' : ''}{fmt(diff)}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedCierre(c)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors" title="Ver detalle">
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            const movs = allMovements.filter(m => (c.movimientos || []).includes(m.id));
                            printCierre(c, movs);
                          }}
                          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors" title="Reimprimir"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL APERTURA ── */}
      {showAperturaModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Abrir Caja</h2>
              <button onClick={() => setShowAperturaModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Saldo inicial en efectivo (€)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-3 text-lg font-black border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Técnico/Responsable</label>
                <input
                  type="text" list="tecnico-list-aper"
                  value={aperTecnico} onChange={e => setAperTecnico(e.target.value)}
                  placeholder="Nombre del responsable"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-bold text-slate-700"
                />
                <datalist id="tecnico-list-aper">
                  {(settings.technicians || []).map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
            <button
              onClick={handleAbrirCaja}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90"
              style={{ background: '#2e7d32' }}
            >
              Abrir Caja
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL MOVIMIENTO ── */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Añadir Movimiento</h2>
              <button onClick={() => setShowMovimientoModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'ingreso',  label: '↑ Ingreso',   color: '#1b5e20' },
                  { val: 'gasto',    label: '↓ Gasto',     color: '#b71c1c' },
                  { val: 'retirada', label: '↙ Retirada',  color: '#e65100' },
                ] as const).map(opt => (
                  <button key={opt.val} onClick={() => setMovTipo(opt.val)}
                    className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                    style={{ background: movTipo === opt.val ? opt.color : '#f5f5f5', color: movTipo === opt.val ? '#fff' : '#555' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Concepto</label>
              <input type="text" value={movConcepto} onChange={e => setMovConcepto(e.target.value)}
                placeholder="Descripción del movimiento"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-bold text-slate-700" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Importe (€)</label>
              <input type="number" min="0" step="0.01" value={movImporte} onChange={e => setMovImporte(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 text-lg font-black border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Forma de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {(['efectivo', 'tarjeta', 'bizum', 'transferencia'] as const).map(pay => (
                  <button key={pay} onClick={() => setMovPayMethod(pay)}
                    className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                    style={{ background: movPayMethod === pay ? '#1a1a1a' : '#f5f5f5', color: movPayMethod === pay ? '#fff' : '#555' }}>
                    {PAY_LABELS[pay]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Categoría</label>
              <select value={movCategoria} onChange={e => setMovCategoria(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-bold text-slate-700 bg-white">
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Notas (opcional)</label>
              <input type="text" value={movNotas} onChange={e => setMovNotas(e.target.value)}
                placeholder="Notas adicionales..."
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-bold text-slate-700" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowMovimientoModal(false)}
                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all text-[11px]">
                Cancelar
              </button>
              <button onClick={handleAddMovimiento}
                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90 text-[11px]"
                style={{ background: '#2e7d32' }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CIERRE ── */}
      {showCierreModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Cerrar Caja</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Paso {cierreStep} de 2</p>
              </div>
              <button onClick={() => { setShowCierreModal(false); setCierreStep(1); }} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            {cierreStep === 1 && (
              <>
                <div className="rounded-2xl p-4 space-y-2" style={{ background: '#f5f5f5' }}>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efectivo esperado en caja</p>
                  <p className="text-3xl font-black text-slate-800">{fmt(saldoEfectivoEsperado)}</p>
                  <p className="text-[10px] text-slate-400">
                    Apertura {fmt(saldoApertura)} + Efectivo {fmt(totalEfectivo)} − Gastos ef. {fmt(gastoEfectivo)} − Retiros {fmt(retiroEfectivo)}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Efectivo contado físicamente (€)</label>
                  <input type="number" min="0" step="0.01"
                    value={efectivoContado} onChange={e => setEfectivoContado(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-4 py-3 text-2xl font-black border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500"
                    autoFocus />
                </div>
                {efectivoContado && (
                  <div className={`rounded-2xl p-4 text-center ${Math.abs(diferencia) > 5 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: Math.abs(diferencia) > 5 ? '#b71c1c' : '#1b5e20' }}>Diferencia</p>
                    <p className="text-2xl font-black mt-1" style={{ color: diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>
                      {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                    </p>
                    {Math.abs(diferencia) > 5 && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center justify-center gap-1">
                        <AlertTriangle size={12} /> Diferencia superior a 5 € — revisa el recuento
                      </p>
                    )}
                  </div>
                )}
                <button onClick={() => setCierreStep(2)} disabled={!efectivoContado}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#1a1a1a', color: '#fff' }}>
                  Continuar →
                </button>
              </>
            )}

            {cierreStep === 2 && (
              <>
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {([
                        ['Saldo inicial', fmt(saldoApertura)],
                        ['Ingresos efectivo', `+${fmt(totalEfectivo)}`],
                        ['Ingresos tarjeta', `+${fmt(totalTarjeta)}`],
                        ['Ingresos Bizum', `+${fmt(totalBizum)}`],
                        ['Ingresos transf.', `+${fmt(totalTransferencia)}`],
                        ['Gastos / salidas', `−${fmt(totalGastos)}`],
                      ] as [string, string][]).map(([label, val]) => (
                        <tr key={label}>
                          <td className="px-4 py-2.5 text-slate-600 text-xs font-bold">{label}</td>
                          <td className="px-4 py-2.5 text-right text-xs font-black text-slate-800">{val}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f5f5f5' }}>
                        <td className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-700">Saldo esperado</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{fmt(saldoEfectivoEsperado)}</td>
                      </tr>
                      <tr style={{ background: '#f5f5f5' }}>
                        <td className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-700">Saldo contado</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{fmt(efectivoContadoNum)}</td>
                      </tr>
                      <tr style={{ background: diferencia !== 0 ? (diferencia > 0 ? '#e8f5e9' : '#ffebee') : '#f5f5f5' }}>
                        <td className="px-4 py-3 text-[11px] font-black uppercase tracking-wide" style={{ color: diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>Diferencia</td>
                        <td className="px-4 py-3 text-right text-sm font-black" style={{ color: diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>
                          {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {Math.abs(diferencia) > 5 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-700">Diferencia superior a 5 € — considera revisar el recuento antes de cerrar</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Notas del cierre</label>
                  <textarea value={cierreNotas} onChange={e => setCierreNotas(e.target.value)}
                    placeholder="Observaciones sobre el cierre..." rows={3}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-bold text-slate-700 resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cerrado por</label>
                  <input type="text" list="tecnico-list-cierre"
                    value={cierrePor} onChange={e => setCierrePor(e.target.value)}
                    placeholder="Nombre del responsable"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-bold text-slate-700" />
                  <datalist id="tecnico-list-cierre">
                    {(settings.technicians || []).map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setCierreStep(1)}
                    className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all text-[11px]">
                    ← Volver
                  </button>
                  <button onClick={handleCerrarCaja}
                    className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90 text-[11px]"
                    style={{ background: '#1b5e20' }}>
                    Confirmar cierre
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE CIERRE HISTORIAL ── */}
      {selectedCierre && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Detalle del cierre</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{selectedCierre.fecha}</p>
              </div>
              <button onClick={() => setSelectedCierre(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {([
                    ['Saldo inicial', fmt(selectedCierre.apertura)],
                    ['Ingresos efectivo', `+${fmt(selectedCierre.totalEfectivo)}`],
                    ['Ingresos tarjeta', `+${fmt(selectedCierre.totalTarjeta)}`],
                    ['Ingresos Bizum', `+${fmt(selectedCierre.totalBizum)}`],
                    ['Ingresos transf.', `+${fmt(selectedCierre.totalTransferencia)}`],
                    ['Total ingresos', `+${fmt(selectedCierre.totalIngresos)}`],
                    ['Total gastos', `−${fmt(selectedCierre.totalGastos)}`],
                  ] as [string, string][]).map(([label, val]) => (
                    <tr key={label}>
                      <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{label}</td>
                      <td className="px-4 py-2.5 text-xs font-black text-right text-slate-800">{val}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f5f5f5' }}>
                    <td className="px-4 py-3 text-[11px] font-black uppercase text-slate-700">Saldo esperado</td>
                    <td className="px-4 py-3 text-right text-sm font-black">{fmt(selectedCierre.saldoEsperado)}</td>
                  </tr>
                  <tr style={{ background: '#f5f5f5' }}>
                    <td className="px-4 py-3 text-[11px] font-black uppercase text-slate-700">Saldo contado</td>
                    <td className="px-4 py-3 text-right text-sm font-black">{fmt(selectedCierre.saldoFinal)}</td>
                  </tr>
                  <tr style={{ background: selectedCierre.diferencia >= 0 ? '#e8f5e9' : '#ffebee' }}>
                    <td className="px-4 py-3 text-[11px] font-black uppercase" style={{ color: selectedCierre.diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>Diferencia</td>
                    <td className="px-4 py-3 text-right text-sm font-black" style={{ color: selectedCierre.diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>
                      {selectedCierre.diferencia >= 0 ? '+' : ''}{fmt(selectedCierre.diferencia)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {selectedCierre.notas && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Notas</p>
                <p className="text-sm text-slate-700">{selectedCierre.notas}</p>
              </div>
            )}
            {selectedCierre.cerradoPor && (
              <p className="text-[10px] text-slate-400 text-center">Cerrado por: {selectedCierre.cerradoPor}</p>
            )}
            <button
              onClick={() => { const movs = allMovements.filter(m => (selectedCierre.movimientos || []).includes(m.id)); printCierre(selectedCierre, movs); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90 text-[11px]"
              style={{ background: '#263238' }}
            >
              <Printer size={14} /> Reimprimir resumen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Caja;
