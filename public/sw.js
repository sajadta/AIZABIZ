// AIZABIZ PWA Service Worker
const CACHE_NAME = 'aizabiz-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle non-GET or dynamic API / WebSockets
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('/api/') || url.includes('/socket.io/')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      return cached || new Response('<!DOCTYPE html><html><body><h1>AIZABIZ Offline</h1></body></html>', {
        headers: { 'Content-Type': 'text/html' }
      });
    })
  );
});
