import { E } from '../engine.js';
import * as HS from './hashi-core.js';
import * as K from './puzzle-kit.js';

// 다리 잇기 — 섬의 숫자만큼 다리를 이어 모든 섬을 하나로 (규칙 · 문제 · 힌트는 hashi-core.js)
let s, genId = 0;
const GOLD = '#FFD34D', RED = '#FF5A79', GREEN = '#3DDC97';

export default {
  id: 'hashi', name: '다리 잇기', cat: 'puzzle',
  color: '#F4A340', c2: '#B5651D', c3: '#2E1C0B',
  tagline: '섬의 숫자만큼 다리를 놓아 모든 섬을 하나로 이으세요',
  howto: [['tap', '섬을 누른 뒤 이을 섬을 누르면 다리가 놓여요(0 → 1 → 2개). 섬에서 그 방향으로 끌어도 돼요'], ['grid', '다리는 가로 · 세로로만, 서로 엇갈리지 않게, 두 섬 사이에는 두 개까지 놓아요'], ['flag', '섬마다 숫자만큼 다리를 놓고 모든 섬이 하나로 이어지면 완성 (다리를 누르면 하나 빠져요)']],
  unit: 'sec', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, defaultLevel: 'easy', levelTitle: '난이도',
  levelNote: '쉬움 7×7 섬 9개 · 보통 9×9 섬 15개(고립 막기 필요) · 어려움 10×12 섬 24개(놓아 보며 따지기 필요)',
  rankRule: K.RANK_RULE,
  options: [K.MODE_OPTION],

  init() {
    const sess = K.session('hashi'), my = ++genId;
    s = { sess, ready: false, over: false, time: 0, hints: 0, sel: -1, undo: [], press: null, hint: null, panel: null, saveT: 0 };
    K.makePuzzle(sess, 'hashi', HS.generate, (P) => {
      if (my !== genId || !P) return;
      s.P = P; s.cur = P.edges.map(() => 0);
      const saved = sess.load();
      if (saved?.cur?.length === s.cur.length) { s.cur = saved.cur; s.time = saved.time || 0; s.hints = saved.hints || 0; E.banner('푸는 중이던 오늘의 문제를 이어서 풀어요 (시간도 이어져요)', 'info', 2600); }
      s.ready = true;
      this.layout();
    });
  },
  layout() {
    if (!s.ready) return;
    const { w, h } = s.P, top = E.top + 6, availW = Math.min(E.W - 16, 600), availH = E.bottom - top - 66;
    s.cell = Math.min(60, availW / w, availH / h);
    s.ox = Math.round((E.W - w * s.cell) / 2); s.oy = top;
    const by = top + h * s.cell + 12, bw = Math.min(E.W - 16, 460), bx = (E.W - bw) / 2, gap = 6;
    s.undoBtn = { x: bx, y: by, w: bw / 2 - gap / 2, h: 44 };
    s.hintBtn = { x: bx + bw / 2 + gap / 2, y: by, w: bw / 2 - gap / 2, h: 44 };
  },
  save() { s.sess.save({ cur: s.cur, time: s.time, hints: s.hints }); s.saveT = 0; },
  pos(i) { const p = s.P.islands[i]; return [s.ox + (p.x + 0.5) * s.cell, s.oy + (p.y + 0.5) * s.cell]; },
  islandAt(x, y) {
    const r = s.cell * 0.48;
    return s.P.islands.findIndex((p, i) => { const [px, py] = this.pos(i); return Math.hypot(x - px, y - py) <= r; });
  },
  edgeBetween(a, b) { return s.P.edges.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)); },
  /** 다리가 놓인 자리 위를 눌렀는지 (그 다리 번호) */
  bridgeAt(x, y) {
    const gx = Math.floor((x - s.ox) / s.cell), gy = Math.floor((y - s.oy) / s.cell), c = gy * s.P.w + gx;
    if (gx < 0 || gy < 0 || gx >= s.P.w || gy >= s.P.h) return -1;
    return s.P.edges.findIndex((e, k) => s.cur[k] > 0 && e.path.includes(c));
  },
  sumOf(i) { return s.P.inc[i].reduce((a, k) => a + s.cur[k], 0); },
  blocked(k) { return s.P.cross[k].some((j) => s.cur[j] > 0); },
  /** k 자리의 다리 수를 바꾼다 (delta 1: 0→1→2→0 · -1: 하나 빼기) */
  bump(k, delta) {
    const old = s.cur[k];
    let v = delta > 0 ? (old + 1) % 3 : Math.max(0, old - 1);
    if (v > 0 && old === 0 && this.blocked(k)) { E.banner('다른 다리와 엇갈려서 놓을 수 없어요', 'info', 1400); E.sfx.wrong(); return; }
    if (v === old) return;
    s.undo.push([k, old]); s.cur[k] = v; s.hl = null;
    E.sfx.tap(); E.haptic('light');
    this.after();
  },

  down(x, y, id) {
    if (!s.ready || s.over) return;
    if (s.panel) { s.panel = null; if (K.inRect(s.panelRect, x, y)) return; }
    if (K.inRect(s.undoBtn, x, y)) return this.undoOne();
    if (K.inRect(s.hintBtn, x, y)) return this.doHint();
    const i = this.islandAt(x, y);
    s.press = { id, i, x, y };
    if (i < 0) {
      const k = this.bridgeAt(x, y);
      if (k >= 0) { this.bump(k, -1); s.press = null; } else s.sel = -1;
    }
  },
  up(x, y, id) {
    const p = s.press;
    if (!p || p.id !== id) return;
    s.press = null;
    const i = p.i, dx = x - p.x, dy = y - p.y;
    if (i < 0) return;
    // 섬에서 끌었으면 그 방향의 이웃 섬과 잇는다
    if (Math.hypot(dx, dy) > s.cell * 0.55) {
      const horiz = Math.abs(dx) > Math.abs(dy), sign = Math.sign(horiz ? dx : dy), me = s.P.islands[i];
      const k = s.P.edges.findIndex((e) => {
        if (e.h !== horiz || (e.a !== i && e.b !== i)) return false;
        const o = s.P.islands[e.a === i ? e.b : e.a];
        return Math.sign(horiz ? o.x - me.x : o.y - me.y) === sign;
      });
      if (k >= 0) this.bump(k, 1);
      s.sel = -1;
      return;
    }
    // 눌렀다 뗌: 고른 섬이 있으면 그 섬과 잇기, 없으면 고르기
    if (s.sel >= 0 && s.sel !== i) {
      const k = this.edgeBetween(s.sel, i);
      if (k >= 0) { this.bump(k, 1); s.sel = -1; return; }
    }
    s.sel = s.sel === i ? -1 : i;
    E.sfx.tap();
  },
  undoOne() {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시 (키 입력 포함)
    const r = s.undo.pop();
    if (!r) return;
    s.cur[r[0]] = r[1]; E.sfx.ui(); this.save();
  },
  doHint() {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시 (키 입력 포함)
    const h = HS.hint(s.P, s.cur, s.P.solution);
    if (!h) return;
    s.hints++; s.hint = h; s.text = HS.explain(s.P, h); s.panel = true; s.hl = h;
    E.sfx.ui(); this.save();
  },
  after() {
    this.save();
    const { islands, edges } = s.P;
    if (!islands.every((p, i) => this.sumOf(i) === p.n)) return;
    // 모두 이어졌는지
    const seen = new Set([0]), st = [0];
    while (st.length) { const i = st.pop(); for (const k of s.P.inc[i]) if (s.cur[k] > 0) { const e = edges[k], j = e.a === i ? e.b : e.a; if (!seen.has(j)) { seen.add(j); st.push(j); } } }
    if (seen.size !== islands.length) { E.banner('숫자는 다 맞았지만 섬들이 하나로 이어지지 않았어요', 'info', 2200); return; }
    s.over = true; E.sfx.win(); E.haptic('success');
    K.finish(s.sess, { time: s.time, hints: s.hints, sol: s.cur, stats: [['섬', `${islands.length}개`]] });
  },

  update(dt) {
    if (!s.ready) return;
    if (!s.over) { s.time += dt; s.saveT += dt; if (s.saveT > 3) this.save(); }
    K.hud(s.sess, s.time, s.hints);
  },

  draw(c) {
    if (!s.ready) { K.loading(c); return; }
    const { P, cell } = s, r = cell * 0.36;
    c.fillStyle = '#122033'; E.rr(s.ox - 6, s.oy - 6, P.w * cell + 12, P.h * cell + 12, 14); c.fill();
    c.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) { c.beginPath(); c.arc(s.ox + (x + 0.5) * cell, s.oy + (y + 0.5) * cell, 1.6, 0, 6.283); c.fill(); }
    // 고른 섬에서 이을 수 있는 곳
    if (s.sel >= 0) for (const k of P.inc[s.sel]) {
      if (s.cur[k] >= 2 || this.blocked(k)) continue;
      const e = P.edges[k], [ax, ay] = this.pos(e.a), [bx, by] = this.pos(e.b);
      c.strokeStyle = 'rgba(127,166,255,.35)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
    }
    // 다리
    const drawBridge = (k, n, color, wdt) => {
      const e = P.edges[k], [ax, ay] = this.pos(e.a), [bx, by] = this.pos(e.b), off = n === 2 ? cell * 0.09 : 0;
      c.strokeStyle = color; c.lineWidth = wdt;
      for (const o of n === 2 ? [-off, off] : [0]) { c.beginPath(); c.moveTo(ax + (e.h ? 0 : o), ay + (e.h ? o : 0)); c.lineTo(bx + (e.h ? 0 : o), by + (e.h ? o : 0)); c.stroke(); }
    };
    P.edges.forEach((e, k) => { if (s.cur[k]) drawBridge(k, s.cur[k], s.hl?.kind === 'wrong' && s.hl.edges.includes(k) ? RED : '#D9E2F5', Math.max(2.5, cell * 0.07)); });
    if (s.hl?.step) { const k = s.hl.step.k; c.globalAlpha = 0.85; drawBridge(k, Math.max(1, s.hl.step.lo ?? 1), GOLD, Math.max(3, cell * 0.08)); c.globalAlpha = 1; }
    // 섬
    P.islands.forEach((p, i) => {
      const [x, y] = this.pos(i), sum = this.sumOf(i), done = sum === p.n, over = sum > p.n;
      c.fillStyle = over ? '#5A1E2E' : done ? '#173F33' : '#1D2A47';
      c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
      c.strokeStyle = i === s.sel ? '#7FA6FF' : over ? RED : done ? GREEN : '#AFC0E8'; c.lineWidth = i === s.sel ? 3.5 : 2.2;
      c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke();
      E.text(String(p.n), x, y + 1, r * 1.05, over ? RED : done ? GREEN : '#F2F5FF', 900);
    });
    K.button(c, s.undoBtn, '되돌리기', { size: 14 });
    K.button(c, s.hintBtn, `힌트 +${K.HINT_SEC}초`, { size: 14 });
    if (s.panel && s.text) s.panelRect = K.panel(c, s.hint?.kind === 'wrong' ? '정답보다 많은 다리가 있어요' : '힌트', s.text, { color: s.hint?.kind === 'wrong' ? RED : GOLD });
  },
};
