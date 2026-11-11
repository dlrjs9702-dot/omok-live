'use strict';
// 윷놀이 실제 규칙 (notes docs/yut-real-rules-20261109.md 1, 한판마당 규칙): the odds of 16, results kept then used one by one on
// the piece of one's choosing, 빽도 along the cells the piece came by, the three shortcuts, stacking, capture and one more
// throw, 참먹이 (stopping there needs one more move), results no piece can use dropped, the win.
const test = require('node:test');
const assert = require('node:assert/strict');
const yut = require('../lib/games/yut');

const sticks = (steps) => ({ n: steps === 5 ? 0 : steps === -1 ? 1 : steps, steps });
const playing = () => { const g = yut.create(); yut.start(g); return g; };
const throwAs = (g, color, steps) => yut.throwYut(g, color, 't', sticks(steps));
const piece = (g, id) => g.pieces[id.split('-')[0]].find((p) => p.id === id);
const put = (g, id, at, tr) => Object.assign(piece(g, id), { at, tr });

test('던지기: 가락 넷(평평한 면 1/2, 하나에 빽도 표시) → 도 3 · 개 6 · 걸 4 · 윷 1 · 모 1 · 빽도 1 (16분의)', () => {
  const count = { '-1': 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let m = 0; m < 16; m += 1) { let k = 0; const bits = [0, 1, 2, 3].map((b) => Boolean((m >> b) & 1)); const r = yut.throwSticks(() => bits[k++]); count[r.steps] += 1; }
  assert.deepEqual(count, { '-1': 1, 1: 3, 2: 6, 3: 4, 4: 1, 5: 1 });
});

test('결과 모으기: 윷·모는 한 번 더 던지고, 다 던진 뒤 모은 결과를 골라 원하는 말에 써요', () => {
  const g = playing();
  assert.equal(throwAs(g, 'black', 4).passed, false); assert.equal(g.phase, 'throw');
  throwAs(g, 'black', 5); throwAs(g, 'black', 2); assert.equal(g.phase, 'move'); assert.deepEqual(g.pend, [4, 5, 2]);
  const pub = yut.publicState(g); assert.deepEqual(pub.pend.map((r) => r.name), ['윷', '모', '개']); assert.equal(pub.options.length, 3);
  assert.equal(yut.applyMove(g, 'black-1', 'black', 't', 2).legal, true); assert.equal(piece(g, 'black-1').at, 2); assert.deepEqual(g.pend, [4, 5]);
  assert.equal(yut.applyMove(g, 'black-1', 'black', 't', 0).legal, true); assert.equal(piece(g, 'black-1').at, 6);
  assert.equal(yut.applyMove(g, 'black-2', 'black', 't', 0).legal, true); assert.equal(piece(g, 'black-2').at, 5);
  assert.equal(g.turn, 'white'); assert.equal(g.phase, 'throw');
});

test('빽도: 지나온 칸으로 한 칸 — 지름길로 온 말은 지름길로 되돌아가요; 판 위에 말이 없으면 버리고 차례가 넘어가요', () => {
  const g = playing();
  const t = throwAs(g, 'black', -1); assert.equal(t.passed, true); assert.equal(t.dropped, 1); assert.equal(g.turn, 'white'); assert.equal(g.lastPass, 'black');
  const h = playing(); put(h, 'black-1', 22, [20, 1, 2, 3, 4, 5, 21, 22]); throwAs(h, 'black', -1);
  const back = yut.publicState(h).legalMoves; assert.equal(back.length, 1); assert.equal(back[0].destination.position, 21);
  yut.applyMove(h, 'black-1', 'black', 't', 0); assert.equal(piece(h, 'black-1').at, 21);
  const k = playing(); put(k, 'black-1', 1, [20, 1]); throwAs(k, 'black', -1); yut.applyMove(k, 'black-1', 'black', 't', 0);
  assert.equal(piece(k, 'black-1').at, 20, '첫 칸에서 빽도: 참먹이로');
});

test('지름길 셋: 모(5)·뒷모(10)·가운데(23)에 딱 멈춘 말만 꺾어요; 지나가기만 하면 바깥 길', () => {
  assert.deepEqual(yut.stepsFrom(5, 3), [21, 22, 23]); assert.deepEqual(yut.stepsFrom(4, 3), [5, 6, 7]);
  assert.deepEqual(yut.stepsFrom(10, 4), [26, 27, 23, 28]); assert.deepEqual(yut.stepsFrom(23, 3), [28, 29, 20]);
  assert.deepEqual(yut.stepsFrom(22, 3), [23, 24, 25], '모 쪽 대각선은 가운데를 지나 뒷밭으로');
  assert.deepEqual(yut.stepsFrom(-1, 5), [1, 2, 3, 4, 5]);
});

test('업기·잡기: 같은 편은 함께 움직이고, 상대를 잡으면 집으로 보내고 한 번 더 던져요', () => {
  const g = playing(); put(g, 'black-1', 3, [20, 1, 2, 3]); put(g, 'black-2', 3, [20, 1, 2, 3]); put(g, 'white-1', 5, [20, 1, 2, 3, 4, 5]);
  throwAs(g, 'black', 2); const mv = yut.publicState(g).legalMoves.find((m) => m.carried.length === 2); assert.ok(mv);
  const out = yut.applyMove(g, 'black-1', 'black', 't', 0); assert.deepEqual(out.captured, ['white-1']); assert.equal(out.bonus, true);
  assert.equal(piece(g, 'black-2').at, 5); assert.equal(piece(g, 'white-1').at, -1); assert.equal(g.turn, 'black'); assert.equal(g.phase, 'throw');
});

test('참먹이: 딱 멈추면 그 칸에 서고 한 칸 이상 더 가야 나요; 넉넉하면 그 던지기에 바로 나요', () => {
  assert.deepEqual(yut.stepsFrom(18, 2), [19, 20]); assert.deepEqual(yut.stepsFrom(18, 3), [19, 20, yut.OUT]); assert.deepEqual(yut.stepsFrom(20, 1), [yut.OUT]);
  const g = playing(); put(g, 'black-1', 18, [20, 18]); throwAs(g, 'black', 2); const m = yut.publicState(g).legalMoves.find((x) => x.pieceId === 'black-1');
  assert.equal(m.destination.position, 'finishLine'); assert.equal(m.destination.status, 'board');
});

test('승리: 말 넷을 모두 내면 끝나요(2인 말 4개)', () => {
  const g = playing(); for (const k of [1, 2, 3]) put(g, `black-${k}`, yut.OUT, []); put(g, 'black-4', 19, [20, 19]);
  throwAs(g, 'black', 2); const out = yut.applyMove(g, 'black-4', 'black', 't', 0);
  assert.equal(out.finished, true); assert.equal(g.status, 'finished'); assert.equal(g.winner, 'black'); assert.equal(yut.publicState(g).scores.black, 4);
});

test('AI 한 판 끝까지: aiPick만으로 두 자리가 50판을 막힘 없이 끝내요', () => {
  for (let k = 0; k < 50; k += 1) {
    const g = playing(); let n = 0;
    while (g.status === 'playing' && n < 3000) { n += 1; if (g.phase === 'throw') assert.equal(yut.throwYut(g, g.turn, 't').legal, true); else { const p = yut.aiPick(g, g.turn); assert.ok(p); assert.equal(yut.applyMove(g, p.pieceId, g.turn, 't', p.ri).legal, true); } }
    assert.equal(g.status, 'finished');
  }
  const g = playing(); put(g, 'white-1', 7, [20, 1, 2, 3, 4, 5, 6, 7]); throwAs(g, 'black', 4); throwAs(g, 'black', 3);
  assert.equal(yut.applyMove(g, 'black-1', 'black', 't', 0).legal, true); /* (black-1 on 4) */ assert.deepEqual(yut.aiPick(g, 'black'), { pieceId: 'black-1', ri: 0 }, '잡을 수 있으면 잡아요(4+3=7)');
});
test('차례·단계 지키기: 남의 차례, 던질 게 남았는데 움직이기, 없는 결과 번호는 거절', () => {
  const g = playing();
  assert.equal(throwAs(g, 'white', 2).reason, 'not-your-turn'); assert.equal(yut.applyMove(g, 'black-1', 'black', 't', 0).reason, 'must-throw');
  throwAs(g, 'black', 4); assert.equal(yut.applyMove(g, 'black-1', 'black', 't', 0).reason, 'must-throw');
  throwAs(g, 'black', 1); assert.equal(throwAs(g, 'black', 2).reason, 'must-move'); assert.equal(yut.applyMove(g, 'black-1', 'black', 't', 7).reason, 'bad-result');
});
