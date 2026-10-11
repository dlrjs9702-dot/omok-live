'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonAccessStore, PostgresAccessStore, hashPassword } = require('../lib/access-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

// v1.10.63 아이디·비밀번호 로그인 (IDEAS 2026-10-11): one login id over accounts and waiting sign-ups (case ignored),
// a waiting sign-up is no account, the password only as a hash, a file account's first id once.
async function storeBehaves(store) {
  const hash = await hashPassword('password1');
  const pending = await store.requestSignup({ realName: '홍길동', loginId: 'Hong_1', passwordHash: hash, label: '길동' });
  assert.equal(pending.loginId, 'hong_1');
  assert.ok(pending.pendingAt);
  assert.equal(pending.passwordHash, undefined);
  assert.equal(await store.requestSignup({ realName: '다른', loginId: 'HONG_1', passwordHash: hash, label: '다른' }), null); // a waiting id is taken too
  assert.equal(await store.loginTaken('hong_1'), true);
  assert.equal((await store.list()).some((k) => k.id === pending.id), false); // not an account yet
  assert.equal((await store.listPending()).length, 1);
  assert.equal((await store.findLogin('HONG_1')).passwordHash, hash);
  const approved = await store.approve(pending.id);
  assert.equal(approved.pendingAt, null);
  assert.equal((await store.list()).find((k) => k.id === pending.id).loginId, 'hong_1');
  assert.equal(await store.approve(pending.id), null); // once

  const file = await store.create('파일손님', 'x'.repeat(40));
  assert.equal(await store.setLogin(file.id, 'hong_1', hash), false); // taken
  assert.equal((await store.setLogin(file.id, 'file_user', hash)).loginId, 'file_user');
  assert.equal(await store.setLogin(file.id, 'again_id', hash), null); // only the first time
  assert.equal((await store.validateAndRecord('x'.repeat(40))).loginId, 'file_user'); // the file still works

  const rejected = await store.requestSignup({ realName: '거절', loginId: 'nope_id', passwordHash: hash, label: '거절' });
  assert.ok(await store.rejectPending(rejected.id));
  assert.equal(await store.loginTaken('nope_id'), false); // the id is free again
  assert.equal(await store.rejectPending(pending.id), null); // an account is not a sign-up
}

test('계정 저장소: JSON — 아이디 하나(대기 신청 포함·대소문자 무시), 대기 신청은 계정 아님', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'account-'));
  const store = new JsonAccessStore(path.join(dir, 'access-keys.json'));
  await store.init();
  await storeBehaves(store);
  await fs.rm(dir, { recursive: true, force: true });
});

test('계정 저장소: PostgreSQL — 같은 동작, 동시에 같은 아이디는 하나만', async (t) => {
  const database = await testDatabase();
  t.after(() => database.stop());
  const store = new PostgresAccessStore(database.url);
  t.after(() => store.pool.end());
  await store.init();
  await store.init(); // the columns and index once
  await storeBehaves(store);
  const hash = await hashPassword('password1');
  const both = await Promise.all(['Race_id', 'race_ID'].map((loginId, i) => store.requestSignup({ realName: '동시', loginId, passwordHash: hash, label: `동시${i}` })));
  assert.equal(both.filter(Boolean).length, 1);
});

test('계정 API: 가입 신청 → 승인 대기 → 승인 → 로그인 → 게임 접속, 파일 재발급·비밀번호 변경·초기화, 파일 계정 설정 강제', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'account-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter, release, base } = await boot(t, dir);
  let ip = 0;
  const call = async (route, body, account) => {
    const headers = { 'X-Forwarded-For': `10.77.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(account ? { 'X-Account-Token': account } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const entry = async (form) => {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
    const html = await res.text();
    return { status: res.status, session: html.match(/data-session="([^"]+)"/)?.[1] || '', setup: html.match(/data-setup="([^"]*)"/)?.[1] || '' };
  };
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;

  assert.equal((await call('/api/account/check-id', { loginId: 'ab' })).status, 400);
  assert.equal((await call('/api/account/check-id', { loginId: 'Player_1' })).data.available, true);
  const signup = { realName: '김철수', loginId: 'Player_1', password: 'secret123', nickname: '철수' };
  assert.equal((await call('/api/account/signup', { ...signup, password: 'short' })).status, 400);
  assert.equal((await call('/api/account/signup', signup)).status, 201);
  assert.equal((await call('/api/account/check-id', { loginId: 'PLAYER_1' })).data.available, false); // waiting counts
  assert.equal((await call('/api/account/signup', { ...signup, nickname: '영희' })).data.error, 'LOGIN_ID_TAKEN');
  assert.equal((await call('/api/account/login', { loginId: 'player_1', password: 'secret123' })).data.error, 'PENDING');

  const signups = (await req('/api/admin/signups', admin)).data.signups;
  assert.deepEqual(signups.map((s) => [s.realName, s.loginId, s.nickname]), [['김철수', 'player_1', '철수']]);
  assert.equal((await req('/api/admin/signups', null)).status, 401);
  assert.equal((await req(`/api/admin/signups/${signups[0].id}/approve`, admin, {})).status, 200);

  assert.equal((await call('/api/account/login', { loginId: 'player_1', password: 'wrong-pass' })).data.error, 'BAD_LOGIN');
  const login = await call('/api/account/login', { loginId: 'PLAYER_1', password: 'secret123' });
  assert.equal(login.status, 200);
  const account = login.data.accountToken;
  assert.deepEqual((await call('/api/account/me', undefined, account)).data.account, { loginId: 'player_1', label: '철수', realName: '김철수' });
  assert.equal((await call('/api/account/me')).status, 401);

  // 게임 접속: the same entry as a file -- and one place at a time
  const first = await entry({ account });
  assert.ok(first.session);
  assert.equal((await req('/api/session', first.session)).data.label, '철수');
  assert.equal((await entry({ account })).status, 409);
  await release(first.session);

  // 입장 파일 받기: a new file each time, the one before stops working
  const file1 = (await call('/api/account/entry-file', {}, account)).data;
  const token1 = file1.html.match(/name="token" value="([^"]+)"/)[1];
  const file2 = (await call('/api/account/entry-file', {}, account)).data;
  const token2 = file2.html.match(/name="token" value="([^"]+)"/)[1];
  assert.equal((await entry({ token: token1 })).status, 403);
  const byFile = await entry({ token: token2 });
  assert.ok(byFile.session); // an account with an id goes straight in
  await release(byFile.session);

  // 비밀번호 변경: the current one first; other logins of the account end
  const other = (await call('/api/account/login', { loginId: 'player_1', password: 'secret123' })).data.accountToken;
  assert.equal((await call('/api/account/password', { current: 'nope-nope', next: 'newsecret1' }, account)).status, 403);
  assert.equal((await call('/api/account/password', { current: 'secret123', next: 'newsecret1' }, account)).status, 200);
  assert.equal((await call('/api/account/me', undefined, other)).status, 401);
  assert.equal((await call('/api/account/me', undefined, account)).status, 200);
  assert.equal((await call('/api/account/login', { loginId: 'player_1', password: 'newsecret1' })).status, 200);

  // 관리자 비밀번호 초기화
  const keyId = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.loginId === 'player_1').id;
  const reset = (await req(`/api/admin/keys/${keyId}/password-reset`, admin, {})).data;
  assert.equal(reset.loginId, 'player_1');
  assert.equal((await call('/api/account/me', undefined, account)).status, 401); // logins end
  assert.equal((await call('/api/account/login', { loginId: 'player_1', password: reset.password })).status, 200);

  // an entry-file account with no id: the setup first (no entering before), then the game
  const guest = await issue('파일손님');
  await req('/api/test/account-setup', null, { keyId: guest.id });
  const gated = await entry({ token: guest.key });
  assert.equal(gated.session, '');
  assert.ok(gated.setup);
  assert.equal((await call('/api/account/setup', { ticket: gated.setup, loginId: 'player_1', password: 'filepass1' })).data.error, 'LOGIN_ID_TAKEN');
  const set = await call('/api/account/setup', { ticket: gated.setup, loginId: 'File_Guest', password: 'filepass1' });
  assert.equal(set.status, 200);
  assert.equal((await call('/api/account/setup', { ticket: gated.setup, loginId: 'other_id', password: 'filepass1' })).status, 403); // used up
  const played = await entry({ account: set.data.accountToken });
  assert.ok(played.session);
  await release(played.session);
  const again = await entry({ token: guest.key }); // the file still works, now without the setup
  assert.ok(again.session);
  void enter;
});
