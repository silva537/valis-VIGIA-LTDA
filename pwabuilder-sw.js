// VALIS VIGIA — Service Worker (offline + notificações em 2º plano)
const CACHE = "pwabuilder-offline-v2";
const offlineFallbackPage = "index.html";
const AVISO_KEY = "valis_sw_last_aviso";
const MSG_KEY = "valis_sw_last_msg";

importScripts("https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js");

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  // Página pede para exibir notificação (app em background, SW ativo)
  if (event.data.type === "SHOW_NOTIFICATION") {
    const d = event.data.payload || {};
    event.waitUntil(
      self.registration.showNotification(d.title || "VALIS VIGIA", {
        body: d.body || "",
        icon: d.icon || "/launchericon-192x192.png",
        badge: d.badge || "/launchericon-96x96.png",
        tag: d.tag || "valis-msg",
        renotify: true,
        requireInteraction: !!d.requireInteraction,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: d.data || { url: "/" }
      })
    );
  }
  if (event.data.type === "STORE_META") {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE);
          if (event.data.avisoEm != null) {
            await cache.put(
              new Request("https://valis.local/meta-aviso"),
              new Response(String(event.data.avisoEm))
            );
          }
          if (event.data.msgStamp != null) {
            await cache.put(
              new Request("https://valis.local/meta-msg"),
              new Response(String(event.data.msgStamp))
            );
          }
        } catch (e) {}
      })()
    );
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(offlineFallbackPage).catch(() => {}))
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
    event.respondWith(
      (async () => {
        try {
          const preloadResp = await event.preloadResponse;
          if (preloadResp) return preloadResp;
          return await fetch(event.request);
        } catch (error) {
          const cache = await caches.open(CACHE);
          const cachedResp = await cache.match(offlineFallbackPage);
          return cachedResp || Response.error();
        }
      })()
    );
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
          try {
            if (client.navigate) client.navigate(targetUrl);
          } catch (e) {}
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "VALIS VIGIA",
    body: "Nova mensagem",
    icon: "/launchericon-192x192.png"
  };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch (e2) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "VALIS VIGIA", {
      body: data.body || "",
      icon: data.icon || "/launchericon-192x192.png",
      badge: data.badge || "/launchericon-96x96.png",
      tag: data.tag || "valis-push",
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      data: data.data || { url: "/" }
    })
  );
});

// Verificação periódica (Chrome/Android PWA instalado)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "valis-check-avisos") {
    event.waitUntil(checarAvisosBackground());
  }
});

async function checarAvisosBackground() {
  try {
    // Avisa todas as janelas abertas para sincronizar; se houver, elas notificam
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    all.forEach((c) => {
      try {
        c.postMessage({ type: "VALIS_BG_SYNC" });
      } catch (e) {}
    });
    // Se não há janela aberta, não temos auth Firestore aqui — push real exigiria FCM/servidor
  } catch (e) {}
}
