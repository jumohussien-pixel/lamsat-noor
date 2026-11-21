/**
 * لمسة نور — Service Worker (PWA Shell Caching)
 * Network-first for HTML/JS/CSS so updates land cleanly, with offline fallback.
 * Never caches /api/* requests.
 */

const CACHE_NAME = 'lamsat-noor-v5';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/src/app.js',
  '/src/laser-scanner-engine.js',
  '/src/vision-engine.js',
  '/src/arabic-voice-coach.js',
  '/src/safety-storage.js',
  '/src/screen-wake-lock.js',
  '/agent_skills/arabic-web-speech/arabic-speech-config.js',
  '/agent_skills/arabic-web-speech/arabic-speech-matching.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
  );
});
