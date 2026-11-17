'use strict';
// 1.10.352 메신저 알림 (사용자 「아일랜드에도 1 표시가 뜨는데 메신저에만 숫자 표시가 뜨게 해」): the messenger's own worker, scope
// /messenger -- an icon badge set by a worker reaches every app inside its scope, so the island's (scope /) put the messenger's
// unread count on the island app's icon too. Here the push sets the count on the messenger app alone, shows the alert, and a tap
// brings the messenger window forward on that room (else opens it). Nothing else: no caching (the island's worker does that).
importScripts('/messenger-alert.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let d = {}; try { d = event.data?.json() || {}; } catch {}
  event.waitUntil((async () => {
    if (Number.isFinite(d.unread)) self.MessengerAlert?.setBadge(self.navigator, d.unread);
    await self.registration.showNotification(d.title || '아일랜드 메신저', { body: d.body || '새 메시지가 왔어요.', tag: d.room || 'messenger', renotify: true, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { room: d.room || null } });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); const room = event.notification.data?.room;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => ['/messenger', '/messenger.html'].includes(new URL(w.url).pathname));
    if (open) { await open.focus(); open.postMessage({ room }); return; }
    await self.clients.openWindow(`/messenger.html${room ? `?room=${encodeURIComponent(room)}` : ''}`);
  })());
});
