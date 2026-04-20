const CACHE_NAME = 'kajdogaja-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

const API_CACHE_NAME = 'kajdogaja-api-v1';
const API_CACHE_DURATION = 5 * 60 * 1000;

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[ServiceWorker] Installed');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      console.log('[ServiceWorker] Activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(fetch(request));
  }
});

const handleStaticRequest = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }
    throw error;
  }
};

const handleApiRequest = async (request) => {
  if (request.method !== 'GET') {
    return fetch(request);
  }
  
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    const cachedTime = cachedResponse.headers.get('x-cached-time');
    if (cachedTime && Date.now() - cachedTime < API_CACHE_DURATION) {
      return cachedResponse;
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('x-cached-time', Date.now());
      
      const body = await responseToCache.text();
      const cachedBody = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      
      cache.put(request, cachedBody);
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
};

self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'KajDogaja';
  const options = {
    body: data.body || 'Nova obvestila na voljo',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'kajdogaja-notification',
    renotify: true,
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      console.log('[ServiceWorker] Notification shown');
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skip waiting');
    self.skipWaiting();
  }
});
