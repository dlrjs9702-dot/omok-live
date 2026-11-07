'use strict';
// v1.10.268 입장 파일 없애기 + 아이디 저장·자동 로그인 (gamecenter-notes docs/login-keep-no-entry-file-20261107.md): a device kept
// logged in from the island's first screen (keepGame) logs in again by POST /api/account/device-login -- the messenger's own
// kept login does not; a new password or 로그아웃 ends it; 「모두 막기」 stops every account with no id (kept, restorable); on the
// live server (Render, no ALLOW_ENTRY_KEYS) no files are issued.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');

async function server(t, env) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'login-keep-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const s = await boot(t, dir, env); let ip = 0;
  const call = async (route, body, headers = {}) => {
    const res = await fetch(s.base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Forwarded-For': `10.88.0.${++ip % 250 + 1}`, ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const admin = (await s.req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  return { ...s, call, admin };
}

test('자동 로그인: 게임 용도 기기 토큰만 device-login, 메신저 토큰은 403, 비밀번호 바꾸면·로그아웃하면 끝', async (t) => {
  const { req, issue, call, admin } = await server(t);
  const k = await issue('자동손님'); await req('/api/test/login-id', admin, { keyId: k.id, loginId: 'auto_guest' });
  const login = (keepGame, keep) => call('/api/account/login', { loginId: 'auto_guest', password: 'secret123', keepGame, keep, device: '윈도우 크롬', deviceKind: 'pc' });
  assert.equal((await login(false)).data.deviceToken, undefined); // (off by default: nothing kept)
  const game = (await login(true)).data.deviceToken; assert.ok(game);
  const dev = (token) => call('/api/account/device-login', {}, { 'X-Messenger-Device': token });
  const again = await dev(game); assert.equal(again.status, 200); assert.equal(again.data.account.loginId, 'auto_guest');
  assert.equal((await call('/api/account/me', undefined, { 'X-Account-Token': again.data.accountToken })).status, 200);
  assert.equal((await dev('nope'.repeat(10))).status, 401);
  assert.equal((await call('/api/messenger', undefined, { 'X-Messenger-Device': game })).status, 401); // (총괄 검토: a game-only token -- no messenger permission -- not past the messenger's door)
  // the messenger's own kept login (a permitted account): not the game's
  await req(`/api/admin/keys/${k.id}/messenger`, admin, { allowed: true });
  const mess = (await login(false, true)).data.deviceToken; assert.ok(mess);
  assert.equal((await dev(mess)).data.error, 'DEVICE_SCOPE');
  // 로그아웃 with this device: its kept login ends (the other device's stays)
  const other = (await login(true)).data.deviceToken;
  const acct = (await dev(other)).data.accountToken;
  assert.equal((await call('/api/account/logout', {}, { 'X-Account-Token': acct, 'X-Messenger-Device': other })).status, 200);
  assert.equal((await dev(other)).status, 401); assert.equal((await dev(game)).status, 200);
  // a new password: every kept login ends
  assert.equal((await call('/api/account/password', { current: 'secret123', next: 'newsecret9' }, { 'X-Account-Token': again.data.accountToken })).status, 200);
  assert.equal((await dev(game)).status, 401);
});

test('아이디 없는 계정 「모두 막기」: 아이디 있는 계정은 그대로, 막힌 계정은 복구 가능; 관리자만', async (t) => {
  const { req, issue, admin } = await server(t);
  const a = await issue('파일하나'); const b = await issue('파일둘'); const c = await issue('아이디있음'); await req('/api/test/login-id', admin, { keyId: c.id, loginId: 'has_id' });
  const keys = async () => (await req('/api/admin/keys', admin)).data;
  assert.equal((await keys()).entryKeys, true); // (tests: files still made)
  assert.equal((await req('/api/admin/keys/revoke-no-id', null, {})).status, 401);
  const r = await req('/api/admin/keys/revoke-no-id', admin, {}); assert.equal(r.data.revoked, 2);
  const after = (await keys()).keys; assert.ok(after.find((k) => k.id === a.id).revokedAt && after.find((k) => k.id === b.id).revokedAt); assert.equal(after.find((k) => k.id === c.id).revokedAt, null);
  assert.equal((await req(`/api/admin/keys/${a.id}/restore`, admin, {})).status, 200);
});

test('운영(Render, ALLOW_ENTRY_KEYS 없음): 입장 파일 발급·재발급·내 계정 파일 404', async (t) => {
  const { req, call, admin } = await server(t, { NODE_ENV: 'production', RENDER: 'true', ALLOW_ENTRY_KEYS: '' });
  assert.equal((await req('/api/admin/keys', admin)).data.entryKeys, false);
  assert.equal((await req('/api/admin/keys', admin, { label: '새손님' })).status, 404);
  assert.equal((await req('/api/admin/keys/00000000-0000-0000-0000-000000000000/reissue', admin, {})).status, 404);
  assert.equal((await call('/api/account/entry-file', {})).status, 401); // (no login: as before)
});
