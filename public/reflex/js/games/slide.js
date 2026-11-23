import { E } from '../engine.js';

// 숫자 밀기 (슬라이드 퍼즐) — 빈칸 옆(같은 줄 · 같은 열)의 숫자를 밀어 1부터 차례대로 맞춘다 · 빠를수록 좋은 기록
// · 섞기: 맞춘 판에서 빈칸을 무작위로 움직여 섞으므로 언제나 풀 수 있다 (바로 되돌아가는 움직임은 빼서 고르게 섞음)
// · 같은 줄(열)의 숫자를 누르면 그 사이 숫자가 한꺼번에 밀린다 (한 번 = 1수) · 키보드 방향키도 된다
// · 판이 뜨고 3초 뒤부터 시간이 흐른다 (그동안 판을 볼 수 있음 · 모두에게 같은 조건)
let s, N = 4;
const SIZE = { easy: 3, normal: 4, hard: 5 };
const READY = 3;

export default {
  id: 'slide', name: '숫자 밀기', cat: 'puzzle',
  color: '#F59E42', c2: '#D9480F', c3: '#5C1A00',
  tagline: '숫자 판을 밀어 1부터 차례대로 맞추세요',
  howto: [['tap', '빈칸과 같은 줄에 있는 숫자를 탭하면 빈칸 쪽으로 밀려요 (여러 칸도 한 번에)'], ['grid', '1부터 차례대로 맞추고 오른쪽 아래를 비우면 완성'], ['clock', '판이 뜨고 3초 뒤부터 시간이 흘러요. 빠를수록 좋은 기록']],
  unit: 'sec', lowerBetter: true,
  hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, levelTitle: '판 크기', defaultLevel: 'normal',
  levelNames: { easy: '3×3', normal: '4×4', hard: '5×5' },
  levelNote: '3×3: 1~8 · 4×4: 1~15 · 5×5: 1~24 — 판 크기마다 최고 기록과 랭킹이 따로예요',
  bg: '#160B05',

  get _s() { return s; }, // 자동 테스트용
  init() {
    N = SIZE[E.level] || 4;
    s = { N, b: this.shuffled(N), moves: 0, time: 0, prep: READY, started: false, anim: {}, done: false };
    this.layout();
    this.hud();
  },
  /** 빈칸(0)을 무작위로 움직여 섞은 판 (언제나 풀림 · 이미 맞은 칸이 너무 많으면 다시) */
  shuffled(n) {
    const b = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
    let z = n * n - 1, prev = -1;
    for (let k = 0; k < n * n * 40 || this.solvedCount(b, n) > n; k++) {
      const r = Math.floor(z / n), c = z % n, opts = [];
      if (r > 0) opts.push(z - n); if (r < n - 1) opts.push(z + n); if (c > 0) opts.push(z - 1); if (c < n - 1) opts.push(z + 1);
      const ok = opts.filter((o) => o !== prev), j = ok[Math.floor(Math.random() * ok.length)];
      b[z] = b[j]; b[j] = 0; prev = z; z = j;
    }
    return b;
  },
  solvedCount(b, n) { let k = 0; for (let i = 0; i < n * n - 1; i++) if (b[i] === i + 1) k++; return k; },
  layout() {
    const size = Math.min(E.W - 28, E.bottom - E.top - 90, 480);
    s.size = size; s.cell = size / N;
    s.ox = (E.W - size) / 2; s.oy = E.top + (E.bottom - E.top - size) / 2;
  },
  hud() { E.hud({ center: s.started ? s.time.toFixed(1) : `준비 ${Math.ceil(s.prep)}`, right: `${s.moves}수` }); },

  /** 칸 i의 숫자를 빈칸 쪽으로 민다 (같은 줄 · 같은 열일 때만) → 움직였으면 true */
  push(i) {
    if (!s.started || s.done) return false;
    const b = s.b, z = b.indexOf(0), zr = Math.floor(z / N), zc = z % N, r = Math.floor(i / N), c = i % N;
    if (i === z || (r !== zr && c !== zc)) return false;
    const step = r === zr ? (c < zc ? -1 : 1) : (r < zr ? -N : N);
    for (let k = z; k !== i; k += step) { b[k] = b[k + step]; b[k + step] = 0; s.anim[k] = { from: k + step, t: 0 }; }
    s.moves++;
    E.acted?.(); /* (게임 아일랜드: our engine has no E.acted) */ // 첫 조작 (점수가 없는 게임)
    E.sfx.tap(); E.haptic('light');
    if (this.solvedCount(b, N) === N * N - 1) {
      s.done = true;
      const ms = Math.round(s.time * 1000);
      E.sfx.win(); E.haptic('success');
      E.burst(E.W / 2, s.oy + s.size / 2, '#FFC078', 30, 340);
      E.end(null, { score: ms, delay: 0.7, stats: [['움직인 수', s.moves + '수'], ['판', `${N}×${N}`]] });
    }
    this.hud();
    return true;
  },
  down(x, y) {
    const c = Math.floor((x - s.ox) / s.cell), r = Math.floor((y - s.oy) / s.cell);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    if (!this.push(r * N + c) && s.started && !s.done) E.sfx.wrong();
  },
  key(k) {
    const z = s.b.indexOf(0), zr = Math.floor(z / N), zc = z % N;
    // 방향키: 그쪽으로 숫자를 민다 (← = 빈칸 오른쪽 숫자가 왼쪽으로)
    const map = { ArrowLeft: zc < N - 1 ? z + 1 : -1, ArrowRight: zc > 0 ? z - 1 : -1, ArrowUp: zr < N - 1 ? z + N : -1, ArrowDown: zr > 0 ? z - N : -1 };
    if (map[k] != null && map[k] >= 0) this.push(map[k]);
  },
  update(dt) {
    if (!s.started) {
      const before = Math.ceil(s.prep);
      s.prep -= dt;
      if (s.prep <= 0) { s.started = true; E.sfx.goal(); E.banner('시작!', 'bolt', 700); }
      else if (Math.ceil(s.prep) !== before) E.sfx.tap();
    } else if (!s.done) s.time += dt;
    for (const k in s.anim) { s.anim[k].t += dt / 0.1; if (s.anim[k].t >= 1) delete s.anim[k]; }
    this.hud();
  },
  draw(c) {
    const { cell, ox, oy, size } = s, pad = Math.max(3, cell * 0.05);
    c.fillStyle = '#2A160A'; E.rr(ox - 10, oy - 10, size + 20, size + 20, 18); c.fill();
    for (let i = 0; i < N * N; i++) {
      const v = s.b[i];
      if (!v) continue;
      const a = s.anim[i], k = a ? 1 - Math.pow(1 - a.t, 3) : 1;
      const tx = ox + (i % N) * cell, ty = oy + Math.floor(i / N) * cell;
      const fx = a ? ox + (a.from % N) * cell : tx, fy = a ? oy + Math.floor(a.from / N) * cell : ty;
      const x = fx + (tx - fx) * k, y = fy + (ty - fy) * k, ok = v === i + 1;
      const g = c.createLinearGradient(0, y, 0, y + cell);
      g.addColorStop(0, ok ? '#FFB86B' : '#3B2416'); g.addColorStop(1, ok ? '#E8742A' : '#2C1A10');
      c.fillStyle = g; E.rr(x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.16); c.fill();
      c.strokeStyle = ok ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.1)'; c.lineWidth = 1.5; c.stroke();
      E.text(String(v), x + cell / 2, y + cell / 2 + 1, cell * (N >= 5 ? 0.36 : 0.4), ok ? '#3A1400' : '#FBE3CF', 900);
    }
    if (!s.started) {
      c.globalAlpha = 0.6 + Math.sin(performance.now() / 300) * 0.4;
      E.text(`${Math.ceil(s.prep)}초 뒤 시작 · 판을 살펴보세요`, E.W / 2, oy + size + 34, 15, '#FFC078', 800);
      c.globalAlpha = 1;
    } else if (!s.done) E.text(`맞은 칸 ${this.solvedCount(s.b, N)} / ${N * N - 1}`, E.W / 2, oy + size + 34, 13.5, 'rgba(255,255,255,.65)', 800);
  },
};
