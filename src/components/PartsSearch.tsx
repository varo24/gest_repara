import React, { useState } from 'react';
import { Search, Star, Globe, ShoppingCart } from 'lucide-react';

interface PartsSearchProps {
  deviceBrand: string;
  deviceModel: string;
  deviceType: string;
  onAddPart: (name: string, price: number) => void;
}

const PROVIDERS = [
  { name: 'Fixpart', search: 'https://www.fixpart.es/buscar?q=' },
  { name: 'Electrotodo', search: 'https://www.electrotodo.es/buscar?controller=search&s=' },
  { name: 'Fersay', search: 'https://www.fersay.com/buscador?buscar=' },
  { name: 'Recampro', search: 'https://www.recampro.com/buscar?controller=search&s=' },
  { name: 'Bosch Repuestos', search: 'https://www.bosch-home.es/accesorios-y-repuestos?q=' },
  { name: 'RecambiosLG', search: 'https://recambioslg.com/?s=' },
  { name: 'RecambiosTeka', search: 'https://www.recambiosteka.es/buscar?controller=search&s=' },
];

const QUICK_SUGGESTIONS: Record<string, string[]> = {
  lavadora: ['Resistencia', 'Bomba desagüe', 'Escobillas motor', 'Rodamiento tambor', 'Goma puerta', 'Electroválvula', 'Presostato', 'Correa', 'Amortiguador', 'Cierre puerta'],
  secadora: ['Resistencia', 'Bomba desagüe', 'Correa', 'Rodamiento tambor', 'Termostato', 'Filtro pelusas', 'Sensor temperatura'],
  lavavajillas: ['Bomba desagüe', 'Resistencia', 'Electroválvula', 'Cierre puerta', 'Brazo aspersor', 'Dosificador', 'Flotador', 'Manguito'],
  frigorifico: ['Termostato', 'Compresor', 'Ventilador', 'Resistencia descongelación', 'Timer', 'Junta puerta', 'Bandeja', 'Sensor temperatura'],
  horno: ['Resistencia superior', 'Resistencia inferior', 'Ventilador', 'Termostato', 'Bisagra puerta', 'Cristal puerta', 'Junta puerta', 'Selector'],
  vitroceramica: ['Resistencia', 'Regulador energía', 'Placa electrónica', 'Cable conexión', 'Cristal'],
  microondas: ['Magnetrón', 'Plato giratorio', 'Motor plato', 'Fusible', 'Condensador', 'Diodo', 'Panel control'],
  cafetera: ['Bomba', 'Resistencia', 'Electroválvula', 'Junta', 'Filtro', 'Grupo café', 'Depósito'],
  aspiradora: ['Filtro HEPA', 'Motor', 'Bolsa', 'Cepillo', 'Manguera', 'Tubo', 'Rueda', 'Batería'],
  default: ['Resistencia', 'Termostato', 'Bomba', 'Motor', 'Placa electrónica', 'Junta', 'Correa', 'Sensor'],
};

const getSuggestions = (deviceType: string): string[] => {
  const t = deviceType.toLowerCase();
  for (const [key, vals] of Object.entries(QUICK_SUGGESTIONS)) {
    if (t.includes(key)) return vals;
  }
  return QUICK_SUGGESTIONS.default;
};

const PartsSearch: React.FC<PartsSearchProps> = ({ deviceBrand, deviceModel, deviceType }) => {
  const [query, setQuery] = useState('');
  const suggestions = getSuggestions(deviceType);

  const buildSearchTerm = (override?: string) => {
    const base = (override || query).trim();
    const ctx = [deviceBrand, deviceModel].filter(Boolean).join(' ');
    return ctx ? `${base} ${ctx}` : base;
  };

  const openProvider = (provider: typeof PROVIDERS[0], override?: string) => {
    const term = buildSearchTerm(override);
    if (term) window.open(provider.search + encodeURIComponent(term), '_blank');
  };

  const openGoogle = (override?: string) => {
    const term = buildSearchTerm(override);
    window.open(`https://www.google.es/search?q=${encodeURIComponent(term + ' recambio precio')}&tbm=shop`, '_blank');
  };

  const openAllProviders = (override?: string) => {
    const term = buildSearchTerm(override);
    if (!term) return;
    // Open top 3 providers + google in new tabs
    PROVIDERS.slice(0, 3).forEach(p => window.open(p.search + encodeURIComponent(term), '_blank'));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) openAllProviders();
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Buscar recambio...${deviceBrand ? ` (${deviceBrand} ${deviceModel})` : ''}`}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none placeholder:text-slate-300"
          />
        </div>
        <button onClick={() => openAllProviders()} disabled={!query.trim()}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shrink-0">
          <Search size={16} /> Buscar
        </button>
      </div>

      {/* Quick suggestions */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
          Piezas frecuentes — {deviceType || 'Electrodoméstico'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button key={s} onClick={() => { setQuery(s); openAllProviders(s); }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Provider buttons */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Buscar en proveedor</p>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map(p => (
            <button key={p.name} onClick={() => openProvider(p)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all flex items-center gap-1.5 uppercase tracking-wider">
              <Star size={10} className="text-amber-400" /> {p.name}
            </button>
          ))}
          <button onClick={() => openGoogle()}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all flex items-center gap-1.5 uppercase tracking-wider">
            <Globe size={10} className="text-emerald-500" /> Google Shopping
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
        <ShoppingCart size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-blue-500 font-bold leading-relaxed">
          Busque la pieza, anote el precio y referencia, y pulse <strong>+ Manual</strong> para añadirla al presupuesto con el precio exacto.
        </p>
      </div>
    </div>
  );
};

export default PartsSearch;
