'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../lib/island-quests');
const T = require('../public/plaza/island-terrain');
const Cast = require('../public/plaza/island-cast');

// v1.10.93 마을 주민 미니게임 퀘스트 2단계 (IDEAS #future-island-minigames, assets 39)
test('마을 주민: 화가·역무원·거리 악단은 매주, 미니게임 한 판(숫자 터치는 시간이 짧을수록) 뒤 둘러보기', () => {
  // one of the three each week, in turn (v1.10.93: the weekly total stays as it was planned)
  const weekOf = (id) => [0, 1, 2, 3, 4, 5, 6].map((w) => Date.parse('2026-10-20T12:00:00+09:00') + w * 7 * 86400000).find((t) => Q.weeklyStories(t).includes(id));
  const VILLAGERS = ['painter', 'stationmaster', 'busker', 'electrician', 'builder', 'librarian', 'grandpa'];
  const ids = [0, 1, 2, 3, 4, 5, 6].map((w) => Q.weeklyStories(Date.parse('2026-10-20T12:00:00+09:00') + w * 7 * 86400000).filter((id) => VILLAGERS.includes(id)));
  assert.deepEqual(ids.map((x) => x.length), [1, 1, 1, 1, 1, 1, 1]); assert.equal(new Set(ids.flat()).size, 7);
  for (const id of VILLAGERS) { assert.ok(Cast.keeperLine(id, () => 0)); assert.ok(Cast.keeperN(id) >= 15); }
  let now = weekOf('stationmaster');
  let doc = Q.talk({}, 'stationmaster', [], { x: T.VILLAGE.stationmaster.x, z: T.VILLAGE.stationmaster.z }, now).doc;
  assert.equal(Q.note(doc, 'minigame:numbers', { qty: 45000, now }), null, '45초는 못 미침');
  doc = Q.note(doc, 'minigame:numbers', { qty: 31000, now }); assert.equal(doc.stationmaster.count, 1, '31초면 됨');
  now = weekOf('painter');
  let p = Q.talk({}, 'painter', [], { x: T.VILLAGE.painter.x, z: T.VILLAGE.painter.z }, now).doc;
  assert.equal(Q.note(p, 'minigame:colorfind', { qty: 11, now }), null); p = Q.note(p, 'minigame:colorfind', { qty: 12, now }); assert.equal(p.painter.count, 1);
  const r = Q.talk(p, 'painter', [], { x: T.VILLAGE.painter.x, z: T.VILLAGE.painter.z }, now); assert.equal(r.reward, 3000); assert.match(r.say, /벽화/);
  assert.equal(Q.talk({}, 'busker', [], { x: 0, z: 0 }, weekOf('busker')).error, 'TOO_FAR');
  for (const v of [T.VILLAGE.painter, T.VILLAGE.busker, T.VILLAGE.stationmaster, T.VILLAGE.electrician, T.VILLAGE.builder, T.VILLAGE.librarian]) assert.ok(T.walkable(v.x, v.z));
  // A2b: the puzzle residents -- today's 오늘의 문제 (쉬움), any right answer counts; then a look at the lamps, stones, cart
  for (const [id, game, look] of [['electrician', 'circuit', T.VILLAGE.lamps[1]], ['builder', 'hashi', { x: 15, z: 18.6 }], ['librarian', 'nonogram', T.VILLAGE.bookcart]]) {
    now = weekOf(id); const at = { x: T.VILLAGE[id].x, z: T.VILLAGE[id].z };
    let d = Q.talk({}, id, [], at, now).doc; const step = Q.STORIES[id].steps[0];
    assert.equal(step.game, game); assert.equal(step.level, 'easy'); assert.ok(step.puzzle);
    assert.equal(Q.note(d, 'minigame:sudoku', { qty: 1, now }), null); d = Q.note(d, `minigame:${game}`, { qty: 1, now }); assert.equal(d[id].count, 1);
    d = Q.talk(d, id, [], at, now).doc; assert.equal(d[id].step, 1);
    d = Q.note(d, 'at', { x: look.x, z: look.z, now }); assert.equal(d[id].count, 1, id + ' 둘러보기');
  }
  for (const v of T.villageSolids()) assert.ok(T.walkable(v.x, v.z));
  // A2c: the grandpa -- a win over the room AI (오목, then 오델로); the other game does not count
  now = weekOf('grandpa'); const g = { x: T.VILLAGE.grandpa.x, z: T.VILLAGE.grandpa.z };
  let d = Q.talk({}, 'grandpa', [], g, now).doc;
  assert.equal(Q.note(d, 'minigame:ai_othello', { qty: 1, now }), null); d = Q.note(d, 'minigame:ai_omok', { qty: 1, now }); assert.equal(d.grandpa.count, 1);
  const won = Q.talk(d, 'grandpa', [], g, now); assert.equal(won.reward, 3000); assert.match(won.say, /오델로/);
  d = Q.note(won.doc, 'minigame:ai_othello', { qty: 3, now }); assert.equal(Q.talk(d, 'grandpa', [], g, now).reward, 4000 + 15000);
});
