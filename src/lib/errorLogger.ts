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

export async function logError(
  type: ErrorType,
  error: Error | null,
  overrides: { stack?: string } = {},
): Promise<void> {
  if (sessionCount >= MAX_PER_SESSION) return;

  const message = error?.message || 'Unknown error';
  // overrides.stack permite al ErrorBoundary incluir el componentStack
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
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown',
  };

  try {
    await addDoc(collection(db, 'error_logs'), entry);
  } catch {
    // Silencioso — nunca lanzamos desde un logger de errores
  }
}
