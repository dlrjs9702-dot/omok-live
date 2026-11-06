'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const S = require('../lib/storage-report');
const { boot } = require('../test-support/test-server');

// v1.10.256 관리자 「저장 공간 보기」 (14절): how full against DB_DISK_GB (1), 80 % orange, 90 % red, the biggest tables by an
// easy name, a log line only past 80 %; the API the administrator's only (a file store: its data files)
test('저장 공간: % 계산·주황/빨강·쉬운 이름·로그 줄, 관리자만', async (t) => {
  const GB = 1024 ** 3;
  const r = S.shape('postgres', 0.82 * GB, [{ name: 'messenger_photos', bytes: 600 * 1048576, rows: '1200' }, { name: 'x_unknown', bytes: 5, rows: -1 }], 1);
  assert.deepEqual([r.percent, r.level, r.tables[0].label, r.tables[0].rows, r.tables[1].label, r.tables[1].rows], [82, 'orange', '메신저 사진', 1200, null, 0]);
  assert.deepEqual(S.logLine(r), { line: '[storage] 82% (840 MB / 1 GB) · 1위 메신저 사진 600 MB', warn: true });
  assert.equal(S.shape('postgres', 0.95 * GB, [], 1).level, 'red'); assert.equal(S.shape('postgres', 0.5 * GB, [], 1).level, 'ok');
  assert.deepEqual(S.logLine(S.shape('postgres', 0.12 * GB, [{ name: 'x_unknown', bytes: 80 * 1048576 }], 1)), { line: '[storage] 12% (123 MB / 1 GB) · 1위 x_unknown 80 MB', warn: false }, '늘 하루 한 줄 (총괄 #406)');
  assert.equal(S.shape('postgres', GB, [], 2).percent, 50, 'DB_DISK_GB');
  assert.deepEqual([S.limitGb({}), S.limitGb({ DB_DISK_GB: '4' }), S.limitGb({ DB_DISK_GB: 'x' })], [1, 4, 1]);
  assert.equal(S.shape('postgres', 1, Array.from({ length: 12 }, (_, i) => ({ name: `t${i}`, bytes: 12 - i })), 1).tables.length, 8);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const guest = await server.enter(await server.issue('구경꾼')); assert.ok(guest, server.logs());
  assert.notEqual((await req('/api/admin/storage', guest)).status, 200, '관리자만');
  const got = (await req('/api/admin/storage', server.admin)).data;
  assert.equal(got.kind, 'file'); assert.ok(got.used > 0 && got.limitGb === 1 && got.level === 'ok'); assert.ok(got.tables.some((x) => x.name === 'points.json' && x.label));
  assert.match(server.logs(), /\[storage\] \d+% \(\d+ MB \/ 1 GB\) · 1위 /, '켜질 때 하루 첫 줄');
});
