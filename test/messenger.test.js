'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonMessengerStore, PostgresMessengerStore, KEEP } = require('../lib/messenger-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

// v1.10.78 메신저 (IDEAS #future-messenger): permitted accounts, rooms with members, numbered messages, only the latest
// KEEP of a room kept, the last one out deletes the room.
async function storeBehaves(store) {
  await store.setAllowed('a', true); await store.setAllowed('b', true); await store.setAllowed('b', true);
  assert.deepEqual((await store.allowedIds()).sort(), ['a', 'b']);
  await store.setAllowed('b', false);
  assert.deepEqual(await store.allowedIds(), ['a']);
  const room = await store.createRoom('가족', 'a', ['b', 'b']);
  assert.deepEqual(room.members.sort(), ['a', 'b']);
  assert.equal((await store.roomsOf('b')).length, 1);
  assert.equal((await store.roomsOf('c')).length, 0);
  assert.deepEqual((await store.addMembers(room.id, ['c', 'a'])).members.sort(), ['a', 'b', 'c']);
  const one = await store.post(room.id, 'a', '안녕');
  const two = await store.post(room.id, 'b', '반가워');
  assert.deepEqual([one.seq, two.seq], [1, 2]);
  assert.deepEqual((await store.messages(room.id)).map((m) => [m.seq, m.from, m.text]), [[1, 'a', '안녕'], [2, 'b', '반가워']]);
  assert.deepEqual((await store.messages(room.id, 1)).map((m) => m.seq), [2]);
  assert.equal((await store.room(room.id)).seq, 2);
  for (const id of ['a', 'b']) await store.leave(room.id, id);
  assert.deepEqual((await store.room(room.id)).members, ['c']);
  await store.leave(room.id, 'c');
  assert.equal(await store.room(room.id), null); // the last one out
  assert.deepEqual(await store.messages(room.id), []);
}

test('메신저 저장소: JSON — 허용·방·번호 붙은 메시지·최근 KEEP개만·마지막 사람이 나가면 삭제', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-'));
  const store = new JsonMessengerStore(path.join(dir, 'messenger.json'));
  await store.init();
  await storeBehaves(store);
  const room = await store.createRoom('많이', 'a', ['b']);
  for (let i = 0; i < KEEP + 5; i += 1) await store.post(room.id, 'a', `m${i}`);
  const kept = store.data.messages[room.id];
  assert.equal(kept.length, KEEP);
  assert.equal(kept[0].seq, 6);
  await store.queue;
  const again = new JsonMessengerStore(path.join(dir, 'messenger.json')); await again.init(); // kept on disk
  assert.equal((await again.room(room.id)).seq, KEEP + 5);
  await fs.rm(dir, { recursive: true, force: true });
});

test('메신저 저장소: PostgreSQL — 같은 동작, 동시에 보내도 번호가 겹치지 않음', async (t) => {
  const database = await testDatabase();
  t.after(() => database.stop());
  const store = new PostgresMessengerStore(database.url);
  t.after(() => store.pool.end());
  await store.init();
  await store.init();
  await storeBehaves(store);
  const room = await store.createRoom('동시', 'a', ['b']);
  const sent = await Promise.all(Array.from({ length: 8 }, (_, i) => store.post(room.id, i % 2 ? 'a' : 'b', `동시${i}`)));
  assert.deepEqual(sent.map((m) => m.seq).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('메신저 API: 관리자 허용 계정만(서버 확인), 방 만들기·초대·대화·나가기, 방 밖·허용 해제는 막힘', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, base } = await boot(t, dir);
  let ip = 0;
  const call = async (route, body, account) => {
    const headers = { 'X-Forwarded-For': `10.78.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(account ? { 'X-Account-Token': account } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  const people = {};
  for (const [loginId, nickname] of [['mom_1', '엄마'], ['dad_1', '아빠'], ['kid_1', '아이']]) {
    await call('/api/account/signup', { realName: nickname, loginId, password: 'secret123', nickname });
    const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === loginId);
    await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
    const login = (await call('/api/account/login', { loginId, password: 'secret123' })).data;
    people[loginId] = { token: login.accountToken, id: (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === loginId).id, messenger: login.account.messenger };
  }
  const { mom_1: mom, dad_1: dad, kid_1: kid } = people;
  assert.equal(mom.messenger, false);
  assert.equal((await call('/api/messenger', undefined, mom.token)).data.error, 'MESSENGER_DENIED'); // not let in yet
  assert.equal((await call('/api/messenger')).status, 401);
  assert.equal((await req(`/api/admin/keys/${mom.id}/messenger`, null, { allowed: true })).status, 401); // the administrator only
  for (const p of [mom, dad]) assert.equal((await req(`/api/admin/keys/${p.id}/messenger`, admin, { allowed: true })).data.messenger, true);
  assert.equal((await req('/api/admin/keys', admin)).data.keys.find((k) => k.id === mom.id).messenger, true);
  assert.equal((await call('/api/account/me', undefined, mom.token)).data.account.messenger, true);

  const list = (await call('/api/messenger', undefined, mom.token)).data;
  assert.deepEqual(list.people.map((p) => p.label), ['아빠']); // only the other permitted accounts
  assert.equal((await call('/api/messenger/rooms', { name: '우리집', members: [kid.id] }, mom.token)).data.error, 'BAD_MEMBERS'); // not permitted
  assert.equal((await call('/api/messenger/rooms', { name: ' ', members: [dad.id] }, mom.token)).data.error, 'BAD_ROOM_NAME');
  const room = (await call('/api/messenger/rooms', { name: '우리집', members: [dad.id] }, mom.token)).data.room;
  assert.deepEqual(room.members.map((m) => m.label).sort(), ['아빠', '엄마']);

  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '저녁 뭐 먹어?' }, mom.token)).status, 201);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: 'x'.repeat(501) }, dad.token)).data.error, 'CHAT_TOO_LONG');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '김치찌개' }, dad.token)).status, 201);
  const got = (await call(`/api/messenger/rooms/${room.id}/messages`, undefined, dad.token)).data;
  assert.deepEqual(got.messages.map((m) => [m.seq, m.label, m.text]), [[1, '엄마', '저녁 뭐 먹어?'], [2, '아빠', '김치찌개']]);
  assert.deepEqual((await call(`/api/messenger/rooms/${room.id}/messages?after=1`, undefined, mom.token)).data.messages.map((m) => m.seq), [2]);

  // the kid: let in later, not a member until invited
  await req(`/api/admin/keys/${kid.id}/messenger`, admin, { allowed: true });
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, undefined, kid.token)).status, 404);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '나도' }, kid.token)).status, 404);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/members`, { members: [kid.id] }, dad.token)).data.room.members.length, 3);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, undefined, kid.token)).data.messages.length, 2);

  // 허용 해제: every call stops at once, the room stays for the others
  await req(`/api/admin/keys/${dad.id}/messenger`, admin, { allowed: false });
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, undefined, dad.token)).data.error, 'MESSENGER_DENIED');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/leave`, {}, kid.token)).status, 200);
  assert.equal((await call('/api/messenger', undefined, kid.token)).data.rooms.length, 0);
  assert.equal((await call('/api/messenger', undefined, mom.token)).data.rooms[0].seq, 2);
});
