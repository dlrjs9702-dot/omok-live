import { E } from '../engine.js';
import * as K from './puzzle-kit.js';

// 지뢰찾기 (v1.10.37 서버 판 · v1.10.249 G4: 한판마당 퍼즐 화면, gamecenter-notes docs/gamehall-unify-hanpan-20261104.md)
// 판은 서버의 것(지뢰는 서버만 안다): 이 화면은 서버가 보낸 판을 그리고, 누를 때마다 서버에 보낸다.
// 닫힌 칸 = 열기(깃발 모드면 깃발), 열린 숫자 = 둘레 열기(깃발 수가 맞을 때) · PC는 오른쪽 클릭이 깃발.
// 깨면 서버가 기록(최고 시간)을 남기고, 그 답(best · newBest)을 결과 패널이 보여 준다 (reflex.js).
let s;
const NUM = ['', '#5B9BFF', '#3DDC97', '#FF5A79', '#B794F6', '#FF9F2E', '#35C8FF', '#F4F5FC', '#9AA3C7'];

export default {
  id: 'mines', name: '지뢰찾기', cat: 'puzzle',
  color: '#94A3B8', c2: '#475569', c3: '#1E293B',
  tagline: '숫자를 단서로 지뢰를 피해 모든 칸을 여세요',
  howto: [['grid', '칸의 숫자는 둘레 8칸에 있는 지뢰 수예요'], ['flag', '지뢰 자리에는 깃발을 꽂아요 (PC는 오른쪽 클릭)'], ['info', '깃발 수가 맞는 숫자를 누르면 둘레가 한 번에 열려요']],
  unit: 'time', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, levelIds: ['beginner', 'intermediate', 'expert'], defaultLevel: 'beginner', levelTitle: '난이도',
  levelNames: { beginner: '초급 9×9', intermediate: '중급 16×16', expert: '고급 30×16' },
  result: null, // the server's answer to the clearing press: { best, clears, newBest }

  init() {
    this.result = null;
    s = { id: E.opts.minesId, api: E.opts.api, v: E.opts.minesView, shownAt: Date.now(), flag: false, busy: false, over: false };
    this.layout();
  },
  layout() {
    const v = s.v, top = E.top + 4, roomH = E.bottom - top - 64;
    // (총괄 #399: a phone's 고급 30×16 is wider than the screen at its smallest cell -- on a tall screen a wide board is drawn
    // turned, 16 across and 30 down; the server's x·y stay the board's own, cellAt · cellPoint · draw share disp())
    s.rot = roomH > E.W && v.w > v.h && (E.W - 16) / v.w < 20;
    s.dw = s.rot ? v.h : v.w; s.dh = s.rot ? v.w : v.h;
    s.cell = Math.max(14, Math.min(52, Math.floor(Math.min((E.W - 16) / s.dw, roomH / s.dh))));
    s.gx = Math.round((E.W - s.dw * s.cell) / 2); s.gy = Math.round(top);
    const bw = Math.min(E.W - 16, 420);
    s.modeBtn = { x: (E.W - bw) / 2, y: s.gy + s.dh * s.cell + 12, w: bw, h: 44 };
  },
  /** board cell i -> [column, row] on the screen (turned: the board's row is the column) */
  disp(i) { const x = i % s.v.w, y = Math.floor(i / s.v.w); return s.rot ? [y, x] : [x, y]; },
  cellAt(x, y) {
    const c = Math.floor((x - s.gx) / s.cell), r = Math.floor((y - s.gy) / s.cell);
    if (x < s.gx || y < s.gy || c >= s.dw || r >= s.dh) return -1;
    return s.rot ? c * s.v.w + r : r * s.v.w + c;
  },
  /** (시험) 칸 i의 가운데 -- 캔버스 기준 좌표 */
  cellPoint(i) { const [c, r] = this.disp(i); return { x: s.gx + (c + 0.5) * s.cell, y: s.gy + (r + 0.5) * s.cell, cell: s.cell }; },
  view() { return s.v; },

  down(x, y) {
    if (s.over) return;
    if (K.inRect(s.modeBtn, x, y)) { s.flag = !s.flag; E.sfx.ui(); return; }
    const i = this.cellAt(x, y);
    if (i < 0) return;
    const c = s.v.cells[i], flagging = s.flag || E.pointer.button === 2;
    const action = c >= 0 ? (flagging ? null : 'chord') : flagging ? 'flag' : c === -2 ? null : 'open';
    if (action) this.act(action, i);
  },
  async act(action, i) {
    if (s.busy) return;
    s.busy = true; const mine = s;
    try {
      const data = await s.api('/api/solo/minesweeper/act', { method: 'POST', body: JSON.stringify({ id: s.id, action, x: i % s.v.w, y: Math.floor(i / s.v.w) }) });
      if (mine !== s || E.game?.id !== 'mines') return; // a new round meanwhile (Codex 10판 ⑥: or another game -- not ended by this answer)
      s.v = data.view; s.shownAt = Date.now();
      if (action === 'flag') E.sfx.tap(); else E.sfx.pop();
      const st = { 판: `${s.v.w}×${s.v.h}`, 지뢰: `${s.v.mines}개` };
      if (s.v.status === 'won') {
        s.over = true; this.result = data.result; E.sfx.win(); E.haptic('success');
        E.end(null, { score: s.v.ms, delay: 1.1, title: '클리어!', stats: [['시간', K.fmtT(Math.round(s.v.ms / 1000))], ['판', st.판], ['지뢰', st.지뢰]] }); // (rounded as the big figure is: util.fmtScore 'time')
      } else if (s.v.status === 'lost') {
        s.over = true; E.sfx.lose(); E.haptic('error');
        E.end(null, { score: null, delay: 1.4, title: '펑! 지뢰를 밟았어요', stats: [['시간', K.fmtT(Math.round(s.v.ms / 1000))], ['판', st.판], ['남은 지뢰', `${s.v.mines - s.v.flags}개`]] });
      }
    } catch (error) { if (mine === s && E.game?.id === 'mines') E.banner(error.message, 'info', 2400); }
    finally { mine.busy = false; }
  },

  update() {
    const v = s.v, ms = v.status === 'playing' ? v.ms + (Date.now() - s.shownAt) : v.ms;
    E.hud({ center: K.fmtT(ms / 1000), right: `남은 지뢰 ${v.mines - v.flags}` });
  },

  draw(c) {
    const { cell, gx, gy } = s, v = s.v, over = v.status === 'won' || v.status === 'lost', mineAt = new Set(v.mineAt || []);
    c.fillStyle = '#141A2E'; E.rr(gx - 6, gy - 6, s.dw * cell + 12, s.dh * cell + 12, 12); c.fill();
    const fs = Math.max(10, cell * 0.56);
    for (let i = 0; i < v.cells.length; i++) {
      const [dc, dr] = this.disp(i), x = gx + dc * cell, y = gy + dr * cell, n = v.cells[i];
      if (n >= 0) {
        c.fillStyle = v.boom === i ? '#FF5A79' : '#0F1428'; c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        if (n) E.text(String(n), x + cell / 2, y + cell / 2 + 1, fs, NUM[n], 900);
      } else {
        c.fillStyle = '#2B3560'; E.rr(x + 1.5, y + 1.5, cell - 3, cell - 3, Math.min(6, cell * 0.18)); c.fill();
        c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + 2, y + 2, cell - 4, Math.max(2, cell * 0.12));
        if (n === -2) { // a flag: the pole and a red pennant
          c.fillStyle = '#E6EBFA'; c.fillRect(x + cell * 0.46, y + cell * 0.22, Math.max(1.5, cell * 0.06), cell * 0.58);
          c.fillStyle = '#FF5A79'; c.beginPath(); c.moveTo(x + cell * 0.5, y + cell * 0.22); c.lineTo(x + cell * 0.78, y + cell * 0.36); c.lineTo(x + cell * 0.5, y + cell * 0.5); c.closePath(); c.fill();
        }
      }
      if (over && mineAt.has(i) && n !== -2) { c.fillStyle = v.boom === i ? '#1B1E33' : '#E6EBFA'; c.beginPath(); c.arc(x + cell / 2, y + cell / 2, cell * 0.24, 0, 6.283); c.fill(); }
    }
    // 열기 / 깃발 (네모로직의 칠하기 / X 표시처럼)
    const m = s.modeBtn, half = m.w / 2;
    c.fillStyle = 'rgba(255,255,255,.07)'; E.rr(m.x, m.y, m.w, m.h, m.h / 2); c.fill();
    c.fillStyle = s.flag ? '#FF5A79' : this.color; E.rr(m.x + (s.flag ? half : 0) + 3, m.y + 3, half - 6, m.h - 6, (m.h - 6) / 2); c.fill();
    E.text('열기', m.x + half / 2, m.y + m.h / 2 + 1, 14.5, s.flag ? 'rgba(255,255,255,.5)' : '#0B0C1A', 800);
    E.text('깃발', m.x + half * 1.5, m.y + m.h / 2 + 1, 14.5, s.flag ? '#fff' : 'rgba(255,255,255,.5)', 800);
  },
};
