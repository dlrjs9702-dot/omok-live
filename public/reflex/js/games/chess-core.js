// 체스 규칙 · AI 탐색 (화면과 무관한 순수 로직 — 게임 화면과 AI 워커가 함께 쓴다)
// 판: 64칸 배열, 칸 번호 = 행*8 + 열 (행 0 = 흑 쪽 8랭크, 행 7 = 백 쪽 1랭크)
// 기물: 백 +1 폰, +2 나이트, +3 비숍, +4 룩, +5 퀸, +6 킹 / 흑은 음수
export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const row = (sq) => sq >> 3, col = (sq) => sq & 7;
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function initial() {
  const b = Array(64).fill(0), back = [R, N, B, Q, K, B, N, R];
  for (let c = 0; c < 8; c++) { b[c] = -back[c]; b[8 + c] = -P; b[48 + c] = P; b[56 + c] = back[c]; }
  return { b, turn: 1, castle: { wk: true, wq: true, bk: true, bq: true }, ep: -1, half: 0, full: 1 };
}
export const clone = (st) => ({ b: st.b.slice(), turn: st.turn, castle: { ...st.castle }, ep: st.ep, half: st.half, full: st.full });

/** sq 칸이 side(1 백, -1 흑)에게 공격받고 있는가 */
export function attacked(b, sq, side) {
  const r = row(sq), c = col(sq);
  // 폰 (side 쪽 폰이 sq를 공격: 백 폰은 아래에서 위로 공격)
  const pr = r + (side === 1 ? 1 : -1);
  for (const dc of [-1, 1]) if (on(pr, c + dc) && b[pr * 8 + c + dc] === side * P) return true;
  for (const [dr, dc] of KN) if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === side * N) return true;
  for (const [dr, dc] of KG) if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === side * K) return true;
  for (const [dirs, a, q] of [[DIAG, B, Q], [ORTH, R, Q]]) for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (on(rr, cc)) {
      const v = b[rr * 8 + cc];
      if (v) { if (v === side * a || v === side * q) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}
export const kingSq = (b, side) => b.indexOf(side * K);
export const inCheck = (st, side = st.turn) => attacked(st.b, kingSq(st.b, side), -side);

/** 규칙상 둘 수 있는 수 (킹이 체크당하는 수는 빼고) */
export function moves(st, capturesOnly = false) {
  const out = [], { b, turn: s } = st;
  const add = (from, to, extra) => { const cap = b[to]; if (capturesOnly && !cap && !extra?.ep && !extra?.promo) return; out.push({ from, to, cap: extra?.ep ? -s * P : cap, ...extra }); };
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (!v || Math.sign(v) !== s) continue;
    const t = Math.abs(v), r = row(sq), c = col(sq);
    if (t === P) {
      const dr = s === 1 ? -1 : 1, last = s === 1 ? 0 : 7, start = s === 1 ? 6 : 1;
      const push = (to, extra = {}) => { if (row(to) === last) for (const pr of [Q, R, B, N]) add(sq, to, { ...extra, promo: pr }); else add(sq, to, extra); };
      const f1 = (r + dr) * 8 + c;
      if (on(r + dr, c) && !b[f1]) {
        push(f1);
        const f2 = (r + 2 * dr) * 8 + c;
        if (r === start && !b[f2] && !capturesOnly) add(sq, f2, { dbl: true });
      }
      for (const dc of [-1, 1]) {
        if (!on(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        if (b[to] && Math.sign(b[to]) === -s) push(to);
        else if (to === st.ep) add(sq, to, { ep: true });
      }
    } else if (t === N || t === K) {
      for (const [dr, dc] of t === N ? KN : KG) {
        if (!on(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        if (!b[to] || Math.sign(b[to]) === -s) add(sq, to);
      }
      if (t === K && !capturesOnly) {
        // 캐슬링: 킹·룩이 움직인 적 없고, 사이가 비고, 킹이 체크 중이 아니며 지나가는 칸도 공격받지 않을 때
        const home = s === 1 ? 60 : 4, ck = s === 1 ? st.castle.wk : st.castle.bk, cq = s === 1 ? st.castle.wq : st.castle.bq;
        if (sq === home && (ck || cq) && !attacked(b, home, -s)) {
          if (ck && !b[home + 1] && !b[home + 2] && b[home + 3] === s * R && !attacked(b, home + 1, -s) && !attacked(b, home + 2, -s)) add(sq, home + 2, { castle: 'k' });
          if (cq && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === s * R && !attacked(b, home - 1, -s) && !attacked(b, home - 2, -s)) add(sq, home - 2, { castle: 'q' });
        }
      }
    } else {
      const dirs = t === B ? DIAG : t === R ? ORTH : DIAG.concat(ORTH);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (on(rr, cc)) {
          const to = rr * 8 + cc;
          if (b[to]) { if (Math.sign(b[to]) === -s) add(sq, to); break; }
          add(sq, to);
          rr += dr; cc += dc;
        }
      }
    }
  }
  // 둔 뒤 내 킹이 공격받으면 안 되는 수
  return out.filter((m) => { const u = make(st, m); const ok = !attacked(st.b, kingSq(st.b, s), -s); unmake(st, m, u); return ok; });
}

/** 수 두기 (되돌리기 정보 반환) */
export function make(st, m) {
  const { b } = st, s = st.turn, piece = b[m.from];
  const u = { piece, cap: b[m.to], castle: { ...st.castle }, ep: st.ep, half: st.half, full: st.full, epSq: -1 };
  b[m.to] = m.promo ? s * m.promo : piece; b[m.from] = 0;
  if (m.ep) { u.epSq = m.to + (s === 1 ? 8 : -8); u.epPiece = b[u.epSq]; b[u.epSq] = 0; }
  if (m.castle) {
    const home = s === 1 ? 60 : 4;
    if (m.castle === 'k') { b[home + 1] = b[home + 3]; b[home + 3] = 0; } else { b[home - 1] = b[home - 4]; b[home - 4] = 0; }
  }
  // 캐슬링 권리: 킹·룩이 움직이거나 룩이 잡히면 사라진다
  const cr = st.castle;
  if (Math.abs(piece) === K) { if (s === 1) cr.wk = cr.wq = false; else cr.bk = cr.bq = false; }
  for (const sq of [m.from, m.to]) { if (sq === 63) cr.wk = false; if (sq === 56) cr.wq = false; if (sq === 7) cr.bk = false; if (sq === 0) cr.bq = false; }
  st.ep = m.dbl ? (m.from + m.to) / 2 : -1;
  st.half = Math.abs(piece) === P || u.cap || m.ep ? 0 : st.half + 1;
  if (s === -1) st.full++;
  st.turn = -s;
  return u;
}
export function unmake(st, m, u) {
  const { b } = st, s = -st.turn;
  b[m.from] = u.piece; b[m.to] = u.cap;
  if (m.ep) b[u.epSq] = u.epPiece;
  if (m.castle) {
    const home = s === 1 ? 60 : 4;
    if (m.castle === 'k') { b[home + 3] = b[home + 1]; b[home + 1] = 0; } else { b[home - 4] = b[home - 1]; b[home - 1] = 0; }
  }
  st.castle = u.castle; st.ep = u.ep; st.half = u.half; st.full = u.full; st.turn = s;
}
/** 반복 판정용 국면 키 (기물 배치 + 차례 + 캐슬링 + 앙파상) */
// 같은 국면 판단용 키 (3회 반복). 앙파상 칸은 실제로 합법적인 앙파상 잡기가 있을 때만 넣는다 (FIDE 9.2.3)
// — 예전에는 폰이 두 칸 가기만 하면 넣어서, 잡을 폰이 없어도 다른 국면으로 세어 반복 무승부를 놓쳤다 (최종 검토 C01)
export const posKey = (st) => {
  const ep = st.ep >= 0 && moves(st).some((m) => m.ep) ? st.ep : -1;
  return st.b.join(',') + '|' + st.turn + '|' + +st.castle.wk + +st.castle.wq + +st.castle.bk + +st.castle.bq + '|' + ep;
};

/** 기물이 부족해서 아무도 체크메이트할 수 없는가 (K vs K, K+나이트/비숍 vs K, 같은 색 비숍끼리) */
export function insufficient(b) {
  const pcs = [];
  for (let sq = 0; sq < 64; sq++) if (b[sq] && Math.abs(b[sq]) !== K) pcs.push({ t: Math.abs(b[sq]), sq });
  if (!pcs.length) return true;
  if (pcs.length === 1 && (pcs[0].t === N || pcs[0].t === B)) return true;
  if (pcs.every((p) => p.t === B)) { const clr = new Set(pcs.map((p) => (row(p.sq) + col(p.sq)) & 1)); return clr.size === 1; }
  return false;
}

/* ---------------- 평가 · 탐색 ---------------- */
const VAL = [0, 100, 320, 330, 500, 900, 20000];
// 칸별 가산점 (백 기준, 행 0 = 8랭크). 흑은 뒤집어서 쓴다
const PST = {
  [P]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [N]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KEND = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
/** 둘 차례 입장의 점수 */
export function evaluate(st) {
  const { b } = st;
  let sc = 0, mat = 0;
  for (let sq = 0; sq < 64; sq++) { const v = b[sq]; if (v && Math.abs(v) !== K && Math.abs(v) !== P) mat += VAL[Math.abs(v)]; }
  const endgame = mat <= 2600;
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (!v) continue;
    const t = Math.abs(v), w = v > 0, idx = w ? sq : (7 - row(sq)) * 8 + col(sq);
    const pst = t === K && endgame ? KEND[idx] : PST[t][idx];
    sc += (w ? 1 : -1) * (VAL[t] + pst);
  }
  return sc * st.turn;
}
const MATE = 1e6;
const order = (ms) => ms.sort((a, b2) => (b2.cap ? VAL[Math.abs(b2.cap)] * 10 - VAL[1] : 0) + (b2.promo ? 800 : 0) - ((a.cap ? VAL[Math.abs(a.cap)] * 10 - VAL[1] : 0) + (a.promo ? 800 : 0)));
let deadline = Infinity, nodes = 0;
const TIMEOUT = {};
function quiesce(st, a, bt, qd = 0) {
  if ((++nodes & 2047) === 0 && performance.now() > deadline) throw TIMEOUT;
  const stand = evaluate(st);
  if (stand >= bt) return stand;
  if (stand > a) a = stand;
  if (qd > 6) return stand;
  for (const m of order(moves(st, true))) {
    const u = make(st, m);
    const v = -quiesce(st, -bt, -a, qd + 1);
    unmake(st, m, u);
    if (v >= bt) return v;
    if (v > a) a = v;
  }
  return a;
}
function negamax(st, depth, a, bt, ply) {
  if ((++nodes & 2047) === 0 && performance.now() > deadline) throw TIMEOUT;
  if (st.half >= 100) return 0;
  const ms = moves(st);
  if (!ms.length) return inCheck(st) ? -MATE + ply : 0;
  if (depth <= 0) return quiesce(st, a, bt);
  let best = -Infinity;
  for (const m of order(ms)) {
    const u = make(st, m);
    const v = -negamax(st, depth - 1, -bt, -a, ply + 1);
    unmake(st, m, u);
    if (v > best) best = v;
    if (v > a) a = v;
    if (a >= bt) break;
  }
  return best;
}
/**
 * 가장 좋은 수 찾기 (시간 안에서 한 수씩 깊게)
 * @param {{maxDepth:number, ms:number, noise:number}} o noise: 점수에 섞는 흔들림(약한 AI)
 */
export function search(st0, o) {
  const st = clone(st0);
  let ms = order(moves(st));
  if (!ms.length) return null;
  deadline = performance.now() + o.ms; nodes = 0;
  let best = ms[0], scored = null;
  try {
    for (let d = 1; d <= o.maxDepth; d++) {
      const cur = [];
      let a = -Infinity;
      for (const m of ms) {
        const u = make(st, m);
        const v = -negamax(st, d - 1, -Infinity, o.noise ? Infinity : -a, 1);
        unmake(st, m, u);
        cur.push({ m, v });
        if (v > a) a = v;
      }
      cur.sort((x, y) => y.v - x.v);
      scored = cur; ms = cur.map((x) => x.m); best = ms[0];
      if (Math.abs(cur[0].v) > MATE / 2) break;
    }
  } catch (e) { if (e !== TIMEOUT) throw e; }
  deadline = Infinity;
  if (o.noise && scored) {
    let pick = scored[0], bv = -Infinity;
    for (const x of scored) { const v = x.v + (Math.random() - 0.5) * o.noise; if (v > bv) { bv = v; pick = x; } }
    return pick.m;
  }
  return best;
}

/** FEN 문자열 → 국면 (테스트 · 퍼즐용) */
export function fromFEN(fen) {
  const [pos, turn, cas, ep, half, full] = fen.split(' '), b = Array(64).fill(0), T = { p: P, n: N, b: B, r: R, q: Q, k: K };
  let sq = 0;
  for (const ch of pos) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) { sq += +ch; continue; }
    const t = T[ch.toLowerCase()];
    b[sq++] = ch === ch.toUpperCase() ? t : -t;
  }
  const epSq = ep && ep !== '-' ? (8 - +ep[1]) * 8 + (ep.charCodeAt(0) - 97) : -1;
  return { b, turn: turn === 'w' ? 1 : -1, castle: { wk: cas.includes('K'), wq: cas.includes('Q'), bk: cas.includes('k'), bq: cas.includes('q') }, ep: epSq, half: +half || 0, full: +full || 1 };
}
export function perft(st, d) {
  if (!d) return 1;
  let n = 0;
  for (const m of moves(st)) { const u = make(st, m); n += perft(st, d - 1); unmake(st, m, u); }
  return n;
}
