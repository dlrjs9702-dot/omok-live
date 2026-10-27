'use strict';
// 메신저 단독 창 ③ (gamecenter-notes docs/messenger-standalone-20261025.md): the messenger page's own worker (scope
// /messenger -- the game's sw.js stays the game's). It only shows the server's push as a notice (who, the first line),
// the app icon's unread count where the device has one, and a tap opens that room (the open window, else a new one).
// Nothing is cached: the page always comes from the server.
importScripts('/messenger-alert.js'); // (v1.10.190: the app icon's count by the one rule -- cleared only at 0)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let d = {}; try { d = event.data?.json() || {}; } catch {}
  event.waitUntil((async () => {
    if (Number.isFinite(d.unread)) self.MessengerAlert.setBadge(self.navigator, d.unread);
    await self.registration.showNotification(d.title || '아일랜드 메신저', { body: d.body || '새 메시지가 왔어요.', tag: d.room || 'messenger', renotify: true, icon: '/icons/messenger-192.png', badge: '/icons/messenger-192.png', data: { room: d.room || null } });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); const room = event.notification.data?.room;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => new URL(w.url).pathname === '/messenger');
    if (open) { await open.focus(); open.postMessage({ room }); return; }
    await self.clients.openWindow(`/messenger${room ? `?room=${encodeURIComponent(room)}` : ''}`);
  })());
});
