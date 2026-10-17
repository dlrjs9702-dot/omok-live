'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonMessengerStore, PostgresMessengerStore } = require('../lib/messenger-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

// v1.10.78 메신저 (IDEAS #future-messenger): permitted accounts, rooms with members, numbered messages, only the latest
// every message kept (v1.10.87), the last one out deletes the room.
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
  // v1.10.88: reads only forward, members only; system lines; last line; rename; mute; one 1:1 room per pair
  const g = await store.createRoom('모임', 'a', ['b']);
  await store.post(g.id, 'a', 'a님이 b님을 초대했습니다.', true); await store.post(g.id, 'b', '안녕');
  await store.setRead(g.id, 'b', 2); await store.setRead(g.id, 'b', 1); await store.setRead(g.id, 'z', 2);
  let r = await store.room(g.id);
  assert.deepEqual(r.reads, { b: 2 }); assert.equal(r.kind, 'group'); assert.deepEqual([r.last.seq, r.last.text], [2, '안녕']);
  assert.deepEqual((await store.messages(g.id)).map((m) => Boolean(m.system)), [true, false]);
  assert.equal((await store.messages(g.id))[0].from, 'a');
  await store.rename(g.id, '새이름'); await store.setMuted(g.id, 'b', true); await store.setMuted(g.id, 'b', true);
  r = await store.room(g.id); assert.equal(r.name, '새이름'); assert.deepEqual(r.muted, ['b']);
  await store.setMuted(g.id, 'b', false); assert.deepEqual((await store.room(g.id)).muted, []);
  const [d1, d2] = await Promise.all([store.dmRoom('a', 'b'), store.dmRoom('b', 'a')]);
  assert.equal(d1.room.id, d2.room.id); assert.equal(d1.room.kind, 'dm'); assert.deepEqual(d1.room.pair.sort(), ['a', 'b']);
  await store.post(d1.room.id, 'a', '둘이'); await store.leave(d1.room.id, 'b');
  assert.deepEqual((await store.room(d1.room.id)).members, ['a']); // the other keeps the lines
  const back = await store.dmRoom('a', 'b');
  assert.deepEqual([back.room.id, back.joined, back.room.members.sort().join()], [d1.room.id, ['b'], 'a,b']);
  assert.equal((await store.messages(back.room.id)).length, 1);
  // v1.10.91: pin (mine), unsend (the text gone, the line kept), a system line never
  await store.setPinned(back.room.id, 'a', true); await store.setPinned(back.room.id, 'a', true);
  assert.deepEqual((await store.room(back.room.id)).pinned, ['a']);
  await store.setPinned(back.room.id, 'a', false); assert.deepEqual((await store.room(back.room.id)).pinned, []);
  const sent = await store.post(back.room.id, 'a', '지울 말');
  assert.equal((await store.messageAt(back.room.id, sent.seq)).text, '지울 말');
  await store.unsend(back.room.id, sent.seq);
  assert.equal((await store.messageAt(back.room.id, sent.seq)).text, '');
  const sys = await store.post(back.room.id, 'a', '알림', true); await store.unsend(back.room.id, sys.seq);
  assert.equal((await store.messageAt(back.room.id, sys.seq)).text, '알림');
  await store.leave(back.room.id, 'b');
  const [, raced] = await Promise.all([store.leave(back.room.id, 'a'), store.dmRoom('a', 'b')]); // the last out vs reopening
  const got = await store.room(raced.room.id);
  assert.ok(got && got.members.length >= 1); assert.equal((await store.dmRoom('a', 'b')).room.id, raced.room.id);
}

test('메신저 저장소: JSON — 허용·방·번호 붙은 메시지·전부 보관·이전 대화·마지막 사람이 나가면 삭제', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-'));
  const store = new JsonMessengerStore(path.join(dir, 'messenger.json'));
  await store.init();
  await storeBehaves(store);
  const room = await store.createRoom('많이', 'a', ['b']);
  for (let i = 0; i < 230; i += 1) await store.post(room.id, 'a', `m${i}`);
  const kept = store.data.messages[room.id];
  assert.equal(kept.length, 230); // v1.10.87: every message kept
  assert.deepEqual((await store.older(room.id, 131)).map((m) => m.seq), Array.from({ length: 100 }, (_, i) => i + 31)); // the 100 before #131
  assert.deepEqual((await store.older(room.id, 31)).length, 30);
  await store.queue;
  const again = new JsonMessengerStore(path.join(dir, 'messenger.json')); await again.init(); // kept on disk
  assert.equal((await again.room(room.id)).seq, 230);
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
  assert.deepEqual([room.seq, room.unread, room.last.text, room.last.system], [1, 0, '엄마님이 아빠님을 초대했습니다.', true]); // v1.10.88 system line

  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '저녁 뭐 먹어?' }, mom.token)).status, 201);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: 'x'.repeat(501) }, dad.token)).data.error, 'CHAT_TOO_LONG');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '김치찌개' }, dad.token)).status, 201);
  const got = (await call(`/api/messenger/rooms/${room.id}/messages`, undefined, dad.token)).data;
  assert.deepEqual(got.messages.map((m) => [m.seq, m.label, m.text]), [[1, '엄마', '엄마님이 아빠님을 초대했습니다.'], [2, '엄마', '저녁 뭐 먹어?'], [3, '아빠', '김치찌개']]);
  // v1.10.88 읽음 (server): mom has read up to her own line 2, dad all 3 by looking
  let momList = (await call('/api/messenger', undefined, mom.token)).data.rooms[0];
  assert.deepEqual([momList.unread, momList.reads[mom.id], momList.reads[dad.id], momList.last.label], [1, 2, 3, '아빠']);
  assert.deepEqual((await call(`/api/messenger/rooms/${room.id}/messages?after=2`, undefined, mom.token)).data.messages.map((m) => m.seq), [3]);
  assert.equal((await call('/api/messenger', undefined, mom.token)).data.rooms[0].unread, 0); // read on another call too (any device)
  // rename (group), mute (mine only)
  assert.equal((await call(`/api/messenger/rooms/${room.id}/name`, { name: '우리 가족' }, dad.token)).data.room.name, '우리 가족');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/mute`, { on: true }, mom.token)).data.room.muted, true);
  assert.equal((await call('/api/messenger', undefined, dad.token)).data.rooms[0].muted, false);
  // 1:1: named after the other, one room per pair, no invites
  const dm = (await call('/api/messenger/dm', { with: dad.id }, mom.token)).data.room;
  assert.deepEqual([dm.kind, dm.name], ['dm', '아빠']);
  assert.equal((await call('/api/messenger/dm', { with: mom.id }, dad.token)).data.room.id, dm.id);
  assert.equal((await call('/api/messenger/dm', { with: kid.id }, mom.token)).data.error, 'BAD_MEMBERS'); // not let in
  assert.equal((await call(`/api/messenger/rooms/${dm.id}/members`, { members: [dad.id] }, mom.token)).data.error, 'DM_ROOM');
  await call(`/api/messenger/rooms/${dm.id}/messages`, { text: '둘만' }, mom.token);
  await call(`/api/messenger/rooms/${dm.id}/leave`, {}, dad.token);
  const left = (await call(`/api/messenger/rooms/${dm.id}/messages`, undefined, mom.token)).data;
  assert.deepEqual([left.room.name, left.messages.map((m) => m.text)], ['아빠', ['둘만', '아빠님이 나갔습니다.']]); // mom keeps the lines
  const again = (await call('/api/messenger/dm', { with: dad.id }, mom.token)).data.room;
  assert.deepEqual([again.id, again.members.length, again.last.text], [dm.id, 2, '아빠님이 들어왔습니다.']);
  // v1.10.91: unsend (mine, 5 minutes) shows as deleted for everyone; pin puts the room first in my list only
  const mine = (await call(`/api/messenger/rooms/${dm.id}/messages`, { text: '잘못 보냄' }, mom.token)).data.message;
  assert.equal((await call(`/api/messenger/rooms/${dm.id}/unsend`, { seq: mine.seq }, dad.token)).data.error, 'MESSAGE_NOT_FOUND'); // not dad's
  assert.equal((await call(`/api/messenger/rooms/${dm.id}/unsend`, { seq: mine.seq }, mom.token)).status, 200);
  const seenByDad = (await call(`/api/messenger/rooms/${dm.id}/messages`, undefined, dad.token)).data.messages.find((x) => x.seq === mine.seq);
  assert.deepEqual([seenByDad.text, seenByDad.deleted], ['', true]);
  assert.equal((await call('/api/messenger', undefined, dad.token)).data.rooms.find((r) => r.id === dm.id).last.text, '삭제된 메시지입니다');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/pin`, { on: true }, mom.token)).data.room.pinned, true);
  assert.equal((await call('/api/messenger', undefined, mom.token)).data.rooms[0].id, room.id);
  assert.equal((await call('/api/messenger', undefined, dad.token)).data.rooms.find((r) => r.id === room.id).pinned, false);

  // the kid: let in later, not a member until invited
  await req(`/api/admin/keys/${kid.id}/messenger`, admin, { allowed: true });
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, undefined, kid.token)).status, 404);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '나도' }, kid.token)).status, 404);
  assert.equal((await call(`/api/messenger/rooms/${room.id}/members`, { members: [kid.id] }, dad.token)).data.room.members.length, 3);
  const kidSees = (await call(`/api/messenger/rooms/${room.id}/messages`, undefined, kid.token)).data;
  assert.equal(kidSees.messages.at(-1).text, '아빠님이 아이님을 초대했습니다.');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/members`, { members: [kid.id] }, dad.token)).data.error, 'BAD_MEMBERS'); // already in

  // 허용 해제: every call stops at once, the room stays for the others
  await req(`/api/admin/keys/${dad.id}/messenger`, admin, { allowed: false });
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, undefined, dad.token)).data.error, 'MESSENGER_DENIED');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/leave`, {}, kid.token)).status, 200);
  assert.equal((await call('/api/messenger', undefined, kid.token)).data.rooms.length, 0);
  const momRoom = (await call('/api/messenger', undefined, mom.token)).data.rooms.find((r) => r.id === room.id);
  assert.equal(momRoom.last.text, '아이님이 나갔습니다.');
  assert.equal(momRoom.members.find((m) => m.id === dad.id).active, false); // shut out: not waited for
});

// Codex review (v1.10.79): after a number, the next ones from it (no gap past 100 unread); the room cap holds with two
// invites at once; a failed write does not stop the next
test('메신저 저장소: 밀린 메시지 100개 넘어도 빠짐없이, 동시 초대도 인원 제한, 저장 실패 뒤에도 계속 저장', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-fix-'));
  const store = new JsonMessengerStore(path.join(dir, 'messenger.json'));
  await store.init();
  const room = await store.createRoom('밀림', 'a', ['b']);
  for (let i = 0; i < 150; i += 1) await store.post(room.id, 'a', `m${i}`);
  const first = await store.messages(room.id, 10);
  assert.deepEqual([first[0].seq, first.at(-1).seq], [11, 110]); // from 11 on, not the last 100
  assert.equal((await store.messages(room.id)).at(-1).seq, 150);
  const both = await Promise.all([store.addMembers(room.id, ['c'], 3), store.addMembers(room.id, ['d'], 3)]);
  assert.deepEqual(both.map((r) => r && r.members.length), [3, false]);
  store.queue = Promise.reject(new Error('disk full')); store.queue.catch(() => {});
  await store.post(room.id, 'b', '다시'); // goes on
  const again = new JsonMessengerStore(path.join(dir, 'messenger.json')); await again.init();
  assert.equal((await again.room(room.id)).seq, 151);
  await fs.rm(dir, { recursive: true, force: true });
});

// v1.10.91 운영 스위치: the administrator closes sign-ups and turns the messenger off for everyone, then back on
test('운영 스위치: 가입 신청 멈춤·메신저 끄기, 관리자만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'switches-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, base } = await boot(t, dir);
  const call = async (route, body, account) => { const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Forwarded-For': `10.91.0.${Math.floor(Math.random() * 200) + 1}`, ...(account ? { 'X-Account-Token': account } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: res.status, data: await res.json().catch(() => ({})) }; };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  assert.equal((await req('/api/admin/switches', null, { signups: false })).status, 401);
  assert.deepEqual((await req('/api/admin/switches', admin)).data.switches, { signups: true, messenger: true });
  assert.equal((await req('/api/admin/switches', admin, { signups: false })).data.switches.signups, false);
  assert.equal((await call('/api/account/signup', { realName: '닫힘', loginId: 'closed_1', password: 'secret123', nickname: '닫힘' })).data.error, 'SIGNUPS_CLOSED');
  await req('/api/admin/switches', admin, { signups: true });
  assert.equal((await call('/api/account/signup', { realName: '열림', loginId: 'open_1', password: 'secret123', nickname: '열림' })).status < 400, true);
  const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === 'open_1');
  await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
  const login = (await call('/api/account/login', { loginId: 'open_1', password: 'secret123' })).data;
  const id = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === 'open_1').id;
  await req(`/api/admin/keys/${id}/messenger`, admin, { allowed: true });
  assert.equal((await call('/api/messenger', undefined, login.accountToken)).status, 200);
  await req('/api/admin/switches', admin, { messenger: false });
  assert.equal((await call('/api/messenger', undefined, login.accountToken)).data.error, 'MESSENGER_OFF');
  await req('/api/admin/switches', admin, { messenger: true });
  assert.equal((await call('/api/messenger', undefined, login.accountToken)).status, 200);
});
