// Altere esta versão toda vez que subir uma mudança importante (ex: v1.0.1, v1.0.2)
const CACHE_NAME = 'ponto-pwa-v1.0.1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  // Força o novo Service Worker a assumir o controle imediatamente
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Salvando arquivos no cache...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Ativação e Limpeza de Caches Antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Apagando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle do aplicativo imediatamente
  );
});

// Intercepta as requisições (Busca na rede primeiro; se falhar, pega do cache)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Atualiza o cache dinamicamente com a versão mais recente
        if (event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se estiver offline, entrega o que está salvo no cache
        return caches.match(event.request);
      })
  );
});
