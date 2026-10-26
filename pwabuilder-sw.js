// VALIS VIGIA — Service Worker v3 (offline + notificações)
const CACHE = "pwabuilder-offline-v3";
const offlineFallbackPage = "index.html";

importScripts("https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js");

// Firebase Messaging em background (app fechado)
try {
  importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");
  firebase.initializeApp({
    apiKey: "AIzaSyBpIuf5yokj51txTYgnER7T27IamB_pdLo",
    authDomain: "valis-vigia-ltda-d0263.firebaseapp.com",
    projectId: "valis-vigia-ltda-d0263",
    storageBucket: "valis-vigia-ltda-d0263.firebasestorage.app",
    messagingSenderId: "963853721440",
    appId: "1:963853721440:web:d1d1453d053f064063c805"
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(function(payload) {
    const n = (payload && payload.notification) || {};
    const d = (payload && payload.data) || {};
    const title = n.title || d.title || "VALIS VIGIA";
    const body = n.body || d.body || d.texto || d.message || "";
    return self.registration.showNotification(title, {
      body: String(body),
      icon: "/launchericon-192x192.png",
      badge: "/launchericon-96x96.png",
      tag: d.tag || "valis-fcm",
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [220, 80, 220, 80, 220],
      data: { url: d.url || "/", fullBody: String(body) }
    });
  });
} catch (e) {
  console.warn("[VALIS SW] FCM background init:", e);
}

function showValisNotification(d) {
  d = d || {};
  const title = d.title || "VALIS VIGIA";
  const body = d.body != null ? String(d.body) : "";
  return self.registration.showNotification(title, {
    body: body,
    icon: d.icon || "/launchericon-192x192.png",
    badge: d.badge || "/launchericon-96x96.png",
    tag: d.tag || ("valis-" + Date.now()),
    renotify: true,
    requireInteraction: d.requireInteraction !== false,
    silent: false,
    vibrate: d.vibrate || [220, 80, 220, 80, 220],
    timestamp: Date.now(),
    data: Object.assign({ url: "/", fullBody: body }, d.data || {})
  });
}

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data.type === "SHOW_NOTIFICATION") {
    event.waitUntil(showValisNotification(event.data.payload || {}));
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(offlineFallbackPage).catch(function() {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

if (workbox && workbox.navigationPreload && workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          try { if (client.navigate) client.navigate(targetUrl); } catch (e) {}
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// Push genérico (FCM / Web Push)
self.addEventListener("push", (event) => {
  let title = "VALIS VIGIA";
  let body = "Nova notificação";
  let tag = "valis-push";
  let url = "/";
  try {
    if (event.data) {
      const raw = event.data.json();
      const n = (raw && raw.notification) || {};
      const d = (raw && raw.data) || {};
      title = n.title || d.title || raw.title || title;
      body = n.body || d.body || d.texto || d.message || raw.body || body;
      tag = d.tag || raw.tag || tag;
      url = d.url || (raw.fcmOptions && raw.fcmOptions.link) || url;
    }
  } catch (e) {
    try { body = event.data.text(); } catch (e2) {}
  }
  event.waitUntil(showValisNotification({
    title: title,
    body: body,
    tag: tag,
    requireInteraction: true,
    data: { url: url, fullBody: body }
  }));
});
