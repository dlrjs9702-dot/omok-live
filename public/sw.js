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
// v1.10.22: a page loaded past the worker (a hard reload) is not controlled; game-boot.js asks for control this way,
// since the game only starts in a controlled page
self.addEventListener('message', event => { if (event.data === 'claim') event.waitUntil(self.clients.claim()); });

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

async function activeCache() {
  const pointer = await caches.match('/active', { cacheName: META });
  const active = pointer && await pointer.json();
  return active?.cache && await caches.has(active.cache) ? caches.open(active.cache) : null;
}

async function fromActivePack(key) {
  return (await activeCache())?.match(key, { ignoreVary: true }) || null;
}

// v1.10.25 groups fetched when used (a game's cards, a skin's files): a `?rev=` file not stored yet is fetched and, once
// its content matches the revision in its URL, delivered and kept under that key. An old page must never receive the
// new deploy's bytes under an old revision, even if they would not be cached. HTTP errors remain HTTP errors.
async function verifiedResponse(request, rev) {
  const response = await fetch(request);
  if (!response.ok) return response;
  if (response.type !== 'basic' || !/^[0-9a-f]{16}$/.test(rev || '')) throw new TypeError('Invalid resource revision');
  const body = await response.clone().arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
  if (Array.from(digest.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('') !== rev) throw new TypeError('Resource revision mismatch');
  return response;
}

// Nothing is kept before the page has prepared the cache. A refused write does not prevent verified delivery.
async function keep(key, response) {
  try {
    if (!response.ok) return;
    const cache = await activeCache();
    if (!cache) return;
    await cache.put(key, response);
  } catch {}
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.waitUntil(checkServer());
  if (request.method !== 'GET' || !url.searchParams.has('rev')) return;
  const key = url.pathname + url.search;
  event.respondWith(fromActivePack(key).catch(() => null).then(hit => hit || verifiedResponse(request, url.searchParams.get('rev')).then(response => {
    event.waitUntil(keep(key, response.clone()));
    return response;
  })));
});
