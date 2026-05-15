import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { storage, SyncStatus } from './dataService';

interface SyncStatusContextValue {
  status: SyncStatus;
  lastSyncAt: number | null;
}

const SyncStatusContext = createContext<SyncStatusContextValue>({
  status: 'syncing',
  lastSyncAt: null,
});

export const useSyncStatus = () => useContext(SyncStatusContext);

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastVariant = 'lost' | 'restored';

interface ToastState { msg: string; variant: ToastVariant }

const TOAST_COLORS: Record<ToastVariant, string> = {
  lost:     '#ef5350',
  restored: '#4caf50',
};

const SyncToast: React.FC<{ toast: ToastState }> = ({ toast }) => (
  <div
    className="fixed bottom-6 left-1/2 z-[600] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl pointer-events-none"
    style={{
      transform: 'translateX(-50%)',
      background: '#111',
      border: `1px solid ${TOAST_COLORS[toast.variant]}40`,
      animation: 'rp-slide-up 0.25s ease both',
    }}
  >
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: TOAST_COLORS[toast.variant] }}
    />
    <p
      className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap"
      style={{ color: TOAST_COLORS[toast.variant] }}
    >
      {toast.msg}
    </p>
  </div>
);

// ── Provider ──────────────────────────────────────────────────────────────────

// Minimum time (ms) to keep a perceivable intermediate state before jumping to 'synced'
const MIN_SYNCING_MS = 2000;

export const SyncStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : storage.getSyncStatus()
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(storage.getLastSyncTs());
  const [toast, setToast] = useState<ToastState | null>(null);

  // When the browser went online (used to calculate minimum syncing display time)
  const onlineAt = useRef<number | null>(null);
  // Whether the current or last connectivity dip was user-visible (to gate "restored" toast)
  const wasOffline = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (variant: ToastVariant) => {
    const msg = variant === 'lost'
      ? 'Conexión perdida — trabajando sin conexión'
      : 'Conexión restaurada ✓';
    setToast({ msg, variant });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // ── dataService subscriber ─────────────────────────────────────────────
    // dataService drives the authoritative Firestore status. When it signals
    // 'synced', we enforce the minimum display time for the syncing state so
    // the transition is always perceivable.
    const unsubDS = storage.onStatusChange((s) => {
      if (s === 'synced') {
        const elapsed = onlineAt.current !== null ? Date.now() - onlineAt.current : Infinity;
        const remaining = Math.max(0, MIN_SYNCING_MS - elapsed);
        const hadOffline = wasOffline.current;
        onlineAt.current = null;
        wasOffline.current = false;

        setTimeout(() => {
          setStatus('synced');
          setLastSyncAt(Date.now());
          if (hadOffline) showToast('restored');
        }, remaining);
      } else if (s === 'offline') {
        // dataService confirmed offline (heartbeat / reconnect failed)
        onlineAt.current = null;
        if (!wasOffline.current) {
          wasOffline.current = true;
          showToast('lost');
        }
        setStatus('offline');
      } else {
        // 'syncing' — only apply if we are not already in a timed syncing phase
        setStatus(s);
      }
    });

    // ── Direct browser listeners ───────────────────────────────────────────
    // Registered synchronously so they fire even if dataService.init() is
    // still awaiting its first testFirestore/pullAll.
    const handleOffline = () => {
      wasOffline.current = true;
      onlineAt.current = null;
      setStatus('offline');
      showToast('lost');
    };

    const handleOnline = () => {
      onlineAt.current = Date.now();
      setStatus('syncing');
      // dataService will testFirestore and broadcast 'synced' when ready;
      // the subscriber above enforces the minimum display time.
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    return () => {
      unsubDS();
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <SyncStatusContext.Provider value={{ status, lastSyncAt }}>
      {children}
      {toast && <SyncToast toast={toast} />}
    </SyncStatusContext.Provider>
  );
};
