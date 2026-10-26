'use strict';
// E1 계절 행사 (gamecenter-notes docs/season-events-design-20261025.md): the harvest festival through the real server --
// stamps for its tasks (a day's cap each, the cooking judged by the host, the feast only on the last evening), spent at the
// stall on its goods (furniture into 가구 창고, a title worn), nothing out of its days; the administrator moves its days
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const C = require('../public/plaza/island-calendar');
const T = require('../public/plaza/island-terrain');

test('수확제: 할 일마다 도장(하루 한도), 요리 심사, 마지막 날 저녁 잔치, 가판대 교환(가구·칭호), 기간 밖은 없음, 관리자 기간 옮기기', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'festival-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter, admin } = await boot(t, dir);
  const a = await enter(await issue('수확하는이'));
  const clock = (s) => req('/api/test/festival/clock', null, { at: Date.parse(`${s}+09:00`) });
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  const F = T.FARM; const P = C.PLACES;
  // out of its days: none, the next one named
  await clock('2026-11-19T12:00:00');
  let v = (await req('/api/island/festival', a)).data; assert.equal(v.festival, null); assert.equal(v.next.id, 'harvest-2026');
  assert.equal((await req('/api/island/festival/harvest', a, {})).data.error, 'NO_FESTIVAL');
  // day 1: three harvests at the field (a vegetable and a stamp each), the fourth no; the cooking by the host (three things)
  await clock('2026-11-20T12:00:00');
  // its notice on the board, once
  const notices = async () => { await req('/api/test/notices/due', null, {}); return (await req('/api/announcements', a)).data.items.filter((n) => n.title.startsWith('[행사] 수확제')); };
  assert.deepEqual((await notices()).map((n) => n.title), ['[행사] 수확제 (11/20~11/26)']); assert.equal((await notices()).length, 1);
  await stand({ x: F.x, z: F.z });
  for (let k = 1; k <= 3; k += 1) { const r = await req('/api/island/festival/harvest', a, {}); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.festival.stamps, k); }
  assert.equal((await req('/api/island/festival/harvest', a, {})).data.error, 'TASK_DONE');
  const vegetables = async () => ((await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'harvest') || {}).qty || 0;
  assert.equal(await vegetables(), 3);
  assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })).data.error, 'TOO_FAR');
  await stand(P.host);
  assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'trash', 'harvest'] })).data.error, 'BAD_RECIPE');
  const cooked = await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] }); assert.equal(cooked.status, 200, JSON.stringify(cooked.data));
  assert.ok(cooked.data.score > 0 && cooked.data.say); assert.equal(cooked.data.festival.stamps, 5); assert.equal(await vegetables(), 0);
  assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })).data.error, 'TASK_DONE');
  // the feast only on the last day's evening
  await stand(P.feast); assert.equal((await req('/api/island/festival/feast', a, {})).data.error, 'TASK_CLOSED');
  // day 2: five more -> the title (10)
  await clock('2026-11-21T12:00:00'); await stand({ x: F.x, z: F.z }); for (let k = 0; k < 3; k += 1) await req('/api/island/festival/harvest', a, {});
  await stand(P.host); assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })).data.festival.stamps, 10);
  await stand(P.feast); assert.equal((await req('/api/island/festival/buy', a, { id: 'title_harvest' })).data.error, 'TOO_FAR'); // (the host stands at the stall: from there it is in reach)
  await stand(P.stall); const title = await req('/api/island/festival/buy', a, { id: 'title_harvest' }); assert.equal(title.status, 200, JSON.stringify(title.data)); assert.equal(title.data.festival.stamps, 0);
  assert.equal((await req('/api/island/festival/buy', a, { id: 'title_harvest' })).data.error, 'OWNED');
  assert.ok((await req('/api/skins', a)).data.dexTitles.some((x) => x.id === 'title_event_harvest'));
  assert.equal((await req('/api/skins/title', a, { skinId: 'title_event_harvest' })).data.avatar.title, '풍년');
  assert.equal((await req('/api/island/festival/buy', a, { id: 'straw_sheaf' })).data.error, 'NOT_ENOUGH');
  // the last day's evening: the feast (3) -> the 볏단 into 가구 창고
  await clock('2026-11-26T19:00:00'); await stand(P.feast); const feast = await req('/api/island/festival/feast', a, {}); assert.equal(feast.status, 200, JSON.stringify(feast.data)); assert.equal(feast.data.festival.stamps, 3);
  await stand(P.stall); assert.equal((await req('/api/island/festival/buy', a, { id: 'straw_sheaf' })).status, 200);
  const pieces = (await req('/api/island/furniture/mine', a)).data.pieces; assert.deepEqual(pieces.map((p) => [p.id, p.name, p.model]), [['straw_sheaf__plain', '볏단 장식', 'harvest.straw_sheaf']]);
  // the next day: over (the stamps with it)
  await clock('2026-11-27T09:00:00'); assert.equal((await req('/api/island/festival', a)).data.festival, null);
  // the administrator: its days moved -- on again for those days
  assert.equal((await req('/api/admin/calendar', admin, { override: { 'harvest-2026': { start: '2026-11-27', end: '2026-11-28' } } })).status, 200);
  assert.equal((await req('/api/island/festival', a)).data.festival.id, 'harvest-2026');
  await req('/api/admin/calendar', admin, { override: { 'harvest-2026': { off: true } } }); assert.equal((await req('/api/island/festival', a)).data.festival, null);
});

test('매주 대회(A안): 토 낚시 3분 판 -- 행사 주민 곁에서 시작, 판 안의 물고기만 점수, 그날 최고 기록·순위, 밤 정산(트로피·칭호·포인트, 토 낚시 1등 영웅마루), 시간 밖은 닫힘', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'contest-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('낚시상')); const b = await enter(await issue('둘째'));
  let now = Date.parse('2026-11-07T12:00:00+09:00'); const clock = (ms) => { now = ms; return req('/api/test/festival/clock', null, { at: ms }); };
  await clock(now);
  const firstNotice = async () => { await req('/api/test/notices/due', null, {}); return (await req('/api/announcements', a)).data.items.filter((n) => n.title === '[대회] 매주 대회 시작').length; };
  assert.equal(await firstNotice(), 1); assert.equal(await firstNotice(), 1); // (the first day's notice, once)
  const P = C.PLACES; const stand = (s, p) => req('/api/plaza/state', s, { x: p.x, z: p.z, yaw: 0, moving: false });
  const press = (seq, n) => seq.slice(0, n).map((dir, i) => ({ dir, t: i * 150 }));
  const catchOne = async (s, species) => { await stand(s, { x: T.PIER.x, z: T.PIER.z }); const c = (await req('/api/island/fish/start', s, {})).data; await req('/api/test/fish/bite', s, { species }); return (await req('/api/island/fish/finish', s, { fishId: c.fishId, presses: press(c.seq, c.arrows) })).data; };
  for (const s of [a, b]) await req('/api/test/island/give', s, { itemId: 'fishing_rod', qty: 1 });
  assert.equal((await catchOne(a, 'anchovy')).species, 'anchovy'); // (before a round: no score)
  assert.equal((await req('/api/island/weekly/start', a, {})).data.error, 'TOO_FAR');
  await stand(a, P.host); const started = await req('/api/island/weekly/start', a, {}); assert.equal(started.status, 200, JSON.stringify(started.data)); assert.equal(started.data.gift, '낚시 미끼');
  assert.equal((await req('/api/island/weekly/start', a, {})).data.error, 'ROUND_ON');
  await catchOne(a, 'octopus'); await catchOne(a, 'anchovy');
  const during = (await req('/api/island/weekly', a)).data; assert.ok(during.round.score > 0 && during.round.left > 0, JSON.stringify(during));
  await clock(now + 4 * 60 * 1000); await catchOne(a, 'giant_tuna'); // (after the three minutes: not counted)
  const after = (await req('/api/island/weekly', a)).data; assert.equal(after.round, null); assert.equal(after.mine.best, during.round.score); assert.equal(after.mine.rank, 1);
  await stand(b, P.host); await req('/api/island/weekly/start', b, {}); await catchOne(b, 'anchovy'); await clock(now + 4 * 60 * 1000);
  const top = (await req('/api/island/weekly', b)).data.top; assert.deepEqual(top.map((x) => x.name), ['낚시상', '둘째']);
  // closed outside its hours and on a weekday
  await clock(Date.parse('2026-11-07T23:00:00+09:00')); await stand(a, P.host); assert.equal((await req('/api/island/weekly/start', a, {})).data.error, 'CONTEST_CLOSED');
  await clock(Date.parse('2026-11-09T12:00:00+09:00')); assert.equal((await req('/api/island/weekly/start', a, {})).data.error, 'CONTEST_CLOSED');
  // the night's settlement: 1st and 2nd -- points, title, trophy; Saturday's 1st on 영웅마루 -- settled by the minute's
  // check even when the server slept from Saturday night to Tuesday (C3 ③)
  const before = (await req('/api/points', a)).data.balance;
  await clock(Date.parse('2026-11-10T12:00:00+09:00')); await req('/api/test/weekly/settle', null, { all: true });
  const settledRes = await req('/api/test/weekly/settle', null, { day: '2026-11-07' }); const settled = settledRes.data.result; assert.ok(settled, JSON.stringify(settledRes)); assert.deepEqual(settled.top.map((x) => [x.rank, x.name]), [[1, '낚시상'], [2, '둘째']]);
  assert.equal((await req('/api/points', a)).data.balance, before + 10000);
  assert.ok((await req('/api/skins', a)).data.dexTitles.some((x) => x.id === 'title_contest_fish_1'));
  assert.deepEqual((await req('/api/island/furniture/mine', a)).data.pieces.map((p) => p.id), ['trophy_fish__gold']);
  assert.deepEqual((await req('/api/island/furniture/mine', b)).data.pieces.map((p) => p.id), ['trophy_fish__silver']);
  const statues = (await req('/api/donation', a)).data.statues; assert.ok(statues.some((s) => s.contest && s.name === '낚시상' && s.label === '낚시 대회'), JSON.stringify(statues));
  await req('/api/test/weekly/settle', null, { day: '2026-11-07' }); assert.equal((await req('/api/points', a)).data.balance, before + 10000, '정산은 한 번');
  await clock(0);
});