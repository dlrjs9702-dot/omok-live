import { E } from '../engine.js';
import * as NG from './nonogram-core.js';
import * as K from './puzzle-kit.js';
import { dayIndex } from './pz-util.js';

// 네모로직 — 줄 옆 숫자(이어 칠한 칸 묶음의 길이)를 보고 칸을 칠해 그림을 완성 (규칙 · 문제 · 힌트는 nonogram-core.js)
let s, genId = 0;
const { UNKNOWN, FILL, EMPTY } = NG;
const GOLD = '#FFD34D', RED = '#FF5A79';

export default {
  id: 'nonogram', name: '네모로직', cat: 'puzzle',
  color: '#2EC4B6', c2: '#167A72', c3: '#0E2B2A',
  tagline: '숫자 단서로 칸을 칠해 숨은 그림을 완성하세요',
  howto: [['grid', '줄 옆의 숫자는 그 줄에서 이어 칠한 칸 묶음의 길이예요. 묶음 사이는 한 칸 이상 비어요'], ['drag', '칸을 눌러 칠하고, 끌면 한 줄을 이어 칠해요. X 표시로 빈칸을 적어 둘 수 있어요'], ['info', '힌트는 어느 줄의 단서로 어떤 칸이 정해지는지 알려 줘요 (1번마다 +30초)']],
  unit: 'sec', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, defaultLevel: 'easy', levelTitle: '판 크기',
  levelNames: { easy: '5×5', normal: '10×10', hard: '15×15' },
  levelNote: '오늘의 문제는 직접 그린 그림이에요 · 판 크기마다 기록과 랭킹이 따로예요',
  rankRule: K.RANK_RULE,
  options: [K.MODE_OPTION],

  init() {
    const sess = K.session('nonogram'), my = ++genId;
    s = { sess, ready: false, over: false, time: 0, hints: 0, mode: FILL, undo: [], drag: null, hint: null, panel: null, saveT: 0 };
    // 오늘의 문제 = 그림 목록을 날마다 차례로 · 새 문제 = 무늬를 만들어 줄 풀이로 풀리는 것만
    const p = sess.daily ? NG.dailyPicture(sess.level, dayIndex(sess.date)) : NG.randomPuzzle(sess.seed, sess.level);
    if (my !== genId || !p) return;
    Object.assign(s, { w: p.w, h: p.h, sol: p.sol, clues: p.clues, name: p.name, g: Array(p.w * p.h).fill(UNKNOWN) });
    const saved = sess.load();
    if (saved?.g?.length === s.g.length) { s.g = saved.g; s.time = saved.time || 0; s.hints = saved.hints || 0; E.banner('푸는 중이던 오늘의 문제를 이어서 풀어요 (시간도 이어져요)', 'info', 2600); }
    s.ready = true;
    this.layout();
  },
  layout() {
    if (!s.ready) return;
    const rowLen = Math.max(1, ...s.clues.rows.map((r) => r.length || 1)), colLen = Math.max(1, ...s.clues.cols.map((r) => r.length || 1));
    const top = E.top + 4, availW = Math.min(E.W - 16, 620), availH = E.bottom - top - 64;
    const cell = Math.min(46, availW / (s.w + rowLen * 0.62), availH / (s.h + colLen * 0.58));
    s.cell = cell; s.rw = rowLen * cell * 0.62; s.ch = colLen * cell * 0.58;
    const total = s.rw + s.w * cell;
    s.gx = Math.round((E.W - total) / 2 + s.rw); s.gy = Math.round(top + s.ch);
    const by = s.gy + s.h * cell + 12, bw = Math.min(E.W - 16, 520), bx = (E.W - bw) / 2, gap = 6;
    s.modeBtn = { x: bx, y: by, w: bw * 0.44, h: 44 };
    s.undoBtn = { x: bx + bw * 0.44 + gap, y: by, w: bw * 0.26 - gap, h: 44 };
    s.hintBtn = { x: bx + bw * 0.7 + gap, y: by, w: bw * 0.3 - gap, h: 44 };
  },
  save() { s.sess.save({ g: s.g, time: s.time, hints: s.hints }); s.saveT = 0; },
  cellAt(x, y) {
    const cx = Math.floor((x - s.gx) / s.cell), cy = Math.floor((y - s.gy) / s.cell);
    return x >= s.gx && y >= s.gy && cx < s.w && cy < s.h ? cy * s.w + cx : -1;
  },

  down(x, y, id) {
    if (!s.ready || s.over) return;
    if (s.panel) { s.panel = null; if (K.inRect(s.panelRect, x, y)) return; }
    if (K.inRect(s.modeBtn, x, y)) { s.mode = s.mode === FILL ? EMPTY : FILL; E.sfx.ui(); return; }
    if (K.inRect(s.undoBtn, x, y)) return this.undo();
    if (K.inRect(s.hintBtn, x, y)) return this.doHint();
    const i = this.cellAt(x, y);
    if (i < 0) return;
    // 누른 칸의 지금 상태로 이번 획에서 칠할 값을 정한다 (같은 값이면 지우기)
    const to = s.g[i] === s.mode ? UNKNOWN : s.mode;
    s.drag = { id, start: i, axis: null, to, rec: [] };
    this.paint(i);
  },
  move(x, y, dx, dy, id) {
    const d = s.drag;
    if (!d || d.id !== id) return;
    const i = this.cellAt(x, y);
    if (i < 0 || i === d.start && !d.axis) return;
    const sx = d.start % s.w, sy = (d.start / s.w) | 0, cx = i % s.w, cy = (i / s.w) | 0;
    d.axis ||= Math.abs(cx - sx) >= Math.abs(cy - sy) ? 'x' : 'y';
    // 처음 움직인 방향의 한 줄만 칠한다 (시작 칸부터 손가락까지)
    const [a, b] = d.axis === 'x' ? [sx, cx] : [sy, cy];
    for (let k = Math.min(a, b); k <= Math.max(a, b); k++) this.paint(d.axis === 'x' ? sy * s.w + k : k * s.w + sx);
  },
  up(x, y, id) {
    const d = s.drag;
    if (!d || d.id !== id) return;
    s.drag = null;
    if (d.rec.length) { s.undo.push(d.rec); this.after(); }
  },
  paint(i) {
    const d = s.drag;
    if (!d || s.g[i] === d.to || d.rec.some(([j]) => j === i)) return;
    // 지우기 획이 아니면 이미 다른 값(칠함 ↔ X)인 칸은 건드리지 않는다
    if (d.to !== UNKNOWN && s.g[i] !== UNKNOWN) return;
    if (d.to === UNKNOWN && s.g[i] !== s.mode) return;
    d.rec.push([i, s.g[i]]); s.g[i] = d.to; s.hl = null;
    E.sfx.tap(); E.haptic('light');
  },
  undo() {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시 (키 입력 포함)
    const rec = s.undo.pop();
    if (!rec) return;
    for (const [i, v] of rec) s.g[i] = v;
    E.sfx.ui(); this.save();
  },
  doHint() {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시 (키 입력 포함)
    const h = NG.hint(s.w, s.h, s.clues, s.g, s.sol);
    if (!h) return;
    s.hints++; s.hint = h; s.text = NG.explain(h); s.panel = true; s.hl = h;
    E.sfx.ui(); this.save();
  },
  lineOk(t, k) {
    const idx = t === 'r' ? [...Array(s.w).keys()].map((x) => k * s.w + x) : [...Array(s.h).keys()].map((y) => y * s.w + k);
    const got = NG.clueOf(idx.map((i) => (s.g[i] === FILL ? 1 : 0))), want = t === 'r' ? s.clues.rows[k] : s.clues.cols[k];
    return got.length === want.length && got.every((v, q) => v === want[q]);
  },
  after() {
    this.save();
    for (let k = 0; k < s.h; k++) if (!this.lineOk('r', k)) return;
    for (let k = 0; k < s.w; k++) if (!this.lineOk('c', k)) return;
    s.over = true;
    const sol = s.g.map((v) => (v === FILL ? 1 : 0));
    for (let i = 0; i < s.g.length; i++) if (s.g[i] !== FILL) s.g[i] = EMPTY;
    E.sfx.win(); E.haptic('success');
    K.finish(s.sess, { time: s.time, hints: s.hints, sol, name: s.sess.daily ? s.name : '', stats: [['판', `${s.w}×${s.h}`]] });
  },

  update(dt) {
    if (!s.ready) return;
    if (!s.over) { s.time += dt; s.saveT += dt; if (s.saveT > 3) this.save(); }
    K.hud(s.sess, s.time, s.hints);
  },

  draw(c) {
    if (!s.ready) { K.loading(c); return; }
    const { cell, gx, gy, w, h } = s, fs = Math.max(9, Math.min(17, cell * 0.5));
    c.fillStyle = '#141A2E'; E.rr(gx - s.rw - 6, gy - s.ch - 6, s.rw + w * cell + 12, s.ch + h * cell + 12, 12); c.fill();
    const hlLine = s.hl?.kind === 'line' ? s.hl : null;
    // 단서: 맞춘 줄은 흐리게, 힌트 줄은 금색
    for (let k = 0; k < h; k++) {
      const cl = s.clues.rows[k].length ? s.clues.rows[k] : [0], ok = this.lineOk('r', k), hot = hlLine?.t === 'r' && hlLine.k === k;
      if (hot) { c.fillStyle = 'rgba(255,211,77,.16)'; c.fillRect(gx - s.rw, gy + k * cell, s.rw + w * cell, cell); }
      const step = Math.min(cell * 0.62, s.rw / cl.length); // 오른쪽(판 쪽)으로 붙여 쓴다
      cl.forEach((v, q) => E.text(String(v), gx - 4 - (cl.length - q - 0.5) * step, gy + (k + 0.5) * cell + 1, fs, hot ? GOLD : ok ? 'rgba(255,255,255,.3)' : '#E6EBFA', 800));
    }
    for (let k = 0; k < w; k++) {
      const cl = s.clues.cols[k].length ? s.clues.cols[k] : [0], ok = this.lineOk('c', k), hot = hlLine?.t === 'c' && hlLine.k === k;
      if (hot) { c.fillStyle = 'rgba(255,211,77,.16)'; c.fillRect(gx + k * cell, gy - s.ch, cell, s.ch + h * cell); }
      const step = Math.min(cell * 0.58, s.ch / cl.length);
      cl.forEach((v, q) => E.text(String(v), gx + (k + 0.5) * cell, gy - (cl.length - q - 0.5) * step, fs, hot ? GOLD : ok ? 'rgba(255,255,255,.3)' : '#E6EBFA', 800));
    }
    // 칸
    for (let i = 0; i < w * h; i++) {
      const x = gx + (i % w) * cell, y = gy + ((i / w) | 0) * cell, v = s.g[i];
      c.fillStyle = v === FILL ? (s.over ? '#5FE3D5' : '#E8EEFF') : ((((i % w) / 5) | 0) + (((i / w) / 5) | 0)) % 2 ? '#1E2644' : '#232C4E';
      c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (v === EMPTY && !s.over) { c.strokeStyle = 'rgba(160,170,210,.55)'; c.lineWidth = Math.max(1.2, cell * 0.06); c.beginPath(); c.moveTo(x + cell * 0.3, y + cell * 0.3); c.lineTo(x + cell * 0.7, y + cell * 0.7); c.moveTo(x + cell * 0.7, y + cell * 0.3); c.lineTo(x + cell * 0.3, y + cell * 0.7); c.stroke(); }
    }
    // 5칸마다 굵은 선
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.6; c.beginPath();
    for (let k = 0; k <= w; k += 5) { c.moveTo(gx + k * cell, gy); c.lineTo(gx + k * cell, gy + h * cell); }
    for (let k = 0; k <= h; k += 5) { c.moveTo(gx, gy + k * cell); c.lineTo(gx + w * cell, gy + k * cell); }
    c.stroke();
    // 힌트 칸 표시
    if (s.hl?.kind === 'line') {
      c.lineWidth = 3;
      for (const i of s.hl.fill) { c.strokeStyle = GOLD; E.rr(gx + (i % w) * cell + 2, gy + ((i / w) | 0) * cell + 2, cell - 4, cell - 4, 5); c.stroke(); }
      for (const i of s.hl.empty) { c.strokeStyle = 'rgba(255,211,77,.7)'; c.setLineDash([4, 3]); E.rr(gx + (i % w) * cell + 3, gy + ((i / w) | 0) * cell + 3, cell - 6, cell - 6, 5); c.stroke(); c.setLineDash([]); }
    }
    for (const i of s.hl?.kind === 'wrong' ? s.hl.cells : []) { c.strokeStyle = RED; c.lineWidth = 3; E.rr(gx + (i % w) * cell + 2, gy + ((i / w) | 0) * cell + 2, cell - 4, cell - 4, 5); c.stroke(); }
    // 버튼
    const m = s.modeBtn, half = m.w / 2;
    c.fillStyle = 'rgba(255,255,255,.07)'; E.rr(m.x, m.y, m.w, m.h, m.h / 2); c.fill();
    c.fillStyle = s.mode === FILL ? '#2EC4B6' : '#8A93B8'; E.rr(m.x + (s.mode === FILL ? 0 : half) + 3, m.y + 3, half - 6, m.h - 6, (m.h - 6) / 2); c.fill();
    E.text('칠하기', m.x + half / 2, m.y + m.h / 2 + 1, 14.5, s.mode === FILL ? '#fff' : 'rgba(255,255,255,.5)', 800);
    E.text('X 표시', m.x + half * 1.5, m.y + m.h / 2 + 1, 14.5, s.mode === EMPTY ? '#fff' : 'rgba(255,255,255,.5)', 800);
    K.button(c, s.undoBtn, '되돌리기', { size: 14 });
    K.button(c, s.hintBtn, `힌트 +${K.HINT_SEC}초`, { size: 14 });
    if (s.panel && s.text) s.panelRect = K.panel(c, s.hint?.kind === 'wrong' ? '틀린 칸이 있어요' : '힌트', s.text, { color: s.hint?.kind === 'wrong' ? RED : GOLD });
  },
};
