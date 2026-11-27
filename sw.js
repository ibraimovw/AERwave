// Кэш и список файлов для работы офлайн
const CACHE_NAME = 'aerwave-vanilla-v7-11';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/app.js',
  './js/api.js',
  './js/helpers.js',
  './js/i18n.js',
  './js/icons.js',
  './js/atmosphere.js',
  './js/map.js',
  './assets/favicon.svg',
  './assets/logo.svg',
  './assets/apple-touch-icon.png',
  './assets/pwa-192x192.png',
  './assets/pwa-512x512.png',
  './assets/pwa-maskable-512x512.png',
];

// Сохраняем основные файлы при установке
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

// Удаляем старые версии кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала сеть, при отсутствии интернета — кэш
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
