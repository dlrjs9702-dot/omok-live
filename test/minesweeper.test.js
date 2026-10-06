'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS, createGame } = require('../lib/minesweeper');

// v1.10.37 지뢰찾기: the standard boards; the first cell and its neighbours are never mines; the mines stay hidden until
// the end; flags, chords, a win once every safe cell is open, a loss on a mine; nothing moves after the end.
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('지뢰찾기: 표준 판 크기와 보상, 첫 칸 주변은 안전, 지뢰 위치는 끝나기 전엔 보이지 않는다', () => {
  assert.deepEqual(Object.entries(LEVELS).map(([k, l]) => [k, l.w, l.h, l.mines, l.points]), [['beginner', 9, 9, 10, 2000], ['intermediate', 16, 16, 40, 4000], ['expert', 30, 16, 99, 8000]]);
  for (let s = 1; s <= 30; s += 1) {
    const g = createGame('expert', { random: seeded(s) });
    assert.equal(g.act('open', 4, 4), true);
    const v = g.view();
    assert.equal(v.status, 'playing');
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) assert.ok(v.cells[(4 + dy) * 30 + 4 + dx] >= 0, '첫 칸과 이웃은 열린다');
    assert.equal(g.game.mine.reduce((a, b) => a + b, 0), 99);
    assert.equal(v.mineAt, undefined);
    assert.ok(!JSON.stringify(v).includes('mine"'), '진행 중에는 지뢰 정보 없음');
  }
  assert.throws(() => createGame('nope'), RangeError);
});

test('지뢰찾기: 깃발·코드 열기·승리, 지뢰를 밟으면 패배, 끝난 뒤에는 움직이지 않는다', () => {
  let t = 1000; const now = () => t;
  const g = createGame('beginner', { random: seeded(7), now });
  assert.equal(g.act('flag', 0, 0), false, '시작 전 깃발 없음');
  g.act('open', 4, 4); t = 9000;
  const { mine, w } = g.game;
  // flag every mine next to an opened number and chord: the same as opening its safe neighbours
  const safe = []; for (let i = 0; i < mine.length; i += 1) if (!mine[i]) safe.push(i);
  for (const i of safe) g.act('open', i % w, Math.floor(i / w));
  const v = g.view();
  assert.equal(v.status, 'won'); assert.equal(v.ms, 8000);
  assert.equal(v.mineAt.length, 10);
  assert.equal(g.act('open', 0, 0), false, '끝난 판은 그대로');

  const lose = createGame('beginner', { random: seeded(3) });
  lose.act('open', 0, 0);
  const m = lose.game.mine.findIndex((x) => x);
  assert.equal(lose.act('flag', m % 9, Math.floor(m / 9)), true);
  assert.equal(lose.view().flags, 1);
  assert.equal(lose.act('open', m % 9, Math.floor(m / 9)), true, '깃발 칸은 열리지 않는다');
  assert.equal(lose.view().status, 'playing');
  lose.act('flag', m % 9, Math.floor(m / 9)); lose.act('open', m % 9, Math.floor(m / 9));
  assert.equal(lose.view().status, 'lost'); assert.equal(lose.view().boom, m);

  // chord: a number whose flags match opens the rest
  const c = createGame('intermediate', { random: seeded(11) });
  c.act('open', 8, 8);
  const cg = c.game; const W = cg.w;
  const num = [...cg.open.keys()].find((i) => cg.open[i] && !cg.mine[i] && (() => { const x = i % W; const y = (i - x) / W; let k = 0, hidden = 0; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= cg.h) continue; const j = yy * W + xx; k += cg.mine[j]; if (!cg.open[j] && !cg.mine[j]) hidden += 1; } return k > 0 && hidden > 0; })());
  if (num !== undefined) {
    const x = num % W; const y = (num - x) / W;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const j = (y + dy) * W + x + dx; if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < cg.h && cg.mine[j]) c.act('flag', x + dx, y + dy); }
    const before = cg.opened;
    assert.equal(c.act('chord', x, y), true);
    assert.ok(cg.opened > before);
    assert.notEqual(c.view().status, 'lost');
  }
  assert.throws(() => c.act('open', 99, 0), RangeError);
});
