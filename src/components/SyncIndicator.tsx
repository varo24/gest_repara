import React, { useState, useEffect } from 'react';
import { Loader2, CloudOff } from 'lucide-react';
import { useSyncStatus } from '../lib/syncStatusContext';

function timeAgo(ts: number | null): string {
  if (!ts) return 'nunca';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 10) return 'ahora mismo';
  if (secs < 60) return `hace ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)}h`;
}

interface Props {
  variant?: 'dot' | 'full';
  onClick?: () => Promise<void>;
  disabled?: boolean;
}

const SyncIndicator: React.FC<Props> = ({ variant = 'dot', onClick, disabled }) => {
  const { status, lastSyncAt } = useSyncStatus();
  const [showTip, setShowTip] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const color =
    status === 'synced'  ? '#4caf50' :
    status === 'syncing' ? '#f57f17' : '#ef5350';

  const label =
    status === 'synced'  ? 'Sincronizado' :
    status === 'syncing' ? 'Sincronizando...' : 'Sin conexión';

  const Dot = () => {
    if (status === 'syncing') return <Loader2 size={10} style={{ color, transition: 'color 0.3s ease' }} className="animate-spin shrink-0" />;
    if (status === 'offline') return <CloudOff size={10} style={{ color, transition: 'color 0.3s ease' }} className="shrink-0" />;
    return (
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color, transition: 'background-color 0.3s ease' }}
      />
    );
  };

  const inner = (
    <div
      className={`flex items-center gap-1.5 ${variant === 'full' ? 'px-3 py-2' : 'p-1.5'}`}
      style={{ transition: 'all 0.3s ease' }}
    >
      <Dot />
      {variant === 'full' && (
        <span
          className="sidebar-sync-label sidebar-label text-[10px] font-black uppercase tracking-widest"
          style={{ color, transition: 'color 0.3s ease' }}
        >
          {label}
        </span>
      )}
    </div>
  );

  const tooltip = showTip && (
    <div
      className="absolute bottom-full mb-2 right-0 z-[500] whitespace-nowrap rounded-xl px-3 py-2 pointer-events-none"
      style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', minWidth: 152 }}
    >
      <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color }}>{label}</p>
      <p className="text-[9px]" style={{ color: '#666' }}>
        Última sync: {timeAgo(lastSyncAt)}
      </p>
    </div>
  );

  if (onClick) {
    return (
      <div className="relative" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
        <button
          onClick={onClick}
          disabled={disabled ?? status === 'syncing'}
          className="sync-btn w-full flex items-center"
          style={{ background: '#161616', border: '1px solid #2a2a2a', transition: 'opacity 0.2s ease' }}
        >
          {inner}
        </button>
        {tooltip}
      </div>
    );
  }

  return (
    <div className="relative" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
      {inner}
      {tooltip}
    </div>
  );
};

export default SyncIndicator;
