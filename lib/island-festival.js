'use strict';
// E1 축제 도장 (gamecenter-notes docs/season-events-design-20261025.md): one account's stamps in one festival, kept in its
// own doc { stamps, spent, days: { [day]: { [task]: n } }, owned: [goodId], gift?, snow? } -- earned by the festival's tasks (a day's cap
// each), spent at its stall on its limited goods (each once), gone with the festival (a new festival, a new doc). Pure: the
// server reads and writes the doc (questApply) and checks where one stands.
const Calendar = require('../public/plaza/island-calendar');
const Items = require('./island-items');

const left = (doc) => Math.max(0, (doc?.stamps || 0) - (doc?.spent || 0));
// what the page shows: the tasks (today's count, open now), the stall's goods (owned), the stamps left
function view(fest, doc, ms) {
  const day = Calendar.dayOf(ms); const today = doc?.days?.[day] || {};
  return {
    id: fest.id, name: fest.name, start: fest.start, end: fest.end, lastDay: fest.lastDay, daysLeft: fest.daysLeft, host: fest.host, say: fest.say,
    tasks: Object.entries(fest.tasks).filter(([id]) => id !== 'contest' || Calendar.CONTEST.on).map(([id, t]) => ({ id, name: t.name, stamps: t.stamps, perDay: t.perDay, today: today[id] || 0, open: Calendar.taskOpen(fest, id, ms) })), /* (381: the weekend contests' line hidden while they are off) */
    shop: fest.shop.map((g) => ({ id: g.id, name: g.name, stamps: g.stamps, kind: g.kind, owned: (doc?.owned || []).includes(g.id) })),
    stamps: left(doc), earned: doc?.stamps || 0,
    gift: doc?.gift || null, snow: doc?.snow || null, // (X2: the gift in my hands and for whom, my snowman under way)
    ...(fest.tasks.cook ? { cookTheme: cookTheme(day) } : {}), /* (381 결정 15: today's theme for the 요리 대회 tab) */
  };
}
// a task done: its stamps, within the day's cap -> { doc, added } | { error }
function award(fest, doc, task, ms, stamps = null) { /* (`stamps`: this time's own -- 381 the cooking's by its score) */
  const t = fest.tasks[task]; if (!t) return { error: 'BAD_TASK' };
  if (!Calendar.taskOpen(fest, task, ms)) return { error: 'TASK_CLOSED' };
  const day = Calendar.dayOf(ms); const today = { ...(doc?.days?.[day] || {}) };
  if ((today[task] || 0) >= t.perDay) return { error: 'TASK_DONE' };
  today[task] = (today[task] || 0) + 1; const n = Number.isInteger(stamps) && stamps > 0 ? stamps : t.stamps;
  /* (only today's counts kept; X2: the gift, the snowman kept. 1.10.395 Codex 381~390 #6: and a later day's -- a request from before Seoul's
     midnight saved after one from after it no longer wipes the new day's counts (the days are YYYY-MM-DD, compared as text)) */
  const later = Object.fromEntries(Object.entries(doc?.days || {}).filter(([d]) => d > day));
  return { doc: { ...doc, stamps: (doc?.stamps || 0) + n, spent: doc?.spent || 0, days: { ...later, [day]: today }, owned: doc?.owned || [] }, added: n };
}
// a good bought with stamps (each once) -> { doc, good } | { error }
function buy(fest, doc, id) {
  const g = fest.shop.find((x) => x.id === id); if (!g) return { error: 'BAD_GOOD' };
  if ((doc?.owned || []).includes(id)) return { error: 'OWNED' };
  if (left(doc) < g.stamps) return { error: 'NOT_ENOUGH' };
  return { doc: { ...doc, spent: (doc?.spent || 0) + g.stamps, owned: [...(doc?.owned || []), id] }, good: g };
}
// 요리 대회: three things from the bag (the island's food: 밭 채소, 열매, 버섯, 약재, any fish), judged by the host -- a
// dearer pot and more kinds score higher; the words follow the score
/* (1.10.395 Codex 381~390 #16: what one grew in one's yard (crop_*) is 밭 채소 too -- on the screen and here alike) */
const isVeg = (id) => id === 'harvest' || /^crop_/.test(id);
const COOKABLE = (id) => isVeg(id) || ['berry', 'mushroom', 'herb'].includes(id) || /^fish_/.test(id);
const kindOf = (id) => (/^fish_/.test(id) ? 'fish' : id);
/* (381 사용자 결정 15 A: a theme a day by Seoul's date, from this list in turn -- a pot that fits it +30 and the host says so; the stamps by the
   score: under 90 one, 90~139 two, 140 and up three) */
const COOK_THEMES = Object.freeze([
  Object.freeze({ id: 'mushroom', name: '버섯이 든 요리', fits: (items) => items.includes('mushroom') }),
  Object.freeze({ id: 'fish', name: '물고기가 든 요리', fits: (items) => items.some((id) => kindOf(id) === 'fish') }),
  Object.freeze({ id: 'berry', name: '열매가 든 요리', fits: (items) => items.includes('berry') }),
  Object.freeze({ id: 'veg2', name: '밭 채소 두 가지 이상', fits: (items) => new Set(items.filter(isVeg)).size >= 2 }), /* (395 Codex #16: two different vegetables, as its name says) */
  Object.freeze({ id: 'three', name: '세 재료가 모두 다른 종류', fits: (items) => new Set(items.map(kindOf)).size === 3 }),
  Object.freeze({ id: 'herb', name: '약재가 든 요리', fits: (items) => items.includes('herb') }),
]);
const THEME_BONUS = 30;
const cookTheme = (day) => { const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000); const t = COOK_THEMES[((n % COOK_THEMES.length) + COOK_THEMES.length) % COOK_THEMES.length]; return { id: t.id, name: t.name }; };
const cookStamps = (score) => (score >= 140 ? 3 : score >= 90 ? 2 : 1);
function judgeCook(items, day = null) {
  if (!Array.isArray(items) || items.length !== 3 || !items.every((id) => typeof id === 'string' && COOKABLE(id) && Items.ITEMS[id])) return { error: 'BAD_RECIPE' };
  const kinds = new Set(items.map(kindOf)).size;
  const theme = day ? cookTheme(day) : null; const themed = Boolean(theme && COOK_THEMES.find((t) => t.id === theme.id).fits(items));
  const score = Math.round(items.reduce((n, id) => n + Items.priceOf(id), 0) / 100) + kinds * 10 + (themed ? THEME_BONUS : 0);
  const say = (themed ? '오늘 주제에 딱 맞아요! ' : '') + (score >= 140 ? '이건 잔칫상에 올려야겠어요! 최고예요.' : score >= 90 ? '구수하고 맛있어요. 솜씨가 좋네요!' : '소박하지만 정성이 느껴져요. 고마워요!');
  return { score, kinds, say, theme, themed, stamps: cookStamps(score) };
}

// X2 선물 배달: a gift from the host's sack for one of the islanders walking about now (not the last one's again when there
// are others), in one of the three wrappings (B 46 winter.gift_box_*) -- kept in the doc till handed over
const GIFT_BOXES = ['red', 'green', 'blue'];
function takeGift(fest, doc, ms, walking, rnd = Math.random) {
  if (!fest.tasks.gift) return { error: 'BAD_TASK' };
  if (doc?.gift) return { error: 'GIFT_HELD' };
  if ((doc?.days?.[Calendar.dayOf(ms)]?.gift || 0) >= fest.tasks.gift.perDay) return { error: 'TASK_DONE' };
  const pool = walking.filter((n) => n !== doc?.lastGift); const from = pool.length ? pool : walking; if (!from.length) return { error: 'NO_RESIDENT' };
  const gift = { n: from[Math.floor(rnd() * from.length) % from.length], box: GIFT_BOXES[Math.floor(rnd() * GIFT_BOXES.length) % GIFT_BOXES.length] };
  return { doc: { ...doc, gift }, gift };
}
// handed to the islander it is for: its stamp (the day's cap counted when handed) -> { doc, added } | { error }
function giveGift(fest, doc, n, ms) {
  if (!doc?.gift) return { error: 'NO_GIFT' }; if (doc.gift.n !== n) return { error: 'WRONG_RESIDENT' };
  const a = award(fest, doc, 'gift', ms); if (a.error) return a;
  const { gift, ...rest } = a.doc; return { doc: { ...rest, lastGift: gift.n }, added: a.added };
}
// X2 눈사람 만들기: three balls rolled on the snow field, each as big as the time it was rolled (the server's own clock --
// never the screen's size), stacked biggest first and dressed; judged on the bottom's size, the stack's balance (each ball
// about three quarters of the one under it) and what dresses it
const SNOW = Object.freeze({ MIN: 0.35, MAX: 1.1, RATE: 0.09, ROLL_MIN_MS: 1500, ROLL_MAX_MS: 12000, BALLS: 3, ROLL_WALK: 3 }); // (RATE: metres across a second rolled)
const ballSize = (ms) => Math.round(Math.min(SNOW.MAX, SNOW.MIN + (SNOW.RATE * Math.min(ms, SNOW.ROLL_MAX_MS)) / 1000) * 100) / 100;
function rollStart(fest, doc, ms, clock = ms, at = null) { // (ms: the festival's day; clock: the server's own time, which sizes the ball; at: where I stand)
  if (!fest.tasks.snowman) return { error: 'BAD_TASK' };
  if ((doc?.days?.[Calendar.dayOf(ms)]?.snowman || 0) >= fest.tasks.snowman.perDay) return { error: 'TASK_DONE' };
  const snow = doc?.snow || { balls: [] }; if (snow.balls.length >= SNOW.BALLS) return { error: 'SNOW_STACKED' };
  return { doc: { ...doc, snow: { ...snow, rolling: clock, ...(at ? { from: { x: at.x, z: at.z } } : {}) } } }; // (rolling again starts the ball over)
}
function rollEnd(doc, clock, at = null) { // (총괄 검토: rolled, not stood still -- 3 m at least from where it started)
  const snow = doc?.snow; if (!Number.isFinite(snow?.rolling)) return { error: 'NOT_ROLLING' };
  if (clock - snow.rolling < SNOW.ROLL_MIN_MS) return { error: 'TOO_SHORT' };
  if (snow.from && (!at || Math.hypot(at.x - snow.from.x, at.z - snow.from.z) < SNOW.ROLL_WALK)) return { error: 'NOT_ROLLED' };
  const size = ballSize(clock - snow.rolling); return { doc: { ...doc, snow: { balls: [...snow.balls, size].sort((a, b) => b - a) } }, size }; // (stacked biggest first)
}
const PARTS = Object.freeze({ carrot: { most: 1, points: 10 }, coal: { most: 5, points: 3 }, twig: { most: 2, points: 5 }, bucket: { most: 1, points: 10 }, scarf: { most: 1, points: 10 } }); // (coal: two eyes, three buttons)
function judgeSnowman(balls, parts) {
  if (!Array.isArray(balls) || balls.length !== SNOW.BALLS) return { error: 'SNOW_NOT_STACKED' };
  const dressed = {}; for (const [k, p] of Object.entries(PARTS)) { const v = Number(parts?.[k]) || 0; dressed[k] = Math.max(0, Math.min(p.most, Math.floor(v))); }
  if (!Object.values(dressed).some(Boolean)) return { error: 'SNOW_BARE' }; // (총괄 검토: dressed by me, one thing at least)
  const [a, b, c] = balls; const fit = (r) => Math.max(0, 20 * (1 - Math.abs(r - 0.75) * 2));
  const score = Math.round(a * 30 + fit(b / a) + fit(c / b) + Object.entries(PARTS).reduce((n, [k, p]) => n + dressed[k] * p.points, 0));
  const say = score >= 100 ? '우와, 마당에서 제일 멋진 눈사람이에요!' : score >= 70 ? '반듯하고 귀여워요. 솜씨가 좋네요!' : '조금 기우뚱하지만 웃는 얼굴이 좋아요!';
  return { score, parts: dressed, say };
}
// (Codex 검토 5차 P3-4 ②) finished and not yet on the field (`unshown`, that day's): the next 「finish」 puts that one up -- no stamps again
function finishSnowman(fest, doc, parts, ms) {
  if (doc?.unshown?.day === Calendar.dayOf(ms)) { const { day, ...done } = doc.unshown; return { doc, ...done }; }
  const j = judgeSnowman(doc?.snow?.balls, parts); if (j.error) return j;
  const a = award(fest, doc, 'snowman', ms); if (a.error) return a;
  const { snow, ...rest } = a.doc; const done = { added: a.added, snowman: { balls: snow.balls, parts: j.parts, score: j.score }, say: j.say };
  return { doc: { ...rest, unshown: { ...done, day: Calendar.dayOf(ms) } }, ...done };
}
// on the field now
const snowmanShown = (doc) => { const { unshown, ...rest } = doc || {}; return unshown ? { doc: rest } : { error: 'NONE' }; };

module.exports = { left, view, award, buy, COOKABLE, judgeCook, COOK_THEMES, THEME_BONUS, cookTheme, cookStamps, GIFT_BOXES, takeGift, giveGift, SNOW, ballSize, rollStart, rollEnd, PARTS, judgeSnowman, finishSnowman, snowmanShown };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const at = (s) => Date.parse(`${s}+09:00`); const fest = Calendar.festivalAt(at('2026-11-21T12:00:00'));
  assert.equal(fest.id, 'harvest-2026'); assert.equal(Calendar.festivalAt(at('2026-11-19T23:59:00')), null); assert.equal(Calendar.festivalAt(at('2026-11-27T00:00:00')), null);
  let doc = null; for (let k = 0; k < 3; k += 1) ({ doc } = award(fest, doc, 'harvest', at('2026-11-21T12:00:00')));
  assert.equal(award(fest, doc, 'harvest', at('2026-11-21T13:00:00')).error, 'TASK_DONE'); assert.equal(left(doc), 3);
  assert.equal(award(fest, doc, 'feast', at('2026-11-21T19:00:00')).error, 'TASK_CLOSED');
  const last = Calendar.festivalAt(at('2026-11-26T19:00:00')); assert.equal(award(last, doc, 'feast', at('2026-11-26T19:00:00')).added, 3);
  assert.equal(buy(fest, doc, 'feast_table').error, 'NOT_ENOUGH'); ({ doc } = buy(fest, doc, 'straw_sheaf')); assert.equal(left(doc), 0); assert.equal(buy(fest, doc, 'straw_sheaf').error, 'OWNED');
  // X2 크리스마스: 55 stamps to be had over its last seven days (선물 21 · 눈사람 21 · 성탄 저녁 6 · 381 섬 대회 7); 1.10.338 (사용자 127A·128A) the
  // festival from 12-1 (some 200 to be had) and the stall's twelve at 142
  const xmas = (d, h = 12) => Calendar.festivalAt(at(`2026-12-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`));
  assert.equal(Calendar.festivalAt(at('2026-11-30T12:00:00')), null); assert.equal(xmas(1).id, 'christmas-2026'); assert.equal(xmas(25, 23).id, 'christmas-2026'); assert.equal(Calendar.festivalAt(at('2026-12-26T00:00:00')), null);
  assert.equal(xmas(1).shop.reduce((n, g) => n + g.stamps, 0), 142);
  let x = null; const walking = [0, 1, 2, 3];
  for (let d = 19; d <= 25; d += 1) {
    const ms = at(`2026-12-${d}T19:00:00`); const fx = xmas(d, 19);
    for (let k = 0; k < 3; k += 1) { const t = takeGift(fx, x, ms, walking); assert.ok(t.gift, `${d} gift ${k}`); assert.equal(giveGift(fx, t.doc, (t.gift.n + 1) % 4, ms).error, 'WRONG_RESIDENT'); ({ doc: x } = giveGift(fx, t.doc, t.gift.n, ms)); }
    assert.equal(takeGift(fx, x, ms, walking).error, 'TASK_DONE');
    assert.equal(finishSnowman(fx, x, {}, ms).error, 'SNOW_NOT_STACKED');
    for (let k = 0; k < 3; k += 1) { ({ doc: x } = rollStart(fx, x, ms, ms, { x: 0, z: 0 })); assert.equal(rollEnd(x, ms + 1000, { x: 5, z: 0 }).error, 'TOO_SHORT'); assert.equal(rollEnd(x, ms + 3000, { x: 2, z: 0 }).error, 'NOT_ROLLED'); ({ doc: x } = rollEnd(x, ms + 3000 + k * 2000, { x: 0, z: 3.2 })); }
    assert.equal(finishSnowman(fx, x, { coal: 0 }, ms).error, 'SNOW_BARE');
    assert.equal(rollStart(fx, x, ms).error, 'SNOW_STACKED');
    const done = finishSnowman(fx, x, { carrot: 1, coal: 9, twig: 2, bucket: true, scarf: 1 }, ms); assert.equal(done.added, 3); assert.deepEqual(done.snowman.parts, { carrot: 1, coal: 5, twig: 2, bucket: 1, scarf: 1 });
    assert.deepEqual(finishSnowman(fx, done.doc, {}, ms).snowman, done.snowman); x = snowmanShown(done.doc).doc; assert.equal(x.unshown, undefined); // (not yet on the field: the same one again; then shown)
    assert.equal(rollStart(fx, x, ms).error, 'TASK_DONE');
    const evening = award(fx, x, 'gather', ms); if (d < 25) assert.equal(evening.error, 'TASK_CLOSED'); else x = evening.doc;
    assert.equal(award(fx, x, 'contest', ms).error, 'TASK_CLOSED'); x = award(fx, x, 'islandContest', ms).doc; // (381: the weekend contests off -- the daily 섬 대회 each day)
  }
  assert.equal(x.stamps, 55); /* (381: 선물 21 · 눈사람 21 · 성탄 저녁 6 · 섬 대회 7) */
  assert.equal(award(xmas(25, 22), x, 'gather', at('2026-12-25T22:00:00')).error, 'TASK_CLOSED'); assert.equal(award(xmas(25, 17), null, 'gather', at('2026-12-25T17:59:00')).error, 'TASK_CLOSED');
  // the snowman: the server's clock sizes the balls (a long roll stops at the most), the balance and the dress count
  assert.equal(ballSize(0), SNOW.MIN); assert.equal(ballSize(60000), SNOW.MAX);
  assert.ok(judgeSnowman([1.1, 0.82, 0.62], { carrot: 1 }).score > judgeSnowman([0.6, 0.6, 0.6], { carrot: 1 }).score);
  assert.ok(judgeSnowman([1, 0.75, 0.56], { carrot: 1, scarf: 1 }).score > judgeSnowman([1, 0.75, 0.56], { carrot: 1 }).score);
  assert.equal(judgeCook(['harvest', 'berry']).error, 'BAD_RECIPE'); assert.ok(judgeCook(['harvest', 'fish_goby', 'mushroom']).score > judgeCook(['berry', 'berry', 'berry']).score);
  console.log('island-festival ok');
}
