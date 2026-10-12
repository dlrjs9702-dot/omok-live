// 다리 잇기(하시워카케로) 규칙 · 문제 만들기 · 사람처럼 푸는 풀이기 · 힌트 (화면과 무관한 순수 로직)
// 규칙: 섬의 숫자만큼 다리를 잇는다. 다리는 가로 · 세로로만, 다른 다리나 섬을 가로지를 수 없고, 두 섬 사이에는 두 개까지.
//       모든 섬이 하나로 이어져야 한다.
// 문제는 아래 풀이 규칙(1: 숫자와 남은 자리 · 2: 고립 막기 · 3: 놓아 보면 모순)만으로 끝까지 풀리는 것만 낸다 → 정답이 하나뿐.
import { rng, randInt, shuffled } from './pz-util.js';
import { BANK } from './pz-bank.js';

export const LEVELS = {
  easy: { w: 7, h: 7, islands: 9, rule: 1 },
  normal: { w: 9, h: 9, islands: 15, rule: 2 },
  hard: { w: 10, h: 12, islands: 24, rule: 3 },
};
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** 섬 목록 → 이웃(가로 · 세로로 가장 가까운 섬)끼리의 다리 자리와 서로 가로지르는 자리 */
export function edgesOf(w, h, islands) {
  const at = new Map(islands.map((p, i) => [p.y * w + p.x, i]));
  const edges = [];
  islands.forEach((p, a) => {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const path = [];
      for (let x = p.x + dx, y = p.y + dy; x < w && y < h; x += dx, y += dy) {
        const b = at.get(y * w + x);
        if (b != null) { if (path.length) edges.push({ a, b, h: dy === 0, path }); break; }
        path.push(y * w + x);
      }
    }
  });
  const cross = edges.map(() => []);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    if (edges[i].h === edges[j].h) continue;
    if (edges[i].path.some((c) => edges[j].path.includes(c))) { cross[i].push(j); cross[j].push(i); }
  }
  const inc = islands.map(() => []);
  edges.forEach((e, k) => { inc[e.a].push(k); inc[e.b].push(k); });
  return { edges, cross, inc };
}

/* ---------------- 풀이 (다리 수의 범위 lo~hi를 좁혀 간다) ---------------- */
function components(n, edges, val) {
  const par = [...Array(n).keys()], f = (x) => (par[x] === x ? x : (par[x] = f(par[x])));
  edges.forEach((e, k) => { if (val[k] > 0) par[f(e.a)] = f(e.b); });
  return [...Array(n).keys()].map(f);
}
/** 규칙 하나를 적용할 곳을 찾는다 → { rule, kind, k(다리 자리), lo/hi 새 값, island, ... } 또는 null */
function findStep(P, S, maxRule) {
  const { islands, edges, cross, inc } = P, { lo, hi } = S, n = islands.length;
  // 규칙 1 — 가로지르는 다리
  for (let k = 0; k < edges.length; k++) if (lo[k] > 0) for (const j of cross[k]) if (hi[j] > 0) return { rule: 1, kind: 'cross', k: j, by: k, hi: 0 };
  // 규칙 1 — 섬의 숫자와 남은 자리
  for (let i = 0; i < n; i++) {
    const need = islands[i].n, sLo = inc[i].reduce((a, k) => a + lo[k], 0), sHi = inc[i].reduce((a, k) => a + hi[k], 0);
    for (const k of inc[i]) {
      const minK = need - (sHi - hi[k]);
      if (minK > lo[k]) return { rule: 1, kind: 'atLeast', k, island: i, lo: minK, others: sHi - hi[k] };
      const maxK = need - (sLo - lo[k]);
      if (maxK < hi[k]) return { rule: 1, kind: 'full', k, island: i, hi: Math.max(lo[k], maxK), used: sLo - lo[k] };
    }
  }
  if (maxRule < 2) return null;
  // 규칙 2 — 고립 막기: 이으면 다른 섬과 이어질 수 없는 무리가 생기는 다리 / 무리에서 나갈 길이 하나뿐인 다리
  const done = (i, vals) => inc[i].reduce((a, k) => a + vals[k], 0) === islands[i].n;
  for (let k = 0; k < edges.length; k++) {
    if (hi[k] <= lo[k]) continue;
    for (let v = lo[k] + 1; v <= hi[k]; v++) {
      const t = lo.slice(); t[k] = v;
      const comp = components(n, edges, t), root = comp[edges[k].a];
      const mem = [...Array(n).keys()].filter((i) => comp[i] === root);
      if (mem.length < n && mem.every((i) => done(i, t))) return { rule: 2, kind: 'isolate', k, hi: v - 1, group: mem, v };
    }
  }
  {
    const comp = components(n, edges, lo), roots = [...new Set(comp)];
    if (roots.length > 1) for (const r of roots) {
      const mem = [...Array(n).keys()].filter((i) => comp[i] === r);
      const out = edges.map((e, k) => k).filter((k) => hi[k] > 0 && (comp[edges[k].a] === r) !== (comp[edges[k].b] === r));
      if (out.length === 1 && lo[out[0]] === 0) return { rule: 2, kind: 'onlyExit', k: out[0], lo: 1, group: mem };
    }
  }
  if (maxRule < 3) return null;
  // 규칙 3 — 놓아 보면(또는 빼 보면) 규칙 1 · 2만으로 모순이 생기는 자리
  for (let k = 0; k < edges.length; k++) {
    if (hi[k] <= lo[k]) continue;
    for (const [tryLo, tryHi, res] of [[lo[k] + 1, hi[k], { hi: lo[k] }], [lo[k], hi[k] - 1, { lo: hi[k] }]]) {
      const T = { lo: lo.slice(), hi: hi.slice() };
      T.lo[k] = tryLo; T.hi[k] = tryHi;
      const r = propagate(P, T, 2);
      if (r.broken) return { rule: 3, kind: res.hi != null ? 'tryMore' : 'tryLess', k, ...res, why: r.why };
    }
  }
  return null;
}
function brokenWhy(P, S) {
  const { islands, edges, inc } = P, { lo, hi } = S, n = islands.length;
  for (let k = 0; k < edges.length; k++) if (lo[k] > hi[k]) return { kind: 'range', k };
  for (let i = 0; i < n; i++) {
    const sLo = inc[i].reduce((a, k) => a + lo[k], 0), sHi = inc[i].reduce((a, k) => a + hi[k], 0);
    if (sLo > islands[i].n) return { kind: 'over', island: i };
    if (sHi < islands[i].n) return { kind: 'under', island: i };
  }
  if (edges.every((e, k) => lo[k] === hi[k])) {
    const comp = components(n, edges, lo);
    if (new Set(comp).size > 1) return { kind: 'split' };
  }
  return null;
}
function applyStep(S, s) { if (s.lo != null) S.lo[s.k] = s.lo; if (s.hi != null) S.hi[s.k] = s.hi; }
/** 규칙(maxRule까지)을 더 이상 쓸 곳이 없을 때까지 → { broken, why, steps, rule } */
function propagate(P, S, maxRule, steps) {
  let rule = 1;
  for (let guard = 0; guard < 5000; guard++) {
    const why = brokenWhy(P, S);
    if (why) return { broken: true, why, rule };
    const s = findStep(P, S, maxRule);
    if (!s) return { broken: false, rule };
    rule = Math.max(rule, s.rule);
    if (steps) steps.push(s);
    applyStep(S, s);
  }
  return { broken: false, rule };
}
export function startState(P) {
  const lo = P.edges.map(() => 0), hi = P.edges.map((e) => Math.min(2, P.islands[e.a].n, P.islands[e.b].n));
  return { lo, hi };
}
/** 사람의 규칙으로 풀어 본다 → { solved, rule(쓴 가장 높은 규칙), bridges } */
export function solveLogic(P, maxRule = 3, keepSteps = false) {
  const S = startState(P), steps = keepSteps ? [] : null;
  const r = propagate(P, S, maxRule, steps);
  const solved = !r.broken && P.edges.every((e, k) => S.lo[k] === S.hi[k]) && !brokenWhy(P, S);
  return { solved, rule: r.rule, bridges: S.lo, steps };
}
/** 해의 개수 (limit에서 멈춤) — 큰 판 검사용: 규칙 1 · 2로 좁힌 뒤 남은 자리를 나눠 본다 (규칙 3은 쓰지 않음) */
export function countSolutionsFast(P, limit = 2) {
  let found = 0;
  const go = (S) => {
    if (found >= limit) return;
    const r = propagate(P, S, 2);
    if (r.broken) return;
    const k = P.edges.findIndex((e, k) => S.lo[k] < S.hi[k]);
    if (k < 0) { if (!brokenWhy(P, S)) found++; return; }
    for (let v = S.lo[k]; v <= S.hi[k]; v++) { const T = { lo: S.lo.slice(), hi: S.hi.slice() }; T.lo[k] = v; T.hi[k] = v; go(T); }
  };
  go(startState(P));
  return found;
}
/** 해의 개수 (limit에서 멈춤) — 문제 검사용 (규칙과 무관한 완전 탐색 · 작은 판) */
export function countSolutions(P, limit = 2) {
  const { islands, edges, cross, inc } = P, val = edges.map(() => -1);
  let found = 0;
  const ok = () => {
    for (let i = 0; i < islands.length; i++) {
      let s = 0, open = 0;
      for (const k of inc[i]) { if (val[k] < 0) open += 2; else s += val[k]; }
      if (s > islands[i].n || s + open < islands[i].n) return false;
    }
    return true;
  };
  const go = (k) => {
    if (found >= limit) return;
    if (k === edges.length) { if (new Set(components(islands.length, edges, val)).size === 1) found++; return; }
    for (let v = 0; v <= 2; v++) {
      if (v > 0 && cross[k].some((j) => val[j] > 0)) continue;
      val[k] = v;
      if (ok()) go(k + 1);
    }
    val[k] = -1;
  };
  go(0);
  return found;
}

/* ---------------- 문제 만들기 ---------------- */
/** 시드 → 문제 — 그 난이도의 규칙이 꼭 필요하고 그 규칙까지로 풀리는 문제. 정해진 횟수 안에 못 찾으면 미리 검증한 예비 문제(pz-bank.js) */
export function generate(seed, levelId, { attempts = 3000 } = {}) {
  const L = LEVELS[levelId] || LEVELS.normal, rnd = rng(seed);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { w, h } = L, cell = Array(w * h).fill(0); // 0 빈칸 · 1 섬 · 2 가로 다리 · 3 세로 다리
    const isl = [], br = new Map(); // 'a-b' → 다리 수
    const add = (x, y) => { cell[y * w + x] = 1; isl.push({ x, y }); return isl.length - 1; };
    add(randInt(rnd, w), randInt(rnd, h));
    const nearIsland = (x, y) => DIRS.some(([dx, dy]) => { const a = x + dx, b = y + dy; return a >= 0 && b >= 0 && a < w && b < h && cell[b * w + a] === 1; });
    for (let tries = 0; tries < 600 && isl.length < L.islands; tries++) {
      const from = randInt(rnd, isl.length), [dx, dy] = DIRS[randInt(rnd, 4)], len = 2 + randInt(rnd, Math.max(w, h) / 2 | 0);
      const p = isl[from], x = p.x + dx * len, y = p.y + dy * len;
      if (x < 0 || y < 0 || x >= w || y >= h || cell[y * w + x] || nearIsland(x, y)) continue;
      let clear = true;
      for (let s = 1; s < len; s++) if (cell[(p.y + dy * s) * w + p.x + dx * s]) { clear = false; break; }
      if (!clear) continue;
      const b = add(x, y);
      for (let s = 1; s < len; s++) cell[(p.y + dy * s) * w + p.x + dx * s] = dy === 0 ? 2 : 3;
      br.set(from < b ? `${from}-${b}` : `${b}-${from}`, rnd() < 0.4 ? 2 : 1);
    }
    if (isl.length < L.islands) continue;
    // 고리 만들기: 다리 없이 마주 보는 이웃 섬 몇 쌍을 더 잇는다 (가로지르지 않을 때만)
    const pre = edgesOf(w, h, isl);
    for (const k of shuffled(rnd, pre.edges.map((e, k) => k))) {
      const e = pre.edges[k], key = e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`;
      if (br.has(key) || rnd() < 0.55) continue;
      if (e.path.some((c) => cell[c] !== 0)) continue;
      for (const c of e.path) cell[c] = e.h ? 2 : 3;
      br.set(key, rnd() < 0.35 ? 2 : 1);
    }
    const islands = isl.map((p) => ({ ...p, n: 0 }));
    for (const [key, v] of br) { const [a, b] = key.split('-').map(Number); islands[a].n += v; islands[b].n += v; }
    const P = { w, h, islands, ...edgesOf(w, h, islands) };
    const r = solveLogic(P, L.rule);
    if (!r.solved) continue;
    const sol = P.edges.map((e) => br.get(e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`) || 0);
    if (r.rule === L.rule) return { ...P, solution: sol, rule: r.rule, attempt };
  }
  return fromBank(seed, levelId);
}
function fromBank(seed, levelId) {
  const id = LEVELS[levelId] ? levelId : 'normal', { w, h } = LEVELS[id], list = BANK.hashi[id], text = list[(seed >>> 0) % list.length];
  const islands = text.split(';').map((t) => { const [x, y, n] = t.split(',').map(Number); return { x, y, n }; });
  const P = { w, h, islands, ...edgesOf(w, h, islands) }, r = solveLogic(P, LEVELS[id].rule);
  return { ...P, solution: r.bridges, rule: r.rule, attempt: -1, bank: true };
}

/* ---------------- 힌트 ---------------- */
/** cur: 다리 자리마다 사용자가 놓은 다리 수. 정답보다 많거나 정답에 없는 다리를 먼저 알린다.
 *  그다음, 사용자의 다리를 최소값으로 두고 규칙을 적용해 '더 놓아야 하는 다리'가 처음 나오는 단계와 그 앞 단계들을 돌려준다 */
export function hint(P, cur, sol) {
  const wrong = P.edges.map((e, k) => k).filter((k) => cur[k] > sol[k]);
  if (wrong.length) return { kind: 'wrong', edges: wrong };
  const S = startState(P);
  P.edges.forEach((e, k) => { S.lo[k] = Math.max(S.lo[k], cur[k]); });
  const pre = [];
  for (let guard = 0; guard < 3000; guard++) {
    const s = findStep(P, S, 3);
    if (!s) break;
    applyStep(S, s);
    if (s.lo != null && s.lo > cur[s.k]) return { kind: 'step', step: s, pre, add: s.lo - cur[s.k] };
    pre.push(s);
  }
  const k = P.edges.findIndex((e, k) => cur[k] < sol[k]);
  return k < 0 ? null : { kind: 'reveal', step: { k, lo: sol[k] }, pre, add: sol[k] - cur[k] };
}
const name = (P, i) => `${P.islands[i].y + 1}행 ${P.islands[i].x + 1}열의 섬 ${P.islands[i].n}`;
// 숫자 읽는 소리의 받침에 맞춘 조사 (1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔은 받침 있음)
const HAS = { 1: 1, 3: 1, 6: 1, 7: 1, 8: 1 };
const nameJ = (P, i, yes, no) => name(P, i) + (HAS[P.islands[i].n] ? yes : no);
const pairName = (P, k) => `${nameJ(P, P.edges[k].a, '과', '와')} ${name(P, P.edges[k].b)} 사이`;
export function explainStep(P, s) {
  switch (s.kind) {
    case 'cross': return `${pairName(P, s.k)}에는 다리를 놓을 수 없어요. 이미 놓인 다른 다리가 그 길을 가로지르기 때문이에요.`;
    case 'atLeast': return `${nameJ(P, s.island, '은', '는')} 다리가 ${P.islands[s.island].n}개 필요한데, 다른 쪽으로는 많아야 ${s.others}개밖에 놓을 수 없어요. 그래서 ${pairName(P, s.k)}에 다리가 적어도 ${s.lo}개 있어야 해요.`;
    case 'full': return `${nameJ(P, s.island, '은', '는')} 이미 다른 다리로 ${s.used}개를 채웠어요. 그래서 ${pairName(P, s.k)}의 다리는 ${s.hi ? `${s.hi}개를 넘을 수 없어요` : '놓을 수 없어요'}.`;
    case 'isolate': return `${pairName(P, s.k)}에 다리를 ${s.v}개 놓으면, 섬 ${s.group.length}개가 숫자를 모두 채운 채 다른 섬과 떨어진 무리가 돼요. 모든 섬은 하나로 이어져야 하니 ${s.hi ? `${s.hi}개까지만` : '놓을 수 없어요'}${s.hi ? ' 놓을 수 있어요' : ''}.`;
    case 'onlyExit': return `섬 ${s.group.length}개가 이어진 무리에서 다른 섬으로 나갈 수 있는 길은 ${pairName(P, s.k)}뿐이에요. 여기를 잇지 않으면 이 무리가 고립되니 다리가 적어도 1개 있어야 해요.`;
    case 'tryMore': return `${pairName(P, s.k)}에 다리를 하나 더 놓는다고 해 보면, 그 뒤 ${whyText(P, s.why)} 그래서 여기는 지금보다 더 놓을 수 없어요.`;
    case 'tryLess': return `${pairName(P, s.k)}의 다리를 지금 최대보다 하나 적게 놓는다고 해 보면, 그 뒤 ${whyText(P, s.why)} 그래서 여기에는 다리가 ${s.lo}개 있어야 해요.`;
    default: return '';
  }
}
function whyText(P, w) {
  if (!w) return '모순이 생겨요.';
  if (w.kind === 'over') return `${name(P, w.island)}의 다리가 숫자보다 많아져요.`;
  if (w.kind === 'under') return `${name(P, w.island)}에 필요한 다리를 다 놓을 자리가 없어져요.`;
  if (w.kind === 'split') return '섬들이 하나로 이어지지 않아요.';
  return '모순이 생겨요.';
}
export function explain(P, h) {
  if (!h) return '';
  if (h.kind === 'wrong') return `빨갛게 표시한 다리 ${h.edges.length}곳은 정답보다 많이 놓였어요. 그 다리를 줄여 보세요.`;
  const lines = h.pre.slice(-2).map((s) => explainStep(P, s));
  if (h.pre.length > 2) lines.unshift(`(앞에서 확실한 것 ${h.pre.length - 2}가지를 먼저 정리하면)`);
  if (h.kind === 'reveal') lines.push(`${pairName(P, h.step.k)}에는 다리가 ${h.step.lo}개 놓여요.`);
  else lines.push(explainStep(P, h.step));
  return lines.join(' ');
}
