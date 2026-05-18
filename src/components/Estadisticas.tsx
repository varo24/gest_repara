import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
  ComposedChart,
} from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart2, Package } from 'lucide-react';
import {
  AppSettings, RepairItem, InventoryItem, StockMovement, FullInvoice,
  RepairStatus, Supplier,
} from '../types';

interface Props {
  repairs: RepairItem[];
  invoices: FullInvoice[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  cashMovements: any[];
  facturasImportadas: any[];
  suppliers: Supplier[];
  onBack: () => void;
}

type Period = 'week' | 'month' | 'year' | 'custom';

const PIE_COLORS = ['#2e7d32', '#1565c0', '#f57f17', '#6a1b9a', '#00695c', '#b71c1c', '#e65100', '#00838f'];

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + ' €';
const fmtShort = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : fmtEur(n);
const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('es-ES') : '—';

function getRange(period: Period, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date();
  if (period === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
    return { start: s, end: now };
  }
  if (period === 'month') {
    const s = new Date(now); s.setDate(now.getDate() - 29); s.setHours(0, 0, 0, 0);
    return { start: s, end: now };
  }
  if (period === 'year') {
    const s = new Date(now); s.setFullYear(now.getFullYear() - 1); s.setHours(0, 0, 0, 0);
    return { start: s, end: now };
  }
  return {
    start: customStart ? new Date(customStart + 'T00:00:00') : new Date(now.setDate(now.getDate() - 29)),
    end:   customEnd   ? new Date(customEnd   + 'T23:59:59') : new Date(),
  };
}

function buildDays(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function buildMonths(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push(cur.toISOString().slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function normMov(m: any) {
  return {
    tipo:     m.tipo      ?? m.type,
    concepto: m.concepto  ?? m.description ?? '',
    importe:  m.importe   ?? m.amount ?? 0,
    fecha:    m.fecha      ?? m.date ?? '',
    payMethod: m.payMethod ?? '',
  };
}

function deviceCategory(raw: string): string {
  const d = (raw || '').toLowerCase();
  if (/móvil|movil|smartphone|iphone|android|phone/.test(d)) return 'Móvil';
  if (/tablet|ipad/.test(d)) return 'Tablet';
  if (/portátil|portatil|laptop|notebook|macbook/.test(d)) return 'Portátil';
  if (/pc|desktop|ordenador|torre|sobremesa/.test(d)) return 'PC';
  if (/lavador|secador|frigorí|nevera|horno|microondas|lavarropa|electro/.test(d)) return 'Electrodoméstico';
  return 'Otro';
}

function linReg(pts: { x: number; y: number }[]): (x: number) => number {
  const n = pts.length;
  if (n < 2) return () => (pts[0]?.y ?? 0);
  const sumX  = pts.reduce((a, p) => a + p.x, 0);
  const sumY  = pts.reduce((a, p) => a + p.y, 0);
  const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = pts.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return () => sumY / n;
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return (x: number) => m * x + b;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <div className="flex items-center gap-2 mb-4 mt-6">
    {icon && <span className="text-slate-500">{icon}</span>}
    <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{children}</h2>
    <div className="flex-1 h-px bg-slate-200" />
  </div>
);

const Card: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({ label, value, sub, color = '#1b5e20' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-1">
    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
    <span className="text-2xl font-black leading-none" style={{ color }}>{value}</span>
    {sub && <span className="text-[10px] text-slate-400 font-medium">{sub}</span>}
  </div>
);

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-black text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <b>{typeof p.value === 'number' && p.value > 100 ? fmtEur(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const INACTIVE_STATUSES = [RepairStatus.DELIVERED, RepairStatus.CANCELLED, RepairStatus.SIN_REPARACION];

const Estadisticas: React.FC<Props> = ({
  repairs, invoices, inventory, stockMovements, cashMovements,
  facturasImportadas, suppliers, onBack,
}) => {
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');

  const { start, end } = useMemo(() => getRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  const monthly   = rangeDays > 62;

  const inRange = (iso: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= start && d <= end;
  };

  // ── A: Facturación ─────────────────────────────────────────────────────────
  const filtInvoices = useMemo(
    () => invoices.filter(inv => inRange(inv.date) && inv.status !== 'anulada'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, start, end],
  );

  const totalFac    = filtInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalIVA    = filtInvoices.reduce((s, i) => s + (i.taxAmount ?? 0), 0);
  const totalBase   = filtInvoices.reduce((s, i) => s + (i.subtotal ?? 0), 0);
  const mediaFac    = filtInvoices.length ? totalFac / filtInvoices.length : 0;
  const cobradas    = filtInvoices.filter(i => i.status === 'cobrada').length;

  const chart1Data = useMemo(() => {
    if (monthly) {
      const months = buildMonths(start, end);
      return months.map(m => ({
        key: m.slice(5),
        FAC: filtInvoices.filter(i => i.date?.startsWith(m) && (i.invoiceNumber || '').startsWith('FAC')).reduce((s, i) => s + (i.total ?? 0), 0),
        REC: filtInvoices.filter(i => i.date?.startsWith(m) && (i.invoiceNumber || '').startsWith('REC')).reduce((s, i) => s + (i.total ?? 0), 0),
      }));
    }
    const days = buildDays(start, end);
    return days.map(d => ({
      key: d.slice(5),
      FAC: filtInvoices.filter(i => i.date?.startsWith(d) && (i.invoiceNumber || '').startsWith('FAC')).reduce((s, i) => s + (i.total ?? 0), 0),
      REC: filtInvoices.filter(i => i.date?.startsWith(d) && (i.invoiceNumber || '').startsWith('REC')).reduce((s, i) => s + (i.total ?? 0), 0),
    }));
  }, [filtInvoices, monthly, start, end]);

  const chart2Data = useMemo(() => {
    const counts: Record<string, number> = {};
    filtInvoices.forEach(i => {
      const pm = i.payMethod || 'Sin especificar';
      counts[pm] = (counts[pm] ?? 0) + (i.total ?? 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [filtInvoices]);

  const top10Clientes = useMemo(() => {
    const map: Record<string, number> = {};
    filtInvoices.forEach(i => { map[i.customerName || '?'] = (map[i.customerName || '?'] ?? 0) + (i.total ?? 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtInvoices]);

  // ── B: Reparaciones ────────────────────────────────────────────────────────
  const filtRepairs = useMemo(
    () => repairs.filter(r => inRange(r.entryDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repairs, start, end],
  );

  const entregadas  = filtRepairs.filter(r => r.status === RepairStatus.DELIVERED);
  const canceladas  = filtRepairs.filter(r => r.status === RepairStatus.CANCELLED || r.status === RepairStatus.SIN_REPARACION);
  const tasaExito   = filtRepairs.length
    ? Math.round((entregadas.length / filtRepairs.length) * 100)
    : 0;

  const tiempoMedio = useMemo(() => {
    const withTime = entregadas.filter(r => r.updatedAt);
    if (!withTime.length) return 0;
    const total = withTime.reduce((s, r) => {
      const days = (new Date(r.updatedAt!).getTime() - new Date(r.entryDate).getTime()) / 86400000;
      return s + Math.max(0, days);
    }, 0);
    return Math.round((total / withTime.length) * 10) / 10;
  }, [entregadas]);

  const chart3Data = useMemo(() => {
    const counts: Record<string, number> = {};
    filtRepairs.forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtRepairs]);

  const chart4Data = useMemo(() => {
    const cats: Record<string, number> = {};
    filtRepairs.forEach(r => {
      const cat = deviceCategory(r.deviceType);
      cats[cat] = (cats[cat] ?? 0) + 1;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [filtRepairs]);

  const chart5Data = useMemo(() => {
    if (monthly) {
      const months = buildMonths(start, end);
      return months.map(m => ({
        key: m.slice(5),
        Entradas:   filtRepairs.filter(r => r.entryDate?.startsWith(m)).length,
        Entregas:   entregadas.filter(r => r.updatedAt?.startsWith(m)).length,
      }));
    }
    const days = buildDays(start, end);
    return days.map(d => ({
      key: d.slice(5),
      Entradas:   filtRepairs.filter(r => r.entryDate?.startsWith(d)).length,
      Entregas:   entregadas.filter(r => r.updatedAt?.startsWith(d)).length,
    }));
  }, [filtRepairs, entregadas, monthly, start, end]);

  const top10Averias = useMemo(() => {
    const map: Record<string, number> = {};
    filtRepairs.forEach(r => {
      const k = r.problemDescription?.split('\n')[0]?.slice(0, 40).trim() || 'Sin descripción';
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtRepairs]);

  // ── C: Inventario ──────────────────────────────────────────────────────────
  const filtStock = useMemo(
    () => stockMovements.filter(m => inRange(m.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stockMovements, start, end],
  );

  const totalStockVal = inventory.reduce((s, it) => s + (it.stock ?? 0) * (it.costPrice ?? 0), 0);
  const bajoStock     = inventory.filter(it => it.stock <= it.minStock).length;
  const entradasStock = filtStock.filter(m => m.type === 'entrada').reduce((s, m) => s + (m.qty ?? 0), 0);
  const salidasStock  = filtStock.filter(m => m.type === 'salida').reduce((s, m) => s + (m.qty ?? 0), 0);
  const ajustesStock  = filtStock.filter(m => m.type === 'ajuste').reduce((s, m) => s + Math.abs(m.qty ?? 0), 0);

  const chart6Data = useMemo(() => {
    if (monthly) {
      const months = buildMonths(start, end);
      return months.map(m => ({
        key: m.slice(5),
        Entradas: filtStock.filter(s => s.date?.startsWith(m) && s.type === 'entrada').reduce((a, s) => a + (s.qty ?? 0), 0),
        Salidas:  filtStock.filter(s => s.date?.startsWith(m) && s.type === 'salida').reduce((a, s) => a + (s.qty ?? 0), 0),
        Ajustes:  filtStock.filter(s => s.date?.startsWith(m) && s.type === 'ajuste').reduce((a, s) => a + Math.abs(s.qty ?? 0), 0),
      }));
    }
    const days = buildDays(start, end);
    return days.map(d => ({
      key: d.slice(5),
      Entradas: filtStock.filter(s => s.date?.startsWith(d) && s.type === 'entrada').reduce((a, s) => a + (s.qty ?? 0), 0),
      Salidas:  filtStock.filter(s => s.date?.startsWith(d) && s.type === 'salida').reduce((a, s) => a + (s.qty ?? 0), 0),
      Ajustes:  filtStock.filter(s => s.date?.startsWith(d) && s.type === 'ajuste').reduce((a, s) => a + Math.abs(s.qty ?? 0), 0),
    }));
  }, [filtStock, monthly, start, end]);

  const top10Piezas = useMemo(() => {
    const map: Record<string, number> = {};
    filtStock.filter(m => m.type === 'salida').forEach(m => {
      map[m.description || m.ref || '?'] = (map[m.description || m.ref || '?'] ?? 0) + (m.qty ?? 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtStock]);

  // ── D: Compras (facturas importadas) ───────────────────────────────────────
  const filtImportadas = useMemo(
    () => facturasImportadas.filter(f => inRange(f.fecha || f.importadoEn || '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facturasImportadas, start, end],
  );

  const totalCompras       = filtImportadas.filter(f => f.estado !== 'descartada').reduce((s, f) => s + (f.total ?? 0), 0);
  const nPendientes        = filtImportadas.filter(f => f.estado === 'pendiente_revision').length;
  const nImportadas        = filtImportadas.filter(f => f.estado === 'importada').length;
  const nDescartadas       = filtImportadas.filter(f => f.estado === 'descartada').length;

  const top5Proveedores = useMemo(() => {
    const map: Record<string, number> = {};
    filtImportadas
      .filter(f => f.estado !== 'descartada')
      .forEach(f => {
        const key = f.proveedor || 'Sin nombre';
        map[key] = (map[key] ?? 0) + (f.total ?? 0);
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtImportadas]);

  // ── E: Caja ────────────────────────────────────────────────────────────────
  const filtMov = useMemo(
    () => cashMovements.map(normMov).filter(m => inRange(m.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cashMovements, start, end],
  );

  const cajaMov     = filtMov.filter(m => m.tipo !== 'apertura' && m.tipo !== 'cierre');
  const cajIngresos = cajaMov.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.importe ?? 0), 0);
  const cajGastos   = cajaMov.filter(m => m.tipo === 'gasto' || m.tipo === 'retirada').reduce((s, m) => s + Math.abs(m.importe ?? 0), 0);
  const cajBalance  = cajIngresos - cajGastos;
  const nMovCaja    = cajaMov.length;

  const chart7Data = useMemo(() => {
    if (monthly) {
      const months = buildMonths(start, end);
      return months.map(m => {
        const movs = cajaMov.filter(mv => mv.fecha?.startsWith(m));
        const ingresos = movs.filter(mv => mv.tipo === 'ingreso').reduce((a, mv) => a + (mv.importe ?? 0), 0);
        const gastos   = movs.filter(mv => mv.tipo === 'gasto' || mv.tipo === 'retirada').reduce((a, mv) => a + Math.abs(mv.importe ?? 0), 0);
        return { key: m.slice(5), Ingresos: ingresos, Gastos: gastos, Balance: ingresos - gastos };
      });
    }
    const days = buildDays(start, end);
    return days.map(d => {
      const movs = cajaMov.filter(mv => mv.fecha?.startsWith(d));
      const ingresos = movs.filter(mv => mv.tipo === 'ingreso').reduce((a, mv) => a + (mv.importe ?? 0), 0);
      const gastos   = movs.filter(mv => mv.tipo === 'gasto' || mv.tipo === 'retirada').reduce((a, mv) => a + Math.abs(mv.importe ?? 0), 0);
      return { key: d.slice(5), Ingresos: ingresos, Gastos: gastos, Balance: ingresos - gastos };
    });
  }, [cajaMov, monthly, start, end]);

  // ── F: Tendencia (últimos 12 meses siempre) ────────────────────────────────
  const chart8Data = useMemo(() => {
    const now2 = new Date();
    const months12: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
      months12.push(d.toISOString().slice(0, 7));
    }
    const pts = months12.map((m, idx) => ({
      key: m.slice(5),
      Total: invoices
        .filter(inv => inv.date?.startsWith(m) && inv.status !== 'anulada')
        .reduce((s, i) => s + (i.total ?? 0), 0),
      x: idx,
    }));
    const regFn = linReg(pts.map(p => ({ x: p.x, y: p.Total })));
    return pts.map(p => ({ ...p, Tendencia: Math.max(0, Math.round(regFn(p.x) * 100) / 100) }));
  }, [invoices]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const PERIOD_LABELS: Record<Period, string> = {
    week: 'Última semana', month: 'Último mes', year: 'Último año', custom: 'Personalizado',
  };

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f5' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-[13px] font-black uppercase tracking-widest text-slate-800">Estadísticas</h1>
          <p className="text-[10px] text-slate-400 font-medium">
            {PERIOD_LABELS[period]}
            {period !== 'custom' && ` · ${fmtDate(start.toISOString())} – ${fmtDate(end.toISOString())}`}
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 px-4 pt-4 flex-wrap">
        {(['week', 'month', 'year', 'custom'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all"
            style={{
              background:   period === p ? '#1b5e20' : '#fff',
              color:        period === p ? '#fff'    : '#555',
              borderColor:  period === p ? '#1b5e20' : '#e0e0e0',
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex gap-2 items-center w-full mt-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="flex-1 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold" />
            <span className="text-xs text-slate-400">–</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold" />
          </div>
        )}
      </div>

      <div className="px-4 pb-8">

        {/* ── A: Facturación ─────────────────────────────────────────────────── */}
        <SectionTitle icon={<TrendingUp size={14} />}>Facturación</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card label="Total facturado" value={fmtShort(totalFac)} sub={`Base: ${fmtShort(totalBase)}`} color="#1b5e20" />
          <Card label="IVA repercutido" value={fmtShort(totalIVA)} color="#2e7d32" />
          <Card label="Ticket medio" value={fmtShort(mediaFac)} sub={`${filtInvoices.length} facturas`} color="#1565c0" />
          <Card label="Cobradas" value={String(cobradas)} sub={`de ${filtInvoices.length}`} color="#f57f17" />
        </div>

        {/* Chart 1: Ingresos por período */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Ingresos por {monthly ? 'mes' : 'día'}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart1Data} barSize={monthly ? 18 : 8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : String(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="FAC" name="Con IVA"  fill="#2e7d32" radius={[4,4,0,0]} />
              <Bar dataKey="REC" name="Sin IVA"  fill="#1565c0" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Forma de pago */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Forma de pago (importe)</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={chart2Data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {chart2Data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtEur(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top clientes */}
        {top10Clientes.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Top 10 clientes por facturación</p>
            <div className="divide-y divide-slate-100">
              {top10Clientes.map(([name, total], i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 w-4">{i + 1}</span>
                    <span className="text-xs font-bold text-slate-700">{name}</span>
                  </div>
                  <span className="text-xs font-black text-green-800">{fmtEur(total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── B: Reparaciones ────────────────────────────────────────────────── */}
        <SectionTitle icon={<BarChart2 size={14} />}>Reparaciones</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Card label="Total entradas"  value={String(filtRepairs.length)} color="#1565c0" />
          <Card label="Entregadas"      value={String(entregadas.length)} sub={`Canceladas: ${canceladas.length}`} color="#2e7d32" />
          <Card label="Tasa de éxito"   value={`${tasaExito}%`} color={tasaExito >= 70 ? '#2e7d32' : '#f57f17'} />
          <Card label="Tiempo medio"    value={`${tiempoMedio} días`} sub="entradas → entregadas" color="#6a1b9a" />
          <Card label="Activas ahora"   value={String(filtRepairs.filter(r => !INACTIVE_STATUSES.includes(r.status as RepairStatus)).length)} color="#e65100" />
        </div>

        {/* Chart 3: Por estado */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Reparaciones por estado</p>
          <ResponsiveContainer width="100%" height={Math.max(160, chart3Data.length * 28)}>
            <BarChart data={chart3Data} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Reparaciones" fill="#1565c0" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Por tipo de dispositivo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Por tipo de dispositivo</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={chart4Data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent*100).toFixed(0)}%` : ''} labelLine={false}>
                {chart4Data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: Entradas vs entregas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Entradas vs entregas por {monthly ? 'mes' : 'día'}</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart5Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Entradas" stroke="#1565c0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Entregas" stroke="#2e7d32" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top averías */}
        {top10Averias.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Top 10 averías más frecuentes</p>
            <div className="divide-y divide-slate-100">
              {top10Averias.map(([desc, count], i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 w-4">{i + 1}</span>
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[220px]">{desc}</span>
                  </div>
                  <span className="text-xs font-black text-blue-800">{count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── C: Inventario ──────────────────────────────────────────────────── */}
        <SectionTitle>Inventario</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card label="Valor stock"   value={fmtShort(totalStockVal)} sub={`${inventory.length} refs.`} color="#00695c" />
          <Card label="Bajo mínimo"   value={String(bajoStock)} sub="referencias" color={bajoStock > 0 ? '#b71c1c' : '#2e7d32'} />
          <Card label="Entradas"      value={`+${entradasStock} uds`} color="#2e7d32" />
          <Card label="Salidas / Aj." value={`-${salidasStock} / ~${ajustesStock}`} sub="uds" color="#4e342e" />
        </div>

        {/* Chart 6: Movimientos de stock */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Movimientos de stock por {monthly ? 'mes' : 'día'}</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart6Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Entradas" stroke="#2e7d32" fill="#2e7d3220" strokeWidth={2} />
              <Area type="monotone" dataKey="Salidas"  stroke="#b71c1c" fill="#b71c1c15" strokeWidth={2} />
              <Area type="monotone" dataKey="Ajustes"  stroke="#f57f17" fill="#f57f1715" strokeWidth={1} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {top10Piezas.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Top 10 piezas más usadas (salidas)</p>
            <div className="divide-y divide-slate-100">
              {top10Piezas.map(([desc, qty], i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 w-4">{i + 1}</span>
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[220px]">{desc}</span>
                  </div>
                  <span className="text-xs font-black text-teal-800">{qty} uds</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── D: Compras ─────────────────────────────────────────────────────── */}
        <SectionTitle icon={<Package size={14} />}>Compras — Facturas de proveedores</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card label="Total compras"       value={fmtShort(totalCompras)} sub={`${filtImportadas.length} facturas`} color="#1565c0" />
          <Card label="Pendiente revisión"  value={String(nPendientes)} sub="sin confirmar" color={nPendientes > 0 ? '#f57f17' : '#2e7d32'} />
          <Card label="Confirmadas"         value={String(nImportadas)} sub="importadas a stock" color="#2e7d32" />
          <Card label="Descartadas"         value={String(nDescartadas)} sub="del período" color="#78909c" />
        </div>

        {top5Proveedores.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Top 5 proveedores por volumen de compra</p>
            <div className="divide-y divide-slate-100">
              {top5Proveedores.map(([name, total], i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 w-4">{i + 1}</span>
                    <span className="text-xs font-bold text-slate-700">{name}</span>
                  </div>
                  <span className="text-xs font-black text-blue-800">{fmtEur(total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtImportadas.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-3 text-center">
            <p className="text-xs text-slate-400 font-medium">No hay facturas de proveedores en el período seleccionado</p>
            <p className="text-[10px] text-slate-300 mt-1">Las facturas se importan automáticamente desde el módulo Correos</p>
          </div>
        )}

        {/* ── E: Caja ────────────────────────────────────────────────────────── */}
        <SectionTitle icon={<TrendingDown size={14} />}>Caja</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card label="Ingresos caja"  value={fmtShort(cajIngresos)} color="#2e7d32" />
          <Card label="Gastos caja"    value={fmtShort(cajGastos)}   color="#b71c1c" />
          <Card label="Balance"        value={fmtShort(cajBalance)}  color={cajBalance >= 0 ? '#2e7d32' : '#b71c1c'} />
          <Card label="Movimientos"    value={String(nMovCaja)} sub="del período" color="#37474f" />
        </div>

        {/* Chart 7: Ingresos/Gastos/Balance caja */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Caja por {monthly ? 'mes' : 'día'}</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chart7Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left"  tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : String(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : String(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar    yAxisId="left"  dataKey="Ingresos" fill="#2e7d32" radius={[4,4,0,0]} barSize={monthly ? 18 : 6} />
              <Bar    yAxisId="left"  dataKey="Gastos"   fill="#b71c1c" radius={[4,4,0,0]} barSize={monthly ? 18 : 6} />
              <Line  yAxisId="right" dataKey="Balance"  stroke="#1565c0" strokeWidth={2} dot={false} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── F: Tendencia 12 meses ──────────────────────────────────────────── */}
        <SectionTitle>Tendencia de facturación (12 meses)</SectionTitle>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Total mensual + línea de tendencia</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chart8Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : String(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar  dataKey="Total"     fill="#2e7d32" radius={[4,4,0,0]} barSize={18} name="Total" />
              <Line dataKey="Tendencia" stroke="#f57f17" strokeWidth={2} dot={false} type="monotone" strokeDasharray="6 3" name="Tendencia" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};

export default Estadisticas;
