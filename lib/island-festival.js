'use strict';
// E1 축제 도장 (gamecenter-notes docs/season-events-design-20261025.md): one account's stamps in one festival, kept in its
// own doc { stamps, spent, days: { [day]: { [task]: n } }, owned: [goodId] } -- earned by the festival's tasks (a day's cap
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
    tasks: Object.entries(fest.tasks).map(([id, t]) => ({ id, name: t.name, stamps: t.stamps, perDay: t.perDay, today: today[id] || 0, open: Calendar.taskOpen(fest, id, ms) })),
    shop: fest.shop.map((g) => ({ id: g.id, name: g.name, stamps: g.stamps, kind: g.kind, owned: (doc?.owned || []).includes(g.id) })),
    stamps: left(doc), earned: doc?.stamps || 0,
  };
}
// a task done: its stamps, within the day's cap -> { doc, added } | { error }
function award(fest, doc, task, ms) {
  const t = fest.tasks[task]; if (!t) return { error: 'BAD_TASK' };
  if (!Calendar.taskOpen(fest, task, ms)) return { error: 'TASK_CLOSED' };
  const day = Calendar.dayOf(ms); const today = { ...(doc?.days?.[day] || {}) };
  if ((today[task] || 0) >= t.perDay) return { error: 'TASK_DONE' };
  today[task] = (today[task] || 0) + 1;
  return { doc: { stamps: (doc?.stamps || 0) + t.stamps, spent: doc?.spent || 0, days: { [day]: today }, owned: doc?.owned || [] }, added: t.stamps }; // (only today's counts kept)
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
const COOKABLE = (id) => ['harvest', 'berry', 'mushroom', 'herb'].includes(id) || /^fish_/.test(id);
function judgeCook(items) {
  if (!Array.isArray(items) || items.length !== 3 || !items.every((id) => typeof id === 'string' && COOKABLE(id) && Items.ITEMS[id])) return { error: 'BAD_RECIPE' };
  const kinds = new Set(items.map((id) => (/^fish_/.test(id) ? 'fish' : id))).size;
  const score = Math.round(items.reduce((n, id) => n + Items.priceOf(id), 0) / 100) + kinds * 10;
  const say = score >= 140 ? '이건 잔칫상에 올려야겠어요! 최고예요.' : score >= 90 ? '구수하고 맛있어요. 솜씨가 좋네요!' : '소박하지만 정성이 느껴져요. 고마워요!';
  return { score, kinds, say };
}

module.exports = { left, view, award, buy, COOKABLE, judgeCook };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const at = (s) => Date.parse(`${s}+09:00`); const fest = Calendar.festivalAt(at('2026-11-21T12:00:00'));
  assert.equal(fest.id, 'harvest-2026'); assert.equal(Calendar.festivalAt(at('2026-11-19T23:59:00')), null); assert.equal(Calendar.festivalAt(at('2026-11-27T00:00:00')), null);
  let doc = null; for (let k = 0; k < 3; k += 1) ({ doc } = award(fest, doc, 'harvest', at('2026-11-21T12:00:00')));
  assert.equal(award(fest, doc, 'harvest', at('2026-11-21T13:00:00')).error, 'TASK_DONE'); assert.equal(left(doc), 3);
  assert.equal(award(fest, doc, 'feast', at('2026-11-21T19:00:00')).error, 'TASK_CLOSED');
  const last = Calendar.festivalAt(at('2026-11-26T19:00:00')); assert.equal(award(last, doc, 'feast', at('2026-11-26T19:00:00')).added, 3);
  assert.equal(buy(fest, doc, 'feast_table').error, 'NOT_ENOUGH'); ({ doc } = buy(fest, doc, 'straw_sheaf')); assert.equal(left(doc), 0); assert.equal(buy(fest, doc, 'straw_sheaf').error, 'OWNED');
  assert.equal(judgeCook(['harvest', 'berry']).error, 'BAD_RECIPE'); assert.ok(judgeCook(['harvest', 'fish_goby', 'mushroom']).score > judgeCook(['berry', 'berry', 'berry']).score);
  console.log('island-festival ok');
}
