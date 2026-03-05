import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, ShieldCheck, Eye, EyeOff, Navigation } from 'lucide-react';

const PIN_KEY = 'reparapro_pin_hash';
const SESSION_KEY = 'reparapro_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 horas

// Hash simple para no guardar el PIN en texto plano
const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'reparapro_salt_2025');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
};

interface PinScreenProps {
  onUnlock: () => void;
  onFieldMode?: () => void;
}

type PinMode = 'unlock' | 'setup' | 'confirm';

const PinScreen: React.FC<PinScreenProps> = ({ onUnlock, onFieldMode }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mode, setMode] = useState<PinMode>('unlock');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const storedHash = localStorage.getItem(PIN_KEY);
    if (!storedHash) {
      setMode('setup');
      return;
    }
    // Verificar si hay sesión activa
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        if (Date.now() - session.time < SESSION_DURATION) {
          onUnlock();
          return;
        }
      } catch {}
    }
    setMode('unlock');
  }, []);

  const handleDigit = useCallback((digit: string) => {
    if (blocked) return;
    if (mode === 'confirm') {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + digit);
    } else {
      if (pin.length < 4) setPin(prev => prev + digit);
    }
  }, [pin, confirmPin, mode, blocked]);

  const handleDelete = useCallback(() => {
    if (mode === 'confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
    setError('');
  }, [mode]);

  // Auto-submit al completar 4 dígitos
  useEffect(() => {
    if (mode === 'unlock' && pin.length === 4) handleUnlock();
    if (mode === 'setup' && pin.length === 4) { setMode('confirm'); }
    if (mode === 'confirm' && confirmPin.length === 4) handleConfirmPin();
  }, [pin, confirmPin, mode]);

  const handleUnlock = async () => {
    const storedHash = localStorage.getItem(PIN_KEY);
    if (!storedHash) return;
    const inputHash = await hashPin(pin);
    if (inputHash === storedHash) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ time: Date.now() }));
      onUnlock();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setBlocked(true);
        setError('Demasiados intentos. Espera 30 segundos.');
        setTimeout(() => { setBlocked(false); setAttempts(0); setError(''); }, 30000);
      } else {
        setError(`PIN incorrecto. Intento ${newAttempts} de 5.`);
      }
      setPin('');
    }
  };

  const handleConfirmPin = async () => {
    if (pin === confirmPin) {
      const hash = await hashPin(pin);
      localStorage.setItem(PIN_KEY, hash);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ time: Date.now() }));
      onUnlock();
    } else {
      setError('Los PINs no coinciden. Inténtalo de nuevo.');
      setPin('');
      setConfirmPin('');
      setMode('setup');
    }
  };

  // Teclado físico
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleDelete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDigit, handleDelete]);

  const currentPin = mode === 'confirm' ? confirmPin : pin;

  const titles = {
    unlock: { title: 'Acceso Seguro', sub: 'Introduce tu PIN para continuar' },
    setup: { title: 'Crear PIN', sub: 'Elige un PIN de 4 dígitos para proteger el acceso' },
    confirm: { title: 'Confirmar PIN', sub: 'Repite el PIN para verificar' }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-5 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-600/30">
            <ShieldCheck size={36} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">ReparaPro Master</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Consola Técnica v3.0</p>
          </div>
        </div>

        {/* Card PIN */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 space-y-8 shadow-2xl">
          <div className="text-center">
            <h2 className="text-lg font-black text-white uppercase tracking-tight">{titles[mode].title}</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{titles[mode].sub}</p>
          </div>

          {/* Indicadores de dígitos */}
          <div className="flex items-center justify-center gap-5">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                  i < currentPin.length
                    ? 'bg-blue-500 scale-110 shadow-lg shadow-blue-500/40'
                    : 'bg-slate-700'
                }`}
              />
            ))}
            {showPin && currentPin && (
              <span className="text-white font-black text-xl ml-4 tracking-[0.5em]">{currentPin}</span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-2xl p-4 text-center">
              <p className="text-red-400 text-[11px] font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button
                key={n}
                onClick={() => handleDigit(n.toString())}
                disabled={blocked}
                className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-blue-700 active:scale-95 text-white text-xl font-black rounded-2xl transition-all border border-slate-700 disabled:opacity-30"
              >
                {n}
              </button>
            ))}
            {/* Mostrar/ocultar */}
            <button
              onClick={() => setShowPin(p => !p)}
              className="h-16 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all border border-slate-700 flex items-center justify-center"
            >
              {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button
              onClick={() => handleDigit('0')}
              disabled={blocked}
              className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-blue-700 active:scale-95 text-white text-xl font-black rounded-2xl transition-all border border-slate-700 disabled:opacity-30"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              className="h-16 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-400 rounded-2xl transition-all border border-slate-700 flex items-center justify-center"
            >
              <Delete size={20} />
            </button>
          </div>
        </div>

        {/* Cambiar PIN si ya está configurado */}
        {mode === 'unlock' && (
          <button
            onClick={() => {
              setMode('setup');
              setPin('');
              setError('');
            }}
            className="w-full text-center text-[10px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors py-2"
          >
            ¿Olvidaste el PIN? Restablecer acceso
          </button>
        )}

        {/* Modo Campo button */}
        {onFieldMode && (
          <button
            onClick={onFieldMode}
            className="w-full flex items-center justify-center gap-3 py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 shadow-xl shadow-amber-500/20 mt-2"
          >
            <Navigation size={18} />
            Modo Campo — Técnico a Domicilio
          </button>
        )}
      </div>
    </div>
  );
};

export default PinScreen;
