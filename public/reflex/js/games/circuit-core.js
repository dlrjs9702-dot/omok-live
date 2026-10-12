// 회로 연결(넷 퍼즐) 규칙 · 문제 만들기 · 사람처럼 푸는 풀이기 · 힌트 (화면과 무관한 순수 로직)
// 규칙: 칸을 돌려(90도씩) 모든 칸을 가운데 전원과 하나의 연결망으로 잇는다. 고리가 생기면 안 되고, 한 칸이라도 떨어지면 안 된다.
//       판 밖으로 나가는 선은 없다(가장자리는 막혀 있음).
// 문제는 아래 풀이 규칙만으로 끝까지 풀리는 것만 낸다 → 정답이 하나뿐이고, 힌트가 언제나 이유를 댈 수 있다.
import { rng, randInt, shuffled } from './pz-util.js';
import { BANK } from './pz-bank.js';

export const U = 1, R = 2, D = 4, L = 8;
export const SIDES = [U, R, D, L];
const DX = { [U]: 0, [R]: 1, [D]: 0, [L]: -1 }, DY = { [U]: -1, [R]: 0, [D]: 1, [L]: 0 };
const OPP = { [U]: D, [R]: L, [D]: U, [L]: R };
/** 시계 방향 90도 */
export const rot = (m) => ((m << 1) | (m >> 3)) & 15;
export const rotN = (m, n) => { for (let i = 0; i < ((n % 4) + 4) % 4; i++) m = rot(m); return m; };
const deg = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
/** 그 모양이 돌아서 될 수 있는 서로 다른 방향들 */
export const orients = (m) => [...new Set([0, 1, 2, 3].map((n) => rotN(m, n)))];
/** m을 시계 방향으로 몇 번 돌리면 t가 되는지 (안 되면 -1) */
export const turnsTo = (m, t) => { for (let n = 0; n < 4; n++) if (rotN(m, n) === t) return n; return -1; };

export const LEVELS = {
  easy: { w: 5, h: 5, rule: 2 },
  normal: { w: 7, h: 7, rule: 3 },
  hard: { w: 9, h: 9, rule: 4 },
};
export const hubOf = (w, h) => ((h / 2) | 0) * w + ((w / 2) | 0);
const nbr = (w, h, i, s) => { const x = (i % w) + DX[s], y = ((i / w) | 0) + DY[s]; return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x; };

/** 지금 방향들에서 전원과 이어진 칸들 (양쪽 선이 맞닿아야 이어짐) */
export function lit(w, h, masks) {
  const on = new Set([hubOf(w, h)]), st = [hubOf(w, h)];
  while (st.length) {
    const i = st.pop();
    for (const s of SIDES) if (masks[i] & s) { const j = nbr(w, h, i, s); if (j >= 0 && masks[j] & OPP[s] && !on.has(j)) { on.add(j); st.push(j); } }
  }
  return on;
}
export const isSolved = (w, h, masks) => lit(w, h, masks).size === w * h;

/* ---------------- 풀이: 칸 사이 선의 상태(모름 · 이어짐 · 끊김)를 정해 간다 ---------------- */
// 선 번호: 칸 i의 오른쪽 선 = 2i, 아래쪽 선 = 2i+1 (판 밖으로 나가는 선은 늘 끊김)
const edgeId = (w, h, i, s) => {
  const j = nbr(w, h, i, s);
  if (j < 0) return -1;
  return s === R ? 2 * i : s === D ? 2 * i + 1 : s === L ? 2 * j : 2 * j + 1;
};
export function startState(P) {
  const { w, h, masks } = P;
  return { cand: masks.map((m) => orients(m)), edge: new Int8Array(2 * w * h), why: {} }; // edge: 0 모름 · 1 이어짐 · -1 끊김
}
const cloneS = (S) => ({ cand: S.cand.map((c) => c.slice()), edge: S.edge.slice(), why: { ...S.why } });
function setEdge(S, e, v, why) { if (S.edge[e] === v) return false; if (S.edge[e] === -v) { S.bad = true; return false; } S.edge[e] = v; S.why[e] = why; return true; }
/** 이어진 선으로 묶인 무리 */
function groups(P, S) {
  const { w, h } = P, n = w * h, par = [...Array(n).keys()], f = (x) => (par[x] === x ? x : (par[x] = f(par[x])));
  for (let i = 0; i < n; i++) for (const s of [R, D]) { const e = edgeId(w, h, i, s); if (e >= 0 && S.edge[e] === 1) par[f(i)] = f(nbr(w, h, i, s)); }
  return [...Array(n).keys()].map(f);
}
/** 규칙 하나를 적용할 곳 → { rule, kind, ... } (적용까지 함) 또는 null */
function step(P, S, maxRule) {
  const { w, h } = P, n = w * h;
  // 규칙 1 — 칸 하나: 알려진 선에 맞지 않는 방향을 지우고, 남은 방향이 모두 같은 쪽 선을 정한다
  for (let i = 0; i < n; i++) {
    const keep = S.cand[i].filter((m) => SIDES.every((s) => { const e = edgeId(w, h, i, s); const v = e < 0 ? -1 : S.edge[e]; return !v || (v === 1) === !!(m & s); }));
    if (!keep.length) { S.bad = true; return { rule: 1, kind: 'dead', i }; }
    if (keep.length < S.cand[i].length) { S.cand[i] = keep; return { rule: 1, kind: 'narrow', i }; }
    for (const s of SIDES) {
      const e = edgeId(w, h, i, s);
      if (e < 0 || S.edge[e]) continue;
      const all = keep.every((m) => m & s), none = keep.every((m) => !(m & s));
      if (all || none) { setEdge(S, e, all ? 1 : -1, { kind: 'tile', i, s }); return { rule: 1, kind: 'edge', i, s, e, v: all ? 1 : -1 }; }
    }
  }
  if (maxRule < 2) return null;
  // 규칙 2 — 고리 막기: 이미 이어진 두 칸을 다시 잇는 선은 끊는다
  const g = groups(P, S);
  for (let i = 0; i < n; i++) for (const s of [R, D]) {
    const e = edgeId(w, h, i, s);
    if (e < 0 || S.edge[e]) continue;
    const j = nbr(w, h, i, s);
    if (g[i] === g[j]) { setEdge(S, e, -1, { kind: 'loop', i, j }); return { rule: 2, kind: 'loop', i, j, e }; }
  }
  if (maxRule < 3) return null;
  // 규칙 3 — 고립 막기: 이으면 더 뻗을 데가 없는 닫힌 무리가 되는 선은 끊고, 무리에서 나갈 길이 하나뿐이면 잇는다
  // 칸의 선 개수(모양)는 돌려도 그대로 → 이어진 선이 그 개수만큼이면 그 칸은 더 뻗을 수 없다
  const onCount = (k) => SIDES.filter((s) => { const e = edgeId(w, h, k, s); return e >= 0 && S.edge[e] === 1; }).length;
  for (let i = 0; i < n; i++) for (const s of [R, D]) {
    const e = edgeId(w, h, i, s);
    if (e < 0 || S.edge[e]) continue;
    const j = nbr(w, h, i, s), mem = [...Array(n).keys()].filter((k) => g[k] === g[i] || g[k] === g[j]);
    // 이 선을 이으면 무리의 모든 칸이 선을 다 쓰게 되는데 판 전체가 아니면 → 다른 칸과 이어질 수 없는 닫힌 무리
    if (mem.length < n && mem.every((k) => onCount(k) + (k === i || k === j ? 1 : 0) === deg(P.masks[k]))) {
      setEdge(S, e, -1, { kind: 'closed', i, j, size: mem.length });
      return { rule: 3, kind: 'closed', i, j, e, size: mem.length };
    }
  }
  {
    const roots = [...new Set(g)];
    if (roots.length > 1) for (const r of roots) {
      const mem = [...Array(n).keys()].filter((k) => g[k] === r), outs = [];
      for (const k of mem) for (const s of SIDES) { const e = edgeId(w, h, k, s); if (e >= 0 && !S.edge[e] && g[nbr(w, h, k, s)] !== r) outs.push(e); }
      const exits = [...new Set(outs)];
      if (exits.length === 1) { setEdge(S, exits[0], 1, { kind: 'exit', size: mem.length }); return { rule: 3, kind: 'exit', e: exits[0], size: mem.length }; }
      if (!exits.length) { S.bad = true; return { rule: 3, kind: 'stuck' }; }
    }
  }
  if (maxRule < 4) return null;
  // 규칙 4 — 놓아 보기: 이 칸을 그 방향으로 두면 규칙 1~3만으로 모순이 생기는 방향을 지운다
  for (let i = 0; i < n; i++) {
    if (S.cand[i].length < 2) continue;
    for (const m of S.cand[i]) {
      const T = cloneS(S); T.cand[i] = [m];
      if (run(P, T, 3).bad) { S.cand[i] = S.cand[i].filter((x) => x !== m); return { rule: 4, kind: 'try', i, m }; }
    }
  }
  return null;
}
function run(P, S, maxRule, steps) {
  let top = 1;
  for (let guard = 0; guard < 20000 && !S.bad; guard++) {
    const s = step(P, S, maxRule);
    if (!s) break;
    top = Math.max(top, s.rule);
    if (steps) steps.push(s);
  }
  return { bad: !!S.bad, top };
}
export function solveLogic(P, maxRule = 4) {
  const S = startState(P), r = run(P, S, maxRule);
  const solved = !r.bad && S.cand.every((c) => c.length === 1) && isSolved(P.w, P.h, S.cand.map((c) => c[0]));
  return { solved, rule: r.top, masks: S.cand.map((c) => c[0]) };
}
/** 해의 개수 (limit에서 멈춤) — 규칙 1~3으로 좁힌 뒤 방향을 나눠 본다 */
export function countSolutions(P, limit = 2) {
  let found = 0;
  const go = (S) => {
    if (found >= limit) return;
    if (run(P, S, 3).bad) return;
    let i = -1;
    for (let k = 0; k < S.cand.length; k++) if (S.cand[k].length > 1 && (i < 0 || S.cand[k].length < S.cand[i].length)) i = k;
    if (i < 0) { if (isSolved(P.w, P.h, S.cand.map((c) => c[0]))) found++; return; }
    for (const m of S.cand[i]) { const T = cloneS(S); T.cand[i] = [m]; go(T); }
  };
  go(startState(P));
  return found;
}

/* ---------------- 문제 만들기 ---------------- */
/** 시드 → 문제 — 그 난이도의 규칙이 꼭 필요하고 그 규칙까지로 풀리는 문제. 정해진 횟수 안에 못 찾으면 미리 검증한 예비 문제(pz-bank.js) */
export function generate(seed, levelId, { attempts = 2000 } = {}) {
  const Lv = LEVELS[levelId] || LEVELS.normal, rnd = rng(seed), { w, h } = Lv, n = w * h;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // 전원에서 시작하는 무작위 나무 (한 칸에 선은 셋까지 — 십자 모양 없음)
    const sol = Array(n).fill(0), inTree = new Uint8Array(n), hub = hubOf(w, h);
    inTree[hub] = 1;
    let front = SIDES.map((s) => [hub, s]), count = 1;
    while (front.length && count < n) {
      const k = randInt(rnd, front.length), [i, s] = front[k];
      front.splice(k, 1);
      const j = nbr(w, h, i, s);
      if (j < 0 || inTree[j] || deg(sol[i]) >= 3) continue;
      sol[i] |= s; sol[j] |= OPP[s]; inTree[j] = 1; count++;
      for (const t of SIDES) front.push([j, t]);
    }
    if (count < n) continue;
    const P = { w, h, masks: sol };
    const r = solveLogic(P, Lv.rule);
    if (!r.solved) continue;
    // 섞기: 칸마다 무작위로 돌림 (적어도 절반은 정답 방향이 아니게)
    let start;
    for (let t = 0; t < 50; t++) {
      start = sol.map((m) => rotN(m, randInt(rnd, 4)));
      if (start.filter((m, i) => m !== sol[i]).length >= n * 0.6 && !isSolved(w, h, start)) break;
    }
    const par = sol.reduce((a, m, i) => a + turnsTo(start[i], m), 0);
    if (r.rule === Lv.rule) return { w, h, masks: start, solution: sol, rule: r.rule, par, attempt };
  }
  return fromBank(seed, levelId);
}
function fromBank(seed, levelId) {
  const id = LEVELS[levelId] ? levelId : 'normal', { w, h } = LEVELS[id], list = BANK.circuit[id], e = list[(seed >>> 0) % list.length];
  const solution = [...e.sol].map((c) => parseInt(c, 16)), masks = [...e.start].map((c) => parseInt(c, 16));
  return { w, h, masks, solution, rule: solveLogic({ w, h, masks }, LEVELS[id].rule).rule, par: solution.reduce((a, m, i) => a + turnsTo(masks[i], m), 0), attempt: -1, bank: true };
}

/* ---------------- 힌트 ---------------- */
const SIDE_NAME = { [U]: '위', [R]: '오른쪽', [D]: '아래', [L]: '왼쪽' };
const SIDE_TOPIC = { [U]: '위는', [R]: '오른쪽은', [D]: '아래는', [L]: '왼쪽은' }, SIDE_WITH = { [U]: '위와', [R]: '오른쪽과', [D]: '아래와', [L]: '왼쪽과' };
export const tileName = (w, i) => `${((i / w) | 0) + 1}행 ${(i % w) + 1}열 칸`;
/** cur: 지금 칸들의 방향. 풀이 규칙으로 방향이 정해지는 칸 가운데 지금 방향이 다른 첫 칸과 그 이유 */
export function hint(P, cur) {
  const { w, h, solution } = P, S = startState({ w, h, masks: solution });
  let steps = 0;
  const firstWrong = () => S.cand.findIndex((c, i) => c.length === 1 && cur[i] !== c[0]);
  for (let guard = 0; guard < 20000 && !S.bad; guard++) {
    const k = firstWrong();
    if (k >= 0) return { kind: 'tile', i: k, m: S.cand[k][0], turns: turnsTo(cur[k], S.cand[k][0]), sides: sidesWhy(P, S, k), steps };
    const s = step(P, S, 4);
    if (!s) break;
    steps++;
    if (s.kind === 'try') S.lastTry = s;
  }
  const k = cur.findIndex((m, i) => m !== solution[i]);
  return k < 0 ? null : { kind: 'tile', i: k, m: solution[k], turns: turnsTo(cur[k], solution[k]), sides: [], steps, reveal: true };
}
function sidesWhy(P, S, i) {
  const { w, h } = P;
  return SIDES.map((s) => {
    const e = edgeId(w, h, i, s);
    if (e < 0) return { s, v: -1, why: 'border' };
    return { s, v: S.edge[e], why: S.why[e]?.kind || (S.edge[e] ? 'tile' : '') };
  });
}
export function explain(P, hnt) {
  if (!hnt) return '';
  const name = tileName(P.w, hnt.i), turn = hnt.turns > 0 ? `시계 방향으로 ${hnt.turns}번 돌리면 돼요` : '지금 방향이 맞아요';
  if (hnt.reveal) return `${name}은 표시한 방향이 정답이에요. ${turn}.`;
  const parts = [];
  for (const { s, v, why } of hnt.sides) {
    if (why === 'border') parts.push(`${SIDE_TOPIC[s]} 판 가장자리라 선이 나갈 수 없고`);
    else if (why === 'loop') parts.push(`${SIDE_WITH[s]} 이으면 이미 이어진 칸끼리 고리가 생기고`);
    else if (why === 'closed') parts.push(`${SIDE_WITH[s]} 이으면 다른 칸과 이어질 수 없는 닫힌 무리가 생기고`);
    else if (why === 'exit') parts.push(`${SIDE_NAME[s]} 쪽은 무리가 밖으로 나갈 유일한 길이라 이어야 하고`);
    else if (why === 'tile' && v) parts.push(`${SIDE_NAME[s]} 칸은 ${v > 0 ? '이 칸 쪽으로 선이 나올 수밖에 없고' : '이 칸 쪽으로 선을 낼 수 없고'}`);
  }
  // 이웃 칸 덕분에 정해진 쪽이 있으면 '먼저 정리한 것'이 있다는 말을 붙인다 (가장자리만으로 정해지면 붙이지 않음)
  const lead = hnt.sides.some((x) => x.why && x.why !== 'border') ? '(이웃 칸에서 확실한 것부터 정리하면) ' : '';
  if (!parts.length) return `${lead}${name}은 남은 방향이 하나뿐이에요. ${turn}.`;
  return `${lead}${name}의 ${parts.join(', ')}, 그래서 이 칸은 표시한 방향만 가능해요. ${turn}.`;
}
