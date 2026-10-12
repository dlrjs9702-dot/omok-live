import { E } from '../engine.js';
import { clamp } from '../util.js';

let s;
const LEN = 60, BPM = 120, LEAD = 2;
// 난이도: 노트 수(배율) · 엇박 노트가 나오기 시작하는 곡 진행(0~1) · 동시 노트 확률 · 노트가 떨어지는 시간(초)
const LV = { easy: { dens: 0.7, off: 0.5, chord: 0, travel: 1.7 }, normal: { dens: 1, off: 0.25, chord: 0.16, travel: 1.35 }, hard: { dens: 1.25, off: 0.15, chord: 0.3, travel: 1.05 } };
const LANE_C = ['#FF4FA3', '#A66CFF', '#35C8FF', '#FFC43D'];
const LANE_N = [60, 64, 67, 72];
const J = [[0.05, 'PERFECT', 100, '#FFE45C', 3], [0.1, 'GREAT', 70, '#6FFFE9', 1], [0.15, 'GOOD', 40, '#A9AECF', 0]];

function chart(L) {
  const notes = [], beat = 60 / BPM;
  let prev = -1;
  for (let i = 0; ; i++) {
    const t = LEAD + (i * beat) / 2;
    if (t > LEN - 1) break;
    const ph = t / LEN, onBeat = i % 2 === 0;
    const p = Math.min(0.97, (onBeat ? 0.55 + ph * 0.4 : ph > L.off ? 0.12 + ph * 0.45 : 0) * L.dens);
    if (Math.random() >= p) continue;
    let lane;
    do lane = Math.floor(Math.random() * 4); while (lane === prev && Math.random() < 0.7);
    prev = lane;
    notes.push({ t, lane });
    if (onBeat && ph > 0.5 && Math.random() < L.chord) notes.push({ t, lane: (lane + 1 + Math.floor(Math.random() * 3)) % 4 });
  }
  return notes;
}

export default {
  id: 'rhythm', name: '비트 탭', cat: 'reflex',
  color: '#FF4FA3', c2: '#8A4BFF', c3: '#6A0F45',
  tagline: '비트에 맞춰 떨어지는 노트를 탭하세요',
  howto: [['music', '노트가 판정선에 닿는 순간 그 줄을 탭해요'], ['tap', '여러 손가락으로 동시에 탭할 수 있어요'], ['heart', '놓치면 체력이 줄어요. 60초 곡을 끝까지 버텨 보세요']],
  customRight: true, hudBar: true,
  bg: '#0E0718',
  levels: true, levelLegacy: 'normal',
  levelNote: '쉬움: 노트가 적고 천천히 떨어져요 · 어려움: 노트가 많고(동시 노트 포함) 빨리 떨어져요 — 난이도마다 최고 기록과 랭킹이 따로예요',

  init() {
    const L = LV[E.level] || LV.normal;
    s = { L, travel: L.travel, notes: chart(L), hp: 100, combo: 0, maxCombo: 0, cnt: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 }, press: [0, 0, 0, 0], judge: null, beatI: -1 };
    this.layout();
    E.hud({ bar: 1, barColor: '#3DDC97', right: '1:00' });
  },
  layout() {
    s.lw = Math.min(E.W, 480) / 4;
    s.ox = (E.W - s.lw * 4) / 2;
    s.hitY = E.bottom - 96;
  },
  laneAt(x) { return clamp(Math.floor((x - s.ox) / s.lw), 0, 3); },

  hit(lane) {
    s.press[lane] = 1;
    let best = null, bd = 1;
    for (const n of s.notes) {
      if (n.lane !== lane || n.done) continue;
      const d = Math.abs(n.t - E.t);
      if (d < bd) { bd = d; best = n; }
    }
    const j = best && J.find((j) => bd <= j[0]);
    if (!j) return;
    best.done = true;
    s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.cnt[j[1]]++;
    s.hp = clamp(s.hp + j[4], 0, 100);
    E.setScore(E.score + j[2] + Math.min(s.combo, 50) * 2);
    s.judge = { text: j[1], color: j[3], t: 0.45 };
    const x = s.ox + (lane + 0.5) * s.lw;
    E.burst(x, s.hitY, LANE_C[lane], j[1] === 'PERFECT' ? 16 : 9, 240);
    E.sfx.note(LANE_N[lane] + (s.combo % 8 === 0 ? 12 : 0), 0.22, 0.18);
    E.haptic('light');
  },
  down(x) { if (x > s.ox - 20 && x < s.ox + s.lw * 4 + 20) this.hit(this.laneAt(x)); },
  key(k) { const m = { d: 0, f: 1, j: 2, k: 3 }; if (k in m) this.hit(m[k]); },

  update(dt) {
    // 배경 비트
    const bi = Math.floor((E.t - LEAD) / (60 / BPM / 2));
    if (bi !== s.beatI && E.t >= LEAD && E.t < LEN) { s.beatI = bi; if (bi % 2 === 0) E.sfx.kick(); else E.sfx.hat(); }

    for (let i = 0; i < 4; i++) s.press[i] = Math.max(0, s.press[i] - dt * 5);
    if (s.judge) { s.judge.t -= dt; if (s.judge.t <= 0) s.judge = null; }

    for (const n of s.notes) {
      if (!n.done && E.t - n.t > 0.15) {
        n.done = n.miss = true;
        s.combo = 0; s.cnt.MISS++; s.hp -= 10;
        s.judge = { text: 'MISS', color: '#FF5A79', t: 0.45 };
        E.haptic('medium');
      }
    }
    s.notes = s.notes.filter((n) => !n.done || E.t - n.t < 0.3);
    const left = Math.max(0, LEN - E.t);
    E.hud({ bar: s.hp / 100, barColor: s.hp > 50 ? '#3DDC97' : s.hp > 25 ? '#FFCB57' : '#FF5A79', right: `0:${String(Math.ceil(left)).padStart(2, '0')}` });

    const stats = () => [['최대 콤보', s.maxCombo], ['PERFECT', s.cnt.PERFECT], ['MISS', s.cnt.MISS]];
    if (s.hp <= 0) { s.hp = 0; E.shake(12); E.sfx.lose(); return E.end(null, { stats: stats() }); }
    if (E.t >= LEN + 0.5) return E.end(null, { title: '완주!', stats: stats() });
  },

  draw(c) {
    const { lw, ox, hitY } = s;
    const speed = (hitY - E.top + 40) / s.travel;
    for (let i = 0; i < 4; i++) {
      const x = ox + i * lw;
      const g = c.createLinearGradient(0, E.top, 0, hitY);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${0.04 + s.press[i] * 0.12})`);
      c.fillStyle = g; c.fillRect(x + 2, E.top - 40, lw - 4, hitY - E.top + 40);
      c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x, E.top - 40, 1, E.H);
    }
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(ox + 4 * lw, E.top - 40, 1, E.H);

    // 판정선 + 패드
    E.glow(E.W / 2, hitY, lw * 2.4, '#FF4FA3', 0.12);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(ox, hitY - 1.5, lw * 4, 3);
    for (let i = 0; i < 4; i++) {
      const cx = ox + (i + 0.5) * lw, p = s.press[i];
      c.strokeStyle = LANE_C[i]; c.lineWidth = 3; c.globalAlpha = 0.5 + p * 0.5;
      c.beginPath(); c.arc(cx, hitY, lw * 0.3 + p * 4, 0, 6.283); c.stroke();
      if (p) { E.glow(cx, hitY, lw * 0.6, LANE_C[i], p * 0.8); }
      c.globalAlpha = 0.25 + p * 0.5; c.fillStyle = LANE_C[i];
      E.rr(cx - lw * 0.36, hitY + 38, lw * 0.72, 30, 12); c.fill();
      c.globalAlpha = 1;
    }

    // 노트
    for (const n of s.notes) {
      if (n.done && !n.miss) continue;
      const y = hitY - (n.t - E.t) * speed;
      if (y < E.top - 50) continue;
      const cx = ox + (n.lane + 0.5) * lw, w = lw * 0.7;
      c.globalAlpha = n.miss ? 0.25 : 1;
      if (!n.miss) E.glow(cx, y, w * 0.8, LANE_C[n.lane], 0.45);
      c.fillStyle = LANE_C[n.lane]; E.rr(cx - w / 2, y - 11, w, 22, 11); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; E.rr(cx - w / 2 + 6, y - 7, w - 12, 5, 3); c.fill();
      c.globalAlpha = 1;
    }

    // 콤보 / 판정
    if (s.combo >= 3) {
      E.text(String(s.combo), E.W / 2, E.H * 0.42, 72, 'rgba(255,255,255,.1)', 900);
      E.text('COMBO', E.W / 2, E.H * 0.42 + 46, 14, 'rgba(255,255,255,.2)', 800);
    }
    if (s.judge) {
      const k = s.judge.t / 0.45;
      c.globalAlpha = Math.min(1, k * 2);
      E.text(s.judge.text, E.W / 2, hitY - 90 - (1 - k) * 12, 26 + (1 - k) * 4, s.judge.color, 900);
      c.globalAlpha = 1;
    }
    if (E.t < LEAD) {
      const n = Math.ceil(LEAD - E.t);
      E.text(String(n), E.W / 2, E.H * 0.4, 64, 'rgba(255,255,255,.85)', 900);
    }
  },
};
