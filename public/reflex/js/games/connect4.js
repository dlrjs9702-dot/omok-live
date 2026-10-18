import { E } from '../engine.js';
import { lvName } from '../levels.js';
import { c4Drop as drop, c4WinLine as winLine } from './rules.js';
import { connect4AiAs } from './ai-core.js';
import { net, pump, seatName, netStat } from './turnnet.js';

let s;
const C = 7, R = 6, ME = 1, AI = 2;
const COL = { 1: ['#F05252', '#C81E1E'], 2: ['#FFD34D', '#F5A623'] }; // (A3 G3-3: 빨강 먼저 · 빨강 vs 노랑, as in the game room)

// 빨강(1)이 먼저 둔다. s.me = 내 색 · s.ai = AI의 색 (AI 대결에서 '먼저 두기'로 고른다 · 온라인은 좌석 0 = 빨강)
const human = () => (net() ? s.turn === s.me && net().myTurn : E.p2 ? s.turn === ME || s.turn === AI : s.turn === s.me);
const mine = (p) => p === s.me;
const cname = (p) => (p === ME ? '빨강' : '노랑');
export default {
  id: 'connect4', name: '사목', cat: 'puzzle', mode: 'versus',
  color: '#3D7BFF', c2: '#2946B8', c3: '#0F1F66',
  tagline: '칸에 떨어뜨려 4개를 먼저 이으세요',
  howto: [['tap', '원하는 줄을 탭하면 맨 아래로 떨어져요'], ['grid', '가로·세로·대각선으로 4개를 먼저 이으면 승리'], ['brain', '빨강이 먼저 둬요. 먼저 둘지 나중에 둘지 고를 수 있어요. 상대의 3연결을 조심하세요']],
  winRule: '가로·세로·대각선 4개를 먼저 잇기',
  hideScore: true, customRight: true, noScore: true, hudLabel: '나(빨강) vs AI',
  p2Label: '빨강 vs 노랑', p2Howto: '폰 하나로 번갈아 떨어뜨려요. 빨강이 먼저예요',
  draws: true, bg: '#070B1C',
  online: 'turn', seatNames: ['빨강', '노랑'],
  options: [{ id: 'first', title: '먼저 두기', def: 'me', ai: true, items: [['me', '내가 먼저'], ['ai', 'AI가 먼저']], note: { me: '내가 빨강(먼저)이에요', ai: 'AI가 빨강(먼저) · 내가 노랑이에요' } }],

  init() {
    const me = net() ? net().you + 1 : !E.p2 && E.opts?.first === 'ai' ? AI : ME;
    s = { b: Array(R * C).fill(0), turn: ME, fall: null, hover: -1, aiT: 0.6, win: null, moves: 0, me, ai: net() || E.p2 ? 0 : 3 - me, netQ: [] };
    if (net()) this.netLoad(net().st);
    this.layout();
    E.hud({ right: net() ? '온라인' : E.p2 ? '둘이 하기' : lvName(E.level), ...(net() || E.p2 ? {} : { label: `나(${cname(s.me)}) vs AI` }) });
  },
  netLoad(st) {
    s.b = st.b.slice(); s.moves = st.moves; s.fall = null; s.netQ = []; s.hover = -1;
    s.turn = st.over ? 0 : st.turn + 1;
    s.win = st.over?.cells ? { p: st.over.winner + 1, cells: st.over.cells } : null;
  },
  layout() {
    s.cell = Math.min((E.W - 32) / C, (E.bottom - E.top - 150) / (R + 1), 64);
    s.bw = s.cell * C; s.bh = s.cell * R;
    s.ox = (E.W - s.bw) / 2; s.oy = E.top + (E.bottom - E.top - s.bh) / 2 + s.cell * 0.3;
  },
  drop(c, p) {
    const r = drop(s.b, c);
    if (r < 0) return false;
    s.fall = { c, r, p, y: -s.cell * 0.9, vy: 0, bounced: false };
    s.turn = 0;
    if (net() && p === s.me) net().move(c); // 내 수를 서버로
    return true;
  },
  land() {
    const { c, r, p } = s.fall;
    s.b[r * C + c] = p; s.fall = null; s.moves++;
    E.sfx.drop(); E.haptic(mine(p) ? 'medium' : 'light');
    const w = winLine(s.b, p), stats = [['수', s.moves + '수'], ['선공', net() ? seatName(0) : E.p2 ? '빨강' : s.me === ME ? '나' : 'AI'], net() ? netStat() : E.p2 ? ['모드', '둘이 하기'] : ['AI', lvName(E.level)]];
    if (w) {
      s.win = { p, cells: w };
      mine(p) || E.p2 ? (E.sfx.win(), E.haptic('success')) : (E.sfx.lose(), E.haptic('error'));
      return E.end(mine(p) ? 'win' : 'loss', { delay: 1.4, title: E.p2 ? (p === ME ? '빨강 승리!' : '노랑 승리!') : mine(p) ? '승리!' : '패배', stats });
    }
    if (!s.b.includes(0)) { E.sfx.draw(); return E.end('draw', { delay: 1, title: '무승부', stats }); }
    s.turn = p === ME ? AI : ME;
    if (s.turn === s.ai) s.aiT = 0.35;
  },
  colAt(x) { const c = Math.floor((x - s.ox) / s.cell); return c >= 0 && c < C ? c : -1; },
  down(x) { if (human()) s.hover = this.colAt(x); },
  move(x, y, dx, dy, id) { if (human() && id === E.pointer.id) s.hover = this.colAt(x); },
  up(x) {
    if (!human()) return;
    const c = this.colAt(x);
    s.hover = -1;
    if (c >= 0 && !this.drop(c, s.turn)) { E.sfx.wrong(); E.haptic('error'); }
  },
  key(k) { const c = '1234567'.indexOf(k); if (c >= 0 && human()) this.drop(c, s.turn); },

  update(dt) {
    const f = s.fall;
    if (f) {
      const target = f.r * s.cell;
      f.vy += 3200 * dt; f.y += f.vy * dt;
      if (f.y >= target) {
        f.y = target;
        if (!f.bounced && f.vy > 500) { f.vy = -f.vy * 0.25; f.bounced = true; E.sfx.move(); }
        else this.land();
      }
    }
    if (net()) {
      // 상대 수는 떨어지는 중인 돌이 내려앉은 뒤에 차례로
      pump((seat, m) => s.netQ.push([m, seat + 1]), (st) => this.netLoad(st));
      if (!s.fall && s.netQ.length) { const [c, p] = s.netQ.shift(); if (!this.drop(c, p)) this.netLoad(net().st); }
    } else if (s.ai && s.turn === s.ai && !s.fall) { s.aiT -= dt; if (s.aiT <= 0) this.drop(connect4AiAs(s.b, E.level, s.ai), s.ai); }
    if (s.win) s.winT = (s.winT || 0) + dt;
  },

  disc(c, x, y, r, p, a = 1) {
    c.globalAlpha = a;
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, COL[p][0]); g.addColorStop(1, COL[p][1]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.66, 0, 6.283); c.stroke();
    c.globalAlpha = 1;
  },

  draw(c) {
    const { ox, oy, cell, bw, bh } = s, rr = cell * 0.39;
    // 놓을 위치 미리보기
    if (human()) {
      const hc = s.hover >= 0 ? s.hover : -1;
      if (hc >= 0) {
        c.fillStyle = 'rgba(255,211,77,.08)'; E.rr(ox + hc * cell, oy - cell, cell, bh + cell, 12); c.fill();
        this.disc(c, ox + (hc + 0.5) * cell, oy - cell * 0.55, rr, s.turn, 0.8);
      }
    }
    // 판 뒤 원판 (떨어지는 원판은 판 뒤에 그림)
    for (let i = 0; i < R * C; i++) if (s.b[i]) this.disc(c, ox + (i % C + 0.5) * cell, oy + (Math.floor(i / C) + 0.5) * cell, rr, s.b[i]);
    if (s.fall) this.disc(c, ox + (s.fall.c + 0.5) * cell, oy + s.fall.y + cell * 0.5, rr, s.fall.p);
    // 판 (구멍 뚫린 파란 판)
    c.save();
    c.beginPath(); c.roundRect(ox - 8, oy - 8, bw + 16, bh + 16, 18);
    // 구멍: evenodd 채우기로 뚫는다 (반드시 완전한 원이어야 함)
    for (let r = 0; r < R; r++) for (let col = 0; col < C; col++) { const x = ox + (col + 0.5) * cell, y = oy + (r + 0.5) * cell; c.moveTo(x + rr + 2, y); c.arc(x, y, rr + 2, 0, Math.PI * 2); }
    const g = c.createLinearGradient(0, oy, 0, oy + bh);
    g.addColorStop(0, '#3D7BFF'); g.addColorStop(1, '#2A55C9');
    c.fillStyle = g; c.fill('evenodd');
    c.restore();
    c.fillStyle = '#1E3C99'; E.rr(ox - 14, oy + bh + 6, bw + 28, 12, 6); c.fill();
    if (s.win) {
      const pulse = 0.5 + Math.sin(s.winT * 8) * 0.35;
      for (const i of s.win.cells) {
        const x = ox + (i % C + 0.5) * cell, y = oy + (Math.floor(i / C) + 0.5) * cell;
        E.glow(x, y, cell * 0.9, '#FFFFFF', pulse * 0.6);
        c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, rr * 0.8, 0, 6.283); c.stroke();
      }
    }
    const who = cname(s.turn);
    const txt = net() ? (s.win ? (mine(s.win.p) ? '4개 연결! 이겼어요' : `${seatName(s.win.p - 1)}님이 4개를 이었어요`) : human() ? `내 차례 (${cname(s.me)}) · 줄을 탭하세요` : s.turn ? `${seatName(s.turn - 1)}님 차례…` : '')
      : s.win ? (E.p2 ? `${cname(s.win.p)} 4개 연결!` : mine(s.win.p) ? '4개 연결! 이겼어요' : 'AI가 4개를 이었어요')
      : human() ? (E.p2 ? `${who} 차례 · 줄을 탭하세요` : `떨어뜨릴 줄을 탭하세요 (${cname(s.me)})`) : s.turn === s.ai ? 'AI가 생각 중…' : '';
    E.text(txt, E.W / 2, oy + bh + 48, 16, human() ? (s.turn === ME ? '#F87171' : '#FFD34D') : '#fff', 800);
  },
};
