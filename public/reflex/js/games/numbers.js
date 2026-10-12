import { E } from '../engine.js';
import { shuffle } from '../util.js';

let s, N = 5;
const SIZE = { easy: 4, normal: 5, hard: 6 };
// 판이 뜨면 이만큼(초) 숫자 위치를 외울 수 있고, 그다음 시간이 자동으로 흐른다
// (예전에는 1을 누를 때 시계가 시작돼서 판을 얼마든지 오래 보고 외울 수 있었다)
const PREVIEW = { easy: 5, normal: 4, hard: 3 };

export default {
  id: 'numbers', name: '숫자 터치', cat: 'reflex',
  color: '#38BDF8', c2: '#6366F1', c3: '#0B3A66',
  tagline: '1부터 끝 숫자까지 순서대로 빠르게 터치하세요',
  howto: [['tap', '1부터 끝 숫자까지 순서대로 탭해요 (보통은 25까지)'], ['clock', '시작하면 몇 초 동안 숫자 위치를 외울 수 있어요 (4×4 5초 · 5×5 4초 · 6×6 3초). 그다음 시간이 흘러요'], ['avoid', '틀린 숫자를 누르면 1초 벌칙']],
  unit: 'sec', lowerBetter: true,
  hideScore: true, customRight: true, hudLabel: '시간',
  levels: true, levelLegacy: 'normal', levelTitle: '판 크기',
  levelNames: { easy: '4×4', normal: '5×5', hard: '6×6' },
  levelNote: '4×4: 1~16 · 5×5: 1~25 · 6×6: 1~36 — 판 크기마다 최고 기록과 랭킹이 따로예요',

  init() {
    N = SIZE[E.level] || 5;
    s = { N, nums: shuffle(Array.from({ length: N * N }, (_, i) => i + 1)), next: 1, started: false, prep: PREVIEW[E.level] || 4, time: 0, penalty: 0, wrong: 0, fx: {} };
    this.layout();
    this.hudUpdate();
  },
  layout() {
    const size = Math.min(E.W - 28, E.bottom - E.top - 20, 480);
    s.size = size; s.cell = size / N;
    s.ox = (E.W - size) / 2; s.oy = E.top + (E.bottom - E.top - size) / 2;
  },
  hudUpdate() {
    E.hud({ center: s.started ? (s.time + s.penalty).toFixed(1) : `외우기 ${Math.ceil(s.prep)}`, right: s.next <= N * N ? '다음 ' + s.next : '' });
  },

  down(x, y) {
    if (!s.started) return; // 외우는 시간에는 누르지 않는다
    const c = Math.floor((x - s.ox) / s.cell), r = Math.floor((y - s.oy) / s.cell);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const i = r * N + c, v = s.nums[i];
    if (v < s.next) return;
    const cx = s.ox + (c + 0.5) * s.cell, cy = s.oy + (r + 0.5) * s.cell;
    if (v === s.next) {
      s.fx[i] = { t: 0.3, ok: true };
      s.next++;
      E.burst(cx, cy, '#7DD3FC', 8, 160, 2.5);
      E.sfx.note(60 + ((v - 1) % 12) + Math.floor((v - 1) / 12) * 12, 0.12, 0.14);
      E.haptic('light');
      if (s.next > N * N) {
        const ms = Math.round((s.time + s.penalty) * 1000);
        E.sfx.win();
        return E.end(null, { score: ms, delay: 0.5, stats: [['순수 시간', s.time.toFixed(1) + '초'], ['실수', s.wrong + '회'], ['벌칙', '+' + s.penalty + '초']] });
      }
    } else {
      s.penalty += 1; s.wrong++;
      s.fx[i] = { t: 0.35, ok: false };
      E.popup('+1초', cx, cy - 30, '#FF5A79', 18);
      E.sfx.wrong(); E.haptic('error');
    }
    this.hudUpdate();
  },

  update(dt) {
    if (!s.started) {
      const before = Math.ceil(s.prep);
      s.prep -= dt;
      if (s.prep <= 0) { s.started = true; E.sfx.goal(); E.haptic('medium'); E.banner('시작!', 'bolt', 700); }
      else if (Math.ceil(s.prep) !== before) E.sfx.tap();
    } else s.time += dt;
    for (const k in s.fx) { s.fx[k].t -= dt; if (s.fx[k].t <= 0) delete s.fx[k]; }
    this.hudUpdate();
  },

  draw(c) {
    const { cell, ox, oy } = s, pad = 5;
    for (let i = 0; i < N * N; i++) {
      const v = s.nums[i], done = v < s.next, fx = s.fx[i];
      let x = ox + (i % N) * cell, y = oy + Math.floor(i / N) * cell;
      if (fx && !fx.ok) x += Math.sin(fx.t * 60) * 5 * (fx.t / 0.35);
      const k = fx && fx.ok ? 1 + fx.t * 0.4 : 1;
      c.save(); c.translate(x + cell / 2, y + cell / 2); c.scale(k, k);
      if (done) {
        c.globalAlpha = fx ? fx.t / 0.3 : 0;
        c.fillStyle = '#38BDF8';
        E.rr(-cell / 2 + pad, -cell / 2 + pad, cell - pad * 2, cell - pad * 2, 14); c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(56,189,248,.18)'; c.lineWidth = 1.5;
        E.rr(-cell / 2 + pad, -cell / 2 + pad, cell - pad * 2, cell - pad * 2, 14); c.stroke();
      } else {
        const g = c.createLinearGradient(0, -cell / 2, 0, cell / 2);
        g.addColorStop(0, fx && !fx.ok ? '#5A1E36' : '#1F2547'); g.addColorStop(1, fx && !fx.ok ? '#3A1024' : '#171B38');
        c.fillStyle = g;
        E.rr(-cell / 2 + pad, -cell / 2 + pad, cell - pad * 2, cell - pad * 2, 14); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.stroke();
        E.text(String(v), 0, 1, cell * 0.36, '#F4F5FC', 800);
      }
      c.restore();
    }
    if (!s.started) {
      c.globalAlpha = 0.6 + Math.sin(performance.now() / 300) * 0.4;
      E.text(`숫자 위치를 외우세요 · ${Math.ceil(s.prep)}초 뒤 시작`, E.W / 2, s.oy + s.size + 30, 15, '#7DD3FC', 700);
      c.globalAlpha = 1;
    }
  },
};
