import React, { createContext, useContext, useEffect, useState } from 'react';
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

export const SyncStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>(
    // Initial state: offline immediately if the browser has no network
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : storage.getSyncStatus()
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(storage.getLastSyncTs());

  useEffect(() => {
    // Subscribe to dataService status changes (Firestore-level: synced / syncing / offline)
    const unsubDS = storage.onStatusChange((s) => {
      setStatus(s);
      if (s === 'synced') setLastSyncAt(Date.now());
    });

    // Subscribe directly to browser connectivity events for immediate UI response.
    // dataService also listens, but its listeners are registered after async init,
    // so a brief window exists where events could be missed.
    const handleOffline = () => setStatus('offline');
    const handleOnline = () => {
      // Show 'syncing' right away; dataService will broadcast 'synced' once Firestore
      // re-connects and flushes pending writes.
      setStatus('syncing');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      unsubDS();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <SyncStatusContext.Provider value={{ status, lastSyncAt }}>
      {children}
    </SyncStatusContext.Provider>
  );
};
