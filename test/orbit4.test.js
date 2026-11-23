'use strict';
// 달무리 사목 rules (notes docs/orbit-4-plan-20261122.md §2 · §3-5, 사용자 결정 59)
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../lib/games/orbit4');
const { getGame, hasGame } = require('../lib/games');

const fresh = () => { const g = O.create(); O.start(g); return g; };
const empty = () => Array.from({ length: 4 }, () => Array(4).fill(null));
const at = 'T';

test('고리: 바깥 12칸 · 안쪽 4칸, 한 번에 한 칸 반시계 -- 바깥 12번 · 안쪽 4번이면 제자리', () => {
  assert.equal(O.OUTER.length, 12); assert.equal(O.INNER.length, 4);
  const b = empty(); b[0][0] = 'black'; b[1][1] = 'white';
  const one = O.turned(b); assert.equal(one[1][0], 'black', 'the corner (0,0) steps down the left side'); assert.equal(one[2][1], 'white', 'the inner (1,1) steps to (1,2)');
  let k = b; for (let i = 0; i < 12; i += 1) k = O.turned(k); assert.deepEqual(k, b);
  const inner = empty(); inner[1][2] = 'black'; let j = inner; for (let i = 0; i < 4; i += 1) j = O.turned(j); assert.deepEqual(j, inner);
});

test('놓고 돌린 뒤에만 이김 -- 놓는 순간 줄이 있어도 돌아서 깨지면 계속', () => {
  const g = fresh(); g.board[0] = ['black', 'black', 'black', null]; g.left = { black: 5, white: 5 }; g.moves = [{}];
  const v = O.applyMove(g, 3, 0, 'black', at); assert.equal(v.legal, true);
  assert.equal(g.status, 'playing', 'the top row turned apart'); assert.equal(g.turn, 'white');
});

// the board one turn before `after` (twelve turns bring both rings home: eleven undo one)
const before = (after) => { let b = after; for (let i = 0; i < 11; i += 1) b = O.turned(b); return b; };
const cellOf = (pre, after, x, y) => { /* where the bead that ends on (x, y) stands before the turn */ const mark = after.map((r) => r.map(() => null)); mark[y][x] = 'M'; const m = before(mark); for (let yy = 0; yy < 4; yy += 1) for (let xx = 0; xx < 4; xx += 1) if (m[yy][xx] === 'M') return [xx, yy]; return null; };

test('돈 뒤 줄: 내가 돌려 상대만 이어지면 상대 승리, 둘 다면 무승부', () => {
  // after the turn the left column all 별(white); black places the bead that ends on (3,3) -- only white has a line
  const want = empty(); for (let y = 0; y < 4; y += 1) want[y][0] = 'white'; want[3][3] = 'black';
  const g = fresh(); g.moves = [{}]; g.left = { black: 5, white: 4 }; g.board = before(want); const [px, py] = cellOf(g.board, want, 3, 3); g.board[py][px] = null;
  const v = O.applyMove(g, px, py, 'black', at); assert.equal(v.legal, true);
  assert.equal(g.status, 'finished'); assert.equal(g.winner, 'white'); assert.equal(g.winningLines.length, 1);
  // after the turn the top row white and the bottom row black: a draw, though black turned
  const both = empty(); for (let x = 0; x < 4; x += 1) { both[0][x] = 'white'; both[3][x] = 'black'; }
  const d = fresh(); d.moves = [{}]; d.left = { black: 5, white: 4 }; d.board = before(both); const [qx, qy] = cellOf(d.board, both, 0, 3); d.board[qy][qx] = null;
  const w = O.applyMove(d, qx, qy, 'black', at); assert.equal(w.legal, true); assert.equal(d.status, 'draw'); assert.equal(d.winner, null); assert.equal(d.winningLines.length, 2);
});

test('밀기: 상대 구슬만, 가로·세로 옆 빈칸으로, 첫 차례엔 없음 -- 거절되면 판 그대로', () => {
  const g = fresh();
  assert.equal(O.applyMove(g, 0, 0, 'black', at, { push: { from: [1, 1], to: [1, 2] } }).reason, 'push-first');
  assert.equal(O.applyMove(g, 1, 1, 'black', at).legal, true); // (then the board turns: (1,1) -> (1,2))
  const before = JSON.stringify(g.board);
  assert.equal(O.applyMove(g, 0, 0, 'white', at, { push: { from: [3, 3], to: [3, 2] } }).reason, 'push-own', 'an empty or own cell is not the other\'s');
  assert.equal(O.applyMove(g, 0, 0, 'white', at, { push: { from: [1, 2], to: [2, 3] } }).reason, 'push-far', 'corner to corner');
  g.board[3][3] = 'white'; assert.equal(O.applyMove(g, 0, 0, 'white', at, { push: { from: [3, 3], to: [3, 2] } }).reason, 'push-own', 'my own bead'); g.board[3][3] = null;
  assert.equal(JSON.stringify(g.board), before, 'refused: the board as it was');
  const ok = O.applyMove(g, 0, 0, 'white', at, { push: { from: [1, 2], to: [1, 3] } }); assert.equal(ok.legal, true);
  assert.deepEqual(g.moves.at(-1).push, { from: [1, 2], to: [1, 3] });
  { const [ex, ey] = O.legalCells(g)[0]; assert.equal(O.applyMove(g, ex, ey, 'black', at).legal, true); }
  const t = g.board.flat().filter(Boolean); assert.equal(t.length, 3);
});

test('찬 칸 · 판 밖 · 구슬 없음은 거절', () => {
  const g = fresh(); O.applyMove(g, 0, 0, 'black', at); const taken = g.board.flatMap((r, y) => r.map((c, x) => (c ? [x, y] : null))).find(Boolean);
  assert.equal(O.applyMove(g, taken[0], taken[1], 'white', at).reason, 'occupied'); assert.equal(O.applyMove(g, 4, 0, 'white', at).reason, 'out-of-bounds');
  g.left.white = 0; assert.equal(O.applyMove(g, 3, 3, 'white', at).reason, 'no-beads');
});

test('판이 다 차면 5번 더 돌리고, 끝까지 없으면 무승부 · 한 판은 구슬 16개로 끝남', () => {
  // a full board with no line on any of its turns: rows alternate in pairs
  const g = fresh(); g.moves = [{}]; g.left = { black: 1, white: 0 };
  g.board = [['black', 'black', 'white', 'white'], ['white', 'white', 'black', 'black'], ['black', 'black', 'white', 'white'], ['white', 'white', 'black', null]];
  let any = false; let k = g.board.map((r) => r.slice()); k[3][3] = 'black'; for (let i = 0; i < 6; i += 1) { k = O.turned(k); if (O.linesOf(k, 'black').length || O.linesOf(k, 'white').length) any = true; }
  const v = O.applyMove(g, 3, 3, 'black', at); assert.equal(v.legal, true);
  if (any) assert.equal(g.status === 'finished' || g.status === 'draw', true); else { assert.equal(g.status, 'draw'); assert.equal(v.turns, 1 + O.EXTRA_TURNS); }
  // random games end by 16 beads at the latest
  for (let seed = 1; seed <= 200; seed += 1) { const r = fresh(); let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; let n = 0;
    while (r.status === 'playing') { const cells = O.legalCells(r); const [x, y] = cells[Math.floor(rnd() * cells.length)]; assert.equal(O.applyMove(r, x, y, r.turn, at).legal, true); n += 1; }
    assert.ok(n <= 16); assert.ok(['finished', 'draw'].includes(r.status)); }
});

test('게임 목록에 들어감 · 공개 상태', () => {
  assert.equal(hasGame('orbit4'), true); assert.equal(getGame('orbit4').name, '달무리 사목');
  const g = fresh(); const p = O.publicState(g); assert.deepEqual(p.left, { black: 8, white: 8 }); assert.equal(p.legalMoves.length, 16); assert.equal(p.size, 4);
});
