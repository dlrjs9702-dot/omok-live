// 바둑 규칙 · AI (화면과 무관한 순수 로직 — 게임 화면과 AI 워커가 함께 쓴다)
// 판: n×n 배열, 0 빈칸 · 1 흑 · 2 백. 흑이 먼저 둔다.
// · 돌을 놓아 상대 돌의 활로(숨 쉴 곳)를 모두 막으면 잡는다. 놓은 뒤 내 돌이 활로 없이 남는 수(자충수)는 둘 수 없다.
// · 패: 바로 직전 판 모양으로 되돌리는 수는 바로 둘 수 없다(한 수 다른 곳을 둔 뒤에는 가능).
// · 두 번 연속 통과하면 끝. 한국식 계가: 집 + 잡은 돌(사석 포함), 백은 덤 6.5집.
export const KOMI = 6.5;
export function create(n) { return { n, b: new Uint8Array(n * n), turn: 1, prev: null, caps: { 1: 0, 2: 0 }, passes: 0, moves: 0, last: -1 }; }
export const clone = (g) => ({ n: g.n, b: g.b.slice(), turn: g.turn, prev: g.prev ? g.prev.slice() : null, caps: { ...g.caps }, passes: g.passes, moves: g.moves, last: g.last });
export function neighbors(n, i) {
  const out = [], r = (i / n) | 0, c = i % n;
  if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
  return out;
}
/** i가 속한 무리와 활로 수 */
export function group(b, n, i) {
  const col = b[i], stones = [i], seen = new Set([i]), libs = new Set();
  for (let k = 0; k < stones.length; k++) for (const j of neighbors(n, stones[k])) {
    if (!b[j]) libs.add(j);
    else if (b[j] === col && !seen.has(j)) { seen.add(j); stones.push(j); }
  }
  return { stones, libs };
}
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
/** 둘 수 있는지 확인하고 두기. 성공하면 잡은 돌 수, 안 되면 -1 (g는 그대로) */
export function play(g, i) {
  const { n, b } = g, me = g.turn, op = 3 - me;
  if (i < 0) { g.prev = b.slice(); g.turn = op; g.passes++; g.moves++; g.last = -1; return 0; } // 통과
  if (b[i]) return -1;
  const before = b.slice();
  b[i] = me;
  let taken = 0;
  for (const j of neighbors(n, i)) if (b[j] === op) { const gr = group(b, n, j); if (!gr.libs.size) { for (const s of gr.stones) b[s] = 0; taken += gr.stones.length; } }
  if (!taken && !group(b, n, i).libs.size) { g.b = before; return -1; } // 자충수
  if (same(b, g.prev)) { g.b = before; return -1; } // 패
  g.prev = before; g.caps[me] += taken; g.turn = op; g.passes = 0; g.moves++; g.last = i;
  return taken;
}
export function legal(g, i) { const t = clone(g); return play(t, i) >= 0; }
/** i가 me의 '눈'(자기 돌로 둘러싸인 빈칸)인가 — 무작위 대국에서 내 눈을 메우지 않기 위해 */
function isEye(b, n, i, me) {
  for (const j of neighbors(n, i)) if (b[j] !== me) return false;
  const r = (i / n) | 0, c = i % n; let bad = 0, edge = 0;
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= n || cc < 0 || cc >= n) { edge = 1; continue; }
    if (b[rr * n + cc] === 3 - me) bad++;
  }
  return bad + edge < 2;
}

/* ---------------- 끝난 판 계산 ---------------- */
/** 무작위로 끝까지 둬 보고 각 점이 누구 것이 되는지 비율 (죽은 돌 판정용) */
export function ownership(g, runs = 200) {
  const n = g.n, own = new Float32Array(n * n);
  for (let k = 0; k < runs; k++) {
    const t = clone(g); playout(t, n * n * 2);
    const area = areaOf(t.b, n);
    for (let i = 0; i < n * n; i++) own[i] += area[i] === 1 ? 1 : area[i] === 2 ? -1 : 0;
  }
  for (let i = 0; i < n * n; i++) own[i] /= runs;
  return own; // +1 흑 땅 · -1 백 땅
}
/** 각 점의 주인: 돌이면 그 색, 빈칸이면 한 색에만 닿은 영역의 색 (둘 다 닿으면 0) */
export function areaOf(b, n) {
  const res = new Uint8Array(n * n), seen = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (b[i]) { res[i] = b[i]; continue; }
    if (seen[i]) continue;
    const pts = [i], touch = new Set(); seen[i] = 1;
    for (let k = 0; k < pts.length; k++) for (const j of neighbors(n, pts[k])) {
      if (b[j]) touch.add(b[j]); else if (!seen[j]) { seen[j] = 1; pts.push(j); }
    }
    const owner = touch.size === 1 ? [...touch][0] : 0;
    for (const p of pts) res[p] = owner;
  }
  return res;
}
/** 한국식 계가: dead = 죽은 돌 칸 집합 */
export function score(g, dead) {
  const n = g.n, b = g.b.slice(), caps = { ...g.caps };
  for (const i of dead) { if (b[i]) { caps[3 - b[i]]++; b[i] = 0; } }
  const area = areaOf(b, n), terr = { 1: 0, 2: 0 };
  for (let i = 0; i < n * n; i++) if (!b[i] && area[i]) terr[area[i]]++;
  const black = terr[1] + caps[1], white = terr[2] + caps[2] + KOMI;
  return { black, white, terr, caps, winner: black > white ? 1 : 2, diff: Math.abs(black - white) };
}
/** 죽은 돌 추정: 끝까지 둬 봤을 때 대부분 상대 땅이 되는 무리 */
export function guessDead(g, runs = 400) {
  const own = ownership(g, runs), n = g.n, dead = new Set(), seen = new Set();
  for (let i = 0; i < n * n; i++) {
    if (!g.b[i] || seen.has(i)) continue;
    const gr = group(g.b, n, i); gr.stones.forEach((s) => seen.add(s));
    const avg = gr.stones.reduce((a, s) => a + own[s], 0) / gr.stones.length;
    if ((g.b[i] === 1 && avg < -0.3) || (g.b[i] === 2 && avg > 0.3)) gr.stones.forEach((s) => dead.add(s));
  }
  return dead;
}

/* ---------------- AI: 몬테카를로 트리 탐색 ---------------- */
let rnd = Math.random;
// 플레이아웃은 수천 판을 두므로 메모리를 새로 잡지 않는 빠른 버전을 따로 쓴다
const NBC = {};
const nbOf = (n) => NBC[n] || (NBC[n] = Array.from({ length: n * n }, (_, i) => neighbors(n, i)));
const MK = new Int32Array(19 * 19), STK = new Int32Array(19 * 19);
let stamp = 0, LIB = -1;
/** i가 속한 무리의 활로 수 (0 · 1 · 2 이상은 2). 1이면 그 활로가 LIB */
function libs2(b, nb, i) {
  if (++stamp > 2e9) { MK.fill(0); stamp = 1; }
  const col = b[i];
  let sp = 0, cnt = 0;
  STK[sp++] = i; MK[i] = stamp;
  while (sp) {
    for (const q of nb[STK[--sp]]) {
      if (MK[q] === stamp) continue;
      MK[q] = stamp;
      if (!b[q]) { if (++cnt === 2) return 2; LIB = q; } else if (b[q] === col) STK[sp++] = q;
    }
  }
  return cnt;
}
function removeGroup(b, nb, i) {
  const col = b[i];
  let sp = 0, k = 0;
  STK[sp++] = i; b[i] = 0;
  while (sp) { k++; for (const q of nb[STK[--sp]]) if (b[q] === col) { b[q] = 0; STK[sp++] = q; } }
  return k;
}
const lonely = (b, nb, i) => { for (const q of nb[i]) if (b[q] === b[i]) return false; return true; };
function eyeFast(b, nb, n, i, me) {
  for (const q of nb[i]) if (b[q] !== me) return false;
  return isEye(b, n, i, me);
}
/** 플레이아웃 전용 착수: 판을 복사하지 않고, 패는 단순 패(한 점 되따내기)만 막는다 */
function fastPlay(t, nb, i) {
  const b = t.b, me = t.turn, op = 3 - me;
  if (i < 0) { t.turn = op; t.last = -1; t.ko = -1; return 0; }
  if (b[i] || i === t.ko) return -1;
  b[i] = me;
  let taken = 0, capAt = -1;
  for (const j of nb[i]) if (b[j] === op && libs2(b, nb, j) === 0) { taken += removeGroup(b, nb, j); capAt = j; }
  if (!taken) { if (!libs2(b, nb, i)) { b[i] = 0; return -1; } t.ko = -1; } // 자충수
  else t.ko = taken === 1 && lonely(b, nb, i) && libs2(b, nb, i) === 1 ? capAt : -1;
  t.caps[me] += taken; t.turn = op; t.last = i;
  return taken;
}
function playout(t, maxMoves) {
  const n = t.n, N = n * n, nb = nbOf(n), b = t.b;
  if (t.ko === undefined) t.ko = -1;
  let passes = 0;
  for (let m = 0; m < maxMoves && passes < 2; m++) {
    const me = t.turn;
    // 방금 둔 수 주변: 단수(활로 1개)에 몰린 상대 돌은 잡고, 내 돌은 달아난다
    if (t.last >= 0 && rnd() < 0.85) {
      let urgent = -1;
      for (let k = -1; k < nb[t.last].length; k++) {
        const j = k < 0 ? t.last : nb[t.last][k];
        if (!b[j] || libs2(b, nb, j) !== 1) continue;
        if (b[j] !== me) { urgent = LIB; break; }
        if (!lonely(b, nb, j) || rnd() < 0.5) urgent = LIB;
      }
      if (urgent >= 0 && fastPlay(t, nb, urgent) >= 0) { passes = 0; continue; }
    }
    // 빈칸을 몇 번 무작위로 찍어 보고, 안 되면 전체에서 고른다
    let moved = false;
    for (let k = 0; k < 20 && !moved; k++) {
      const i = (rnd() * N) | 0;
      if (!b[i] && !eyeFast(b, nb, n, i, me) && fastPlay(t, nb, i) >= 0) moved = true;
    }
    if (!moved) {
      const cand = [];
      for (let i = 0; i < N; i++) if (!b[i] && !eyeFast(b, nb, n, i, me)) cand.push(i);
      while (cand.length) {
        const k = (rnd() * cand.length) | 0, i = cand[k];
        cand[k] = cand[cand.length - 1]; cand.pop();
        if (fastPlay(t, nb, i) >= 0) { moved = true; break; }
      }
    }
    if (!moved) { fastPlay(t, nb, -1); passes++; } else passes = 0;
  }
}
function winnerOf(t) {
  const area = areaOf(t.b, t.n); let bl = 0, wh = KOMI;
  for (let i = 0; i < area.length; i++) { if (area[i] === 1) bl++; else if (area[i] === 2) wh++; }
  return bl > wh ? 1 : 2; // 끝까지 둔 판은 집 계산과 영역 계산이 같다
}
/**
 * 수 고르기
 * @param {{playouts:number, ms:number}} o
 * @returns {number} 칸 번호 (-1이면 통과)
 */
export function think(g0, o) {
  const n = g0.n, me = g0.turn, N = n * n;
  // 후보: 둘 수 있고, 내 눈을 메우지 않으며, 이미 내 땅이 확실한 곳은 뺀다
  const own = ownership(g0, 80);
  const sure = (i) => (me === 1 ? own[i] > 0.85 : own[i] < -0.85);
  // 끝내기 무렵 상대 땅이 확실한 곳에 뛰어드는 수도 뺀다 (둘 곳이 없으면 통과)
  const lost = (i) => g0.moves > N * 0.3 && (me === 1 ? own[i] < -0.9 : own[i] > 0.9);
  // 큰 판: 초반에는 화점·소목, 그 뒤로는 기존 돌 두 칸 안쪽만 후보 (탐색을 좁혀 더 깊게)
  const near = new Uint8Array(N);
  let stones = 0;
  for (let i = 0; i < N; i++) if (g0.b[i]) {
    stones++;
    const r = (i / n) | 0, c = i % n;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n) near[rr * n + cc] = 1; }
  }
  const star = new Set();
  if (n >= 13) { const a = n === 19 ? [3, 9, 15] : [3, 6, 9]; for (const r of a) for (const c of a) star.add(r * n + c); for (const [r, c] of [[2, 3], [3, 2], [2, n - 4], [3, n - 3], [n - 3, 3], [n - 4, 2], [n - 3, n - 4], [n - 4, n - 3]]) star.add(r * n + c); }
  const ok = (i) => n <= 9 || (stones < 6 ? star.has(i) || near[i] : near[i]);
  const cands = [];
  for (let i = 0; i < N; i++) if (!g0.b[i] && ok(i) && !isEye(g0.b, n, i, me) && !sure(i) && !lost(i) && legal(g0, i)) cands.push({ i, w: 0, v: 0 });
  if (!cands.length) for (let i = 0; i < N; i++) if (!g0.b[i] && !isEye(g0.b, n, i, me) && !sure(i) && !lost(i) && legal(g0, i)) cands.push({ i, w: 0, v: 0 });
  if (!cands.length) return -1;
  const deadline = performance.now() + o.ms;
  let total = 0;
  for (let k = 0; k < o.playouts && performance.now() < deadline; k++) {
    // UCB로 첫 수를 고른 뒤 끝까지 무작위로 둔다
    let best = null, bv = -Infinity;
    for (const c of cands) {
      const u = c.v ? c.w / c.v + 1.1 * Math.sqrt(Math.log(total + 1) / c.v) : 1e9 + rnd();
      if (u > bv) { bv = u; best = c; }
    }
    const t = clone(g0); play(t, best.i); playout(t, N * 2);
    best.v++; total++;
    if (winnerOf(t) === me) best.w++;
  }
  cands.sort((a, b) => b.v - a.v);
  const top = cands[0];
  // 이길 가망이 거의 없거나, 둘 곳이 모두 무의미하면 통과
  if (top.v && top.w / top.v < 0.05 && g0.moves > N * 0.6) return -1;
  return top.i;
}
