import { E } from '../engine.js';
import { rand } from '../util.js';

let s;
const ROUNDS = 5, GOAL = 300;
const tier = (ms) => (ms < 200 ? '번개' : ms < 250 ? '매우 빠름' : ms < 300 ? '빠름' : ms < 360 ? '보통' : '느긋함');

export default {
  id: 'reaction', name: '반응속도', cat: 'reflex',
  color: '#22C55E', c2: '#0EA5A0', c3: '#0B5A2B',
  tagline: '화면이 초록색으로 바뀌는 순간 탭하세요',
  howto: [['clock', '빨간 화면에서 기다리다가'], ['tap', '초록색으로 바뀌면 최대한 빨리 탭!'], ['avoid', '미리 누르면 그 라운드는 다시 해요. 총 5라운드']],
  unit: 'ms', lowerBetter: true,
  hideScore: true, customRight: true, hudLabel: '라운드', noTint: true,

  init() {
    s = { round: 0, times: [], phase: 'wait', wait: rand(1.4, 3.2), goAt: 0, last: 0, early: 0, anim: 0 };
    this.hudUpdate();
  },
  resume() { if (s.phase === 'wait' || s.phase === 'go') { s.phase = 'wait'; s.wait = rand(1.2, 2.6); } },
  hudUpdate() {
    const best = s.times.length ? Math.min(...s.times) : null;
    E.hud({ center: `${Math.min(s.round + 1, ROUNDS)} / ${ROUNDS}`, right: best != null ? '최고 ' + best + 'ms' : '' });
  },

  down() {
    // 90ms 미만은 사람이 반응할 수 없는 속도 → 예측 입력으로 보고 부정 출발 처리
    if (s.phase === 'wait' || (s.phase === 'go' && performance.now() - s.goAt < 90)) {
      s.phase = 'early'; s.early++;
      E.sfx.wrong(); E.haptic('error'); E.shake(6);
    } else if (s.phase === 'go') {
      const ms = Math.round(performance.now() - s.goAt);
      s.times.push(ms); s.last = ms; s.round++; s.phase = 'show'; s.anim = 0;
      E.sfx.score(); E.haptic('medium');
      this.hudUpdate();
    } else if (s.phase === 'show') {
      if (s.anim < 0.25) return;
      if (s.round >= ROUNDS) return this.finish();
      s.phase = 'wait'; s.wait = rand(1.4, 3.4);
    } else if (s.phase === 'early') {
      s.phase = 'wait'; s.wait = rand(1.4, 3.2);
    }
  },
  key(k) { if (k === ' ' || k === 'Enter') this.down(); },

  finish() {
    const avg = Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length);
    E.end(null, {
      score: avg, delay: 0.1,
      stats: [['최고', Math.min(...s.times) + 'ms'], ['등급', tier(avg)], ['부정 출발', s.early + '회']],
    });
  },

  update(dt) {
    s.anim += dt;
    if (s.phase === 'wait') {
      s.wait -= dt;
      if (s.wait <= 0) { s.phase = 'go'; s.goAt = performance.now(); }
    }
  },

  draw(c) {
    const { W, H } = E, cy = H * 0.48;
    const bg = { wait: '#B3163C', go: '#16C65A', show: '#101228', early: '#2A1030' }[s.phase];
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, cy, 0, W / 2, cy, H * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    if (s.phase === 'wait') {
      const p = 1 + Math.sin(performance.now() / 260) * 0.04;
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3;
      c.beginPath(); c.arc(W / 2, cy - 70, 38 * p, 0, 6.283); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(W / 2 - 3, cy - 90, 6, 22); c.fillRect(W / 2 - 3, cy - 64, 6, 6);
      E.text('기다리세요…', W / 2, cy + 6, 36, '#fff', 900);
      E.text('초록색이 되면 탭!', W / 2, cy + 48, 16, 'rgba(255,255,255,.75)', 700);
    } else if (s.phase === 'go') {
      E.text('탭!', W / 2, cy, 88, '#fff', 900);
    } else if (s.phase === 'early') {
      E.text('너무 빨라요!', W / 2, cy - 10, 34, '#FF7A93', 900);
      E.text('탭해서 이번 라운드 다시하기', W / 2, cy + 34, 16, 'rgba(255,255,255,.7)', 700);
    } else {
      const k = Math.min(1, s.anim / 0.3), col = s.last <= GOAL ? '#3DDC97' : '#FFCB57';
      c.globalAlpha = k;
      E.text(String(s.last), W / 2, cy - 18, 84 + (1 - k) * 20, '#fff', 900);
      E.text('ms', W / 2, cy + 36, 20, 'rgba(255,255,255,.6)', 800);
      E.text(tier(s.last), W / 2, cy + 76, 18, col, 800);
      // 라운드 점
      for (let i = 0; i < ROUNDS; i++) {
        c.fillStyle = i < s.times.length ? (s.times[i] <= GOAL ? '#3DDC97' : '#FFCB57') : 'rgba(255,255,255,.18)';
        c.beginPath(); c.arc(W / 2 + (i - 2) * 22, cy + 122, 6, 0, 6.283); c.fill();
      }
      E.text(s.round >= ROUNDS ? '탭해서 결과 보기' : '탭해서 다음 라운드', W / 2, cy + 170, 15, 'rgba(255,255,255,.55)', 700);
      c.globalAlpha = 1;
    }
  },
};
