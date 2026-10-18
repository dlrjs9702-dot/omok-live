import { E } from '../engine.js';
import * as CI from './circuit-core.js';
import * as K from './puzzle-kit.js';

// 회로 연결 — 칸을 돌려 모든 칸을 가운데 전원과 하나의 회로로 잇기 (규칙 · 문제 · 힌트는 circuit-core.js)
let s, genId = 0;
const GOLD = '#FFD34D', LIT = '#4FE3FF', DIM = '#5D6A92', HOLD = 0.38;

export default {
  id: 'circuit', name: '회로 연결', cat: 'puzzle',
  color: '#35C8FF', c2: '#1F6FB2', c3: '#0B1F33',
  tagline: '칸을 돌려 모든 칸에 전기가 흐르게 이으세요',
  howto: [['rotate', '칸을 누르면 시계 방향으로 90도씩 돌아가요. 길게 누르면 잠가서 실수로 돌리지 않게 해요'], ['bolt', '가운데 전원과 이어진 칸에 불이 들어와요. 모든 칸에 불이 들어오면 완성'], ['grid', '선이 판 밖으로 나가거나 고리(동그랗게 도는 길)가 생기면 안 돼요']],
  unit: 'sec', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, defaultLevel: 'easy', levelTitle: '판 크기',
  levelNames: { easy: '5×5', normal: '7×7', hard: '9×9' },
  levelNote: '최소 회전 수(정답까지 꼭 필요한 회전)도 함께 보여 줘요 · 판 크기마다 기록과 랭킹이 따로예요',
  rankRule: K.RANK_RULE,
  options: [K.MODE_OPTION],

  init() {
    const sess = K.session('circuit'), my = ++genId;
    s = { sess, ready: false, over: false, time: 0, hints: 0, turns: 0, undo: [], press: null, anim: {}, lock: new Set(), hint: null, panel: null, saveT: 0 };
    K.makePuzzle(sess, 'circuit', CI.generate, (P) => {
      if (my !== genId || !P) return;
      s.P = P; s.m = P.masks.slice();
      const saved = sess.load();
      if (saved?.m?.length === s.m.length && saved.m.every((v, i) => CI.turnsTo(P.masks[i], v) >= 0)) {
        s.m = saved.m; s.time = saved.time || 0; s.hints = saved.hints || 0; s.turns = saved.turns || 0; s.lock = new Set(saved.lock || []);
        E.banner('푸는 중이던 오늘의 문제를 이어서 풀어요 (시간도 이어져요)', 'info', 2600);
      }
      s.lit = CI.lit(P.w, P.h, s.m);
      s.ready = true;
      this.layout();
    });
  },
  layout() {
    if (!s.ready) return;
    const { w, h } = s.P, top = E.top + 6, availW = Math.min(E.W - 16, E.W > 900 ? 860 : 560), availH = E.bottom - top - 66;
    s.cell = Math.min(68, availW / w, availH / h);
    s.ox = Math.round((E.W - w * s.cell) / 2); s.oy = top;
    const by = top + h * s.cell + 12, bw = Math.min(E.W - 16, 460), bx = (E.W - bw) / 2, gap = 6;
    s.undoBtn = { x: bx, y: by, w: bw / 2 - gap / 2, h: 44 };
    s.hintBtn = { x: bx + bw / 2 + gap / 2, y: by, w: bw / 2 - gap / 2, h: 44 };
  },
  save() { s.sess.save({ m: s.m, time: s.time, hints: s.hints, turns: s.turns, lock: [...s.lock] }); s.saveT = 0; },
  tileAt(x, y) {
    const cx = Math.floor((x - s.ox) / s.cell), cy = Math.floor((y - s.oy) / s.cell);
    return x >= s.ox && y >= s.oy && cx < s.P.w && cy < s.P.h ? cy * s.P.w + cx : -1;
  },
  turn(i, n = 1, record = true) {
    s.m[i] = CI.rotN(s.m[i], n);
    s.anim[i] = (s.anim[i] || 0) - 90 * (n === 3 ? -1 : n);
    if (record) { s.undo.push(i); s.turns++; }
    s.lit = CI.lit(s.P.w, s.P.h, s.m); s.hl = null;
  },

  down(x, y, id) {
    if (!s.ready || s.over) return;
    if (s.panel) { s.panel = null; if (K.inRect(s.panelRect, x, y)) return; }
    if (K.inRect(s.undoBtn, x, y)) return this.undoOne();
    if (K.inRect(s.hintBtn, x, y)) return this.doHint();
    const i = this.tileAt(x, y);
    if (i >= 0) s.press = { id, i, t: 0, fired: false, x, y };
  },
  move(x, y, dx, dy, id) { if (s.press?.id === id && Math.hypot(x - s.press.x, y - s.press.y) > s.cell * 0.4) s.press = null; },
  up(x, y, id) {
    const p = s.press;
    if (!p || p.id !== id) return;
    s.press = null;
    if (p.fired) return;
    if (s.lock.has(p.i)) { E.banner('잠근 칸이에요 (길게 누르면 풀려요)', 'lock', 1200); E.sfx.wrong(); return; }
    this.turn(p.i);
    E.sfx.rotate(); E.haptic('light');
    this.after();
  },
  key(k) { if (!s.ready || s.over) return; if (k === 'z') this.undoOne(); else if (k === 'h') this.doHint(); },
  undoOne() {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시 (키 입력 포함)
    const i = s.undo.pop();
    if (i == null) return;
    this.turn(i, 3, false); s.turns = Math.max(0, s.turns - 1);
    E.sfx.ui(); this.save();
  },
  doHint() {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시 (키 입력 포함)
    const h = CI.hint(s.P, s.m);
    if (!h) return;
    s.hints++; s.hint = h; s.text = CI.explain(s.P, h); s.panel = true; s.hl = h;
    s.lock.delete(h.i);
    E.sfx.ui(); this.save();
  },
  after() {
    this.save();
    if (s.lit.size !== s.P.w * s.P.h) return;
    s.over = true; E.sfx.win(); E.haptic('success');
    K.finish(s.sess, { time: s.time, hints: s.hints, sol: s.m, stats: [['회전', `${s.turns}번 (최소 ${s.P.par}번)`]] });
  },

  update(dt) {
    if (!s.ready) return;
    if (!s.over) { s.time += dt; s.saveT += dt; if (s.saveT > 3) this.save(); }
    if (s.press && !s.press.fired) {
      s.press.t += dt;
      if (s.press.t >= HOLD) {
        s.press.fired = true;
        const i = s.press.i;
        if (s.lock.has(i)) s.lock.delete(i); else s.lock.add(i);
        E.sfx.tap(); E.haptic('medium'); this.save();
      }
    }
    for (const k in s.anim) { s.anim[k] *= Math.pow(1e-6, dt); if (Math.abs(s.anim[k]) < 0.5) delete s.anim[k]; }
    E.hud({ center: K.fmtT(s.time + s.hints * K.HINT_SEC), right: `${s.sess.label} · 회전 ${s.turns}/${s.P.par}${s.hints ? ` · 힌트 ${s.hints}` : ''}` });
  },

  draw(c) {
    if (!s.ready) { K.loading(c); return; }
    const { P, cell } = s, hub = CI.hubOf(P.w, P.h);
    c.fillStyle = '#0F1A2C'; E.rr(s.ox - 6, s.oy - 6, P.w * cell + 12, P.h * cell + 12, 14); c.fill();
    const arms = (cx, cy, m, color, wdt) => {
      c.strokeStyle = color; c.lineWidth = wdt; c.lineCap = 'round';
      c.beginPath();
      for (const [b, dx, dy] of [[CI.U, 0, -1], [CI.R, 1, 0], [CI.D, 0, 1], [CI.L, -1, 0]]) if (m & b) { c.moveTo(cx, cy); c.lineTo(cx + dx * cell / 2, cy + dy * cell / 2); }
      c.stroke();
    };
    for (let i = 0; i < P.w * P.h; i++) {
      const x = s.ox + (i % P.w) * cell, y = s.oy + ((i / P.w) | 0) * cell, cx = x + cell / 2, cy = y + cell / 2;
      const on = s.lit.has(i), locked = s.lock.has(i), pressed = s.press?.i === i;
      c.fillStyle = locked ? '#26304E' : pressed ? '#1F2C4A' : '#17223A';
      E.rr(x + 1.5, y + 1.5, cell - 3, cell - 3, 7); c.fill();
      c.save(); c.translate(cx, cy); if (s.anim[i]) c.rotate((s.anim[i] * Math.PI) / 180); c.translate(-cx, -cy);
      const col = on ? (s.over ? '#7DFFB0' : LIT) : DIM, wdt = Math.max(4, cell * 0.17);
      if (on) { c.globalAlpha = 0.25; arms(cx, cy, s.m[i], col, wdt * 2.1); c.globalAlpha = 1; }
      arms(cx, cy, s.m[i], col, wdt);
      c.restore();
      const deg = (s.m[i] & 1) + ((s.m[i] >> 1) & 1) + ((s.m[i] >> 2) & 1) + ((s.m[i] >> 3) & 1);
      if (i === hub) {
        c.fillStyle = on ? '#FFE45C' : '#B9A23B'; c.beginPath(); c.arc(cx, cy, cell * 0.24, 0, 6.283); c.fill();
        E.text('⚡', cx, cy + 1, cell * 0.28, '#3A2A00', 900);
      } else if (deg === 1) { // 끝 칸(전구)
        c.fillStyle = on ? '#E9FBFF' : '#3A4566'; c.beginPath(); c.arc(cx, cy, cell * 0.16, 0, 6.283); c.fill();
        c.strokeStyle = on ? LIT : DIM; c.lineWidth = 2; c.stroke();
      }
      if (locked) E.text('🔒', x + cell - 10, y + 11, 10, '#fff', 700);
      if (pressed && !s.press.fired && s.press.t > 0.1) { c.strokeStyle = GOLD; c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, cell * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.min(1, s.press.t / HOLD) * Math.PI * 2); c.stroke(); }
    }
    if (s.hl?.kind === 'tile') {
      const i = s.hl.i, x = s.ox + (i % P.w) * cell, y = s.oy + ((i / P.w) | 0) * cell;
      c.strokeStyle = GOLD; c.lineWidth = 3; E.rr(x + 2, y + 2, cell - 4, cell - 4, 8); c.stroke();
      c.globalAlpha = 0.5; arms(x + cell / 2, y + cell / 2, s.hl.m, GOLD, Math.max(3, cell * 0.09)); c.globalAlpha = 1;
    }
    K.button(c, s.undoBtn, '되돌리기', { size: 14 });
    K.button(c, s.hintBtn, `힌트 +${K.HINT_SEC}초`, { size: 14 });
    if (s.panel && s.text) s.panelRect = K.panel(c, '힌트', s.text, { color: GOLD });
  },
};
