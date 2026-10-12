import { E } from '../engine.js';
import { rand } from '../util.js';

let s;
const TIME = 60;
// 난이도: 칸이 늘어나는 빠르기(라운드 × grow + 1, 최대 nMax) · 색 차이(d0에서 라운드마다 dStep씩 줄어 dMin까지)
const LV = { easy: { grow: 0.5, nMax: 7, d0: 26, dStep: 0.6, dMin: 5 }, normal: { grow: 1, nMax: 8, d0: 24, dStep: 0.9, dMin: 3.2 }, hard: { grow: 1, nMax: 9, d0: 20, dStep: 1.1, dMin: 2.4 } };

export default {
  id: 'colorfind', name: '다른 색 찾기', cat: 'reflex',
  color: '#E85DFF', c2: '#6C5CFF', c3: '#4A1066',
  tagline: '딱 하나 색이 다른 칸을 찾아 탭하세요',
  howto: [['eye', '비슷한 색 사이에서 딱 하나 다른 칸을 찾아요'], ['grid', '맞힐 때마다 칸은 많아지고 색 차이는 줄어들어요'], ['avoid', '틀리면 3초가 줄어요. 60초 안에 최대한 많이!']],
  unit: 'round', hudLabel: '라운드', hudBar: true, customRight: true,
  levels: true, levelLegacy: 'normal',
  levelNote: '쉬움: 칸이 천천히 늘고 색 차이가 커요 · 어려움: 칸이 더 많아지고 색 차이가 더 작아져요',

  init() {
    s = { L: LV[E.level] || LV.normal, left: TIME, fx: null, wrong: 0 };
    this.layout();
    this.next(1);
  },
  layout() {
    s.size = Math.min(E.W - 28, E.bottom - E.top - 40, 470);
    s.ox = (E.W - s.size) / 2; s.oy = E.top + (E.bottom - E.top - s.size) / 2;
  },
  next(stage) {
    s.stage = stage;
    const L = s.L;
    s.n = Math.min(L.nMax, Math.floor(stage * L.grow) + 1 + (L.grow < 1 ? 1 : 0));
    const delta = Math.max(L.dMin, L.d0 - stage * L.dStep);
    s.h = rand(0, 360); s.sat = rand(55, 75); s.l = rand(45, 60);
    s.l2 = s.l + (s.l > 52 ? -delta : delta);
    s.odd = Math.floor(Math.random() * s.n * s.n);
    s.pop = 0;
  },
  cellAt(x, y) {
    const cell = s.size / s.n, c = Math.floor((x - s.ox) / cell), r = Math.floor((y - s.oy) / cell);
    return c < 0 || r < 0 || c >= s.n || r >= s.n ? -1 : r * s.n + c;
  },
  down(x, y) {
    const i = this.cellAt(x, y);
    if (i < 0) return;
    const cell = s.size / s.n, cx = s.ox + (i % s.n + 0.5) * cell, cy = s.oy + (Math.floor(i / s.n) + 0.5) * cell;
    if (i === s.odd) {
      E.setScore(s.stage);
      E.burst(cx, cy, `hsl(${s.h} ${s.sat}% ${s.l2}%)`, 12, 220);
      E.sfx.note(62 + Math.min(s.stage, 24), 0.15, 0.16); E.haptic('light');
      this.next(s.stage + 1);
    } else {
      s.left = Math.max(0, s.left - 3); s.wrong++;
      s.fx = { i, t: 0.35 };
      E.popup('-3초', cx, cy - 20, '#FF5A79', 20);
      E.sfx.wrong(); E.haptic('error'); E.shake(5);
    }
  },

  update(dt) {
    s.left -= dt; s.pop = Math.min(1, s.pop + dt / 0.2);
    if (s.fx) { s.fx.t -= dt; if (s.fx.t <= 0) s.fx = null; }
    E.hud({ bar: s.left / TIME, barColor: s.left < 10 ? '#FF5A79' : '#E85DFF', right: Math.ceil(Math.max(0, s.left)) + '초' });
    if (s.left <= 0) {
      s.reveal = true;
      E.sfx.lose();
      return E.end(null, { delay: 1.2, title: '시간 종료', stats: [['통과', (s.stage - 1) + '라운드'], ['마지막 칸', `${s.n}×${s.n}`], ['실수', s.wrong + '회']] });
    }
  },

  draw(c) {
    const { n, ox, oy, size } = s, cell = size / n, gap = Math.max(3, cell * 0.07), k = 0.85 + 0.15 * s.pop;
    c.fillStyle = 'rgba(255,255,255,.04)'; E.rr(ox - 8, oy - 8, size + 16, size + 16, 20); c.fill();
    const base = `hsl(${s.h} ${s.sat}% ${s.l}%)`, odd = `hsl(${s.h} ${s.sat}% ${s.l2}%)`;
    for (let i = 0; i < n * n; i++) {
      const x = ox + (i % n) * cell + cell / 2, y = oy + Math.floor(i / n) * cell + cell / 2;
      let w = (cell - gap) * k;
      if (s.fx && s.fx.i === i) w *= 0.9;
      c.fillStyle = i === s.odd ? odd : base;
      E.rr(x - w / 2, y - w / 2, w, w, Math.max(6, w * 0.18)); c.fill();
      if (s.fx && s.fx.i === i) { c.strokeStyle = '#FF5A79'; c.lineWidth = 3; c.stroke(); }
      if (s.reveal && i === s.odd) { c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke(); }
    }
    E.text(`${n}×${n}`, E.W / 2, oy + size + 26, 13, 'rgba(255,255,255,.4)', 800);
  },
};
