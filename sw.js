// Minimaler Service Worker — wird nur benötigt, damit Chrome/Android
// die Seite als installierbare PWA erkennt (Voraussetzung für "Zum
// Startbildschirm hinzufügen" / beforeinstallprompt).
const CACHE_NAME = 'groupio-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sehr einfache Netzwerk-zuerst-Strategie, damit die App auch offline
// zumindest die zuletzt geladene Seite anzeigen kann.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
