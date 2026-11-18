'use strict';
// 366 로딩 화면 + 관리자 로딩 팁: the cover's rule (steps, files quiet, ten smooth frames, 20 s), the tips (only what is in the game,
// switched off, the admin's own -- 60 characters), the API (the list for anyone, the changes for the admin)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const L = require('../public/loading-cover.js');
const Tips = require('../lib/loading-tips');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');

test('걷히는 때: 섬이 그려지고 파일이 1.5초 멈추고 10장면 연속 50 ms 안 -- 아니면 20초', () => {
  const smooth = Array(10).fill(16); const rough = [...Array(9).fill(16), 80];
  assert.deepEqual([L.state({ entered: true, elapsed: 100 }).step, L.state({ entered: true, elapsed: 100 }).lift], [1, false]);
  assert.equal(L.state({ entered: true, running: true, quietMs: 500, frames: smooth, elapsed: 3000 }).lift, false, '파일이 아직 옴');
  assert.equal(L.state({ entered: true, running: true, quietMs: 2000, frames: rough, elapsed: 3000 }).lift, false, '느린 장면이 하나');
  assert.equal(L.state({ entered: true, running: true, quietMs: 2000, frames: smooth.slice(0, 9), elapsed: 3000 }).lift, false, '10장면이 안 됨');
  const ready = L.state({ entered: true, running: true, quietMs: 2000, frames: smooth, elapsed: 3000 }); assert.deepEqual([ready.step, ready.lift, ready.progress, ready.label], [4, true, 1, '준비 완료']);
  const cap = L.state({ entered: true, running: false, elapsed: 20000 }); assert.deepEqual([cap.lift, cap.timedOut], [true, true], '20초면 그냥 열어요');
  const a = L.state({ entered: true, running: true, quietMs: 300, elapsed: 2000 }).progress; const b = L.state({ entered: true, running: true, quietMs: 1200, elapsed: 2000 }).progress; assert.ok(b > a && b < 0.75, '막대는 앞으로만');
  assert.equal(L.pickTip(['a', 'b'], 'a', () => 0.9), 'b', '같은 팁 두 번 연속 없음'); assert.equal(L.pickTip(['a'], 'a'), 'a');
});

test('로딩 팁: 기능이 있는 것만, 끈 것 빼고, 내 팁(60자) 추가·고치기·끄기·지우기, 기본 팁은 켜고 끄기만', () => {
  const shown = Tips.shown({}); assert.ok(shown.length >= 50 && shown.length < Tips.DEFAULTS.length, '기능을 기다리는 팁은 빠짐');
  for (const t of Tips.DEFAULTS.filter((x) => x.needs && !Tips.LIVE.has(x.needs))) assert.ok(!shown.includes(t.text), t.text);
  let doc = Tips.change({}, { id: 'd0', on: false }).doc; assert.ok(!Tips.shown(doc).includes(Tips.DEFAULTS[0].text));
  assert.equal(Tips.change(doc, { add: '가'.repeat(61) }).error, 'TEXT'); doc = Tips.change(doc, { add: '  새 팁이에요  ' }).doc; const own = doc.own[0]; assert.equal(own.text, '새 팁이에요'); assert.ok(Tips.shown(doc).includes('새 팁이에요'));
  doc = Tips.change(doc, { id: own.id, text: '고친 팁' }).doc; assert.ok(Tips.shown(doc).includes('고친 팁'));
  doc = Tips.change(doc, { id: own.id, on: false }).doc; assert.ok(!Tips.shown(doc).includes('고친 팁'));
  assert.equal(Tips.change(doc, { id: 'd1', text: 'x' }).error, 'DEFAULT'); assert.equal(Tips.change(doc, { id: 'd1', remove: true }).error, 'DEFAULT');
  doc = Tips.change(doc, { id: own.id, remove: true }).doc; assert.equal(doc.own.length, 0); assert.equal(Tips.change(doc, { id: 'nope', on: true }).error, 'NO_TIP');
  const view = Tips.adminView(doc); assert.equal(view.defaults.length, Tips.DEFAULTS.length); assert.equal(view.defaults[0].on, false); assert.ok(view.defaults.some((t) => t.waiting));
});

test('로딩 팁 API: 목록은 누구나, 바꾸기는 관리자만, 저장하면 바로 목록에', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'loading-tips-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req, admin } = server; const guest = await server.enter(await server.issue('손님'));
  const before = (await req('/api/island/loading-tips', guest)).data.tips; assert.ok(before.length >= 50);
  assert.ok([401, 403].includes((await req('/api/admin/loading-tips', guest, { add: '몰래' })).status));
  const added = await req('/api/admin/loading-tips', admin, { add: '관리자가 쓴 팁' }); assert.equal(added.status, 200, JSON.stringify(added.data)); assert.equal(added.data.own[0].text, '관리자가 쓴 팁');
  assert.ok((await req('/api/island/loading-tips', guest)).data.tips.includes('관리자가 쓴 팁'));
  assert.equal((await req('/api/admin/loading-tips', admin, { add: '가'.repeat(61) })).data.error, 'BAD_TIP');
});
