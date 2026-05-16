import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, X, Save, ScanLine,
  Brain, Upload, CheckCircle2, AlertTriangle, Package,
  ArrowLeft, RefreshCw, Search, FileText, Mail, Clock,
} from 'lucide-react';
import { InventoryItem, StockMovement, AppSettings, Supplier } from '../types';
import { storage, localDB } from '../lib/dataService';
import { analyzeInvoice, analyzeInvoiceText, GeminiInvoiceResult } from '../lib/gemini';

interface PreFillData {
  proveedor: string;
  numero_factura: string;
  fecha: string;
  total: number;
  lineas: Array<{ descripcion: string; referencia: string; cantidad: number; precio_unitario: number }>;
  supplierId?: string;
}

interface EntradaStockProps {
  settings: AppSettings;
  inventoryItems: InventoryItem[];
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
  onBack: () => void;
  preFillData?: PreFillData | null;
  onPreFillConsumed?: () => void;
}

interface EntryLine {
  inventoryItemId: string;
  ref: string;
  description: string;
  qty: number;
  costPrice: number;
  category: string;
  location: string;
}

const DEFAULT_CATS = ['Pantallas', 'Baterías', 'Conectores', 'Cámaras', 'Mecánica', 'Otros'];

const EntradaStock: React.FC<EntradaStockProps> = ({ settings, inventoryItems, onNotify, onBack, preFillData, onPreFillConsumed }) => {
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
  const [aiMeta, setAiMeta] = useState<{
    proveedor: string; numero_factura: string; fecha: string; total: number; supplierId?: string;
    cif_proveedor?: string; email_proveedor?: string; telefono_proveedor?: string; direccion_proveedor?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Anti-duplicate + historial
  const [facturasImportadas, setFacturasImportadas] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [dupeWarning, setDupeWarning] = useState<{ numeroFactura: string; importadoEn: string } | null>(null);
  const [dupeFacAck, setDupeFacAck] = useState(false);
  const [preFillFromCorreo, setPreFillFromCorreo] = useState(false);

  const categories = settings.inventoryCategories?.length ? settings.inventoryCategories : DEFAULT_CATS;

  useEffect(() => {
    if (activeTab === 'scanner') barcodeInputRef.current?.focus();
  }, [activeTab]);

  // Subscribe to facturas_importadas and recent stock movements
  useEffect(() => {
    const unsub1 = storage.subscribe('facturas_importadas', (data: any[]) => setFacturasImportadas(data));
    const unsub2 = storage.subscribe('stock_movements', (data: any[]) => {
      const sorted = [...data]
        .filter(m => m.type === 'entrada')
        .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
        .slice(0, 10);
      setRecentMovements(sorted);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!preFillData) return;
    setActiveTab('ai');
    setPreFillFromCorreo(true);
    setDupeWarning(null);
    setDupeFacAck(false);
    setAiMeta({
      proveedor: preFillData.proveedor,
      numero_factura: preFillData.numero_factura,
      fecha: preFillData.fecha,
      total: preFillData.total,
      supplierId: preFillData.supplierId,
    });
    setAiLines(preFillData.lineas.map(l => ({
      inventoryItemId: '',
      ref: l.referencia || '',
      description: l.descripcion,
      qty: l.cantidad,
      costPrice: l.precio_unitario,
      category: categories[0] || 'Otros',
      location: '',
    })));
    onPreFillConsumed?.();
  }, [preFillData]); // eslint-disable-line react-hooks/exhaustive-deps

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
      return [...prev, {
        inventoryItemId: item.id,
        ref: item.ref,
        description: item.description,
        qty: 1,
        costPrice: item.costPrice,
        category: item.category,
        location: item.location || '',
      }];
    });
    if (target === 'manual') { setManualSearch(''); setShowDropdown(false); }
  };

  const upsertSupplier = async (meta: NonNullable<typeof aiMeta>): Promise<string> => {
    const normalized = meta.proveedor.trim().toLowerCase();
    const existing = (localDB.getAll('suppliers') as Supplier[]).find(
      s => s.name.trim().toLowerCase() === normalized
    );
    if (existing) return existing.id;
    const now = new Date().toISOString();
    const id = `SUPP-${Date.now()}`;
    const newSupplier: Supplier = {
      id, name: meta.proveedor.trim(),
      taxId: meta.cif_proveedor || undefined,
      email: meta.email_proveedor || undefined,
      phone: meta.telefono_proveedor || undefined,
      city: meta.direccion_proveedor || undefined,
      createdAt: now, updatedAt: now,
    };
    await storage.save('suppliers', id, newSupplier);
    return id;
  };

  const updateLine = (
    setter: React.Dispatch<React.SetStateAction<EntryLine[]>>,
    idx: number,
    field: keyof EntryLine,
    value: EntryLine[keyof EntryLine],
  ) => setter(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const commitEntries = async (lines: EntryLine[], notes: string, date: string, origin: StockMovement['origin'] = 'entrada-stock', supplierId?: string) => {
    if (!lines.length) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      let updated = 0;
      let created = 0;
      for (const line of lines) {
        let itemId = line.inventoryItemId;
        let ref = line.ref;
        let description = line.description;

        if (!itemId) {
          // Create new inventory item using all user-edited values
          itemId = crypto.randomUUID();
          if (!ref) ref = `REF-${Date.now()}`;
          const newItem: InventoryItem = {
            id: itemId,
            ref,
            description,
            category: line.category || 'Otros',
            stock: line.qty,
            minStock: 2,
            costPrice: line.costPrice,
            salePrice: Math.round(line.costPrice * 2.5 * 100) / 100,
            location: line.location || undefined,
            createdAt: now,
            updatedAt: now,
          };
          await storage.save('inventory', itemId, newItem);
          created++;
        } else {
          // Update existing: add stock, refresh costPrice, category, location
          const item = inventoryItems.find(i => i.id === itemId);
          if (!item) continue;
          ref = item.ref;
          description = item.description;
          await storage.save('inventory', item.id, {
            ...item,
            stock: item.stock + line.qty,
            costPrice: line.costPrice,
            category: line.category || item.category,
            location: line.location !== '' ? line.location : item.location,
            updatedAt: now,
          });
          updated++;
        }

        const movement: StockMovement = {
          id: crypto.randomUUID(),
          itemId,
          ref,
          description,
          type: 'entrada',
          qty: line.qty,
          costPrice: line.costPrice,
          date,
          origin,
          supplierId: supplierId || undefined,
          notes: notes || undefined,
          createdAt: now,
        };
        await storage.save('stock_movements', movement.id, movement);
      }

      const parts: string[] = [];
      if (updated > 0) parts.push(`${updated} artículo(s) actualizados`);
      if (created > 0) parts.push(`${created} referencia(s) nueva(s) creadas`);
      onNotify('success', parts.join(' · ') || 'Entrada guardada');
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

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const mapGeminiResult = (result: GeminiInvoiceResult): EntryLine[] =>
    result.lineas.map(l => {
      const found = inventoryItems.find(i =>
        (l.referencia && i.ref.toLowerCase() === l.referencia.toLowerCase()) ||
        i.description.toLowerCase().includes(l.descripcion.toLowerCase().slice(0, 15))
      );
      return {
        inventoryItemId: found?.id || '',
        ref: l.referencia || found?.ref || '',
        description: l.descripcion || found?.description || '',
        qty: Math.max(1, Math.round(l.cantidad) || 1),
        costPrice: parseFloat(String(l.precio_unitario)) || 0,
        category: found?.category || categories[categories.length - 1] || 'Otros',
        location: found?.location || '',
      };
    });

  const parseWithAI = async () => {
    if (!aiFile && !aiRawText.trim()) { onNotify('error', 'Sube una imagen/archivo o pega el texto'); return; }
    const apiKey = settings.geminiApiKey;
    if (!apiKey) { onNotify('error', 'Configura tu clave API de Gemini en Ajustes'); return; }
    setAiParsing(true);
    setAiLines([]);
    setAiMeta(null);
    try {
      let result: GeminiInvoiceResult;
      if (aiFile && ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(aiFile.type)) {
        const base64 = await readFileAsBase64(aiFile);
        result = await analyzeInvoice(base64, aiFile.type, apiKey);
      } else {
        const text = aiRawText || (aiFile ? await aiFile.text() : '');
        result = await analyzeInvoiceText(text, apiKey);
      }
      setAiMeta({
        proveedor: result.proveedor, numero_factura: result.numero_factura, fecha: result.fecha, total: result.total,
        cif_proveedor: result.cif_proveedor || undefined,
        email_proveedor: result.email_proveedor || undefined,
        telefono_proveedor: result.telefono_proveedor || undefined,
        direccion_proveedor: result.direccion_proveedor || undefined,
      });
      setAiLines(mapGeminiResult(result));
      onNotify('success', `${result.lineas.length} artículo(s) detectados · ${result.proveedor || 'Proveedor desconocido'}`);
    } catch (err: any) {
      onNotify('error', `Error Gemini: ${err?.message || 'Verifica la clave API'}`);
    } finally {
      setAiParsing(false);
    }
  };

  const handleAiSave = async () => {
    // Verificar número de factura duplicado — saltar si viene de Correos (ya hizo su propio check)
    if (aiMeta?.numero_factura && !dupeFacAck && !preFillFromCorreo) {
      const existing = facturasImportadas.find(f =>
        f.numeroFactura === aiMeta.numero_factura || f.numero_factura === aiMeta.numero_factura
      );
      if (existing) {
        setDupeWarning({ numeroFactura: aiMeta.numero_factura, importadoEn: existing.importadoEn });
        return;
      }
    }
    setDupeWarning(null);
    setDupeFacAck(false);

    // Crear/actualizar proveedor si viene de carga directa AI (sin supplierId del prefill de Correos)
    let supplierId = aiMeta?.supplierId;
    if (!supplierId && aiMeta?.proveedor && !preFillFromCorreo) {
      try { supplierId = await upsertSupplier(aiMeta); } catch {}
    }

    const origin = preFillFromCorreo ? 'correo' : 'entrada-stock';
    const notesStr = ['Gemini IA', aiMeta?.proveedor, aiMeta?.numero_factura, aiFile?.name].filter(Boolean).join(' · ');
    await commitEntries(aiLines, notesStr, entryDate, origin, supplierId);
    setAiLines([]);
    setAiFile(null);
    setAiRawText('');
    setAiMeta(null);
    setPreFillFromCorreo(false);
  };

  // ── Shared lines table with editable ref, category, location ──────────────
  const LinesTable = ({
    lines,
    setter,
    onRemove,
  }: {
    lines: EntryLine[];
    setter: React.Dispatch<React.SetStateAction<EntryLine[]>>;
    onRemove: (i: number) => void;
  }) => (
    <div className="space-y-2">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={`rounded-xl border p-4 space-y-3 ${!line.inventoryItemId ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
        >
          {/* Row 1: description + qty + cost + delete */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">{line.description}</p>
              {!line.inventoryItemId
                ? <span className="text-[9px] font-bold text-amber-600">✦ Nueva referencia — se creará en catálogo</span>
                : <span className="text-[9px] font-bold text-emerald-600">✓ Existe en catálogo</span>
              }
            </div>
            <div className="flex items-end gap-2 shrink-0">
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-400 uppercase text-center">Cant</p>
                <input
                  type="number" min="1"
                  className="w-16 text-center px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-black bg-white"
                  value={line.qty}
                  onChange={e => updateLine(setter, idx, 'qty', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-slate-400 uppercase text-right">Coste u.</p>
                <input
                  type="number" min="0" step="0.01"
                  className="w-24 text-right px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-black bg-white"
                  value={line.costPrice}
                  onChange={e => updateLine(setter, idx, 'costPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
              <button onClick={() => onRemove(idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors mb-0.5">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Row 2: ref + category + location */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Referencia</p>
              <input
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={line.ref}
                onChange={e => updateLine(setter, idx, 'ref', e.target.value)}
                placeholder="REF-..."
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoría</p>
              <select
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none"
                value={line.category}
                onChange={e => updateLine(setter, idx, 'category', e.target.value)}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ubicación</p>
              <input
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={line.location}
                onChange={e => updateLine(setter, idx, 'location', e.target.value)}
                placeholder="Estantería A..."
              />
            </div>
          </div>
        </div>
      ))}
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
                setter={setManualLines}
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
                setter={setScannerLines}
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

      {/* ── Historial de entradas recientes ── */}
      {recentMovements.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <Clock size={14} className="text-slate-400" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-wide">Últimas entradas</span>
          </div>
          <div className="divide-y divide-slate-50">
            {recentMovements.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{m.description}</p>
                  <p className="text-[10px] text-slate-400">{m.notes || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.origin === 'correo' && (
                    <span className="flex items-center gap-1 text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      <Mail size={9} /> Desde correo
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-emerald-600">+{m.qty}</span>
                  <span className="text-[10px] text-slate-400">{m.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI tab ── */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          {!settings.geminiApiKey && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-bold">
                Configura tu <strong>API Key de Gemini</strong> en Ajustes para usar esta función.
              </p>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center space-y-3 cursor-pointer transition-all ${
              aiDragging ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onDragOver={e => { e.preventDefault(); setAiDragging(true); }}
            onDragLeave={() => setAiDragging(false)}
            onDrop={e => { e.preventDefault(); setAiDragging(false); const f = e.dataTransfer.files[0]; if (f) { setAiFile(f); setAiRawText(''); } }}
            onClick={() => fileInputRef.current?.click()}
          >
            {aiFile ? (
              <>
                <FileText size={28} className="mx-auto text-violet-500" />
                <p className="text-xs font-black text-violet-700">{aiFile.name}</p>
                <p className="text-[9px] text-slate-400">{(aiFile.size / 1024).toFixed(1)} KB · {aiFile.type || 'texto'}</p>
                <button onMouseDown={e => { e.stopPropagation(); setAiFile(null); }} className="text-[9px] text-red-500 font-bold underline">
                  Quitar archivo
                </button>
              </>
            ) : (
              <>
                <Upload size={28} className="mx-auto text-slate-400" />
                <p className="text-xs font-black uppercase text-slate-700">Arrastra la factura aquí o haz clic</p>
                <p className="text-[9px] text-slate-400">Imágenes (JPG, PNG, WEBP) · PDF · Texto (TXT, CSV)</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.txt,.csv,.tsv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setAiFile(f); setAiRawText(''); } e.target.value = ''; }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">O pega el texto de la factura</label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none resize-none"
              placeholder="Pega aquí el contenido de la factura del proveedor..."
              value={aiRawText}
              onChange={e => { setAiRawText(e.target.value); if (e.target.value) setAiFile(null); }}
            />
          </div>

          <button
            onClick={parseWithAI}
            disabled={aiParsing || (!aiFile && !aiRawText.trim()) || !settings.geminiApiKey}
            className="w-full py-4 bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20 disabled:opacity-40"
          >
            {aiParsing ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
            {aiParsing ? 'Analizando con Gemini...' : 'Analizar con Gemini AI'}
          </button>

          {/* Badge de origen correo */}
          {preFillFromCorreo && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <Mail size={13} className="text-blue-500 shrink-0" />
              <p className="text-xs font-bold text-blue-700">Datos importados desde correo electrónico</p>
            </div>
          )}

          {/* Warning de duplicado */}
          {dupeWarning && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-amber-800">Número de factura ya procesado</p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  La factura <strong>{dupeWarning.numeroFactura}</strong> ya fue importada el{' '}
                  <strong>{new Date(dupeWarning.importadoEn).toLocaleDateString('es-ES')}</strong>.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setDupeWarning(null)}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-black uppercase transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { setDupeFacAck(true); handleAiSave(); }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                  >
                    Proceder de todas formas
                  </button>
                </div>
              </div>
            </div>
          )}

          {aiMeta && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Proveedor', value: aiMeta.proveedor },
                { label: 'Nº Factura', value: aiMeta.numero_factura },
                { label: 'Fecha', value: aiMeta.fecha },
              ].map(({ label, value }) => (
                <div key={label} className="bg-violet-50 rounded-xl px-4 py-3">
                  <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest">{label}</p>
                  <p className="text-xs font-black text-violet-900 mt-0.5 truncate">{value || '—'}</p>
                </div>
              ))}
            </div>
          )}

          {aiLines.length > 0 && (
            <>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {aiLines.length} artículo(s) — revisa referencia, categoría y ubicación antes de confirmar
              </p>
              <LinesTable
                lines={aiLines}
                setter={setAiLines}
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
