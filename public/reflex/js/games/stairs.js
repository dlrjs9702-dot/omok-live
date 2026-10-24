import { E } from '../engine.js';
import { clamp } from '../util.js';

// R7 계단 질주(가칭) (gamecenter-notes IDEAS #future-stair-dash): an endless stair up into the island's sky with two buttons
// -- 왼쪽 위 / 오른쪽 위. Each press is a step that way; the wrong way is a slip and the round ends. A breath bar runs down
// faster the higher you are, and every step gives a little back (a flower step more). Only the idea of climbing stairs
// with two quick inputs is borrowed: the island's own climber, sky, rules and look.
let s;
// drain: the breath lost a second at the bottom, grow: more per step climbed; run: how many steps go one way before it may
// turn (shorter: more turns); gain: given back by a step
const LV = { easy: { drain: 0.13, grow: 0.0006, run: [2, 6], gain: 0.07 }, normal: { drain: 0.17, grow: 0.0009, run: [1, 5], gain: 0.065 }, hard: { drain: 0.21, grow: 0.0012, run: [1, 4], gain: 0.06 } };
const FLOWER = 40; // every 40th step a flower step: more breath back
const SKY = [[0, '#7cc8f2', '#d9f1ff'], [150, '#f2a46c', '#ffd8b0'], [300, '#3a3d7a', '#8b74b8'], [450, '#0d1030', '#2a2a5c']]; // by height

const lerp = (a, b, k) => a + (b - a) * k;
const mix = (h1, h2, k) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const a = p(h1); const b = p(h2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`; };
const skyAt = (n) => { let i = 0; while (i < SKY.length - 2 && n >= SKY[i + 1][0]) i += 1; const a = SKY[i]; const b = SKY[i + 1]; const k = clamp((n - a[0]) / (b[0] - a[0]), 0, 1); return [mix(a[1], b[1], k), mix(a[2], b[2], k)]; };

function grow(s) { // the next step's column: a run one way, then a turn (made on ahead as you climb)
  if (s.left <= 0) { s.dir = -s.dir; s.left = s.L.run[0] + Math.floor(Math.random() * (s.L.run[1] - s.L.run[0] + 1)); }
  s.cols.push(s.cols[s.cols.length - 1] + s.dir); s.left -= 1;
}

export default {
  id: 'stairs', name: '계단 질주', cat: 'reflex',
  color: '#38bdf8', c2: '#0ea5e9', c3: '#0c4a6e',
  tagline: '왼쪽·오른쪽 두 버튼으로 끝없는 하늘 계단을 올라요',
  howto: [['tap', '다음 계단이 있는 쪽을 누르면 한 칸 올라요 (PC는 ← → 또는 A D)'], ['avoid', '반대쪽을 누르면 헛디뎌요'], ['clock', '숨 막대가 줄어요 — 오를수록 빨리 줄고, 한 칸 오를 때마다 조금 차요 (꽃 발판은 많이)']],
  customRight: true, hudBar: true, keyRepeat: false,
  bg: '#7cc8f2',
  levels: true, levelLegacy: 'normal',
  levelNote: '쉬움: 숨이 천천히 줄고 방향이 덜 바뀌어요 · 어려움: 숨이 빨리 줄고 방향이 자주 바뀌어요 — 난이도마다 최고 기록과 랭킹이 따로예요',

  init() {
    const L = LV[E.level] || LV.normal;
    s = { L, cols: [0], dir: 1, left: 2, at: 0, breath: 1, started: false, hop: 1, from: 0, cam: 0, fall: null, flowers: 0, firstAt: 0, puffs: [], clouds: Array.from({ length: 7 }, () => ({ x: Math.random(), y: Math.random(), w: 60 + Math.random() * 90, k: 0.2 + Math.random() * 0.5 })) };
    while (s.cols.length < 48) grow(s);
    E.setScore(0);
    E.hud({ bar: 1, barColor: '#3DDC97', right: '0계단' });
  },
  size() { const sw = clamp(Math.min(E.W / 7.5, (E.bottom - E.top) / 9), 44, 96); return { sw, sh: sw * 0.62 }; },

  step(dir) {
    if (!s || s.fall) return;
    while (s.cols.length < s.at + 48) grow(s);
    const want = s.cols[s.at + 1] - s.cols[s.at];
    if (dir !== want) { // a slip: the climber tumbles off that side
      s.fall = { dir, t: 0 }; E.shake(10); E.haptic('error'); E.sfx.wrong(); return;
    }
    if (!s.started) { s.started = true; s.firstAt = E.t; }
    s.from = s.at; s.at += 1; s.hop = 0;
    const flower = s.at % FLOWER === 0;
    s.breath = Math.min(1, s.breath + s.L.gain + (flower ? 0.3 : 0));
    if (flower) { s.flowers += 1; E.sfx.point(); } else E.sfx.move();
    E.haptic('light');
    E.setScore(s.at);
    s.puffs.push({ i: s.at, t: 0 });
  },
  down(x) { this.step(x < E.W / 2 ? -1 : 1); },
  peek() { return s && { at: s.at, next: s.cols[s.at + 1] - s.cols[s.at], breath: s.breath }; }, // (tests: the way up)
  key(k) { if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.step(-1); else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.step(1); },

  finish(why) {
    const secs = Math.max(0.001, E.t - s.firstAt);
    E.end(null, { title: why, stats: [['오른 계단', `${s.at}칸`], ['꽃 발판', `${s.flowers}개`], ['평균 속도', `${(s.at / secs).toFixed(1)}칸/초`]] });
  },

  update(dt) {
    s.hop = Math.min(1, s.hop + dt / 0.07); // the hop: 70 ms, the step itself counts at once
    s.puffs = s.puffs.filter((p) => (p.t += dt) < 0.4);
    if (s.fall) { s.fall.t += dt; if (s.fall.t > 0.55 && E.state === 'play') this.finish('헛디뎠어요!'); return; }
    if (s.started) {
      s.breath -= (s.L.drain + s.L.grow * s.at) * dt;
      if (s.breath <= 0) { s.breath = 0; s.fall = { dir: 0, t: 0.3 }; E.sfx.lose(); E.haptic('error'); return; }
    }
    E.hud({ bar: s.breath, barColor: s.breath > 0.5 ? '#3DDC97' : s.breath > 0.25 ? '#FFCB57' : '#FF5A79', right: `${s.at}계단` });
    const { sh } = this.size();
    s.cam = lerp(s.cam, s.at * sh, Math.min(1, dt * 14));
  },

  draw(c) {
    const { W, H } = E; const { sw, sh } = this.size();
    const [top, low] = skyAt(s.at);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (s.at > 300) { c.fillStyle = `rgba(255,255,255,${clamp((s.at - 300) / 150, 0, 0.8)})`; for (let i = 0; i < 40; i += 1) { const x = (i * 97.3) % W; const y = ((i * 53.7 + s.cam * 0.05) % H); c.fillRect(x, y, 2, 2); } }
    for (const cl of s.clouds) { // clouds slide down as you climb: the speed
      const y = ((cl.y * H + s.cam * cl.k) % (H + 80)) - 40; const x = cl.x * W;
      c.fillStyle = `rgba(255,255,255,${s.at > 300 ? 0.12 : 0.55})`; E.rr(x - cl.w / 2, y, cl.w, cl.w * 0.32, cl.w * 0.16); c.fill();
    }
    // the stair: the climber's step at the screen's lower middle, the rest up from it
    const baseY = E.bottom - 64 - sh * 2.4; /* (above the two buttons) */ const camCol = lerp(s.cols[s.from] ?? 0, s.cols[s.at] ?? 0, s.hop);
    const sx = (i) => W / 2 + (s.cols[i] - camCol) * sw; const sy = (i) => baseY - (i * sh - s.cam);
    const first = Math.max(0, s.at - 6); const last = Math.min(s.cols.length - 1, s.at + Math.ceil(baseY / sh) + 2);
    for (let i = last; i >= first; i -= 1) {
      const x = sx(i); const y = sy(i); if (y < -sh || y > H + sh) continue;
      const flower = i % FLOWER === 0 && i > 0;
      c.fillStyle = 'rgba(40,30,20,.18)'; E.rr(x - sw * 0.5 + 3, y + 5, sw, sh * 0.5, 6); c.fill(); // shade
      c.fillStyle = flower ? '#f7b6c8' : i <= s.at ? '#c79a62' : '#d8ab6f'; E.rr(x - sw * 0.5, y, sw, sh * 0.5, 6); c.fill(); // the plank
      c.fillStyle = flower ? '#ffd6e2' : '#8fd17a'; E.rr(x - sw * 0.5, y - 3, sw, 6, 3); c.fill(); // its grassy top
      if (flower) { for (const dx of [-0.25, 0, 0.25]) { c.fillStyle = '#ff6f9c'; c.beginPath(); c.arc(x + dx * sw, y - 5, sw * 0.06, 0, 6.283); c.fill(); } }
    }
    for (const p of s.puffs) { const k = p.t / 0.4; c.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; c.beginPath(); c.arc(sx(p.i), sy(p.i) - 2, sw * (0.15 + k * 0.25), 0, 6.283); c.fill(); }
    // the climber: a round islander with a scarf, hopping from the last step
    const hopK = s.hop; let px = lerp(sx(s.from), sx(s.at), hopK); let py = lerp(sy(s.from), sy(s.at), hopK) - Math.sin(hopK * Math.PI) * sh * 0.6;
    let rot = 0;
    if (s.fall) { const t = s.fall.t; px += s.fall.dir * t * sw * 2.2; py += t * t * H * 1.4; rot = s.fall.dir * t * 7; }
    const r = sw * 0.3; const faceDir = s.cols[s.at + 1] != null ? Math.sign(s.cols[s.at + 1] - s.cols[s.at]) || 1 : 1;
    c.save(); c.translate(px, py - r * 1.2); c.rotate(rot);
    c.fillStyle = '#2b6f4f'; E.rr(-r * 0.7, r * 0.55, r * 0.5, r * 0.6, r * 0.2); c.fill(); E.rr(r * 0.2, r * 0.55, r * 0.5, r * 0.6, r * 0.2); c.fill(); // legs
    c.fillStyle = '#4fc3a1'; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill(); // body
    c.fillStyle = '#f2c94c'; E.rr(-r * 0.95, -r * 0.2, r * 1.9, r * 0.32, r * 0.16); c.fill(); // scarf
    c.beginPath(); c.moveTo(-faceDir * r * 0.8, -r * 0.05); c.lineTo(-faceDir * r * 1.5, r * 0.1 + Math.sin(E.t * 18) * r * 0.12); c.lineTo(-faceDir * r * 1.4, r * 0.32); c.closePath(); c.fill(); // its end, flapping behind
    c.fillStyle = '#10131a'; c.beginPath(); c.arc(faceDir * r * 0.35, -r * 0.45, r * 0.11, 0, 6.283); c.fill(); c.beginPath(); c.arc(faceDir * r * 0.05, -r * 0.45, r * 0.11, 0, 6.283); c.fill(); // eyes, looking the way it goes
    c.restore();
    // the two buttons (a phone presses its halves; on a PC they say the keys)
    const by = E.bottom - 64; const bw = Math.min(W * 0.42, 260);
    for (const [dir, x] of [[-1, W / 2 - bw - 10], [1, W / 2 + 10]]) {
      const lit = s.fall == null && s.cols[s.at + 1] - s.cols[s.at] === dir && s.at < 3; // (the first steps show the way)
      c.fillStyle = lit ? 'rgba(15,23,42,.62)' : 'rgba(15,23,42,.42)'; E.rr(x, by, bw, 56, 18); c.fill(); // (dark: readable on a day sky too)
      E.text(dir < 0 ? '◀  왼쪽 위' : '오른쪽 위  ▶', x + bw / 2, by + 28, 18, '#fff', 900);
    }
    if (!s.started && !s.fall) E.text('다음 계단이 있는 쪽을 누르세요', W / 2, E.top + 40, 17, 'rgba(255,255,255,.95)', 800);
  },
};
