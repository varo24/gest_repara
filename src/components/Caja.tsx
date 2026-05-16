import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet, Plus, X, Printer, ArrowLeft,
  AlertTriangle, CheckCircle, Eye, RotateCcw, Pencil, Trash2,
  FileSpreadsheet, FileText
} from 'lucide-react';
import { AppSettings, CierreCaja as CierreCajaType, DetalleBilletes } from '../types';
import { storage } from '../lib/dataService';
import { exportCajaExcel, exportCajaPdf } from '../lib/cajaExport';
import { localDateStr } from '../lib/cajaUtils';

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
  facturasImportadas?: any[];
  settings: AppSettings;
  onBack: () => void;
  onViewArchivo?: () => void;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

// ── Denominaciones ────────────────────────────────────────────────────────────

const DENOMINACIONES = [
  { key: 'b200', label: '200 €',   valor: 200,  emoji: '💶', esBillete: true },
  { key: 'b100', label: '100 €',   valor: 100,  emoji: '💶', esBillete: true },
  { key: 'b50',  label: '50 €',    valor: 50,   emoji: '💶', esBillete: true },
  { key: 'b20',  label: '20 €',    valor: 20,   emoji: '💶', esBillete: true },
  { key: 'b10',  label: '10 €',    valor: 10,   emoji: '💶', esBillete: true },
  { key: 'b5',   label: '5 €',     valor: 5,    emoji: '💶', esBillete: true },
  { key: 'm200', label: '2 €',     valor: 2,    emoji: '🪙', esBillete: false },
  { key: 'm100', label: '1 €',     valor: 1,    emoji: '🪙', esBillete: false },
  { key: 'm050', label: '0,50 €',  valor: 0.5,  emoji: '🪙', esBillete: false },
  { key: 'm020', label: '0,20 €',  valor: 0.2,  emoji: '🪙', esBillete: false },
  { key: 'm010', label: '0,10 €',  valor: 0.1,  emoji: '🪙', esBillete: false },
] as const;

type DenomKey = typeof DENOMINACIONES[number]['key'];

const INIT_BILLETES: Record<DenomKey, number> = {
  b200: 0, b100: 0, b50: 0, b20: 0, b10: 0, b5: 0,
  m200: 0, m100: 0, m050: 0, m020: 0, m010: 0,
};

// Work in integer cents to avoid floating-point issues
const computeTotal = (b: Record<string, number>) =>
  DENOMINACIONES.reduce((s, d) => s + Math.round(d.valor * 100) * (b[d.key] || 0), 0) / 100;

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  ingreso:  { label: '↑ Ingreso',  color: '#1b5e20', bg: '#e8f5e9' },
  gasto:    { label: '↓ Gasto',    color: '#b71c1c', bg: '#ffebee' },
  retirada: { label: '↙ Retirada', color: '#e65100', bg: '#fff3e0' },
  apertura: { label: '⊕ Apertura', color: '#1565c0', bg: '#e3f2fd' },
  cierre:   { label: '⊘ Cierre',  color: '#37474f', bg: '#eceff1' },
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

// ── Component ─────────────────────────────────────────────────────────────────


const Caja: React.FC<CajaProps> = ({ cashMovements, cierresCaja, facturasImportadas = [], settings, onBack, onViewArchivo, onNotify }) => {
  const today = localDateStr(new Date());
  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [activeTab, setActiveTab] = useState<'hoy' | 'historial'>('hoy');
  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cierreStep, setCierreStep] = useState<1 | 2>(1);

  // Bill/coin counter state (replaces simple efectivoContado string)
  const [billetes, setBilletes] = useState<Record<string, number>>({ ...INIT_BILLETES });

  const [cierreNotas, setCierreNotas] = useState('');
  const [cierrePor, setCierrePor] = useState('');
  const [selectedCierre, setSelectedCierre] = useState<CierreCajaType | null>(null);
  const [historialMes, setHistorialMes] = useState('');
  const [deletingMov, setDeletingMov] = useState<NormMov | null>(null);

  // Edit cierre state
  const [editingCierre, setEditingCierre] = useState<CierreCajaType | null>(null);
  const [editBilletes, setEditBilletes] = useState<Record<string, number>>({ ...INIT_BILLETES });
  const [editSaldoInicial, setEditSaldoInicial] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editCerradoPor, setEditCerradoPor] = useState('');
  // Delete cierre state
  const [deletingCierre, setDeletingCierre] = useState<CierreCajaType | null>(null);

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

  // Force a Firestore pull for cierres_caja when the historial tab opens.
  // Needed because isSyncFresh() may skip pullAll on mount, leaving IDB stale.
  useEffect(() => {
    if (activeTab === 'historial') {
      storage.refreshCollection('cierres_caja').catch(() => {});
    }
  }, [activeTab]);


  const allMovements = useMemo(() => cashMovements.map(normalizeMov), [cashMovements]);

  // Facturas de proveedor cuya fecha (de la factura) coincide con el día
  const facturaProveedores = useMemo(() =>
    facturasImportadas.filter((f: any) => (f.fecha || '').slice(0, 10) === today),
    [facturasImportadas, today]
  );

  const facturaMovs: NormMov[] = useMemo(() =>
    facturaProveedores.map((f: any) => ({
      id: f.id,
      tipo: 'gasto' as const,
      concepto: `Factura proveedor: ${f.proveedor || ''} - ${f.numeroFactura || ''}`,
      importe: f.total || 0,
      payMethod: f.cajaPay || 'transferencia',
      categoria: 'proveedor',
      facturaId: f.id,
      fecha: (f.fecha || '').slice(0, 10),
      hora: f.importadoEn ? f.importadoEn.slice(11, 16) : '00:00',
      createdAt: f.importadoEn || '',
    })),
    [facturaProveedores]
  );

  const todayMovements = useMemo(() =>
    allMovements
      .filter(m => m.fecha === today)
      .sort((a, b) => (a.createdAt || a.hora).localeCompare(b.createdAt || b.hora)),
    [allMovements, today]
  );

  // Derivados reactivos — useMemo hace las dependencias explícitas aunque el comportamiento
  // sería idéntico como expresiones simples (se reevalúan en cada render al cambiar props)
  const aperturaHoy = useMemo(
    () => todayMovements.find(m => m.tipo === 'apertura'),
    [todayMovements]
  );
  const saldoApertura = aperturaHoy?.importe ?? 0;
  const cierreHoy = useMemo(
    () => cierresCaja.find(c => (c.fecha || '').slice(0, 10) === today),
    [cierresCaja, today]
  );
  const cajaAbierta = !!aperturaHoy && !cierreHoy;

  // Alert: yesterday not closed — use local date to avoid UTC midnight off-by-one
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = localDateStr(yesterdayDate);

  const cierreAyer = useMemo(
    () => cierresCaja.find(c => (c.fecha || '').slice(0, 10) === yesterdayStr),
    [cierresCaja, yesterdayStr]
  );
  // Exclude apertura movements explicitly marked ignorada: true (dismissed by user).
  // Only match on explicit fecha/date — no createdAt fallback.
  const aperturaAyer = useMemo(
    () => cashMovements.find(m => {
      const fecha = (m.fecha || m.date || '').slice(0, 10);
      return fecha === yesterdayStr && (m.tipo || m.type) === 'apertura' && !m.ignorada;
    }),
    [cashMovements, yesterdayStr]
  );
  const cajaAyerSinCerrar = !!aperturaAyer && !cierreAyer;

  // Today summary
  const todayIngresos = todayMovements.filter(m => m.tipo === 'ingreso');
  const todayGastos   = todayMovements.filter(m => m.tipo === 'gasto');
  const todayRetiros  = todayMovements.filter(m => m.tipo === 'retirada');

  const totalIngresos      = todayIngresos.reduce((s, m) => s + m.importe, 0);
  const totalGastosMov     = todayGastos.reduce((s, m) => s + m.importe, 0) + todayRetiros.reduce((s, m) => s + m.importe, 0);
  const totalFacturasGasto = facturaMovs.reduce((s, m) => s + m.importe, 0);
  const totalGastos        = totalGastosMov + totalFacturasGasto;
  const totalEfectivo      = todayIngresos.filter(m => m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const totalTarjeta       = todayIngresos.filter(m => m.payMethod === 'tarjeta').reduce((s, m) => s + m.importe, 0);
  const totalBizum         = todayIngresos.filter(m => m.payMethod === 'bizum').reduce((s, m) => s + m.importe, 0);
  const totalTransferencia = todayIngresos.filter(m => m.payMethod === 'transferencia').reduce((s, m) => s + m.importe, 0);

  const gastoEfectivo      = todayGastos.filter(m => !m.payMethod || m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const retiroEfectivo     = todayRetiros.reduce((s, m) => s + m.importe, 0);
  const gastoEfectivoFact  = facturaMovs.filter(m => m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const saldoEfectivoEsperado = saldoApertura + totalEfectivo - gastoEfectivo - retiroEfectivo - gastoEfectivoFact;
  const saldoFinalEsperado    = saldoApertura + totalIngresos - totalGastos;

  // Bill counter derived values
  const subtotalBilletes  = DENOMINACIONES.filter(d => d.esBillete).reduce((s, d) => s + Math.round(d.valor * 100) * (billetes[d.key] || 0), 0) / 100;
  const subtotalMonedas   = DENOMINACIONES.filter(d => !d.esBillete).reduce((s, d) => s + Math.round(d.valor * 100) * (billetes[d.key] || 0), 0) / 100;
  const efectivoContadoNum = computeTotal(billetes);
  const diferencia = Math.round((efectivoContadoNum - saldoEfectivoEsperado) * 100) / 100;

  const setDenom = (key: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0);
    setBilletes(prev => ({ ...prev, [key]: n }));
  };

  const resetBilletes = () => setBilletes({ ...INIT_BILLETES });

  const closeCierreModal = () => {
    setShowCierreModal(false);
    setCierreStep(1);
    resetBilletes();
    setCierreNotas('');
    setCierrePor('');
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    const id = `CIERRE-${today}-${crypto.randomUUID().slice(0, 8)}`;
    const detalleBilletes: DetalleBilletes = {
      b200: billetes.b200 || 0,
      b100: billetes.b100 || 0, b50: billetes.b50 || 0,
      b20: billetes.b20 || 0,  b10: billetes.b10 || 0, b5: billetes.b5 || 0,
      m200: billetes.m200 || 0, m100: billetes.m100 || 0,
      m050: billetes.m050 || 0, m020: billetes.m020 || 0,
      m010: billetes.m010 || 0,
    };
    const cierre: CierreCajaType = {
      id, fecha: today,
      apertura: saldoApertura,
      totalIngresos, totalGastos,
      totalEfectivo, totalTarjeta, totalBizum, totalTransferencia,
      saldoFinal: efectivoContadoNum,
      saldoEsperado: saldoEfectivoEsperado,
      diferencia,
      movimientos: todayMovements.map(m => m.id),
      detalleBilletes,
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
    closeCierreModal();
  };

  const handleDismissAlerta = async () => {
    if (!aperturaAyer) return;
    // Mark the apertura movement itself as ignored — avoids creating fake cierres
    // that cause a re-alert loop when deleted.
    await storage.save('cash_movements', aperturaAyer.id, { ...aperturaAyer, ignorada: true });
    onNotify('info', `Alerta del ${yesterdayStr} descartada.`);
  };

  const handleDeleteMov = async () => {
    if (!deletingMov) return;
    await storage.remove('cash_movements', deletingMov.id);
    // todayMovements se recalcula automáticamente porque es useMemo sobre cashMovements (prop reactiva)
    onNotify('success', 'Movimiento eliminado');
    setDeletingMov(null);
  };

  const handleCajaPay = async (facturaId: string, pay: string) => {
    const f = facturasImportadas.find((x: any) => x.id === facturaId);
    if (f) await storage.save('facturas_importadas', facturaId, { ...f, cajaPay: pay });
  };

  // ── Edit / Delete cierre ─────────────────────────────────────────────────

  const openEditModal = (c: CierreCajaType) => {
    setEditingCierre(c);
    setEditSaldoInicial(String(c.apertura));
    setEditNotas(c.notas || '');
    setEditCerradoPor(c.cerradoPor || '');
    if (c.detalleBilletes) {
      const db = c.detalleBilletes;
      setEditBilletes({
        b200: db.b200 || 0, b100: db.b100 || 0, b50: db.b50 || 0,
        b20:  db.b20  || 0, b10:  db.b10  || 0, b5:  db.b5  || 0,
        m200: db.m200 || 0, m100: db.m100 || 0, m050: db.m050 || 0,
        m020: db.m020 || 0, m010: db.m010 || 0,
      });
    } else {
      setEditBilletes({ ...INIT_BILLETES });
    }
  };

  const setEditDenom = (key: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0);
    setEditBilletes(prev => ({ ...prev, [key]: n }));
  };

  const handleEditCierre = async () => {
    if (!editingCierre) return;
    const apertura = parseFloat(editSaldoInicial.replace(',', '.')) || editingCierre.apertura;
    const dayMovs    = allMovements.filter(m => m.fecha === editingCierre.fecha);
    const dayIngs    = dayMovs.filter(m => m.tipo === 'ingreso');
    const dayGsts    = dayMovs.filter(m => m.tipo === 'gasto');
    const dayRets    = dayMovs.filter(m => m.tipo === 'retirada');
    const ef  = dayIngs.filter(m => m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
    const tar = dayIngs.filter(m => m.payMethod === 'tarjeta').reduce((s, m) => s + m.importe, 0);
    const biz = dayIngs.filter(m => m.payMethod === 'bizum').reduce((s, m) => s + m.importe, 0);
    const tra = dayIngs.filter(m => m.payMethod === 'transferencia').reduce((s, m) => s + m.importe, 0);
    const totalIngs = dayIngs.reduce((s, m) => s + m.importe, 0);
    const totalGsts = dayGsts.reduce((s, m) => s + m.importe, 0) + dayRets.reduce((s, m) => s + m.importe, 0);
    const gstEf = dayGsts.filter(m => !m.payMethod || m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
    const retEf = dayRets.reduce((s, m) => s + m.importe, 0);
    const dayFacts = facturasImportadas.filter((f: any) => (f.fecha || '').slice(0, 10) === editingCierre.fecha);
    const totalFactsGasto = dayFacts.reduce((s: number, f: any) => s + (f.total || 0), 0);
    const gstEfFact = dayFacts.filter((f: any) => (f.cajaPay || 'transferencia') === 'efectivo').reduce((s: number, f: any) => s + (f.total || 0), 0);
    const saldoEsp  = apertura + ef - gstEf - retEf - gstEfFact;
    const totalGstsAll = totalGsts + totalFactsGasto;
    const contado  = computeTotal(editBilletes);
    const diff     = Math.round((contado - saldoEsp) * 100) / 100;
    const detalleBilletes: DetalleBilletes = {
      b200: editBilletes.b200 || 0, b100: editBilletes.b100 || 0,
      b50:  editBilletes.b50  || 0, b20:  editBilletes.b20  || 0,
      b10:  editBilletes.b10  || 0, b5:   editBilletes.b5   || 0,
      m200: editBilletes.m200 || 0, m100: editBilletes.m100 || 0,
      m050: editBilletes.m050 || 0, m020: editBilletes.m020 || 0,
      m010: editBilletes.m010 || 0,
    };
    await storage.save('cierres_caja', editingCierre.id, {
      ...editingCierre,
      apertura, totalIngresos: totalIngs, totalGastos: totalGstsAll,
      totalEfectivo: ef, totalTarjeta: tar, totalBizum: biz, totalTransferencia: tra,
      saldoFinal: contado, saldoEsperado: saldoEsp, diferencia: diff,
      detalleBilletes, notas: editNotas || undefined, cerradoPor: editCerradoPor || undefined,
    });
    onNotify('success', 'Cierre actualizado correctamente');
    setEditingCierre(null);
  };

  const handleDeleteCierre = async () => {
    if (!deletingCierre) return;
    await storage.remove('cierres_caja', deletingCierre.id);
    onNotify('success', `Cierre del ${deletingCierre.fecha} eliminado`);
    setDeletingCierre(null);
  };

  // ── Print ─────────────────────────────────────────────────────────────────

  const printCierre = (cierre: CierreCajaType, movs: NormMov[], facts?: any[]) => {
    const esc = (s?: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const db = cierre.detalleBilletes;
    const billeteSection = db ? (() => {
      const subB = DENOMINACIONES.filter(d => d.esBillete).reduce((s, d) => s + Math.round(d.valor * 100) * (db[d.key as DenomKey] || 0), 0) / 100;
      const subM = DENOMINACIONES.filter(d => !d.esBillete).reduce((s, d) => s + Math.round(d.valor * 100) * (db[d.key as DenomKey] || 0), 0) / 100;
      const rows = DENOMINACIONES.map(d => {
        const qty = db[d.key as DenomKey] || 0;
        if (qty === 0) return '';
        const subtot = Math.round(d.valor * 100) * qty / 100;
        return `<tr><td>${d.emoji} ${d.label}</td><td style="text-align:center">${qty}</td><td style="text-align:right">${fmt(subtot)}</td></tr>`;
      }).filter(Boolean).join('');
      return `<div class="section">
  <div class="section-title">Desglose de efectivo contado</div>
  <table>
    <thead><tr><th>Denominación</th><th style="text-align:center">Cantidad</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="2" style="font-weight:bold">Subtotal billetes</td><td style="text-align:right;font-weight:bold">${fmt(subB)}</td></tr>
      <tr><td colspan="2" style="font-weight:bold">Subtotal monedas</td><td style="text-align:right;font-weight:bold">${fmt(subM)}</td></tr>
      <tr style="border-top:2px solid #000"><td colspan="2" style="font-weight:900;text-transform:uppercase">Total efectivo contado</td><td style="text-align:right;font-weight:900;font-size:13px">${fmt(cierre.saldoFinal)}</td></tr>
    </tfoot>
  </table>
</div>`;
    })() : '';

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
  tfoot td { font-weight: bold; border-top: 1px solid #999; }
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
    <tr><td>Gastos / salidas</td><td style="text-align:right;color:#b71c1c">-${fmt(cierre.totalGastos)}</td></tr>
    ${facts && facts.length > 0 ? `<tr><td>  └ Facturas proveedores incluidas</td><td style="text-align:right;color:#b71c1c">-${fmt(facts.reduce((s: number, f: any) => s + (f.total || 0), 0))}</td></tr>` : ''}
    <tr class="sum"><td>SALDO ESPERADO EN CAJA</td><td style="text-align:right">${fmt(cierre.saldoEsperado)}</td></tr>
    <tr class="sum"><td>SALDO CONTADO FÍSICAMENTE</td><td style="text-align:right">${fmt(cierre.saldoFinal)}</td></tr>
    <tr class="diff"><td>DIFERENCIA</td><td style="text-align:right" class="${cierre.diferencia >= 0 ? 'pos' : 'neg'}">${cierre.diferencia >= 0 ? '+' : ''}${fmt(cierre.diferencia)}</td></tr>
  </table>
</div>
${billeteSection}
${facts && facts.length > 0 ? `<div class="section">
  <div class="section-title">Facturas de proveedores (${facts.length})</div>
  <table>
    <thead><tr><th>Proveedor</th><th>Nº Factura</th><th>Fecha</th><th>Pago</th><th style="text-align:right">Importe</th></tr></thead>
    <tbody>${facts.map((f: any) => `<tr>
      <td>${esc(f.proveedor)}</td><td>${esc(f.numeroFactura)}</td><td>${esc((f.fecha||'').slice(0,10))}</td>
      <td>${esc(f.cajaPay||'transferencia')}</td>
      <td style="text-align:right;color:#b71c1c">-${fmt(f.total||0)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="4" style="font-weight:bold">Total facturas</td><td style="text-align:right;font-weight:bold;color:#b71c1c">-${fmt(facts.reduce((s: number, f: any) => s + (f.total||0), 0))}</td></tr></tfoot>
  </table>
</div>` : ''}
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

  // Edit modal derived values (zero when editingCierre is null — modal hidden)
  const editSubtotalBilletes = DENOMINACIONES.filter(d => d.esBillete).reduce((s, d) => s + Math.round(d.valor * 100) * (editBilletes[d.key] || 0), 0) / 100;
  const editSubtotalMonedas  = DENOMINACIONES.filter(d => !d.esBillete).reduce((s, d) => s + Math.round(d.valor * 100) * (editBilletes[d.key] || 0), 0) / 100;
  const editEfectivoNum      = computeTotal(editBilletes);
  const editApertParsed      = parseFloat(editSaldoInicial.replace(',', '.')) || 0;
  const editDayMovs  = editingCierre ? allMovements.filter(m => m.fecha === editingCierre.fecha) : [];
  const editDayIngs  = editDayMovs.filter(m => m.tipo === 'ingreso');
  const editDayGsts  = editDayMovs.filter(m => m.tipo === 'gasto');
  const editDayRets  = editDayMovs.filter(m => m.tipo === 'retirada');
  const editEfIng    = editDayIngs.filter(m => m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const editGstEf    = editDayGsts.filter(m => !m.payMethod || m.payMethod === 'efectivo').reduce((s, m) => s + m.importe, 0);
  const editRetEf    = editDayRets.reduce((s, m) => s + m.importe, 0);
  const editSaldoEsp = editApertParsed + editEfIng - editGstEf - editRetEf;
  const editDiff     = Math.round((editEfectivoNum - editSaldoEsp) * 100) / 100;

  const historialFiltered = useMemo(() => {
    // Exclude dismissed: true (legacy fake-cierres from old approach — keep for compat)
    const sorted = [...cierresCaja]
      .filter(c => c.fecha && !c.dismissed)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if (!historialMes) return sorted;
    return sorted.filter(c => c.fecha.slice(0, 7) === historialMes);
  }, [cierresCaja, historialMes]);

  // ── Render ────────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ background: '#ff6f00', color: '#fff' }}>
          <AlertTriangle size={16} className="shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest flex-1">
            La caja del {yesterdayStr} no fue cerrada — revisa el historial
          </p>
          <button
            onClick={handleDismissAlerta}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-80 shrink-0"
            style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
            title="Marcar esta caja como cerrada para que no vuelva a aparecer la alerta"
          >
            Descartar
          </button>
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

          {cierreHoy && (
            <div className="flex flex-col items-center py-8 text-center bg-white rounded-2xl shadow-sm">
              <CheckCircle size={40} className="text-emerald-500 mb-3" />
              <p className="text-lg font-black text-slate-700 uppercase tracking-tight">Caja Cerrada</p>
              <p className="text-xs text-slate-400 mt-1">
                Cerrada el {cierreHoy.fecha} · Diferencia: <span className={cierreHoy.diferencia >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmt(cierreHoy.diferencia)}</span>
              </p>
              <button
                onClick={() => printCierre(cierreHoy, todayMovements, facturaProveedores)}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: '#263238', color: '#fff' }}
              >
                <Printer size={14} /> Reimprimir resumen
              </button>
            </div>
          )}

          {aperturaHoy && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '💵 Efectivo',  value: totalEfectivo,      color: '#2e7d32', sub: `Saldo inicial: ${fmt(saldoApertura)}` },
                  { label: '💳 Tarjeta',   value: totalTarjeta,       color: '#1565c0', sub: '' },
                  { label: '📱 Bizum',     value: totalBizum,         color: '#6a1b9a', sub: '' },
                  { label: '🏦 Transf.',   value: totalTransferencia, color: '#00695c', sub: '' },
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

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                    Movimientos de hoy ({todayMovements.length + facturaMovs.length})
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
                {todayMovements.length === 0 && facturaMovs.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">Sin movimientos registrados hoy</div>
                )}
                {todayMovements.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {todayMovements.map(m => {
                      const badge = TIPO_BADGE[m.tipo] || TIPO_BADGE.ingreso;
                      const canDelete = m.tipo !== 'apertura' && m.tipo !== 'cierre';
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 shrink-0">{m.hora}</span>
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                            style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{m.concepto}</p>
                            {m.payMethod && <p className="text-[10px] text-slate-400">{PAY_LABELS[m.payMethod] || m.payMethod}</p>}
                          </div>
                          <span className="text-sm font-black tabular-nums shrink-0"
                            style={{ color: m.tipo === 'ingreso' ? '#1b5e20' : m.tipo === 'apertura' ? '#1565c0' : '#b71c1c' }}>
                            {m.tipo === 'ingreso' ? '+' : m.tipo === 'apertura' ? '' : '−'}{fmt(m.importe)}
                          </span>
                          {canDelete && (
                            <button
                              onClick={() => setDeletingMov(m)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors shrink-0"
                              title="Eliminar movimiento"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Facturas de proveedores del día */}
                {facturaMovs.length > 0 && (
                  <>
                    <div className="px-5 py-2 border-t border-red-100" style={{ background: '#fff5f5' }}>
                      <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">
                        📦 Facturas proveedores ({facturaMovs.length})
                      </p>
                    </div>
                    <div className="divide-y divide-red-50">
                      {facturaMovs.map(m => {
                        const f = facturasImportadas.find((x: any) => x.id === m.id);
                        return (
                          <div key={m.id} className="flex items-center gap-3 px-5 py-3" style={{ background: '#fff8f8' }}>
                            <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 shrink-0">{m.hora}</span>
                            <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0 bg-red-100 text-red-700">
                              📦 Proveedor
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">
                                {f?.proveedor || ''}{f?.numeroFactura ? ` · ${f.numeroFactura}` : ''}
                              </p>
                              <select
                                value={m.payMethod}
                                onChange={e => handleCajaPay(m.id, e.target.value)}
                                className="mt-0.5 text-[10px] border border-slate-200 rounded-lg px-1.5 py-0.5 bg-white text-slate-500 font-bold focus:outline-none"
                              >
                                {(['efectivo', 'tarjeta', 'bizum', 'transferencia'] as const).map(p => (
                                  <option key={p} value={p}>{PAY_LABELS[p]}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {onViewArchivo && (
                                <button
                                  onClick={onViewArchivo}
                                  className="text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                  Ver factura
                                </button>
                              )}
                              <span className="text-sm font-black tabular-nums text-red-600">
                                −{fmt(m.importe)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB HISTORIAL ── */}
      {activeTab === 'historial' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Filtrar:</label>
            <input
              type="month" value={historialMes} onChange={e => setHistorialMes(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:outline-none"
            />
            {historialMes && (
              <button
                onClick={() => setHistorialMes('')}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Ver todos
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => exportCajaExcel(historialFiltered, allMovements, settings.appName, historialMes)}
                disabled={historialFiltered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <FileSpreadsheet size={13} />
                Excel
              </button>
              <button
                onClick={() => exportCajaPdf(historialFiltered, allMovements, settings.appName, historialMes)}
                disabled={historialFiltered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <FileText size={13} />
                PDF
              </button>
            </div>
          </div>
          {historialFiltered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {historialMes ? 'Sin cierres en este mes' : 'No hay cierres registrados aún'}
            </div>
          ) : (
            <div className="space-y-3">
              {historialFiltered.map(c => {
                const diff = c.diferencia ?? 0;
                return (
                  <div key={c.id} className="rounded-2xl shadow-sm overflow-hidden bg-white">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-800">{c.fecha}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {`Ingresos ${fmt(c.totalIngresos)} · Gastos ${fmt(c.totalGastos)}${c.cerradoPor ? ` · ${c.cerradoPor}` : ''}`}
                        </p>
                      </div>
                      <span className={`text-sm font-black tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {`${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => openEditModal(c)} className="p-2 rounded-xl hover:bg-blue-50 text-blue-300 hover:text-blue-600 transition-colors" title="Editar cierre">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setSelectedCierre(c)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors" title="Ver detalle">
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => { const movs = allMovements.filter(m => (c.movimientos || []).includes(m.id)); const facts = facturasImportadas.filter((f: any) => (f.fecha || '').slice(0, 10) === c.fecha); printCierre(c, movs, facts); }}
                          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors" title="Reimprimir"
                        >
                          <Printer size={15} />
                        </button>
                        <button onClick={() => setDeletingCierre(c)} className="p-2 rounded-xl hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors" title="Eliminar cierre">
                          <Trash2 size={15} />
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
                  { val: 'ingreso',  label: '↑ Ingreso',  color: '#1b5e20' },
                  { val: 'gasto',    label: '↓ Gasto',    color: '#b71c1c' },
                  { val: 'retirada', label: '↙ Retirada', color: '#e65100' },
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
          <div className={`bg-white rounded-[2rem] shadow-2xl w-full p-6 md:p-8 space-y-5 max-h-[92vh] overflow-y-auto ${cierreStep === 1 ? 'max-w-xl' : 'max-w-md'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Cerrar Caja</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Paso {cierreStep} de 2</p>
              </div>
              <button onClick={closeCierreModal} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            {/* ── PASO 1: Recuento de billetes y monedas ── */}
            {cierreStep === 1 && (
              <>
                {/* Expected cash */}
                <div className="rounded-2xl p-4 space-y-1" style={{ background: '#f0f4f0', border: '1px solid #c8e6c9' }}>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efectivo esperado en caja</p>
                  <p className="text-2xl font-black text-slate-800">{fmt(saldoEfectivoEsperado)}</p>
                  <p className="text-[10px] text-slate-400">
                    Apertura {fmt(saldoApertura)} + Efectivo {fmt(totalEfectivo)} − Gastos ef. {fmt(gastoEfectivo)} − Retiros {fmt(retiroEfectivo)}
                  </p>
                </div>

                {/* Bill/coin table */}
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ background: '#fafafa' }}>
                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Recuento de efectivo</p>
                    <button onClick={resetBilletes}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all">
                      <RotateCcw size={12} /> Limpiar todo
                    </button>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_80px_80px_90px] gap-0 px-3 py-2 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest" style={{ background: '#f9f9f9' }}>
                    <span>Denominación</span>
                    <span className="text-center">Cantidad</span>
                    <span className="text-right">Valor</span>
                    <span className="text-right">Total fila</span>
                  </div>

                  {/* Billetes section */}
                  <div className="border-b-2 border-slate-200">
                    <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest" style={{ background: '#fffde7' }}>
                      💶 BILLETES
                    </div>
                    {DENOMINACIONES.filter(d => d.esBillete).map(d => {
                      const qty = billetes[d.key] || 0;
                      const rowTotal = Math.round(d.valor * 100) * qty / 100;
                      return (
                        <div key={d.key}
                          className={`grid grid-cols-[1fr_80px_80px_90px] items-center gap-2 px-3 py-2 border-b border-slate-50 ${qty > 0 ? 'bg-amber-50' : ''}`}>
                          <span className="text-sm font-bold text-slate-700">{d.emoji} {d.label}</span>
                          <input
                            type="number" min="0" step="1" inputMode="numeric"
                            value={qty === 0 ? '' : qty}
                            onChange={e => setDenom(d.key, e.target.value)}
                            placeholder="0"
                            className="w-full text-center text-base font-black border-2 rounded-xl py-2 focus:outline-none focus:border-green-500 tabular-nums"
                            style={{ borderColor: qty > 0 ? '#f59e0b' : '#e2e8f0' }}
                          />
                          <span className="text-right text-xs text-slate-400 tabular-nums">{fmt(d.valor)}</span>
                          <span className={`text-right text-sm font-black tabular-nums ${qty > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                            {fmt(rowTotal)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-[1fr_80px_80px_90px] px-3 py-2.5" style={{ background: '#fef9c3' }}>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide col-span-3">Subtotal billetes</span>
                      <span className="text-right text-sm font-black text-amber-700 tabular-nums">{fmt(subtotalBilletes)}</span>
                    </div>
                  </div>

                  {/* Monedas section */}
                  <div>
                    <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest" style={{ background: '#f3e5f5' }}>
                      🪙 MONEDAS
                    </div>
                    {DENOMINACIONES.filter(d => !d.esBillete).map(d => {
                      const qty = billetes[d.key] || 0;
                      const rowTotal = Math.round(d.valor * 100) * qty / 100;
                      return (
                        <div key={d.key}
                          className={`grid grid-cols-[1fr_80px_80px_90px] items-center gap-2 px-3 py-2 border-b border-slate-50 ${qty > 0 ? 'bg-purple-50' : ''}`}>
                          <span className="text-sm font-bold text-slate-700">{d.emoji} {d.label}</span>
                          <input
                            type="number" min="0" step="1" inputMode="numeric"
                            value={qty === 0 ? '' : qty}
                            onChange={e => setDenom(d.key, e.target.value)}
                            placeholder="0"
                            className="w-full text-center text-base font-black border-2 rounded-xl py-2 focus:outline-none focus:border-green-500 tabular-nums"
                            style={{ borderColor: qty > 0 ? '#a855f7' : '#e2e8f0' }}
                          />
                          <span className="text-right text-xs text-slate-400 tabular-nums">{fmt(d.valor)}</span>
                          <span className={`text-right text-sm font-black tabular-nums ${qty > 0 ? 'text-purple-700' : 'text-slate-300'}`}>
                            {fmt(rowTotal)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-[1fr_80px_80px_90px] px-3 py-2.5" style={{ background: '#f3e5f5' }}>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide col-span-3">Subtotal monedas</span>
                      <span className="text-right text-sm font-black text-purple-700 tabular-nums">{fmt(subtotalMonedas)}</span>
                    </div>
                  </div>
                </div>

                {/* Running total summary */}
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500">Subtotal billetes</span>
                    <span className="text-sm font-black text-amber-700 tabular-nums">{fmt(subtotalBilletes)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500">Subtotal monedas</span>
                    <span className="text-sm font-black text-purple-700 tabular-nums">{fmt(subtotalMonedas)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-4" style={{ background: '#e8f5e9' }}>
                    <span className="text-sm font-black uppercase tracking-wide text-green-800">💰 Total contado</span>
                    <span className="text-2xl font-black tabular-nums" style={{ color: '#1b5e20' }}>{fmt(efectivoContadoNum)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500">Efectivo esperado</span>
                    <span className="text-sm font-black text-slate-700 tabular-nums">{fmt(saldoEfectivoEsperado)}</span>
                  </div>
                  <div className={`flex justify-between items-center px-4 py-3 border-t ${Math.abs(diferencia) > 5 ? 'bg-red-50 border-red-100' : diferencia === 0 ? 'bg-slate-50' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className="text-xs font-black uppercase tracking-wide" style={{ color: diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>
                      Diferencia
                    </span>
                    <div className="flex items-center gap-2">
                      {Math.abs(diferencia) > 5 && <AlertTriangle size={14} className="text-red-500" />}
                      <span className="text-lg font-black tabular-nums" style={{ color: diferencia >= 0 ? '#1b5e20' : '#b71c1c' }}>
                        {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                      </span>
                    </div>
                  </div>
                </div>

                {Math.abs(diferencia) > 5 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-700">Diferencia superior a 5 € — revisa el recuento antes de continuar</p>
                  </div>
                )}

                <button onClick={() => setCierreStep(2)}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-[11px]"
                  style={{ background: '#1a1a1a', color: '#fff' }}>
                  Continuar → (Contado: {fmt(efectivoContadoNum)})
                </button>
              </>
            )}

            {/* ── PASO 2: Resumen + confirmar ── */}
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
                        ['Gastos varios', `−${fmt(totalGastosMov)}`],
                        ...(totalFacturasGasto > 0 ? [['Facturas proveedores', `−${fmt(totalFacturasGasto)}`] as [string, string]] : []),
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
                    <p className="text-xs font-bold text-red-700">Diferencia superior a 5 € — considera revisar el recuento</p>
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

      {/* ── MODAL EDITAR CIERRE ── */}
      {editingCierre && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl p-6 md:p-8 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Editar Cierre</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{editingCierre.fecha}</p>
              </div>
              <button onClick={() => setEditingCierre(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            {/* Saldo inicial */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Saldo inicial (apertura) €</label>
              <input
                type="number" min="0" step="0.01"
                value={editSaldoInicial} onChange={e => setEditSaldoInicial(e.target.value)}
                className="w-full px-4 py-3 text-lg font-black border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Saldo esperado se recalculará automáticamente desde los movimientos del día</p>
            </div>

            {/* Bill/coin table */}
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ background: '#fafafa' }}>
                <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Recuento de efectivo</p>
                <button onClick={() => setEditBilletes({ ...INIT_BILLETES })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all">
                  <RotateCcw size={12} /> Limpiar
                </button>
              </div>
              <div className="grid grid-cols-[1fr_80px_80px_90px] gap-0 px-3 py-2 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest" style={{ background: '#f9f9f9' }}>
                <span>Denominación</span><span className="text-center">Cantidad</span><span className="text-right">Valor</span><span className="text-right">Total fila</span>
              </div>
              {/* Billetes */}
              <div className="border-b-2 border-slate-200">
                <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest" style={{ background: '#fffde7' }}>💶 BILLETES</div>
                {DENOMINACIONES.filter(d => d.esBillete).map(d => {
                  const qty = editBilletes[d.key] || 0;
                  const rowTotal = Math.round(d.valor * 100) * qty / 100;
                  return (
                    <div key={d.key} className={`grid grid-cols-[1fr_80px_80px_90px] items-center gap-2 px-3 py-2 border-b border-slate-50 ${qty > 0 ? 'bg-amber-50' : ''}`}>
                      <span className="text-sm font-bold text-slate-700">{d.emoji} {d.label}</span>
                      <input type="number" min="0" step="1" inputMode="numeric"
                        value={qty === 0 ? '' : qty} onChange={e => setEditDenom(d.key, e.target.value)} placeholder="0"
                        className="w-full text-center text-base font-black border-2 rounded-xl py-2 focus:outline-none focus:border-blue-500 tabular-nums"
                        style={{ borderColor: qty > 0 ? '#f59e0b' : '#e2e8f0' }} />
                      <span className="text-right text-xs text-slate-400 tabular-nums">{fmt(d.valor)}</span>
                      <span className={`text-right text-sm font-black tabular-nums ${qty > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{fmt(rowTotal)}</span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1fr_80px_80px_90px] px-3 py-2.5" style={{ background: '#fef9c3' }}>
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide col-span-3">Subtotal billetes</span>
                  <span className="text-right text-sm font-black text-amber-700 tabular-nums">{fmt(editSubtotalBilletes)}</span>
                </div>
              </div>
              {/* Monedas */}
              <div>
                <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest" style={{ background: '#f3e5f5' }}>🪙 MONEDAS</div>
                {DENOMINACIONES.filter(d => !d.esBillete).map(d => {
                  const qty = editBilletes[d.key] || 0;
                  const rowTotal = Math.round(d.valor * 100) * qty / 100;
                  return (
                    <div key={d.key} className={`grid grid-cols-[1fr_80px_80px_90px] items-center gap-2 px-3 py-2 border-b border-slate-50 ${qty > 0 ? 'bg-purple-50' : ''}`}>
                      <span className="text-sm font-bold text-slate-700">{d.emoji} {d.label}</span>
                      <input type="number" min="0" step="1" inputMode="numeric"
                        value={qty === 0 ? '' : qty} onChange={e => setEditDenom(d.key, e.target.value)} placeholder="0"
                        className="w-full text-center text-base font-black border-2 rounded-xl py-2 focus:outline-none focus:border-blue-500 tabular-nums"
                        style={{ borderColor: qty > 0 ? '#a855f7' : '#e2e8f0' }} />
                      <span className="text-right text-xs text-slate-400 tabular-nums">{fmt(d.valor)}</span>
                      <span className={`text-right text-sm font-black tabular-nums ${qty > 0 ? 'text-purple-700' : 'text-slate-300'}`}>{fmt(rowTotal)}</span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1fr_80px_80px_90px] px-3 py-2.5" style={{ background: '#f3e5f5' }}>
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide col-span-3">Subtotal monedas</span>
                  <span className="text-right text-sm font-black text-purple-700 tabular-nums">{fmt(editSubtotalMonedas)}</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500">Subtotal billetes</span>
                <span className="text-sm font-black text-amber-700 tabular-nums">{fmt(editSubtotalBilletes)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500">Subtotal monedas</span>
                <span className="text-sm font-black text-purple-700 tabular-nums">{fmt(editSubtotalMonedas)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-4" style={{ background: '#e8f5e9' }}>
                <span className="text-sm font-black uppercase tracking-wide text-green-800">💰 Total contado</span>
                <span className="text-2xl font-black tabular-nums" style={{ color: '#1b5e20' }}>{fmt(editEfectivoNum)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500">Efectivo esperado (recalculado)</span>
                <span className="text-sm font-black text-slate-700 tabular-nums">{fmt(editSaldoEsp)}</span>
              </div>
              <div className={`flex justify-between items-center px-4 py-3 border-t ${Math.abs(editDiff) > 5 ? 'bg-red-50' : editDiff === 0 ? 'bg-slate-50' : 'bg-emerald-50'}`}>
                <span className="text-xs font-black uppercase tracking-wide" style={{ color: editDiff >= 0 ? '#1b5e20' : '#b71c1c' }}>Diferencia</span>
                <span className="text-lg font-black tabular-nums" style={{ color: editDiff >= 0 ? '#1b5e20' : '#b71c1c' }}>
                  {editDiff >= 0 ? '+' : ''}{fmt(editDiff)}
                </span>
              </div>
            </div>

            {/* Notas + cerrado por */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Notas del cierre</label>
              <textarea value={editNotas} onChange={e => setEditNotas(e.target.value)}
                placeholder="Observaciones..." rows={2}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 resize-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cerrado por</label>
              <input type="text" list="tecnico-list-edit"
                value={editCerradoPor} onChange={e => setEditCerradoPor(e.target.value)}
                placeholder="Nombre del responsable"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-bold text-slate-700" />
              <datalist id="tecnico-list-edit">
                {(settings.technicians || []).map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingCierre(null)}
                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all text-[11px]">
                Cancelar
              </button>
              <button onClick={handleEditCierre}
                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90 text-[11px]"
                style={{ background: '#1565c0' }}>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR BORRADO CIERRE ── */}
      {deletingCierre && (() => {
        const daysOld = (Date.now() - new Date(deletingCierre.fecha).getTime()) / (1000 * 60 * 60 * 24);
        const isOld = daysOld > 30;
        return (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Eliminar cierre</h2>
                <button onClick={() => setDeletingCierre(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
              </div>
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
                <p className="text-sm font-black text-red-800">
                  ¿Eliminar el cierre del {deletingCierre.fecha}?
                </p>
                <p className="text-xs text-red-600">
                  Esta acción no se puede deshacer. Los movimientos del día NO se eliminarán.
                </p>
              </div>
              {isOld && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-700">
                    Este cierre tiene más de 30 días. ¿Seguro que quieres eliminarlo?
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDeletingCierre(null)}
                  className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all text-[11px]">
                  Cancelar
                </button>
                <button onClick={handleDeleteCierre}
                  className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90 text-[11px]"
                  style={{ background: '#b71c1c' }}>
                  Eliminar cierre
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL CONFIRMAR BORRADO MOVIMIENTO ── */}
      {deletingMov && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Eliminar movimiento</h2>
              <button onClick={() => setDeletingMov(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
              <p className="text-sm font-black text-red-800 truncate">{deletingMov.concepto}</p>
              <p className="text-lg font-black tabular-nums" style={{ color: '#b71c1c' }}>
                {deletingMov.tipo === 'ingreso' ? '+' : '−'}{fmt(deletingMov.importe)}
              </p>
              <p className="text-xs text-red-600">
                Esta acción no se puede deshacer. El saldo del día se recalculará automáticamente.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingMov(null)}
                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all text-[11px]">
                Cancelar
              </button>
              <button onClick={handleDeleteMov}
                className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white transition-all hover:opacity-90 text-[11px]"
                style={{ background: '#b71c1c' }}>
                Eliminar
              </button>
            </div>
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

            {/* Desglose billetes en detalle historial */}
            {selectedCierre.detalleBilletes && (() => {
              const db = selectedCierre.detalleBilletes!;
              const usedDenoms = DENOMINACIONES.filter(d => (db[d.key as DenomKey] || 0) > 0);
              if (!usedDenoms.length) return null;
              return (
                <div className="rounded-2xl overflow-hidden border border-slate-100">
                  <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400" style={{ background: '#fafafa' }}>
                    Desglose de efectivo
                  </div>
                  <div className="divide-y divide-slate-50">
                    {usedDenoms.map(d => {
                      const qty = db[d.key as DenomKey] || 0;
                      return (
                        <div key={d.key} className="flex items-center justify-between px-4 py-2">
                          <span className="text-xs text-slate-600">{d.emoji} {d.label} × {qty}</span>
                          <span className="text-xs font-black text-slate-800 tabular-nums">{fmt(Math.round(d.valor * 100) * qty / 100)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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
              onClick={() => { const movs = allMovements.filter(m => (selectedCierre.movimientos || []).includes(m.id)); const facts = facturasImportadas.filter((f: any) => (f.fecha || '').slice(0, 10) === selectedCierre.fecha); printCierre(selectedCierre, movs, facts); }}
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
