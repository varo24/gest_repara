import React, { useState, useRef } from 'react';
import {
  Save, Building2, Download, Upload, Globe, Copy, CheckCircle2,
  Monitor, Mail, Phone, MapPin, FileText, Trash2, Image as ImageIcon,
  ShieldCheck, AlertTriangle, Database, RefreshCw, Cloud, CloudDownload,
  Package, Brain, Plus, LayoutDashboard
} from 'lucide-react';
import { AppSettings } from '../types';
import { storage } from '../lib/dataService';

interface SettingsFormProps {
  settings: AppSettings;
  canInstall?: boolean;
  onInstall?: () => void;
  onSave: (settings: AppSettings) => void;
  onBack: () => void;
  version?: string;
}

const ALL_MODULES = [
  { id: 'new-repair',        label: 'Nueva Reparación' },
  { id: 'repairs',           label: 'Reparaciones' },
  { id: 'despacho',          label: 'Despacho' },
  { id: 'budgets',           label: 'Presupuestos' },
  { id: 'invoices',          label: 'Facturas' },
  { id: 'customers',         label: 'Clientes' },
  { id: 'inventory',         label: 'Inventario' },
  { id: 'inventory-entrada', label: 'Entrada Stock' },
  { id: 'garantias',         label: 'Garantías' },
  { id: 'calendar',          label: 'Planificador' },
  { id: 'stats',             label: 'Rendimiento' },
  { id: 'external-apps',     label: 'Módulos Ext.' },
  { id: 'settings',          label: 'Ajustes' },
];
const ALL_MODULE_IDS = ALL_MODULES.map(m => m.id);

const SettingsForm: React.FC<SettingsFormProps> = ({ settings, canInstall, onInstall, onSave, onBack, version }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [copied, setCopied] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ok: boolean, msg: string} | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudResult, setCloudResult] = useState<{ok: boolean, msg: string} | null>(null);

  const currentUrl = window.location.href;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };


  const copyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    const data = await storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_gestrepara_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const IMPORT_COLS = [
    'repairs', 'budgets', 'invoices', 'cash_movements', 'inventory',
    'stock_movements', 'warranties', 'customers', 'appointments',
    'reminders', 'surveys', 'settings', 'citas', 'apps_externas',
  ] as const;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let count = 0;
      for (const col of IMPORT_COLS) {
        const records = data[col];
        if (Array.isArray(records)) {
          for (const r of records) {
            if (r?.id) { await storage.save(col, r.id, r); count++; }
          }
        }
      }
      setImportResult({ ok: true, msg: `${count} registros importados correctamente` });
    } catch {
      setImportResult({ ok: false, msg: 'Error al leer el archivo. Verifica que es un backup válido.' });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 no-print">
      <button onClick={onBack} className="back-to-dash">← INICIO</button>

      {/* IDENTIDAD VISUAL Y DATOS FISCALES */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
        <div className="flex items-center justify-between border-b border-slate-50 pb-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg">
               <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Identidad del Taller</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configuración de marca y facturación</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Subida de Logo */}
          <div className="lg:col-span-4 space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logotipo del Taller</label>
            <div 
              onClick={() => logoInputRef.current?.click()}
              className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group overflow-hidden relative"
            >
              {formData.logoUrl ? (
                <>
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-8" />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFormData({...formData, logoUrl: ''}); }}
                      className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-5 bg-white rounded-2xl shadow-sm text-slate-300 group-hover:text-blue-500 transition-colors">
                    <ImageIcon size={32} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600">Subir Logo (PNG/JPG)</span>
                </>
              )}
            </div>
            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">O pega URL del logo</label>
              <input
                type="url"
                placeholder="https://... o data:image/..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.logoUrl || ''}
                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
              />
            </div>
          </div>

          {/* Campos de Texto */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Building2 size={12} className="text-blue-500" /> Nombre Comercial
              </label>
              <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.appName} onChange={e => setFormData({...formData, appName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <FileText size={12} className="text-blue-500" /> NIF / CIF / TAX ID
              </label>
              <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Phone size={12} className="text-blue-500" /> Teléfono de Contacto
              </label>
              <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Mail size={12} className="text-blue-500" /> Correo Electrónico
              </label>
              <input type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <MapPin size={12} className="text-blue-500" /> Dirección Completa
              </label>
              <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
          </div>
        </div>

        {/* Notas Legales */}
        <div className="pt-8 border-t border-slate-50">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <ShieldCheck size={12} className="text-blue-500" /> Notas para Presupuestos (Pie de página en valoraciones técnicas)
            </label>
            <textarea
              rows={3}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-medium text-xs text-slate-600 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none leading-relaxed"
              value={formData.letterhead}
              onChange={e => setFormData({...formData, letterhead: e.target.value})}
              placeholder="Ej: Este presupuesto tiene validez de 15 días. Garantía de 3 meses en mano de obra..."
            />
          </div>
          <div className="space-y-2 mt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <ShieldCheck size={12} className="text-blue-500" /> Condiciones Generales (Pie legal en presupuestos y facturas)
            </label>
            <textarea
              rows={5}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] font-medium text-xs text-slate-600 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none leading-relaxed"
              value={formData.legalTerms || ''}
              onChange={e => setFormData({...formData, legalTerms: e.target.value})}
              placeholder="Condiciones legales que aparecerán al pie de presupuestos y facturas..."
            />
          </div>
        </div>
      </div>

      {/* INVENTARIO */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg">
            <Package size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Inventario</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Categorías de artículos y configuración IA</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categorías de artículos</label>
          <div className="space-y-2">
            {(formData.inventoryCategories && formData.inventoryCategories.length > 0
              ? formData.inventoryCategories
              : ['pantallas', 'baterias', 'conectores', 'camaras', 'mecanica', 'otros']
            ).map((cat, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none"
                  value={cat}
                  onChange={e => {
                    const cats = [...(formData.inventoryCategories || ['pantallas', 'baterias', 'conectores', 'camaras', 'mecanica', 'otros'])];
                    cats[idx] = e.target.value;
                    setFormData({ ...formData, inventoryCategories: cats });
                  }}
                  placeholder={`Categoría ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const cats = (formData.inventoryCategories || ['pantallas', 'baterias', 'conectores', 'camaras', 'mecanica', 'otros']).filter((_, i) => i !== idx);
                    setFormData({ ...formData, inventoryCategories: cats });
                  }}
                  className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const base = formData.inventoryCategories && formData.inventoryCategories.length > 0
                ? formData.inventoryCategories
                : ['pantallas', 'baterias', 'conectores', 'camaras', 'mecanica', 'otros'];
              setFormData({ ...formData, inventoryCategories: [...base, ''] });
            }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all"
          >
            <Plus size={12} /> Añadir categoría
          </button>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-50">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Brain size={12} className="text-violet-500" /> API Key de Gemini (análisis IA de facturas)
          </label>
          <input
            type="password"
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-violet-500/10 outline-none"
            placeholder="AIzaSy..."
            value={formData.geminiApiKey || ''}
            onChange={e => setFormData({ ...formData, geminiApiKey: e.target.value })}
          />
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
            Necesaria para el módulo Entrada de Stock → pestaña IA / Factura (soporta imágenes JPG, PNG, PDF)
          </p>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-50">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Brain size={12} className="text-slate-400" /> API Key de Anthropic (opcional)
          </label>
          <input
            type="password"
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-slate-500/10 outline-none"
            placeholder="sk-ant-api03-..."
            value={formData.anthropicApiKey || ''}
            onChange={e => setFormData({ ...formData, anthropicApiKey: e.target.value })}
          />
        </div>
      </div>

      {/* PERSONALIZAR DASHBOARD */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Personalizar Dashboard</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Módulos visibles en la pantalla principal</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ALL_MODULES.map(mod => {
            const active = (formData.dashboardModules ?? ALL_MODULE_IDS).includes(mod.id);
            const activeCount = (formData.dashboardModules ?? ALL_MODULE_IDS).length;
            const canToggle = !active ? true : activeCount > 4;
            return (
              <label
                key={mod.id}
                className={`flex items-center gap-3 px-5 py-4 rounded-2xl border cursor-pointer select-none transition-all ${
                  active ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
                } ${!canToggle ? 'opacity-40 cursor-not-allowed' : 'hover:border-indigo-300'}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!canToggle}
                  onChange={() => {
                    if (!canToggle) return;
                    const current = formData.dashboardModules ?? ALL_MODULE_IDS;
                    const next = active
                      ? current.filter(id => id !== mod.id)
                      : [...current, mod.id];
                    setFormData({ ...formData, dashboardModules: next });
                  }}
                  className="w-4 h-4 accent-indigo-600 shrink-0"
                />
                <span className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {mod.label}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Mínimo 4 módulos activos — activos: {(formData.dashboardModules ?? ALL_MODULE_IDS).length}
        </p>
      </div>

      {/* INSTALACIÓN ESCRITORIO */}
      {canInstall && (
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[3rem] text-white shadow-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl text-white">
              <Monitor size={24} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight">Convertir en App de Escritorio</h3>
          </div>
          <p className="text-xs text-white/70 font-bold uppercase leading-relaxed">
            Instala esta consola directamente en tu PC para acceder sin abrir el navegador y tener una experiencia de aplicación real.
          </p>
          <button 
            onClick={onInstall}
            className="w-full py-5 bg-white text-indigo-600 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:scale-[1.02] transition-all shadow-xl"
          >
            Instalar ReparaPro en este PC
          </button>
        </div>
      )}

      {/* SINCRONIZACION Y BACKUP */}
      <div className="bg-slate-950 p-10 rounded-[3rem] text-white shadow-2xl space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <div className="bg-blue-500 p-3 rounded-2xl">
            <Database size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Sincronización y Backup</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Firebase Cloud · Sincronización en tiempo real</p>
          </div>
        </div>

        {/* URL multiterminal */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">URL de acceso desde cualquier terminal</p>
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
            <Globe size={16} className="text-slate-500 shrink-0" />
            <code className="flex-1 text-[11px] font-black text-blue-400 truncate">{currentUrl}</code>
            <button onClick={copyUrl} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-slate-100'}`}>
              {copied ? '✓ Copiado' : <span className="flex items-center gap-1"><Copy size={12} /> Copiar</span>}
            </button>
          </div>
        </div>

        {/* Botones backup */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Copia de seguridad de datos</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
            >
              <Download size={16} /> Exportar backup
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
            >
              {importing ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              {importing ? 'Importando...' : 'Importar backup'}
            </button>
            <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>

          {importResult && (
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
              importResult.ok
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-900/30 text-red-400 border border-red-500/20'
            }`}>
              {importResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {importResult.msg}
            </div>
          )}
        </div>

        {/* Sincronización Firebase */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronización Firebase</p>
          <p className="text-[9px] text-slate-600 -mt-1">Los datos se sincronizan automáticamente en tiempo real con Firebase. Usa este botón para forzar una sincronización manual.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={cloudBusy}
              onClick={async () => {
                setCloudBusy(true);
                setCloudResult(null);
                try {
                  await storage.syncNow();
                  setCloudResult({ ok: true, msg: 'Sincronización con Firebase completada' });
                } catch {
                  setCloudResult({ ok: false, msg: 'Error al sincronizar con Firebase' });
                } finally {
                  setCloudBusy(false);
                }
              }}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
            >
              {cloudBusy ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
              {cloudBusy ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
            <button
              type="button"
              disabled={cloudBusy}
              onClick={async () => {
                setCloudBusy(true);
                setCloudResult(null);
                try {
                  await storage.syncNow();
                  setCloudResult({ ok: true, msg: 'Datos restaurados desde Firebase correctamente' });
                } catch {
                  setCloudResult({ ok: false, msg: 'Error al restaurar desde Firebase' });
                } finally {
                  setCloudBusy(false);
                }
              }}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
            >
              {cloudBusy ? <RefreshCw size={16} className="animate-spin" /> : <CloudDownload size={16} />}
              {cloudBusy ? 'Restaurando...' : 'Restaurar desde Firebase'}
            </button>
          </div>

          {cloudResult && (
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
              cloudResult.ok
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-900/30 text-red-400 border border-red-500/20'
            }`}>
              {cloudResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {cloudResult.msg}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={onBack} className="px-10 py-6 bg-white border border-slate-200 text-slate-500 rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest hover:bg-slate-50 transition-all">Cancelar</button>
        <button onClick={() => onSave(formData)} className="flex-1 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-4 hover:bg-blue-700 transition-all">
          <Save size={20} /> Guardar Identidad del Taller
        </button>
      </div>
    </div>
  );
};

export default SettingsForm;