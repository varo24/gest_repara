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
  const [status, setStatus] = useState<SyncStatus>(storage.getSyncStatus());
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(storage.getLastSyncTs());

  useEffect(() => {
    return storage.onStatusChange((s) => {
      setStatus(s);
      if (s === 'synced') setLastSyncAt(Date.now());
    });
  }, []);

  return (
    <SyncStatusContext.Provider value={{ status, lastSyncAt }}>
      {children}
    </SyncStatusContext.Provider>
  );
};
