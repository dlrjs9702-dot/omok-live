'use strict';
// v1.10.237 한 번 공지 (문제 기록 1103 4, 총괄 237 검토 B7: the seen kept here, the card in a photo, one line of e2e): the island's
// notice comes once for an account -- 「알겠어요」 kept on the server, so a new session (another device) has none; a tests'
// server keeps notices off unless /api/test/notices turns them on for that account
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');

test('한 번 공지 서버: 본 공지는 계정에 남아 새 접속에도 안 뜸, 시험 서버는 켠 계정만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'notice-server-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const { req, issue, enter, release } = await boot(t, dir);
  const key = await issue('공지손님'); let a = await enter(key); const b = await enter(await issue('공지이웃'));
  const list = async (s) => (await req('/api/island/notices', s)).data.notices.map((n) => n.id);
  assert.deepEqual(await list(a), []); // (off on a tests' server)
  assert.equal((await req('/api/test/notices', a, { on: true })).status, 200);
  assert.deepEqual(await list(a), ['trash-20261104']); assert.deepEqual(await list(b), []); // (on for that account only)
  assert.equal((await req('/api/island/notices', a, { id: 'nope' })).data.error, 'BAD_NOTICE');
  assert.equal((await req('/api/island/notices', a, { id: 'trash-20261104' })).status, 200);
  assert.deepEqual(await list(a), []);
  await release(a); a = await enter(key); // (another session of the account: the seen still kept)
  await req('/api/test/notices', a, { on: true }); assert.deepEqual(await list(a), []);
  assert.equal((await req('/api/island/notices', null)).status, 401);
});
