// 로컬 저장소: 기기 설정 + 사용자별 전적
// 서버 연동 시 Stats.record / load 부분만 API 호출로 바꾸면 된다.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
/** 저장 → 성공하면 true (저장 공간이 꽉 찼거나 저장할 수 없는 환경이면 false — 중요한 저장은 결과를 보고 알린다) */
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}
export const storage = { read, write, remove };

/* ---------------- 설정 (기기 단위) ---------------- */
const SETTINGS_KEY = 'gc.settings';
const settings = Object.assign({ sound: true, haptics: true }, read(SETTINGS_KEY, {}));
const listeners = new Set();
export const Settings = {
  get: (k) => settings[k],
  set(k, v) {
    settings[k] = v;
    write(SETTINGS_KEY, settings);
    listeners.forEach((fn) => fn(k, v));
  },
  toggle(k) { this.set(k, !settings[k]); return settings[k]; },
  on: (fn) => listeners.add(fn),
};

/* ---------------- 전적 (사용자 단위) ---------------- */
const blankGame = () => ({ w: 0, d: 0, l: 0, best: null, plays: 0, time: 0, last: 0 });
let uid = 'guest';
let lowerOf = () => false; // 게임 id → 기록이 낮을수록 좋은지 (main.js가 게임 목록으로 정함 · 합칠 때 최고 기록 고르기)
/** 대결 전적(승무패)이 난이도별로 없던 예전 기록은 '보통'으로 본다 (record()와 같은 규칙) */
const lvOf = (g) => g.lv || (g.w + g.d + g.l ? { normal: { w: g.w, d: g.d, l: g.l } } : null);
function mergeGame(id, a, b) {
  const lower = lowerOf(id), better = (x, y) => (x == null ? y ?? null : y == null ? x : lower ? Math.min(x, y) : Math.max(x, y));
  const g = { ...blankGame(), ...a };
  for (const k of ['w', 'd', 'l', 'plays', 'time']) g[k] = (a[k] || 0) + (b[k] || 0);
  g.last = Math.max(a.last || 0, b.last || 0);
  g.best = better(a.best, b.best);
  const la = lvOf(a), lb = lvOf(b);
  if (la || lb) { g.lv = {}; for (const m of [la, lb]) for (const [k, v] of Object.entries(m || {})) { const t = (g.lv[k] ||= { w: 0, d: 0, l: 0 }); t.w += v.w || 0; t.d += v.d || 0; t.l += v.l || 0; } }
  if (a.lvb || b.lvb) { g.lvb = { ...(a.lvb || {}) }; for (const [k, v] of Object.entries(b.lvb || {})) g.lvb[k] = better(g.lvb[k], v); }
  return g;
}
function mergeData(dst, src) {
  const games = { ...dst.games };
  for (const [id, g] of Object.entries(src.games || {})) games[id] = games[id] ? mergeGame(id, games[id], g) : g;
  return { ...dst, games, recent: [...new Set([...(dst.recent || []), ...(src.recent || [])])].slice(0, 8), levels: { ...(src.levels || {}), ...(dst.levels || {}) } };
}
let data = { games: {}, recent: [] };
const key = (id) => 'gc.stats.' + id;

export const Stats = {
  /** 지금 기록을 쓰는 사용자 ('guest' 또는 계정 번호) — 퍼즐의 오늘의 문제 진행 · 기록 여부를 사용자별로 둘 때 */
  get uid() { return uid; },
  load(userId) {
    uid = userId;
    data = read(key(uid), null) || { games: {}, recent: [] };
  },
  save() { write(key(uid), data); },

  game(id) { return data.games[id] || blankGame(); },

  /** 난이도별 승·무·패 */
  lvStats(id, level) {
    const g = this.game(id);
    if (g.lv) return g.lv[level] || { w: 0, d: 0, l: 0 };
    return level === 'normal' ? { w: g.w, d: g.d, l: g.l } : { w: 0, d: 0, l: 0 };
  },

  /** 게임별로 마지막에 고른 난이도 */
  level(id, def = 'normal') { return data.levels?.[id] || def; },
  /** 난이도가 있는 점수 게임의 난이도별 최고 기록 (난이도 도입 전 기록은 legacy 난이도 — 게임의 levelLegacy, 기본 '쉬움' — 로 본다) */
  lvBest(id, level, legacy = 'easy') { const g = this.game(id); return g.lvb ? g.lvb[level] ?? null : level === legacy ? g.best : null; },
  setLevel(id, lv) { (data.levels ||= {})[id] = lv; this.save(); },

  /**
   * 한 판 결과 기록
   * @param {string} id 게임 id
   * @param {{outcome:'win'|'draw'|'loss'|null, score:number|null, duration:number, lowerBetter?:boolean}} r
   */
  record(id, { outcome, score, duration, lowerBetter, level, legacy = 'easy' }) {
    const g = (data.games[id] = Object.assign(blankGame(), data.games[id]));
    const prevBest = g.best;
    // 대결 게임: 난이도별 승·무·패도 따로 쌓는다 (난이도 도입 전 기록은 '보통'으로 이관)
    if (outcome && level) {
      if (!g.lv) g.lv = g.w + g.d + g.l ? { normal: { w: g.w, d: g.d, l: g.l } } : {};
      const L = (g.lv[level] = Object.assign({ w: 0, d: 0, l: 0 }, g.lv[level]));
      L[outcome === 'win' ? 'w' : outcome === 'draw' ? 'd' : 'l']++;
    }
    g.plays++;
    g.time += duration || 0;
    g.last = Date.now();
    // 승·무·패는 1:1 대결 게임만 (점수 게임은 outcome = null)
    if (outcome === 'win') g.w++;
    else if (outcome === 'draw') g.d++;
    else if (outcome === 'loss') g.l++;
    let isBest = false;
    if (!outcome && level && score != null && !Number.isNaN(score)) {
      // 난이도가 있는 점수 게임: 난이도별 최고 기록
      if (!g.lvb) g.lvb = g.best != null ? { [legacy]: g.best } : {};
      const prev = g.lvb[level];
      if (prev == null || (lowerBetter ? score < prev : score > prev)) { g.lvb[level] = score; isBest = prev != null; }
      score = null; // 전체 최고 기록(best)은 건드리지 않는다
    }
    if (score != null && !Number.isNaN(score)) {
      if (g.best == null || (lowerBetter ? score < g.best : score > g.best)) {
        g.best = score;
        isBest = prevBest != null; // 첫 판은 '신기록' 표시 안 함
      }
    }
    data.recent = [id, ...data.recent.filter((x) => x !== id)].slice(0, 8);
    this.save();
    return { isBest, prevBest, entry: g, best: level && !outcome ? g.lvb?.[level] ?? null : g.best };
  },

  /** @param {string[]} [wdlIds] 승·무·패를 합산할 게임 id (1:1 대결 게임) */
  totals(wdlIds) {
    const t = { w: 0, d: 0, l: 0, plays: 0, time: 0, played: 0 };
    for (const [id, g] of Object.entries(data.games)) {
      if (!wdlIds || wdlIds.includes(id)) { t.w += g.w; t.d += g.d; t.l += g.l; }
      t.plays += g.plays; t.time += g.time;
      if (g.plays) t.played++;
    }
    return t;
  },

  recent() { return data.recent.slice(); },

  reset() {
    data = { games: {}, recent: [] };
    this.save();
  },

  /** 합칠 때 최고 기록을 고르는 기준 (게임 id → 낮을수록 좋은지) */
  setLowerBetter(fn) { lowerOf = fn; },
  /** 이 사용자의 기기 기록이 있는지 */
  hasData(userId) { const s = read(key(userId), null); return !!s && Object.keys(s.games || {}).length > 0; },
  /**
   * 게스트 기록을 계정으로 옮김 → 'done'(옮김 · 합침) · 'none'(옮길 것 없음) · 'fail'(쓰지 못함 — 원본은 그대로)
   * 계정에 이미 기록이 있으면(가입 뒤 한 판 등) 지우지 않고 합친다 (승무패 · 판수 · 시간은 더하고 최고 기록은 좋은 쪽)
   * moveId: 이번 이전 번호 — 계정 기록에 함께 적어서, 원본을 지우기 전에 멈췄다 다시 해도 두 번 합치지 않는다
   */
  migrate(fromId, toId, moveId = null) {
    const src = read(key(fromId), null);
    if (!src || !Object.keys(src.games || {}).length) return 'none';
    const dst = read(key(toId), null);
    if (moveId && dst?.moved?.includes(moveId)) { remove(key(fromId)); return 'done'; } // 이미 합친 이전
    const merged = dst && Object.keys(dst.games || {}).length ? mergeData(dst, src) : { ...src };
    if (moveId) merged.moved = [...(dst?.moved || []), moveId].slice(-20);
    if (!write(key(toId), merged)) return 'fail'; // 저장 공간 부족 등: 원본을 지우지 않는다
    remove(key(fromId));
    if (uid === toId) data = merged; // 지금 보고 있는 계정이면 화면 기록도 (예전 것으로 덮어쓰지 않게)
    return 'done';
  },

  drop(userId) { remove(key(userId)); },
};

// 승률: 무승부는 반 승으로 (서버 랭킹과 같은 계산: (승 + 무/2) / 전체)
export function winRate(g) {
  const n = g.w + g.d + g.l;
  return n ? (g.w + g.d / 2) / n : null;
}
