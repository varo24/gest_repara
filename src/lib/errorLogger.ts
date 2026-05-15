// errorLogger.ts — escribe errores en Firestore 'error_logs' directamente,
// sin pasar por dataService para que funcione incluso si dataService falla.
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export type ErrorType = 'boundary' | 'uncaught' | 'promise';

// Patrones de stack/message que ignoramos — no son bugs de la app
const IGNORE_STACK = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];
const IGNORE_MSG   = ['ResizeObserver loop', 'Script error.', 'Non-Error promise rejection'];

function shouldIgnore(message: string, stack: string): boolean {
  if (!message && !stack) return true;
  const combined = `${message}\n${stack}`;
  if (IGNORE_STACK.some(p => combined.includes(p))) return true;
  if (IGNORE_MSG.some(p => message.startsWith(p))) return true;
  return false;
}

// Cap de errores por sesión — evita bucles de logging si el propio logger falla
let sessionCount = 0;
const MAX_PER_SESSION = 8;

// ── DEBUG MODE ────────────────────────────────────────────────────────────────
// Activo temporalmente para diagnosticar por qué no llegan docs a Firestore.
// Eliminar tras confirmar que funciona.
const DBG = true;
const dbg = (...args: unknown[]) => { if (DBG) console.log('[errorLogger]', ...args); };
// ─────────────────────────────────────────────────────────────────────────────

export async function logError(
  type: ErrorType,
  error: Error | null,
  overrides: { stack?: string } = {},
): Promise<void> {
  dbg('logError() llamado —', 'type:', type, '| message:', error?.message ?? '(null)');

  if (sessionCount >= MAX_PER_SESSION) {
    dbg('cap de sesión alcanzado (', sessionCount, '/ ', MAX_PER_SESSION, ') — ignorando');
    return;
  }

  const message = error?.message || 'Unknown error';
  const stack = (overrides.stack ?? error?.stack ?? '').slice(0, 500);

  if (shouldIgnore(message, stack)) {
    dbg('shouldIgnore=true — descartado. message:', message);
    return;
  }

  sessionCount++;
  dbg('sessionCount ahora:', sessionCount);

  const entry = {
    timestamp:  new Date().toISOString(),
    type,
    message,
    stack,
    url:        typeof window    !== 'undefined' ? window.location.pathname : '/',
    userAgent:  typeof navigator !== 'undefined' ? navigator.userAgent       : '',
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown',
  };

  dbg('entry a guardar:', entry);
  dbg('db instance (debe ser "gestrepara"):', (db as any)?._databaseId?.database ?? db);

  try {
    dbg('intentando addDoc en error_logs…');
    const ref = await addDoc(collection(db, 'error_logs'), entry);
    dbg('✅ escrito OK — doc id:', ref.id);
  } catch (e: unknown) {
    // NUNCA silencioso durante depuración — muestra el error real
    console.error('[errorLogger] ❌ addDoc FALLÓ:', e);
    console.error('[errorLogger] code:', (e as any)?.code);
    console.error('[errorLogger] message:', (e as any)?.message);
  }
}
