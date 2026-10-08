// VALIS VIGIA — Service Worker (PWA Builder + notificações com som / segundo plano)
// Workbox offline + handlers de notificação

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "pwabuilder-page";
const offlineFallbackPage = "index.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(offlineFallbackPage).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

if (workbox && workbox.navigationPreload && workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;
        return await fetch(event.request);
      } catch (error) {
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp || Response.error();
      }
    })());
  }
});

// ---- Notificações em segundo plano / app fechado (quando possível) ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          try {
            if (client.navigate) client.navigate(targetUrl);
          } catch (e) {}
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', () => {});

// Suporte a Web Push (se no futuro houver FCM / servidor push)
self.addEventListener('push', (event) => {
  let data = { title: 'VALIS VIGIA', body: 'Nova mensagem', icon: '/launchericon-192x192.png' };
  try {
    if (event.data) {
      const json = event.data.json();
      data = Object.assign(data, json);
    }
  } catch (e) {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch (e2) {}
  }
  const options = {
    body: data.body || '',
    icon: data.icon || '/launchericon-192x192.png',
    badge: data.badge || '/launchericon-96x96.png',
    tag: data.tag || 'valis-push',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'VALIS VIGIA', options));
});
