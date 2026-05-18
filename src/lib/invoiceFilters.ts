const NON_STOCK_RE = /porte[s]?|env[íi]o[s]?|transporte[s]?|descuento[s]?|\bdto\.?\b|rappel|financiaci[oó]n|gasto[s]?\s*(de\s*)?(env[íi]o|transporte|porte)/i;

export function esLineaNoFisica(descripcion: string): boolean {
  return NON_STOCK_RE.test(descripcion || '');
}

export function filtrarLineasStock<T extends { descripcion: string }>(lineas: T[]): T[] {
  return lineas.filter(l => !esLineaNoFisica(l.descripcion));
}
