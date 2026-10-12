import { E } from '../engine.js';
import * as SD from './sudoku-core.js';
import * as K from './puzzle-kit.js';

// 스도쿠 — 9×9 · 가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩 (규칙 · 문제 · 힌트는 sudoku-core.js)
let s, genId = 0;
const BLUE = '#7FA6FF', RED = '#FF5A79', GOLD = '#FFD34D';

export default {
  id: 'sudoku', name: '스도쿠', cat: 'puzzle',
  color: '#4F8CFF', c2: '#2747A8', c3: '#121B3D',
  tagline: '가로 · 세로 · 3×3 칸마다 1부터 9까지 한 번씩',
  howto: [['grid', '빈칸을 누르고 아래 숫자를 눌러 채워요. 가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩 들어가야 해요'], ['edit', '메모를 켜면 들어갈 수 있는 숫자를 칸에 작게 적어 둘 수 있어요'], ['info', '힌트는 답 대신 그 칸에 그 숫자만 들어가는 이유를 알려 줘요 (1번마다 +30초)']],
  unit: 'sec', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, defaultLevel: 'easy', levelTitle: '난이도',
  levelNote: '쉬움: 들어갈 곳이 하나뿐인 칸만 찾으면 돼요 · 보통: 줄 겹침 · 짝 같은 기술이 필요해요 · 어려움: 숨은 짝 · X-윙까지',
  rankRule: K.RANK_RULE,
  options: [K.MODE_OPTION],

  init() {
    const sess = K.session('sudoku'), my = ++genId;
    s = { sess, ready: false, over: false, time: 0, hints: 0, sel: -1, memo: false, undo: [], hint: null, hl: null, panel: null, saveT: 0 };
    this.layout();
    K.makePuzzle(sess, 'sudoku', SD.generate, (p) => {
      if (my !== genId || !p) return;
      s.solution = p.solution; s.given = p.puzzle.map(Boolean); s.grid = p.puzzle.slice(); s.notes = Array(81).fill(0);
      const saved = sess.load();
      if (saved?.grid?.length === 81 && saved.grid.every((v, i) => !s.given[i] || v === p.puzzle[i])) {
        s.grid = saved.grid; s.notes = saved.notes?.length === 81 ? saved.notes : s.notes; s.time = saved.time || 0; s.hints = saved.hints || 0;
        E.banner('푸는 중이던 오늘의 문제를 이어서 풀어요 (시간도 이어져요)', 'info', 2600);
      }
      s.ready = true;
    });
  },
  layout() {
    const top = E.top + 4, nw = Math.min(E.W - 16, 520), avail = E.bottom - top - (12 + 54 + 10 + 44 + 6);
    const size = Math.floor(Math.max(180, Math.min(nw, avail)) / 9) * 9;
    s.cell = size / 9; s.size = size; s.bx = Math.round((E.W - size) / 2); s.by = top;
    const nx = (E.W - nw) / 2, ny = top + size + 12, gap = 4, bw = (nw - gap * 8) / 9;
    s.nums = [...Array(9)].map((_, k) => ({ x: nx + k * (bw + gap), y: ny, w: bw, h: 54, d: k + 1 }));
    const tw = (nw - gap * 3) / 4;
    s.tools = ['undo', 'erase', 'memo', 'hint'].map((id, k) => ({ id, x: nx + k * (tw + gap), y: ny + 64, w: tw, h: 44 }));
  },
  save() { s.sess.save({ grid: s.grid, notes: s.notes, time: s.time, hints: s.hints }); s.saveT = 0; },

  down(x, y) {
    if (!s.ready || s.over) return;
    if (s.panel) { s.panel = null; if (K.inRect(s.panelRect, x, y)) return; }
    const cx = Math.floor((x - s.bx) / s.cell), cy = Math.floor((y - s.by) / s.cell);
    if (x >= s.bx && y >= s.by && cx < 9 && cy < 9) { s.sel = cy * 9 + cx; E.sfx.tap(); return; }
    const n = s.nums.find((b) => K.inRect(b, x, y));
    if (n) return this.input(n.d);
    const t = s.tools.find((b) => K.inRect(b, x, y));
    if (t) this.tool(t.id);
  },
  key(k) {
    if (!s.ready || s.over) return;
    if (/^[1-9]$/.test(k)) return this.input(+k);
    if (k === 'Backspace' || k === 'Delete' || k === '0') return this.tool('erase');
    if (k === 'n' || k === 'm') return this.tool('memo');
    if (k === 'h') return this.tool('hint');
    if (k === 'z') return this.tool('undo');
    if (k === 'Escape') { s.panel = null; return; }
    const mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
    if (mv != null) { const i = s.sel < 0 ? 40 : s.sel, x = i % 9, y = (i / 9) | 0; const nx = (x + (mv === -1 ? -1 : mv === 1 ? 1 : 0) + 9) % 9, ny = (y + (mv === -9 ? -1 : mv === 9 ? 1 : 0) + 9) % 9; s.sel = ny * 9 + nx; }
  },
  /** 고른 칸에 숫자 넣기 (메모 모드면 작은 숫자를 켜고 끈다) */
  input(d) {
    const i = s.sel;
    if (i < 0) { E.banner('먼저 칸을 골라 주세요', 'info', 1200); return; }
    if (s.given[i]) { E.sfx.wrong(); return; }
    const rec = [[i, s.grid[i], s.notes[i]]];
    if (s.memo && !s.grid[i]) s.notes[i] ^= 1 << d;
    else if (s.grid[i] === d) s.grid[i] = 0;
    else {
      s.grid[i] = d; s.notes[i] = 0;
      for (const j of SD.PEERS[i]) if (s.notes[j] & (1 << d)) { rec.push([j, s.grid[j], s.notes[j]]); s.notes[j] &= ~(1 << d); }
    }
    s.undo.push(rec); s.hl = null; s.hint = null;
    E.sfx.tap(); E.haptic('light');
    this.after();
  },
  tool(id) {
    if (!s.ready || s.over) return; // 문제를 만드는 중 · 끝난 뒤에는 무시
    if (id === 'memo') { s.memo = !s.memo; E.sfx.ui(); return; }
    if (id === 'undo') {
      const rec = s.undo.pop();
      if (!rec) return;
      for (const [i, v, n] of rec) { s.grid[i] = v; s.notes[i] = n; }
      s.sel = rec[0][0]; E.sfx.ui(); this.save(); return;
    }
    if (id === 'erase') {
      const i = s.sel;
      if (i < 0 || s.given[i] || (!s.grid[i] && !s.notes[i])) return;
      s.undo.push([[i, s.grid[i], s.notes[i]]]); s.grid[i] = 0; s.notes[i] = 0; E.sfx.ui(); this.save(); return;
    }
    if (id === 'hint') {
      const h = SD.hint(s.grid, s.solution);
      if (!h) return;
      s.hints++; s.hint = h;
      s.text = SD.explain(h, s.grid);
      if (h.kind === 'wrong') { s.hl = { wrong: h.cells }; s.sel = h.cells[0]; }
      else {
        const unit = h.unit != null ? SD.UNITS[h.unit] : SD.PEERS[h.i];
        s.hl = { target: h.i, area: unit, pre: (h.pre || []).flatMap((p) => p.cells || []) };
        s.sel = h.i;
      }
      s.panel = true; E.sfx.ui(); this.save();
    }
  },
  after() {
    this.save();
    if (s.grid.every(Boolean) && SD.isSolved(s.grid)) {
      s.over = true; E.sfx.win(); E.haptic('success');
      K.finish(s.sess, { time: s.time, hints: s.hints, sol: s.grid, stats: [['난이도', { easy: '쉬움', normal: '보통', hard: '어려움' }[s.sess.level]]] });
    }
  },

  update(dt) {
    if (!s.ready) return;
    if (!s.over) { s.time += dt; s.saveT += dt; if (s.saveT > 3) this.save(); }
    K.hud(s.sess, s.time, s.hints);
  },

  draw(c) {
    if (!s.ready) { K.loading(c); return; }
    const { cell, bx, by, size } = s, sel = s.sel, bad = SD.conflicts(s.grid), selV = sel >= 0 ? s.grid[sel] : 0;
    c.fillStyle = '#151933'; E.rr(bx - 4, by - 4, size + 8, size + 8, 12); c.fill();
    // 강조: 고른 칸의 줄 · 칸, 같은 숫자, 힌트 영역
    for (let i = 0; i < 81; i++) {
      const x = bx + (i % 9) * cell, y = by + ((i / 9) | 0) * cell;
      let fill = (SD.boxOf(i) & 1) ? '#1C2142' : '#20264B';
      if (sel >= 0 && (SD.rowOf(i) === SD.rowOf(sel) || SD.colOf(i) === SD.colOf(sel) || SD.boxOf(i) === SD.boxOf(sel))) fill = '#2A3266';
      if (s.hl?.area?.includes(i)) fill = '#3B3A1E';
      if (s.hl?.pre?.includes(i)) fill = '#3A2E52';
      if (selV && s.grid[i] === selV) fill = '#33407E';
      if (i === sel) fill = '#3F5BC4';
      c.fillStyle = fill; c.fillRect(x, y, cell, cell);
    }
    // 숫자 · 메모
    for (let i = 0; i < 81; i++) {
      const x = bx + (i % 9) * cell, y = by + ((i / 9) | 0) * cell, v = s.grid[i];
      if (v) E.text(String(v), x + cell / 2, y + cell / 2 + 1, cell * 0.58, bad.has(i) ? RED : s.given[i] ? '#F2F4FF' : BLUE, s.given[i] ? 800 : 700);
      else if (s.notes[i]) for (let d = 1; d <= 9; d++) if (s.notes[i] & (1 << d)) {
        const nx = x + ((d - 1) % 3 + 0.5) * cell / 3, ny = y + (((d - 1) / 3) | 0) * cell / 3 + cell / 6 + 1;
        E.text(String(d), nx, ny, cell * 0.24, selV === d ? '#fff' : 'rgba(200,210,255,.75)', 700);
      }
    }
    // 선: 가는 선 · 3×3 굵은 선
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
    c.beginPath();
    for (let k = 1; k < 9; k++) if (k % 3) { c.moveTo(bx + k * cell, by); c.lineTo(bx + k * cell, by + size); c.moveTo(bx, by + k * cell); c.lineTo(bx + size, by + k * cell); }
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k <= 9; k += 3) { c.moveTo(bx + k * cell, by); c.lineTo(bx + k * cell, by + size); c.moveTo(bx, by + k * cell); c.lineTo(bx + size, by + k * cell); }
    c.stroke();
    // 힌트 표시: 목표 칸 · 틀린 칸
    if (s.hl?.target != null) { const i = s.hl.target; c.strokeStyle = GOLD; c.lineWidth = 3; E.rr(bx + (i % 9) * cell + 2, by + ((i / 9) | 0) * cell + 2, cell - 4, cell - 4, 6); c.stroke(); }
    for (const i of s.hl?.wrong || []) { c.strokeStyle = RED; c.lineWidth = 3; E.rr(bx + (i % 9) * cell + 2, by + ((i / 9) | 0) * cell + 2, cell - 4, cell - 4, 6); c.stroke(); }
    // 숫자판 (남은 개수) · 도구
    const count = Array(10).fill(0);
    for (const v of s.grid) if (v) count[v]++;
    for (const b of s.nums) {
      const left = 9 - count[b.d], on = s.memo;
      c.fillStyle = left <= 0 ? 'rgba(255,255,255,.04)' : on ? 'rgba(255,211,77,.14)' : 'rgba(91,123,255,.18)';
      E.rr(b.x, b.y, b.w, b.h, 12); c.fill();
      E.text(String(b.d), b.x + b.w / 2, b.y + b.h / 2 - 5, Math.min(26, b.w * 0.62), left <= 0 ? 'rgba(255,255,255,.25)' : on ? GOLD : '#fff', 800);
      E.text(left > 0 ? String(left) : '✓', b.x + b.w / 2, b.y + b.h - 10, 10.5, 'rgba(255,255,255,.5)', 700);
    }
    const label = { undo: '되돌리기', erase: '지우기', memo: s.memo ? '메모 켬' : '메모', hint: `힌트 +${K.HINT_SEC}초` };
    for (const b of s.tools) K.button(c, b, label[b.id], { on: b.id === 'memo' && s.memo, color: '#B8901E', size: 14 });
    if (s.panel && s.text) s.panelRect = K.panel(c, s.hint?.kind === 'wrong' ? '틀린 숫자가 있어요' : '힌트', s.text, { color: s.hint?.kind === 'wrong' ? RED : GOLD });
  },
};
