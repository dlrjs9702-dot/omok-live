// 스도쿠 규칙 · 문제 만들기 · 사람처럼 푸는 풀이기 · 힌트 (화면과 무관한 순수 로직 — 게임 화면과 시험이 함께 쓴다)
// 규칙: 9×9 판의 가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩 들어간다.
// 문제는 사람의 풀이 기술(아래 TECH)만으로 끝까지 풀리는 것만 낸다 → 정답이 하나뿐이고, 힌트가 언제나 '이유'를 댈 수 있다.
import { rng, shuffled } from './pz-util.js';
import { BANK } from './pz-bank.js';

export const rowOf = (i) => (i / 9) | 0;
export const colOf = (i) => i % 9;
export const boxOf = (i) => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
/** 단위 27개: 0~8 가로줄 · 9~17 세로줄 · 18~26 3×3 칸 */
export const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push([...Array(9).keys()].map((c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push([...Array(9).keys()].map((r) => r * 9 + c));
for (let b = 0; b < 9; b++) UNITS.push([...Array(81).keys()].filter((i) => boxOf(i) === b));
export const UNITS_OF = [...Array(81).keys()].map((i) => [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]);
export const PEERS = [...Array(81).keys()].map((i) => [...new Set(UNITS_OF[i].flatMap((u) => UNITS[u]))].filter((j) => j !== i));

const ALL = 0x3fe; // 1~9 비트
const bit = (d) => 1 << d;
export const digitsOf = (m) => { const out = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d); return out; };
const pop = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

/** 빈칸마다 들어갈 수 있는 숫자(비트) — 같은 줄 · 칸에 이미 있는 숫자를 뺀 것 */
export function candidates(g) {
  const c = Array(81).fill(0);
  for (let i = 0; i < 81; i++) if (!g[i]) { let m = ALL; for (const j of PEERS[i]) if (g[j]) m &= ~bit(g[j]); c[i] = m; }
  return c;
}
/** 규칙 위반(같은 줄 · 칸에 같은 숫자)인 칸들 */
export function conflicts(g) {
  const bad = new Set();
  for (const u of UNITS) { const seen = {}; for (const i of u) if (g[i]) (seen[g[i]] ||= []).push(i); for (const d in seen) if (seen[d].length > 1) seen[d].forEach((i) => bad.add(i)); }
  return bad;
}
export const isSolved = (g) => g.every((v) => v >= 1 && v <= 9) && conflicts(g).size === 0;

/** 해의 개수 (limit에서 멈춤) — 문제 검사용 */
export function countSolutions(g0, limit = 2) {
  const g = g0.slice();
  let n = 0;
  const go = () => {
    let best = -1, bm = 0, bc = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      let m = ALL; for (const j of PEERS[i]) if (g[j]) m &= ~bit(g[j]);
      const k = pop(m);
      if (!k) return;
      if (k < bc) { bc = k; best = i; bm = m; if (k === 1) break; }
    }
    if (best < 0) { n++; return; }
    for (const d of digitsOf(bm)) { g[best] = d; go(); if (n >= limit) break; }
    g[best] = 0;
  };
  go();
  return n;
}
/** 꽉 찬 정답판 하나 (시드 난수로) */
export function fullGrid(rnd) {
  const g = Array(81).fill(0);
  const go = (i) => {
    if (i === 81) return true;
    let m = ALL; for (const j of PEERS[i]) if (g[j]) m &= ~bit(g[j]);
    for (const d of shuffled(rnd, digitsOf(m))) { g[i] = d; if (go(i + 1)) return true; }
    g[i] = 0;
    return false;
  };
  go(0);
  return g;
}

/* ---------------- 사람의 풀이 기술 ----------------
 * 단계 1: 숨은 하나(한 단위에서 그 숫자가 들어갈 곳이 하나뿐) · 혼자 남은 숫자(그 칸에 들어갈 숫자가 하나뿐)
 * 단계 2: 줄 겹침(3×3 칸 안에서 숫자가 한 줄에만 → 그 줄의 다른 칸에서 지움) · 칸 겹침(줄에서 숫자가 한 3×3 칸에만) · 짝(두 칸이 같은 두 숫자)
 * 단계 3: 숨은 짝 · 세 칸 묶음 · X-윙
 * 단계는 '숫자를 넣는 수(place)'나 '후보를 지우는 수(elim)'를 돌려준다. */
export const TECH = {
  hiddenBox: 1, naked: 1, hiddenLine: 1,
  pointing: 2, claiming: 2, nakedPair: 2,
  hiddenPair: 3, nakedTriple: 3, xwing: 3,
};
export const unitName = (u) => (u < 9 ? `${u + 1}번째 가로줄` : u < 18 ? `${u - 8}번째 세로줄` : `${BOX_NAME[u - 18]} 3×3 칸`);
const BOX_NAME = ['왼쪽 위', '가운데 위', '오른쪽 위', '왼쪽 가운데', '한가운데', '오른쪽 가운데', '왼쪽 아래', '가운데 아래', '오른쪽 아래'];
export const cellName = (i) => `${rowOf(i) + 1}번째 가로줄 · ${colOf(i) + 1}번째 세로줄 칸`;

function findPlace(v, c) {
  // 숨은 하나 — 3×3 칸 먼저 (사람이 가장 먼저 보는 곳), 혼자 남은 숫자, 가로 · 세로줄
  const hidden = (from, to, kind) => {
    for (let u = from; u < to; u++) for (let d = 1; d <= 9; d++) {
      let at = -1, n = 0;
      for (const i of UNITS[u]) { if (v[i] === d) { n = -1; break; } if (c[i] & bit(d)) { at = i; n++; } }
      if (n === 1) return { kind, unit: u, i: at, d };
    }
    return null;
  };
  return hidden(18, 27, 'hiddenBox')
    || (() => { for (let i = 0; i < 81; i++) if (!v[i] && pop(c[i]) === 1) return { kind: 'naked', i, d: digitsOf(c[i])[0] }; return null; })()
    || hidden(0, 18, 'hiddenLine');
}
function findElim(v, c, maxLevel) {
  const steps = [];
  const out = (s) => (s.elim.length ? s : null);
  if (maxLevel >= 2) {
    // 줄 겹침: 3×3 칸 안에서 숫자 d가 한 가로줄(세로줄)에만
    for (let b = 0; b < 9; b++) for (let d = 1; d <= 9; d++) {
      const at = UNITS[18 + b].filter((i) => c[i] & bit(d));
      if (at.length < 2) continue;
      for (const [line, of] of [[rowOf(at[0]), rowOf], [9 + colOf(at[0]), colOf]]) {
        if (!at.every((i) => (line < 9 ? of(i) === line : 9 + of(i) === line))) continue;
        const s = out({ kind: 'pointing', box: 18 + b, unit: line, d, cells: at, elim: UNITS[line].filter((i) => boxOf(i) !== b && c[i] & bit(d)).map((i) => [i, d]) });
        if (s) return s;
      }
    }
    // 칸 겹침: 줄에서 숫자 d가 한 3×3 칸 안에만
    for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {
      const at = UNITS[u].filter((i) => c[i] & bit(d));
      if (at.length < 2 || !at.every((i) => boxOf(i) === boxOf(at[0]))) continue;
      const s = out({ kind: 'claiming', unit: u, box: 18 + boxOf(at[0]), d, cells: at, elim: UNITS[18 + boxOf(at[0])].filter((i) => !UNITS[u].includes(i) && c[i] & bit(d)).map((i) => [i, d]) });
      if (s) return s;
    }
    // 짝: 한 단위에서 두 칸의 후보가 같은 두 숫자
    for (let u = 0; u < 27; u++) {
      const two = UNITS[u].filter((i) => pop(c[i]) === 2);
      for (let a = 0; a < two.length; a++) for (let b = a + 1; b < two.length; b++) {
        if (c[two[a]] !== c[two[b]]) continue;
        const m = c[two[a]], ds = digitsOf(m);
        const s = out({ kind: 'nakedPair', unit: u, cells: [two[a], two[b]], ds, elim: UNITS[u].filter((i) => i !== two[a] && i !== two[b] && c[i] & m).flatMap((i) => ds.filter((d) => c[i] & bit(d)).map((d) => [i, d])) });
        if (s) return s;
      }
    }
  }
  if (maxLevel >= 3) {
    // 숨은 짝: 한 단위에서 두 숫자가 들어갈 곳이 똑같이 두 칸뿐
    for (let u = 0; u < 27; u++) {
      const pos = {};
      for (let d = 1; d <= 9; d++) { const at = UNITS[u].filter((i) => c[i] & bit(d)); if (at.length === 2 && !UNITS[u].some((i) => v[i] === d)) pos[d] = at; }
      const ds = Object.keys(pos).map(Number);
      for (let a = 0; a < ds.length; a++) for (let b = a + 1; b < ds.length; b++) {
        const [p, q] = [pos[ds[a]], pos[ds[b]]];
        if (p[0] !== q[0] || p[1] !== q[1]) continue;
        const keep = bit(ds[a]) | bit(ds[b]);
        const s = out({ kind: 'hiddenPair', unit: u, cells: p, ds: [ds[a], ds[b]], elim: p.flatMap((i) => digitsOf(c[i] & ~keep).map((d) => [i, d])) });
        if (s) return s;
      }
    }
    // 세 칸 묶음: 한 단위에서 세 칸의 후보를 합쳐도 숫자가 셋뿐
    for (let u = 0; u < 27; u++) {
      const cs = UNITS[u].filter((i) => { const k = pop(c[i]); return k >= 2 && k <= 3; });
      for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) for (let e = b + 1; e < cs.length; e++) {
        const m = c[cs[a]] | c[cs[b]] | c[cs[e]];
        if (pop(m) !== 3) continue;
        const trio = [cs[a], cs[b], cs[e]], ds = digitsOf(m);
        const s = out({ kind: 'nakedTriple', unit: u, cells: trio, ds, elim: UNITS[u].filter((i) => !trio.includes(i) && c[i] & m).flatMap((i) => ds.filter((d) => c[i] & bit(d)).map((d) => [i, d])) });
        if (s) return s;
      }
    }
    // X-윙: 숫자 d가 두 가로줄에서 똑같은 두 세로줄에만 (또는 반대)
    for (const [base, cross] of [[0, 9], [9, 0]]) for (let d = 1; d <= 9; d++) {
      const lines = [];
      for (let k = 0; k < 9; k++) { const at = UNITS[base + k].filter((i) => c[i] & bit(d)); if (at.length === 2) lines.push(at); }
      const key = (i) => (base === 0 ? colOf(i) : rowOf(i));
      for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
        const [p, q] = [lines[a], lines[b]];
        if (key(p[0]) !== key(q[0]) || key(p[1]) !== key(q[1])) continue;
        const corners = [...p, ...q], crossUnits = [cross + key(p[0]), cross + key(p[1])];
        const s = out({ kind: 'xwing', d, units: [base + (base === 0 ? rowOf(p[0]) : colOf(p[0])), base + (base === 0 ? rowOf(q[0]) : colOf(q[0]))], crossUnits, cells: corners, elim: crossUnits.flatMap((u) => UNITS[u].filter((i) => !corners.includes(i) && c[i] & bit(d)).map((i) => [i, d])) });
        if (s) return s;
      }
    }
  }
  return null;
}
function apply(v, c, s) {
  if (s.elim) { for (const [i, d] of s.elim) c[i] &= ~bit(d); return; }
  v[s.i] = s.d; c[s.i] = 0;
  for (const j of PEERS[s.i]) c[j] &= ~bit(s.d);
}
/** 사람의 기술(maxLevel 단계까지)로 풀어 본다 → { solved, level: 쓴 가장 높은 단계, steps, grid } */
export function solveLogic(g, maxLevel = 3, keepSteps = false) {
  const v = g.slice(), c = candidates(v), steps = [];
  let level = 1;
  for (let guard = 0; guard < 2000; guard++) {
    if (v.every(Boolean)) break;
    if (v.some((x, i) => !x && !c[i])) return { solved: false, level, steps, grid: v, broken: true };
    const s = findPlace(v, c) || findElim(v, c, maxLevel);
    if (!s) break;
    level = Math.max(level, TECH[s.kind]);
    if (keepSteps) steps.push(s);
    apply(v, c, s);
  }
  return { solved: v.every(Boolean) && conflicts(v).size === 0, level, steps, grid: v };
}

/* ---------------- 문제 만들기 ---------------- */
export const LEVELS = {
  easy: { tech: 1, minClues: 36 },
  normal: { tech: 2, minClues: 28 },
  hard: { tech: 3, minClues: 22 },
};
/** 시드 → { puzzle, solution, level } — 그 난이도의 기술이 꼭 필요하고, 그 기술까지로 끝까지 풀리는 문제
 *  정해진 횟수(attempts) 안에 못 찾으면 더 쉬운 문제를 내지 않고 미리 검증한 예비 문제(pz-bank.js)를 낸다 (같은 시드면 같은 예비 문제) */
export function generate(seed, levelId, { attempts = 400 } = {}) {
  const L = LEVELS[levelId] || LEVELS.normal, rnd = rng(seed);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const sol = fullGrid(rnd), p = sol.slice();
    // 180도 대칭으로 두 칸씩 지운다 (보기 좋은 문제 모양) — 사람의 기술로 여전히 풀릴 때만
    let clues = 81;
    for (const i of shuffled(rnd, [...Array(41).keys()])) {
      const j = 80 - i, k = i === j ? 1 : 2;
      if (clues - k < L.minClues) continue;
      const a = p[i], b = p[j];
      p[i] = 0; p[j] = 0;
      if (solveLogic(p, L.tech).solved) clues -= k; else { p[i] = a; p[j] = b; }
    }
    const lv = solveLogic(p, L.tech).level;
    if (lv === L.tech) return { puzzle: p, solution: sol, level: lv, clues, attempt };
  }
  return fromBank(seed, levelId);
}
function fromBank(seed, levelId) {
  const id = LEVELS[levelId] ? levelId : 'normal', list = BANK.sudoku[id], text = list[(seed >>> 0) % list.length];
  const puzzle = [...text].map((ch) => (ch === '.' ? 0 : +ch)), r = solveLogic(puzzle, LEVELS[id].tech);
  return { puzzle, solution: r.grid, level: r.level, clues: puzzle.filter(Boolean).length, attempt: -1, bank: true };
}

/* ---------------- 힌트 ----------------
 * 지금 판(사용자가 넣은 숫자 포함)에서 다음에 '확실히' 넣을 수 있는 숫자 하나와 그 이유.
 * 그 숫자를 찾으려고 먼저 후보를 지워야 하면 그 단계들(pre)도 함께 돌려준다. */
export function hint(g, solution) {
  const wrong = [];
  for (let i = 0; i < 81; i++) if (g[i] && g[i] !== solution[i]) wrong.push(i);
  if (wrong.length) return { kind: 'wrong', cells: wrong };
  const v = g.slice(), c = candidates(v), pre = [];
  for (let guard = 0; guard < 60; guard++) {
    const p = findPlace(v, c);
    if (p) return { ...p, pre };
    const e = findElim(v, c, 3);
    if (!e) break;
    pre.push(e); apply(v, c, e);
  }
  // 위 기술로 못 찾으면(드묾) 후보가 가장 적은 칸의 답을 알려 준다
  let best = -1;
  for (let i = 0; i < 81; i++) if (!g[i] && (best < 0 || pop(c[i]) < pop(c[best]))) best = i;
  return best < 0 ? null : { kind: 'reveal', i: best, d: solution[best], pre };
}
const list = (ds) => ds.join(' · ');
// 숫자 읽는 소리의 받침에 맞춘 조사 (1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔은 받침 있음)
const HAS = { 1: 1, 3: 1, 6: 1, 7: 1, 8: 1 };
const J = (d, yes, no) => `${d}${HAS[d] ? yes : no}`;
const JL = (ds, yes, no) => `${list(ds)}${HAS[ds[ds.length - 1]] ? yes : no}`;
/** 힌트를 사람이 읽을 문장으로 */
export function explain(h, g) {
  if (!h) return '';
  if (h.kind === 'wrong') return `빨간 테두리 칸${h.cells.length > 1 ? ` ${h.cells.length}곳` : ''}의 숫자가 정답과 달라요. 그 숫자를 지우고 다시 생각해 보세요.`;
  const lines = [];
  for (const s of h.pre || []) lines.push(explainElim(s));
  const tail = h.pre?.length ? ' (앞에서 지운 후보까지 빼고 보면)' : '';
  if (h.kind === 'hiddenBox' || h.kind === 'hiddenLine') {
    lines.push(`${unitName(h.unit)}에서 ${J(h.d, '이', '가')} 들어갈 수 있는 곳은 이 칸뿐이에요${tail}. 다른 빈칸은 같은 가로줄 · 세로줄 · 3×3 칸 어딘가에 이미 ${J(h.d, '이', '가')} 있어서 안 돼요.`);
  } else if (h.kind === 'naked') {
    if (h.pre?.length) lines.push(`그러면 이 칸에 남는 숫자는 ${h.d}뿐이에요.`);
    else {
      const seen = (u) => digitsOf(UNITS[u].reduce((m, j) => (g[j] ? m | bit(g[j]) : m), 0));
      const [r, cc, b] = UNITS_OF[h.i];
      const has = (u, where) => (seen(u).length ? `${where}에 ${list(seen(u))}` : '');
      const all = [has(r, '가로줄'), has(cc, '세로줄'), has(b, '3×3 칸')].filter(Boolean).join(', ');
      lines.push(`이 칸과 같은 ${all}이(가) 이미 있어요. 이 숫자들을 빼면 1~9 가운데 남는 숫자는 ${h.d}뿐이에요.`.replace('이(가) 이미', `${HAS[seen(b).at(-1) ?? seen(cc).at(-1) ?? seen(r).at(-1)] ? '이' : '가'} 이미`));
    }
  } else if (h.kind === 'reveal') lines.push(`이 칸의 답은 ${h.d}예요.`);
  return lines.join(' ');
}
export function explainElim(s) {
  const at = (cells) => cells.map((i) => `${rowOf(i) + 1}행 ${colOf(i) + 1}열`).join(' · ');
  switch (s.kind) {
    case 'pointing': return `${unitName(s.box)}에서 ${J(s.d, '은', '는')} ${unitName(s.unit)}에만 들어갈 수 있어요. 그래서 ${unitName(s.unit)}의 다른 3×3 칸에는 ${J(s.d, '이', '가')} 들어갈 수 없어요.`;
    case 'claiming': return `${unitName(s.unit)}에서 ${J(s.d, '은', '는')} ${unitName(s.box)} 안에만 들어갈 수 있어요. 그래서 그 3×3 칸의 나머지 칸에는 ${J(s.d, '이', '가')} 들어갈 수 없어요.`;
    case 'nakedPair': return `${unitName(s.unit)}의 두 칸 ${at(s.cells)}에는 ${list(s.ds)}만 들어갈 수 있어요. 두 칸이 이 두 숫자를 나눠 가지므로 같은 단위의 다른 칸에는 ${JL(s.ds, '이', '가')} 들어갈 수 없어요.`;
    case 'hiddenPair': return `${unitName(s.unit)}에서 ${JL(s.ds, '이', '가')} 들어갈 수 있는 곳은 두 칸 ${at(s.cells)}뿐이에요. 그래서 이 두 칸에는 다른 숫자가 들어갈 수 없어요.`;
    case 'nakedTriple': return `${unitName(s.unit)}의 세 칸 ${at(s.cells)}에 들어갈 수 있는 숫자를 모두 합쳐도 ${list(s.ds)} 셋뿐이에요. 세 칸이 이 숫자들을 나눠 가지므로 같은 단위의 다른 칸에는 들어갈 수 없어요.`;
    case 'xwing': return `${J(s.d, '은', '는')} ${unitName(s.units[0])}와 ${unitName(s.units[1])}에서 똑같이 ${unitName(s.crossUnits[0])} · ${unitName(s.crossUnits[1])}에만 들어갈 수 있어요(X-윙). 어느 쪽으로 채워지든 그 두 줄의 ${J(s.d, '은', '는')} 여기서 채워지므로, 두 줄의 다른 칸에는 ${J(s.d, '이', '가')} 들어갈 수 없어요.`;
    default: return '';
  }
}
