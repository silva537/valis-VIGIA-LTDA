/* VALIS VIGIA — Service Worker (atualização / anti-500 WebInto) */
const CACHE = 'valis-shell-v681';
const SHELL = ['./', './index.html', './version.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // sempre rede para version.json e HTML (evita página 500 antiga em cache)
  const isVersion = url.pathname.endsWith('version.json');
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isVersion || isHTML) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (!res || res.status >= 500) throw new Error('server ' + (res && res.status));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('./index.html');
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VALIS</title></head><body style="background:#020617;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px"><div><h2>Reconectando…</h2><p>Toque para reabrir o VALIS.</p><button onclick="location.href=location.pathname.split(\\'?\\')[0]+\\'?r=\\'+Date.now()" style="padding:14px 20px;border:0;border-radius:10px;background:#16a34a;color:#fff;font-weight:700">Abrir app</button></div><script>setTimeout(function(){location.href=location.pathname.split("?")[0]+"?r="+Date.now()},2500)</script></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
