// errorLogger.ts — escribe errores en Firestore 'error_logs' directamente,
// sin pasar por dataService para que funcione incluso si dataService falla.
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export type ErrorType = 'boundary' | 'uncaught' | 'promise';

const IGNORE_STACK = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];
const IGNORE_MSG   = ['ResizeObserver loop', 'Script error.', 'Non-Error promise rejection'];

function shouldIgnore(message: string, stack: string): boolean {
  if (!message && !stack) return true;
  const combined = `${message}\n${stack}`;
  if (IGNORE_STACK.some(p => combined.includes(p))) return true;
  if (IGNORE_MSG.some(p => message.startsWith(p))) return true;
  return false;
}

let sessionCount = 0;
const MAX_PER_SESSION = 8;

export async function logError(
  type: ErrorType,
  error: Error | null,
  overrides: { stack?: string } = {},
): Promise<void> {
  if (sessionCount >= MAX_PER_SESSION) return;

  const message = error?.message || 'Unknown error';
  const stack = (overrides.stack ?? error?.stack ?? '').slice(0, 500);

  if (shouldIgnore(message, stack)) return;

  sessionCount++;

  const entry = {
    timestamp:  new Date().toISOString(),
    type,
    message,
    stack,
    url:        typeof window    !== 'undefined' ? window.location.pathname : '/',
    userAgent:  typeof navigator !== 'undefined' ? navigator.userAgent       : '',
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
  };

  try {
    const ref = await addDoc(collection(db, 'error_logs'), entry);
    console.log('[errorLogger] ✅ escrito OK — doc id:', ref.id);
  } catch (e: unknown) {
    console.error('[errorLogger] ❌ addDoc FALLÓ:', (e as any)?.code, (e as any)?.message);
  }
}
