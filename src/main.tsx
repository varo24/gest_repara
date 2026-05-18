import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { logError } from './lib/errorLogger';

// ── Captura de errores globales ───────────────────────────────────────────────

window.addEventListener('error', (e) => {
  const error = e.error instanceof Error
    ? e.error
    : new Error(e.message || 'Unknown runtime error');

  if (!error.stack && e.filename) {
    error.stack = `${e.filename}:${e.lineno}:${e.colno}`;
  }

  logError('uncaught', error);
});

window.addEventListener('unhandledrejection', (e) => {
  const error = e.reason instanceof Error
    ? e.reason
    : new Error(typeof e.reason === 'string' ? e.reason : 'Unhandled promise rejection');

  logError('promise', error);
});

// ── Render ────────────────────────────────────────────────────────────────────

if (import.meta.env.DEV && window.location.pathname === '/dev/docs') {
  import('./dev/DocumentPreview').then(({ default: DocumentPreview }) => {
    createRoot(document.getElementById('root')!).render(<DocumentPreview />);
  });
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
