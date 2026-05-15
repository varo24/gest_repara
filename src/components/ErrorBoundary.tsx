import React from 'react';
import { logError } from '../lib/errorLogger';

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Combine JS stack + React component stack for maximum debuggability
    const fullStack = [
      error.stack || '',
      info.componentStack ? `\nComponent stack:${info.componentStack}` : '',
    ].join('').slice(0, 500);

    logError('boundary', error, { stack: fullStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: '#f5f5f5' }}
      >
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center space-y-6">

          {/* Icono */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: '#fef2f2' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" width="30" height="30"
              viewBox="0 0 24 24" fill="none" stroke="#dc2626"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          {/* Mensaje */}
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Algo salió mal
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Tus datos están seguros.<br />El error ha sido registrado automáticamente.
            </p>
            {this.state.error?.message && (
              <p className="mt-3 px-3 py-2 rounded-xl text-[10px] font-mono text-left break-all"
                style={{ background: '#f8f8f8', color: '#999' }}>
                {this.state.error.message.slice(0, 140)}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white"
              style={{ background: '#2e7d32' }}
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors"
              style={{ background: '#f1f5f9', color: '#64748b' }}
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
