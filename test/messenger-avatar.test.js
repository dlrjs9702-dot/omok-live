'use strict';
// 1.10.373 메신저 프로필 사진 (사용자 2026-11-19 「메신저 프로필 사진 하나 넣어서 사용할 수 잇게」, notes docs/messenger-profile-photo-20261119.md):
// one picture an account (a new one over the old, its version new), WebP or JPEG only, 64 KB at most, 3 changes in 5 minutes; only the
// messenger's own accounts fetch it (no public address); 「기본으로」 back to the letter circle. JSON and PostgreSQL alike.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonMessengerStore, PostgresMessengerStore } = require('../lib/messenger-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

const WEBP = (n = 300, fill = 7) => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 0), Buffer.from('WEBP'), Buffer.alloc(n, fill)]);
const JPEG = (n = 300) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7)]);

async function avatarsBehave(store) {
  assert.equal(await store.avatarOf('a'), null); assert.deepEqual(await store.avatarVersions(), {});
  const v1 = await store.setAvatar('a', WEBP(200, 1), 'image/webp'); const got = await store.avatarOf('a');
  assert.equal(got.type, 'image/webp'); assert.ok(got.bytes.equals(WEBP(200, 1))); assert.equal(got.v, v1);
  await new Promise((r) => setTimeout(r, 5)); const v2 = await store.setAvatar('a', JPEG(100), 'image/jpeg'); assert.ok(v2 > v1, '바꾸면 새 버전');
  const now = await store.avatarOf('a'); assert.equal(now.type, 'image/jpeg'); assert.ok(now.bytes.equals(JPEG(100)), '덮어씀');
  await store.setAvatar('b', WEBP(), 'image/webp'); assert.deepEqual(Object.keys(await store.avatarVersions()).sort(), ['a', 'b']);
  assert.equal(await store.clearAvatar('a'), true); assert.equal(await store.avatarOf('a'), null); assert.deepEqual(Object.keys(await store.avatarVersions()), ['b']); assert.equal(await store.clearAvatar('a'), false);
}

test('메신저 프로필 사진 저장소: JSON·PostgreSQL 같은 동작 (한 장·덮어쓰기·버전·기본으로)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-avatar-')); rmAtExit(dir);
  const json = new JsonMessengerStore(path.join(dir, 'messenger.json')); await json.init(); await avatarsBehave(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresMessengerStore(database.url); t.after(() => pg.pool.end()); await pg.init(); await pg.init(); await avatarsBehave(pg);
});

test('메신저 프로필 사진 API: WebP·JPEG만·64KB까지·5분에 3번, 메신저 계정만 받음, 목록에 버전, 기본으로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'messenger-avatar-api-')); rmAtExit(dir);
  const { req, base } = await boot(t, dir); let ip = 0;
  const call = async (route, body, account, raw = null) => {
    const headers = { 'X-Forwarded-For': `10.81.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(account ? { 'X-Account-Token': account } : {}), ...(raw ? raw.headers : body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: raw || body !== undefined ? 'POST' : 'GET', headers, ...(raw ? { body: raw.body } : body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const type = res.headers.get('content-type') || ''; return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken; const people = {};
  for (const [loginId, nickname, allowed] of [['av_1', '얼굴', true], ['av_2', '친구', true], ['av_3', '바깥', false]]) {
    await call('/api/account/signup', { realName: nickname, loginId, password: 'secret123', nickname });
    const signup = (await req('/api/admin/signups', admin)).data.signups.find((s) => s.loginId === loginId); await req(`/api/admin/signups/${signup.id}/approve`, admin, {});
    const login = (await call('/api/account/login', { loginId, password: 'secret123' })).data;
    people[loginId] = { token: login.accountToken, id: (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === loginId).id };
    if (allowed) await req(`/api/admin/keys/${people[loginId].id}/messenger`, admin, { allowed: true });
  }
  const A = people.av_1; const B = people.av_2; const C = people.av_3;
  const up = (who, body, type = 'image/webp') => call('/api/messenger/avatar', undefined, who.token, { headers: { 'Content-Type': type }, body });
  assert.equal((await up(A, Buffer.from('<svg></svg>'), 'image/svg+xml')).status, 415, '다른 형식');
  assert.equal((await up(A, JPEG(), 'image/webp')).status, 415, '형식과 내용이 다름');
  assert.equal((await up(A, WEBP(70 * 1024))).status, 413, '64KB 넘음');
  const r1 = await up(A, WEBP(500)); assert.equal(r1.status, 200, JSON.stringify(r1.data)); assert.ok(r1.data.v > 0);
  // B (messenger) sees A's version in the list and gets the picture -- private, kept long by its version; C (no messenger) does not
  const list = (await call('/api/messenger', undefined, B.token)).data; assert.equal(list.photos[A.id], r1.data.v); assert.equal(list.photos[B.id], undefined);
  const pic = await call(`/api/messenger/avatars/${encodeURIComponent(A.id)}?v=${r1.data.v}`, undefined, B.token); assert.equal(pic.status, 200); assert.equal(pic.headers.get('content-type'), 'image/webp'); assert.ok(pic.data.equals(WEBP(500)));
  assert.match(pic.headers.get('cache-control'), /private/);
  assert.equal((await call(`/api/messenger/avatars/${encodeURIComponent(A.id)}`, undefined, C.token)).status, 403, '메신저 아닌 계정');
  assert.equal((await call(`/api/messenger/avatars/${encodeURIComponent(A.id)}`, undefined, null)).status, 401, '로그인 없음');
  assert.equal((await call(`/api/messenger/avatars/${encodeURIComponent(C.id)}`, undefined, B.token)).status, 404, '메신저 밖 사람의 것은 없음');
  // a new one over it (JPEG this time), then the 4th change in 5 minutes refused
  const r2 = await up(A, JPEG(400), 'image/jpeg'); assert.equal(r2.status, 200); assert.ok(r2.data.v >= r1.data.v);
  assert.equal((await call(`/api/messenger/avatars/${encodeURIComponent(A.id)}`, undefined, B.token)).headers.get('content-type'), 'image/jpeg', '덮어씀');
  assert.equal((await up(A, WEBP(10))).status, 200); assert.equal((await up(A, WEBP(10))).status, 429, '5분에 3번');
  // 기본으로
  assert.equal((await call('/api/messenger/avatar/clear', {}, A.token)).status, 200);
  assert.equal((await call(`/api/messenger/avatars/${encodeURIComponent(A.id)}`, undefined, B.token)).status, 404);
  assert.equal((await call('/api/messenger', undefined, B.token)).data.photos[A.id], undefined);
});
