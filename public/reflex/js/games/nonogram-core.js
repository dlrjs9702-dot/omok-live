// 네모로직(노노그램) 규칙 · 줄 풀이 · 문제 만들기 · 힌트 (화면과 무관한 순수 로직 — 게임 화면과 시험이 함께 쓴다)
// 규칙: 가로줄 · 세로줄 옆의 숫자는 그 줄에서 이어 칠한 칸 묶음의 길이를 순서대로 나타낸다. 묶음 사이는 한 칸 이상 비운다.
// 문제는 '줄 하나씩만 보고' 끝까지 풀리는 것만 낸다 → 정답이 하나뿐이고, 힌트가 언제나 이유(그 줄의 단서)를 댈 수 있다.
import { rng, randInt } from './pz-util.js';
import { PICTURES } from './nonogram-pics.js';

export const UNKNOWN = 0, FILL = 1, EMPTY = 2;

/** 칠한 칸 배열(1/0) → 묶음 길이 단서 */
export const clueOf = (line) => { const out = []; let n = 0; for (const v of line) { if (v === 1) n++; else if (n) { out.push(n); n = 0; } } if (n) out.push(n); return out; };
export function cluesOf(sol, w, h) {
  const rows = [], cols = [];
  for (let y = 0; y < h; y++) rows.push(clueOf(sol.slice(y * w, y * w + w)));
  for (let x = 0; x < w; x++) cols.push(clueOf([...Array(h).keys()].map((y) => sol[y * w + x])));
  return { rows, cols };
}

/** 줄 하나 풀기: cells(0 모름 · 1 칠함 · 2 빔)과 단서로, 놓을 수 있는 모든 방법을 센다
 *  → { total: 방법 수, fill[i]: 그 칸을 칠하는 방법 수 } (total 0이면 모순) */
export function lineSolve(cells, clue) {
  const n = cells.length, k = clue.length;
  const filledBefore = [0]; // [0, i)의 칠한 칸 수
  for (let i = 0; i < n; i++) filledBefore.push(filledBefore[i] + (cells[i] === FILL ? 1 : 0));
  const emptyBefore = [0];
  for (let i = 0; i < n; i++) emptyBefore.push(emptyBefore[i] + (cells[i] === EMPTY ? 1 : 0));
  const noFill = (a, b) => filledBefore[b] - filledBefore[a] === 0;
  const canBlock = (s, L) => s + L <= n && emptyBefore[s + L] - emptyBefore[s] === 0 && (s + L === n || cells[s + L] !== FILL);
  const after = (s, L) => Math.min(n, s + L + 1);
  // F[j][p]: 묶음 j..끝을 [p, n)에 놓는 방법 수 (묶음 밖 칸은 칠하지 않음)
  const F = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0));
  for (let p = 0; p <= n; p++) F[k][p] = noFill(p, n) ? 1 : 0;
  for (let j = k - 1; j >= 0; j--) for (let p = n; p >= 0; p--) {
    let w = 0;
    for (let s = p; s < n && noFill(p, s); s++) if (canBlock(s, clue[j])) w += F[j + 1][after(s, clue[j])];
    F[j][p] = w;
  }
  const total = F[0][0], fill = Array(n).fill(0);
  if (!total) return { total, fill };
  // B[j][p]: 묶음 0..j-1을 놓고 다음 빈자리가 정확히 p인 방법 수
  let B = Array(n + 1).fill(0); B[0] = 1;
  for (let j = 0; j < k; j++) {
    const L = clue[j], nb = Array(n + 1).fill(0);
    for (let s = 0; s < n; s++) {
      if (!canBlock(s, L)) continue;
      let ways = 0; // 앞 묶음이 끝난 자리 p(≤s)에서 s까지 칠한 칸이 없는 경우
      for (let p = s; p >= 0; p--) { if (p < s && cells[p] === FILL) break; ways += B[p]; }
      if (!ways) continue;
      const nx = after(s, L), through = ways * F[j + 1][nx];
      if (through) for (let i = s; i < s + L; i++) fill[i] += through;
      nb[nx] += ways;
    }
    B = nb;
  }
  return { total, fill };
}

/** 판 전체를 줄 풀이만으로 → { solved, grid, steps } (steps: 줄마다 새로 정해진 칸) */
export function solveLines(w, h, clues, start, keepSteps = false) {
  const g = start ? start.slice() : Array(w * h).fill(UNKNOWN), steps = [];
  const lineIdx = (t, k) => (t === 'r' ? [...Array(w).keys()].map((x) => k * w + x) : [...Array(h).keys()].map((y) => y * w + k));
  let changed = true, guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (const t of ['r', 'c']) for (let k = 0; k < (t === 'r' ? h : w); k++) {
      const idx = lineIdx(t, k), cells = idx.map((i) => g[i]), clue = t === 'r' ? clues.rows[k] : clues.cols[k];
      if (!cells.includes(UNKNOWN)) continue;
      const r = lineSolve(cells, clue);
      if (!r.total) return { solved: false, broken: true, grid: g, steps };
      const set = [];
      idx.forEach((i, q) => { if (g[i] !== UNKNOWN) return; if (r.fill[q] === r.total) set.push([i, FILL]); else if (r.fill[q] === 0) set.push([i, EMPTY]); });
      if (!set.length) continue;
      for (const [i, v] of set) g[i] = v;
      if (keepSteps) steps.push({ t, k, set, total: r.total });
      changed = true;
    }
  }
  return { solved: !g.includes(UNKNOWN), grid: g, steps };
}

/* ---------------- 문제 ---------------- */
export const LEVELS = { easy: { size: 5 }, normal: { size: 10 }, hard: { size: 15 } };
const parse = (p) => { const rows = p.art.trim().split('\n').map((r) => r.trim()); return { name: p.name, w: rows[0].length, h: rows.length, sol: rows.join('').split('').map((ch) => (ch === '#' ? 1 : 0)) }; };
export const picturesOf = (levelId) => (PICTURES[levelId] || []).map(parse);
/** 오늘의 문제: 그 난이도의 그림을 날마다 차례로 */
export function dailyPicture(levelId, day) {
  const list = picturesOf(levelId);
  const p = list[((day % list.length) + list.length) % list.length];
  return { ...p, clues: cluesOf(p.sol, p.w, p.h) };
}
/** 새 문제(연습): 시드로 무늬를 만들고 줄 풀이로 풀리는 것만 */
export function randomPuzzle(seed, levelId) {
  const n = (LEVELS[levelId] || LEVELS.normal).size, rnd = rng(seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    // 덩어리진 무늬: 무작위로 칠한 뒤 이웃이 많은 칸만 남기고(한 번 다듬기), 좌우 대칭으로
    let g = Array.from({ length: n * n }, () => (rnd() < 0.58 ? 1 : 0));
    const nb = (i) => { const x = i % n, y = (i / n) | 0; let c = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) c += g[b * n + a]; } return c; };
    g = g.map((v, i) => (nb(i) >= 3 ? 1 : nb(i) <= 0 ? 0 : v));
    if (rnd() < 0.6) g = g.map((v, i) => { const x = i % n, y = (i / n) | 0; return x < n / 2 ? v : g[y * n + (n - 1 - x)]; });
    const filled = g.filter(Boolean).length;
    if (filled < n * n * 0.35 || filled > n * n * 0.75) continue;
    const clues = cluesOf(g, n, n);
    if (solveLines(n, n, clues).solved) return { name: '', w: n, h: n, sol: g, clues, attempt };
  }
  return { ...dailyPicture(levelId, seed >>> 0), attempt: -1, bank: true }; // 못 만들면(드묾) 검증된 그림 문제
}

/* ---------------- 힌트 ---------------- */
/** 지금 판에서 다음에 확실히 정할 수 있는 칸과 그 줄 · 이유. 칠한 칸만 정답과 다르게 칠했거나 정답 칸에 X를 했으면 먼저 알린다 */
export function hint(w, h, clues, g, sol) {
  const wrong = [];
  for (let i = 0; i < w * h; i++) if ((g[i] === FILL && !sol[i]) || (g[i] === EMPTY && sol[i])) wrong.push(i);
  if (wrong.length) return { kind: 'wrong', cells: wrong };
  let best = null;
  for (const t of ['r', 'c']) for (let k = 0; k < (t === 'r' ? h : w); k++) {
    const idx = t === 'r' ? [...Array(w).keys()].map((x) => k * w + x) : [...Array(h).keys()].map((y) => y * w + k);
    const cells = idx.map((i) => g[i]), clue = t === 'r' ? clues.rows[k] : clues.cols[k];
    if (!cells.includes(UNKNOWN)) continue;
    const r = lineSolve(cells, clue);
    const fill = [], empty = [];
    idx.forEach((i, q) => { if (g[i] !== UNKNOWN) return; if (r.fill[q] === r.total) fill.push(i); else if (r.fill[q] === 0) empty.push(i); });
    // 칠할 칸을 알려 주는 줄을 먼저, 그다음 비울 칸만 있는 줄
    const score = fill.length * 10 + empty.length;
    if (score && (!best || score > best.score)) best = { kind: 'line', t, k, clue, fill, empty, total: r.total, len: idx.length, score };
  }
  return best;
}
export function explain(h) {
  if (!h) return '';
  if (h.kind === 'wrong') return `빨간 테두리 칸${h.cells.length > 1 ? ` ${h.cells.length}곳` : ''}이 정답과 달라요(칠하면 안 되는 칸을 칠했거나, 칠할 칸에 X를 했어요). 그 칸을 지우고 다시 생각해 보세요.`;
  const line = `${h.k + 1}번째 ${h.t === 'r' ? '가로줄' : '세로줄'}`;
  const c = h.clue.length ? h.clue.join(' · ') : '0';
  const sum = h.clue.reduce((a, b) => a + b, 0) + Math.max(0, h.clue.length - 1);
  const what = [h.fill.length ? `표시한 ${h.fill.length}칸은 칠해야 하고` : '', h.empty.length ? `${h.fill.length ? '' : '표시한 '}${h.empty.length}칸은 비워야(X) 해요` : ''].filter(Boolean).join(', ');
  const tailWhat = what.endsWith('하고') ? what.replace(/하고$/, '해요') : what;
  if (!h.clue.length) return `${line}의 단서는 0이에요. 이 줄에는 칠할 칸이 없으니 모두 비워요.`;
  if (h.total === 1) return `${line}의 단서는 ${c}이에요. 지금 칠한 칸과 X에 맞춰 이 단서를 놓는 방법이 한 가지뿐이라서 ${tailWhat}.`;
  if (sum === h.len) return `${line}의 단서는 ${c}이에요. 묶음 사이 빈칸 한 칸씩까지 더하면 줄 길이와 꼭 같아서, 놓는 방법이 하나로 정해져요. 그래서 ${tailWhat}.`;
  return `${line}의 단서는 ${c}이에요. 지금 칠한 칸과 X에 맞춰 이 단서를 놓을 수 있는 방법은 ${h.total}가지인데, 어느 방법에서나 ${tailWhat}.`;
}
