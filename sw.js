/* VALIS — SW legado mantido no pacote.
 * O app registra /pwabuilder-sw.js (não este arquivo).
 * Este SW só se desregistra se alguém o registrar por engano.
 */
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.registration.unregister())
  );
});
