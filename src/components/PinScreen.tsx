import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import { AppSettings } from '../types';
import {
  verifyPin, setPin, saveSession,
  isBiometricAvailable, hasBiometricRegistered,
  registerBiometric, authenticateBiometric,
} from '../lib/pinAuth';

const MAX_ATTEMPTS  = 3;
const LOCKOUT_SECS  = 30;

interface PinScreenProps {
  onUnlock: () => void;
  onFieldMode?: () => void;
  settings?: Pick<AppSettings, 'appName' | 'logoUrl'>;
}

type Mode = 'unlock' | 'setup' | 'confirm';

const Dot: React.FC<{ filled: boolean }> = ({ filled }) => (
  <div
    style={{
      width: 18, height: 18, borderRadius: '50%',
      background: filled ? '#fff' : 'rgba(255,255,255,0.2)',
      transform: filled ? 'scale(1.15)' : 'scale(1)',
      transition: 'all 0.15s',
      boxShadow: filled ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
    }}
  />
);

const Key: React.FC<{ label: React.ReactNode; onPress: () => void; disabled?: boolean; variant?: 'default' | 'delete' | 'bio' }> = ({
  label, onPress, disabled, variant = 'default',
}) => {
  const bg = variant === 'delete' ? 'rgba(255,255,255,0.08)'
           : variant === 'bio'    ? 'rgba(255,255,255,0.08)'
           : 'rgba(255,255,255,0.12)';
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={{
        height: 68, borderRadius: 20, border: 'none',
        background: bg, color: '#fff',
        fontSize: 26, fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        transition: 'all 0.12s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      onPointerDown={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)'; }}
      onPointerUp={e => { (e.currentTarget as HTMLElement).style.background = bg; }}
      onPointerLeave={e => { (e.currentTarget as HTMLElement).style.background = bg; }}
    >
      {label}
    </button>
  );
};

const PinScreen: React.FC<PinScreenProps> = ({ onUnlock, onFieldMode, settings }) => {
  const [pin, setCurrentPin]   = useState('');
  const [confirm, setConfirm]  = useState('');
  const [mode, setMode]        = useState<Mode>('unlock');
  const [error, setError]      = useState('');
  const [attempts, setAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);   // seconds remaining
  const [bioAvail, setBioAvail]   = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const hash = localStorage.getItem('reparapro_pin_hash');
    setMode(hash ? 'unlock' : 'setup');
    isBiometricAvailable().then(ok => setBioAvail(ok));
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Lockout countdown ─────────────────────────────────────────────────────
  const startLockout = useCallback(() => {
    setCountdown(LOCKOUT_SECS);
    timerRef.current = setInterval(() => {
      setCountdown(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setAttempts(0);
          setError('');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const locked = countdown > 0;

  // ── Input logic ───────────────────────────────────────────────────────────
  const activePin   = mode === 'confirm' ? confirm : pin;
  const setActive   = mode === 'confirm' ? setConfirm : setCurrentPin;

  const pushDigit = useCallback((d: string) => {
    if (locked) return;
    setActive(prev => prev.length < 4 ? prev + d : prev);
    setError('');
  }, [locked, setActive]);

  const popDigit = useCallback(() => {
    setActive(prev => prev.slice(0, -1));
    setError('');
  }, [setActive]);

  // ── Auto-submit ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePin.length !== 4) return;
    const timeout = setTimeout(async () => {
      if (mode === 'setup') {
        setMode('confirm');
        return;
      }
      if (mode === 'confirm') {
        if (confirm === pin) {
          await setPin(pin);
          saveSession();
          onUnlock();
        } else {
          setError('Los PINs no coinciden. Inténtalo de nuevo.');
          setCurrentPin('');
          setConfirm('');
          setMode('setup');
        }
        return;
      }
      // unlock mode
      const ok = await verifyPin(pin);
      if (ok) {
        saveSession();
        onUnlock();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setCurrentPin('');
        if (next >= MAX_ATTEMPTS) {
          setError(`Demasiados intentos fallidos.`);
          startLockout();
        } else {
          setError(`PIN incorrecto. ${MAX_ATTEMPTS - next} intento${MAX_ATTEMPTS - next !== 1 ? 's' : ''} restante${MAX_ATTEMPTS - next !== 1 ? 's' : ''}.`);
        }
      }
    }, 80);
    return () => clearTimeout(timeout);
  }, [activePin]);

  // ── Teclado físico ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') pushDigit(e.key);
      if (e.key === 'Backspace') popDigit();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pushDigit, popDigit]);

  // ── Biometric ─────────────────────────────────────────────────────────────
  const handleBiometric = async () => {
    setBioLoading(true);
    try {
      if (!hasBiometricRegistered()) {
        // First time: verify PIN first, then register
        setError('Primero desbloquea con PIN para activar la biometría.');
        setBioLoading(false);
        return;
      }
      await authenticateBiometric();
      saveSession();
      onUnlock();
    } catch {
      setError('Autenticación biométrica cancelada o no disponible.');
    } finally {
      setBioLoading(false);
    }
  };

  // ── Titles ────────────────────────────────────────────────────────────────
  const title = mode === 'unlock'  ? 'Introduce tu PIN'
              : mode === 'setup'   ? 'Crea un PIN de acceso'
              : 'Confirma el PIN';
  const sub   = mode === 'unlock'  ? 'Necesitas el PIN para acceder'
              : mode === 'setup'   ? '4 dígitos para proteger la app'
              : 'Repite el PIN elegido';

  const appInitial = (settings?.appName || 'G').charAt(0).toUpperCase();

  return (
    <div
      style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #1b5e20 0%, #2d6a2d 50%, #1a472a 100%)',
        padding: '24px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {settings?.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Logo"
              style={{ width: 80, height: 80, borderRadius: 16, margin: '0 auto 12px', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: 16, margin: '0 auto 12px',
              background: 'rgba(255,255,255,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 36, fontWeight: 900, color: '#fff',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              {appInitial}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {settings?.appName || 'Gestrepara'}
          </h1>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(16px)',
          borderRadius: 32, padding: '36px 28px',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
            <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sub}</p>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 28 }}>
            {[0,1,2,3].map(i => <Dot key={i} filled={i < activePin.length} />)}
          </div>

          {/* Error / countdown */}
          {(error || locked) && (
            <div style={{
              background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 16, padding: '12px 16px', textAlign: 'center', marginBottom: 20,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {locked ? `Bloqueado — espera ${countdown}s` : error}
              </p>
            </div>
          )}

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <Key key={n} label={n} onPress={() => pushDigit(String(n))} disabled={locked} />
            ))}
            {/* bottom row: bio | 0 | delete */}
            <Key
              variant="bio"
              label={bioAvail && hasBiometricRegistered()
                ? (bioLoading ? '…' : <Fingerprint size={24} />)
                : <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bio</span>
              }
              onPress={bioAvail && hasBiometricRegistered() && !bioLoading ? handleBiometric : () => {}}
              disabled={locked || !bioAvail || !hasBiometricRegistered()}
            />
            <Key label={0} onPress={() => pushDigit('0')} disabled={locked} />
            <Key variant="delete" label={<Delete size={22} />} onPress={popDigit} disabled={locked} />
          </div>
        </div>

        {/* Reset link */}
        {mode === 'unlock' && (
          <button
            onClick={() => { setMode('setup'); setCurrentPin(''); setError(''); setAttempts(0); }}
            style={{
              width: '100%', marginTop: 20, background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            ¿Olvidaste el PIN? Restablecer acceso
          </button>
        )}
      </div>
    </div>
  );
};

export default PinScreen;
