// VALIS VIGIA — Service Worker (PWA + notificações segundo plano)
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          try { if (client.navigate) client.navigate(targetUrl); } catch (e) {}
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'VALIS VIGIA', body: 'Nova mensagem', icon: '/launchericon-192x192.png' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    try { data.body = event.data ? event.data.text() : data.body; } catch (e2) {}
  }
  event.waitUntil(self.registration.showNotification(data.title || 'VALIS VIGIA', {
    body: data.body || '',
    icon: data.icon || '/launchericon-192x192.png',
    badge: data.badge || '/launchericon-96x96.png',
    tag: data.tag || 'valis-push',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' }
  }));
});
