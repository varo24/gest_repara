import React, { useState, useCallback } from 'react';
import { Search, Plus, Loader2, ExternalLink, Image as ImageIcon, ShoppingCart, X, AlertCircle, Globe, Star } from 'lucide-react';

export interface PartResult {
  name: string;
  price: string;
  priceNum: number;
  provider: string;
  url: string;
  image: string;
  reference: string;
}

interface PartsSearchProps {
  deviceBrand: string;
  deviceModel: string;
  deviceType: string;
  onAddPart: (name: string, price: number) => void;
}

// Proveedores configurados del usuario
const PROVIDERS = [
  { name: 'Fixpart', url: 'https://www.fixpart.es', search: 'https://www.fixpart.es/buscar?q=' },
  { name: 'Electrotodo', url: 'https://www.electrotodo.es', search: 'https://www.electrotodo.es/buscar?controller=search&s=' },
  { name: 'Fersay', url: 'https://www.fersay.com', search: 'https://www.fersay.com/buscador?buscar=' },
  { name: 'Recampro', url: 'https://www.recampro.com', search: 'https://www.recampro.com/buscar?controller=search&s=' },
  { name: 'Bosch Repuestos', url: 'https://www.bosch-home.es', search: 'https://www.bosch-home.es/accesorios-y-repuestos?q=' },
  { name: 'RecambiosLG', url: 'https://recambioslg.com', search: 'https://recambioslg.com/?s=' },
  { name: 'RecambiosTeka', url: 'https://www.recambiosteka.es', search: 'https://www.recambiosteka.es/buscar?controller=search&s=' },
];

// Sugerencias rápidas por tipo de electrodoméstico
const QUICK_SUGGESTIONS: Record<string, string[]> = {
  lavadora: ['Resistencia', 'Bomba desagüe', 'Escobillas motor', 'Rodamiento tambor', 'Goma puerta', 'Electroválvula', 'Presostato', 'Correa', 'Amortiguador', 'Cierre puerta'],
  secadora: ['Resistencia', 'Bomba desagüe', 'Correa', 'Rodamiento tambor', 'Termostato', 'Filtro pelusas', 'Sensor temperatura'],
  lavavajillas: ['Bomba desagüe', 'Resistencia', 'Electroválvula', 'Cierre puerta', 'Brazo aspersor', 'Dosificador', 'Flotador antidesbordamiento', 'Manguito'],
  frigorifico: ['Termostato', 'Compresor', 'Ventilador', 'Resistencia descongelación', 'Timer', 'Junta puerta', 'Bandeja', 'Sensor temperatura'],
  horno: ['Resistencia superior', 'Resistencia inferior', 'Ventilador', 'Termostato', 'Bisagra puerta', 'Cristal puerta', 'Junta puerta', 'Selector'],
  vitroceramica: ['Resistencia', 'Regulador energía', 'Placa electrónica', 'Cable conexión', 'Cristal'],
  microondas: ['Magnetrón', 'Plato giratorio', 'Motor plato', 'Fusible', 'Condensador', 'Diodo', 'Panel control'],
  cafetera: ['Bomba', 'Resistencia', 'Electroválvula', 'Junta', 'Filtro', 'Grupo café', 'Depósito'],
  aspiradora: ['Filtro HEPA', 'Motor', 'Bolsa', 'Cepillo', 'Manguera', 'Tubo', 'Rueda', 'Batería'],
  default: ['Resistencia', 'Termostato', 'Bomba', 'Motor', 'Placa electrónica', 'Junta', 'Correa', 'Sensor'],
};

const getDeviceSuggestions = (deviceType: string, brand: string): string[] => {
  const type = deviceType.toLowerCase();
  for (const [key, suggestions] of Object.entries(QUICK_SUGGESTIONS)) {
    if (type.includes(key)) return suggestions;
  }
  return QUICK_SUGGESTIONS.default;
};

const PartsSearch: React.FC<PartsSearchProps> = ({ deviceBrand, deviceModel, deviceType, onAddPart }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const suggestions = getDeviceSuggestions(deviceType, deviceBrand);

  const searchParts = useCallback(async (searchOverride?: string) => {
    const searchQuery = (searchOverride || query).trim();
    if (!searchQuery) return;

    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);

    try {
      const deviceContext = [deviceBrand, deviceModel].filter(Boolean).join(' ');
      const fullQuery = deviceContext
        ? `recambio ${searchQuery} ${deviceContext} electrodoméstico`
        : `recambio ${searchQuery} electrodoméstico`;

      const providerNames = PROVIDERS.map(p => p.name).join(', ');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Busca recambios de electrodomésticos online: "${fullQuery}".

PROVEEDORES PRIORITARIOS (buscar primero aquí): ${providerNames}
También puedes buscar en: Amazon.es, Todorecambios.com, Repuestoselectrodomesticos.com, Google Shopping España.

El tipo de aparato es: ${deviceType || 'electrodoméstico'}
La marca es: ${deviceBrand || 'genérica'}
El modelo es: ${deviceModel || 'no especificado'}

RESPONDE SOLO con un JSON array (sin markdown, sin backticks, sin texto antes ni después). Cada elemento:
{"name":"nombre completo descriptivo de la pieza compatible","price":"XX.XX€","priceNum":XX.XX,"provider":"nombre tienda","url":"url directa al producto","image":"url imagen producto","reference":"código referencia/SKU del fabricante"}

Si no encuentras resultados exactos, busca piezas compatibles genéricas.
Si no encuentras nada, devuelve: []
Máximo 8 resultados. Solo resultados reales con precios reales en euros.`
          }]
        })
      });

      const data = await response.json();

      const textBlocks = data.content
        ?.filter((b: any) => b.type === 'text')
        ?.map((b: any) => b.text)
        ?.join('\n') || '';

      const jsonMatch = textBlocks.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            setResults(parsed.map((p: any) => ({
              name: p.name || 'Sin nombre',
              price: p.price || '—',
              priceNum: typeof p.priceNum === 'number' ? p.priceNum : parseFloat(String(p.price).replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
              provider: p.provider || 'Desconocido',
              url: p.url || '',
              image: p.image || '',
              reference: p.reference || '',
            })));
          }
        } catch {
          setError('No se pudieron interpretar los resultados. Intente con otros términos.');
        }
      } else {
        setResults([]);
      }
    } catch (e: any) {
      console.error('[PartsSearch]', e);
      setError('Error de conexión. Compruebe que tiene acceso a internet.');
    } finally {
      setLoading(false);
    }
  }, [query, deviceBrand, deviceModel, deviceType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') searchParts();
  };

  const openProviderSearch = (provider: typeof PROVIDERS[0], searchTerm: string) => {
    const term = searchTerm || query || `${deviceBrand} ${deviceModel}`.trim();
    if (term) window.open(provider.search + encodeURIComponent(term), '_blank');
    else window.open(provider.url, '_blank');
  };

  const openGoogleSearch = () => {
    const term = query || `recambio ${deviceBrand} ${deviceModel} ${deviceType}`.trim();
    window.open(`https://www.google.es/search?q=${encodeURIComponent(term + ' recambio electrodoméstico precio')}&tbm=shop`, '_blank');
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
            placeholder={`Buscar recambio... ej: "resistencia", "bomba desagüe"${deviceBrand ? ` para ${deviceBrand} ${deviceModel}` : ''}`}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none placeholder:text-slate-300"
          />
        </div>
        <button onClick={() => searchParts()} disabled={loading || !query.trim()}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </div>

      {/* Quick suggestions */}
      {!searched && !loading && (
        <div className="space-y-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Sugerencias rápidas — {deviceType || 'Electrodoméstico'}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button key={s} onClick={() => { setQuery(s); searchParts(s); }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Direct provider links */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Buscar directamente en tus proveedores</p>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map(p => (
            <button key={p.name} onClick={() => openProviderSearch(p, query)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all flex items-center gap-1.5 uppercase tracking-wider">
              <Star size={10} /> {p.name}
            </button>
          ))}
          <button onClick={openGoogleSearch}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center gap-1.5 uppercase tracking-wider">
            <Globe size={10} /> Google Shopping
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-10 gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buscando recambios en Fixpart, Fersay, Electrotodo...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-xs font-bold text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map((part, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all">
                <div className="flex gap-3 p-4">
                  {/* Image */}
                  <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-100">
                    {part.image ? (
                      <img src={part.image} alt={part.name} className="w-full h-full object-contain p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : null}
                    {!part.image && <ImageIcon size={24} className="text-slate-200" />}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2 mb-1">{part.name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                      {part.provider}
                    </p>
                    {part.reference && (
                      <p className="text-[8px] font-mono text-slate-300 mb-1">Ref: {part.reference}</p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-lg font-black text-emerald-600">{part.price}</span>
                      <div className="flex items-center gap-1.5">
                        {part.url && (
                          <a href={part.url} target="_blank" rel="noopener noreferrer"
                            className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="Ver en tienda">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => onAddPart(part.name, part.priceNum)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-1.5 transition-all active:scale-95">
                          <Plus size={12} /> Añadir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && searched && results.length === 0 && !error && (
        <div className="text-center py-8 space-y-3">
          <ShoppingCart size={32} className="text-slate-200 mx-auto" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            No se encontraron resultados para "{query}"
          </p>
          <p className="text-[9px] text-slate-300">Pruebe buscando directamente en sus proveedores:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PROVIDERS.slice(0, 4).map(p => (
              <button key={p.name} onClick={() => openProviderSearch(p, query)}
                className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
                Buscar en {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsSearch;
