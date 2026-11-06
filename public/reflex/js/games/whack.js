import { E } from '../engine.js';
import { rand } from '../util.js';
import '../../../whack-hell.js'; // (v1.10.255 헬: the formula the server checks with, public/whack-hell.js -- sets self.WhackHell)

const H = globalThis.WhackHell;

let s;
const TIME = 30;
// 난이도: 머무는 시간 배율 · 나오는 간격 배율 · 폭탄 확률 · 동시에 나올 수 있는 수(더하기)
const LV = { easy: { stay: 1.35, spawn: 1.25, bomb: 0.07, extra: 0 }, normal: { stay: 1, spawn: 1, bomb: 0.13, extra: 0 }, hard: { stay: 0.75, spawn: 0.8, bomb: 0.17, extra: 1 } };

export default {
  id: 'whack', name: '두더지 잡기', cat: 'reflex',
  color: '#FF9F2E', c2: '#E8563A', c3: '#6E3300',
  tagline: '30초 동안 튀어나오는 두더지를 잡으세요',
  howto: [['tap', '두더지가 올라오면 재빨리 탭! 10점'], ['star', '황금 두더지는 30점'], ['bomb', '폭탄을 누르면 시간이 3초 줄어요']],
  hudBar: true, customRight: true,
  bg: '#140D08',
  levels: true, levelLegacy: 'normal', levelIds: ['easy', 'normal', 'hard', 'hell'], levelNames: { hell: '헬' },
  levelNote: '쉬움: 오래 머물고 폭탄이 적어요 · 어려움: 짧게 머물고 폭탄 · 동시 출현이 많아요 — 난이도마다 최고 기록과 랭킹이 따로예요',
  levelNotes: { hell: '목숨 5개로 끝까지 · 놓치면 ♥−1, 폭탄 ♥−2 · 갈수록 빨라져요' },
  resultPill(level) { return level === 'hell' ? ['loss', '게임 오버'] : null; }, // (헬 ends when the hearts run out -- not 「완성」)
  taglineFor(level) { return level === 'hell' ? '목숨이 다할 때까지 끝없이 두더지를 잡으세요' : this.tagline; },
  howtoFor(level) { return level === 'hell' ? [['tap', '두더지 한 마리 10점 · 황금 두더지 없음'], ['heart', '놓치면 ♥−1 · 폭탄을 누르면 ♥−2'], ['bolt', '10마리마다 한 단계씩 빨라져요 · ♥가 다 없어지면 끝']] : this.howto; },

  init() {
    s = { L: LV[E.level] || LV.normal, holes: Array.from({ length: 9 }, () => ({ st: 'idle', h: 0, stay: 0, type: 'mole', hitT: 0 })), left: TIME, spawn: 0.5, hits: 0, misses: 0, rings: [] };
    s.hell = E.level === 'hell'; if (s.hell) Object.assign(s, { lives: H.LIVES, stage: 0, played: 0, spawn: 0.5, ready: H.COUNTDOWN, go: 0, combo: 0, maxCombo: 0 }); /* (3·2·1 first) */
    this.layout();
    if (s.hell) this.hellHud(); else E.hud({ bar: 1, barColor: '#FF9F2E' });
  },
  layout() {
    const size = Math.min(E.W - 28, E.bottom - E.top - 30, 480);
    s.size = size; s.cell = size / 3;
    s.ox = (E.W - size) / 2; s.oy = E.top + (E.bottom - E.top - size) / 2;
  },
  center(i) { return [s.ox + ((i % 3) + 0.5) * s.cell, s.oy + (Math.floor(i / 3) + 0.62) * s.cell]; },

  down(x, y) {
    const c = Math.floor((x - s.ox) / s.cell), r = Math.floor((y - s.oy) / s.cell);
    s.rings.push({ x, y, t: 0.25 });
    if (c < 0 || c > 2 || r < 0 || r > 2) return;
    const h = s.holes[r * 3 + c];
    if (h.st !== 'up' || h.h < 0.25) return;
    const [cx, cy] = this.center(r * 3 + c);
    h.st = 'hit'; h.hitT = 0.35;
    if (s.hell) return this.hellHit(h, cx, cy);
    if (h.type === 'bomb') {
      s.left = Math.max(0, s.left - 3);
      E.burst(cx, cy - 20, '#FF5A2E', 30, 360, 5); E.shake(14); E.flash('#FF5A2E', 0.35);
      E.popup('-3초', cx, cy - 50, '#FF5A79', 26); E.sfx.hit(); E.haptic('heavy');
    } else {
      const pts = h.type === 'gold' ? 30 : 10;
      s.hits++;
      E.add(pts, cx, cy - 56, h.type === 'gold' ? '#FFD34D' : '#fff');
      E.burst(cx, cy - 24, h.type === 'gold' ? '#FFD34D' : '#FFB36B', h.type === 'gold' ? 22 : 12, 260);
      E.sfx.pop(); E.haptic(h.type === 'gold' ? 'medium' : 'light');
    }
  },

  // (v1.10.255 헬) the HUD: the score in the middle, five hearts, the stage and how far to the next
  hellHud() { E.hud({ label: `단계 ${s.stage + 1}`, lives: [s.lives, H.LIVES], bar: (s.hits % H.PER) / H.PER, barColor: '#FF5A2E', right: `♥ ${s.lives}` }); }, /* (the bar: caught toward the next stage) */
  hellHit(h, cx, cy) {
    if (h.type === 'bomb') {
      E.burst(cx, cy - 20, '#FF5A2E', 46, 460, 6); E.shake(20); E.flash('#FF2E2E', 0.45);
      E.popup(`♥−${H.LOSE.bomb}`, cx, cy - 50, '#FF5A79', 30); E.sfx.hit(); E.haptic('heavy');
      return this.hellLose(H.LOSE.bomb);
    }
    E.burst(cx, cy - 24, '#FFB36B', 12, 260); E.sfx.pop(); E.haptic('light');
    this.hellCatch(cx, cy - 56);
  },
  hellCatch(px, py) {
    s.hits++; E.add(H.POINTS, px, py, '#fff');
    s.combo = H.combo(s.combo, 'hit'); s.maxCombo = Math.max(s.maxCombo, s.combo);
    if (H.shout(s.combo)) { E.popup(`${s.combo} 콤보!`, E.W / 2, (E.top + E.bottom) / 2, '#FFD34D', 44); E.sfx.goal?.(); } // (the score the same: 10 a mole)
    const k = H.stageOf(s.hits); if (k > s.stage) { s.stage = k; s.stageShow = { text: `단계 ${k + 1}!`, t: 1 }; E.sfx.win?.(); }
    this.hellHud();
  },
  hellLose(n) {
    if (s.lives <= 0) return;
    s.combo = H.combo(s.combo, 'miss'); /* (a miss or a bomb: the run over) */
    s.lives = Math.max(0, s.lives - n); this.hellHud();
    if (s.lives > 0) return;
    for (const h of s.holes) if (h.st === 'up') h.st = 'down'; // (the rest go down)
    const t = Math.floor(s.played); E.end(null, { stats: [['잡은 두더지', s.hits + '마리'], ['도달 단계', String(s.stage + 1)], ['최대 콤보', String(s.maxCombo)], ['버틴 시간', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`]] });
  },
  hellUpdate(dt) {
    for (const r of s.rings) r.t -= dt;
    s.rings = s.rings.filter((r) => r.t > 0);
    if (s.go > 0) s.go -= dt;
    if (s.stageShow?.t > 0) s.stageShow.t -= dt;
    if (s.ready > 0) { const was = Math.ceil(s.ready); s.ready -= dt; if (s.ready <= 0) { s.go = 0.7; E.sfx.beep?.(true); } else if (Math.ceil(s.ready) !== was) E.sfx.beep?.(false); return; }
    s.played += dt; const L = H.at(s.stage);
    s.spawn -= dt;
    const up = s.holes.filter((h) => h.st !== 'idle').length;
    if (s.spawn <= 0 && up < L.up && !s.calm) { /* (calm: the tests' -- none come up) */
      s.spawn = H.spawnWait(s.stage, Math.random());
      const free = s.holes.filter((h) => h.st === 'idle');
      if (free.length) { const h = free[Math.floor(Math.random() * free.length)]; h.type = s.played > 1 && Math.random() < L.bomb ? 'bomb' : 'mole'; h.st = 'up'; h.h = 0; h.stay = H.stayFor(s.stage, Math.random()); if (h.type === 'bomb') E.sfx.fizz?.(); }
    }
    for (const h of s.holes) {
      if (h.st === 'up') { h.h = Math.min(1, h.h + dt * 7); if (h.h >= 1) { h.stay -= dt; if (h.stay <= 0) { h.st = 'down'; if (h.type !== 'bomb' && !s.calm) { s.misses++; E.haptic('light'); this.hellLose(H.LOSE.miss); } } } }
      else if (h.st === 'down') { h.h -= dt * 6; if (h.h <= 0) { h.h = 0; h.st = 'idle'; } }
      else if (h.st === 'hit') { h.hitT -= dt; if (h.hitT <= 0) h.st = 'down'; }
    }
  },
  // the tests' (e2e): what the round is at, and a miss or a bomb as if it happened
  peek() { return s ? { hell: Boolean(s.hell), lives: s.lives ?? null, stage: s.stage ?? null, hits: s.hits, score: E.score, up: s.holes.filter((h) => h.st !== 'idle').length, ready: Math.max(0, s.ready ?? 0), banner: s.stageShow?.t > 0 ? s.stageShow.text : '', combo: s.combo ?? null, maxCombo: s.maxCombo ?? null } : null; },
  test(kind) { if (!s?.hell) return; if (kind === 'calm') s.calm = true; else if (kind === 'miss') { s.misses++; this.hellLose(H.LOSE.miss); } else if (kind === 'bomb') this.hellLose(H.LOSE.bomb); else if (kind === 'hit') this.hellCatch(); else if (kind === 'bomb10') { s.stage = H.BOMB_GLOW; this.hellHud(); Object.assign(s.holes[4], { st: 'up', h: 0, type: 'bomb', stay: 999 }); Object.assign(s.holes[0], { st: 'up', h: 0, type: 'mole', stay: 999 }); } },

  update(dt) {
    if (s.hell) return this.hellUpdate(dt);
    s.left -= dt;
    E.hud({ bar: s.left / TIME, right: Math.ceil(Math.max(0, s.left)) + '초', barColor: s.left < 8 ? '#FF5A79' : '#FF9F2E' });
    if (s.left <= 0) return E.end(null, { stats: [['잡은 수', s.hits + '마리'], ['놓친 수', s.misses + '마리'], ['정확도', s.hits + s.misses ? Math.round((s.hits / (s.hits + s.misses)) * 100) + '%' : '—']] });

    const prog = 1 - s.left / TIME;
    s.spawn -= dt;
    const up = s.holes.filter((h) => h.st !== 'idle').length;
    if (s.spawn <= 0 && up < 2 + Math.floor(prog * 2) + s.L.extra) {
      s.spawn = rand(0.35, 0.75) * (1 - prog * 0.4) * s.L.spawn;
      const free = s.holes.filter((h) => h.st === 'idle');
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)];
        const r = Math.random();
        h.type = E.t > 4 && r < s.L.bomb ? 'bomb' : r > 0.92 ? 'gold' : 'mole';
        h.st = 'up'; h.h = 0; h.stay = rand(0.7, 1.2) * (1 - prog * 0.35) * (h.type === 'gold' ? 0.7 : 1) * s.L.stay;
      }
    }
    for (const h of s.holes) {
      if (h.st === 'up') {
        h.h = Math.min(1, h.h + dt * 7);
        if (h.h >= 1) { h.stay -= dt; if (h.stay <= 0) { h.st = 'down'; if (h.type !== 'bomb') s.misses++; } }
      } else if (h.st === 'down') {
        h.h -= dt * 6; if (h.h <= 0) { h.h = 0; h.st = 'idle'; }
      } else if (h.st === 'hit') {
        h.hitT -= dt; if (h.hitT <= 0) h.st = 'down';
      }
    }
    for (const r of s.rings) r.t -= dt;
    s.rings = s.rings.filter((r) => r.t > 0);
  },

  drawMole(c, x, y, R, h) {
    const k = h.type, body = k === 'gold' ? '#FFC93C' : '#9A6538', belly = k === 'gold' ? '#FFE9A0' : '#D9A877';
    if (k === 'bomb') {
      const flick = s.hell && s.stage >= H.BOMB_FLICKER; const hot = s.hell && s.stage >= H.BOMB_GLOW;
      if (hot) E.glow(x, y + R * 0.1, R * 1.35, '#FF2E2E', 0.5 + 0.25 * Math.sin(E.t * 12));
      c.fillStyle = '#2B2B3A'; c.beginPath(); c.arc(x, y + R * 0.1, R * 0.62, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(x - R * 0.22, y - R * 0.12, R * 0.16, 0, 6.283); c.fill();
      c.strokeStyle = '#C9A26B'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + R * 0.3, y - R * 0.4); c.quadraticCurveTo(x + R * 0.55, y - R * 0.8, x + R * 0.3, y - R * 0.95); c.stroke();
      E.glow(x + R * 0.3, y - R * 0.95, flick ? 24 : 14, flick && Math.sin(E.t * 30) > 0 ? '#FF2E2E' : '#FF8A2E', 0.6 + Math.random() * 0.4);
      return;
    }
    if (k === 'gold') E.glow(x, y, R * 1.3, '#FFD34D', 0.4);
    c.fillStyle = body; E.rr(x - R * 0.62, y - R * 0.55, R * 1.24, R * 1.8, R * 0.62); c.fill();
    c.fillStyle = belly; c.beginPath(); c.ellipse(x, y + R * 0.35, R * 0.4, R * 0.45, 0, 0, 6.283); c.fill();
    const hit = h.st === 'hit';
    c.strokeStyle = '#2A1606'; c.fillStyle = '#2A1606'; c.lineWidth = 3; c.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const ex = x + sx * R * 0.24, ey = y - R * 0.18;
      if (hit) { c.beginPath(); c.moveTo(ex - 5, ey - 5); c.lineTo(ex + 5, ey + 5); c.moveTo(ex + 5, ey - 5); c.lineTo(ex - 5, ey + 5); c.stroke(); }
      else { c.beginPath(); c.arc(ex, ey, R * 0.08, 0, 6.283); c.fill(); }
    }
    c.lineCap = 'butt';
    c.fillStyle = '#FF7A8A'; c.beginPath(); c.ellipse(x, y + R * 0.02, R * 0.13, R * 0.1, 0, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x - R * 0.09, y + R * 0.1, R * 0.08, R * 0.12); c.fillRect(x + R * 0.01, y + R * 0.1, R * 0.08, R * 0.12);
  },

  draw(c) {
    const R = s.cell * 0.36;
    for (let i = 0; i < 9; i++) {
      const [x, y] = this.center(i), h = s.holes[i];
      // 흙 둔덕
      c.fillStyle = '#3A2414'; c.beginPath(); c.ellipse(x, y + 6, R * 1.25, R * 0.5, 0, 0, 6.283); c.fill();
      c.fillStyle = '#0B0604'; c.beginPath(); c.ellipse(x, y, R * 1.02, R * 0.36, 0, 0, 6.283); c.fill();
      if (h.h > 0) {
        c.save();
        c.beginPath(); c.rect(x - R * 1.4, y - R * 3, R * 2.8, R * 3); c.clip();
        const e = h.st === 'hit' ? 1 : h.h;
        this.drawMole(c, x, y + R * 0.95 - e * R * 1.75, R, h);
        c.restore();
      }
      // 앞쪽 흙 테두리
      c.strokeStyle = '#5A3A22'; c.lineWidth = 5;
      c.beginPath(); c.ellipse(x, y, R * 1.04, R * 0.38, 0, 0.1, Math.PI - 0.1); c.stroke();
    }
    if (s.hell && (s.ready > 0 || s.go > 0)) { // (3·2·1 · 시작!)
      const text = s.ready > 0 ? String(Math.ceil(s.ready)) : '시작!'; const k = s.ready > 0 ? s.ready % 1 : s.go / 0.7;
      c.save(); c.globalAlpha = Math.min(1, 0.35 + k); c.fillStyle = s.ready > 0 ? '#fff' : '#FFD34D'; c.font = `900 ${Math.round(s.cell * (s.ready > 0 ? 0.9 : 0.55))}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 18; c.fillText(text, E.W / 2, s.oy + s.size / 2); c.restore();
    }
    if (s.hell && s.stageShow?.t > 0) {
      const t = s.stageShow.t; const y = Math.max(E.top + 34, (E.top + s.oy) / 2 + 12); const pop = 1 + Math.max(0, t - 0.8) * 1.5;
      c.save(); c.globalAlpha = Math.min(1, t * 3); c.font = `900 ${Math.round(44 * pop)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = 'rgba(60,8,0,.85)'; c.strokeText(s.stageShow.text, E.W / 2, y); c.fillStyle = '#FF7A2E'; c.shadowColor = '#FF2E2E'; c.shadowBlur = 16; c.fillText(s.stageShow.text, E.W / 2, y); c.restore();
    }
    for (const r of s.rings) {
      c.globalAlpha = r.t / 0.25; c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.arc(r.x, r.y, 36 - r.t * 80, 0, 6.283); c.stroke();
    }
    c.globalAlpha = 1;
  },
};
