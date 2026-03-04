import React, { useState } from 'react';
import { ExternalApp } from '../types';
import { PlusCircle, Edit2, Trash2, Globe, Zap, LayoutGrid, Sparkles, X, ArrowLeft, ExternalLink, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

interface ExternalAppsViewProps {
  apps: ExternalApp[];
  onSaveApp: (app: ExternalApp) => void;
  onDeleteApp: (id: string) => void;
  onViewApp: (app: ExternalApp) => void;
}

const APP_PRESETS: Omit<ExternalApp, 'id' | 'fechaAnadida'>[] = [
  { nombre: 'WhatsApp Web', url: 'https://web.whatsapp.com', descripcion: 'Atención al cliente directa desde el taller.', icono: '💬', categoria: 'Ventas', activa: true },
  { nombre: 'Google Sheets', url: 'https://docs.google.com/spreadsheets', descripcion: 'Control detallado de inventario y gastos.', icono: '📊', categoria: 'Inventario', activa: true },
  { nombre: 'Trello', url: 'https://trello.com', descripcion: 'Tableros Kanban para gestión de proyectos.', icono: '📋', categoria: 'Otros', activa: true },
  { nombre: 'Canva', url: 'https://www.canva.com', descripcion: 'Diseño de promociones y presupuestos visuales.', icono: '🎨', categoria: 'Utilidades', activa: true },
  { nombre: 'Google Calendar', url: 'https://calendar.google.com', descripcion: 'Vista extendida de agenda externa.', icono: '📅', categoria: 'Utilidades', activa: true },
];

const ExternalAppsView: React.FC<ExternalAppsViewProps> = ({ apps, onSaveApp, onDeleteApp, onViewApp }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState<ExternalApp | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExternalApp | null>(null);

  const [formData, setFormData] = useState({
    nombre: '', url: '', descripcion: '', icono: '🚀', categoria: 'Otros', activa: true
  });

  const handleOpenCreate = () => {
    setEditingApp(null);
    setFormData({ nombre: '', url: '', descripcion: '', icono: '🚀', categoria: 'Otros', activa: true });
    setShowModal(true);
  };

  const handleOpenEdit = (app: ExternalApp) => {
    setEditingApp(app);
    setFormData({
      nombre: app.nombre, url: app.url, descripcion: app.descripcion,
      icono: app.icono, categoria: app.categoria, activa: app.activa
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.nombre || !formData.url) return;
    const app: ExternalApp = {
      id: editingApp?.id || `app-${Date.now()}`,
      ...formData,
      fechaAnadida: editingApp?.fechaAnadida || new Date().toISOString(),
    };
    onSaveApp(app);
    setShowModal(false);
  };

  const handleAddPreset = (preset: Omit<ExternalApp, 'id' | 'fechaAnadida'>) => {
    if (apps.some(a => a.url === preset.url)) return;
    const app: ExternalApp = {
      ...preset,
      id: `app-${Date.now()}`,
      fechaAnadida: new Date().toISOString(),
    };
    onSaveApp(app);
  };

  const toggleAppStatus = (app: ExternalApp) => {
    onSaveApp({ ...app, activa: !app.activa });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Centro de Módulos</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Integra herramientas externas</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          <PlusCircle size={16} /> Nueva Integración
        </button>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-widest px-1">
          <Sparkles size={14} />
          <span>Recomendados para el Taller</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {APP_PRESETS.map((preset, idx) => {
            const alreadyAdded = apps.some(a => a.url === preset.url);
            return (
              <button
                key={idx}
                onClick={() => !alreadyAdded && handleAddPreset(preset)}
                disabled={alreadyAdded}
                className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col items-center gap-2 group relative overflow-hidden transition-all ${alreadyAdded ? 'border-emerald-200 opacity-60' : 'border-slate-100 hover:shadow-md hover:border-blue-200'}`}
              >
                <span className="text-2xl">{preset.icono}</span>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{preset.nombre}</span>
                {alreadyAdded && <span className="text-[8px] text-emerald-600 font-black">✓ AÑADIDO</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Installed Apps */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest px-1">
          <LayoutGrid size={14} />
          <span>Tus Aplicaciones ({apps.length})</span>
        </div>

        {apps.length === 0 ? (
          <div className="py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <LayoutGrid size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-sm">Lista vacía</p>
            <p className="text-[10px]">Usa los presets o añade una personalizada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map(app => (
              <div key={app.id} className={`bg-white rounded-[1.5rem] shadow-sm border overflow-hidden group hover:shadow-xl transition-all duration-300 ${app.activa ? 'border-slate-100' : 'border-slate-200 opacity-70 grayscale'}`}>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${app.activa ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      {app.icono.length < 5 ? app.icono : <Globe size={28} />}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleAppStatus(app)} className={`p-2 rounded-full hover:bg-white shadow-sm border ${app.activa ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {app.activa ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => handleOpenEdit(app)} className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setConfirmDelete(app)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 text-lg mb-1">{app.nombre}</h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded tracking-wider">{app.categoria}</span>
                  <p className="text-slate-500 text-xs mt-3 line-clamp-2 h-8">{app.descripcion || 'Sin descripción'}</p>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                    <button onClick={() => onViewApp(app)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all">
                      <Zap size={14} /> Abrir
                    </button>
                    <button onClick={() => window.open(app.url, '_blank')} className="p-2 text-slate-400 hover:text-slate-700 transition-colors" title="Abrir en nueva ventana">
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900">{editingApp ? 'Editar App' : 'Nueva Integración'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-full hover:bg-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ícono</label>
                  <input className="w-full px-3 py-3 border border-slate-200 rounded-xl text-center text-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.icono} onChange={e => setFormData({...formData, icono: e.target.value})} />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nombre</label>
                  <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">URL</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://..." value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Categoría</label>
                  <select className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})}>
                    <option>Ventas</option><option>Taller</option><option>Inventario</option><option>Utilidades</option><option>Otros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Estado</label>
                  <button type="button" onClick={() => setFormData({...formData, activa: !formData.activa})} className={`flex items-center justify-between w-full px-4 py-3 border rounded-xl transition-colors ${formData.activa ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <span className="text-sm font-bold uppercase">{formData.activa ? 'Activa' : 'Inactiva'}</span>
                    {formData.activa ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Descripción</label>
                <input className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="px-5 py-3 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 rounded-xl">Cancelar</button>
                <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 bg-red-50 rounded-2xl"><Trash2 size={28} className="text-red-600" /></div>
              <p className="text-sm font-black text-slate-900 uppercase">¿Eliminar {confirmDelete.nombre}?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancelar</button>
              <button onClick={() => { onDeleteApp(confirmDelete.id); setConfirmDelete(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalAppsView;
