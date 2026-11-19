'use strict';
// 366 로딩 화면 + 관리자 로딩 팁: the cover's rule (steps, the scene ready -- 368 --, ten smooth frames, 20 s; the short one), the tips (only what is in the game,
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

test('걷히는 때(368): 장면이 「준비됨」(땅 그림·모델 다 옴, 셰이더 컴파일) 뒤 10장면 연속 50 ms 안 -- 아니면 20초, 파일이 멈춘 것만으로는 안 걷힘', () => {
  const smooth = Array(10).fill(16); const rough = [...Array(9).fill(16), 80];
  assert.deepEqual([L.state({ entered: true, elapsed: 100 }).step, L.state({ entered: true, elapsed: 100 }).lift], [1, false]);
  assert.equal(L.state({ entered: true, running: true, ready: false, waiting: 0, frames: smooth, elapsed: 9000 }).lift, false, '조용해도 준비 안 됨(늦은 땅 그림·컴파일)이면 안 걷힘');
  assert.equal(L.state({ entered: true, running: true, ready: false, waiting: 3, frames: smooth, elapsed: 3000 }).lift, false, '그림이 아직 옴');
  assert.equal(L.state({ entered: true, running: true, ready: true, frames: rough, elapsed: 3000 }).lift, false, '느린 장면이 하나');
  assert.equal(L.state({ entered: true, running: true, ready: true, frames: smooth.slice(0, 9), elapsed: 3000 }).lift, false, '10장면이 안 됨');
  const ready = L.state({ entered: true, running: true, ready: true, frames: smooth, elapsed: 3000 }); assert.deepEqual([ready.step, ready.lift, ready.progress, ready.label], [4, true, 1, '준비 완료']);
  const cap = L.state({ entered: true, running: false, elapsed: 20000 }); assert.deepEqual([cap.lift, cap.timedOut], [true, true], '20초면 그냥 열어요');
  const a = L.state({ entered: true, running: true, ready: false, waiting: 8, mostWaiting: 10, elapsed: 2000 }).progress; const b = L.state({ entered: true, running: true, ready: false, waiting: 2, mostWaiting: 10, elapsed: 2000 }).progress; assert.ok(b > a && b < 0.75, '막대는 남은 것이 줄수록 앞으로');
  // the short one (a place change that is not ready): five frames under 100 ms, 8 s at most
  const slowPhone = Array(5).fill(48); assert.equal(L.state({ entered: true, running: true, ready: true, frames: slowPhone, elapsed: 600, short: true }).lift, true, '짧은 덮개: 느린 폰 20 fps도 걷힘');
  assert.equal(L.state({ entered: true, running: true, ready: true, frames: [...Array(4).fill(30), 250], elapsed: 600, short: true }).lift, false, '짧은 덮개: 컴파일 걸림 하나면 기다림');
  assert.equal(L.state({ entered: true, running: true, ready: false, frames: slowPhone, elapsed: 7999, short: true }).lift, false); assert.deepEqual(L.state({ entered: true, running: true, ready: false, elapsed: 8000, short: true }).timedOut, true, '짧은 덮개는 8초면 열어요');
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
