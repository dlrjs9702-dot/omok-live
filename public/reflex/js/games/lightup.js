import { E } from '../engine.js';
import * as LU from './lightup-core.js';
import * as K from './puzzle-kit.js';

// 불빛 채우기 — 흰 칸에 전구를 놓아 모든 칸을 밝히기 (규칙 · 문제 · 힌트는 lightup-core.js · 2026-10-30 GPT 검토서 17장 S01)
// 칸을 누르면 전구 → 점(전구 없음 표시) → 빈칸 순서로 바뀐다
let s, genId = 0;
const GOLD = '#FFD34D', RED = '#FF5A79';

export default {
  id: 'lightup', name: '불빛 채우기', cat: 'puzzle',
  color: '#FFC94D', c2: '#E08A1E', c3: '#3A2400',
  tagline: '전구를 놓아 어두운 칸을 모두 밝히세요',
  howto: [['tap', '흰 칸을 누르면 전구 → 점(전구 없음 표시) → 빈칸 순서로 바뀌어요'], ['sparkle', '전구는 가로 · 세로로 벽에 막힐 때까지 빛을 비춰요. 모든 흰 칸이 밝아지면 완성'], ['grid', '전구끼리 서로 비추면 안 되고, 숫자 벽 바로 옆에는 그 수만큼 전구를 둬요']],
  unit: 'sec', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, defaultLevel: 'easy', levelTitle: '판 크기',
  levelNames: { easy: '7×7', normal: '9×9', hard: '10×10' },
  levelNote: '어려움은 전구를 놓아 보며 따지는 추론이 필요해요 · 판 크기마다 기록과 랭킹이 따로예요',
  rankRule: K.RANK_RULE,
  options: [K.MODE_OPTION],

  get _s() { return s; }, // 자동 테스트용
  init() {
    const sess = K.session('lightup'), my = ++genId;
    s = { sess, ready: false, over: false, time: 0, hints: 0, undo: [], hl: null, panel: null, saveT: 0, glow: 0 };
    K.makePuzzle(sess, 'lightup', LU.generate, (P) => {
      if (my !== genId || !P) return;
      s.P = P; s.cur = P.cells.map(() => 0);
      const saved = sess.load();
      if (saved?.cur?.length === s.cur.length && saved.cur.every((v, i) => (v === 0 || ((v === 1 || v === 2) && P.cells[i] === LU.WHITE)))) {
        s.cur = saved.cur; s.time = saved.time || 0; s.hints = saved.hints || 0;
        E.banner('푸는 중이던 오늘의 문제를 이어서 풀어요 (시간도 이어져요)', 'info', 2600);
      }
      this.recheck();
      s.ready = true;
      this.layout();
    });
  },
  layout() {
    if (!s.ready) return;
    const { w, h } = s.P, top = E.top + 6, availW = Math.min(E.W - 16, 560), availH = E.bottom - top - 66;
    s.cell = Math.min(64, availW / w, availH / h);
    s.ox = Math.round((E.W - w * s.cell) / 2); s.oy = top;
    const by = top + h * s.cell + 12, bw = Math.min(E.W - 16, 460), bx = (E.W - bw) / 2, gap = 6;
    s.undoBtn = { x: bx, y: by, w: bw / 2 - gap / 2, h: 44 };
    s.hintBtn = { x: bx + bw / 2 + gap / 2, y: by, w: bw / 2 - gap / 2, h: 44 };
  },
  bulbs() { return s.cur.map((v) => (v === 1 ? 1 : 0)); },
  recheck() { s.st = LU.check(s.P, this.bulbs()); },
  save() { s.sess.save({ cur: s.cur, time: s.time, hints: s.hints }); s.saveT = 0; },
  cellAt(x, y) {
    const cx = Math.floor((x - s.ox) / s.cell), cy = Math.floor((y - s.oy) / s.cell);
    return x >= s.ox && y >= s.oy && cx < s.P.w && cy < s.P.h ? cy * s.P.w + cx : -1;
  },
  set(i, v, record = true) {
    if (record) s.undo.push([i, s.cur[i]]);
    s.cur[i] = v; s.hl = null;
    this.recheck();
  },

  down(x, y, id) {
    if (!s.ready || s.over) return;
    if (s.panel) { s.panel = null; if (K.inRect(s.panelRect, x, y)) return; }
    if (K.inRect(s.undoBtn, x, y)) return this.undoOne();
    if (K.inRect(s.hintBtn, x, y)) return this.doHint();
    const i = this.cellAt(x, y);
    if (i >= 0 && s.P.cells[i] === LU.WHITE) s.press = { id, i };
  },
  /** 취소(전화 · 알림 · 정지): 누르던 칸을 버린다 — 전구를 놓지 않음 (GPT 게임별 검토 G02 · G09) */
  cancel(id) { if (s.press && (id == null || s.press.id === id)) s.press = null; },
  up(x, y, id) {
    const p = s.press;
    if (!p || p.id !== id) return;
    s.press = null;
    if (this.cellAt(x, y) !== p.i) return; // 다른 칸에서 손을 떼면 없던 일로
    const next = (s.cur[p.i] + 1) % 3;
    this.set(p.i, next);
    if (next === 1) { E.sfx.place?.(); E.haptic('light'); s.glow = 1; E.acted?.(); } else E.sfx.tap(); /* (게임 아일랜드: our engine has no E.acted -- guarded as it came) */
    this.after();
  },
  key(k) { if (!s.ready || s.over) return; if (k === 'z') this.undoOne(); else if (k === 'h') this.doHint(); },
  undoOne() {
    if (!s.ready || s.over) return;
    const u = s.undo.pop();
    if (!u) return;
    this.set(u[0], u[1], false);
    E.sfx.ui(); this.save();
  },
  doHint() {
    if (!s.ready || s.over) return;
    const h = LU.hint(s.P, s.cur);
    if (!h) return;
    s.hints++; s.hl = h; s.text = LU.explain(s.P, h); s.panel = true;
    E.sfx.ui(); this.save();
  },
  after() {
    this.save();
    if (!s.st.done) return;
    s.over = true; E.sfx.win(); E.haptic('success');
    K.finish(s.sess, { time: s.time, hints: s.hints, sol: this.bulbs(), stats: [['전구', `${s.cur.filter((v) => v === 1).length}개`]] });
  },

  update(dt) {
    if (!s.ready) return;
    if (!s.over) { s.time += dt; s.saveT += dt; if (s.saveT > 3) this.save(); }
    s.glow = Math.max(0, s.glow - dt * 3);
    const dark = s.st.dark, total = s.P.cells.filter((v) => v === LU.WHITE).length;
    E.hud({ center: K.fmtT(s.time + s.hints * K.HINT_SEC), right: `${s.sess.label} · 밝힌 칸 ${total - dark}/${total}${s.hints ? ` · 힌트 ${s.hints}` : ''}` });
  },

  draw(c) {
    if (!s.ready) { K.loading(c); return; }
    const { P, cell, st } = s, hl = s.hl, mark = new Set(hl && (hl.kind === 'wrong' || hl.kind === 'wrongDot') ? hl.cells : []);
    c.fillStyle = '#151A30'; E.rr(s.ox - 6, s.oy - 6, P.w * cell + 12, P.h * cell + 12, 14); c.fill();
    for (let i = 0; i < P.cells.length; i++) {
      const x = s.ox + (i % P.w) * cell, y = s.oy + ((i / P.w) | 0) * cell, cx = x + cell / 2, cy = y + cell / 2, v = P.cells[i];
      if (v !== LU.WHITE) { // 벽 (숫자: 맞으면 초록 · 넘치면 빨강)
        c.fillStyle = '#05060D'; E.rr(x + 1.5, y + 1.5, cell - 3, cell - 3, 6); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1; c.stroke();
        if (v >= 0) E.text(String(v), cx, cy + 1, cell * 0.46, st.over.has(i) ? RED : st.short.has(i) ? '#E8E6FF' : '#7DFFB0', 900);
        continue;
      }
      const lit = st.lit[i];
      if (lit) { const g = c.createRadialGradient(cx, cy, cell * 0.1, cx, cy, cell * 0.75); g.addColorStop(0, '#FFF1B8'); g.addColorStop(1, s.over ? '#C9F7C9' : '#F2CF6B'); c.fillStyle = g; }
      else c.fillStyle = '#39416A';
      E.rr(x + 1.5, y + 1.5, cell - 3, cell - 3, 6); c.fill();
      if (s.cur[i] === 1) { // 전구 (서로 비추면 빨강)
        const bad = st.clash.has(i) || mark.has(i), r = cell * 0.27;
        const g = c.createRadialGradient(cx, cy - r * 0.2, r * 0.15, cx, cy, r * 1.6); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.45, bad ? '#FF9AAE' : '#FFE066'); g.addColorStop(1, 'rgba(255,200,60,0)');
        c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 1.6, 0, 6.283); c.fill();
        c.fillStyle = bad ? RED : '#FFC93D'; c.beginPath(); c.arc(cx, cy - r * 0.15, r, 0, 6.283); c.fill();
        c.fillStyle = '#8A6A2A'; E.rr(cx - r * 0.45, cy + r * 0.7, r * 0.9, r * 0.5, 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(cx - r * 0.35, cy - r * 0.5, r * 0.22, 0, 6.283); c.fill();
      } else if (s.cur[i] === 2) { // 점: 전구 없음 표시
        c.fillStyle = mark.has(i) ? RED : lit ? 'rgba(90,70,20,.55)' : '#AEB7D9'; c.beginPath(); c.arc(cx, cy, Math.max(2.5, cell * 0.08), 0, 6.283); c.fill();
      }
      if (hl && (hl.kind === 'step' || hl.kind === 'reveal') && hl.cell === i) { c.strokeStyle = GOLD; c.lineWidth = 3; E.rr(x + 2.5, y + 2.5, cell - 5, cell - 5, 7); c.stroke(); }
    }
    K.button(c, s.undoBtn, '되돌리기', { size: 14 });
    K.button(c, s.hintBtn, `힌트 +${K.HINT_SEC}초`, { size: 14 });
    if (s.panel && s.text) s.panelRect = K.panel(c, '힌트', s.text, { color: GOLD });
  },
};
