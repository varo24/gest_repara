// ReparaPro Master - Service Worker v5.0
const CACHE_NAME = 'reparapro-v5';
const OFFLINE_FALLBACK = '/index.html';

const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match(OFFLINE_FALLBACK)))
  );
});

// ── Notification click → focus app and send navigation intent ────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const existing = clientList.find(c => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.postMessage({ type: 'NOTIF_CLICK', data });
        } else {
          self.clients.openWindow('/').then(client => {
            if (client) {
              // delay to let the app bootstrap before sending the message
              setTimeout(() => client.postMessage({ type: 'NOTIF_CLICK', data }), 1500);
            }
          });
        }
      })
  );
});
