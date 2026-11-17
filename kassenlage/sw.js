/* Offline-Speicher für die App-Dateien.
   Antwortet sofort aus dem Zwischenspeicher und holt im Hintergrund die neue Fassung.
   Nach einem Update zeigt die App beim nächsten Öffnen die neuen Dateien. */
const NAME = 'kassenlage-v4';
const DATEIEN = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/steuerwerte.js', 'js/basis.js', 'js/steuer.js', 'js/gehalt.js', 'js/einsatz.js',
  'js/import.js', 'js/analyse.js', 'js/daten.js', 'js/vermoegen.js', 'js/diagramme.js', 'js/info.js',
  'js/ansichten.js', 'js/ansichten2.js', 'js/app.js', 'js/thema.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(NAME).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', function (e) {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(NAME).then(function (cache) {
    return cache.match(anfrage, { ignoreSearch: true }).then(function (treffer) {
      const netz = fetch(anfrage).then(function (antwort) {
        if (antwort && antwort.ok) cache.put(anfrage, antwort.clone());
        return antwort;
      }).catch(() => treffer);
      return treffer || netz;
    });
  }));
});
