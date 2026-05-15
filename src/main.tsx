import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { logError } from './lib/errorLogger';

// ── Captura de errores globales ───────────────────────────────────────────────

window.addEventListener('error', (e) => {
  console.log('[main] window.error disparado:', e.message);
  const error = e.error instanceof Error
    ? e.error
    : new Error(e.message || 'Unknown runtime error');

  if (!error.stack && e.filename) {
    error.stack = `${e.filename}:${e.lineno}:${e.colno}`;
  }

  logError('uncaught', error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.log('[main] window.unhandledrejection disparado:', e.reason);
  const error = e.reason instanceof Error
    ? e.reason
    : new Error(typeof e.reason === 'string' ? e.reason : 'Unhandled promise rejection');

  logError('promise', error);
});

// ── Helpers de diagnóstico en producción ─────────────────────────────────────
// TEMPORAL — eliminar tras confirmar que el logger escribe en Firestore.
//
// Uso desde DevTools Console (producción o dev):
//   window.__testLogDirect()   → llama logError() directamente
//   window.__testError()       → dispara window.unhandledrejection real
//
// Asignamos a una variable local primero para anclar el código al bundle
// y evitar que Terser/Rollup los elimine como dead code.

const _w = window as Window & {
  __testLogDirect?: () => Promise<void>;
  __testError?: () => void;
};

_w.__testLogDirect = async () => {
  await logError('promise', new Error('__testLogDirect manual'));
};

_w.__testError = () => {
  // setTimeout garantiza que la promesa se rechaza en el contexto de la página
  // (no de DevTools Console), lo que sí dispara window.unhandledrejection.
  setTimeout(() => { void Promise.reject(new Error('__testError manual')); }, 100);
};

// Este log confirma que main.tsx cargó y los helpers están registrados.
// También ancla _w al bundle — Terser no eliminará código referenciado aquí.
console.log('[main] listeners OK | helpers:', typeof _w.__testLogDirect, typeof _w.__testError);

// ── Render ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
