'use strict';
// 1.10.324 스스로 알려 주는 섬 (lib/client-report.js; notes docs/direction-ideas-20261110.md ②): the screens' errors and frame rates
// summed for the day's `[client]` line -- an error's first line with addresses, ids and tokens blanked; kinds and samples
// bounded; never an account or a name; the server's way in: a signed-in page, 20 a minute
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const C = require('../lib/client-report');

test('화면 오류·느린 기기 모으기: 첫 줄만, 주소·아이디·토큰 지움, 종류별로 셈, 기기별 프레임 분포, 상한', () => {
  assert.equal(C.clean('TypeError: x is undefined @ app.js:10:2 at f\n    at g (https://island-dalmaru.onrender.com/plaza/plaza-scene.js?v=3:1:2)'), 'TypeError: x is undefined @ app.js:10:2 at f');
  assert.equal(C.clean('fetch https://island-dalmaru.onrender.com/api/island/bag?token=abc failed'), 'fetch /api/island/bag failed');
  assert.equal(C.clean('room 11111111-2222-4333-8444-555555555555 key cQrRrg2ePhFCTxHp_6LMVhsQu6HafCdsNoXgO2GkYhE'), 'room <id> key <id>');
  assert.ok(C.clean('x'.repeat(500)).length <= C.MAX_TEXT);
  const r = C.createReports();
  for (let k = 0; k < 3; k += 1) r.add({ kind: 'error', text: 'TypeError: a @ app.js:1:1', device: 'phone' });
  r.add({ kind: 'error', text: 'RangeError: b', device: 'pc' }); assert.equal(r.add({ kind: 'error', text: '   ' }), false); assert.equal(r.add({ kind: 'nope' }), false);
  for (const fps of [8, 12, 30, 55, 60]) r.add({ kind: 'perf', fps, tier: fps < 20 ? 0 : 2, scale: 60, device: 'phone' });
  r.add({ kind: 'perf', fps: 60, tier: 2, device: 'pc' }); assert.equal(r.add({ kind: 'perf', fps: -1 }), false);
  const s = r.summary('2026-11-16', '1.10.324');
  assert.deepEqual(s.errors[0], { text: 'TypeError: a @ app.js:1:1', n: 3, pc: 0, phone: 3 }); assert.equal(s.kinds, 2); assert.equal(s.reports, 10);
  assert.equal(s.perf.phone.n, 5); assert.equal(s.perf.phone.slow, 40); assert.equal(s.perf.phone.p50, 30); assert.deepEqual(s.perf.phone.tiers, { 0: 2, 1: 0, 2: 3 }); assert.equal(s.perf.pc.n, 1);
  assert.match(r.line('2026-11-16', '1.10.324'), /^\[client\] \{"day":"2026-11-16","version":"1.10.324"/);
  for (let k = 0; k < 300; k += 1) r.add({ kind: 'error', text: `E${k}` }); assert.equal(r.summary('d').kinds, 200, '종류 상한'); assert.equal(r.summary('d').errors.length, 20, '줄에는 20개');
  r.reset(); assert.equal(r.summary('d').reports, 0);
});

test('화면 보고 서버: 들어온 사람만, 1분에 20번, 하루 줄에 아이디·이름 없음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clientreport-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('보고하는사람'));
  assert.equal((await req('/api/client/report', null, { kind: 'error', text: 'x' })).status, 401);
  assert.equal((await req('/api/client/report', a, { kind: 'error', text: 'TypeError: q @ app.js:3:4', device: 'phone' })).data.kept, true);
  assert.equal((await req('/api/client/report', a, { kind: 'perf', fps: 14, tier: 0, scale: 60, device: 'phone' })).data.kept, true);
  let limited = 0; for (let k = 0; k < 25; k += 1) if ((await req('/api/client/report', a, { kind: 'perf', fps: 50, device: 'pc' })).status === 429) limited += 1;
  assert.ok(limited >= 5, '1분에 20번');
  const line = (await req('/api/test/client-report', a)).data.line;
  assert.match(line, /TypeError: q @ app\.js:3:4/); assert.doesNotMatch(line, /보고하는사람|guest:|"userId"/);
});
