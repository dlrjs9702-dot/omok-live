'use strict';
// split from messenger-alert-mode.test.js (1.10.362, #513: each test boots its own server, ~11 s on CI -- the file passed the runner's 120 s a file, so it is split)
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');

// v1.10.256 주소 옮기기 (14절): on the new address, a subscription made on the old one (or before 256 -- no `from`) still
// gets the notice for 7 days from the first time the server meets one; the same account's device of the same name
// subscribing here drops its old one at once; after the 7 days the old ones go. The new ones carry the new address.
test('주소 옮기기: 옛 주소 구독은 7일 동안 받고 그 뒤 지움, 같은 이름 기기가 새로 구독하면 바로 지움', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-move-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const SITE = 'https://island-dalmaru.onrender.com';
  let { req, base, stop } = await boot(t, dir, { RENDER_EXTERNAL_URL: SITE });
  let ip = 0;
  const call = async (route, body, auth = {}) => {
    const headers = { 'X-Forwarded-For': `10.83.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(auth.device ? { 'X-Messenger-Device': auth.device } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  const people = {};
  for (const [loginId, nickname] of [['mum_mv', '엄마'], ['pop_mv', '아빠']]) {
    await call('/api/account/signup', { realName: nickname, loginId, password: 'secret123', nickname });
    const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === loginId);
    await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
    const id = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === loginId).id;
    await req(`/api/admin/keys/${id}/messenger`, admin, { allowed: true });
    people[loginId] = { id, loginId };
  }
  const { mum_mv: mum, pop_mv: pop } = people;
  const login = async (p, device, deviceKind) => ({ device: (await call('/api/account/login', { loginId: p.loginId, password: 'secret123', keep: true, device, deviceKind })).data.deviceToken });
  const P = 'https://fcm.googleapis.com/fcm/send/';
  const subOf = (tag) => ({ endpoint: `${P}${tag}`, p256dh: Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)]).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') });
  const file = path.join(dir, 'points.json'); const edit = async (fn) => { await stop(); const data = JSON.parse(await fs.readFile(file, 'utf8')); fn(data.island.world); await fs.writeFile(file, JSON.stringify(data)); ({ req, base, stop } = await boot(t, dir, { RENDER_EXTERNAL_URL: SITE })); };
  const phone = await login(mum, '안드로이드 크롬', 'phone'); const tab = await login(mum, '아이폰 사파리', 'phone');
  assert.equal((await call('/api/messenger/push', subOf('old-android'), phone)).status, 200); assert.equal((await call('/api/messenger/push', subOf('old-iphone'), tab)).status, 200);
  await edit((w) => { for (const s of w.messengerPush) { assert.equal(s.from, SITE); delete s.from; } }); // (as made on the old address, before 256)
  const dad = await login(pop, '윈도우 크롬', 'pc');
  const room = (await call('/api/messenger/rooms', { name: '이사', members: [mum.id] }, dad)).data.room;
  const say = async (text) => { assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text }, dad)).status, 201, text); await new Promise((r) => setTimeout(r, 300)); return [...new Set((await req('/api/test/messenger/pushes')).data.pushes.map((x) => x.endpoint.slice(P.length)))].sort(); };
  await say('(초대)');
  assert.deepEqual(await say('새 집 주소야'), ['old-android', 'old-iphone'], '7일 동안은 옛 구독으로도');
  // the Android phone on the new address: logged in, subscribed -- its old one goes at once (the iPhone's stays)
  const phone2 = await login(mum, '안드로이드 크롬', 'phone');
  assert.equal((await call('/api/messenger/push', subOf('new-android'), phone2)).status, 200);
  await edit((w) => { assert.deepEqual(w.messengerPush.map((s) => [s.endpoint.slice(P.length), s.from || null]).sort(), [['new-android', SITE], ['old-iphone', null]]); assert.ok(w.pushMovedAt); w.pushMovedAt -= 8 * 24 * 3600000; });
  assert.deepEqual(await say('일주일 지났어'), ['new-android']);
  await edit((w) => { assert.deepEqual(w.messengerPush.map((s) => s.endpoint.slice(P.length)), ['new-android'], '7일 지나 옛 구독 지움'); });
});
