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

// ================== LOKALE BENACHRICHTIGUNGEN (ohne Push-Server) ==================
// Die Seite selbst ruft registration.showNotification(...) auf, sobald sie im
// Hintergrund/Vordergrund läuft (Tab offen oder kürzlich geöffnete PWA) und eine
// neue Admin-Mitteilung oder eine Gruppen-Freischaltung erkennt. Ein echter
// Push, der auch bei vollständig geschlossener App ankommt, würde zusätzlich
// einen Server (z. B. Firebase Cloud Functions) benötigen.

// Klick auf die Benachrichtigung: App-Fenster fokussieren oder öffnen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
