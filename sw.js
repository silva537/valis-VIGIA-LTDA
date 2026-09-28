// Service Worker para Vales Naturalidade LTDA
const CACHE_NAME = 'vales-ponto-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Listener de eventos de Push do sistema
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Vales Naturalidade', body: 'Lembrete de Ponto!' };
    
    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        vibrate: [100, 50, 100],
        data: { dateOfArrival: Date.now() }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});
