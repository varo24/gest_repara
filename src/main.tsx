import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { logError } from './lib/errorLogger';

// ── Captura de errores globales ───────────────────────────────────────────────
// NOTA: los listeners se registran síncronamente ANTES del render.
//
// ⚠️  TRUCO DE PRUEBA: Promise.reject() ejecutado en DevTools Console NO dispara
//   window.unhandledrejection — Chrome intercepta promesas de la consola antes
//   de que lleguen al evento global. Usa window.__testError() desde consola.

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

// ── Helper de prueba (disponible en consola como window.__testError()) ────────
// Inyecta la promesa rechazada desde el contexto de la APP (no de la consola),
// lo que sí activa el evento unhandledrejection correctamente.
(window as any).__testError = () => {
  // Crea la promesa dentro de un setTimeout para que sea "código de la app"
  setTimeout(() => { void Promise.reject(new Error('__testError manual')); }, 0);
};

(window as any).__testLogDirect = async () => {
  // Llama al logger directamente sin pasar por el listener
  await logError('promise', new Error('__testLogDirect manual'));
};

// ── Render ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
