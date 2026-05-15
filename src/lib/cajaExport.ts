import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CierreCaja } from '../types';

interface NormMov {
  id: string;
  tipo: string;
  concepto: string;
  importe: number;
  payMethod: string;
  categoria?: string;
  fecha: string;
  hora: string;
  tecnico?: string;
  notas?: string;
  createdAt: string;
}

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

function monthLabel(isoMonth: string): string {
  if (!isoMonth) return 'todo';
  const [y, m] = isoMonth.split('-');
  const nombre = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
  return `${nombre}_${y}`;
}

export function exportCajaExcel(
  cierres: CierreCaja[],
  movements: NormMov[],
  tallerName: string,
  historialMes: string,
) {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Historial Caja ────────────────────────────────────────────────
  const histRows = cierres.map(c => ({
    'Fecha': fmtDate(c.fecha),
    'Apertura (€)': c.apertura ?? 0,
    'Ingresos (€)': c.totalIngresos ?? 0,
    'Gastos (€)': c.totalGastos ?? 0,
    'Cierre Real (€)': c.totalEfectivo ?? 0,
    'Diferencia (€)': c.diferencia ?? 0,
    'Estado': (c.diferencia ?? 0) === 0 ? 'OK' : (c.diferencia ?? 0) > 0 ? 'Superávit' : 'Déficit',
  }));

  // Totals row
  const sumKey = (key: keyof typeof histRows[0]) =>
    histRows.reduce((s, r) => s + (r[key] as number), 0);

  histRows.push({
    'Fecha': 'TOTAL',
    'Apertura (€)': 0,
    'Ingresos (€)': sumKey('Ingresos (€)'),
    'Gastos (€)': sumKey('Gastos (€)'),
    'Cierre Real (€)': sumKey('Cierre Real (€)'),
    'Diferencia (€)': sumKey('Diferencia (€)'),
    'Estado': '',
  });

  const ws1 = XLSX.utils.json_to_sheet(histRows);
  ws1['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 10 }];

  // Color diferencia cells (green/red) — SheetJS CE doesn't support cell styles in xlsx,
  // but we can at least mark them. Full cell color requires xlsx-style or ExcelJS (premium).
  XLSX.utils.book_append_sheet(wb, ws1, 'Historial Caja');

  // ── Hoja 2: Movimientos ───────────────────────────────────────────────────
  const filtered = historialMes
    ? movements.filter(m => m.fecha.slice(0, 7) === historialMes)
    : movements;

  const sorted = [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let acumulado = 0;
  const movRows = sorted.map(m => {
    const delta = m.tipo === 'ingreso' ? m.importe : m.tipo === 'gasto' || m.tipo === 'retirada' ? -m.importe : 0;
    acumulado += delta;
    return {
      'Fecha': fmtDate(m.fecha),
      'Hora': m.hora,
      'Tipo': m.tipo,
      'Concepto': m.concepto,
      'Importe (€)': m.importe,
      'Método pago': m.payMethod,
      'Categoría': m.categoria || '',
      'Técnico': m.tecnico || '',
      'Caja acumulada (€)': Math.round(acumulado * 100) / 100,
    };
  });

  const ws2 = XLSX.utils.json_to_sheet(movRows);
  ws2['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 36 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Movimientos');

  const label = monthLabel(historialMes);
  XLSX.writeFile(wb, `caja_${label}.xlsx`);
}

export function exportCajaPdf(
  cierres: CierreCaja[],
  movements: NormMov[],
  tallerName: string,
  historialMes: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const periodoLabel = historialMes
    ? new Date(Number(historialMes.split('-')[0]), Number(historialMes.split('-')[1]) - 1, 1)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : 'Todo el historial';

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(27, 94, 32);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(tallerName || 'Caja Diaria', 14, 9);
  doc.setFontSize(9);
  doc.text(`Historial de caja · ${periodoLabel}`, 14, 15);
  doc.text(`Generado: ${now}`, pageW - 14, 15, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // ── Tabla historial ───────────────────────────────────────────────────────
  const totIngresos = cierres.reduce((s, c) => s + (c.totalIngresos ?? 0), 0);
  const totGastos   = cierres.reduce((s, c) => s + (c.totalGastos ?? 0), 0);
  const totDif      = cierres.reduce((s, c) => s + (c.diferencia ?? 0), 0);

  autoTable(doc, {
    startY: 24,
    head: [['Fecha', 'Apertura', 'Ingresos', 'Gastos', 'Cierre Real', 'Diferencia', 'Estado']],
    body: [
      ...cierres.map(c => {
        const dif = c.diferencia ?? 0;
        return [
          fmtDate(c.fecha),
          fmtEur(c.apertura ?? 0),
          fmtEur(c.totalIngresos ?? 0),
          fmtEur(c.totalGastos ?? 0),
          fmtEur(c.totalEfectivo ?? 0),
          fmtEur(dif),
          dif === 0 ? 'OK' : dif > 0 ? 'Superávit' : 'Déficit',
        ];
      }),
      ['TOTAL', '', fmtEur(totIngresos), fmtEur(totGastos), '', fmtEur(totDif), ''],
    ],
    headStyles: { fillColor: [27, 94, 32], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    didParseCell: (data) => {
      // Last row (totals) bold
      if (data.row.index === cierres.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 252, 231];
      }
      // Diferencia column: green/red
      if (data.column.index === 5 && data.row.index < cierres.length) {
        const dif = cierres[data.row.index]?.diferencia ?? 0;
        data.cell.styles.textColor = dif >= 0 ? [21, 128, 61] : [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Tabla movimientos ─────────────────────────────────────────────────────
  const filtered = historialMes
    ? movements.filter(m => m.fecha.slice(0, 7) === historialMes)
    : movements;
  const sorted = [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (sorted.length > 0) {
    doc.addPage('a4', 'landscape');
    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(tallerName || 'Caja Diaria', 14, 9);
    doc.setFontSize(9);
    doc.text(`Movimientos · ${periodoLabel}`, 14, 15);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 24,
      head: [['Fecha', 'Hora', 'Tipo', 'Concepto', 'Importe', 'Método', 'Técnico']],
      body: sorted.map(m => [
        fmtDate(m.fecha),
        m.hora,
        m.tipo,
        m.concepto,
        fmtEur(m.importe),
        m.payMethod,
        m.tecnico || '',
      ]),
      headStyles: { fillColor: [27, 94, 32], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.row.section === 'body') {
          const tipo = sorted[data.row.index]?.tipo;
          if (tipo === 'ingreso') data.cell.styles.textColor = [21, 128, 61];
          else if (tipo === 'gasto' || tipo === 'retirada') data.cell.styles.textColor = [185, 28, 28];
        }
      },
      columnStyles: { 3: { cellWidth: 70 } },
      margin: { left: 14, right: 14 },
    });
  }

  const label = monthLabel(historialMes);
  doc.save(`caja_${label}.pdf`);
}
