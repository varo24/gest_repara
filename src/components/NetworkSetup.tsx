import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Server, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Database, Monitor, Loader2 } from 'lucide-react';
import { pb } from '../services/pocketbaseService';

interface NetworkSetupProps {
  onConnected: (host: string) => void;
  onSkip: () => void;
}

const NetworkSetup: React.FC<NetworkSetupProps> = ({ onConnected, onSkip }) => {
  const [host, setHost] = useState('http://192.168.1.100:8090');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ok' | 'error'>('idle');
  const [savedHost, setSavedHost] = useState('');
  const [autoReconnecting, setAutoReconnecting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pb_host');
    if (stored) {
      setSavedHost(stored);
      setHost(stored);
      tryConnect(stored, true);
    }
  }, []);

  const tryConnect = async (url: string, silent = false) => {
    if (!silent) setStatus('connecting');
    else setAutoReconnecting(true);

    const ok = await pb.connect(url);
    if (ok) {
      localStorage.setItem('pb_host', url);
      setSavedHost(url);
      setStatus('ok');
      setAutoReconnecting(false);
      setTimeout(() => onConnected(url), 800);
    } else {
      setStatus(silent ? 'idle' : 'error');
      setAutoReconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex p-5 bg-blue-600/10 rounded-[2rem] mb-5 border border-blue-600/20">
            <Database size={40} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Sincronización LAN</h1>
          <p className="text-slate-400 text-sm mt-2">Conecta todos los terminales del taller</p>
        </div>

        {/* Card principal */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8 space-y-6">

          {/* Estado de reconexión automática */}
          {autoReconnecting && (
            <div className="flex items-center gap-3 bg-blue-900/30 border border-blue-800 rounded-2xl px-4 py-3">
              <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
              <p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest">Reconectando al servidor...</p>
            </div>
          )}

          {/* Último servidor guardado */}
          {savedHost && status !== 'ok' && !autoReconnecting && (
            <div className="bg-slate-800 rounded-2xl p-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Último servidor</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-300 font-mono">{savedHost}</p>
                <button
                  onClick={() => tryConnect(savedHost)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                >
                  <RefreshCw size={12} /> Reconectar
                </button>
              </div>
            </div>
          )}

          {/* Input de IP */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IP del servidor PocketBase</label>
            <input
              type="text"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="http://192.168.1.100:8090"
              className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white font-mono text-sm outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-[10px] text-slate-500 px-1">Cambia la IP por la del PC maestro del taller</p>
          </div>

          {/* Estado */}
          {status === 'ok' && (
            <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-800 rounded-2xl px-4 py-3">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <p className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">Conectado correctamente</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-3 bg-red-900/30 border border-red-800 rounded-2xl px-4 py-3">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="text-[11px] font-black text-red-300 uppercase tracking-widest">No se puede conectar</p>
                <p className="text-[10px] text-red-400/70 mt-0.5">Verifica que PocketBase está en marcha y la IP es correcta</p>
              </div>
            </div>
          )}

          {/* Botón conectar */}
          <button
            onClick={() => tryConnect(host)}
            disabled={status === 'connecting' || !host}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all disabled:opacity-50"
          >
            {status === 'connecting'
              ? <><Loader2 size={16} className="animate-spin" /> Conectando...</>
              : <><Wifi size={16} /> Conectar al servidor</>
            }
          </button>

          <button
            onClick={onSkip}
            className="w-full py-3 text-slate-500 hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            Usar sin sincronización (solo local)
          </button>
        </div>

        {/* Instrucciones */}
        <div className="mt-6 bg-slate-900/50 rounded-[1.5rem] border border-slate-800 p-6 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cómo configurar el servidor</p>

          {[
            { icon: <Monitor size={14} />, step: '1', text: 'Descarga PocketBase en el PC maestro: pocketbase.io' },
            { icon: <Server size={14} />, step: '2', text: 'Ejecuta pocketbase.exe serve — queda escuchando en el puerto 8090' },
            { icon: <Wifi size={14} />, step: '3', text: 'Busca la IP del PC maestro (ipconfig en CMD) y ponla arriba' },
            { icon: <CheckCircle2 size={14} />, step: '4', text: 'Todos los terminales en el mismo WiFi se sincronizan automáticamente' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                {item.icon}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.text}</p>
            </div>
          ))}

          <a
            href="https://pocketbase.io/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest mt-2 transition-colors"
          >
            <ArrowRight size={12} /> Documentación PocketBase
          </a>
        </div>

      </div>
    </div>
  );
};

export default NetworkSetup;
