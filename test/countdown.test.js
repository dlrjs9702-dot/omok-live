'use strict';
// X2 카운트다운 (gamecenter-notes docs/asset-proposal-christmas-20261027.md 「X2 행사 결정」): the year's last night from 18:00 to
// 01:00 -- the board's words by the server's clock, and round the board in the new year's first ten minutes the title
// 「해피 뉴 이어」 and the festival's one stamp (no stall: it opens the end story after 01:00, to those who have it)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const C = require('../public/plaza/island-calendar');
const Story = require('../public/plaza/island-story');

const at = (s) => Date.parse(`${s}+09:00`);

test('카운트다운: 행사 창 18:00~01:00(날짜 넘김), 판 글 단계, 0시 칭호 창, 이야기 종류', () => {
  assert.equal(C.festivalAt(at('2026-12-31T17:59:59')), null);
  assert.equal(C.festivalAt(at('2026-12-31T18:00:00')).id, 'countdown-2026');
  assert.equal(C.festivalAt(at('2027-01-01T00:59:59')).id, 'countdown-2026');
  assert.equal(C.festivalAt(at('2027-01-01T01:00:00')), null);
  assert.equal(C.festivalAt(at('2026-12-25T20:00:00')).id, 'christmas-2026', '크리스마스는 그대로 날 단위');
  const f = C.festivalAt(at('2026-12-31T20:00:00'));
  assert.ok(Story.EVENTS[Story.eventKind(f.id)], '시작·끝 이야기가 붙는 종류(countdown)'); assert.equal(f.shop.length, 0, '도장 가게 없음');
  const text = (s) => C.countdownText(at(s), f);
  assert.deepEqual(text('2026-12-31T22:59:59'), { phase: 'wait', text: '2026 → 2027', sub: '23시부터 카운트다운' });
  assert.equal(text('2026-12-31T23:00:00').text, '60:00'); assert.equal(text('2026-12-31T23:59:11').text, '00:49');
  assert.deepEqual([text('2026-12-31T23:59:50').phase, text('2026-12-31T23:59:50').text], ['last', '10']);
  assert.equal(text('2026-12-31T23:59:59.900').text, '1');
  assert.deepEqual([text('2027-01-01T00:00:00').phase, text('2027-01-01T00:00:00').text], ['new', '2027']);
  const open = (s) => C.taskOpen(C.festivalAt(at(s)), 'midnight', at(s));
  assert.deepEqual(['2026-12-31T23:59:59', '2027-01-01T00:00:00', '2027-01-01T00:09:59', '2027-01-01T00:10:00'].map(open), [false, true, true, false]);
  assert.equal(C.titleOf('title_event_newyear').name, '해피 뉴 이어');
});

test('카운트다운 서버: 0시 둘레만 칭호·도장 1(한 번), 23:59:59·0:10·둘레 밖 ×, 끝나면(01:00 뒤) 도장 있는 계정만 끝 이야기', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'countdown-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('새해맞이')); const b = await enter(await issue('멀리선이'));
  const clock = (s, tick = false) => req('/api/test/festival/clock', null, { at: at(s), tick });
  const stand = (who, p) => req('/api/plaza/state', who, { x: p.x, z: p.z, yaw: 0, moving: false });
  const B = C.PLACES.board; const claim = (who) => req('/api/island/festival/midnight', who, {});
  await clock('2026-12-31T20:00:00');
  const v = (await req('/api/island/festival', a)).data; assert.equal(v.festival.id, 'countdown-2026'); assert.equal(v.now, at('2026-12-31T20:00:00'), '판의 초는 서버 시계로');
  assert.deepEqual(v.festival.shop, []); assert.deepEqual(v.festival.tasks.map((x) => x.id), ['midnight']);
  await stand(a, { x: B.x, z: B.z + 4 }); await stand(b, { x: B.x + 30, z: B.z + 4 });
  assert.equal((await claim(a)).data.error, 'TASK_CLOSED', '20시');
  await clock('2026-12-31T23:59:59'); assert.equal((await claim(a)).data.error, 'TASK_CLOSED', '23:59:59');
  await clock('2027-01-01T00:00:00');
  assert.equal((await claim(b)).data.error, 'TOO_FAR', '둘레 밖');
  const got = await claim(a); assert.equal(got.status, 200, JSON.stringify(got.data)); assert.equal(got.data.added, 1); assert.equal(got.data.title.name, '해피 뉴 이어');
  assert.equal((await claim(a)).data.error, 'TASK_DONE', '한 번');
  assert.ok((await req('/api/skins', a)).data.dexTitles.some((x) => x.id === 'title_event_newyear'), '칭호 받음');
  assert.equal((await req('/api/skins/title', a, { skinId: 'title_event_newyear' })).data.avatar.title, '해피 뉴 이어');
  await stand(b, { x: B.x + 2, z: B.z + 3 }); await clock('2027-01-01T00:10:00'); assert.equal((await claim(b)).data.error, 'TASK_CLOSED', '0:10 뒤');
  // the end story after 01:00 -- only to the one with the stamp; the running clock (the e2e's) runs on from where it was set
  const story = async (who) => (await req('/api/island/story', who)).data;
  await clock('2027-01-01T00:59:00'); assert.ok(!(await story(a)).fresh.includes('countdown-2026:end'), '아직 행사 중');
  await clock('2027-01-01T01:00:00');
  assert.ok((await story(a)).read.includes('countdown-2026:end'), '도장 있는 계정: 끝 이야기');
  assert.ok(!((await story(b)).read || []).includes('countdown-2026:end'), '도장 없으면 없음');
  await clock('2026-12-31T23:59:58', true); await new Promise((r) => setTimeout(r, 2300));
  assert.ok((await req('/api/island/festival', a)).data.now >= at('2027-01-01T00:00:00'), '흐르는 시험 시계');
});
