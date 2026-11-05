'use strict';
// 다음 메신저 묶음 (gamecenter-notes docs/messenger-speed-photo-20261103.md 10절) 알림 방식, 기기마다: 「열어 둘 때만」 (a PC's
// default: no push subscription, the server pushes that device nothing) / 「닫아도 받기」 (a phone's default) / 「안 받기」.
// A device from before the choice: a PC with a subscription moves to 열어 둘 때만 and is told once; a phone keeps its push.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');

test('메신저 알림 방식: PC 기본 열어 둘 때만(푸시 0)·폰 기본 닫아도 받기, 바꾸기, 옛 기기 옮기기 한 번 안내', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-alert-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let { req, base, stop } = await boot(t, dir);
  let ip = 0;
  const call = async (route, body, auth = {}) => {
    const headers = { 'X-Forwarded-For': `10.81.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(auth.account ? { 'X-Account-Token': auth.account } : {}), ...(auth.device ? { 'X-Messenger-Device': auth.device } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  const people = {};
  for (const [loginId, nickname] of [['mum_3', '엄마'], ['pop_3', '아빠']]) {
    await call('/api/account/signup', { realName: nickname, loginId, password: 'secret123', nickname });
    const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === loginId);
    await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
    const id = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === loginId).id;
    await req(`/api/admin/keys/${id}/messenger`, admin, { allowed: true });
    people[loginId] = { id, loginId };
  }
  const { mum_3: mum, pop_3: pop } = people;
  const login = async (p, device) => (await call('/api/account/login', { loginId: p.loginId, password: 'secret123', keep: true, device })).data;
  const P = 'https://fcm.googleapis.com/fcm/send/';
  const subOf = (tag) => ({ endpoint: `${P}${tag}`, p256dh: Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)]).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') });
  const pushes = async () => { await new Promise((r) => setTimeout(r, 300)); return (await req('/api/test/messenger/pushes')).data.pushes.map((x) => x.endpoint).sort(); };
  // the defaults: a PC (by the device's name) 열어 둘 때만, a phone 닫아도 받기
  const pc = { device: (await login(mum, '윈도우 크롬')).deviceToken }; const phone = { device: (await login(mum, '안드로이드 크롬')).deviceToken }; const mac = { device: (await login(mum, '맥 사파리')).deviceToken };
  assert.deepEqual((await call('/api/messenger/push', undefined, pc)).data, { ok: true, key: null, mode: 'open', moved: false, on: false });
  assert.equal((await call('/api/messenger/push', undefined, phone)).data.mode, 'push');
  assert.equal((await call('/api/messenger/push', undefined, mac)).data.mode, 'open');
  assert.deepEqual((await call('/api/messenger/devices', undefined, pc)).data.devices.map((d) => [d.name, d.alert]).sort(), [['맥 사파리', 'open'], ['안드로이드 크롬', 'push'], ['윈도우 크롬', 'open']]);
  // the phone subscribes; the PC on 열어 둘 때만 holds no subscription -- a line from dad: the phone is pushed, the PC not
  const dad = { device: (await login(pop, '윈도우 크롬')).deviceToken };
  const room = (await call('/api/messenger/rooms', { name: '우리집', members: [mum.id] }, dad)).data.room;
  assert.equal((await call('/api/messenger/push', subOf('phone'), phone)).status, 200);
  await pushes(); // (the invite line is the server's own: no push)
  const say = async (text) => { assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text }, dad)).status, 201, text); return pushes(); };
  assert.deepEqual(await say('저녁 먹자'), [`${P}phone`]);
  // the PC chooses 닫아도 받기: a subscription makes it so -- pushed; back to 열어 둘 때만: its subscription goes, nothing pushed
  assert.equal((await call('/api/messenger/push', subOf('pc'), pc)).status, 200);
  assert.deepEqual((await call('/api/messenger/push', undefined, pc)).data, { ok: true, key: null, mode: 'push', moved: false, on: true });
  assert.deepEqual(await say('왔어?'), [`${P}pc`, `${P}phone`]);
  assert.deepEqual((await call('/api/messenger/alert', { mode: 'open' }, pc)).data, { ok: true, mode: 'open' });
  assert.deepEqual((await call('/api/messenger/push', undefined, pc)).data, { ok: true, key: null, mode: 'open', moved: false, on: false });
  assert.deepEqual(await say('응'), [`${P}phone`]);
  // 안 받기 on the phone: its subscription goes too; a bad mode, no device -- refused
  assert.deepEqual((await call('/api/messenger/alert', { mode: 'off' }, phone)).data, { ok: true, mode: 'off' });
  assert.equal((await call('/api/messenger/push', undefined, phone)).data.on, false);
  assert.deepEqual(await say('조용'), []);
  assert.equal((await call('/api/messenger/alert', { mode: 'loud' }, phone)).data.error, 'BAD_ALERT_MODE');
  const account = (await call('/api/account/login', { loginId: mum.loginId, password: 'secret123' })).data.accountToken;
  assert.equal((await call('/api/messenger/alert', { mode: 'open' }, { account })).data.error, 'DEVICE_NEEDED');
  // a subscription left in the store for a device on 열어 둘 때만 (written in) is still not sent to
  const file = path.join(dir, 'points.json'); const edit = async (fn) => { await stop(); const data = JSON.parse(await fs.readFile(file, 'utf8')); fn(data.island.world); await fs.writeFile(file, JSON.stringify(data)); ({ req, base, stop } = await boot(t, dir)); };
  const pcId = (await call('/api/messenger/devices', undefined, pc)).data.devices.find((d) => d.mine).id;
  await edit((w) => { w.messengerPush.push({ ...subOf('pc-stale'), keyId: mum.id, device: pcId, at: Date.now() }); });
  assert.deepEqual(await say('남은 등록'), []);
  // devices from before the choice (no `alert`): a PC with a subscription moves to 열어 둘 때만 -- told once (`moved`), its
  // subscription gone; a PC without one just becomes 열어 둘 때만 (nothing to tell); a phone keeps 닫아도 받기 and its push
  await edit((w) => {
    w.messengerPush = w.messengerPush.filter((s) => s.device !== pcId);
    for (const d of w.messengerDevices) delete d.alert;
    for (const [id, name, tag] of [['old-pc', '윈도우 엣지', 'old-pc'], ['old-phone', '아이폰 사파리', 'old-phone'], ['old-mac', '맥 크롬', null]]) {
      w.messengerDevices.push({ id, keyId: mum.id, hash: crypto.createHash('sha256').update(`tok-${id}`).digest('hex'), name, at: Date.now(), exp: Date.now() + 86400000 });
      if (tag) w.messengerPush.push({ ...subOf(tag), keyId: mum.id, device: id, at: Date.now() });
    }
  });
  assert.deepEqual(await say('옛 기기들'), [`${P}old-phone`]); // (the PC's stale push is not sent even before it is told)
  const oldPc = { device: 'tok-old-pc' }; const oldPhone = { device: 'tok-old-phone' }; const oldMac = { device: 'tok-old-mac' };
  assert.deepEqual((await call('/api/messenger/push', undefined, oldPc)).data, { ok: true, key: null, mode: 'open', moved: true, on: false });
  assert.deepEqual((await call('/api/messenger/push', undefined, oldPc)).data, { ok: true, key: null, mode: 'open', moved: false, on: false }); // (told once)
  assert.deepEqual((await call('/api/messenger/push', undefined, oldPhone)).data, { ok: true, key: null, mode: 'push', moved: false, on: true });
  assert.deepEqual((await call('/api/messenger/push', undefined, oldMac)).data, { ok: true, key: null, mode: 'open', moved: false, on: false });
  assert.deepEqual((await call('/api/messenger/push', undefined, pc)).data.mode, 'open'); // (this PC again: by its name)
  assert.deepEqual(await say('옮긴 뒤'), [`${P}old-phone`]);
  // the page's logout drops the subscription but not the device's way: logged in again on the phone, 닫아도 받기 as before
  assert.equal((await call('/api/messenger/push/off', {}, oldPhone)).status, 200);
  assert.deepEqual((await call('/api/messenger/push', undefined, oldPhone)).data, { ok: true, key: null, mode: 'push', moved: false, on: false });
});
