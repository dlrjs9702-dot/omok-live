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

// v1.10.210 메신저 알림 (gamecenter-notes docs/messenger-app-push-20261030.md 3절): the messenger's push and its tap, here in
// the app's own worker -- an icon badge set by a worker reaches only the apps inside its scope, so the old /messenger
// worker's never reached the island app's icon. A tap brings the messenger window forward on that room, else opens it.
if (typeof importScripts === 'function') importScripts('/messenger-alert.js');
self.addEventListener('push', event => {
  let d = {}; try { d = event.data?.json() || {}; } catch {}
  event.waitUntil((async () => {
    if (Number.isFinite(d.unread)) self.MessengerAlert?.setBadge(self.navigator, d.unread);
    await self.registration.showNotification(d.title || '아일랜드 메신저', { body: d.body || '새 메시지가 왔어요.', tag: d.room || 'messenger', renotify: true, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { room: d.room || null } });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close(); const room = event.notification.data?.room;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find(w => new URL(w.url).pathname === '/messenger');
    if (open) { await open.focus(); open.postMessage({ room }); return; }
    await self.clients.openWindow(`/messenger${room ? `?room=${encodeURIComponent(room)}` : ''}`);
  })());
});
const pushKept = async () => Boolean(await self.registration.pushManager?.getSubscription().catch(() => null)); // (the cache off: a messenger notice still wanted keeps the worker)

async function checkServer() {
  let response;
  try { response = await fetch('/asset-cache.json', { cache: 'no-store' }); } catch { return; }
  if (response.status !== 404) {
    if (!response.ok) return;
    const body = await response.json().catch(() => null);
    if (body?.enabled !== false) return;
  }
  for (const name of await caches.keys()) if (name.startsWith(PREFIX)) await caches.delete(name);
  if (!await pushKept()) await self.registration.unregister();
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
  // Only public pack files may enter the resource cache. API responses, pages and executable code remain network
  // traffic even when a caller adds a revision query; complete transformation GLBs use this same lazy path.
  if (!/^\/(?:assets|hwatu)\//.test(url.pathname) || !/\.(?:json|svg|png|ico|webmanifest|glb|gltf|bin|jpe?g|webp|avif|wasm|pck)$/i.test(url.pathname)) return;
  const key = url.pathname + url.search;
  event.respondWith(fromActivePack(key).catch(() => null).then(hit => hit || verifiedResponse(request, url.searchParams.get('rev')).then(response => {
    event.waitUntil(keep(key, response.clone()));
    return response;
  })));
});
