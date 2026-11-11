'use strict';
// 윷놀이 실제 규칙 (notes docs/yut-real-rules-20261109.md 1, 사용자 「거기께 더 실제 윷놀이에 가까웠던거 같은데」): 한판마당
// (public/reflex/js/games/rules.js yutThrow/yutOptions/yutThrowIn/yutMoveIn/yutSettle, 사용 허락 2026-10-12) on our pieces and
// seats. A turn: throw (윷·모 one more) and keep the results; then use each kept result on a piece of one's choosing (a
// capture: one more throw); then the next player. A result no piece can use (a 빽도 with nothing on the board) is dropped
// and told. 빽도 goes back along the cells the piece really came by. Two players, four pieces each (B: 3~4 players later).
// Board cells (한판마당's numbers): the outer 1..19, 20 참먹이 (stopping exactly there needs one more move to get out),
// the diagonals 21..25 (모 → 가운데 23 → 뒷밭) and 26 27 23 28 29 (뒷모 → 가운데 → 참먹이); -1 home, 99 out (finished).
// The screen keeps its old words: 20 is 'finishLine', 99 'finished'.
const crypto = require('crypto');

const RESULTS = { '-1': { name: '빽도', steps: -1 }, 1: { name: '도', steps: 1 }, 2: { name: '개', steps: 2 }, 3: { name: '걸', steps: 3 }, 4: { name: '윷', steps: 4 }, 5: { name: '모', steps: 5 } };
const metadata = {
  id: 'yut', name: '윷놀이', size: 0,
  rules: '2~4인 윷놀이(2명은 말 4개, 3~4명은 3개). 차례가 되면 먼저 윷을 던져요. 윷·모가 나오면 한 번 더 던지고, 나온 결과를 모두 모아 둬요. 다 던지면 모은 결과를 하나씩 골라 원하는 말에 써요. 상대 말을 잡으면 한 번 더 던져요. 빽도는 판 위의 말을 지나온 칸으로 한 칸 되돌려요(쓸 말이 없으면 버려요). 같은 편 말이 한 칸에 만나면 업혀서 함께 움직여요. 모·뒷모·가운데에 딱 멈춘 말은 지름길로 가요. 참먹이에 딱 멈춘 말은 한 칸 이상 더 가야 나요. 말을 먼저 모두 낸 사람이 이겨요.',
};
const OUT = 99; const FINISH_CELL = 20; const FINISH_LINE = 'finishLine';
const Y_OUTER = [...Array(21).keys(), OUT];
const Y_RA = [5, 21, 22, 23, 24, 25, 15, 16, 17, 18, 19, 20, OUT]; // 모에 멈춘 말: 가운데를 지나 뒷밭으로
const Y_RB = [10, 26, 27, 23, 28, 29, 20, OUT]; // 뒷모에 멈춘 말: 가운데를 지나 참먹이로
const Y_RC = [23, 28, 29, 20, OUT]; // 가운데에 멈춘 말: 참먹이로 지름길
const yRoute = (st) => ([5, 21, 22, 24, 25].includes(st) ? Y_RA : [10, 26, 27, 28, 29].includes(st) ? Y_RB : st === 23 ? Y_RC : Y_OUTER);
// from st (-1 home) n cells on: the cells passed, the last the landing (OUT when it gets out)
function stepsFrom(st, n) { const r = yRoute(st); const i = st < 0 ? 0 : r.indexOf(st); const out = []; for (let k = 1; k <= n; k += 1) { const nx = r[Math.min(i + k, r.length - 1)]; out.push(nx); if (nx === OUT) break; } return out; }
// four sticks, each flat side up half the time, one of them marked: 도 3 · 개 6 · 걸 4 · 윷 1 · 모 1 · 빽도 1 (of 16)
function throwSticks(bit = () => crypto.randomInt(0, 2) === 1) { const flat = [0, 1, 2, 3].map(() => bit()); const n = flat.filter(Boolean).length; return { n, steps: n === 0 ? 5 : n === 1 && flat[0] ? -1 : n }; }

// 윷놀이 B (notes docs/yut-real-rules-20261109.md 2): 2~4 players -- the seats in turn 파랑 · 빨강 · 초록 · 노랑 (ids black, white,
// green, yellow: the 2-player board's own two kept), four pieces each for two players, three for three or four
const SEATS = ['black', 'white', 'green', 'yellow'];
const COLORS = SEATS; // (kept for older callers)
const piecesFor = (n) => (n === 2 ? 4 : 3);
const seatsOf = (game) => game.seatOrder || SEATS.slice(0, 2);
const other = (game, color) => { const order = seatsOf(game); return order[(order.indexOf(color) + 1) % order.length]; }; // (the next in turn)
const freshPieces = (color, count = 4) => Array.from({ length: count }, (_, k) => ({ id: `${color}-${k + 1}`, color, at: -1, tr: [] }));
function create(players = 2) {
  const n = Math.max(2, Math.min(4, Number(players) || 2)); const seatOrder = SEATS.slice(0, n);
  return { status: 'selecting', players: n, seatOrder, turn: 'black', winner: null, winningLine: null, round: 1, phase: 'throw', bonus: 1, pend: [], dropped: 0, lastThrow: null, lastPass: null,
    pieces: Object.fromEntries(seatOrder.map((c) => [c, freshPieces(c, piecesFor(n))])), moves: [], throws: [] };
}
// `seats` (the seats taken, any order): the game is theirs, in the board's turn order
function start(game, seats = null) {
  if (Array.isArray(seats) && seats.length >= 2) { const order = SEATS.filter((c) => seats.includes(c)); if (order.join() !== seatsOf(game).join()) Object.assign(game, { players: order.length, seatOrder: order, pieces: Object.fromEntries(order.map((c) => [c, freshPieces(c, piecesFor(order.length))])) }); }
  game.status = 'playing'; game.turn = seatsOf(game)[0]; game.phase = 'throw'; game.bonus = 1; game.pend = [];
}
function reset(game) { const round = Number(game.round || 1) + 1; Object.assign(game, create(game.players || 2), { round }); }

// what result r lets `color` move: each group on the board (pieces on one cell go together) and, for a forward result, one
// piece from home -- { from, ids, path, dest }
function options(game, color, r) {
  const pl = game.pieces[color]; const at = new Map(); const out = [];
  for (const pc of pl) if (pc.at >= 0 && pc.at !== OUT) { if (!at.has(pc.at)) at.set(pc.at, []); at.get(pc.at).push(pc); }
  for (const [from, group] of at) {
    if (r < 0) { const tr = group[0].tr; if (tr.length < 2) continue; const dest = tr[tr.length - 2]; out.push({ from, ids: group.map((p) => p.id), path: [dest], dest }); }
    else { const path = stepsFrom(from, r); out.push({ from, ids: group.map((p) => p.id), path, dest: path[path.length - 1] }); }
  }
  if (r > 0) { const h = pl.find((p) => p.at === -1); if (h) { const path = stepsFrom(-1, r); out.push({ from: -1, ids: [h.id], path, dest: path[path.length - 1] }); } }
  return out;
}
const cell = (c) => (c === FINISH_CELL ? FINISH_LINE : c);
// the screen's words for a landing: status, position, and the cells walked from where it stood (home: from the start, 0)
const destinationOf = (o) => ({ status: o.dest === OUT ? 'finished' : 'board', position: o.dest === OUT ? null : cell(o.dest), route: 'outer', path: [o.from < 0 ? 0 : cell(o.from), ...o.path.filter((c) => c !== OUT).map(cell)] });
function legalMoves(game, color = game.turn, ri = 0) {
  if (game.status !== 'playing' || game.phase !== 'move' || color !== game.turn || game.pend[ri] == null) return [];
  return options(game, color, game.pend[ri]).map((o) => ({ pieceId: o.ids[0], carried: o.ids, from: cell(o.from), destination: destinationOf(o) }));
}
// nothing more to throw: results no piece can use are dropped; none left -- the next player
function settle(game, color) {
  if (game.status !== 'playing' || game.bonus > 0) { game.phase = game.status === 'playing' ? 'throw' : game.phase; return; }
  const before = game.pend.length; game.pend = game.pend.filter((r) => options(game, color, r).length); game.dropped = before - game.pend.length;
  if (game.pend.length) { game.phase = 'move'; return; }
  if (game.dropped) game.lastPass = color;
  game.turn = other(game, color); game.bonus = 1; game.phase = 'throw';
}
function throwYut(game, color, at, sticks = throwSticks()) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (game.bonus <= 0) return { legal: false, reason: 'must-move' };
  const { n, steps } = sticks; if (!RESULTS[steps]) return { legal: false, reason: 'bad-throw' };
  game.lastPass = null; game.dropped = 0; game.bonus -= 1; game.pend.push(steps); if (steps >= 4) game.bonus += 1;
  const result = { ...RESULTS[steps], backs: n, color, at };
  game.lastThrow = result; game.throws.push(result);
  settle(game, color);
  return { legal: true, ...result, passed: game.turn !== color, dropped: game.dropped };
}
// pend[ri] used on the piece (and whoever rides with it)
function applyMove(game, pieceId, color, at, ri = 0) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (game.bonus > 0 || !game.pend.length) return { legal: false, reason: 'must-throw' };
  if (!Number.isInteger(ri) || game.pend[ri] == null) return { legal: false, reason: 'bad-result' };
  const r = game.pend[ri]; const o = options(game, color, r).find((x) => x.ids.includes(pieceId));
  if (!o) return { legal: false, reason: 'bad-piece' };
  game.lastPass = null; game.pend.splice(ri, 1);
  const pl = game.pieces[color]; const tr0 = o.from < 0 ? [FINISH_CELL] : pl.find((p) => p.id === o.ids[0]).tr.slice();
  const tr = r < 0 ? tr0.slice(0, -1) : tr0.concat(o.path.filter((c) => c !== OUT));
  for (const p of pl) if (o.ids.includes(p.id)) Object.assign(p, { at: o.dest, tr: o.dest === OUT ? [] : tr.slice() });
  const captured = [];
  if (o.dest !== OUT) for (const c of seatsOf(game)) if (c !== color) for (const p of game.pieces[c]) if (p.at === o.dest) { captured.push(p.id); Object.assign(p, { at: -1, tr: [] }); } /* (B: every other seat) */
  if (captured.length) game.bonus += 1;
  const destination = destinationOf(o);
  game.moves.push({ color, pieceIds: o.ids, steps: r, destination, captured, bonus: captured.length > 0, at });
  if (pl.every((p) => p.at === OUT)) { game.status = 'finished'; game.winner = color; game.turn = null; game.phase = 'finished'; game.pend = []; game.bonus = 0; }
  else settle(game, color);
  return { legal: true, captured, bonus: captured.length > 0, finished: game.status === 'finished' };
}
// the room AI's pick (as 한판마당's yutAi, small): for every kept result and piece -- a capture first, then getting out, then
// stopping on a shortcut corner, then the way gone; landing 1~5 cells ahead of an opponent's piece avoided -> { pieceId, ri }
function aiPick(game, color) {
  let best = null; const foes = seatsOf(game).filter((c) => c !== color).flatMap((c) => game.pieces[c]); const foe = foes.filter((p) => p.at >= 0 && p.at !== OUT);
  const threatened = (dest) => foe.some((p) => [1, 2, 3, 4, 5].some((k) => stepsFrom(p.at, k).at(-1) === dest));
  game.pend.forEach((r, ri) => { for (const o of options(game, color, r)) {
    const caught = o.dest !== OUT && foes.some((p) => p.at === o.dest);
    const score = (caught ? 100 : 0) + (o.dest === OUT ? 80 : 0) + ([5, 10, 23].includes(o.dest) ? 20 : 0) + r * 2 + (o.ids.length - 1) * 4 - (o.dest !== OUT && !caught && threatened(o.dest) ? 25 : 0) + (o.from < 0 ? 1 : 0);
    if (!best || score > best.score) best = { score, pieceId: o.ids[0], ri };
  } });
  return best && { pieceId: best.pieceId, ri: best.ri };
}
function moveError(reason) {
  if (reason === 'not-playing') return '지금은 윷을 진행할 수 없습니다.';
  if (reason === 'not-your-turn') return '상대 차례입니다.';
  if (reason === 'must-move') return '모아 둔 결과로 말을 먼저 움직여 주세요.';
  if (reason === 'must-throw') return '먼저 윷을 던져 주세요.';
  if (reason === 'bad-result') return '쓸 결과를 다시 골라 주세요.';
  if (reason === 'bad-piece') return '움직일 수 있는 내 말을 선택해 주세요.';
  return '윷 결과를 처리할 수 없습니다.';
}
// the screen's pieces: home / board (its cell, 20 'finishLine') / finished
const pieceView = (p) => ({ id: p.id, color: p.color, status: p.at === -1 ? 'home' : p.at === OUT ? 'finished' : 'board', position: p.at === -1 || p.at === OUT ? null : cell(p.at), route: 'outer' });
function publicState(game) {
  const finished = (color) => game.pieces[color].filter((p) => p.at === OUT).length;
  const options = game.pend.map((_, i) => legalMoves(game, game.turn, i));
  return {
    size: 0, board: [], status: game.status, turn: game.turn, winner: game.winner, winningLine: null, round: game.round, phase: game.phase,
    pend: game.pend.map((r) => ({ steps: r, name: RESULTS[r].name })), bonus: game.bonus, options, dropped: game.dropped || 0,
    pendingSteps: game.pend[0] ?? null, lastThrow: game.lastThrow, legalMoves: options[0] || [],
    players: seatsOf(game).length, seatOrder: seatsOf(game), pieceCount: piecesFor(seatsOf(game).length), pieces: Object.fromEntries(seatsOf(game).map((c) => [c, game.pieces[c].map(pieceView)])), moveCount: game.moves.length, throwCount: game.throws.length, lastMove: game.moves.at(-1) || null,
    scores: Object.fromEntries(seatsOf(game).map((c) => [c, finished(c)])), lastPass: game.lastPass || null,
    leftSeats: Object.keys(game.leftSeats || {}), /* (윷놀이 C: the seats an AI took over -- the seats only, never whose token) */
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [], endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, RESULTS, OUT, FINISH_LINE, SEATS, piecesFor, create, start, reset, options, stepsFrom, throwSticks, legalMoves, throwYut, applyMove, aiPick, publicState, moveError };
