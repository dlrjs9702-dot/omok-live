'use strict';

// v1.10.14 game resource cache. It only answers same-origin GET requests for pack assets that carry a revision
// (`/hwatu/m01-gwang.svg?rev=<hash>`, made by GameBoot.assetUrl). Those entries are content-addressed and written by
// the page only after their hash checked out, so a hit is always exactly the requested revision. Everything else --
// HTML, app code, API calls, event streams -- is not touched and keeps its normal network/HTTP-cache behaviour.
const CACHE = 'gc-assets-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.searchParams.has('rev')) return;
  event.respondWith(
    caches.open(CACHE)
      .then(cache => cache.match(url.pathname + url.search, { ignoreVary: true }))
      .catch(() => null)
      .then(hit => hit || fetch(request)),
  );
});
