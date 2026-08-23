const CACHE_NAME = "aizabiz-pwa-cache-v1";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' || event.request.method === 'GET') {
    // Only cache static assets and don't intercept API calls
    if (event.request.url.includes('/api/')) {
       return;
    }
    
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});
