// FoodLink Mobile PWA Service Worker
const CACHE_NAME = 'foodlink-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: Cache critical static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[FoodLink PWA SW] Caching app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[FoodLink PWA SW] Pre-caching warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Stale-While-Revalidate strategy for static resources
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip Firebase/API POST requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip chrome-extension, API endpoints, or firestore websockets
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.protocol.startsWith('chrome')
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Return cached response if network fails
            return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      });
    })
  );
});
