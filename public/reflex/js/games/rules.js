// 1:1 대결 게임의 규칙 모음 — 화면(앱)과 서버가 똑같은 규칙을 쓴다 (브라우저 전용 코드 없음)
// · 각 게임의 순수 규칙 함수 (AI · 화면에서 사용)
// · TURN: 온라인 대결용 어댑터. 서버가 수를 검사하고 승패를 정한다. 좌석 0이 먼저 둔다.
import * as CH from './chess-core.js';
import * as GO from './go-core.js';

/* ================= 틱택토 (사라지는 틱택토: 각자 3개까지) ================= */
export const TTT_MAX = 3;
export const TTT_CAP = 60; // 둘 다 막기만 하면 끝나지 않으므로 합쳐서 60수(각자 30수)까지 승부가 안 나면 무승부
export const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const tttLine = (q) => (q.length < 3 ? null : TTT_LINES.find((l) => l.every((i) => q.includes(i))) || null);
/** 수를 둔 결과 (4번째면 가장 오래된 것이 먼저 사라진다) */
export const tttPlaced = (q, i) => { const n = q.concat(i); if (n.length > TTT_MAX) n.shift(); return n; };
export function tttEmpties(a, b) { const out = []; for (let i = 0; i < 9; i++) if (!a.includes(i) && !b.includes(i)) out.push(i); return out; }

/* ================= 오목 (15줄 · 렌주룰) ================= */
// · 흑(1)이 먼저 둔다. 흑은 3-3(열린 3 두 개) · 4-4(4 두 개, 한 줄 안의 두 개 포함) · 장목(6목 이상)을 둘 수 없다 (금수).
// · 정확히 5목이 되는 수는 금수 모양이 함께 생겨도 둘 수 있고 흑이 이긴다. 흑의 장목은 승리가 아니다.
// · 백(2)은 금수가 없고 장목(6목 이상)도 이긴다. 4-3은 흑도 둘 수 있다 (렌주룰 표준).
export const GM_N = 15;
const GM_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const gmIn = (x, y) => x >= 0 && y >= 0 && x < GM_N && y < GM_N;
const gmAt = (b, x, y) => (gmIn(x, y) ? b[y * GM_N + x] : -1);
/** (x,y)의 p 돌을 지나 (dx,dy) 방향으로 이어진 돌 수 */
function gmRun(b, x, y, dx, dy, p) {
  let n = 1;
  for (const sg of [1, -1]) { let cx = x + dx * sg, cy = y + dy * sg; while (gmAt(b, cx, cy) === p) { n++; cx += dx * sg; cy += dy * sg; } }
  return n;
}
/** (x,y)의 흑돌을 지나는 '4': 빈칸 하나만 채우면 정확히 5목이 되는 5칸 창 → Map(4개 돌의 묶음 → 채울 칸들)
 *  같은 4개 돌을 양쪽에서 채울 수 있으면(열린 4) 한 묶음 · X.XXX.X처럼 다른 돌 묶음이면 4가 두 개 */
function gmFours(b, x, y, dx, dy) {
  const groups = new Map();
  for (let k = -4; k <= 0; k++) {
    const blacks = [];
    let empty = -1, ok = true;
    for (let j = 0; j < 5 && ok; j++) {
      const cx = x + dx * (k + j), cy = y + dy * (k + j), v = gmAt(b, cx, cy);
      if (v === 1) blacks.push(cy * GM_N + cx);
      else if (v === 0 && empty < 0) empty = cy * GM_N + cx;
      else ok = false;
    }
    if (!ok || blacks.length !== 4 || empty < 0) continue;
    if (gmAt(b, x + dx * (k - 1), y + dy * (k - 1)) === 1 || gmAt(b, x + dx * (k + 5), y + dy * (k + 5)) === 1) continue; // 채우면 6목 이상 → 4가 아니다
    const key = blacks.join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(empty);
  }
  return groups;
}
const gmStraightFour = (b, x, y, dx, dy) => [...gmFours(b, x, y, dx, dy).values()].some((e) => e.length >= 2);
/** (x,y)의 흑돌이 이 방향으로 '열린 3'인지: 한 수를 더 두면 열린 4가 되고, 그 수가 금수가 아니어야 한다 */
function gmThree(b, x, y, dx, dy, depth) {
  for (let t = -4; t <= 4; t++) {
    if (!t) continue;
    const cx = x + dx * t, cy = y + dy * t;
    if (gmAt(b, cx, cy) !== 0) continue;
    const q = cy * GM_N + cx;
    b[q] = 1;
    const st = gmStraightFour(b, x, y, dx, dy);
    b[q] = 0;
    if (st && (depth >= 2 || !gmForbidden(b, q, depth + 1))) return true;
  }
  return false;
}
/** 흑이 빈칸 i에 두면 금수인지 → '33' | '44' | '6'(장목) | '' (둘 수 있음). 판(b)은 잠깐 바꿨다가 그대로 되돌린다 */
export function gmForbidden(b, i, depth = 0) {
  if (b[i] !== 0) return '';
  const x = i % GM_N, y = Math.floor(i / GM_N);
  b[i] = 1;
  try {
    let five = false, over = false;
    for (const [dx, dy] of GM_DIRS) { const n = gmRun(b, x, y, dx, dy, 1); if (n === 5) five = true; else if (n > 5) over = true; }
    // 아일랜드 v1.10.71 (Codex 검토): 우리 오목(lib/game.js)은 다른 방향에 장목이 함께 생기면 5목이어도 금수 — 장목을 먼저 본다
    if (over) return '6';
    if (five) return ''; // 정확히 5목이면 언제나 둘 수 있다 (이긴다)
    const f = GM_DIRS.map(([dx, dy]) => gmFours(b, x, y, dx, dy).size);
    if (f.reduce((a, v) => a + v, 0) >= 2) return '44';
    let threes = 0;
    GM_DIRS.forEach(([dx, dy], d) => { if (!f[d] && gmThree(b, x, y, dx, dy, depth)) threes++; });
    return threes >= 2 ? '33' : '';
  } finally { b[i] = 0; }
}
export const GM_BAN_NAME = { 33: '3-3', 44: '4-4', 6: '장목(6목 이상)' };

/* ---- 개시 규칙: 3수 교환 · 5수 2타 (三手交换五手两打 · 중국 연주 표준) ----
 * 1) 먼저 두는 사람(임시 흑)이 3수를 둔다: 1수 흑은 천원, 2수 백은 천원 둘레 8칸, 3수 흑은 천원 중심 5×5 (26가지 개시)
 * 2) 상대가 색을 바꿀지 고른다 (바꾸면 고른 사람이 흑)
 * 3) 백이 4수를 아무 데나 둔다
 * 4) 흑이 5수 자리를 두 곳 내놓는다 (판 모양으로 대칭인 두 곳은 안 됨) → 백이 하나를 골라 그 자리에 흑이 놓이고, 백이 6수를 둔다
 * 5) 그다음은 렌주룰 그대로 (흑 금수) */
const GM_C = 7 * GM_N + 7; // 천원
/** 개시 k번째 수(0 · 1 · 2)를 i에 둘 수 있는지 */
export function gmOpenOk(b, k, i) {
  if (!(i >= 0 && i < GM_N * GM_N) || b[i]) return false;
  const d = Math.max(Math.abs((i % GM_N) - 7), Math.abs(Math.floor(i / GM_N) - 7));
  return k === 0 ? i === GM_C : k === 1 ? d === 1 : k === 2 ? d <= 2 : false;
}
const GM_SYM = [(x, y) => [x, y], (x, y) => [-y, x], (x, y) => [-x, -y], (x, y) => [y, -x], (x, y) => [-x, y], (x, y) => [x, -y], (x, y) => [y, x], (x, y) => [-y, -x]];
/** 5수 후보 a와 c가 같은 자리인지: 판의 돌 모양을 그대로 겹치는 회전 · 뒤집기(+평행 이동)로 a가 c로 옮겨지면 같다 */
export function gmSymEq(b, a, c) {
  const st = [];
  for (let i = 0; i < b.length; i++) if (b[i]) st.push([i % GM_N, Math.floor(i / GM_N), b[i]]);
  if (!st.length) return true;
  const key = (arr) => arr.map(([x, y, v]) => `${x},${y},${v}`).sort().join(';');
  const base = key(st), mx = Math.min(...st.map((p) => p[0])), my = Math.min(...st.map((p) => p[1]));
  for (const f of GM_SYM) {
    const t = st.map(([x, y, v]) => [...f(x, y), v]);
    const tx = mx - Math.min(...t.map((p) => p[0])), ty = my - Math.min(...t.map((p) => p[1]));
    if (key(t.map(([u, w, v]) => [u + tx, w + ty, v])) !== base) continue;
    const [u, w] = f(a % GM_N, Math.floor(a / GM_N));
    if (u + tx === c % GM_N && w + ty === Math.floor(c / GM_N)) return true;
  }
  return false;
}
/** 좌석의 돌 (1 흑 · 2 백) */
export const gmColor = (s, seat) => (seat === s.black ? 1 : 2);
/** (x,y)에 둔 p의 돌로 오목이 됐으면 그 칸들 (흑은 정확히 5개만 · 백은 5개 이상) */
export function fiveAt(b, x, y, p) {
  for (const [dx, dy] of GM_DIRS) {
    const cells = [[x, y]];
    for (const sg of [1, -1]) {
      let cx = x + dx * sg, cy = y + dy * sg;
      while (gmIn(cx, cy) && b[cy * GM_N + cx] === p) { cells.push([cx, cy]); cx += dx * sg; cy += dy * sg; }
    }
    if (p === 1 ? cells.length === 5 : cells.length >= 5) return cells; // 흑의 장목(6목 이상)은 승리가 아니다
  }
  return null;
}

/* ================= 사목 (7×6, 넷 이으면 승리) ================= */
export const C4_C = 7, C4_R = 6;
export const c4Drop = (b, c) => { for (let r = C4_R - 1; r >= 0; r--) if (!b[r * C4_C + c]) return r; return -1; };
export function c4WinLine(b, p) {
  for (let r = 0; r < C4_R; r++) for (let c = 0; c < C4_C; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= C4_R || cc < 0 || cc >= C4_C || b[rr * C4_C + cc] !== p) break;
        cells.push(rr * C4_C + cc);
      }
      if (cells.length === 4) return cells;
    }
  }
  return null;
}
/** 방금 둔 칸을 지나는 줄만 확인 (탐색용으로 빠름) */
export function c4WinsAt(b, r, c, p) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (const sg of [1, -1]) {
      let rr = r + dr * sg, cc = c + dc * sg;
      while (rr >= 0 && rr < C4_R && cc >= 0 && cc < C4_C && b[rr * C4_C + cc] === p) { n++; rr += dr * sg; cc += dc * sg; }
    }
    if (n >= 4) return true;
  }
  return false;
}

/* ================= 리버시 (8×8, 흑(1)이 먼저) ================= */
export const RV_N = 8;
const RV_D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export function rvStart() { const b = Array(64).fill(0); b[27] = b[36] = 2; b[28] = b[35] = 1; return b; }
export function rvFlips(b, i, p) {
  if (b[i]) return [];
  const o = 3 - p, x0 = i % RV_N, y0 = Math.floor(i / RV_N), out = [];
  for (const [dx, dy] of RV_D8) {
    const line = [];
    let x = x0 + dx, y = y0 + dy;
    while (x >= 0 && y >= 0 && x < RV_N && y < RV_N && b[y * RV_N + x] === o) { line.push(y * RV_N + x); x += dx; y += dy; }
    if (line.length && x >= 0 && y >= 0 && x < RV_N && y < RV_N && b[y * RV_N + x] === p) out.push(...line);
  }
  return out;
}
export function rvMoves(b, p) { const m = []; for (let i = 0; i < 64; i++) { const f = rvFlips(b, i, p); if (f.length) m.push({ i, f }); } return m; }
export function rvApply(b, mv, p) { const nb = b.slice(); nb[mv.i] = p; for (const j of mv.f) nb[j] = p; return nb; }

/* ================= 체커 (미국식: 잡기 의무 · 연속 잡기 · 끝 줄 도착 시 킹, 그 차례 끝) ================= */
// 칸 값: 0 빈칸, ±1 말, ±2 킹 (양수 = 아래쪽(먼저 두는) 편)
export const CK_MAN = 1, CK_KING = 2;
const ckDirs = (v) => (Math.abs(v) === CK_KING ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : v > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const ckIn = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export function ckStart() { const b = Array(64).fill(0); for (let i = 0; i < 64; i++) { const r = i >> 3, c = i & 7; if ((r + c) & 1) { if (r <= 2) b[i] = -CK_MAN; else if (r >= 5) b[i] = CK_MAN; } } return b; }
/** side(1 아래 · -1 위)의 모든 수. 잡을 수 있으면 잡는 수만. 수 = { path:[칸...], caps:[잡은 칸...], crown } */
export function ckMoves(b, side) {
  const caps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (!v || Math.sign(v) !== side) continue;
    const r = i >> 3, c = i & 7;
    const dfs = (pos, v0, path, taken) => {
      const pr = pos >> 3, pc = pos & 7;
      let more = false;
      for (const [dr, dc] of ckDirs(v0)) {
        const mr = pr + dr, mc = pc + dc, tr = pr + 2 * dr, tc = pc + 2 * dc;
        if (!ckIn(tr, tc)) continue;
        const mid = mr * 8 + mc, to = tr * 8 + tc;
        if (!b[mid] || Math.sign(b[mid]) !== -side || taken.includes(mid) || (b[to] && to !== i)) continue;
        more = true;
        const crown = Math.abs(v0) === CK_MAN && tr === (side === 1 ? 0 : 7);
        if (crown) caps.push({ path: [...path, to], caps: [...taken, mid], crown: true });
        else dfs(to, v0, [...path, to], [...taken, mid]);
      }
      if (!more && taken.length) caps.push({ path, caps: taken, crown: false });
    };
    dfs(i, v, [i], []);
    for (const [dr, dc] of ckDirs(v)) {
      const tr = r + dr, tc = c + dc;
      if (ckIn(tr, tc) && !b[tr * 8 + tc]) steps.push({ path: [i, tr * 8 + tc], caps: [], crown: Math.abs(v) === CK_MAN && tr === (side === 1 ? 0 : 7) });
    }
  }
  return caps.length ? caps : steps;
}
export function ckApply(b, m) {
  const nb = b.slice(), from = m.path[0], to = m.path[m.path.length - 1], v = nb[from];
  nb[from] = 0; for (const x of m.caps) nb[x] = 0;
  nb[to] = m.crown ? Math.sign(v) * CK_KING : v;
  return nb;
}

/* ================= 백개먼 ================= */
// 1(하양): 24→1 방향으로 가서 오른쪽 아래 홈(0~5)에 모은다. -1(검정): 반대 방향, 홈 18~23.
const own = (v, side) => Math.sign(v) === side;
export function bgStart() {
  const p = Array(24).fill(0);
  p[23] = 2; p[12] = 5; p[7] = 3; p[5] = 5;
  p[0] = -2; p[11] = -5; p[16] = -3; p[18] = -5;
  return { p, bar: { 1: 0, '-1': 0 }, off: { 1: 0, '-1': 0 } };
}
export const bgClone = (b) => ({ p: b.p.slice(), bar: { ...b.bar }, off: { ...b.off } });
export const bgKey = (b) => b.p.join(',') + '|' + b.bar[1] + ',' + b.bar[-1] + '|' + b.off[1] + ',' + b.off[-1];
export function bgHomeAll(b, side) {
  if (b.bar[side]) return false;
  for (let i = 0; i < 24; i++) if (own(b.p[i], side) && !(side === 1 ? i <= 5 : i >= 18)) return false;
  return true;
}
/** 주사위 하나(d)로 할 수 있는 이동 */
export function bgSingles(b, side, d) {
  const out = [], open = (t) => !(Math.sign(b.p[t]) === -side && Math.abs(b.p[t]) >= 2);
  if (b.bar[side]) { const t = side === 1 ? 24 - d : d - 1; if (open(t)) out.push({ from: 'bar', to: t, d }); return out; }
  const home = bgHomeAll(b, side);
  for (let i = 0; i < 24; i++) {
    if (!own(b.p[i], side)) continue;
    const t = side === 1 ? i - d : i + d;
    if (t >= 0 && t < 24) { if (open(t)) out.push({ from: i, to: t, d }); continue; }
    if (!home) continue;
    if (t === -1 || t === 24) { out.push({ from: i, to: 'off', d }); continue; }
    // 남은 눈이 더 크면: 이 말보다 먼(홈 바깥 쪽) 말이 없을 때만 빼낼 수 있다
    let further = false;
    if (side === 1) { for (let j = i + 1; j <= 5; j++) if (own(b.p[j], side)) further = true; }
    else { for (let j = i - 1; j >= 18; j--) if (own(b.p[j], side)) further = true; }
    if (!further) out.push({ from: i, to: 'off', d });
  }
  return out;
}
export function bgApply(b, m, side) {
  const nb = bgClone(b);
  let hit = false;
  if (m.from === 'bar') nb.bar[side]--; else nb.p[m.from] -= side;
  if (m.to === 'off') nb.off[side]++;
  else {
    if (Math.sign(nb.p[m.to]) === -side && Math.abs(nb.p[m.to]) === 1) { nb.p[m.to] = 0; nb.bar[-side]++; hit = true; }
    nb.p[m.to] += side;
  }
  return { b: nb, hit };
}
function bgMaxUse(b, side, dice, memo) {
  if (!dice.length) return 0;
  const k = bgKey(b) + '#' + dice.join('');
  if (memo.has(k)) return memo.get(k);
  let best = 0;
  const tried = new Set();
  for (let i = 0; i < dice.length && best < dice.length; i++) {
    if (tried.has(dice[i])) continue; tried.add(dice[i]);
    const rest = dice.slice(0, i).concat(dice.slice(i + 1));
    for (const m of bgSingles(b, side, dice[i])) { best = Math.max(best, 1 + bgMaxUse(bgApply(b, m, side).b, side, rest, memo)); if (best === dice.length) break; }
  }
  memo.set(k, best);
  return best;
}
/** 지금 둘 수 있는 한 수 (쓸 수 있는 주사위를 최대한 쓰는 길 위의 수만, 하나만 쓸 수 있으면 큰 눈) */
export function bgLegal(b, side, dice, first) {
  const memo = new Map(), need = bgMaxUse(b, side, dice, memo);
  if (!need) return [];
  const out = [], tried = new Set();
  for (let i = 0; i < dice.length; i++) {
    if (tried.has(dice[i])) continue; tried.add(dice[i]);
    const rest = dice.slice(0, i).concat(dice.slice(i + 1));
    for (const m of bgSingles(b, side, dice[i])) if (1 + bgMaxUse(bgApply(b, m, side).b, side, rest, memo) === need) out.push(m);
  }
  if (first && need === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(...dice), withBig = out.filter((m) => m.d === big);
    if (withBig.length) return withBig;
  }
  return out;
}
export const bgDiceLeft = (d) => (d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : d.slice());
/** 이긴 쪽의 승리 종류: 1 일반 · 2 개먼 · 3 백개먼 */
export function bgWinKind(b, side) {
  const opp = -side;
  if (b.off[opp]) return 1;
  if (b.bar[opp]) return 3;
  for (let i = 0; i < 24; i++) if (own(b.p[i], opp) && (side === 1 ? i <= 5 : i >= 18)) return 3;
  return 2;
}

/* ================= 온라인 1:1 어댑터 =================
 * init(opt) → 상태(JSON으로 보낼 수 있는 값) · 좌석 0이 먼저
 * play(s, seat, m, rnd) → true면 둔 것 (상태를 바꾼다). s.over = { winner: 0|1|null(무승부), why } 이면 끝
 * time: 한 수 제한 시간(초)
 */
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const int = (m) => (Number.isInteger(m) ? m : NaN); // 수는 정수만 받는다 (null · 문자열 거절)
const repeat = (s, key) => { s.keys ||= {}; s.keys[key] = (s.keys[key] || 0) + 1; return s.keys[key]; };
export const TURN = {
  tictactoe: {
    time: 30,
    init: () => ({ q: [[], []], turn: 0, moves: 0, last: -1 }),
    play(s, seat, m) {
      const i = int(m);
      if (!(i >= 0 && i < 9) || s.q[0].includes(i) || s.q[1].includes(i)) return false;
      s.q[seat] = tttPlaced(s.q[seat], i); s.moves++; s.last = i;
      if (tttLine(s.q[seat])) s.over = { winner: seat, why: 'line' };
      else if (s.moves >= TTT_CAP) s.over = { winner: null, why: 'moves' };
      else s.turn = 1 - seat;
      return true;
    },
  },
  gomoku: {
    time: 40,
    /** opt.rule: 'renju'(렌주룰) | 'swap'(3수 교환 · 5수 2타) · opt.first: 'ai'면 좌석 1이 먼저(AI 대결에서 사람이 백 · 또는 AI가 개시) */
    init: (opt = {}) => {
      const rule = opt.rule === 'swap' ? 'swap' : 'renju', first = opt.first === 'ai' ? 1 : 0;
      // moves: 할 일의 수 (돌 · 색 바꾸기 · 5수 제시를 모두 센다 — 온라인 수 번호) · stones: 판의 돌 수
      return { b: Array(GM_N * GM_N).fill(0), rule, black: first, turn: first, phase: rule === 'swap' ? 'open' : 'play', moves: 0, stones: 0, last: -1, five: null };
    },
    play(s, seat, m) {
      if (s.over || seat !== s.turn) return false;
      const put = (i, v) => { s.b[i] = v; s.stones++; s.last = i; };
      switch (s.phase) {
        case 'open': { // 임시 흑이 흑 · 백 · 흑 3수
          const i = int(m);
          if (!gmOpenOk(s.b, s.stones, i)) return false;
          put(i, s.stones === 1 ? 2 : 1);
          if (s.stones === 3) { s.phase = 'swap'; s.turn = 1 - s.black; }
          break;
        }
        case 'swap': // 상대가 색을 고른다: 'swap'이면 고른 사람이 흑
          if (m !== 'swap' && m !== 'keep') return false;
          if (m === 'swap') s.black = 1 - s.black;
          s.swapped = m === 'swap'; s.phase = 'four'; s.turn = 1 - s.black;
          break;
        case 'four': { // 백 4수: 아무 데나
          const i = int(m);
          if (!(i >= 0 && i < GM_N * GM_N) || s.b[i]) return false;
          put(i, 2); s.phase = 'five'; s.turn = s.black;
          break;
        }
        case 'five': { // 흑이 5수 자리 두 곳을 내놓는다
          if (!Array.isArray(m) || m.length !== 2) return false;
          const [a, c] = m.map(int);
          if (!(a >= 0 && a < GM_N * GM_N && c >= 0 && c < GM_N * GM_N) || a === c || s.b[a] || s.b[c] || gmSymEq(s.b, a, c)) return false;
          s.five = [a, c]; s.phase = 'pick'; s.turn = 1 - s.black;
          break;
        }
        case 'pick': { // 백이 그중 하나를 고른다 → 그 자리에 흑 5수 · 백이 6수
          const i = int(m);
          if (!s.five?.includes(i)) return false;
          put(i, 1); s.five = null; s.phase = 'play'; s.turn = 1 - s.black;
          break;
        }
        default: { // 대국: 렌주룰
          const i = int(m), v = gmColor(s, seat);
          if (!(i >= 0 && i < GM_N * GM_N) || s.b[i]) return false;
          if (v === 1 && gmForbidden(s.b, i)) return false; // 흑 금수
          put(i, v);
          const w = fiveAt(s.b, i % GM_N, Math.floor(i / GM_N), v);
          if (w) s.over = { winner: seat, why: 'five', cells: w };
          else if (s.stones >= GM_N * GM_N) s.over = { winner: null, why: 'full' };
          else s.turn = 1 - seat;
        }
      }
      s.moves++;
      return true;
    },
  },
  connect4: {
    time: 30,
    init: () => ({ b: Array(C4_C * C4_R).fill(0), turn: 0, moves: 0, last: -1 }),
    play(s, seat, m) {
      const c = int(m);
      if (!(c >= 0 && c < C4_C)) return false;
      const r = c4Drop(s.b, c);
      if (r < 0) return false;
      s.b[r * C4_C + c] = seat + 1; s.moves++; s.last = r * C4_C + c;
      if (c4WinsAt(s.b, r, c, seat + 1)) s.over = { winner: seat, why: 'four', cells: c4WinLine(s.b, seat + 1) };
      else if (!s.b.includes(0)) s.over = { winner: null, why: 'full' };
      else s.turn = 1 - seat;
      return true;
    },
  },
  reversi: {
    time: 40,
    init: () => ({ b: rvStart(), turn: 0, moves: 0, last: -1, pass: -1 }),
    play(s, seat, m) {
      const p = seat + 1, i = int(m), f = i >= 0 && i < 64 ? rvFlips(s.b, i, p) : [];
      if (!(i >= 0 && i < 64) || !f.length) return false;
      s.b = rvApply(s.b, { i, f }, p); s.moves++; s.last = i; s.pass = -1;
      const o = 3 - p;
      if (rvMoves(s.b, o).length) s.turn = 1 - seat;
      else if (rvMoves(s.b, p).length) { s.turn = seat; s.pass = 1 - seat; } // 상대가 둘 곳이 없으면 차례를 넘긴다
      else {
        const a = s.b.filter((v) => v === 1).length, b = s.b.filter((v) => v === 2).length;
        s.over = { winner: a > b ? 0 : b > a ? 1 : null, why: 'count', count: [a, b] };
      }
      return true;
    },
  },
  checkers: {
    time: 40,
    init: () => ({ b: ckStart(), turn: 0, moves: 0, quiet: 0, last: null }),
    play(s, seat, m) {
      const side = seat === 0 ? 1 : -1;
      const mv = Array.isArray(m?.path) && ckMoves(s.b, side).find((x) => same(x.path, m.path));
      if (!mv) return false;
      const man = Math.abs(s.b[mv.path[0]]) === CK_MAN;
      s.b = ckApply(s.b, mv); s.moves++; s.last = mv;
      s.quiet = mv.caps.length || man ? 0 : s.quiet + 1;
      s.turn = 1 - seat;
      if (!ckMoves(s.b, -side).length) s.over = { winner: seat, why: 'nomove' };
      else if (repeat(s, s.b.join('') + s.turn) >= 3) s.over = { winner: null, why: 'repeat' };
      else if (s.quiet >= 80) s.over = { winner: null, why: 'quiet' };
      return true;
    },
  },
  chess: {
    time: 90,
    init: () => { const s = { st: CH.initial(), turn: 0, moves: 0, last: null }; repeat(s, CH.posKey(s.st)); return s; },
    play(s, seat, m) {
      if ((s.st.turn === 1 ? 0 : 1) !== seat || !m) return false;
      const mv = CH.moves(s.st).find((x) => x.from === m.from && x.to === m.to && (x.promo || 0) === (m.promo || 0));
      if (!mv) return false;
      CH.make(s.st, mv); s.moves++; s.last = mv; s.turn = 1 - seat;
      const next = CH.moves(s.st);
      if (!next.length) s.over = CH.inCheck(s.st) ? { winner: seat, why: 'mate' } : { winner: null, why: 'stalemate' };
      else if (CH.insufficient(s.st.b)) s.over = { winner: null, why: 'material' };
      else if (repeat(s, CH.posKey(s.st)) >= 3) s.over = { winner: null, why: 'repeat' };
      else if (s.st.half >= 100) s.over = { winner: null, why: 'fifty' };
      return true;
    },
  },
  backgammon: {
    time: 60,
    // 첫 차례: 둘이 한 개씩 굴려서 큰 쪽이 그 두 눈으로 시작
    init: (opt, rnd = Math.random) => {
      const roll = () => 1 + Math.floor(rnd() * 6);
      let a, b; do { a = roll(); b = roll(); } while (a === b);
      const turn = a > b ? 0 : 1;
      return { b: bgStart(), turn, dice: [a, b], left: [a, b], opening: [a, b], moves: 0, last: null };
    },
    play(s, seat, m, rnd = Math.random) {
      const side = seat === 0 ? 1 : -1;
      if (!Array.isArray(m?.seq)) return false;
      let b = s.b, left = s.left.slice(), first = true;
      const done = [];
      for (const st of m.seq) {
        const ok = bgLegal(b, side, left, first).find((x) => x.from === st.from && x.to === st.to && x.d === st.d);
        if (!ok) return false;
        const r = bgApply(b, ok, side); b = r.b; done.push({ ...ok, hit: r.hit });
        left.splice(left.indexOf(ok.d), 1); first = false;
        if (b.off[side] === 15) break;
      }
      if (b.off[side] < 15 && left.length && bgLegal(b, side, left, first).length) return false; // 쓸 수 있는 주사위를 다 써야 한다
      s.b = b; s.moves++; s.last = { seat, seq: done };
      if (b.off[side] === 15) { s.over = { winner: seat, why: 'off', kind: bgWinKind(b, side) }; return true; }
      // 다음 차례: 주사위를 굴린다. 움직일 수 없으면 차례를 넘긴다 (계속 막히는 드문 경우를 위해 넉넉히 · 그래도 막히면 앱이 빈 이동을 보낸다)
      const roll = () => 1 + Math.floor(rnd() * 6);
      let next = 1 - seat;
      s.skipped = [];
      for (let k = 0; k < 40; k++) {
        const d = [roll(), roll()], nside = next === 0 ? 1 : -1;
        s.dice = d; s.left = bgDiceLeft(d); s.turn = next;
        if (bgLegal(s.b, nside, s.left, true).length) break;
        s.skipped.push({ seat: next, dice: d });
        next = 1 - next;
      }
      return true;
    },
  },
  go: {
    time: 60,
    init: (opt) => { const n = [9, 13, 19].includes(opt?.size) ? opt.size : 19; const g = GO.create(n); g.b = Array.from(g.b); return { g, turn: 0, moves: 0, last: -1 }; },
    play(s, seat, m) {
      const g = s.g;
      if (g.turn !== seat + 1) return false;
      const i = m === -1 || m === 'pass' ? -1 : int(m);
      if (i !== -1 && !(i >= 0 && i < g.n * g.n)) return false;
      if (GO.play(g, i) < 0) return false;
      g.b = Array.from(g.b); if (g.prev) g.prev = Array.from(g.prev);
      s.moves++; s.last = i; s.turn = g.turn - 1;
      if (g.passes >= 2) { // 두 번 연속 통과: 죽은 돌을 판정하고 계가
        if (s.defer) s.counting = true; // 서버: 계가를 다른 스레드에서 한 뒤 finish
        else TURN.go.finish(s, [...GO.guessDead(g, 400)]);
      }
      return true;
    },
    finish(s, dead) {
      const sc = GO.score(s.g, new Set(dead));
      s.counting = false;
      s.over = { winner: sc.winner - 1, why: 'count', score: { black: sc.black, white: sc.white }, dead };
    },
  },
};

// 차례가 아닌 사람의 수, 끝난 판의 수는 모두 거절
for (const A of Object.values(TURN)) {
  const play = A.play;
  A.play = (s, seat, m, rnd) => (!s.over && !s.counting && s.turn === seat ? play(s, seat, m, rnd) : false);
}

/* ================= 윷놀이 (앱의 AI 대결 · 서버의 온라인 여럿이 대결이 같은 규칙) =================
 * 상태 s: { n 인원, P 사람마다 말 수, pc[자리][말] = { at, tr }, turn, pend 던져 둔 결과, bonus 더 던질 횟수, caught, moves, over, last }
 *   at: -1 집 · 1~29 칸 · YUT_OUT 남 / tr: 지나온 칸 (빽도로 되돌아갈 곳 · 집에서 나온 말은 참먹이 20에서 시작)
 * 차례: 던지기(bonus만큼, 윷 · 모면 한 번 더) → 모은 결과로 말 움직이기 (잡으면 한 번 더 던지기) → 다음 사람
 * 말판: 바깥 1~20 (5 모 · 10 뒷모 · 15 뒷밭 모서리 · 20 참먹이) + 대각선 21~25 (모 → 가운데 23 → 뒷밭) · 26 27 23 28 29 (뒷모 → 가운데 → 참먹이)
 */
export const YUT_OUT = 99;
const Y_OUTER = [...Array(21).keys(), YUT_OUT];
const Y_RA = [5, 21, 22, 23, 24, 25, 15, 16, 17, 18, 19, 20, YUT_OUT]; // 모에 멈춘 말: 가운데를 지나 뒷밭으로
const Y_RB = [10, 26, 27, 23, 28, 29, 20, YUT_OUT]; // 뒷모에 멈춘 말: 가운데를 지나 참먹이로
const Y_RC = [23, 28, 29, 20, YUT_OUT]; // 가운데(방)에 멈춘 말: 참먹이로 지름길
const yRoute = (st) => ([5, 21, 22, 24, 25].includes(st) ? Y_RA : [10, 26, 27, 28, 29].includes(st) ? Y_RB : st === 23 ? Y_RC : Y_OUTER);
/** st(집이면 -1)에서 n칸 앞으로 가며 지나는 칸들 (마지막이 도착 · 나면 YUT_OUT) */
export function yutSteps(st, n) {
  const r = yRoute(st), i = st < 0 ? 0 : r.indexOf(st), out = [];
  for (let k = 1; k <= n; k++) { const nx = r[Math.min(i + k, r.length - 1)]; out.push(nx); if (nx === YUT_OUT) break; }
  return out;
}
/** 남은 칸 수 (그 칸에서 새로 출발할 때 · 집 21 · 남 0) */
export const yutRem = (st) => (st === YUT_OUT ? 0 : st < 0 ? 21 : yRoute(st).length - 1 - yRoute(st).indexOf(st));
export const YUT_NAMES = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
/** 윷 던지기: 가락마다 배(평평한 면)가 나올 확률 1/2 · 네 가락 중 하나에 빽도 표시 → 도 3 · 개 6 · 걸 4 · 윷 1 · 모 1 · 빽도 1 (16분의) */
export function yutThrow(rnd = Math.random) {
  const flat = [0, 1, 2, 3].map(() => rnd() < 0.5), n = flat.filter(Boolean).length;
  if (n === 0) return 5;
  if (n === 1 && flat[0]) return -1;
  return n;
}
/** 새 판: n명 (말은 2인 4개 · 3~4인 3개) · 좌석 0부터 */
export function yutNew(n) {
  const P = n === 2 ? 4 : 3;
  return { n, P, pc: Array.from({ length: n }, () => Array.from({ length: P }, () => ({ at: -1, tr: [] }))), turn: 0, pend: [], bonus: 1, caught: Array(n).fill(0), moves: 0, over: null, last: null };
}
/** 결과 r로 자리 p가 움직일 수 있는 것: 판 위 묶음(같은 칸 = 업힌 말) + (앞으로 가는 결과면) 집의 말 하나 → [{ from, pieces, path, dest }] */
export function yutOptions(s, p, r) {
  const pl = s.pc[p], at = new Map(), out = [];
  pl.forEach((pc, i) => { if (pc.at >= 0 && pc.at !== YUT_OUT) { if (!at.has(pc.at)) at.set(pc.at, []); at.get(pc.at).push(i); } });
  for (const [from, pieces] of at) {
    if (r < 0) { const tr = pl[pieces[0]].tr; if (tr.length < 2) continue; const dest = tr[tr.length - 2]; out.push({ from, pieces, path: [dest], dest }); }
    else { const path = yutSteps(from, r); out.push({ from, pieces, path, dest: path[path.length - 1] }); }
  }
  if (r > 0) { const h = pl.findIndex((pc) => pc.at === -1); if (h >= 0) { const path = yutSteps(-1, r); out.push({ from: -1, pieces: [h], path, dest: path[path.length - 1] }); } }
  return out;
}
// 더 던질 것이 없으면: 쓸 수 없는 결과(움직일 말이 없는 빽도 등)는 버리고, 남은 결과가 없으면 다음 사람
function yutSettle(s) {
  if (s.over || s.bonus > 0) return;
  const before = s.pend.length;
  s.pend = s.pend.filter((r) => yutOptions(s, s.turn, r).length);
  s.dropped = before - s.pend.length;
  if (!s.pend.length) { s.turn = (s.turn + 1) % s.n; s.bonus = 1; }
}
/** 지금 차례인 사람이 윷을 던진다 → 결과 (던질 차례가 아니면 null) */
export function yutThrowIn(s, rnd = Math.random) {
  if (s.over || s.bonus <= 0) return null;
  const r = yutThrow(rnd), seat = s.turn;
  s.bonus--; s.pend.push(r);
  if (r >= 4) s.bonus++;
  s.last = { seat, a: 'throw', r };
  yutSettle(s);
  return r;
}
/** 지금 차례인 사람이 pend[ri] 결과로 from(집 -1 · 칸)의 말을 움직인다 → { r, from, pieces, path, dest, got } (안 되면 null) */
export function yutMoveIn(s, ri, from) {
  if (s.over || s.bonus > 0 || !Number.isInteger(ri) || !Number.isInteger(from)) return null;
  const r = s.pend[ri], seat = s.turn;
  if (r == null) return null;
  const opt = yutOptions(s, seat, r).find((o) => o.from === from);
  if (!opt) return null;
  const pl = s.pc[seat], dest = opt.dest;
  s.pend.splice(ri, 1); s.moves++;
  const tr0 = from < 0 ? [20] : pl[opt.pieces[0]].tr.slice();
  const tr = r < 0 ? tr0.slice(0, -1) : tr0.concat(opt.path.filter((x) => x !== YUT_OUT));
  for (const i of opt.pieces) pl[i] = { at: dest, tr: dest === YUT_OUT ? [] : tr.slice() };
  let got = 0;
  if (dest === YUT_OUT) { if (pl.every((pc) => pc.at === YUT_OUT)) s.over = { winner: seat, why: 'home' }; }
  else s.pc.forEach((q, qi) => { if (qi !== seat) q.forEach((pc, k) => { if (pc.at === dest) { q[k] = { at: -1, tr: [] }; got++; } }); });
  if (got) { s.caught[seat] += got; s.bonus++; }
  s.last = { seat, a: 'move', r, from, pieces: opt.pieces, path: opt.path, dest, got };
  yutSettle(s);
  return { r, from, pieces: opt.pieces, path: opt.path, dest, got };
}
