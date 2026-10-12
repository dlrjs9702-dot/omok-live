import { E } from '../engine.js';
import { rvFlips as flipsFor, rvMoves as moves, rvApply as apply } from './rules.js';
import { reversiAiAs } from './ai-core.js';
import { net, pump, seatName } from './turnnet.js';

let s;
const N = 8, ME = 1, AI = 2;
const opp = (p) => 3 - p;
// 흑(1)이 먼저 둔다. s.me = 내 돌 · s.ai = AI의 돌 (AI 대결에서 '먼저 두기'로 고른다 · 온라인은 좌석 0 = 흑)
const human = () => (net() ? s.turn === s.me && net().myTurn : E.p2 ? s.turn > 0 : s.turn === s.me);
const myColor = () => s.me;
const nm = (p) => (E.p2 ? (p === ME ? '흑' : '백') : p === s.me ? '내' : 'AI');
const dot = (p) => (p === ME ? '●' : '○');

export default {
  id: 'reversi', name: '오델로', cat: 'puzzle', mode: 'versus', // 아일랜드: our name for it (한판마당 「리버시」)
  color: '#1FB57A', c2: '#0E7A5C', c3: '#063D2C',
  tagline: '상대 돌을 사이에 끼워 내 색으로 뒤집으세요',
  howto: [['tap', '점으로 표시된 칸에만 둘 수 있어요'], ['rotate', '내 돌 사이에 낀 상대 돌은 전부 내 색으로 뒤집혀요'], ['trophy', '더 둘 곳이 없으면 돌이 더 많은 쪽이 승리. 모서리가 핵심!']],
  winRule: '끝났을 때 내 돌이 더 많기',
  hideScore: true, customRight: true, noScore: true, hudLabel: '나 ● : ○ AI',
  p2Label: '흑 ● : ○ 백', p2Howto: '폰 하나로 번갈아 두세요. 흑(●)이 먼저 둬요',
  draws: true, bg: '#07130F',
  online: 'turn', seatNames: ['흑 ●', '백 ○'],
  options: [{ id: 'first', title: '먼저 두기', def: 'me', ai: true, items: [['me', '내가 먼저 (흑)'], ['ai', 'AI가 먼저 (나는 백)']], note: { me: '흑(●)이 먼저 둬요', ai: 'AI가 흑(●)으로 먼저 두고, 나는 백(○)이에요' } }],

  init() {
    const b = Array(N * N).fill(0);
    b[27] = b[36] = AI; b[28] = b[35] = ME;
    const me = net() ? net().you + 1 : !E.p2 && E.opts?.first === 'ai' ? AI : ME;
    s = { b, turn: ME, flip: {}, aiT: 0.6, last: -1, hints: [], over: false, me, ai: net() || E.p2 ? 0 : 3 - me };
    s.hints = human() ? moves(b, ME) : [];
    if (net()) this.netLoad(net().st);
    if (!net() && !E.p2) E.hud({ label: `나 ${dot(s.me)} : ${dot(s.ai)} AI` });
    this.layout();
    this.hudUpdate();
  },
  netLoad(st) {
    s.b = st.b.slice(); s.last = st.last; s.flip = {};
    s.over = !!st.over; s.turn = st.over ? 0 : st.turn + 1;
    s.hints = s.turn === s.me ? moves(s.b, s.me) : [];
  },
  layout() {
    s.size = Math.min(E.W - 24, E.bottom - E.top - 90, 480);
    s.cell = s.size / N;
    s.ox = (E.W - s.size) / 2; s.oy = E.top + (E.bottom - E.top - s.size) / 2 - 10;
  },
  count(p) { return s.b.filter((v) => v === p).length; },
  hudUpdate() { E.hud({ center: `${this.count(myColor())} : ${this.count(opp(myColor()))}`, right: s.over ? '종료' : net() ? (s.turn === s.me ? '내 차례' : '상대 차례') : `${nm(s.turn)} 차례` }); },

  play(mv, p) {
    s.b = apply(s.b, mv, p); s.last = mv.i;
    const x0 = mv.i % N, y0 = Math.floor(mv.i / N);
    s.flip[mv.i] = { t: 0, from: p, to: p, delay: 0 };
    for (const j of mv.f) s.flip[j] = { t: 0, from: opp(p), to: p, delay: Math.max(Math.abs((j % N) - x0), Math.abs(Math.floor(j / N) - y0)) * 0.06 };
    E.sfx.flip(); if (mv.f.length >= 4) E.sfx.score();
    if (p === myColor()) E.haptic('light');
    if (net() && p === s.me) net().move(mv.i); // 내 수를 서버로
    this.next(opp(p));
  },
  next(p) {
    const mp = moves(s.b, p), mo = moves(s.b, opp(p));
    if (!mp.length && !mo.length) return this.finish();
    if (!mp.length) {
      E.banner(net() ? (p === s.me ? '둘 곳이 없어 차례를 넘겨요' : `${seatName(p - 1)}님이 둘 곳이 없어 넘겼어요`) : E.p2 ? `${nm(p)}이 둘 곳이 없어 차례를 넘겨요` : p === s.me ? '둘 곳이 없어 차례를 넘겨요' : 'AI가 둘 곳이 없어 넘겼어요', 'info', 1500);
      p = opp(p);
    }
    s.turn = p;
    s.hints = (net() ? p === s.me : p === s.me || E.p2) ? moves(s.b, p) : [];
    if (p === s.ai) s.aiT = 0.55;
    this.hudUpdate();
  },
  finish() {
    s.over = true; s.turn = 0; s.hints = [];
    const me = this.count(myColor()), ai = this.count(opp(myColor()));
    this.hudUpdate();
    const out = me > ai ? 'win' : me < ai ? 'loss' : 'draw';
    out === 'win' || (E.p2 && out !== 'draw') ? E.sfx.win() : out === 'loss' ? E.sfx.lose() : E.sfx.draw();
    const title = out === 'draw' ? '무승부' : E.p2 ? (out === 'win' ? '흑 승리!' : '백 승리!') : out === 'win' ? '승리!' : '패배';
    E.end(out, { delay: 1.3, title, stats: [[E.p2 ? '흑' : '내 돌', me + '개'], [E.p2 ? '백' : net() ? '상대 돌' : 'AI 돌', ai + '개'], ['모서리', [0, 7, 56, 63].filter((i) => s.b[i] === myColor()).length + '/4']] });
  },

  down(x, y) {
    if (!human()) return;
    const c = Math.floor((x - s.ox) / s.cell), r = Math.floor((y - s.oy) / s.cell);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const mv = s.hints.find((m) => m.i === r * N + c);
    if (mv) this.play(mv, s.turn);
    else { E.sfx.wrong(); E.haptic('error'); }
  },

  update(dt) {
    for (const k in s.flip) {
      const f = s.flip[k];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.t += dt / 0.28; if (f.t >= 1) delete s.flip[k];
    }
    if (net()) pump((seat, m) => { const mv = { i: m, f: flipsFor(s.b, m, seat + 1) }; if (mv.f.length) this.play(mv, seat + 1); else this.netLoad(net().st); }, (st) => { this.netLoad(st); this.hudUpdate(); });
    else if (s.ai && s.turn === s.ai && !Object.keys(s.flip).length) {
      s.aiT -= dt;
      if (s.aiT <= 0) this.play(reversiAiAs(s.b, E.level, s.ai), s.ai);
    }
  },

  draw(c) {
    const { ox, oy, cell, size } = s;
    c.fillStyle = 'rgba(0,0,0,.4)'; E.rr(ox - 8, oy - 4, size + 16, size + 16, 16); c.fill();
    const g = c.createLinearGradient(0, oy, 0, oy + size);
    g.addColorStop(0, '#1C8A5C'); g.addColorStop(1, '#136B47');
    c.fillStyle = g; E.rr(ox - 8, oy - 8, size + 16, size + 16, 16); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5;
    for (let i = 0; i <= N; i++) {
      c.beginPath(); c.moveTo(ox, oy + i * cell); c.lineTo(ox + size, oy + i * cell); c.stroke();
      c.beginPath(); c.moveTo(ox + i * cell, oy); c.lineTo(ox + i * cell, oy + size); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.4)';
    for (const [x, y] of [[2, 2], [6, 2], [2, 6], [6, 6]]) { c.beginPath(); c.arc(ox + x * cell, oy + y * cell, 3, 0, 6.283); c.fill(); }

    for (const m of s.hints) {
      const x = ox + (m.i % N + 0.5) * cell, y = oy + (Math.floor(m.i / N) + 0.5) * cell;
      c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(x, y, cell * 0.12, 0, 6.283); c.fill();
    }
    const r = cell * 0.4;
    for (let i = 0; i < N * N; i++) {
      if (!s.b[i]) continue;
      const x = ox + (i % N + 0.5) * cell, y = oy + (Math.floor(i / N) + 0.5) * cell, f = s.flip[i];
      let sx = 1, p = s.b[i];
      if (f) {
        if (f.from === f.to) sx = f.delay > 0 ? 0 : Math.min(1, f.t * 1.6);
        else { sx = Math.abs(Math.cos(Math.max(0, f.t) * Math.PI)); p = f.t < 0.5 ? f.from : f.to; }
      }
      if (sx <= 0.01) continue;
      c.save(); c.translate(x, y); c.scale(sx, 1);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(1.5, 3, r, 0, 6.283); c.fill();
      const dg = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      if (p === ME) { dg.addColorStop(0, '#565A74'); dg.addColorStop(1, '#0F1020'); } else { dg.addColorStop(0, '#FFFFFF'); dg.addColorStop(1, '#D4D6E0'); }
      c.fillStyle = dg; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill();
      c.restore();
    }
    if (s.last >= 0) {
      const x = ox + (s.last % N + 0.5) * cell, y = oy + (Math.floor(s.last / N) + 0.5) * cell;
      c.fillStyle = '#FF5A79'; c.beginPath(); c.arc(x, y, cell * 0.08, 0, 6.283); c.fill();
    }
    const txt = s.over ? '게임 종료' : net() ? (human() ? `내 차례 (${s.me === ME ? '●' : '○'})` : `${seatName(s.turn - 1)}님 차례…`) : E.p2 ? `${nm(s.turn)} 차례 (${dot(s.turn)})` : s.turn === s.me ? `당신 차례 (${dot(s.me)})` : 'AI가 생각 중…';
    E.text(txt, E.W / 2, oy + size + 34, 16, human() ? '#8FF0C4' : '#fff', 800);
  },
};
