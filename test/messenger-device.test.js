'use strict';
// 메신저 단독 창 (gamecenter-notes docs/messenger-standalone-20261025.md) ④ 이 기기에서 로그인 유지 and ③ 알림: a device token
// reaches the messenger only (not the account, the game or points), ends with a new password, the permission taken away
// or its own logout, and a push goes to the room's other members not looking -- muted and open ones left out
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');

test('메신저 기기 로그인 유지·알림: 메신저만, 비밀번호·허용 해제·로그아웃이면 끝, 푸시 받는 사람', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-device-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let { req, base, stop } = await boot(t, dir);
  let ip = 0;
  const pushesNow = async (n) => { let got = []; for (let k = 0; k < 50 && got.length < n; k += 1) { got = got.concat((await req('/api/test/messenger/pushes')).data.pushes); if (got.length < n) await new Promise((r) => setTimeout(r, 100)); } return got; };
  const call = async (route, body, auth = {}) => {
    const headers = { 'X-Forwarded-For': `10.79.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(auth.account ? { 'X-Account-Token': auth.account } : {}), ...(auth.device ? { 'X-Messenger-Device': auth.device } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  const people = {};
  for (const [loginId, nickname] of [['mum_2', '엄마'], ['pop_2', '아빠'], ['tot_2', '아이']]) {
    await call('/api/account/signup', { realName: nickname, loginId, password: 'secret123', nickname });
    const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === loginId);
    await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
    const id = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === loginId).id;
    await req(`/api/admin/keys/${id}/messenger`, admin, { allowed: true });
    people[loginId] = { id, loginId };
  }
  const { mum_2: mum, pop_2: pop, tot_2: tot } = people;
  const login = async (p, keep = true) => (await call('/api/account/login', { loginId: p.loginId, password: 'secret123', keep, device: '윈도우 크롬' })).data;
  // keep: a device token besides the account token; without keep none
  assert.equal((await login(mum, false)).deviceToken, undefined);
  const m = await login(mum); assert.match(m.deviceToken, /^[\w-]{20,}$/);
  const dev = { device: m.deviceToken };
  assert.equal((await call('/api/messenger', undefined, dev)).status, 200); // the messenger: yes
  for (const [route, body] of [['/api/account/me'], ['/api/points'], ['/api/plaza/state', { x: 0, z: 0 }], ['/api/account/password', { current: 'secret123', next: 'hacked123' }]]) assert.equal((await call(route, body, dev)).status, 401, route); // nothing else
  const devices = (await call('/api/messenger/devices', undefined, dev)).data.devices;
  assert.equal(devices.length, 1); assert.equal(devices[0].mine, true); assert.equal(devices[0].name, '윈도우 크롬');
  // a push subscription needs a device kept logged in
  const P = 'https://fcm.googleapis.com/fcm/send/';
  const sub = { endpoint: `${P}mum`, p256dh: Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)]).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
  assert.equal((await call('/api/messenger/push', sub, { account: m.accountToken })).data.error, 'DEVICE_NEEDED');
  assert.equal((await call('/api/messenger/push', { ...sub, auth: 'x' }, dev)).data.error, 'BAD_SUBSCRIPTION');
  // (Codex 검토 2차 #2) only the browsers' push services: no other https address, an inside one, another port or a login
  for (const endpoint of ['https://push.example.net/send/mum', 'https://10.0.0.5/x', 'https://localhost/x', 'https://fcm.googleapis.com:8443/x', 'https://u:p@fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.net/x', 'http://fcm.googleapis.com/x']) assert.equal((await call('/api/messenger/push', { ...sub, endpoint }, dev)).data.error, 'BAD_SUBSCRIPTION', endpoint);
  assert.equal((await call('/api/messenger/push', sub, dev)).status, 200);
  assert.equal((await call('/api/messenger/push', undefined, dev)).data.on, true);
  const p = await login(pop); const popSub = { ...sub, endpoint: `${P}pop` }; await call('/api/messenger/push', popSub, { device: p.deviceToken });
  const k = await login(tot); await call('/api/messenger/push', { ...sub, endpoint: `${P}tot` }, { device: k.deviceToken });
  // a room of three: pop writes -- mum and tot told (not pop); tot mutes it -- only mum
  const room = (await call('/api/messenger/rooms', { name: '우리집', members: [mum.id, tot.id] }, { device: p.deviceToken })).data.room;
  await req('/api/test/messenger/pushes'); // (the invite line is the server's own: no push)
  await call(`/api/messenger/rooms/${room.id}/messages`, { text: '저녁 먹자' }, { device: p.deviceToken });
  let pushes = await pushesNow(2);
  assert.deepEqual(pushes.map((x) => x.endpoint).sort(), [`${P}mum`, `${P}tot`]);
  assert.deepEqual(pushes[0].payload, { title: '우리집', body: '아빠: 저녁 먹자', room: room.id, unread: 2 }); // (the invite line + this one)
  await call(`/api/messenger/rooms/${room.id}/mute`, { on: true }, { device: k.deviceToken });
  // someone looking at the messenger now (a stream open) is not told either
  const ctl = new AbortController(); const stream = await fetch(`${base}/api/messenger/stream`, { headers: { 'X-Messenger-Device': m.deviceToken }, signal: ctl.signal });
  await call(`/api/messenger/rooms/${room.id}/messages`, { text: '빨리 와' }, { device: p.deviceToken });
  await new Promise((r) => setTimeout(r, 300)); assert.deepEqual(await pushesNow(0), []); // (nothing for the one looking)
  ctl.abort(); await stream.body?.cancel().catch(() => {}); await new Promise((r) => setTimeout(r, 200));
  await call(`/api/messenger/rooms/${room.id}/messages`, { text: '다 식어' }, { device: p.deviceToken });
  pushes = await pushesNow(1); assert.deepEqual(pushes.map((x) => x.to), [mum.id]);
  // ending: a new password ends mum's devices (and their subscription); the permission taken away ends pop's; tot's logout its own
  assert.equal((await call('/api/account/password', { current: 'secret123', next: 'secret456' }, { account: m.accountToken })).status, 200);
  assert.equal((await call('/api/messenger', undefined, dev)).status, 401);
  await req(`/api/admin/keys/${pop.id}/messenger`, admin, { allowed: false });
  assert.equal((await call('/api/messenger', undefined, { device: p.deviceToken })).status, 401);
  assert.equal((await call('/api/messenger/devices/drop', { self: true }, { device: k.deviceToken })).status, 200);
  assert.equal((await call('/api/messenger', undefined, { device: k.deviceToken })).status, 401);
  await call(`/api/messenger/rooms/${room.id}/mute`, { on: false }, { account: k.accountToken });
  await call(`/api/messenger/rooms/${room.id}/messages`, { text: '아무도' }, { account: k.accountToken });
  await new Promise((r) => setTimeout(r, 300)); assert.deepEqual(await pushesNow(0), []); // every subscription went with its device
  // (Codex 검토 2차 #1) a device pushed out by the 11th login, and one run out (60 days), are told nothing
  const mumNow = (await call('/api/account/login', { loginId: mum.loginId, password: 'secret456', keep: true, device: '노트북' })).data.deviceToken; // (a device: it outlasts the restarts below)
  const say = async (text) => { assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text }, { device: mumNow })).status, 201, text); await new Promise((r) => setTimeout(r, 300)); return (await req('/api/test/messenger/pushes')).data.pushes; }; // (pushesNow(0) asks nothing)
  const first = await login(tot); await call('/api/messenger/push', { ...sub, endpoint: `${P}tot-first` }, { device: first.deviceToken });
  assert.equal((await call(`/api/messenger/rooms/${room.id}/mute`, { on: false }, { device: first.deviceToken })).status, 200);
  assert.deepEqual((await say('하나')).map((x) => x.endpoint), [`${P}tot-first`]);
  // (nine more devices kept since -- written in, the logins are limited -- then a tenth login pushes the first out)
  const file = path.join(dir, 'points.json'); const edit = async (fn) => { await stop(); const data = JSON.parse(await fs.readFile(file, 'utf8')); fn(data.island.world); await fs.writeFile(file, JSON.stringify(data)); ({ req, base, stop } = await boot(t, dir)); };
  await edit((w) => { for (let n = 0; n < 9; n += 1) w.messengerDevices.push({ id: `later-${n}`, keyId: tot.id, hash: `h${n}`, name: '', at: Date.now() + n, exp: Date.now() + 86400000 }); });
  const last = await login(tot);
  assert.equal((await call('/api/messenger', undefined, { device: first.deviceToken })).status, 401);
  assert.deepEqual(await say('둘'), []);
  await call('/api/messenger/push', { ...sub, endpoint: `${P}tot-last` }, { device: last.deviceToken });
  assert.deepEqual((await say('둘 반')).map((x) => x.endpoint), [`${P}tot-last`]);
  await edit((w) => { for (const d of w.messengerDevices) if (d.keyId === tot.id) d.exp = Date.now() - 1000; }); // (60 days later, for tot's)
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).island.world.messengerPush.length, 1); // (kept in the store...)
  assert.deepEqual(await say('셋'), []); // (... but not sent to)
});
