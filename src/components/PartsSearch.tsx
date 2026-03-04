import React, { useState, useCallback } from 'react';
import { Search, Plus, Loader2, ExternalLink, Image as ImageIcon, ShoppingCart, X, AlertCircle } from 'lucide-react';

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
  onAddPart: (name: string, price: number) => void;
}

const PartsSearch: React.FC<PartsSearchProps> = ({ deviceBrand, deviceModel, onAddPart }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const searchParts = useCallback(async () => {
    const searchQuery = query.trim();
    if (!searchQuery) return;

    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);

    try {
      const deviceContext = [deviceBrand, deviceModel].filter(Boolean).join(' ');
      const fullQuery = deviceContext
        ? `repuesto ${searchQuery} para ${deviceContext}`
        : `repuesto ${searchQuery} móvil tablet`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Busca piezas de recambio online: "${fullQuery}". 
Necesito resultados REALES de tiendas online españolas o europeas de recambios de móviles/tablets.
Busca en tiendas como: iFixit, MovilOne, Repuestosmoviles.es, ScreenMobile, TecnoRepuestos, Amazon.es, etc.

RESPONDE SOLO con un JSON array (sin markdown, sin backticks, sin texto adicional). Cada elemento:
{"name":"nombre descriptivo de la pieza","price":"XX.XX€","priceNum":XX.XX,"provider":"nombre tienda","url":"url del producto","image":"url de imagen del producto","reference":"referencia o SKU si existe"}

Si no encuentras resultados, devuelve: []
Máximo 6 resultados. Solo resultados reales con precios reales.`
          }]
        })
      });

      const data = await response.json();

      // Extract text from response (may have tool_use blocks)
      const textBlocks = data.content
        ?.filter((b: any) => b.type === 'text')
        ?.map((b: any) => b.text)
        ?.join('\n') || '';

      // Try to parse JSON from the response
      const jsonMatch = textBlocks.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            setResults(parsed.map((p: any) => ({
              name: p.name || 'Sin nombre',
              price: p.price || '—',
              priceNum: typeof p.priceNum === 'number' ? p.priceNum : parseFloat(p.price) || 0,
              provider: p.provider || 'Desconocido',
              url: p.url || '',
              image: p.image || '',
              reference: p.reference || '',
            })));
          }
        } catch {
          setError('No se pudieron interpretar los resultados.');
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
  }, [query, deviceBrand, deviceModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') searchParts();
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
            placeholder={`Buscar pieza... ej: "pantalla", "batería", "conector carga"${deviceBrand ? ` para ${deviceBrand} ${deviceModel}` : ''}`}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none placeholder:text-slate-300"
          />
        </div>
        <button
          onClick={searchParts}
          disabled={loading || !query.trim()}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shrink-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </div>

      {/* Suggestions */}
      {!searched && !loading && (
        <div className="flex flex-wrap gap-2">
          {['Pantalla', 'Batería', 'Conector carga', 'Cámara trasera', 'Tapa trasera', 'Altavoz'].map(s => (
            <button key={s} onClick={() => { setQuery(s); }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-10 gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Buscando recambios online...
          </p>
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
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all group">
                <div className="flex gap-3 p-4">
                  {/* Image */}
                  <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-100">
                    {part.image ? (
                      <img
                        src={part.image}
                        alt={part.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <ImageIcon size={24} className={`text-slate-200 ${part.image ? 'hidden' : ''}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2 mb-1">
                      {part.name}
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      {part.provider}
                      {part.reference && ` · Ref: ${part.reference}`}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-black text-emerald-600">{part.price}</span>
                      <div className="flex items-center gap-1.5">
                        {part.url && (
                          <a href={part.url} target="_blank" rel="noopener noreferrer"
                            className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="Ver en tienda">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => onAddPart(part.name, part.priceNum)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-1.5 transition-all active:scale-95"
                        >
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
        <div className="text-center py-10">
          <ShoppingCart size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            No se encontraron resultados para "{query}"
          </p>
          <p className="text-[9px] text-slate-300 mt-1">Pruebe con otros términos o sea más específico</p>
        </div>
      )}
    </div>
  );
};

export default PartsSearch;
