import React, { useState } from 'react';
import { ExternalApp } from '../types';
import { ArrowLeft, ExternalLink, RefreshCw, Globe, Zap } from 'lucide-react';

interface ExternalAppViewerProps {
  app: ExternalApp;
  onBack: () => void;
}

const ExternalAppViewer: React.FC<ExternalAppViewerProps> = ({ app, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);

  const handleReload = () => {
    setIsLoading(true);
    const iframe = document.getElementById('external-app-iframe') as HTMLIFrameElement;
    if (iframe) iframe.src = iframe.src;
  };

  return (
    <div className="h-full flex flex-col space-y-4 -m-6 md:-m-10">
      {/* Header */}
      <div className="bg-white p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
            {app.icono.length < 5 ? app.icono : <Zap size={24} />}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">{app.nombre}</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Módulo de {app.categoria}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReload} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refrescar
          </button>
          <button onClick={() => window.open(app.url, '_blank')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
            <ExternalLink size={14} /> Ventana Nueva
          </button>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 bg-white relative" style={{ minHeight: '600px' }}>
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold animate-pulse text-sm">Conectando con {app.nombre}...</p>
          </div>
        )}
        <iframe
          id="external-app-iframe"
          src={app.url}
          className="w-full h-full border-none"
          style={{ minHeight: '600px' }}
          title={app.nombre}
          onLoad={() => setIsLoading(false)}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-widest py-2">
        <Globe size={12} />
        Contenido externo de {(() => { try { return new URL(app.url).hostname; } catch { return app.url; } })()}
      </div>
    </div>
  );
};

export default ExternalAppViewer;
