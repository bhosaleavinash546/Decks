// Minimal service worker: present so Chrome offers Install, and no more.
//
// It deliberately does not cache application code. Swapping the app out from
// under a running set is a dropout waiting to happen, and the prime directive
// says the music never stops.
//
// Plain JS in public/ rather than TypeScript in src/, so it is served from the
// root and its scope covers the whole app.

self.addEventListener('install', () => {
  // Do NOT skipWaiting: a new version waits for a fresh load, never takes over
  // a tab that is currently playing.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // A pass-through handler. Its presence is what makes the app installable;
  // its emptiness is deliberate.
  event.respondWith(fetch(event.request))
})
