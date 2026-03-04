
import React, { useState } from 'react';
import { HardDrive, ArrowRight, Loader2, Wrench, ShieldCheck } from 'lucide-react';

interface ActivationScreenProps {
  onActivate: (name: string) => void;
}

const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivate }) => {
  const [name, setName] = useState('Mi Taller Local');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    await onActivate(name);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative z-10">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-10 mx-auto shadow-xl shadow-blue-600/20">
          <Wrench size={32} className="text-white" />
        </div>
        
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Puesto Maestro ReparaPro</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Configuración del Almacenamiento Local</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre del Taller / Estación</label>
            <input 
              type="text" 
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-blue-500 transition-all placeholder:opacity-20"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Taller Central RTech"
            />
          </div>

          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex items-start gap-4">
            <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
            <div className="space-y-1">
              <p className="text-[10px] text-white font-black uppercase tracking-widest">Privacidad 100% Offline</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">
                Este sistema no utiliza la nube. Todos los datos de clientes, RMAs y presupuestos se guardan exclusivamente en el disco duro de este ordenador.
              </p>
            </div>
          </div>

          <button 
            onClick={handleStart}
            disabled={loading || !name.trim()}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
            Inicializar Disco y Empezar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivationScreen;
