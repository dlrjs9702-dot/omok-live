// AI 대결의 AI — 화면과 무관한 순수 로직 (앱의 연습 대결과 서버의 랭킹 대결이 같은 코드를 쓴다)
// 랭킹에 오르는 AI 대결은 서버가 이 코드로 AI의 수를 두고 승패를 정한다 (앱이 결과를 보내지 않음).
// 좌석: 사람 = 좌석 0(먼저 · rules.js의 1 / 백 / 아래쪽), AI = 좌석 1. 난이도 lv: 'easy' · 'normal' · 'hard'
import * as CH from './chess-core.js';
import * as GO from './go-core.js';
import { TTT_MAX, TTT_LINES, tttLine, tttPlaced, tttEmpties, GM_N, gmForbidden, gmOpenOk, gmSymEq, C4_C, C4_R, c4Drop, c4WinsAt, rvMoves, rvApply, ckMoves, ckApply, bgLegal, bgApply, bgKey } from './rules.js';
import { YUT_OUT, yutSteps, yutRem, yutOptions } from './rules.js';

const pick = (table, lv) => table[lv] || table.normal;
// 서버가 AI 대결을 여는 게임 (온라인 차례 대결과 같은 규칙 어댑터를 쓴다)
export const AI_GAMES = ['tictactoe', 'gomoku', 'connect4', 'reversi', 'checkers', 'chess', 'backgammon', 'go'];

/* ================= 틱택토 (사라지는 틱택토) ================= */
// 곧 완성할 수 있는 줄: 내 표시 2개 + 빈칸 1개. 다음에 둘 때 사라질 표시(가장 오래된 것)가 줄에 들어 있으면 가짜 위협이다.
function threats(me, op) {
  const vanish = me.length === TTT_MAX ? me[0] : -1;
  let n = 0;
  for (const l of TTT_LINES) {
    let mine = 0, empty = 0, fake = false;
    for (const i of l) { if (me.includes(i)) { mine++; if (i === vanish) fake = true; } else if (!op.includes(i)) empty++; }
    if (mine === 2 && empty === 1 && !fake) n++;
  }
  return n;
}
const tttEval = (me, op) => threats(me, op) * 10 - threats(op, me) * 12 + (me.includes(4) ? 3 : 0) - (op.includes(4) ? 3 : 0);
// negamax: me가 둘 차례. 이기면 큰 점수(빨리 이길수록 더 큼)
function tttSearch(me, op, depth, a, b) {
  if (!depth) return tttEval(me, op);
  let best = -Infinity;
  for (const i of tttEmpties(me, op)) {
    const nm = tttPlaced(me, i);
    const v = tttLine(nm) ? 1000 + depth : -tttSearch(op, nm, depth - 1, -b, -a);
    if (v > best) best = v;
    if (v > a) a = v;
    if (a >= b) break;
  }
  return best;
}
// 완벽한 수: 모든 국면(약 6만 7천 개)을 거꾸로 풀어 둔 표. 값: +n = 둘 차례가 n수 안에 이김, -n = n수 안에 짐, 없음 = 끝나지 않는 국면
let tttTable = null;
const tttKey = (a, b) => a.join('') + '/' + b.join('');
function tttSolve() {
  const qs = [[]];
  for (let i = 0; i < 9; i++) { qs.push([i]); for (let j = 0; j < 9; j++) if (j !== i) { qs.push([i, j]); for (let k = 0; k < 9; k++) if (k !== i && k !== j) qs.push([i, j, k]); } }
  const res = new Map(), cnt = new Map(), pred = new Map(), queue = [];
  for (const a of qs) {
    if (tttLine(a)) continue;
    for (const b of qs) {
      if (tttLine(b) || b.some((x) => a.includes(x))) continue;
      if (!(b.length === a.length || b.length === a.length + 1 || (a.length === TTT_MAX && b.length === TTT_MAX))) continue;
      const k = tttKey(a, b);
      let win = false;
      const succ = [];
      for (const i of tttEmpties(a, b)) {
        const na = tttPlaced(a, i);
        if (tttLine(na)) { win = true; break; }
        succ.push(tttKey(b, na));
      }
      if (win) { res.set(k, 1); queue.push(k); continue; }
      cnt.set(k, succ.length);
      for (const n of succ) { if (!pred.has(n)) pred.set(n, []); pred.get(n).push(k); }
    }
  }
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h], v = res.get(k);
    for (const p of pred.get(k) || []) {
      if (res.has(p)) continue;
      if (v > 0) { const c = cnt.get(p) - 1; cnt.set(p, c); if (!c) { res.set(p, -(v + 1)); queue.push(p); } }
      else { res.set(p, -v + 1); queue.push(p); }
    }
  }
  return res;
}
/** 어려움용 표를 미리 만들어 둔다 (첫 수가 느려지지 않게) */
export function tttWarm() { tttTable ||= tttSolve(); }
function tttPerfect(me, op) {
  tttWarm();
  let best = null;
  for (const i of tttEmpties(me, op)) {
    const nm = tttPlaced(me, i);
    const v = tttLine(nm) ? -0 : tttTable.get(tttKey(op, nm));
    let sc;
    if (tttLine(nm)) sc = 1e6;
    else if (v == null) sc = 0;               // 서로 막으면 끝나지 않는 수
    else if (v < 0) sc = 1e5 - -v;            // 상대가 지는 국면 → 빨리 이길수록 좋다
    else sc = -1e5 + v;                       // 상대가 이기는 국면 → 최대한 버틴다
    // 같은 점수라면 상대가 실수하기 쉬운 수 (상대의 이기는 응수가 적은 수)
    if (v > 0) sc -= tttEmpties(op, nm).filter((j) => { const r = tttTable.get(tttKey(nm, tttPlaced(op, j))); return tttLine(tttPlaced(op, j)) || (r != null && r < 0); }).length * 0.01;
    sc += Math.random() * 0.001;
    if (!best || sc > best.sc) best = { i, sc };
  }
  return best.i;
}
// depth: 몇 수 앞까지 읽는지, rand: 아무 데나 둘 확률, slip: 두 번째로 좋은 수를 둘 확률, perfect: 완벽한 표 사용
const TTT_LV = { easy: { depth: 2, rand: 0.3, slip: 0.3 }, normal: { depth: 5, rand: 0, slip: 0.12 }, hard: { perfect: true } };
/** me: AI의 표시들, op: 상대 표시들 → 둘 칸 */
export function tttAi(me, op, lv) {
  const L = pick(TTT_LV, lv), cand = tttEmpties(me, op);
  if (L.perfect) return tttPerfect(me, op);
  if (Math.random() < L.rand) return cand[Math.floor(Math.random() * cand.length)];
  const scored = cand.map((i) => {
    const nm = tttPlaced(me, i);
    return { i, v: (tttLine(nm) ? 2000 : -tttSearch(op, nm, L.depth - 1, -Infinity, Infinity)) + Math.random() * 0.5 };
  }).sort((x, y) => y.v - x.v);
  // 이기는 수가 있으면 무조건 둔다. 그 외에는 가끔 두 번째 수 (쉬움·보통)
  if (scored[0].v < 1000 && scored[1] && scored[1].v > -900 && Math.random() < L.slip) return scored[1].i;
  return scored[0].i;
}

/* ================= 오목 (1 = 흑 · 2 = 백 · AI는 어느 색이든 · 흑은 렌주룰 금수를 지킨다) ================= */
const GM_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const W5 = [0, 12, 120, 1400, 16000, 1e6]; // 5칸 창 안의 내 돌 개수별 가치
const gmIn = (x, y) => x >= 0 && y >= 0 && x < GM_N && y < GM_N;
// (x,y)에 p를 둔다고 가정했을 때, 그 칸을 지나는 모든 5칸 창의 가치 합
function gmCell(b, x, y, p) {
  let total = 0;
  for (const [dx, dy] of GM_DIRS) {
    for (let k = -4; k <= 0; k++) {
      let own = 1, ok = true;
      for (let i = 0; i < 5; i++) {
        const cx = x + dx * (k + i), cy = y + dy * (k + i);
        if (!gmIn(cx, cy)) { ok = false; break; }
        if (cx === x && cy === y) continue;
        const v = b[cy * GM_N + cx];
        if (v === p) own++; else if (v) { ok = false; break; }
      }
      if (ok) total += W5[own];
    }
  }
  return total;
}
const gmNear = (b, x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (gmIn(x + dx, y + dy) && b[(y + dy) * GM_N + x + dx]) return true; return false; };
// miss: 차선책을 둘 확률, range: 차선책 후보 수, atk/def: 공격·수비 가중치, look: 한 수 앞 읽기
// 쉬움: 가끔 차선책 · 보통: 한 수 앞 위협까지 계산 · 어려움: 여러 수 읽기(search, 시간 제한)
const GM_LV = {
  easy: { miss: 0.4, range: 5, atk: 1, def: 0.7, look: false, alert: false },
  normal: { miss: 0.05, range: 2, atk: 1.1, def: 1, look: true, alert: true },
  hard: { miss: 0, range: 1, atk: 1.1, def: 1, look: true, alert: true, search: { depth: 8, ms: 700 } },
};
// ---- 오목 어려움: 후보를 좁힌 알파베타 수 읽기 ----
const GM_ABORT = {};
let gmDeadline = Infinity, gmNodes = 0;
// 판 평가 (AI 쪽 +): 한 색만 들어 있는 모든 5칸 창의 가치 합
function gmEval(b) {
  const N = GM_N;
  let sc = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dx, dy] of GM_DIRS) {
    if (!gmIn(x + dx * 4, y + dy * 4)) continue;
    let a = 0, h = 0;
    for (let k = 0; k < 5; k++) { const v = b[(y + dy * k) * N + x + dx * k]; if (v === 2) a++; else if (v === 1) h++; }
    if (a && h) continue;
    if (a) sc += W5[a]; else if (h) sc -= W5[h];
  }
  return sc;
}
// p가 둘 후보: 돌 근처 빈칸을 공격 + 수비 가치로 줄 세워 k개. 이기는 수 · 막아야 하는 수 표시
function gmCands(b, p, k) {
  const N = GM_N, out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (b[y * N + x] || !gmNear(b, x, y)) continue;
    const at = gmCell(b, x, y, p), df = gmCell(b, x, y, 3 - p);
    out.push({ i: y * N + x, at, df, s: at + df * 0.9 });
  }
  out.sort((u, v) => v.s - u.s);
  if (p !== 1) return out.slice(0, k);
  // 흑(사람)은 금수(3-3 · 4-4 · 장목)를 둘 수 없다 → 수 읽기에서도 흑의 후보에서 뺀다 (렌주룰)
  const res = [];
  for (const c of out) { if (res.length >= k) break; if (!gmForbidden(b, c.i)) res.push(c); }
  return res;
}
function gmNega(b, depth, a, bt, p) {
  if ((++gmNodes & 63) === 0 && performance.now() > gmDeadline) throw GM_ABORT;
  const cs = gmCands(b, p, depth >= 3 ? 9 : 7);
  if (!cs.length) return 0;
  if (cs.some((c) => c.at >= 1e6)) return 1e8 + depth; // 이번 수로 5목
  const must = cs.filter((c) => c.df >= 1e6); // 상대 5목 자리는 막아야 한다
  if (must.length > 1) return -(1e8 + depth - 1); // 두 군데를 동시에 막을 수 없음
  if (depth <= 0) return p === 2 ? gmEval(b) : -gmEval(b);
  let best = -Infinity;
  for (const c of must.length ? must : cs) {
    b[c.i] = p;
    const v = -gmNega(b, depth - 1, -bt, -a, 3 - p);
    b[c.i] = 0;
    if (v > best) best = v;
    if (v > a) a = v;
    if (a >= bt) break;
  }
  return best;
}
function gmSearch(board, o, ai = 2) {
  const b = board.slice();
  let order = gmCands(b, ai, 12);
  if (!order.length) return b.findIndex((v, i) => !v && (ai !== 1 || !gmForbidden(b, i)));
  const win = order.find((c) => c.at >= 1e6); if (win) return win.i;
  const must = order.filter((c) => c.df >= 1e6); if (must.length) return must[0].i;
  let best = order[0].i;
  gmDeadline = performance.now() + o.ms; gmNodes = 0;
  try {
    for (let d = 1; d <= o.depth; d++) {
      let a = -Infinity, bi = order[0].i;
      const sc = [];
      for (const c of order) {
        b[c.i] = ai;
        const v = -gmNega(b, d - 1, -Infinity, a === -Infinity ? Infinity : -a + 1, 3 - ai);
        b[c.i] = 0;
        sc.push({ c, v: v + Math.random() * 0.5 });
        if (v > a) { a = v; bi = c.i; }
      }
      best = bi;
      order = sc.sort((u, v) => v.v - u.v).map((x) => x.c); // 다음 깊이는 좋은 수부터
      if (a >= 1e8) break; // 이기는 길을 찾음
    }
  } catch (e) { if (e !== GM_ABORT) throw e; }
  gmDeadline = Infinity;
  return best;
}
/** 오목 AI의 수: ai = AI의 돌 (1 흑 · 2 백). 흑이면 금수 자리는 두지 않는다 */
/**
 * 오목 AI의 할 일 (rules.js TURN.gomoku 상태 — 렌주룰 · 3수 교환 · 5수 2타의 모든 단계) → 그 단계의 수
 * @param {object} st TURN.gomoku 상태 · @param {number} seat AI의 좌석
 */
export function gomokuAct(st, lv, seat) {
  const b = st.b.slice(), N = GM_N, col = seat === st.black ? 1 : 2;
  const open = (k) => { const out = []; for (let i = 0; i < N * N; i++) if (gmOpenOk(b, k, i)) out.push(i); return out; };
  switch (st.phase) {
    case 'open': { const o = open(st.stones); return o[Math.floor(Math.random() * o.length)]; } // 개시 3수: 정해진 범위 안 아무 자리 (26가지 개시)
    case 'swap': { // 내가 색을 고른다: 흑이 유리해 보이면 흑을 가져간다 (쉬움은 아무거나)
      if (lv === 'easy') return Math.random() < 0.5 ? 'swap' : 'keep';
      const edge = -gmEval(b) + (gmCands(b, 1, 1)[0]?.at || 0) * 0.3; // 흑 쪽 판단 (+ 흑의 다음 수 가치)
      return edge > 40 ? 'swap' : 'keep';
    }
    case 'five': { // 흑: 백이 덜 좋은 쪽을 고를 테니 좋은 두 곳을 내놓는다 (대칭인 자리는 함께 못 냄)
      const cs = gmCands(b, 1, 16).map((c) => c.i);
      const a = cs[0] ?? b.findIndex((v) => !v);
      const c = cs.find((i) => i !== a && !gmSymEq(b, a, i)) ?? b.findIndex((v, i) => !v && i !== a && !gmSymEq(b, a, i));
      return [a, c];
    }
    case 'pick': { // 백: 흑에게 덜 좋은 쪽을 남긴다
      let best = st.five[0], bv = -Infinity;
      for (const i of st.five) { b[i] = 1; const v = gmEval(b) - (gmCands(b, 1, 1)[0]?.at || 0) * 0.5; b[i] = 0; if (v > bv) { bv = v; best = i; } }
      return best;
    }
    default: return gomokuAi(b, lv, col); // 4수(백)와 대국
  }
}
export function gomokuAi(board, lv, ai = 2) {
  const L = pick(GM_LV, lv), N = GM_N, ME = 3 - ai, AI = ai, b = board.slice();
  if (!b.some(Boolean)) return 7 * N + 7;
  const cand = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (b[y * N + x] || !gmNear(b, x, y)) continue;
    if (AI === 1 && gmForbidden(b, y * N + x)) continue; // 흑 금수 (렌주룰)
    const atk = gmCell(b, x, y, AI), def = gmCell(b, x, y, ME);
    // crit: 반드시 둬야 하는 수 (5목 완성·저지, 보통 이상은 열린 3도 막음)
    cand.push({ i: y * N + x, sc: atk * L.atk + def * L.def - (Math.abs(x - 7) + Math.abs(y - 7)) * 0.5, crit: atk >= 1e6 || def >= 1e6 || (L.alert && def >= 32000) });
  }
  if (!cand.length) return b.findIndex((v, i) => !v && (AI !== 1 || !gmForbidden(b, i)));
  if (L.search) return gmSearch(b, L.search, AI); // 어려움: 수 읽기 (이기는 수 · 막을 수는 그 안에서 먼저 본다)
  cand.sort((a, c) => c.sc - a.sc);
  if (cand[0].crit) return cand[0].i;
  if (L.miss && cand.length > L.range && Math.random() < L.miss) return cand[1 + Math.floor(Math.random() * (L.range - 1))].i;
  // 어려움: 상위 후보마다 상대 응수 중 가장 위협적인 수를 계산해 빼 준다
  if (L.look) {
    const top = cand.slice(0, 6);
    for (const c of top) {
      b[c.i] = AI;
      let threat = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!b[y * N + x] && gmNear(b, x, y)) threat = Math.max(threat, gmCell(b, x, y, ME));
      b[c.i] = 0;
      c.sc2 = c.sc - threat * 0.4;
    }
    top.sort((a, c) => c.sc2 - a.sc2);
    return top[0].i;
  }
  return cand[0].i;
}

/* ================= 사목 (사람 1 · AI 2) ================= */
const C4_ORDER = [3, 2, 4, 1, 5, 0, 6]; // 가운데부터 탐색 (가지치기 효율)
function c4Score(b) {
  const ME = 1, AI = 2;
  let sc = 0;
  for (let r = 0; r < C4_R; r++) sc += b[r * C4_C + 3] === AI ? 3 : b[r * C4_C + 3] === ME ? -3 : 0;
  for (let r = 0; r < C4_R; r++) for (let c = 0; c < C4_C; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const er = r + dr * 3, ec = c + dc * 3;
    if (er < 0 || er >= C4_R || ec < 0 || ec >= C4_C) continue;
    let a = 0, m = 0;
    for (let k = 0; k < 4; k++) { const v = b[(r + dr * k) * C4_C + c + dc * k]; if (v === AI) a++; else if (v === ME) m++; }
    if (a && m) continue;
    if (a === 3) sc += 6; else if (a === 2) sc += 2;
    if (m === 3) sc -= 8; else if (m === 2) sc -= 2;
  }
  return sc;
}
// 생각 시간 제한: 시간이 다 되면 탐색을 중단하고 직전 깊이의 결과를 쓴다
const C4_ABORT = {};
let c4Deadline = Infinity, c4Nodes = 0;
// 같은 국면을 다시 읽지 않게 기억하는 표 (국면 → 읽은 깊이 · 값 · 좋은 줄). 칸마다 무작위 번호를 XOR해서 국면 번호를 만든다
const C4_Z = (() => { let x = 0x2545f491; const r = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; }; return Array.from({ length: C4_C * C4_R * 2 }, r); })();
let c4TT = new Map();
function c4Nega(b, depth, a, bt, p, filled, h) {
  if ((++c4Nodes & 1023) === 0 && performance.now() > c4Deadline) throw C4_ABORT;
  if (filled >= C4_R * C4_C) return 0;
  if (!depth) return p === 2 ? c4Score(b) : -c4Score(b);
  const a0 = a, b0 = bt, e = c4TT.get(h);
  let first = -1;
  if (e) {
    if (e.d >= depth) {
      if (e.f === 0) return e.v;
      if (e.f === 1 && e.v > a) a = e.v; else if (e.f === 2 && e.v < bt) bt = e.v;
      if (a >= bt) return e.v;
    }
    first = e.m;
  }
  let best = -Infinity, bestC = -1;
  for (let k = -1; k < C4_ORDER.length; k++) {
    const c = k < 0 ? first : C4_ORDER[k];
    if (c < 0 || (k >= 0 && c === first)) continue;
    const r = c4Drop(b, c); if (r < 0) continue;
    const idx = r * C4_C + c;
    b[idx] = p;
    const v = c4WinsAt(b, r, c, p) ? 1e6 + depth : -c4Nega(b, depth - 1, -bt, -a, 3 - p, filled + 1, h ^ C4_Z[idx * 2 + p - 1]);
    b[idx] = 0;
    if (v > best) { best = v; bestC = c; }
    if (v > a) a = v;
    if (a >= bt) break;
  }
  if (c4TT.size > 200000) c4TT.clear(); // 메모리 한도 (서버 1GB)
  c4TT.set(h, { d: depth, v: best, f: best <= a0 ? 2 : best >= b0 ? 1 : 0, m: bestC });
  return best;
}
// deep: 최대 탐색 깊이, ms: 생각 시간 한도, shallowP: 얕게(2수) 읽을 확률, rand: 아무 줄에나 둘 확률
// 어려움: 국면 기억 표 + 첫 수 가지치기로 예전(0.32초)보다 훨씬 깊게 읽는다 (보통과의 차이를 벌림)
const C4_LV = { easy: { deep: 2, ms: 60, shallowP: 0, rand: 0.3 }, normal: { deep: 6, ms: 160, shallowP: 0.18, rand: 0 }, hard: { deep: 42, ms: 600, shallowP: 0, rand: 0 } };
function c4Root(b, cols, depth, filled, h) {
  // 첫 수도 가지치기: 지금까지 가장 좋은 값(a)보다 1 이상 나쁘다고 판명되면 더 읽지 않는다 (정수 점수라 동점은 정확히 읽힌다)
  const sc = {};
  let a = -Infinity;
  for (const c of cols) {
    const r = c4Drop(b, c), idx = r * C4_C + c;
    b[idx] = 2;
    try { sc[c] = c4WinsAt(b, r, c, 2) ? 1e7 : -c4Nega(b, depth, -Infinity, a === -Infinity ? Infinity : -a + 1, 1, filled + 1, h ^ C4_Z[idx * 2 + 1]); }
    finally { b[idx] = 0; }
    if (sc[c] > a) a = sc[c];
  }
  return sc;
}
export function connect4Ai(board, lv) {
  const L = pick(C4_LV, lv), b = board.slice();
  let cols = C4_ORDER.filter((c) => c4Drop(b, c) >= 0);
  if (Math.random() < L.rand) return cols[Math.floor(Math.random() * cols.length)];
  const maxD = Math.random() < L.shallowP ? 2 : L.deep, filled = b.filter(Boolean).length;
  let h = 0;
  for (let i = 0; i < b.length; i++) if (b[i]) h ^= C4_Z[i * 2 + b[i] - 1];
  let scores = null;
  c4TT = new Map();
  c4Deadline = performance.now() + L.ms; c4Nodes = 0;
  try {
    for (let d = 1; d <= Math.min(maxD, C4_C * C4_R - filled); d++) {
      scores = c4Root(b, cols, d, filled, h);
      cols = cols.slice().sort((x, y) => scores[y] - scores[x]); // 다음 깊이는 좋은 수부터
      if (Math.abs(scores[cols[0]]) >= 1e6) break; // 승패가 이미 보이면 더 읽을 필요 없음
    }
  } catch (e) { if (e !== C4_ABORT) throw e; }
  c4Deadline = Infinity; c4TT = new Map();
  if (!scores) return cols[0];
  let best = -Infinity, choice = cols[0];
  for (const c of cols) { const v = scores[c] + Math.random(); if (v > best) { best = v; choice = c; } }
  return choice;
}

/* ================= 리버시 (사람 1 = 흑 · AI 2 = 백) ================= */
// 위치 가중치: 모서리는 강하고, 모서리 옆은 위험
const RV_WT = [
  100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, -1, -1, -1, -1, -2, 10, 5, -2, -1, -1, -1, -1, -2, 5,
  5, -2, -1, -1, -1, -1, -2, 5, 10, -2, -1, -1, -1, -1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100,
];
function rvEval(b) {
  let sc = 0, a = 0, h = 0;
  for (let i = 0; i < 64; i++) { if (b[i] === 2) { sc += RV_WT[i]; a++; } else if (b[i] === 1) { sc -= RV_WT[i]; h++; } }
  const empty = 64 - a - h;
  sc += (rvMoves(b, 2).length - rvMoves(b, 1).length) * 4;
  if (empty <= 16) sc += (a - h) * (17 - empty) * 2; // 막판에는 돌 개수가 점점 중요해진다 (예전에는 끝날 때만 셌다)
  return sc;
}
const RV_ABORT = {};
let rvDeadline = Infinity, rvNodes = 0;
function rvSearch(b, depth, p, a, bt) {
  if ((++rvNodes & 127) === 0 && performance.now() > rvDeadline) throw RV_ABORT;
  if (!depth) return rvEval(b);
  const ms = rvMoves(b, p);
  if (!ms.length) {
    if (!rvMoves(b, 3 - p).length) return (b.filter((v) => v === 2).length - b.filter((v) => v === 1).length) * 1000; // 종료
    return rvSearch(b, depth - 1, 3 - p, a, bt); // 패스
  }
  if (p === 2) {
    let v = -Infinity;
    for (const m of ms) { v = Math.max(v, rvSearch(rvApply(b, m, p), depth - 1, 1, a, bt)); a = Math.max(a, v); if (a >= bt) break; }
    return v;
  }
  let v = Infinity;
  for (const m of ms) { v = Math.min(v, rvSearch(rvApply(b, m, p), depth - 1, 2, a, bt)); bt = Math.min(bt, v); if (a >= bt) break; }
  return v;
}
// depth: 최대로 읽는 수, ms: 생각 시간 한도, noise: 판단 흔들림, rand: 아무 수나 둘 확률
// solve: 빈칸이 이만큼 이하로 남으면 끝까지 읽는다 (시간 안에서)
const RV_LV = { easy: { depth: 0, ms: 40, noise: 40, rand: 0.12 }, normal: { depth: 3, ms: 150, noise: 6, rand: 0, solve: 6 }, hard: { depth: 7, ms: 450, noise: 0, rand: 0, solve: 10 } };
/** → { i, f } (둘 칸 · 뒤집히는 칸) */
export function reversiAi(b, lv) {
  let ms = rvMoves(b, 2);
  const L = pick(RV_LV, lv);
  if (Math.random() < L.rand) return ms[Math.floor(Math.random() * ms.length)];
  let scored = null;
  const empty = b.filter((v) => !v).length, solve = L.solve && empty <= L.solve;
  rvDeadline = performance.now() + L.ms * (solve ? 2 : 1); rvNodes = 0;
  try {
    for (let d = 0; d <= (solve ? empty + 2 : L.depth); d++) {
      const cur = ms.map((m) => ({ m, v: rvSearch(rvApply(b, m, 2), d, 1, -Infinity, Infinity) }));
      scored = cur;
      ms = cur.slice().sort((x, y) => y.v - x.v).map((x) => x.m); // 다음 깊이는 좋은 수부터
    }
  } catch (e) { if (e !== RV_ABORT) throw e; }
  rvDeadline = Infinity;
  if (!scored) return ms[0];
  let best = scored[0].m, bv = -Infinity;
  for (const { m, v } of scored) { const w = v + Math.random() * L.noise; if (w > bv) { bv = w; best = m; } }
  return best;
}

/* ================= 체커 (사람 1 = 아래 · AI -1 = 위) ================= */
function ckEval(b, side) {
  let sc = 0;
  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (!v) continue;
    const r = i >> 3, c = i & 7, own = Math.sign(v);
    let val = Math.abs(v) === 2 ? 165 : 100;
    if (Math.abs(v) === 1) {
      val += (own === 1 ? 7 - r : r) * 4; // 앞으로 나간 만큼
      if ((own === 1 && r === 7) || (own === -1 && r === 0)) val += 8; // 뒷줄 지키기
    }
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) val += 6; // 가운데
    sc += own * val;
  }
  return sc * side;
}
let ckDeadline = Infinity;
const CK_TIMEOUT = {};
function ckNega(b, side, d, a, bt) {
  if (performance.now() > ckDeadline) throw CK_TIMEOUT;
  const ms = ckMoves(b, side);
  if (!ms.length) return -100000 - d;
  if (d <= 0 && !ms[0].caps.length) return ckEval(b, side);
  if (d <= -6) return ckEval(b, side); // 잡기가 이어지는 동안만 조금 더 본다
  let best = -Infinity;
  for (const m of ms) {
    const v = -ckNega(ckApply(b, m), -side, d - 1, -bt, -a);
    if (v > best) best = v;
    if (v > a) a = v;
    if (a >= bt) break;
  }
  return best;
}
const CK_LV = { easy: { depth: 2, ms: 200, noise: 60 }, normal: { depth: 6, ms: 500, noise: 8 }, hard: { depth: 14, ms: 1200, noise: 0 } };
/** → 수 { path, caps, crown } */
/* ---- AI가 먼저 두는 쪽(앞 색)일 때: 판을 바꿔 '나중 쪽 AI'에게 그대로 물어본다 (두 쪽의 규칙이 같은 게임) ---- */
const swap12 = (b) => b.map((v) => (v === 1 ? 2 : v === 2 ? 1 : v));
/** 사목 AI · ai = AI의 색 (1 먼저 · 2 나중) */
export const connect4AiAs = (b, lv, ai = 2) => connect4Ai(ai === 2 ? b : swap12(b), lv);
/** 리버시 AI · ai = AI의 돌 (1 흑 · 2 백) — 뒤집는 칸은 색과 상관없이 같은 자리 */
export const reversiAiAs = (b, lv, ai = 2) => reversiAi(ai === 2 ? b : swap12(b), lv);
/** 체커 AI · side = AI의 편 (1 아래에서 위로 · -1 위에서 아래로). 1이면 판을 180도 돌리고 편을 바꿔 물어본 뒤 칸을 되돌린다 */
export function checkersAiAs(b, lv, side = -1) {
  if (side === -1) return checkersAi(b, lv);
  const rb = Array(64);
  for (let i = 0; i < 64; i++) rb[63 - i] = -b[i];
  const m = checkersAi(rb, lv);
  return m && { ...m, path: m.path.map((i) => 63 - i), caps: m.caps.map((i) => 63 - i) };
}
export function checkersAi(b, lv) {
  const L = pick(CK_LV, lv);
  let ms = ckMoves(b, -1);
  if (ms.length === 1) return ms[0];
  let scored = ms.map((m) => ({ m, v: 0 }));
  ckDeadline = performance.now() + L.ms;
  try {
    for (let d = 1; d <= L.depth; d++) {
      const cur = ms.map((m) => ({ m, v: -ckNega(ckApply(b, m), 1, d - 1, -Infinity, Infinity) }));
      cur.sort((x, y) => y.v - x.v);
      scored = cur; ms = cur.map((x) => x.m);
      if (Math.abs(cur[0].v) > 50000) break;
    }
  } catch (e) { if (e !== CK_TIMEOUT) throw e; }
  ckDeadline = Infinity;
  let choice = scored[0], bv = -Infinity;
  for (const x of scored) { const v = x.v + (Math.random() - 0.5) * L.noise * 2; if (v > bv) { bv = v; choice = x; } }
  return choice.m;
}

/* ================= 체스 (사람 백 · AI 흑) ================= */
export const CHESS_LV = { easy: { maxDepth: 2, ms: 350, noise: 180 }, normal: { maxDepth: 3, ms: 800, noise: 25 }, hard: { maxDepth: 6, ms: 1600, noise: 0 } };
/** → 수 { from, to, promo? } (둘 수 없으면 null) */
export const chessAi = (st, lv) => CH.search(CH.clone(st), pick(CHESS_LV, lv));

/* ================= 백개먼 (사람 1 = 하양 · AI -1 = 검정) ================= */
const bgOwn = (v, side) => Math.sign(v) === side;
/** 한 차례에 가능한 모든 마무리 국면 (같은 국면은 하나로) */
export function bgFinals(b, side, dice) {
  const res = new Map(), memo = new Map();
  const walk = (bd, left, seq, first) => {
    const ls = left.length ? bgLegal(bd, side, left, first) : [];
    if (!ls.length) { const k = bgKey(bd); if (!res.has(k)) res.set(k, { seq, b: bd }); return; }
    const seen = new Set();
    for (const m of ls) {
      const r = bgApply(bd, m, side), kk = bgKey(r.b) + '#' + m.d;
      if (seen.has(kk)) continue; seen.add(kk);
      const i = left.indexOf(m.d);
      const nk = kk + '|' + left.join('');
      if (memo.has(nk)) continue; memo.set(nk, 1);
      walk(r.b, left.slice(0, i).concat(left.slice(i + 1)), seq.concat([{ ...m, hit: r.hit }]), false);
    }
  };
  walk(b, dice, [], true);
  return [...res.values()];
}
export const bgPip = (b, side) => { let n = b.bar[side] * 25; for (let i = 0; i < 24; i++) if (bgOwn(b.p[i], side)) n += Math.abs(b.p[i]) * (side === 1 ? i + 1 : 24 - i); return n; };
function bgContact(b) {
  let myBack = -1, aiBack = 24;
  for (let i = 0; i < 24; i++) { if (b.p[i] > 0) myBack = Math.max(myBack, i); if (b.p[i] < 0) aiBack = Math.min(aiBack, i); }
  return b.bar[1] || b.bar[-1] || myBack > aiBack;
}
function bgEval(b, side, W) {
  const opp = -side, pd = bgPip(b, opp) - bgPip(b, side);
  if (!bgContact(b)) return pd * 1.4 + (b.off[side] - b.off[opp]) * 3;
  let sc = pd * W.pip + (b.bar[opp] - b.bar[side]) * W.bar;
  let run = 0, bestRun = 0;
  for (let k = 0; k < 24; k++) {
    const i = side === 1 ? k : 23 - k, v = b.p[i] * side; // k: 내 홈에서 먼 순서
    if (v >= 2) { sc += W.point + (k <= 5 ? W.home : 0); run++; bestRun = Math.max(bestRun, run); } else run = 0;
    if (v === 1) {
      // 뒤에서 쫓아오는 상대 말이 가까울수록 위험
      let danger = 0;
      for (let dd = 1; dd <= 12; dd++) { const j = i + (side === 1 ? dd : -dd); if (j >= 0 && j < 24 && bgOwn(b.p[j], opp)) danger += dd <= 6 ? 2 : 1; }
      if (b.bar[opp]) danger += 2;
      sc -= W.blot + danger * W.expose * (k <= 5 ? 1.3 : 1);
    }
  }
  return sc + bestRun * bestRun * W.prime;
}
const BG_LV = {
  easy: { rand: 0.35, noise: 12, W: { pip: 0.8, bar: 4, point: 2, home: 1, blot: 1, expose: 0.4, prime: 0.3 } },
  normal: { rand: 0.05, noise: 3, W: { pip: 1, bar: 7, point: 4, home: 2, blot: 3, expose: 1, prime: 0.8 } },
  hard: { rand: 0, noise: 0.5, W: { pip: 1, bar: 9, point: 5, home: 3, blot: 4, expose: 1.5, prime: 1.2 } },
};
/** 남은 주사위(left)로 둘 이동 순서 [{from, to, d, hit}] (움직일 수 없으면 빈 배열) */
export function backgammonAi(b, left, lv, side = -1) {
  const L = pick(BG_LV, lv), fs = bgFinals(b, side, left);
  let choice = fs[0];
  if (Math.random() < L.rand) choice = fs[Math.floor(Math.random() * fs.length)];
  else {
    let bv = -Infinity;
    for (const f of fs) { const v = bgEval(f.b, side, L.W) + (Math.random() - 0.5) * L.noise * 2; if (v > bv) { bv = v; choice = f; } }
  }
  return choice ? choice.seq.slice() : [];
}

/* ================= 바둑 (사람 1 = 흑 · AI 2 = 백) ================= */
// 판 크기별 AI 생각량 (난이도 = 판 크기: 9 · 13 · 19줄)
export const GO_LV = { easy: { playouts: 6000, ms: 1800 }, normal: { playouts: 6000, ms: 2400 }, hard: { playouts: 6000, ms: 3000 } };
export const GO_SIZE = { easy: 9, normal: 13, hard: 19 };
// 연습 대결 AI 세기 (앱에서만 둔다 · 랭킹 없음). 어려움 = GO_LV (랭킹 대결, 서버가 둔다)
export const GO_POWER = { easy: { playouts: 150, ms: 500 }, normal: { playouts: 800, ms: 1400 } };
/** → 둘 칸 (-1 = 통과). 상대가 통과했고 지금 계가해서 이기고 있으면 따라 통과해서 끝낸다 */
export function goAi(g, lv) {
  if (g.passes === 1 && GO.score(g, GO.guessDead(g, 300)).winner === g.turn) return -1;
  const mv = GO.think(g, pick(GO_LV, lv));
  return mv >= 0 && GO.legal(g, mv) ? mv : -1;
}

/* ================= 윷놀이 ================= */
// 던질 것이 있으면 던지고, 아니면 (결과, 말) 짝마다 점수를 매겨 가장 좋은 것: 나기 > 잡기 > 전진 · 지름길 · 업기 − 잡힐 위험
const Y_P = { 1: 3 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 5: 1 / 16 }; // 그 칸수가 나올 확률
/** 다른 사람이 다음 차례에 칸 st에 멈출 확률 (대략) */
function yutDanger(s, p, st) {
  if (st === YUT_OUT || st < 0) return 0;
  let safe = 1;
  s.pc.forEach((q, qi) => {
    if (qi === p) return;
    const starts = new Set(q.filter((pc) => pc.at >= 0 && pc.at !== YUT_OUT).map((pc) => pc.at));
    if (q.some((pc) => pc.at === -1)) starts.add(-1);
    for (const from of starts) for (let k = 1; k <= 5; k++) { const path = yutSteps(from, k); if (path[path.length - 1] === st) safe *= 1 - Y_P[k]; }
  });
  return 1 - safe;
}
/** 지금 차례(s.turn)의 할 일 → { a: 'throw' } 또는 { a: 'move', ri, from } (둘 수 없으면 null) */
export function yutAi(s, rnd = Math.random) {
  if (s.over) return null;
  if (s.bonus > 0) return { a: 'throw' };
  const p = s.turn;
  let best = null;
  s.pend.forEach((r, ri) => {
    for (const o of yutOptions(s, p, r)) {
      const n = o.pieces.length, dest = o.dest;
      let v;
      if (dest === YUT_OUT) v = 1000 * n;
      else {
        v = (yutRem(o.from) - yutRem(dest)) * 4 * n;
        s.pc.forEach((q, qi) => { if (qi !== p) for (const pc of q) if (pc.at === dest) v += 70 + (21 - yutRem(pc.at)) * 3; });
        if ([5, 10, 23].includes(dest)) v += 14;
        if (s.pc[p].some((pc, i) => pc.at === dest && !o.pieces.includes(i))) v += 10; // 업기
        const worth = (st) => (12 + (21 - yutRem(st)) * 4) * n;
        v -= yutDanger(s, p, dest) * worth(dest);
        if (o.from >= 0) v += yutDanger(s, p, o.from) * worth(o.from) * 0.8; // 위험한 곳에서 벗어나기
      }
      v += rnd() * 3;
      if (!best || v > best.v) best = { v, ri, from: o.from };
    }
  });
  return best ? { a: 'move', ri: best.ri, from: best.from } : null;
}
