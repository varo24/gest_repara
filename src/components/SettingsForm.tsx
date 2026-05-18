import React, { useState, useRef } from 'react';
import {
  Save, Building2, Download, Upload, Globe, Copy, CheckCircle2,
  Monitor, Mail, Phone, MapPin, FileText, Trash2, Image as ImageIcon,
  ShieldCheck, AlertTriangle, Database, RefreshCw, Cloud, CloudDownload,
  Package, Brain, Plus, LayoutDashboard, QrCode, MessageCircle, Lock, Unlock, Bell
} from 'lucide-react';
import { AppSettings, FullInvoice } from '../types';
import { storage, localDB } from '../lib/dataService';
import { isPinEnabled, clearPin, setPin, verifyPin } from '../lib/pinAuth';
import { isNotifEnabled, setNotifEnabled, requestPermissionIfNeeded } from '../lib/pushNotifications';

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
  { id: 'correos',           label: 'Correos/Facturas' },
  { id: 'calendar',          label: 'Planificador' },
  { id: 'stats',             label: 'Rendimiento' },
  { id: 'external-apps',     label: 'Módulos Ext.' },
  { id: 'settings',          label: 'Ajustes' },
];
const ALL_MODULE_IDS = ALL_MODULES.map(m => m.id);

// ── Notification toggle (self-contained, reads/writes localStorage) ───────────
const NotifToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(isNotifEnabled);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const handleToggle = async () => {
    if (!enabled) {
      if (permission !== 'granted') {
        await requestPermissionIfNeeded();
        const newPerm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
        setPermission(newPerm);
        if (newPerm !== 'granted') return;
      }
      setNotifEnabled(true);
      setEnabled(true);
    } else {
      setNotifEnabled(false);
      setEnabled(false);
    }
  };

  const denied = permission === 'denied';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-800 uppercase tracking-wide">
            {enabled ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {denied
              ? 'El navegador ha denegado el permiso — actívalo en Ajustes del navegador'
              : enabled
              ? 'Recibirás alertas de reparaciones listas, citas y stock bajo'
              : 'Activa para recibir alertas del taller en este dispositivo'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={denied}
          className={`relative w-14 h-7 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
            enabled ? 'bg-blue-500' : 'bg-slate-300'
          }`}
        >
          <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-7' : 'translate-x-0'
          }`} />
        </button>
      </div>
      {enabled && (
        <ul className="text-[10px] text-slate-400 font-medium space-y-1 pl-1">
          <li>✓ Reparación lista para recoger</li>
          <li>✓ Recordatorio de cita 1 hora antes</li>
          <li>✓ Artículo con stock bajo (1 vez al día)</li>
        </ul>
      )}
    </div>
  );
};

const SettingsForm: React.FC<SettingsFormProps> = ({ settings, canInstall, onInstall, onSave, onBack, version }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const verifactuPendientes = (localDB.getAll('invoices') as FullInvoice[])
    .filter(inv => inv.verifactu_pendiente_envio === true).length;
  const [copied, setCopied] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ok: boolean, msg: string} | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudResult, setCloudResult] = useState<{ok: boolean, msg: string} | null>(null);
  const [appNameError, setAppNameError] = useState(false);
  const [imapTesting, setImapTesting] = useState(false);
  const [imapTestResult, setImapTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── PIN state ──────────────────────────────────────────────────────────────
  const [pinEnabled, setPinEnabled] = useState(isPinEnabled);
  // 'idle' | 'verify-old' | 'enter-new' | 'confirm-new'
  const [pinFlow, setPinFlow] = useState<'idle' | 'verify-old' | 'enter-new' | 'confirm-new'>('idle');
  const [pinInput, setPinInput] = useState('');
  const [pinNewA, setPinNewA]   = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinToggle = async () => {
    if (pinEnabled) {
      clearPin();
      setPinEnabled(false);
      setPinFlow('idle');
    } else {
      setPinFlow('enter-new');
      setPinInput('');
      setPinError('');
    }
  };

  const handlePinInput = (val: string) => {
    if (!/^\d*$/.test(val) || val.length > 4) return;
    setPinInput(val);
    setPinError('');
  };

  const handlePinNext = async () => {
    if (pinInput.length !== 4) { setPinError('El PIN debe tener 4 dígitos.'); return; }
    if (pinFlow === 'verify-old') {
      const ok = await verifyPin(pinInput);
      if (!ok) { setPinError('PIN incorrecto.'); setPinInput(''); return; }
      setPinFlow('enter-new');
      setPinInput('');
    } else if (pinFlow === 'enter-new') {
      setPinNewA(pinInput);
      setPinFlow('confirm-new');
      setPinInput('');
    } else if (pinFlow === 'confirm-new') {
      if (pinInput !== pinNewA) { setPinError('Los PINs no coinciden.'); setPinInput(''); return; }
      await setPin(pinInput);
      setPinEnabled(true);
      setPinFlow('idle');
      setPinInput('');
      setPinNewA('');
    }
  };

  const cancelPinFlow = () => { setPinFlow('idle'); setPinInput(''); setPinNewA(''); setPinError(''); };

  const currentUrl = window.location.href;

  const handleSave = () => {
    if (!formData.appName.trim()) { setAppNameError(true); return; }
    setAppNameError(false);
    onSave(formData);
  };

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
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2" style={{ color: appNameError ? '#dc2626' : undefined }}>
                <Building2 size={12} className={appNameError ? 'text-red-500' : 'text-blue-500'} /> Nombre Comercial {appNameError && <span className="text-red-500 normal-case font-bold">— obligatorio</span>}
              </label>
              <input type="text" className={`w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold focus:ring-4 outline-none ${appNameError ? 'border-2 border-red-400 focus:ring-red-500/10' : 'border border-slate-200 focus:ring-blue-500/10'}`} value={formData.appName} onChange={e => { setFormData({...formData, appName: e.target.value}); if (e.target.value.trim()) setAppNameError(false); }} />
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
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <MapPin size={12} className="text-blue-500" /> Ciudad
              </label>
              <input
                type="text"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none"
                placeholder="Madrid"
                value={formData.city || ''}
                onChange={e => setFormData({...formData, city: e.target.value})}
              />
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
                Aparece en la fecha y lugar de los documentos legales (RGPD)
              </p>
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
          <div className="space-y-2 mt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <ShieldCheck size={12} className="text-blue-500" /> Meses de Garantía por defecto (al despachar)
            </label>
            <input
              type="number"
              min={0}
              max={24}
              className="w-40 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none"
              value={formData.warrantyMonths ?? 3}
              onChange={e => setFormData({...formData, warrantyMonths: Math.max(0, parseInt(e.target.value) || 0)})}
            />
          </div>
          <div className="space-y-2 mt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <FileText size={12} className="text-amber-500" /> Días laborables sin respuesta para avisar en presupuestos
            </label>
            <input
              type="number"
              min={1}
              max={30}
              className="w-40 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-amber-500/10 outline-none"
              value={formData.budgetFollowUpDays ?? 3}
              onChange={e => setFormData({...formData, budgetFollowUpDays: Math.min(30, Math.max(1, parseInt(e.target.value) || 3))})}
            />
            <p className="text-[10px] text-slate-400 ml-1">
              🟡 Amarillo: {formData.budgetFollowUpDays ?? 3}–{(formData.budgetFollowUpDays ?? 3) * 2}d &nbsp;·&nbsp; 🔴 Rojo: {(formData.budgetFollowUpDays ?? 3) * 2 + 1}d+
            </p>
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

      {/* SERVIDOR DE CORREO */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="bg-blue-700 p-3 rounded-2xl text-white shadow-lg">
            <Mail size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Servidor de Correo</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Módulo Correos · Conexión IMAP</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL Servidor IMAP (gestrepara-imap en Railway)</label>
          <div className="flex gap-3">
            <input
              type="url"
              className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none"
              placeholder="https://gestrepara-imap.railway.app"
              value={formData.imapServerUrl || ''}
              onChange={e => { setFormData({ ...formData, imapServerUrl: e.target.value }); setImapTestResult(null); }}
            />
            <button
              type="button"
              disabled={!formData.imapServerUrl || imapTesting}
              onClick={async () => {
                if (!formData.imapServerUrl) return;
                setImapTesting(true);
                setImapTestResult(null);
                try {
                  const res = await fetch(`${formData.imapServerUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(8000) });
                  const json = await res.json();
                  setImapTestResult(json.ok ? { ok: true, msg: 'Servidor conectado' } : { ok: false, msg: 'Respuesta inesperada' });
                } catch (e: any) {
                  setImapTestResult({ ok: false, msg: e.message || 'Error de conexión' });
                } finally {
                  setImapTesting(false);
                }
              }}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 shrink-0"
            >
              {imapTesting ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
              Probar
            </button>
          </div>
          {imapTestResult && (
            <p className={`text-[10px] font-black uppercase tracking-widest ml-1 ${imapTestResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {imapTestResult.ok ? '✓' : '✗'} {imapTestResult.msg}
            </p>
          )}
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
            Despliega gestrepara-imap en Railway y pega aquí la URL pública del servicio
          </p>

          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mt-4 block">Clave API (x-api-key)</label>
          <input
            type="password"
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none font-mono text-sm"
            placeholder="gestrepara-2026-secure"
            value={formData.imapApiKey || ''}
            onChange={e => setFormData({ ...formData, imapApiKey: e.target.value })}
          />
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
            Debe coincidir con la variable API_KEY en Railway
          </p>

          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mt-4 block">Días a analizar</label>
          <input
            type="number"
            min={1}
            max={90}
            className="w-32 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none text-center text-lg"
            placeholder="7"
            value={formData.imapDays ?? 7}
            onChange={e => setFormData({ ...formData, imapDays: Math.min(90, Math.max(1, parseInt(e.target.value) || 7)) })}
          />
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
            Período que se analiza automáticamente al abrir Correos (1-90 días)
          </p>
        </div>
      </div>

      {/* VERIFACTU */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="bg-blue-700 p-3 rounded-2xl text-white shadow-lg">
            <QrCode size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">VeriFactu — Sistema de Facturación</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Obligatorio para autónomos a partir de julio 2027 (AEAT)</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border ${
            formData.verifactuEnabled
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {formData.verifactuEnabled ? '✓ Preparado' : 'No activado'}
          </span>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="text-sm font-black text-slate-800">Activar VeriFactu</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Genera huella SHA-256 y QR de verificación en cada factura</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, verifactuEnabled: !formData.verifactuEnabled })}
              className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
                formData.verifactuEnabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                formData.verifactuEnabled ? 'translate-x-7' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {formData.verifactuEnabled && (
            <div className="space-y-5 p-5 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIF Emisor (para huella y QR)</label>
                <input
                  type="text"
                  className="w-full px-6 py-4 bg-white border border-blue-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none font-mono text-sm uppercase"
                  placeholder="12345678A"
                  value={formData.verifactuNIF || ''}
                  onChange={e => setFormData({ ...formData, verifactuNIF: e.target.value.toUpperCase() })}
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">Si está vacío se usará el NIF de Identidad del Taller</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serie de factura (opcional)</label>
                <input
                  type="text"
                  className="w-32 px-6 py-4 bg-white border border-blue-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none font-mono text-sm uppercase"
                  placeholder="FAC"
                  value={formData.verifactuSerie || ''}
                  onChange={e => setFormData({ ...formData, verifactuSerie: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-100">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-amber-800">Obligatorio a partir de julio 2027</p>
              <p className="text-[10px] text-amber-700 leading-relaxed">
                La normativa VeriFactu (Real Decreto 1007/2023) exige sistemas de facturación verificables con huella encadenada. El envío automático a la AEAT se activará en la app antes de esa fecha. Los QR de verificación ya se imprimen en las facturas cuando VeriFactu está activado.
              </p>
            </div>
          </div>

          {formData.verifactuEnabled && verifactuPendientes > 0 && (
            <div className="flex items-center justify-between p-5 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-3">
                <RefreshCw size={16} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs font-black text-blue-800">Pendientes de envío a la AEAT</p>
                  <p className="text-[10px] text-blue-600">{verifactuPendientes} factura{verifactuPendientes !== 1 ? 's' : ''} en cola — el envío se activará en julio 2027</p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-widest">
                {verifactuPendientes}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICACIONES PUSH */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#f0f9ff' }}>
            <Bell size={24} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Notificaciones Push</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Alertas del sistema en el dispositivo</p>
          </div>
        </div>
        <NotifToggle />
      </div>

      {/* RECORDATORIOS WHATSAPP */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="p-3 rounded-2xl text-white shadow-lg" style={{ background: '#075e54' }}>
            <MessageCircle size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Recordatorios WhatsApp</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Aviso automático a clientes el día antes de su cita</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border ${
            formData.whatsappRemindersEnabled
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {formData.whatsappRemindersEnabled ? '✓ Activo' : 'Inactivo'}
          </span>
        </div>

        <div className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="text-sm font-black text-slate-800">Activar recordatorios</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Muestra un aviso al abrir la app para enviar recordatorios por WhatsApp
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, whatsappRemindersEnabled: !formData.whatsappRemindersEnabled })}
              className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
                formData.whatsappRemindersEnabled ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                formData.whatsappRemindersEnabled ? 'translate-x-7' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {formData.whatsappRemindersEnabled && (
            <div className="space-y-6 p-5 rounded-2xl border border-emerald-100" style={{ background: '#f0fdf4' }}>
              {/* Hour */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Hora del aviso (se muestra al abrir la app a partir de esa hora)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="w-24 px-4 py-3 bg-white border border-emerald-200 rounded-2xl font-black text-lg text-center focus:ring-4 focus:ring-emerald-500/10 outline-none"
                    value={formData.whatsappReminderHour ?? 17}
                    onChange={e => setFormData({ ...formData, whatsappReminderHour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                  />
                  <span className="text-sm font-bold text-slate-500">:00 h</span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold ml-1">
                  Por defecto: 17:00 — El aviso no aparece si se abre antes de esa hora
                </p>
              </div>

              {/* Message template */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Mensaje personalizado
                </label>
                <textarea
                  rows={4}
                  className="w-full px-5 py-4 bg-white border border-emerald-200 rounded-2xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-emerald-500/10 outline-none resize-none leading-relaxed"
                  value={formData.whatsappReminderMessage || ''}
                  onChange={e => setFormData({ ...formData, whatsappReminderMessage: e.target.value })}
                  placeholder={`Hola {nombre}, te recordamos tu cita mañana {fecha} a las {hora} en {taller}. Para cancelar o cambiar hora llámanos al {telefono}.`}
                />
                <p className="text-[10px] text-slate-400 font-bold ml-1">
                  Variables: <code className="bg-white px-1 rounded">{'{nombre}'}</code> · <code className="bg-white px-1 rounded">{'{fecha}'}</code> · <code className="bg-white px-1 rounded">{'{hora}'}</code> · <code className="bg-white px-1 rounded">{'{taller}'}</code> · <code className="bg-white px-1 rounded">{'{telefono}'}</code>
                </p>
              </div>
            </div>
          )}
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

      {/* ── Seguridad — PIN de acceso ── */}
      <div className="rounded-[2rem] overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="flex items-center gap-3 px-6 py-4" style={{ background: 'linear-gradient(135deg,#1e3a2f,#0f2d1e)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Lock size={18} color="#86efac" />
          </div>
          <div>
            <p className="text-[12px] font-black uppercase tracking-widest text-white">Seguridad — PIN de acceso</p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Protección local • bloqueo automático 10 min</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-black text-white uppercase tracking-wide">
                {pinEnabled ? 'PIN activo' : 'PIN desactivado'}
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {pinEnabled ? 'La app pide PIN al abrirse y tras 10 min de inactividad' : 'La app abre sin pedir PIN'}
              </p>
            </div>
            <button
              onClick={handlePinToggle}
              style={{
                width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: pinEnabled ? '#22c55e' : '#374151',
                transition: 'background 0.2s', position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: pinEnabled ? 23 : 3,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Change PIN button (only when enabled and no flow active) */}
          {pinEnabled && pinFlow === 'idle' && (
            <button
              onClick={() => { setPinFlow('verify-old'); setPinInput(''); setPinError(''); }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Unlock size={13} />
              Cambiar PIN
            </button>
          )}

          {/* PIN flow inputs */}
          {pinFlow !== 'idle' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                {pinFlow === 'verify-old' ? 'Introduce el PIN actual'
                 : pinFlow === 'enter-new' ? 'Nuevo PIN (4 dígitos)'
                 : 'Confirma el nuevo PIN'}
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinInput}
                  onChange={e => handlePinInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePinNext()}
                  autoFocus
                  placeholder="••••"
                  className="flex-1 px-4 py-3 rounded-2xl font-black text-center text-white text-xl tracking-[0.5em] focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', letterSpacing: '0.5em' }}
                />
                <button
                  onClick={handlePinNext}
                  disabled={pinInput.length !== 4}
                  className="px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-40"
                  style={{ background: '#22c55e', color: '#fff' }}
                >
                  {pinFlow === 'confirm-new' ? 'Guardar' : 'Siguiente'}
                </button>
                <button
                  onClick={cancelPinFlow}
                  className="px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {pinError && (
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f87171' }}>{pinError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={onBack} className="px-10 py-6 bg-white border border-slate-200 text-slate-500 rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest hover:bg-slate-50 transition-all">Cancelar</button>
        <button onClick={handleSave} className="flex-1 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-4 hover:bg-blue-700 transition-all">
          <Save size={20} /> Guardar Identidad del Taller
        </button>
      </div>

      {version && (
        <p className="text-center text-[10px] text-slate-400 font-medium tracking-widest">
          Versión {version}
        </p>
      )}
    </div>
  );
};

export default SettingsForm;