'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../lib/island-quests');
const T = require('../public/plaza/island-terrain');
const Cast = require('../public/plaza/island-cast');

// v1.10.93 마을 주민 미니게임 퀘스트 2단계 (IDEAS #future-island-minigames, assets 39)
test('마을 주민: 화가·역무원·거리 악단은 매주, 미니게임 한 판(숫자 터치는 시간이 짧을수록) 뒤 둘러보기', () => {
  // one of the three each week, in turn (v1.10.93: the weekly total stays as it was planned)
  const weekOf = (id) => [0, 1, 2].map((w) => Date.parse('2026-10-20T12:00:00+09:00') + w * 7 * 86400000).find((t) => Q.weeklyStories(t).includes(id));
  const ids = [0, 1, 2].map((w) => Q.weeklyStories(Date.parse('2026-10-20T12:00:00+09:00') + w * 7 * 86400000).filter((id) => ['painter', 'stationmaster', 'busker'].includes(id)));
  assert.deepEqual(ids.map((x) => x.length), [1, 1, 1]); assert.equal(new Set(ids.flat()).size, 3);
  for (const id of ['painter', 'stationmaster', 'busker']) { assert.ok(Cast.keeperLine(id, () => 0)); assert.ok(Cast.keeperN(id) >= 15); }
  let now = weekOf('stationmaster');
  let doc = Q.talk({}, 'stationmaster', [], { x: T.VILLAGE.stationmaster.x, z: T.VILLAGE.stationmaster.z }, now).doc;
  assert.equal(Q.note(doc, 'minigame:numbers', { qty: 45000, now }), null, '45초는 못 미침');
  doc = Q.note(doc, 'minigame:numbers', { qty: 31000, now }); assert.equal(doc.stationmaster.count, 1, '31초면 됨');
  now = weekOf('painter');
  let p = Q.talk({}, 'painter', [], { x: T.VILLAGE.painter.x, z: T.VILLAGE.painter.z }, now).doc;
  assert.equal(Q.note(p, 'minigame:colorfind', { qty: 11, now }), null); p = Q.note(p, 'minigame:colorfind', { qty: 12, now }); assert.equal(p.painter.count, 1);
  const r = Q.talk(p, 'painter', [], { x: T.VILLAGE.painter.x, z: T.VILLAGE.painter.z }, now); assert.equal(r.reward, 3000); assert.match(r.say, /벽화/);
  assert.equal(Q.talk({}, 'busker', [], { x: 0, z: 0 }, weekOf('busker')).error, 'TOO_FAR');
  for (const v of [T.VILLAGE.painter, T.VILLAGE.busker, T.VILLAGE.stationmaster]) assert.ok(T.walkable(v.x, v.z));
});
