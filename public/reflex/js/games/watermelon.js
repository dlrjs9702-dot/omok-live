// 수박 만들기: 위에서 과일을 떨어뜨려 같은 과일끼리 닿으면 한 단계 큰 과일로 합쳐진다 · 상자 위 선을 넘겨 쌓이면 끝
// · 두 가지(2026-10-26 사용자 요청): 점수전(normal) = 넘칠 때까지 점수 · 기록전(hard) = 수박을 처음 만들 때까지 걸린 시간(빠를수록 1위 · 넘치면 기록 없음)
// · 과일 11단계: 블루베리 → 방울토마토 → 자두 → 귤 → 레몬 → 키위 → 망고 → 석류 → 코코넛 → 호박 → 수박 (수박 둘이 만나면 사라지며 보너스)
// · 과일 순서 · 그림은 우리 것 (2026-11-07 특허 · 저작권 점검: 예전 순서가 유명한 과일 합치기 게임과 똑같아 바꿈)
// · 떨어뜨리는 과일은 작은 5종 가운데 무작위 · 합쳐질 때 새 과일의 점수가 더해진다
// · 물리: 작은 걸음(한 장면을 8번 나눔)마다 중력 → 이동 → 겹침 풀기(무게는 넓이에 비례) → 벽 · 바닥
import { E } from '../engine.js';

// 규칙 숫자 (안내 글 · 시험이 같이 쓴다) — r: 상자 너비 대비 반지름 · pts: 그 과일이 만들어질 때 얻는 점수
export const WM = {
  names: ['블루베리', '방울토마토', '자두', '귤', '레몬', '키위', '망고', '석류', '코코넛', '호박', '수박'],
  r: [0.04, 0.053, 0.07, 0.083, 0.103, 0.127, 0.147, 0.17, 0.197, 0.227, 0.267],
  pts: [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
  bonus: 100, drop: 5, overT: 2, grace: 1, cooldown: 0.5, // grace: 떨어뜨린 지 이만큼(초) 안 된 과일은 선을 넘어도 세지 않는다
};
const COL = ['#4A5BD9', '#F0453A', '#9A3A8C', '#FFA62B', '#F2D63A', '#8C6B3E', '#FFC23D', '#C8243F', '#7A5232', '#F27B1A', '#2FA84F'];
const DROP_W = [0.3, 0.27, 0.2, 0.14, 0.09]; // 떨어뜨리는 과일(작은 5종)이 나올 비율
// 과일 그림: 빛 받는 쪽(밝게) · 그림자 쪽(어둡게) 색
const mix = (hex, to, k) => { const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16)); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const LIGHT = COL.map((c) => mix(c, '#ffffff', 0.38)), DARK = COL.map((c) => mix(c, '#1a0612', 0.38));
const TAU = Math.PI * 2;

let s;
const PHYS_H = 1 / 480; // 물리 한 단계 (초) — 60Hz 한 장면 = 8단계 (예전 계산과 같음)
// 시드 난수(E.rand): 같은 시드 = 같은 과일 순서 (같은 판 도전장)
const rnd = () => { let x = (E.rand || Math.random)(), i = 0; for (; i < DROP_W.length - 1; i++) { if (x < DROP_W[i]) break; x -= DROP_W[i]; } return i; };

export default {
  id: 'watermelon', name: '수박 만들기', cat: 'puzzle',
  color: '#2FA84F', c2: '#FF5A79', c3: '#0E3B1C',
  tagline: '같은 과일을 합쳐 더 큰 과일, 마지막엔 수박을 만드세요',
  /* (게임 아일랜드 H1: 점수전 only for now -- our records keep one way per game (higher), the 기록전's time-lower-wins is for later) */
  levels: false,
  howto: [['drag', '좌우로 끌어 떨어뜨릴 자리를 정하고, 손을 떼면 과일이 떨어져요'], ['star', '같은 과일끼리 닿으면 한 단계 큰 과일로 합쳐져요'], ['avoid', '과일이 상자 위 점선을 넘은 채로 2초가 지나면 끝']],

  init() {
    s = { f: [], aim: 0.5, cur: rnd(), next: rnd(), cool: 0, merges: 0, drops: 0, maxT: 0, overT: 0, over: false, id: 0, held: false, rings: [], chain: 0, lastMerge: -9, race: E.level === 'hard', el: 0 };
    if (s.race) { E._hideScore = true; E.hud({ label: '걸린 시간 · 기록전', center: `${s.el.toFixed(1)}초` }); } // 기록전: 점수 대신 걸린 시간을 크게 보여 준다
    this.layout();
  },
  layout() {
    const avail = E.bottom - E.top;
    const w = Math.min(E.W - 24, 440, (avail - 120) / 1.35);
    const old = s.box;
    s.box = { x: (E.W - w) / 2, w, h: w * 1.35, y: E.top + Math.max(96, avail - w * 1.35 - 10) };
    s.line = s.box.y + s.box.h * 0.12; // 이 선 위로 넘치면 끝
    if (old && old.w !== w) { const k = w / old.w; for (const f of s.f) { f.x = s.box.x + (f.x - old.x) * k; f.y = s.box.y + (f.y - old.y) * k; f.r = WM.r[f.t] * w; } }
  },
  R(t) { return WM.r[t] * s.box.w; },
  aimX() { const r = this.R(s.cur); return Math.max(s.box.x + r, Math.min(s.box.x + s.box.w - r, s.box.x + s.aim * s.box.w)); },
  setAim(x) { s.aim = (x - s.box.x) / s.box.w; s.aim = Math.max(0, Math.min(1, s.aim)); },
  drop() {
    if (s.over || s.cool > 0) return;
    const r = this.R(s.cur);
    s.f.push({ id: s.id++, t: s.cur, x: this.aimX(), y: s.box.y - r - 6 + r * 0.2, vx: 0, vy: 0, r, born: 0 });
    s.drops++; s.cur = s.next; s.next = rnd(); s.cool = WM.cooldown;
    E.sfx.place?.();
  },

  // 겨누기는 처음 누른 손가락 하나로 · 취소(전화 · 알림 · 정지)는 떨어뜨리지 않는다 (GPT 게임별 검토 G02 · G09)
  down(x, y, id) { if (s.held) return; s.held = true; s.hid = id; this.setAim(x); },
  move(x, y, dx, dy, id) { if (s.held && id === s.hid) this.setAim(x); },
  up(x, y, id) { if (!s.held || id !== s.hid) return; s.held = false; this.drop(); E.acted?.(); },
  cancel(id) { if (s.held && (id == null || id === s.hid)) s.held = false; },
  key(k) { if (k === ' ' || k === 'ArrowDown' || k === 'Enter') this.drop(); },

  step(h) {
    const { box } = s, g = box.w * 2.6, left = box.x, right = box.x + box.w, floor = box.y + box.h;
    for (const f of s.f) { f.vy += g * h; f.x += f.vx * h; f.y += f.vy * h; }
    const merge = [];
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < s.f.length; i++) for (let j = i + 1; j < s.f.length; j++) {
        const a = s.f[i], b = s.f[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = rr - d;
        if (a.t === b.t && !a.dead && !b.dead && a.t < WM.r.length) { a.dead = b.dead = true; merge.push([a, b]); continue; }
        const ma = a.r * a.r, mb = b.r * b.r, wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.x -= nx * over * wa; a.y -= ny * over * wa; b.x += nx * over * wb; b.y += ny * over * wb;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const j2 = -1.1 * rv; a.vx -= j2 * nx * wa; a.vy -= j2 * ny * wa; b.vx += j2 * nx * wb; b.vy += j2 * ny * wb; }
      }
      for (const f of s.f) {
        if (f.x - f.r < left) { f.x = left + f.r; f.vx = Math.abs(f.vx) * 0.2; }
        if (f.x + f.r > right) { f.x = right - f.r; f.vx = -Math.abs(f.vx) * 0.2; }
        if (f.y + f.r > floor) { f.y = floor - f.r; f.vy = -Math.abs(f.vy) * 0.1; f.vx *= 0.92; }
      }
    }
    for (const f of s.f) { f.vx *= 0.995; f.vy *= 0.999; }
    if (!merge.length) return;
    for (const [a, b] of merge) {
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, t = a.t + 1;
      s.merges++;
      if (t >= WM.r.length) { // 수박 둘: 사라지며 보너스
        E.add(WM.bonus, x, y - 10, '#3DDC97'); E.banner('수박 두 개가 만나 사라졌어요!', 'star', 1600); E.burst(x, y, COL[10], 30, 320, 5);
        continue;
      }
      s.f.push({ id: s.id++, t, x, y, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2, r: this.R(t), born: 0, pop: 0.25 });
      if (t > s.maxT) { s.maxT = t; if (t >= 8 && !(s.race && t === 10)) E.banner(`${WM.names[t]} 완성!`, 'star', 1400); }
      // 기록전: 수박을 처음 만든 순간 그때까지 걸린 시간이 기록
      if (s.race && t === 10 && !s.over) {
        s.over = true;
        E.sfx.best?.(); E.burst(x, y, COL[10], 40, 380, 5);
        E.end(null, { score: Math.round(s.el * 1000), delay: 1.2, title: '수박 완성! 🍉', stats: [['걸린 시간', s.el.toFixed(1) + '초'], ['합친 횟수', s.merges + '번'], ['떨어뜨린 과일', s.drops + '개']] });
      }
      E.add(WM.pts[t], x, y - this.R(t), '#FFD35C');
      E.burst(x, y, COL[t], 10 + t * 2, 200, 3.5); E.burst(x, y, '#fff', 4 + t, 140, 2.5);
      s.rings.push({ x, y, r: this.R(t), t: 0.4, col: LIGHT[t] });
      s.chain = E.t - s.lastMerge < 0.7 ? s.chain + 1 : 1; s.lastMerge = E.t;
      if (s.chain >= 2) E.popup(`연쇄 ×${s.chain}`, x, y - this.R(t) - 26, '#FF9FD0', 18 + Math.min(s.chain, 6) * 2);
      if (t >= 6) E.shake(2 + (t - 6) * 1.5);
      E.sfx.note(52 + t * 3, 0.14, 0.18); E.haptic(t >= 6 ? 'medium' : 'light');
    }
    s.f = s.f.filter((f) => !f.dead);
  },

  update(dt) {
    if (s.over) return;
    // 물리는 고정 단계(PHYS_H)로 — 화면 갱신 횟수(20 · 60 · 120Hz)와 상관없이 같은 움직임 · 기록 시계 · 넘침 시간 · 떨어뜨리기 대기도 같은 게임 시간으로
    // (GPT 게임별 검토 G03: 장면마다 8번 나눠 같은 감속을 곱해서 빠른 화면일수록 더 느려졌고, 시계는 물리와 다른 속도로 흘렀다 · 60Hz에서는 예전과 같다)
    s.acc = Math.min((s.acc || 0) + dt, 1 / 30); // 한 장면에 따라잡는 상한은 예전과 같은 1/30초
    let steps = 0;
    while (s.acc >= PHYS_H - 1e-9 && steps < 16) { this.step(PHYS_H); s.acc -= PHYS_H; steps++; }
    const gt = steps * PHYS_H; // 이번 장면에 흐른 게임 시간
    if (s.race) s.el += gt;
    s.cool = Math.max(0, s.cool - gt);
    // PC: 방향키로 조준
    if (E.keys.ArrowLeft || E.keys.a) s.aim = Math.max(0, s.aim - dt * 0.6);
    if (E.keys.ArrowRight || E.keys.d) s.aim = Math.min(1, s.aim + dt * 0.6);
    // 넘침: 떨어뜨린 지 1초가 지난 과일이 선 위에 머물면 시간을 잰다
    let above = false;
    for (const g of s.rings) g.t -= dt;
    s.rings = s.rings.filter((g) => g.t > 0);
    for (const f of s.f) { f.born += gt; if (f.pop) f.pop = Math.max(0, f.pop - dt); if (f.born > WM.grace && f.y - f.r < s.line && Math.abs(f.vy) < s.box.w * 0.5) above = true; }
    s.overT = above ? s.overT + gt : Math.max(0, s.overT - gt * 2);
    if (s.over) return; // 이번 장면에 수박이 완성돼 기록전이 끝났으면
    E.hud(s.race ? { center: `${s.el.toFixed(1)}초`, right: WM.names[s.maxT] } : { right: WM.names[s.maxT] });
    if (s.overT >= WM.overT) {
      s.over = true;
      E.sfx.lose(); E.shake(6);
      E.end(null, { ...(s.race ? { score: null } : {}), delay: 1.2, title: s.race ? '상자가 넘쳤어요 · 수박까지 못 갔어요' : '상자가 넘쳤어요', stats: [['가장 큰 과일', WM.names[s.maxT]], ['합친 횟수', s.merges + '번'], ['떨어뜨린 과일', s.drops + '개']] });
    }
  },

  fruit(c, x, y, r, t, alpha = 1, happy = false) {
    c.save(); c.globalAlpha = alpha;
    // 몸통: 왼쪽 위에서 빛을 받는 둥근 입체
    const g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.02);
    g.addColorStop(0, LIGHT[t]); g.addColorStop(0.55, COL[t]); g.addColorStop(1, DARK[t]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    // 과일마다 무늬
    const dot = (dx, dy, rr, col) => { c.fillStyle = col; c.beginPath(); c.arc(x + dx * r, y + dy * r, Math.max(0.6, rr * r), 0, TAU); c.fill(); };
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    if (t === 0) for (let k = 0; k < 6; k++) dot(Math.cos(k * 1.9) * 0.45, Math.sin(k * 1.9) * 0.4, 0.09, 'rgba(220,230,255,.18)'); // 블루베리: 뽀얀 분
    else if (t === 2) { c.strokeStyle = 'rgba(70,10,60,.35)'; c.lineWidth = Math.max(1, r * 0.05); c.beginPath(); c.moveTo(x - r * 0.05, y - r); c.quadraticCurveTo(x + r * 0.35, y, x - r * 0.05, y + r); c.stroke(); for (let k = 0; k < 5; k++) dot(Math.cos(k * 2.3) * 0.5, Math.sin(k * 2.3) * 0.45, 0.12, 'rgba(255,220,255,.12)'); } // 자두: 골 · 뽀얀 분
    else if (t === 3 || t === 4) for (let k = 0; k < 16; k++) { const a = k * 2.4, d = 0.22 + (k % 4) * 0.18; dot(Math.cos(a) * d, Math.sin(a) * d, 0.03, t === 3 ? 'rgba(170,80,0,.35)' : 'rgba(150,120,0,.35)'); } // 귤 · 레몬: 오돌토돌한 껍질
    else if (t === 5) for (let k = 0; k < 40; k++) { const a = k * 2.39, d = Math.sqrt((k + 0.5) / 40) * 0.95; dot(Math.cos(a) * d, Math.sin(a) * d, 0.022, 'rgba(60,40,15,.45)'); } // 키위: 보송보송한 털
    else if (t === 6) { const b = c.createRadialGradient(x + r * 0.4, y + r * 0.35, 0, x + r * 0.4, y + r * 0.35, r * 0.9); b.addColorStop(0, 'rgba(255,70,60,.55)'); b.addColorStop(1, 'rgba(255,70,60,0)'); c.fillStyle = b; c.fillRect(x - r, y - r, r * 2, r * 2); const gq = c.createRadialGradient(x - r * 0.5, y - r * 0.55, 0, x - r * 0.5, y - r * 0.55, r * 0.7); gq.addColorStop(0, 'rgba(120,200,60,.45)'); gq.addColorStop(1, 'rgba(120,200,60,0)'); c.fillStyle = gq; c.fillRect(x - r, y - r, r * 2, r * 2); } // 망고: 붉은 볼 · 초록 기운
    else if (t === 7) for (let k = 0; k < 10; k++) { const d = 0.3 + (k % 3) * 0.18; dot(Math.cos(k * 2.1) * d, Math.sin(k * 2.1) * d, 0.05, 'rgba(255,200,200,.22)'); } // 석류: 반짝이는 점
    else if (t === 8) { c.strokeStyle = 'rgba(40,22,8,.5)'; c.lineWidth = Math.max(1, r * 0.03); for (let k = 0; k < 46; k++) { const a = k * 2.39, d = Math.sqrt((k + 0.5) / 46) * 0.95, px = x + Math.cos(a) * d * r, py = y + Math.sin(a) * d * r, ang = a * 3; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * r * 0.12, py + Math.sin(ang) * r * 0.12); c.stroke(); } } // 코코넛: 섬유
    else if (t === 9) { c.strokeStyle = 'rgba(150,60,0,.45)'; c.lineWidth = Math.max(1, r * 0.05); for (let k = 0; k <= 3; k++) { c.beginPath(); c.ellipse(x, y, k * r * 0.3 + r * 0.06, r, 0, 0, TAU); c.stroke(); } } // 호박: 세로 골
    else if (t === 10) { c.fillStyle = '#145A2A'; for (let k = -3; k <= 3; k++) { c.beginPath(); for (let i = 0; i <= 14; i++) { const yy = y - r + (i / 14) * 2 * r, xx = x + k * r * 0.34 + (i % 2 ? 1 : -1) * r * 0.06; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } for (let i = 14; i >= 0; i--) { const yy = y - r + (i / 14) * 2 * r, xx = x + k * r * 0.34 + r * 0.1 + (i % 2 ? 1 : -1) * r * 0.06; c.lineTo(xx, yy); } c.closePath(); c.fill(); } }
    c.restore();
    // 윤기
    c.fillStyle = 'rgba(255,255,255,.42)'; c.beginPath(); c.ellipse(x - r * 0.36, y - r * 0.44, r * 0.24, r * 0.14, -0.6, 0, TAU); c.fill();
    // 얼굴 (작은 과일도) — 합쳐진 직후에는 웃는 눈
    if (r >= 8) {
      const ex = r * 0.27, ey = y + r * 0.02, er = Math.max(1.3, r * 0.075);
      c.fillStyle = 'rgba(255,120,150,.35)'; c.beginPath(); c.ellipse(x - ex * 1.55, ey + r * 0.2, r * 0.13, r * 0.08, 0, 0, TAU); c.ellipse(x + ex * 1.55, ey + r * 0.2, r * 0.13, r * 0.08, 0, 0, TAU); c.fill();
      c.strokeStyle = '#2a1420'; c.fillStyle = '#2a1420'; c.lineWidth = Math.max(1.2, r * 0.06); c.lineCap = 'round';
      if (happy) for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * ex, ey + er * 0.6, er * 1.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      else for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * ex, ey, er, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + sx * ex - er * 0.35, ey - er * 0.35, er * 0.35, 0, TAU); c.fill(); c.fillStyle = '#2a1420'; }
      c.beginPath(); c.arc(x, ey + r * 0.14, r * 0.11, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    }
    // 꼭지 · 잎
    const leaf = (lx, ly, w, h, rot, col = '#4FA35A') => { c.fillStyle = col; c.beginPath(); c.ellipse(lx, ly, w, h, rot, 0, TAU); c.fill(); };
    if (t === 0) { c.fillStyle = '#2B3780'; c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = (k % 2 ? 0.1 : 0.22) * r, px = x + Math.cos(a) * rr, py = y - r * 0.8 + Math.sin(a) * rr; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); } // 블루베리: 별 모양 꼭지
    else if (t === 1) for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.62; leaf(x + Math.cos(a) * r * 0.3, y - r * 0.85 + Math.sin(a + Math.PI / 2) * r * 0.05, r * 0.26, r * 0.08, a, '#3E9A4A'); } // 방울토마토: 초록 별꼭지
    else if (t === 3) { c.fillStyle = '#3E8E3A'; c.beginPath(); c.arc(x, y - r * 0.9, r * 0.07, 0, TAU); c.fill(); leaf(x + r * 0.2, y - r * 1.0, r * 0.22, r * 0.09, -0.4); } // 귤: 작은 꼭지 · 잎
    else if (t === 4) { c.fillStyle = DARK[4]; c.beginPath(); c.ellipse(x, y - r * 0.95, r * 0.09, r * 0.08, 0, 0, TAU); c.fill(); } // 레몬: 뾰족한 끝
    else if (t === 7) { c.fillStyle = DARK[7]; c.beginPath(); c.moveTo(x - r * 0.22, y - r * 0.82); for (let k = 0; k <= 4; k++) c.lineTo(x - r * 0.22 + k * r * 0.11, y - r * (k % 2 ? 1.0 : 1.12)); c.lineTo(x + r * 0.22, y - r * 0.82); c.closePath(); c.fill(); } // 석류: 왕관
    else if (t === 9) { c.fillStyle = '#5A7A2A'; c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.85); c.quadraticCurveTo(x - r * 0.05, y - r * 1.15, x + r * 0.15, y - r * 1.22); c.lineTo(x + r * 0.12, y - r * 1.08); c.quadraticCurveTo(x + r * 0.06, y - r * 0.95, x + r * 0.1, y - r * 0.85); c.fill(); } // 호박: 굵은 꼭지
    else if (t === 2 || t === 6) { c.strokeStyle = '#6B4A1E'; c.lineWidth = Math.max(1.4, r * 0.07); c.beginPath(); c.moveTo(x, y - r * 0.85); c.lineTo(x + r * 0.05, y - r * 1.1); c.stroke(); if (t === 6) leaf(x + r * 0.22, y - r * 1.02, r * 0.22, r * 0.09, -0.4); } // 자두 · 망고: 꼭지 (키위 · 코코넛 · 수박은 꼭지 없음)
    c.restore();
  },
  draw(c) {
    const { box } = s;
    // 배경: 따뜻한 저녁 하늘 + 작은 점무늬
    const bg = c.createLinearGradient(0, 0, 0, E.H); bg.addColorStop(0, '#2A2350'); bg.addColorStop(1, '#141A33');
    c.fillStyle = bg; c.fillRect(0, 0, E.W, E.H);
    c.fillStyle = 'rgba(255,255,255,.04)';
    for (let yy = 20; yy < E.H; yy += 46) for (let xx = (yy / 46) % 2 ? 12 : 35; xx < E.W; xx += 46) { c.beginPath(); c.arc(xx, yy, 3, 0, TAU); c.fill(); }
    // 상자: 유리 느낌 (안쪽 빛 · 바닥 그림자 · 두꺼운 테두리)
    const gl = c.createLinearGradient(box.x, 0, box.x + box.w, 0); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(0.5, 'rgba(255,255,255,.03)'); gl.addColorStop(1, 'rgba(255,255,255,.08)');
    c.fillStyle = gl; E.rr(box.x - 4, box.y, box.w + 8, box.h + 4, 14); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(box.x + box.w / 2, box.y + box.h + 12, box.w * 0.52, 10, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(box.x - 3, box.y); c.lineTo(box.x - 3, box.y + box.h + 3); c.lineTo(box.x + box.w + 3, box.y + box.h + 3); c.lineTo(box.x + box.w + 3, box.y); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(box.x + 6, box.y + 8); c.lineTo(box.x + 6, box.y + box.h - 8); c.stroke();
    // 넘침 선 (넘친 동안 빨갛게 깜빡)
    c.setLineDash([8, 7]); c.lineWidth = 2;
    c.strokeStyle = s.overT > 0 ? `rgba(255,90,121,${0.5 + 0.5 * Math.sin(E.t * 18)})` : 'rgba(255,255,255,.3)';
    c.beginPath(); c.moveTo(box.x, s.line); c.lineTo(box.x + box.w, s.line); c.stroke(); c.setLineDash([]);
    for (const f of s.f) this.fruit(c, f.x, f.y, f.r * (1 + (f.pop || 0) * 0.6), f.t, 1, f.pop > 0 || f.born < 0.5 && f.pop !== undefined);
    // 합칠 때 퍼지는 빛 고리
    for (const g of s.rings) { const k = 1 - g.t / 0.4; c.globalAlpha = g.t / 0.4; c.strokeStyle = g.col; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.arc(g.x, g.y, g.r * (1 + k * 1.1), 0, TAU); c.stroke(); }
    c.globalAlpha = 1;
    // 조준: 떨어질 과일 · 안내선
    if (!s.over) {
      const x = this.aimX(), r = this.R(s.cur), y = box.y - r - 6;
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(x, y + r); c.lineTo(x, box.y + box.h); c.stroke(); c.setLineDash([]);
      this.fruit(c, x, y, r, s.cur, s.cool > 0 ? 0.5 : 1);
      // 다음 과일
      const nr = Math.min(this.R(s.next), 20), nx = box.x + box.w - 22, ny = box.y - 70;
      E.text('다음', nx - nr - 18, ny, 12, 'rgba(255,255,255,.55)', 800, 'right');
      this.fruit(c, nx, ny, nr, s.next);
    }
  },
};
