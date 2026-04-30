import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, Search, X, Save, ScanLine,
  Brain, Upload, CheckCircle2, AlertTriangle, Package,
  ArrowLeft, RefreshCw
} from 'lucide-react';
import { InventoryItem, StockMovement, AppSettings } from '../types';
import { storage } from '../lib/dataService';

interface EntradaStockProps {
  settings: AppSettings;
  inventoryItems: InventoryItem[];
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
  onBack: () => void;
}

interface EntryLine {
  inventoryItemId: string;
  ref: string;
  description: string;
  qty: number;
  costPrice: number;
}

const EntradaStock: React.FC<EntradaStockProps> = ({ settings, inventoryItems, onNotify, onBack }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'scanner' | 'ai'>('manual');

  // Manual tab
  const [manualSearch, setManualSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualLines, setManualLines] = useState<EntryLine[]>([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryNotes, setEntryNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Scanner tab
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [scannerLines, setScannerLines] = useState<EntryLine[]>([]);
  const [lastScan, setLastScan] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // AI tab
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiDragging, setAiDragging] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiLines, setAiLines] = useState<EntryLine[]>([]);
  const [aiRawText, setAiRawText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'scanner') barcodeInputRef.current?.focus();
  }, [activeTab]);

  const searchItems = (q: string) => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return inventoryItems.filter(i =>
      i.ref.toLowerCase().includes(lower) ||
      i.description.toLowerCase().includes(lower) ||
      (i.ean || '').toLowerCase().includes(lower)
    ).slice(0, 8);
  };

  const addLine = (item: InventoryItem, target: 'manual' | 'scanner') => {
    const setter = target === 'manual' ? setManualLines : setScannerLines;
    setter(prev => {
      const idx = prev.findIndex(l => l.inventoryItemId === item.id);
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { inventoryItemId: item.id, ref: item.ref, description: item.description, qty: 1, costPrice: item.costPrice }];
    });
    if (target === 'manual') { setManualSearch(''); setShowDropdown(false); }
  };

  const commitEntries = async (lines: EntryLine[], notes: string, date: string) => {
    if (!lines.length) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      for (const line of lines) {
        const item = inventoryItems.find(i => i.id === line.inventoryItemId);
        if (!item) continue;
        await storage.save('inventory', item.id, { ...item, stock: item.stock + line.qty, updatedAt: now });
        const movement: StockMovement = {
          id: crypto.randomUUID(),
          itemId: item.id,
          ref: item.ref,
          description: item.description,
          type: 'entrada',
          qty: line.qty,
          costPrice: line.costPrice,
          date,
          origin: 'entrada-stock',
          notes: notes || undefined,
          createdAt: now,
        };
        await storage.save('stock_movements', movement.id, movement);
      }
      onNotify('success', `${lines.length} artículo(s) añadidos al stock`);
    } catch {
      onNotify('error', 'Error al guardar la entrada');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    await commitEntries(manualLines, entryNotes, entryDate);
    setManualLines([]);
    setEntryNotes('');
  };

  const handleScannerSave = async () => {
    await commitEntries(scannerLines, 'Entrada por escáner de códigos', entryDate);
    setScannerLines([]);
    setLastScan('');
  };

  const handleBarcodeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = barcodeBuffer.trim();
      setBarcodeBuffer('');
      if (barcodeInputRef.current) barcodeInputRef.current.value = '';
      if (!code) return;
      const found = inventoryItems.find(i => i.ean === code || i.ref === code);
      if (found) {
        addLine(found, 'scanner');
        setLastScan(`✓ ${found.description}`);
      } else {
        setLastScan(`⚠ Código no encontrado: ${code}`);
      }
    } else {
      setBarcodeBuffer(prev => prev + e.key);
    }
  };

  const parseWithAI = async () => {
    if (!aiFile && !aiRawText.trim()) { onNotify('error', 'Sube un archivo o pega el texto'); return; }
    const apiKey = settings.anthropicApiKey;
    if (!apiKey) { onNotify('error', 'Configura tu clave API de Anthropic en Ajustes'); return; }
    setAiParsing(true);
    try {
      let text = aiRawText;
      if (aiFile && !text) text = await aiFile.text();

      const prompt = `Analiza esta factura de proveedor y extrae los artículos. Para cada uno devuelve: ref, description, qty (número), costPrice (precio unitario en euros). Responde SOLO con JSON: {"items":[{"ref":"...","description":"...","qty":1,"costPrice":0.00}]}

Factura:
${text.slice(0, 4000)}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      const raw = data.content?.[0]?.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON');
      const parsed = JSON.parse(match[0]);
      const lines: EntryLine[] = (parsed.items || []).map((item: any) => {
        const found = inventoryItems.find(i =>
          i.ref.toLowerCase() === String(item.ref || '').toLowerCase() ||
          i.description.toLowerCase().includes(String(item.description || '').toLowerCase().slice(0, 12))
        );
        return {
          inventoryItemId: found?.id || '',
          ref: String(item.ref || found?.ref || ''),
          description: String(item.description || found?.description || ''),
          qty: Math.max(1, parseInt(item.qty) || 1),
          costPrice: parseFloat(item.costPrice) || 0,
        };
      });
      setAiLines(lines);
      onNotify('success', `${lines.length} artículo(s) detectados por IA`);
    } catch {
      onNotify('error', 'Error al analizar con IA. Verifica la clave API.');
    } finally {
      setAiParsing(false);
    }
  };

  const handleAiSave = async () => {
    const valid = aiLines.filter(l => l.inventoryItemId);
    const skipped = aiLines.length - valid.length;
    if (skipped > 0) onNotify('info', `${skipped} artículo(s) sin coincidencia en catálogo serán ignorados`);
    await commitEntries(valid, `Factura IA: ${aiFile?.name || 'texto pegado'}`, entryDate);
    setAiLines([]);
    setAiFile(null);
    setAiRawText('');
  };

  const LinesTable = ({
    lines,
    onQty,
    onCost,
    onRemove,
  }: {
    lines: EntryLine[];
    onQty: (i: number, v: number) => void;
    onCost: (i: number, v: number) => void;
    onRemove: (i: number) => void;
  }) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Artículo</th>
            <th className="text-center px-3 py-2 text-[9px] font-black text-slate-400 uppercase w-20">Cant</th>
            <th className="text-right px-3 py-2 text-[9px] font-black text-slate-400 uppercase w-28">Coste u.</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((line, idx) => (
            <tr key={idx} className={!line.inventoryItemId ? 'bg-amber-50' : ''}>
              <td className="px-4 py-2">
                <p className="font-black text-slate-900">{line.description}</p>
                <p className="text-[9px] text-slate-400">{line.ref}</p>
                {!line.inventoryItemId && (
                  <p className="text-[9px] text-amber-600 font-bold">⚠ Sin coincidencia en catálogo</p>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="number" min="1"
                  className="w-16 text-center px-2 py-1 border border-slate-200 rounded-lg text-xs font-black"
                  value={line.qty}
                  onChange={e => onQty(idx, parseInt(e.target.value) || 1)}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number" min="0" step="0.01"
                  className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg text-xs font-black"
                  value={line.costPrice}
                  onChange={e => onCost(idx, parseFloat(e.target.value) || 0)}
                />
              </td>
              <td className="px-2 py-2">
                <button onClick={() => onRemove(idx)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Entrada de Stock</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registrar nuevas entradas al almacén</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        {([
          { id: 'manual', label: 'Manual', icon: Plus },
          { id: 'scanner', label: 'Escáner', icon: ScanLine },
          { id: 'ai', label: 'IA / Factura', icon: Brain },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all ${
              activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Manual tab ── */}
      {activeTab === 'manual' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowDropdown(false); }}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar artículo por ref, descripción o EAN..."
              className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={manualSearch}
              onChange={e => { setManualSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && manualSearch && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {searchItems(manualSearch).length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400 text-center">Sin resultados</p>
                ) : (
                  searchItems(manualSearch).map(item => (
                    <button
                      key={item.id}
                      onMouseDown={() => addLine(item, 'manual')}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-all text-left"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-900">{item.description}</p>
                        <p className="text-[9px] text-slate-400">{item.ref} · Stock actual: {item.stock}</p>
                      </div>
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full capitalize shrink-0">{item.category}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {manualLines.length > 0 ? (
            <>
              <LinesTable
                lines={manualLines}
                onQty={(i, v) => setManualLines(l => l.map((ll, idx) => idx === i ? { ...ll, qty: v } : ll))}
                onCost={(i, v) => setManualLines(l => l.map((ll, idx) => idx === i ? { ...ll, costPrice: v } : ll))}
                onRemove={i => setManualLines(l => l.filter((_, idx) => idx !== i))}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha entrada</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notas / Albarán</label>
                  <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none" placeholder="Ref. albarán, proveedor..." value={entryNotes} onChange={e => setEntryNotes(e.target.value)} />
                </div>
              </div>
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Guardando...' : `Confirmar entrada (${manualLines.length} artículo${manualLines.length !== 1 ? 's' : ''})`}
              </button>
            </>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-widest">Busca artículos del catálogo para añadir</p>
            </div>
          )}
        </div>
      )}

      {/* ── Scanner tab ── */}
      {activeTab === 'scanner' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <ScanLine size={32} className="mx-auto text-slate-400" />
            <p className="text-xs font-black uppercase text-slate-700">Escáner HID activo</p>
            <p className="text-[10px] text-slate-400">Escanea los códigos de barras — los artículos se añaden automáticamente</p>
            {lastScan && (
              <span className={`text-[10px] font-black px-4 py-2 rounded-lg inline-block ${lastScan.startsWith('✓') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {lastScan}
              </span>
            )}
            {/* Hidden input that captures barcode keyboard wedge input */}
            <input
              ref={barcodeInputRef}
              type="text"
              className="opacity-0 absolute w-0 h-0"
              onKeyDown={handleBarcodeKey}
              onChange={() => {}}
              value=""
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              onClick={() => barcodeInputRef.current?.focus()}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300"
            >
              Hacer clic aquí para activar escáner
            </button>
          </div>

          {scannerLines.length > 0 && (
            <>
              <LinesTable
                lines={scannerLines}
                onQty={(i, v) => setScannerLines(l => l.map((ll, idx) => idx === i ? { ...ll, qty: v } : ll))}
                onCost={(i, v) => setScannerLines(l => l.map((ll, idx) => idx === i ? { ...ll, costPrice: v } : ll))}
                onRemove={i => setScannerLines(l => l.filter((_, idx) => idx !== i))}
              />
              <button
                onClick={handleScannerSave}
                disabled={isSaving}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isSaving ? 'Guardando...' : `Confirmar ${scannerLines.length} artículo(s)`}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── AI tab ── */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          {!settings.anthropicApiKey && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-bold">
                Configura tu clave API de Anthropic en <strong>Ajustes</strong> para usar esta función.
              </p>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center space-y-3 cursor-pointer transition-all ${
              aiDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onDragOver={e => { e.preventDefault(); setAiDragging(true); }}
            onDragLeave={() => setAiDragging(false)}
            onDrop={e => { e.preventDefault(); setAiDragging(false); const f = e.dataTransfer.files[0]; if (f) setAiFile(f); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={28} className="mx-auto text-slate-400" />
            <p className="text-xs font-black uppercase text-slate-700">
              {aiFile ? aiFile.name : 'Arrastra la factura aquí o haz clic para seleccionar'}
            </p>
            <p className="text-[9px] text-slate-400">Archivos de texto: TXT, CSV</p>
            {aiFile && (
              <button
                onMouseDown={e => { e.stopPropagation(); setAiFile(null); }}
                className="text-[9px] text-red-500 font-bold underline"
              >
                Quitar archivo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAiFile(f); e.target.value = ''; }} />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">O pega el texto de la factura</label>
            <textarea
              rows={5}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none resize-none"
              placeholder="Pega aquí el contenido de la factura del proveedor..."
              value={aiRawText}
              onChange={e => setAiRawText(e.target.value)}
            />
          </div>

          <button
            onClick={parseWithAI}
            disabled={aiParsing || (!aiFile && !aiRawText.trim()) || !settings.anthropicApiKey}
            className="w-full py-4 bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20 disabled:opacity-40"
          >
            {aiParsing ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
            {aiParsing ? 'Analizando con IA...' : 'Analizar con IA'}
          </button>

          {aiLines.length > 0 && (
            <>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {aiLines.length} artículo(s) detectados — revisa y confirma
              </p>
              <LinesTable
                lines={aiLines}
                onQty={(i, v) => setAiLines(l => l.map((ll, idx) => idx === i ? { ...ll, qty: v } : ll))}
                onCost={(i, v) => setAiLines(l => l.map((ll, idx) => idx === i ? { ...ll, costPrice: v } : ll))}
                onRemove={i => setAiLines(l => l.filter((_, idx) => idx !== i))}
              />
              <button
                onClick={handleAiSave}
                disabled={isSaving}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isSaving ? 'Guardando...' : 'Confirmar entrada de stock'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EntradaStock;
