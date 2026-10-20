'use strict';
// 「문제 기록」 쓰기 허용 (사용자 2026-10-20 「메신저 권한 주는 것처럼 문제 기록도 관리자가 권한을 줄 수 있게」): an account the
// administrator allows writes records (who wrote it kept) and reads only its own; any other is refused; the
// administrator's list shows every record and who wrote it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');

test('문제 기록 허용: 허용 안 된 계정은 403, 허용하면 바로 쓰기, 자기 기록만 보고, 관리자는 쓴 사람과 함께 모두 본다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'issue-writers-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req, admin } = server;
  const ka = await server.issue('기록가'); const kb = await server.issue('다른이');
  const a = await server.enter(ka); const b = await server.enter(kb);
  const add = (who, text) => req('/api/issues', who, { action: 'add', text, kind: 'bug', ctx: { screen: 'island' } });
  assert.equal((await req('/api/issues/me', a)).data.allowed, false);
  assert.equal((await add(a, '허용 전')).status, 403);
  assert.equal((await req('/api/issues', a)).status, 403);
  assert.equal((await req('/api/admin/issues', a)).status, 403, '관리자 목록은 관리자만');
  // allowed from the account list: at once
  assert.equal((await req(`/api/admin/keys/${ka.id}/issues`, admin, { allowed: true })).data.issues, true);
  assert.equal((await req('/api/issues/me', a)).data.allowed, true);
  assert.equal((await req('/api/admin/keys', admin)).data.keys.find((k) => k.id === ka.id).issues, true);
  assert.equal((await add(a, '섬에서 이상해요')).status, 201);
  assert.equal((await add(b, '나도')).status, 403, '다른 계정은 그대로');
  assert.equal((await req('/api/admin/issues', admin, { action: 'add', text: '관리자 기록', kind: 'idea' })).status, 201);
  const mine = (await req('/api/issues', a)).data.issues;
  assert.deepEqual(mine.map((i) => i.text), ['섬에서 이상해요'], '자기 것만');
  assert.equal(mine[0].by.label, '기록가');
  const all = (await req('/api/admin/issues', admin)).data.issues;
  assert.deepEqual(all.map((i) => [i.text, i.by?.label]), [['관리자 기록', '관리자'], ['섬에서 이상해요', '기록가']]);
  // a writer cannot change or remove one (the administrator's)
  assert.equal((await req('/api/issues', a, { action: 'status', id: mine[0].id, status: 'done' })).status, 400);
  // taken back: refused again
  await req(`/api/admin/keys/${ka.id}/issues`, admin, { allowed: false });
  assert.equal((await add(a, '해제 뒤')).status, 403);
});
