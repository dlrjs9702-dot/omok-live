// 불빛 채우기 규칙 · 문제 만들기 · 사람처럼 푸는 풀이기 · 힌트 (화면과 무관한 순수 로직 — 앱과 서버가 함께 쓴다 · 서버 복사본 server/shared/lightup-core.js)
// 규칙: 흰 칸에 전구를 놓는다. 전구는 가로 · 세로로 벽에 막힐 때까지 빛을 비춘다.
//   ① 모든 흰 칸이 빛을 받아야 한다  ② 전구끼리 서로 비추면 안 된다  ③ 숫자 벽은 바로 옆(위 · 아래 · 왼쪽 · 오른쪽)에 그 수만큼 전구가 있어야 한다
// 문제는 아래 풀이 규칙만으로 끝까지 풀리는 것만 낸다 → 정답이 하나뿐 (2026-10-30 · GPT 검토서 17장 S01)
//   1: 숫자(다 찼으면 나머지 옆 칸은 비움 · 남은 칸이 필요한 수와 같으면 모두 전구) + 이미 빛을 받는 칸은 비움
//   2: 하나뿐인 빛(아직 어두운 칸을 비출 수 있는 칸이 하나뿐이면 그 칸에 전구)
//   3: 놓아 보면 모순(전구를 둬 보거나 비워 보면 규칙 1 · 2만으로 모순이 생기는 칸)
import { rng, shuffled } from './pz-util.js';

export const WHITE = -2, WALL = -1; // 칸 값: 흰 칸 · 숫자 없는 벽 · 0~4 숫자 벽
export const LEVELS = {
  easy: { w: 7, h: 7, walls: 0.22, rule: 2 },
  normal: { w: 9, h: 9, walls: 0.2, rule: 2 },
  hard: { w: 10, h: 10, walls: 0.19, rule: 3, need: 3 },
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// 벽 자리로 정해지는 모양 정보 (보는 칸 · 숫자 벽 옆 칸) — 문제마다 한 번 만들어 둔다
const GEO = new WeakMap();
function geo(P) {
  let g = GEO.get(P);
  if (g) return g;
  const { w, h, cells } = P, n = w * h, sees = Array(n), adj = Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i / w) | 0;
    if (cells[i] === WHITE) {
      const v = [];
      for (const [dx, dy] of DIRS) for (let cx = x + dx, cy = y + dy; cx >= 0 && cy >= 0 && cx < w && cy < h && cells[cy * w + cx] === WHITE; cx += dx, cy += dy) v.push(cy * w + cx);
      sees[i] = v;
    } else {
      adj[i] = DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < w && cy < h && cells[cy * w + cx] === WHITE).map(([cx, cy]) => cy * w + cx);
    }
  }
  const whites = [], nums = [];
  for (let i = 0; i < n; i++) if (cells[i] === WHITE) whites.push(i);
  g = { sees, adj, whites, nums };
  GEO.set(P, g);
  return g;
}
const numsOf = (P) => { const out = []; for (let i = 0; i < P.cells.length; i++) if (P.cells[i] >= 0) out.push(i); return out; };

/** 전구 배열(1 = 전구) → 빛을 받는 칸 */
export function litOf(P, bulbs) {
  const { sees } = geo(P), lit = new Uint8Array(P.cells.length);
  for (let i = 0; i < bulbs.length; i++) if (bulbs[i] === 1 && P.cells[i] === WHITE) { lit[i] = 1; for (const j of sees[i]) lit[j] = 1; }
  return lit;
}
/** 지금 판의 상태: 서로 비추는 전구 · 숫자보다 많은/모자란 벽 · 어두운 칸 수 · 다 풀었는지 */
export function check(P, bulbs) {
  const { sees, adj, whites } = geo(P), lit = litOf(P, bulbs), clash = new Set(), over = new Set(), short = new Set();
  for (const i of whites) if (bulbs[i] === 1) for (const j of sees[i]) if (bulbs[j] === 1) { clash.add(i); clash.add(j); }
  for (const i of numsOf(P)) { const b = adj[i].filter((j) => bulbs[j] === 1).length; if (b > P.cells[i]) over.add(i); else if (b < P.cells[i]) short.add(i); }
  const dark = whites.filter((i) => !lit[i]).length;
  return { lit, clash, over, short, dark, done: !dark && !clash.size && !over.size && !short.size };
}

/* ---------------- 풀이기 (상태 S: 흰 칸마다 0 모름 · 1 전구 · 2 비움) ---------------- */
function litS(P, S) { const { sees, whites } = geo(P), lit = new Uint8Array(S.length); for (const i of whites) if (S[i] === 1) { lit[i] = 1; for (const j of sees[i]) lit[j] = 1; } return lit; }
/** 모순 → 이유 { kind, cell } · 없으면 null */
function brokenWhy(P, S, lit = litS(P, S)) {
  const { sees, adj, whites } = geo(P);
  for (const i of whites) if (S[i] === 1) for (const j of sees[i]) if (S[j] === 1) return { kind: 'clash', cell: i };
  for (const i of numsOf(P)) {
    let b = 0, open = 0;
    for (const j of adj[i]) { if (S[j] === 1) b++; else if (S[j] === 0 && !lit[j]) open++; }
    if (b > P.cells[i]) return { kind: 'over', cell: i };
    if (b + open < P.cells[i]) return { kind: 'under', cell: i };
  }
  for (const i of whites) {
    if (lit[i]) continue;
    if (S[i] === 0) continue;
    if (!sees[i].some((j) => S[j] === 0 && !lit[j])) return { kind: 'dark', cell: i };
  }
  return null;
}
/** 다음에 확실히 정할 수 있는 칸 하나 (규칙 maxRule까지) → { kind, cell, v(1 전구 · 2 비움), wall?, src?, why? } */
function findStep(P, S, maxRule) {
  const { sees, adj, whites } = geo(P), lit = litS(P, S);
  for (const i of whites) if (S[i] === 0 && lit[i]) return { kind: 'lit', cell: i, v: 2, rule: 1 };
  for (const w of numsOf(P)) {
    const n = P.cells[w], b = adj[w].filter((j) => S[j] === 1).length, open = adj[w].filter((j) => S[j] === 0);
    if (!open.length) continue;
    if (b === n) return { kind: 'full', cell: open[0], v: 2, wall: w, rule: 1 };
    if (b + open.length === n) return { kind: 'need', cell: open[0], v: 1, wall: w, rule: 1 };
  }
  if (maxRule < 2) return null;
  for (const i of whites) {
    if (lit[i]) continue;
    const src = [i, ...sees[i]].filter((j) => S[j] === 0);
    if (src.length === 1) return { kind: 'only', cell: src[0], v: 1, src: i, rule: 2 };
  }
  if (maxRule < 3) return null;
  for (const i of whites) {
    if (S[i] !== 0) continue;
    for (const v of [1, 2]) {
      const T = S.slice(); T[i] = v;
      const why = propagate(P, T, 2).why;
      if (why) return { kind: v === 1 ? 'tryBulb' : 'tryNo', cell: i, v: v === 1 ? 2 : 1, why, rule: 3 };
    }
  }
  return null;
}
/** S를 규칙 maxRule까지로 채운다 → { rule(쓴 가장 높은 규칙), why(모순이면 이유) } */
function propagate(P, S, maxRule, steps = null) {
  let rule = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const why = brokenWhy(P, S);
    if (why) return { rule, why };
    const s = findStep(P, S, maxRule);
    if (!s) break;
    S[s.cell] = s.v; rule = Math.max(rule, s.rule);
    if (steps) steps.push(s);
  }
  return { rule, why: brokenWhy(P, S) };
}
const startState = (P) => P.cells.map((v) => (v === WHITE ? 0 : 2));
/** 사람의 규칙으로 풀어 본다 → { solved, rule, bulbs } */
export function solveLogic(P, maxRule = 3, keepSteps = false) {
  const S = startState(P), steps = keepSteps ? [] : null, r = propagate(P, S, maxRule, steps);
  const bulbs = S.map((v) => (v === 1 ? 1 : 0));
  const solved = !r.why && geo(P).whites.every((i) => S[i] !== 0) && check(P, bulbs).done;
  return { solved, rule: r.rule, bulbs, steps };
}
/** 해의 개수 (limit에서 멈춤) — 규칙과 무관한 완전 탐색 (시험용) */
export function countSolutions(P, limit = 2) {
  const { sees, whites } = geo(P);
  let found = 0;
  const go = (S) => {
    if (found >= limit) return;
    if (propagate(P, S, 2).why) return;
    const lit = litS(P, S);
    let best = -1, bestSrc = null;
    for (const i of whites) {
      if (lit[i]) continue;
      const src = [i, ...sees[i]].filter((j) => S[j] === 0);
      if (!bestSrc || src.length < bestSrc.length) { best = i; bestSrc = src; }
    }
    if (best < 0) { const bulbs = S.map((v) => (v === 1 ? 1 : 0)); if (check(P, bulbs).done) found++; return; }
    // 어두운 칸을 비출 칸을 하나씩: 앞의 후보는 비운 채로 다음 후보에 전구 (같은 해를 두 번 세지 않게)
    for (let k = 0; k < bestSrc.length && found < limit; k++) {
      const T = S.slice(); for (let q = 0; q < k; q++) T[bestSrc[q]] = 2; T[bestSrc[k]] = 1; go(T);
    }
  };
  go(startState(P));
  return found;
}

/* ---------------- 문제 만들기 ---------------- */
/** 시드 → 문제 { w, h, cells, solution(전구 0/1), level } — 그 난이도의 규칙까지로 풀리고(어려움은 규칙 3이 꼭 필요) 정답이 하나뿐인 문제 */
export function generate(seed, levelId, { attempts = 600 } = {}) {
  const L = LEVELS[levelId] || LEVELS.normal, rnd = rng(seed), { w, h } = L, n = w * h;
  let spare = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const cells = Array(n).fill(WHITE);
    for (let i = 0; i <= n - 1 - i; i++) if (rnd() < L.walls) { cells[i] = WALL; cells[n - 1 - i] = WALL; } // 가운데를 중심으로 대칭인 벽
    if (cells.filter((v) => v === WHITE).length < n * 0.62) continue;
    const P = { w, h, cells, solution: null };
    const { sees, adj, whites } = geo(P);
    // 정답 전구: 아직 어두운 흰 칸을 무작위 차례로 골라 놓는다 (서로 비추지 않고 모든 칸이 밝아짐)
    const bulbs = Array(n).fill(0), lit = new Uint8Array(n);
    for (const i of shuffled(rnd, whites)) if (!lit[i]) { bulbs[i] = 1; lit[i] = 1; for (const j of sees[i]) lit[j] = 1; }
    for (let i = 0; i < n; i++) if (cells[i] !== WHITE) cells[i] = adj[i].filter((j) => bulbs[j]).length;
    P.solution = bulbs;
    if (!solveLogic(P, L.rule).solved) continue;
    // 숫자 빼기: 대칭 짝을 함께 숫자 없는 벽으로 — 여전히 그 규칙까지로 풀릴 때만
    for (const i of shuffled(rnd, numsOf(P))) {
      const j = n - 1 - i;
      if (j < i || cells[i] < 0) continue;
      const a = cells[i], b = cells[j];
      cells[i] = WALL; cells[j] = WALL;
      if (!solveLogic(P, L.rule).solved) { cells[i] = a; cells[j] = b; }
    }
    const r = solveLogic(P, L.rule);
    if (!r.solved) continue;
    const out = { w, h, cells: cells.slice(), solution: bulbs, level: r.rule, attempt };
    if (L.need && r.rule < L.need) { spare ||= out; continue; }
    return out;
  }
  if (spare) return spare; // 꼭 필요한 규칙까지 쓰는 문제를 정해진 횟수 안에 못 찾음(드묾) — 그래도 정답 하나뿐인 문제
  throw new Error('lightup: 문제를 만들지 못했어요');
}

/* ---------------- 힌트 ---------------- */
/** 지금 판(cur: 0 빈칸 · 1 전구 · 2 점)에서 다음에 확실히 둘 전구 하나와 그 이유 → { kind, ... } */
export function hint(P, cur) {
  const sol = P.solution, { whites } = geo(P);
  const wrong = whites.filter((i) => cur[i] === 1 && sol[i] !== 1);
  if (wrong.length) return { kind: 'wrong', cells: wrong };
  const wrongDot = whites.filter((i) => cur[i] === 2 && sol[i] === 1);
  if (wrongDot.length) return { kind: 'wrongDot', cells: wrongDot };
  const S = startState(P);
  for (const i of whites) if (cur[i] === 1) S[i] = 1;
  const pre = [];
  for (let guard = 0; guard < 2000; guard++) {
    const s = findStep(P, S, 3);
    if (!s) break;
    S[s.cell] = s.v;
    if (s.v === 1 && cur[s.cell] !== 1) return { kind: 'step', step: s, pre, cell: s.cell };
    if (s.kind !== 'lit') pre.push(s);
  }
  const i = whites.find((j) => sol[j] === 1 && cur[j] !== 1);
  return i == null ? null : { kind: 'reveal', cell: i, pre };
}
const cellName = (P, i) => `${((i / P.w) | 0) + 1}행 ${(i % P.w) + 1}열 칸`;
const wallName = (P, i) => `${((i / P.w) | 0) + 1}행 ${(i % P.w) + 1}열의 숫자 ${P.cells[i]} 벽`;
function whyText(P, w) {
  if (!w) return '모순이 생겨요.';
  if (w.kind === 'over') return `${wallName(P, w.cell)} 옆 전구가 숫자보다 많아져요.`;
  if (w.kind === 'under') return `${wallName(P, w.cell)} 옆에 필요한 전구를 다 놓을 자리가 없어져요.`;
  if (w.kind === 'dark') return `${cellName(P, w.cell)}에 빛이 닿을 방법이 없어져요.`;
  if (w.kind === 'clash') return '전구끼리 서로 비추게 돼요.';
  return '모순이 생겨요.';
}
export function explainStep(P, s) {
  switch (s.kind) {
    case 'lit': return `${cellName(P, s.cell)}은 이미 빛을 받고 있어요. 여기에 전구를 두면 다른 전구와 서로 비추게 돼요.`;
    case 'full': return `${wallName(P, s.wall)} 옆에는 이미 전구가 숫자만큼 있어요. 그래서 나머지 옆 칸에는 전구를 둘 수 없어요.`;
    case 'need': return `${wallName(P, s.wall)} 옆에 전구가 더 필요한데, 둘 수 있는 옆 칸이 딱 그만큼 남았어요. 그래서 ${cellName(P, s.cell)}에 전구가 들어가요.`;
    case 'only': return s.src === s.cell
      ? `${cellName(P, s.cell)}에는 다른 곳에서 빛이 올 수 없어요. 그래서 이 칸에 직접 전구를 둬야 해요.`
      : `${cellName(P, s.src)}에 빛을 줄 수 있는 칸은 ${cellName(P, s.cell)} 하나뿐이에요. 그래서 거기에 전구가 들어가요.`;
    case 'tryBulb': return `${cellName(P, s.cell)}에 전구를 둔다고 해 보면, 그 뒤 ${whyText(P, s.why)} 그래서 여기에는 전구를 둘 수 없어요.`;
    case 'tryNo': return `${cellName(P, s.cell)}을 비워 둔다고 해 보면, 그 뒤 ${whyText(P, s.why)} 그래서 여기에 전구가 들어가요.`;
    default: return '';
  }
}
export function explain(P, h) {
  if (!h) return '';
  if (h.kind === 'wrong') return `빨갛게 표시한 전구 ${h.cells.length}개는 정답 자리가 아니에요. 그 전구를 빼 보세요.`;
  if (h.kind === 'wrongDot') return `빨갛게 표시한 점 ${h.cells.length}개 자리에는 전구가 들어가야 해요. 점을 지워 보세요.`;
  const lines = h.pre.slice(-2).map((s) => explainStep(P, s));
  if (h.pre.length > 2) lines.unshift(`(앞에서 확실한 것 ${h.pre.length - 2}가지를 먼저 정리하면)`);
  lines.push(h.kind === 'reveal' ? `${cellName(P, h.cell)}에 전구가 들어가요.` : explainStep(P, h.step));
  return lines.join(' ');
}
