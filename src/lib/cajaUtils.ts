// Pure helpers extracted from Caja.tsx for unit testing.
// toISOString() uses UTC, which causes off-by-one at midnight in timezones ahead of
// UTC (e.g. Spain UTC+1/+2). Use getFullYear/getMonth/getDate instead.
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function cajaAyerSinCerrar(
  cashMovements: { fecha?: string; date?: string; tipo?: string; type?: string; ignorada?: boolean }[],
  cierresCaja: { fecha?: string }[],
  yesterdayStr: string,
): boolean {
  const aperturaAyer = cashMovements.find(m => {
    const fecha = (m.fecha || m.date || '').slice(0, 10);
    return fecha === yesterdayStr && (m.tipo || m.type) === 'apertura' && !m.ignorada;
  });
  const cierreAyer = cierresCaja.find(c => (c.fecha || '').slice(0, 10) === yesterdayStr);
  return !!aperturaAyer && !cierreAyer;
}
