'use strict';

// v1.10.14 game resource worker (public/game-boot.js builds the packs).
// Version rules: it only answers same-origin GET requests carrying `?rev=<content hash>`, which only game-boot.js
// (v1.10.14+) produces, and only from the pack the meta pointer names as active; a miss goes to the network. HTML, app
// code, API calls and event streams are never touched, so any page version -- older or newer than this worker --
// keeps its normal network/HTTP-cache behaviour, and a new worker replaces the old one at once (skipWaiting + claim).
// Rollback: when the server no longer serves /asset-cache.json (a deploy from before this feature) or says the cache
// is off (ASSET_CACHE=off), the worker deletes the `gc-res:*` caches and unregisters itself. Checked on every page load
// (one tiny no-store request); network trouble changes nothing.
const PREFIX = 'gc-res:';
const META = `${PREFIX}meta`;

self.addEventListener('install', event => {
  // Chrome 123+ static routing: game API traffic (actions, event streams) never wakes this worker up.
  if (event.addRoutes && typeof URLPattern === 'function') {
    event.waitUntil(event.addRoutes({ condition: { urlPattern: new URLPattern({ pathname: '/api/*' }) }, source: 'network' }).catch(() => {}));
  }
  self.skipWaiting();
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function checkServer() {
  let response;
  try { response = await fetch('/asset-cache.json', { cache: 'no-store' }); } catch { return; }
  if (response.status !== 404) {
    if (!response.ok) return;
    const body = await response.json().catch(() => null);
    if (body?.enabled !== false) return;
  }
  for (const name of await caches.keys()) if (name.startsWith(PREFIX)) await caches.delete(name);
  await self.registration.unregister();
}

async function fromActivePack(key) {
  const pointer = await caches.match('/active', { cacheName: META });
  const active = pointer && await pointer.json();
  if (!active?.cache || !(await caches.has(active.cache))) return null;
  return (await caches.open(active.cache)).match(key, { ignoreVary: true });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.waitUntil(checkServer());
  if (request.method !== 'GET' || !url.searchParams.has('rev')) return;
  event.respondWith(fromActivePack(url.pathname + url.search).catch(() => null).then(hit => hit || fetch(request)));
});
