import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

// Node 25 ships an experimental localStorage that is broken without --localstorage-file.
// Replace it with a simple in-memory implementation before any test runs.
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem:    (k: string) => localStorageData[k] ?? null,
  setItem:    (k: string, v: string) => { localStorageData[k] = String(v); },
  removeItem: (k: string) => { delete localStorageData[k]; },
  clear:      () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
  get length() { return Object.keys(localStorageData).length; },
  key:        (i: number) => Object.keys(localStorageData)[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Notification API mock
function MockNotification(this: unknown, _title: string, _opts?: NotificationOptions) {}
MockNotification.permission = 'granted' as NotificationPermission;
MockNotification.requestPermission = vi.fn().mockResolvedValue('granted');
Object.defineProperty(globalThis, 'Notification', {
  value: MockNotification,
  writable: true,
  configurable: true,
});

// navigator.serviceWorker mock
const showNotification = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({ showNotification }),
    register: vi.fn(),
  },
  writable: true,
  configurable: true,
});

afterEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});
