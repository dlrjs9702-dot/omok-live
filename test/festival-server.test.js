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

// C4 P3-1: two cooks at once (two tabs) -- one stamped, the other's things given back
test('수확제 요리: 동시에 두 번 내도 재료는 한 벌만 쓰임', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'festival-cook-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('요리두번'));
  const clock = (s) => req('/api/test/festival/clock', null, { at: Date.parse(`${s}+09:00`) });
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  const F = T.FARM; const P = C.PLACES;
  for (const day of ['2026-11-20', '2026-11-21']) { await clock(`${day}T12:00:00`); await stand({ x: F.x, z: F.z }); for (let k = 0; k < 3; k += 1) await req('/api/island/festival/harvest', a, {}); }
  const vegetables = async () => ((await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'harvest') || {}).qty || 0;
  assert.equal(await vegetables(), 6);
  await stand(P.host);
  const both = await Promise.all([0, 1].map(() => req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })));
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], JSON.stringify(both.map((r) => r.data)));
  assert.equal(await vegetables(), 3);
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

// X2 크리스마스 (gamecenter-notes docs/asset-proposal-christmas-20261027.md): a gift from the host's sack for the islander
// named on it (handed over by them, kept across a reload), the snowman rolled on the snow field (each ball sized by the
// server's own clock), stacked and dressed -- the day's snowmen on the field for everyone, whose not told; the gathering by
// the plaza's tree only on the last evening; the stall's title
test('크리스마스: 선물 배달(받는 이웃 곁에서만), 눈사람(서버 시계 크기·눈밭 안·꾸밈), 그날 눈사람 목록, 성탄 저녁 모임, 칭호', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'festival-xmas-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('산타돕기')); const b = await enter(await issue('구경꾼'));
  const N = require('../public/plaza/island-npcs');
  const clock = (s) => req('/api/test/festival/clock', null, { at: Date.parse(`${s}+09:00`) });
  const stand = (p, who = a) => req('/api/plaza/state', who, { x: p.x, z: p.z, yaw: 0, moving: false });
  const P = C.PLACES; const S = P.snow; const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  await clock('2026-12-19T12:00:00');
  const v = (await req('/api/island/festival', a)).data; assert.equal(v.festival.id, 'christmas-2026'); assert.deepEqual(v.snowmen, []);
  assert.deepEqual(v.festival.tasks.map((x) => [x.id, x.stamps, x.perDay]), [['gift', 1, 3], ['snowman', 3, 1], ['gather', 6, 1], ['contest', 1, 1]]);
  // 선물 배달: from the sack by the host; held till handed to them (a second one not before)
  assert.equal((await req('/api/island/festival/gift', a, { step: 'take' })).data.error, 'TOO_FAR');
  await stand(P.host); const took = await req('/api/island/festival/gift', a, { step: 'take' }); assert.equal(took.status, 200, JSON.stringify(took.data));
  const { n } = took.data.gift; assert.ok(took.data.gift.name && took.data.gift.where && ['red', 'green', 'blue'].includes(took.data.gift.box));
  assert.equal((await req('/api/island/festival/gift', a, { step: 'take' })).data.error, 'GIFT_HELD');
  assert.equal((await req('/api/island/festival', a)).data.festival.gift.n, n); // (kept: a reload draws it in my hands again)
  const by = async (k) => { await stand(N.residentAt(k, Date.now())); };
  assert.equal((await req('/api/island/festival/gift', a, { step: 'give', n })).data.error, 'TOO_FAR');
  const other = (n + 1) % N.COUNT; await by(other); assert.equal((await req('/api/island/festival/gift', a, { step: 'give', n: other })).data.error, 'WRONG_RESIDENT');
  await by(n); const gave = await req('/api/island/festival/gift', a, { step: 'give', n }); assert.equal(gave.status, 200, JSON.stringify(gave.data));
  assert.equal(gave.data.added, 1); assert.equal(gave.data.festival.stamps, 1); assert.equal(gave.data.festival.gift, null);
  // 눈사람: rolled only on the field, each ball as big as the server's clock says, three stacked biggest first, dressed
  await stand(P.host); assert.equal((await req('/api/island/festival/snowman', a, { step: 'roll' })).data.error, 'TOO_FAR');
  await stand({ x: S.x, z: S.z }); assert.equal((await req('/api/island/festival/snowman', a, { step: 'finish', parts: {} })).data.error, 'SNOW_NOT_STACKED');
  assert.equal((await req('/api/island/festival/snowman', a, { step: 'drop' })).data.error, 'NOT_ROLLING');
  for (let k = 0; k < 3; k += 1) {
    assert.equal((await req('/api/island/festival/snowman', a, { step: 'roll', scale: 9 })).status, 200);
    if (k === 0) assert.equal((await req('/api/island/festival/snowman', a, { step: 'drop' })).data.error, 'TOO_SHORT');
    await wait(1600 + k * 300); const d = await req('/api/island/festival/snowman', a, { step: 'drop', size: 9 }); assert.equal(d.status, 200, JSON.stringify(d.data));
    assert.ok(d.data.size >= 0.35 && d.data.size < 0.7, `${d.data.size}`); // (what the screen says is not taken)
  }
  assert.equal((await req('/api/island/festival/snowman', a, { step: 'roll' })).data.error, 'SNOW_STACKED');
  const made = await req('/api/island/festival/snowman', a, { step: 'finish', parts: { carrot: 1, coal: 5, twig: 2, bucket: 1, scarf: 1 } }); assert.equal(made.status, 200, JSON.stringify(made.data));
  assert.equal(made.data.added, 3); assert.equal(made.data.festival.stamps, 4); assert.ok(made.data.score > 0 && made.data.say);
  assert.deepEqual(made.data.snowmen.map((m) => [m.name, m.mine, m.slot, m.balls.length, m.parts.coal]), [['산타돕기', true, 0, 3, 5]]);
  const seen = (await req('/api/island/festival', b)).data.snowmen; assert.deepEqual(seen.map((m) => [m.name, m.mine]), [['산타돕기', false]]); assert.equal(seen[0].account, undefined);
  await stand({ x: S.x, z: S.z }); assert.equal((await req('/api/island/festival/snowman', a, { step: 'roll' })).data.error, 'TASK_DONE');
  // 성탄 저녁 모임: the last day only, 18~22시, by the plaza's tree
  await stand({ x: P.tree.x, z: P.tree.z - 7.5 }); assert.equal((await req('/api/island/festival/gather', a, {})).data.error, 'TASK_CLOSED');
  await clock('2026-12-25T17:30:00'); assert.equal((await req('/api/island/festival/gather', a, {})).data.error, 'TASK_CLOSED');
  await clock('2026-12-25T19:00:00'); await stand(P.host); assert.equal((await req('/api/island/festival/gather', a, {})).data.error, 'TOO_FAR');
  await stand({ x: P.tree.x, z: P.tree.z - 7.5 }); const gathered = await req('/api/island/festival/gather', a, {}); assert.equal(gathered.status, 200, JSON.stringify(gathered.data)); assert.equal(gathered.data.festival.stamps, 10);
  assert.deepEqual((await req('/api/island/festival', a)).data.snowmen, []); // (a new day, a new field)
  // the stall: the title for ten
  await stand(P.stall); const title = await req('/api/island/festival/buy', a, { id: 'title_christmas' }); assert.equal(title.status, 200, JSON.stringify(title.data));
  assert.equal((await req('/api/skins/title', a, { skinId: 'title_event_christmas' })).data.avatar.title, '메리 크리스마스');
  await clock('2026-12-26T09:00:00'); assert.equal((await req('/api/island/festival', a)).data.festival, null);
  await clock(0);
});
