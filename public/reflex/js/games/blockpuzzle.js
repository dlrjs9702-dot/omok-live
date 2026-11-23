// 블록 퍼즐: 8×8 판에 아래 조각 3개를 끌어다 놓아 가로줄 · 세로줄을 가득 채우면 그 줄이 지워진다 · 놓을 곳이 없으면 끝
// · 조각 3개를 다 놓으면 새로 3개 · 놓은 칸마다 1점 + 지운 줄 점수(한꺼번에 많이 지울수록 커짐) + 연속으로 지우면 더
// · 난이도: 나오는 조각의 크기 (쉬움은 작은 조각이 많고, 어려움은 큰 조각이 많다)
import { E } from '../engine.js';

// 규칙 숫자 (안내 글 · 시험이 같이 쓴다)
export const BP = { n: 8, tray: 3, cell: 1, line: [0, 10, 30, 60, 100, 150, 210], streak: 10 };
// 조각 모양: 문자열 '#'가 칸 · 크기 무리(small · mid · big)마다 나올 비율이 난이도로 다르다
const SHAPES = {
  small: ['#', '##', '#|#', '###', '#|#|#', '##|#.', '##|.#', '#.|##', '.#|##'],
  mid: ['####', '#|#|#|#', '##|##', '###|#..', '###|..#', '#..|###', '..#|###', '##|#|#', '##|.#|.#', '#.|#.|##', '.#|.#|##', '###|.#.', '.#.|###', '#.|##|#.', '.#|##|.#', '##.|.##', '.##|##.', '#.|##|.#', '.#|##|#.'],
  big: ['#####', '#|#|#|#|#', '###|###|###', '###|###', '##|##|##', '###|#..|#..', '###|..#|..#', '#..|#..|###', '..#|..#|###'],
};
const MIX = { easy: { small: 0.5, mid: 0.42, big: 0.08 }, normal: { small: 0.3, mid: 0.47, big: 0.23 }, hard: { small: 0.16, mid: 0.46, big: 0.38 } };
const COLORS = ['#FF5A79', '#FFB547', '#3DDC97', '#4FB3FF', '#9B6CFF', '#FF7AD9', '#2FCFBE'];
const parse = (str) => { const cells = []; str.split('|').forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); })); return cells; };
const PIECES = Object.fromEntries(Object.entries(SHAPES).map(([k, list]) => [k, list.map(parse)]));
const dims = (cells) => [Math.max(...cells.map(([r]) => r)) + 1, Math.max(...cells.map(([, c]) => c)) + 1];

let s;
export default {
  id: 'blockpuzzle', name: '블록 퍼즐', cat: 'puzzle',
  color: '#4FB3FF', c2: '#6C5CFF', c3: '#13245E',
  tagline: '조각을 판에 놓아 가로 · 세로 줄을 채워 지우세요',
  howto: [['drag', '아래 조각을 끌어다 8×8 판의 빈칸에 놓아요'], ['grid', '가로줄이나 세로줄이 가득 차면 그 줄이 지워져요'], ['avoid', '세 조각 가운데 놓을 수 있는 곳이 하나도 없으면 끝']],
  levels: true, levelLegacy: 'normal',
  levelNote: '쉬움: 작은 조각이 많이 나와요 · 어려움: 큰 조각이 자주 나와요 — 난이도마다 최고 기록과 랭킹이 따로예요',

  init() {
    s = { b: new Array(BP.n * BP.n).fill(null), tray: [], drag: null, placed: 0, lines: 0, streak: 0, best: 0, clearFx: [], over: false };
    this.layout();
    this.deal();
  },
  layout() {
    const n = BP.n, avail = E.bottom - E.top;
    s.cell = Math.floor(Math.min((E.W - 24) / n, (avail - 150) / n, 52));
    s.ox = Math.round((E.W - s.cell * n) / 2); s.oy = Math.round(E.top + Math.max(8, (avail - s.cell * n - 140) / 2));
    s.trayY = s.oy + s.cell * n + 24; s.trayH = Math.min(120, E.bottom - s.trayY - 6);
  },
  pick() {
    const m = MIX[E.level] || MIX.normal, r = Math.random();
    const group = r < m.small ? 'small' : r < m.small + m.mid ? 'mid' : 'big', list = PIECES[group];
    return { cells: list[Math.floor(Math.random() * list.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  },
  deal() {
    s.tray = Array.from({ length: BP.tray }, () => this.pick());
    this.checkOver();
  },
  fits(cells, r0, c0) {
    for (const [r, c] of cells) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= BP.n || cc >= BP.n || s.b[rr * BP.n + cc]) return false;
    }
    return true;
  },
  canPlaceAny(cells) {
    for (let r = 0; r < BP.n; r++) for (let c = 0; c < BP.n; c++) if (this.fits(cells, r, c)) return true;
    return false;
  },
  checkOver() {
    if (s.tray.some((p) => p && this.canPlaceAny(p.cells))) return;
    s.over = true;
    E.sfx.lose();
    E.end(null, { delay: 1.1, title: '놓을 곳이 없어요', stats: [['놓은 조각', s.placed + '개'], ['지운 줄', s.lines + '줄'], ['최대 연속', s.best + '번']] });
  },
  // 이어하기: 남은 조각을 한 칸짜리 3개로 바꾼다 (빈칸이 있는 한 늘 놓을 수 있다)
  revive() {
    s.over = false;
    s.tray = Array.from({ length: BP.tray }, () => ({ cells: [[0, 0]], color: '#FFD35C' }));
  },

  slotX(i) { return E.W / 2 + (i - 1) * Math.min(130, (E.W - 24) / 3); },
  trayScale() { return Math.min(0.6, s.trayH / (s.cell * 5.2)); },
  /** 끌고 있는 조각의 왼쪽 위 칸 (판 밖이면 null) */
  dropCell(d = s.drag) {
    const [h, w] = dims(d.p.cells);
    const x0 = d.x - (w * s.cell) / 2, y0 = d.y - h * s.cell - s.cell * 0.9; // 손가락 위로 띄워서 (손가락에 가려지지 않게)
    return [Math.round((y0 - s.oy) / s.cell), Math.round((x0 - s.ox) / s.cell), x0, y0];
  },

  // 조각은 처음 집은 손가락 하나로 · 취소(전화 · 알림 · 정지)는 놓지 않고 제자리로 (GPT 게임별 검토 G02 · G09)
  down(x, y, id) {
    if (s.over || s.drag || y < s.trayY - 10) return;
    let best = -1, bd = 1e9;
    s.tray.forEach((p, i) => { if (!p) return; const d = Math.abs(x - this.slotX(i)); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || bd > Math.min(70, (E.W - 24) / 6 + 10)) return;
    s.drag = { i: best, p: s.tray[best], x, y, id };
    E.sfx.ui?.();
  },
  move(x, y, dx, dy, id) { if (s.drag && id === s.drag.id) { s.drag.x = x; s.drag.y = y; } },
  cancel(id) { if (s.drag && (id == null || id === s.drag.id)) s.drag = null; },
  up(x, y, id) {
    const d = s.drag;
    if (!d || id !== d.id) return;
    if (x != null) { d.x = x; d.y = y; } // 손을 뗀 자리에 놓는다
    s.drag = null;
    const [r0, c0] = this.dropCell(d);
    if (!this.fits(d.p.cells, r0, c0)) return;
    this.place(d.i, d.p, r0, c0);
  },
  place(i, p, r0, c0) {
    for (const [r, c] of p.cells) s.b[(r0 + r) * BP.n + c0 + c] = p.color;
    s.tray[i] = null; s.placed++;
    let gain = p.cells.length * BP.cell;
    // 가득 찬 줄 찾기 (가로 · 세로 동시에)
    const full = [];
    for (let r = 0; r < BP.n; r++) if ([...Array(BP.n).keys()].every((c) => s.b[r * BP.n + c])) full.push(['r', r]);
    for (let c = 0; c < BP.n; c++) if ([...Array(BP.n).keys()].every((r) => s.b[r * BP.n + c])) full.push(['c', c]);
    if (full.length) {
      s.streak++; s.best = Math.max(s.best, s.streak); s.lines += full.length;
      gain += BP.line[Math.min(full.length, BP.line.length - 1)] + BP.streak * (s.streak - 1);
      for (const [k, j] of full) for (let t = 0; t < BP.n; t++) {
        const idx = k === 'r' ? j * BP.n + t : t * BP.n + j;
        if (s.b[idx]) { s.clearFx.push({ x: s.ox + ((idx % BP.n) + 0.5) * s.cell, y: s.oy + (Math.floor(idx / BP.n) + 0.5) * s.cell, color: s.b[idx], t: 0.35 }); s.b[idx] = null; }
      }
      E.sfx.note(64 + Math.min(full.length * 3 + s.streak, 24), 0.18, 0.2); E.haptic('medium');
      if (full.length >= 2) E.banner(`${full.length}줄 동시에!`, 'star', 1200);
      if (s.streak >= 2) E.popup(`${s.streak}연속`, E.W / 2, s.oy - 4, '#FFD35C', 20);
    } else {
      s.streak = 0;
      E.sfx.place?.();
    }
    E.add(gain, s.ox + (c0 + 1) * s.cell, s.oy + r0 * s.cell, full.length ? '#FFD35C' : '#fff');
    if (s.tray.every((t) => !t)) this.deal(); else this.checkOver();
  },

  update(dt) {
    for (const f of s.clearFx) f.t -= dt;
    s.clearFx = s.clearFx.filter((f) => f.t > 0);
  },

  block(c, x, y, size, color, alpha = 1) {
    c.globalAlpha = alpha;
    c.fillStyle = color; E.rr(x + 1.5, y + 1.5, size - 3, size - 3, Math.max(3, size * 0.18)); c.fill();
    c.fillStyle = 'rgba(255,255,255,.22)'; E.rr(x + 1.5, y + 1.5, size - 3, (size - 3) * 0.38, Math.max(3, size * 0.18)); c.fill();
    c.globalAlpha = 1;
  },
  draw(c) {
    const { cell, ox, oy } = s, n = BP.n;
    c.fillStyle = 'rgba(255,255,255,.05)'; E.rr(ox - 6, oy - 6, n * cell + 12, n * cell + 12, 14); c.fill();
    for (let i = 0; i < n * n; i++) {
      const x = ox + (i % n) * cell, y = oy + Math.floor(i / n) * cell;
      if (s.b[i]) this.block(c, x, y, cell, s.b[i]);
      else { c.fillStyle = 'rgba(255,255,255,.06)'; E.rr(x + 2, y + 2, cell - 4, cell - 4, 5); c.fill(); }
    }
    // 끌고 있는 조각: 놓일 자리 미리 보기 + 지워질 줄 강조
    if (s.drag) {
      const d = s.drag, [r0, c0, x0, y0] = this.dropCell(d);
      if (this.fits(d.p.cells, r0, c0)) {
        const tmp = s.b.slice();
        for (const [r, cc] of d.p.cells) { tmp[(r0 + r) * n + c0 + cc] = d.p.color; this.block(c, ox + (c0 + cc) * cell, oy + (r0 + r) * cell, cell, d.p.color, 0.35); }
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
        for (let r = 0; r < n; r++) if ([...Array(n).keys()].every((k) => tmp[r * n + k])) { E.rr(ox, oy + r * cell, n * cell, cell, 6); c.stroke(); }
        for (let k = 0; k < n; k++) if ([...Array(n).keys()].every((r) => tmp[r * n + k])) { E.rr(ox + k * cell, oy, cell, n * cell, 6); c.stroke(); }
      }
      for (const [r, cc] of d.p.cells) this.block(c, x0 + cc * cell, y0 + r * cell, cell, d.p.color, 0.95);
    }
    for (const f of s.clearFx) { const k = f.t / 0.35, w = cell * (0.5 + (1 - k) * 0.6); c.globalAlpha = k; c.fillStyle = f.color; E.rr(f.x - w / 2, f.y - w / 2, w, w, 6); c.fill(); c.globalAlpha = 1; }
    // 아래 조각 3개
    const k = this.trayScale(), sz = cell * k;
    s.tray.forEach((p, i) => {
      if (!p || (s.drag && s.drag.i === i)) return;
      const [h, w] = dims(p.cells), cx = this.slotX(i), cy = s.trayY + s.trayH / 2, can = this.canPlaceAny(p.cells);
      for (const [r, cc] of p.cells) this.block(c, cx - (w * sz) / 2 + cc * sz, cy - (h * sz) / 2 + r * sz, sz, can ? p.color : '#555a75');
    });
  },
};
