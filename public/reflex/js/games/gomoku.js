import { E } from '../engine.js';
import { lvName } from '../levels.js';
import { skinOf } from '../cosmetics.js';
import { TURN, gmForbidden, gmOpenOk, gmSymEq, gmColor, GM_BAN_NAME } from './rules.js';
import { gomokuAct } from './ai-core.js';
import { net, pump, seatName, netStat } from './turnnet.js';

// 오목: 렌주룰 (흑 3-3 · 4-4 · 장목 금수) · 고를 수 있는 개시 규칙 '3수 교환 · 5수 2타'
// 판의 규칙 상태는 앱과 서버가 같은 코드(rules.js TURN.gomoku)를 쓴다 → AI 대결 · 둘이 하기 · 온라인이 모두 같은 규칙
// 좌석: AI 대결은 나 0 · AI 1 / 둘이 하기는 0 · 1 모두 사람 / 온라인은 서버가 정한 내 좌석
const G = TURN.gomoku;
let s;
const N = 15, AI_SEAT = 1;
const STAR = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
const RULES = { renju: '렌주룰', swap: '3수 교환 · 5수 2타' };
const inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const colName = (v) => (v === 1 ? '흑' : '백');

/** 지금 화면을 누르는 사람의 좌석 (둘 수 없으면 -1) */
function actor() {
  const st = s.st;
  if (st.over) return -1;
  if (net()) return st.turn === s.me && net().myTurn ? s.me : -1;
  if (E.p2) return st.turn;
  return st.turn === 0 ? 0 : -1;
}
const human = () => actor() >= 0;
const aiStat = () => (net() ? netStat() : E.p2 ? ['모드', '둘이 하기'] : ['AI', lvName(E.level)]);
/** 좌석의 이름 (온라인 · AI · 둘이 하기) */
const who = (seat) => (net() ? seatName(seat) : E.p2 ? colName(gmColor(s.st, seat)) : seat === 0 ? '나' : 'AI');
const mineSeat = (seat) => (net() ? seat === s.me : E.p2 ? true : seat === 0);

export default {
  id: 'gomoku', name: '오목', cat: 'puzzle', mode: 'versus',
  color: '#D9A04A', c2: '#8C5A2B', c3: '#3E2410',
  tagline: '렌주룰 오목. 흑이든 백이든 다섯 알을 먼저 이으세요',
  howto: [['tap', '놓을 곳을 누르면 착수해요 (터치는 한 번 누르면 미리보기, 한 번 더 누르면 착수)'], ['grid', '가로·세로·대각선으로 5개를 먼저 이으면 승리 (흑은 정확히 5개)'], ['brain', '흑은 3-3 · 4-4 · 장목(6개 이상)을 둘 수 없어요 (× 표시) — 렌주룰. 4-3은 돼요']],
  winRule: '5알을 먼저 잇기 (렌주룰: 흑은 3-3 · 4-4 · 장목 금수)',
  hideScore: true, customRight: true, noScore: true, hudLabel: '나 vs AI',
  p2Label: '흑 vs 백', p2Howto: '폰 하나로 번갈아 두세요. 아래쪽 사람이 먼저 둬요',
  draws: true, bg: '#120E0A',
  online: 'turn', seatNames: ['먼저', '나중'],
  // 판 설정 (게임 시트에서 고른다 · play.js) — rule은 온라인에서도 같은 규칙끼리 만난다, first는 AI 대결만
  options: [
    { id: 'rule', title: '규칙', def: 'renju', online: true, items: [['renju', '렌주룰'], ['swap', '3수 교환 · 5수 2타']],
      note: { renju: '흑은 3-3 · 4-4 · 장목(6목 이상)을 둘 수 없고, 정확히 5개를 이어야 이겨요. 백은 제한이 없어요',
        swap: '대회 개시 규칙: 먼저 두는 사람이 3수(흑·백·흑)를 두면 상대가 흑·백을 골라요. 백이 4수를 두고, 흑이 5수 자리 두 곳을 내면 백이 하나를 골라요. 그다음은 렌주룰' } },
    { id: 'first', title: '먼저 두기', def: 'me', ai: true, items: [['me', '내가 먼저'], ['ai', 'AI가 먼저']],
      note: { me: '렌주룰: 내가 흑(먼저) · 3수 교환: 내가 처음 3수를 둬요', ai: '렌주룰: 내가 백(나중) · 3수 교환: AI가 처음 3수를 둬요' } },
  ],
  onlineOpt: (lv, o = {}) => ({ rule: o.rule === 'swap' ? 'swap' : 'renju' }),
  onlineOptLabel: (o) => RULES[o?.rule] || '',

  init() {
    const o = E.opts || {};
    s = { st: null, me: 0, pre: -1, sel: [], ban: [], anim: {}, aiT: 0.5, ended: false, sk: skinOf('gomoku'), winT: 0 };
    if (net()) { s.me = net().you; this.load(net().st); }
    else this.load(G.init({ rule: o.rule, first: E.p2 ? 'me' : o.first }));
    this.layout();
  },
  /** 규칙 상태를 통째로 받는다 (처음 · 서버에서 온 상태). 새로 생긴 돌은 놓이는 연출 */
  load(st) {
    const old = s.st?.b, wasSwap = s.st?.phase === 'swap';
    s.st = typeof structuredClone === 'function' ? structuredClone(st) : JSON.parse(JSON.stringify(st));
    if (old) s.st.b.forEach((v, i) => { if (v && !old[i]) s.anim[i] = 0; });
    s.pre = -1; s.sel = [];
    if (wasSwap && s.st.phase !== 'swap') this.swapNews();
    this.refresh();
  },
  /** 색 고르기 결과 알림 (3수 교환) */
  swapNews() {
    const st = s.st, chooser = 1 - (st.swapped ? 1 - st.black : st.black); // 고른 사람 = 고르기 전의 임시 백
    const name = who(chooser), mine = !E.p2 && mineSeat(chooser);
    E.banner(st.swapped ? `${mine ? '흑을 가져왔어요' : `${name}가 흑을 가져갔어요`} — 색이 바뀌었어요` : `${mine ? '그대로 백으로 해요' : `${name}는 그대로 백이에요`}`, 'info', 1800);
  },
  /** 차례가 바뀔 때: 금수 표시 · HUD · 끝 */
  refresh() {
    const st = s.st, me = net() ? s.me : 0;
    s.ban = [];
    if (!st.over && st.phase === 'play' && human() && gmColor(st, st.turn) === 1) for (let i = 0; i < N * N; i++) if (!st.b[i] && gmForbidden(st.b, i)) s.ban.push(i);
    const myCol = st.phase === 'open' || st.phase === 'swap' ? '?' : colName(gmColor(st, me));
    E.hud({ label: E.p2 ? `흑 vs 백 · ${RULES[st.rule]}` : `나(${myCol}) vs ${net() && !net().ai ? '상대' : 'AI'}`, right: `${st.stones}수` });
    if (st.over) this.finish();
  },
  finish() {
    if (s.ended) return;
    s.ended = true;
    const o = s.st.over, me = net() ? s.me : 0;
    const stats = [['수', s.st.stones + '수'], ['내 돌', E.p2 ? '-' : colName(gmColor(s.st, me))], ['규칙', RULES[s.st.rule]], aiStat()];
    if (o.winner == null) { E.sfx.draw(); return E.end('draw', { delay: 1, title: '무승부', stats }); }
    const win = mineSeat(o.winner), wc = colName(gmColor(s.st, o.winner));
    win ? (E.sfx.win(), E.haptic('success')) : (E.sfx.lose(), E.haptic('error'));
    E.end(E.p2 ? 'win' : win ? 'win' : 'loss', { delay: 1.4, title: E.p2 ? `${wc} 승리!` : win ? '승리!' : '패배', stats });
  },
  layout() {
    s.size = Math.min(E.W - 20, E.bottom - E.top - 150, 520);
    s.cell = s.size / N;
    s.ox = (E.W - s.size) / 2; s.oy = E.top + (E.bottom - E.top - s.size) / 2 - 30;
    const bw = Math.min(150, (E.W - 36) / 2), by = s.oy + s.size + 58;
    s.btns = { swap: { x: E.W / 2 - bw - 6, y: by, w: bw, h: 44 }, keep: { x: E.W / 2 + 6, y: by, w: bw, h: 44 }, five: { x: E.W / 2 - 90, y: by, w: 180, h: 44 } };
  },
  /** 내 할 일 하기 (사람) → 됐으면 true */
  act(m) {
    const seat = actor();
    if (seat < 0) return false;
    if (!G.play(s.st, seat, m)) { E.sfx.wrong(); return false; }
    if (net()) net().move(m); // 서버가 같은 규칙으로 다시 검사한다
    this.after(m);
    return true;
  },
  after(m) {
    const st = s.st;
    if (m === 'swap' || m === 'keep') this.swapNews();
    if (Number.isInteger(m) && st.b[m]) { s.anim[m] = 0; E.sfx.drop(); E.haptic('light'); } else E.sfx.ui();
    s.pre = -1; s.sel = [];
    if (!net() && !E.p2 && st.turn === AI_SEAT) s.aiT = 0.45;
    this.refresh();
  },
  hitCell(x, y) {
    const c = Math.floor((x - s.ox) / s.cell), r = Math.floor((y - s.oy) / s.cell);
    return inB(c, r) ? r * N + c : -1;
  },
  hitBtn(x, y, b) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; },
  down(x, y) {
    if (!human()) return;
    const st = s.st;
    if (st.phase === 'swap') { // 색 고르기: 버튼
      if (this.hitBtn(x, y, s.btns.swap)) this.act('swap');
      else if (this.hitBtn(x, y, s.btns.keep)) this.act('keep');
      return;
    }
    if (st.phase === 'five' && s.sel.length === 2 && this.hitBtn(x, y, s.btns.five)) { this.act(s.sel.slice()); return; }
    const i = this.hitCell(x, y);
    if (i < 0) { s.pre = -1; return; }
    if (st.phase === 'five') { // 흑: 5수 자리 두 곳 고르기
      if (st.b[i]) return;
      const k = s.sel.indexOf(i);
      if (k >= 0) { s.sel.splice(k, 1); E.sfx.tap(); return; }
      if (s.sel.length >= 2) s.sel.shift();
      if (s.sel.length && gmSymEq(st.b, s.sel[0], i)) { E.sfx.wrong(); E.banner('판 모양으로 대칭인 두 곳은 함께 낼 수 없어요', 'info', 1600); return; }
      s.sel.push(i); E.sfx.tap(); E.haptic('light');
      return;
    }
    if (st.phase === 'pick') { // 백: 흑이 낸 두 곳 중 하나 고르기
      if (!st.five.includes(i)) return;
      if (s.pre === i) this.act(i); else { s.pre = i; E.sfx.tap(); }
      return;
    }
    if (st.b[i]) return;
    if (st.phase === 'open' && !gmOpenOk(st.b, st.stones, i)) {
      E.sfx.wrong(); E.banner(st.stones === 0 ? '1수는 한가운데(천원)에 둬요' : st.stones === 1 ? '2수(백)는 가운데 돌 바로 옆 8칸에 둬요' : '3수(흑)는 가운데 5×5 안에 둬요', 'info', 1600);
      return;
    }
    const ban = st.phase === 'play' && gmColor(st, st.turn) === 1 ? gmForbidden(st.b, i) : ''; // 흑 금수 (렌주룰)
    if (ban) { s.pre = -1; E.sfx.wrong(); E.haptic('error'); E.banner(`금수예요 · 흑은 ${GM_BAN_NAME[ban]}를 둘 수 없어요`, 'info', 1600); return; }
    if (s.pre === i || E.pointer.type === 'mouse') this.act(i); // (A3 G3-1: a mouse places at once, as in the game room)
    else { s.pre = i; E.sfx.tap(); E.haptic('light'); }
  },

  update(dt) {
    for (const k in s.anim) { s.anim[k] += dt / 0.18; if (s.anim[k] >= 1) delete s.anim[k]; }
    if (net()) pump((seat, m, st) => this.load(st), (st) => this.load(st), (seat, m, st) => { if (st) this.load(st); });
    else if (!E.p2 && !s.st.over && s.st.turn === AI_SEAT) {
      s.aiT -= dt;
      if (s.aiT <= 0) {
        const m = gomokuAct(s.st, E.level, AI_SEAT);
        if (G.play(s.st, AI_SEAT, m)) this.after(m);
        else { s.aiT = 0.5; } // (일어나지 않음) 규칙에 맞지 않는 수면 다시 생각
      }
    }
    if (s.st.over) s.winT += dt;
  },

  stone(c, x, y, r, v, a = 1) {
    // A3 G3-2: my stones in my equipped 오목 skin (the game room's own drawing, SkinLooks); the AI's stay plain
    const mySkin = !net() && !E.p2 && E.opts?.pieceSkin; const looks = globalThis.SkinLooks;
    if (mySkin && looks?.def(mySkin)?.stone && s.st && v === gmColor(s.st, 0)) { c.save(); c.globalAlpha = a; c.translate(x, y); looks.paintStone(c, r, mySkin, v === 1 ? 'black' : 'white'); c.restore(); return; }
    c.globalAlpha = a;
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    const col = v === 1 ? s.sk.black : s.sk.white;
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    if (s.sk.glow) { E.glow(x, y, r * 1.9, v === 1 ? col[0] : col[1], 0.35 * a); c.globalAlpha = a; }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x + r * 0.12, y + r * 0.16, r, 0, 6.283); c.fill();
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    c.globalAlpha = 1;
  },
  btn(c, b, label, on) {
    c.fillStyle = on ? 'rgba(255,211,77,.92)' : 'rgba(255,255,255,.12)'; E.rr(b.x, b.y, b.w, b.h, 14); c.fill();
    E.text(label, b.x + b.w / 2, b.y + b.h / 2 + 1, 14, on ? '#2A1A05' : '#fff', 800);
  },

  draw(c) {
    const { ox, oy, cell, size } = s, half = cell / 2, st = s.st;
    const P = (i) => [ox + half + (i % N) * cell, oy + half + Math.floor(i / N) * cell];
    // 바둑판
    const g = c.createLinearGradient(ox, oy, ox + size, oy + size);
    g.addColorStop(0, s.sk.board[0]); g.addColorStop(1, s.sk.board[1]);
    c.fillStyle = 'rgba(0,0,0,.4)'; E.rr(ox - 6, oy, size + 12, size + 12, 14); c.fill();
    c.fillStyle = g; E.rr(ox - 6, oy - 6, size + 12, size + 12, 14); c.fill();
    c.strokeStyle = s.sk.line; c.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      c.beginPath(); c.moveTo(ox + half, oy + half + i * cell); c.lineTo(ox + size - half, oy + half + i * cell); c.stroke();
      c.beginPath(); c.moveTo(ox + half + i * cell, oy + half); c.lineTo(ox + half + i * cell, oy + size - half); c.stroke();
    }
    c.fillStyle = s.sk.star;
    for (const [x, y] of STAR) { c.beginPath(); c.arc(ox + half + x * cell, oy + half + y * cell, 3, 0, 6.283); c.fill(); }
    // 개시: 둘 수 있는 범위
    if (st.phase === 'open' && human()) {
      c.fillStyle = 'rgba(255,211,77,.28)';
      for (let i = 0; i < N * N; i++) if (gmOpenOk(st.b, st.stones, i)) { const [x, y] = P(i); c.beginPath(); c.arc(x, y, half * 0.42, 0, 6.283); c.fill(); }
    }
    // 미리보기
    const turnCol = st.phase === 'open' ? (st.stones === 1 ? 2 : 1) : st.phase === 'four' ? 2 : st.phase === 'pick' ? 1 : gmColor(st, st.turn);
    if (s.pre >= 0 && human()) {
      const [px, py] = P(s.pre);
      c.strokeStyle = 'rgba(255,90,121,.8)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(px, oy + half); c.lineTo(px, oy + size - half); c.moveTo(ox + half, py); c.lineTo(ox + size - half, py); c.stroke();
      this.stone(c, px, py, half * 0.88, turnCol, 0.5);
    }
    // 돌
    for (let i = 0; i < N * N; i++) {
      const v = st.b[i]; if (!v) continue;
      const [x, y] = P(i), a = s.anim[i] != null ? s.anim[i] : 1;
      this.stone(c, x, y, half * 0.88 * (0.6 + 0.4 * a), v);
    }
    // 5수 후보 (내가 고르는 중 · 흑이 내놓은 두 곳)
    const cands = st.phase === 'pick' ? st.five : st.phase === 'five' && human() ? s.sel : [];
    cands.forEach((i, k) => { const [x, y] = P(i); this.stone(c, x, y, half * 0.88, 1, 0.45); E.text(String(k + 1), x, y + 1, Math.max(10, half * 0.8), '#FFD34D', 900); });
    // 흑 금수 자리 (×)
    if (s.ban.length) {
      c.strokeStyle = 'rgba(255,90,121,.75)'; c.lineWidth = 1.6;
      const r = Math.max(3, half * 0.32);
      for (const i of s.ban) { const [x, y] = P(i); c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); }
    }
    if (st.last >= 0 && !st.over) { const [x, y] = P(st.last); c.fillStyle = '#FF5A79'; c.beginPath(); c.arc(x, y, Math.max(2.5, half * 0.22), 0, 6.283); c.fill(); }
    if (st.over?.cells) {
      const pulse = 0.5 + Math.sin(s.winT * 8) * 0.3, good = E.p2 || mineSeat(st.over.winner);
      for (const [x, y] of st.over.cells) {
        const px = ox + half + x * cell, py = oy + half + y * cell;
        E.glow(px, py, cell, good ? '#FFD34D' : '#FF5A79', pulse);
        c.strokeStyle = good ? '#FFD34D' : '#FF5A79'; c.lineWidth = 2.5;
        c.beginPath(); c.arc(px, py, half * 0.95, 0, 6.283); c.stroke();
      }
    }
    // 안내 · 버튼
    const me = human(), t = st.turn, tn = who(t);
    let txt;
    if (st.over) txt = st.over.winner == null ? '무승부' : E.p2 ? `${colName(gmColor(st, st.over.winner))} 오목 완성!` : mineSeat(st.over.winner) ? '오목 완성! 이겼어요' : `${who(st.over.winner)}가 오목을 만들었어요`;
    else if (st.phase === 'open') txt = me ? `개시 ${st.stones + 1}수 (${st.stones === 1 ? '백' : '흑'}) — 빛나는 칸에 둬요` : `${tn}가 개시 3수를 두는 중…`;
    else if (st.phase === 'swap') txt = me ? '흑과 백 중 어느 쪽을 할까요?' : `${tn}가 흑·백을 고르는 중…`;
    else if (st.phase === 'four') txt = me ? '백 4수: 아무 데나 둬요' : `${tn}(백)가 4수를 두는 중…`;
    else if (st.phase === 'five') txt = me ? `흑 5수 자리 두 곳을 골라요 (${s.sel.length}/2) — 상대가 하나를 골라요` : `${tn}(흑)가 5수 자리 두 곳을 고르는 중…`;
    else if (st.phase === 'pick') txt = me ? '흑 5수 두 곳 중 하나를 골라요 (그 자리에 흑이 놓여요)' : `${tn}(백)가 5수를 고르는 중…`;
    else txt = me ? (s.pre >= 0 ? '한 번 더 탭하면 착수' : E.p2 ? `${colName(gmColor(st, t))} 차례` : `내 차례 (${colName(gmColor(st, t))})`) : `${tn} 차례…`;
    E.text(txt, E.W / 2, oy + size + 28, 15, me ? '#FFD9A0' : '#fff', 800);
    if (me && st.phase === 'swap') { this.btn(c, s.btns.swap, '흑으로 바꾸기', false); this.btn(c, s.btns.keep, '그대로 백', false); }
    if (me && st.phase === 'five' && s.sel.length === 2) this.btn(c, s.btns.five, '이 두 곳 내놓기', true);
  },
};
