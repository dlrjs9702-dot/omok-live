'use strict';
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonMessengerStore, PostgresMessengerStore } = require('../lib/messenger-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

const JPEG = (n = 300) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7)]);

// v1.10.233 사진 보내기 (notes docs/messenger-speed-photo-20261103.md 5절): a photo up on its own, then a message takes it
// (in order, once, the sender's and the room's only); the message's list shows them; 7 days on the bytes go and the
// place says gone; one never taken goes after a day; unsent -- its photos go with it
async function photosBehave(store) {
  const room = await store.createRoom('사진방', 'a', ['b']);
  const p1 = await store.addPhoto(room.id, 'a', JPEG(), 1280, 960); const p2 = await store.addPhoto(room.id, 'a', JPEG(), 960, 1280);
  assert.equal(await store.photosFree(room.id, 'b', [p1]), false, '남의 사진');
  assert.equal(await store.photosFree(room.id, 'a', [p1, p2]), true);
  const msg = await store.post(room.id, 'a', '📷 사진'); assert.equal(await store.attachPhotos(room.id, 'a', msg.seq, [p2, p1]), true);
  assert.equal(await store.photosFree(room.id, 'a', [p1]), false, '한 번만');
  const [shown] = (await store.messages(room.id)).filter((m) => m.seq === msg.seq);
  assert.deepEqual(shown.photos.map((p) => [p.id, p.w, p.h, p.gone]), [[p2, 960, 1280, false], [p1, 1280, 960, false]]);
  assert.equal((await store.photoOf(p1)).bytes.length, JPEG().length); assert.equal((await store.photoOf(p1)).room, room.id);
  assert.equal(await store.photosSince('a', Date.now() - 60000), 2); assert.equal(await store.photosSince('a', Date.now() + 60000), 0); assert.equal(await store.photosSince('b', 0), 0);
  assert.deepEqual(await store.photoRooms(), [{ room: room.id, n: 2, size: 2 * JPEG().length }], '방마다 남은 사진');
  const loose = await store.addPhoto(room.id, 'a', JPEG(), 10, 10);
  await store.purgePhotos(Date.now() + 2 * 86400000); assert.equal(await store.photoOf(loose), null, '안 보낸 사진은 하루 뒤');
  assert.ok((await store.photoOf(p1)).bytes, '7일 안');
  await store.purgePhotos(Date.now() + 8 * 86400000); assert.equal((await store.photoOf(p1)).bytes, null, '7일 뒤');
  assert.deepEqual((await store.messages(room.id)).find((m) => m.seq === msg.seq).photos.map((p) => p.gone), [true, true]);
  const p3 = await store.addPhoto(room.id, 'a', JPEG(), 10, 10); const m2 = await store.post(room.id, 'a', '하나'); await store.attachPhotos(room.id, 'a', m2.seq, [p3]);
  await store.unsend(room.id, m2.seq); assert.equal((await store.photoOf(p3)).bytes, null, '보내기 취소');
  // (Codex 6차 P3) one of them already taken: none taken, the free one still free; two messages at once: one takes it
  const p4 = await store.addPhoto(room.id, 'a', JPEG(), 10, 10); const p5 = await store.addPhoto(room.id, 'a', JPEG(), 10, 10);
  const m3 = await store.post(room.id, 'a', '셋'); const m4 = await store.post(room.id, 'a', '넷'); assert.equal(await store.attachPhotos(room.id, 'a', m3.seq, [p5]), true);
  assert.equal(await store.attachPhotos(room.id, 'a', m4.seq, [p4, p5]), false); assert.equal(await store.photosFree(room.id, 'a', [p4]), true, '하나라도 못 붙이면 되돌림');
  const both = await Promise.all([store.attachPhotos(room.id, 'a', m3.seq, [p4]), store.attachPhotos(room.id, 'a', m4.seq, [p4])]);
  assert.deepEqual(both.filter(Boolean).length, 1, '동시에 둘이면 하나만');
}

test('메신저 사진 저장소: JSON·PostgreSQL 같은 동작 (올리기·붙이기·7일·하루·보내기 취소)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-photo-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const json = new JsonMessengerStore(path.join(dir, 'messenger.json')); await json.init(); await photosBehave(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresMessengerStore(database.url); t.after(() => pg.pool.end()); await pg.init(); await pg.init(); await photosBehave(pg);
});

// v1.10.279 이모티콘 (notes docs/messenger-emoticons-20261108.md 2절): the store keeps its id (JSON and PostgreSQL), unsent -- gone
async function stickersBehave(store) {
  const room = await store.createRoom('그림방', 'a', ['b']);
  const msg = await store.post(room.id, 'a', '(이모티콘) 안녕!', false, 'islanders1/hi_bomi'); assert.equal(msg.sticker, 'islanders1/hi_bomi');
  const plain = await store.post(room.id, 'a', '글자'); assert.equal(plain.sticker, undefined);
  const shown = await store.messages(room.id); assert.deepEqual(shown.map((m) => [m.text, m.sticker]), [['(이모티콘) 안녕!', 'islanders1/hi_bomi'], ['글자', undefined]]);
  assert.equal((await store.messageAt(room.id, msg.seq)).sticker, 'islanders1/hi_bomi');
  await store.unsend(room.id, msg.seq); const gone = await store.messageAt(room.id, msg.seq); assert.equal(gone.text, ''); assert.equal(gone.sticker, undefined, '보내기 취소');
}

test('메신저 이모티콘 저장소: JSON·PostgreSQL 같은 동작 (그림 이름 저장·보내기 취소)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-sticker-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const json = new JsonMessengerStore(path.join(dir, 'messenger.json')); await json.init(); await stickersBehave(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresMessengerStore(database.url); t.after(() => pg.pool.end()); await pg.init(); await pg.init(); await stickersBehave(pg);
});

test('메신저 사진 API: JPEG만·2MB까지, 보낼 때 붙이기·사진만이면 「📷 사진」, 그 방 사람만 열림·private 캐시, 7일 뒤 410', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-photo-api-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const { req, base } = await boot(t, dir); let ip = 0;
  const call = async (route, body, account, raw = null) => {
    const headers = { 'X-Forwarded-For': `10.79.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(account ? { 'X-Account-Token': account } : {}), ...(raw ? raw.headers : body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: raw || body !== undefined ? 'POST' : 'GET', headers, ...(raw ? { body: raw.body } : body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const type = res.headers.get('content-type') || ''; return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken; const people = {};
  for (const [loginId, nickname] of [['pa_1', '사진가'], ['pb_1', '받는이'], ['pc_1', '남']]) {
    await call('/api/account/signup', { realName: nickname, loginId, password: 'secret123', nickname });
    const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === loginId); await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
    const login = (await call('/api/account/login', { loginId, password: 'secret123' })).data;
    people[loginId] = { token: login.accountToken, id: (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === loginId).id };
    await req(`/api/admin/keys/${people[loginId].id}/messenger`, admin, { allowed: true });
  }
  const { pa_1: a, pb_1: b, pc_1: c } = people;
  const room = (await call('/api/messenger/rooms', { name: '사진', members: [b.id] }, a.token)).data.room;
  const up = (bytes, type = 'image/jpeg', who = a) => call(`/api/messenger/rooms/${room.id}/photos`, undefined, who.token, { headers: { 'Content-Type': type, 'X-Photo-W': '1280', 'X-Photo-H': '720' }, body: bytes });
  assert.equal((await up(Buffer.from('not a jpeg'))).data.error, 'PHOTO_TYPE');
  assert.equal((await up(JPEG(), 'image/png')).data.error, 'PHOTO_TYPE');
  assert.equal((await up(JPEG(2 * 1024 * 1024 + 10))).status, 413, '2MB 넘음');
  const ids = []; for (let k = 0; k < 3; k += 1) { const r = await up(JPEG(200 + k)); assert.equal(r.status, 201, JSON.stringify(r.data)); ids.push(r.data.id); }
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { photos: Array.from({ length: 11 }, () => ids[0]).map((x, k) => `${x.slice(0, -2)}${String(k).padStart(2, '0')}`) }, a.token)).data.error, 'BAD_PHOTOS', '11장');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { photos: [ids[0]] }, b.token)).data.error, 'PHOTO_NOT_READY', '남의 사진으로');
  const sent = (await call(`/api/messenger/rooms/${room.id}/messages`, { photos: ids }, a.token)).data.message;
  assert.equal(sent.text, '📷 사진'); assert.deepEqual(sent.photos.map((p) => [p.id, p.w, p.h]), ids.map((id) => [id, 1280, 720]));
  const seen = (await call(`/api/messenger/rooms/${room.id}/messages?after=0`, undefined, b.token)).data.messages.find((m) => m.seq === sent.seq);
  assert.equal(seen.photos.length, 3); assert.equal((await call('/api/messenger', undefined, b.token)).data.rooms[0].last.text, '📷 사진');
  const got = await call(`/api/messenger/photos/${ids[1]}`, undefined, b.token);
  assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/jpeg'); assert.equal(got.headers.get('cache-control'), 'private, max-age=3600'); assert.equal(got.data.length, JPEG(201).length);
  assert.equal((await call(`/api/messenger/photos/${ids[1]}`, undefined, c.token)).status, 404, '방 밖 사람');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/messages`, { text: '설명 한 줄', photos: [ids[0]] }, a.token)).data.error, 'PHOTO_NOT_READY', '한 번만');
  // v1.10.279 이모티콘: one from the list, alone; its words are the text (the room list, an old page); unsent as a line is
  const say = (body, who = b) => call( /* (받는이: 사진가 is near the 5-second limit) */`/api/messenger/rooms/${room.id}/messages`, body, who.token);
  const list = require('../public/messenger/stickers/stickers.json').stickers; assert.equal(list.length, 24); assert.equal(new Set(list.map((s) => s.id)).size, 24);
  for (const s of list) { /* (every picture there, a whole WebP and the asset's own bytes (its sha256) -- 279 shipped three rewritten as text) */
    for (const [file, sum] of [[s.file, s.sha256], ...(s.anim ? [[s.anim, s.animSha256]] : [])]) {
      const b = await fs.readFile(path.join(__dirname, '../public/messenger/stickers', file));
      assert.equal(b.toString('latin1', 0, 4) + b.toString('latin1', 8, 12), 'RIFFWEBP', file); assert.equal(b.readUInt32LE(4) + 8, b.length, file);
      assert.equal(require('node:crypto').createHash('sha256').update(b).digest('hex'), sum, file);
    }
    if (s.anim) assert.match(s.anim, /^islanders1\/anim\/[a-z_]+\.webp$/);
  }
  assert.ok(list.some((s) => s.anim), '움직이는 그림'); /* (v1.10.281) */
  assert.equal((await say({ sticker: 'islanders1/nope' })).data.error, 'BAD_STICKER', '목록에 없는 이름');
  assert.equal((await say({ sticker: 'islanders1/hi_bomi', text: '안녕' })).status, 400, '글자와 같이');
  assert.equal((await say({ sticker: 'islanders1/hi_bomi', photos: [ids[0]] })).status, 400, '사진과 같이');
  const st = await say({ sticker: 'islanders1/thanks_handeul' }); assert.equal(st.status, 201, JSON.stringify(st.data));
  assert.equal(st.data.message.text, '(이모티콘) 고마워요'); assert.equal(st.data.message.sticker, 'islanders1/thanks_handeul');
  const theirs = (await call(`/api/messenger/rooms/${room.id}/messages?after=0`, undefined, a.token)).data.messages.find((m) => m.seq === st.data.message.seq);
  assert.equal(theirs.sticker, 'islanders1/thanks_handeul'); assert.equal((await call('/api/messenger', undefined, a.token)).data.rooms[0].last.text, '(이모티콘) 고마워요', '방 목록 줄');
  assert.equal((await call(`/api/messenger/rooms/${room.id}/unsend`, { seq: st.data.message.seq }, b.token)).status, 200);
  const undone = (await call(`/api/messenger/rooms/${room.id}/messages?after=0`, undefined, b.token)).data.messages.find((m) => m.seq === st.data.message.seq);
  assert.equal(undone.deleted, true); assert.equal(undone.sticker, undefined, '보내기 취소');
  await req('/api/test/messenger/photo-day', null, { max: 4 }); assert.equal((await up(JPEG())).status, 201, '하루 4장째');
  const over = await up(JPEG()); assert.equal(over.status, 429); assert.equal(over.data.error, 'PHOTO_DAY_LIMIT', '하루 상한');
  await req('/api/test/messenger/photo-day', null, { max: 6 }); const three = await Promise.all([0, 1, 2].map(() => up(JPEG(400000))));
  assert.deepEqual(three.map((r) => r.status).sort(), [201, 201, 429], '(Codex 6차 P3) 동시에 올려도 하루 상한'); await req('/api/test/messenger/photo-day', null, { max: 200 });
  await req('/api/test/messenger/purge', null, { days: 8 });
  assert.equal((await call(`/api/messenger/photos/${ids[1]}`, undefined, b.token)).status, 410, '7일 뒤');
  assert.deepEqual((await call(`/api/messenger/rooms/${room.id}/messages?after=0`, undefined, b.token)).data.messages.find((m) => m.seq === sent.seq).photos.map((p) => p.gone), [true, true, true]);
});
