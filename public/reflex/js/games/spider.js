import { E } from '../engine.js';
import { Table, card, shuffle, drawBack, drawButtons, btnAt, fmtClock, SPADE, HEART, DIAMOND, CLUB } from './cards.js';
import { rng } from './pz-util.js'; // 아일랜드 v1.10.70: the deal from the server's seed (E.opts.seed), so the server can replay it

// 스파이더 카드놀이 — 윈도우와 같은 규칙
// · 카드 2벌(104장), 10줄. 앞 4줄은 6장, 나머지 6줄은 5장, 맨 위만 앞면. 남은 50장은 10장씩 5번 나눠 준다.
// · 아무 무늬든 숫자가 1 큰 카드 위에 옮길 수 있다. 여러 장을 한 번에 옮기려면 같은 무늬로 이어져 있어야 한다.
// · 같은 무늬로 K부터 A까지 13장을 모으면 치워진다. 8묶음을 모두 치우면 승리.
// · 빈 줄이 있으면 카드를 나눠 줄 수 없다. 점수: 500점에서 시작, 이동(되돌리기 포함) 1번마다 -1, 한 묶음 치울 때마다 +100.
let s, T;
const SUITS = { easy: [SPADE], normal: [SPADE, HEART], hard: [SPADE, HEART, DIAMOND, CLUB] };

export default {
  id: 'spider', name: '스파이더 카드놀이', cat: 'card',
  color: '#1FA463', c2: '#0E7A57', c3: '#064030',
  tagline: '같은 무늬로 K부터 A까지 모아 모든 카드를 치우세요',
  howto: [['drag', '카드를 끌어서 숫자가 1 큰 카드 위에 놓아요. 탭하면 알맞은 자리로 자동으로 가요'], ['cards', '같은 무늬로 이어진 카드는 한꺼번에 옮길 수 있어요. K~A 한 무늬를 모으면 치워져요'], ['grid', '오른쪽 아래 카드 더미를 누르면 10장을 새로 나눠요 (빈 줄이 없어야 해요)']],
  hideScore: true, customRight: true, hudLabel: '점수', noTint: true, bg: '#0B2419',
  levels: true, defaultLevel: 'easy', levelTitle: '무늬 수',
  levelNames: { easy: '1벌', normal: '2벌', hard: '4벌' },
  levelNote: '1벌: 스페이드만 · 2벌: 스페이드·하트 · 4벌: 네 무늬 모두 (어려움)',
  rankRule: '클리어했을 때 점수가 높은 순 (500점에서 이동마다 -1, 한 묶음마다 +100)',

  get _T() { return T; }, // 자동 테스트용
  get _s() { return s; },

  init() {
    T = new Table();
    const suits = SUITS[E.level] || SUITS.easy, deck = [];
    for (let k = 0; k < 8; k++) { const su = suits[k % suits.length]; for (let r = 1; r <= 13; r++) deck.push(card(su, r)); }
    shuffle(deck, rng(E.opts?.seed ?? Date.now()));
    for (let i = 0; i < 10; i++) T.add('t' + i, 'tab', { fan: 'down' });
    for (let k = 0; k < 8; k++) T.add('d' + k, 'done', { hidden: true, noDrop: true });
    const stock = T.add('stock', 'stock', { hidden: true, noDrop: true });
    stock.cards = deck;
    s = { score: 500, moves: 0, done: 0, won: false, stuckT: 0 };
    this.layout();
    // 처음 54장 나눠 주기 (한 장씩 날아가는 연출)
    let n = 0;
    for (let row = 0; row < 6; row++) for (let i = 0; i < 10; i++) {
      if (row === 5 && i >= 4) continue;
      const cd = stock.cards.pop(); cd.delay = n++ * 0.012;
      T.get('t' + i).cards.push(cd);
    }
    for (let i = 0; i < 10; i++) { const p = T.get('t' + i); p.cards[p.cards.length - 1].up = true; }
    for (const cd of T.all()) { cd.placed = true; cd.x = stock.x; cd.y = stock.y; }
    T.layout();
    this.hud();
  },
  layout() {
    const gap = E.W < 400 ? 3 : 5;
    T.cw = Math.min(64, (E.W - 12 - gap * 9) / 10); T.ch = T.cw * 1.4;
    const { cw, ch } = T, x0 = (E.W - (cw * 10 + gap * 9)) / 2;
    s.barY = E.bottom - ch - 4;
    for (let i = 0; i < 10; i++) { const p = T.get('t' + i); p.x = x0 + i * (cw + gap); p.y = E.top + 4; p.maxH = s.barY - 10 - p.y; }
    for (let k = 0; k < 8; k++) { const p = T.get('d' + k); p.x = 8 + k * cw * 0.3; p.y = s.barY; }
    // 더미는 오른쪽 끝, 남은 나눔 횟수만큼 왼쪽으로 뒷면을 겹쳐 보여 준다
    const st = T.get('stock'); st.x = E.W - 8 - cw; st.y = s.barY;
    // 두 버튼은 '완성한 묶음'과 '나눔 더미(뒷면을 가장 많이 겹친 때)' 사이 남는 폭 안에만 둔다 — 좁은 화면에서 버튼이 더미 위로 겹쳐
    // 더미를 눌렀는데 힌트가 나가던 문제 (GPT 전수검토 R018) · 남는 폭이 모자라면 버튼을 줄인다
    const bh = 40, bx = 8 + 8 * cw * 0.3 + cw + 10, stockLeft = st.x - 4 * cw * 0.2, room = stockLeft - 10 - bx;
    const bw = Math.max(36, Math.min(76, (room - 8) / 2)), b0 = bx + Math.max(0, (room - (bw * 2 + 8)) / 2), by = s.barY + (ch - bh) / 2;
    const short = bw < 62;
    s.btns = [{ id: 'undo', label: short ? '되돌림' : '되돌리기', x: b0, y: by, w: bw, h: bh }, { id: 'hint', label: '힌트', x: b0 + bw + 8, y: by, w: bw, h: bh }];
    T.layout();
  },
  hud() {
    E.hud({ center: String(s.score), right: `완성 ${s.done}/8` });
  },
  tabs() { return T.piles.filter((p) => p.kind === 'tab'); },
  state() { return { score: s.score, moves: s.moves, done: s.done }; },

  /* ---------- 규칙 ---------- */
  // idx부터 끝까지가 같은 무늬로 1씩 작아지는 앞면 카드인가
  run(p, idx) {
    const c = p.cards;
    if (idx < 0 || idx >= c.length || !c[idx].up) return false;
    for (let i = idx + 1; i < c.length; i++) if (!c[i].up || c[i].s !== c[i - 1].s || c[i].r !== c[i - 1].r - 1) return false;
    return true;
  },
  canDrop(cards, to) {
    if (to.kind !== 'tab') return false;
    const top = to.cards[to.cards.length - 1];
    return !top || (top.up && top.r === cards[0].r + 1);
  },
  // 옮길 곳 고르기: 같은 무늬 이어 붙이기 > 다른 무늬라도 1 큰 카드 > 빈 줄(줄 전체가 아닐 때만)
  bestTarget(p, idx) {
    const cd = p.cards[idx];
    let best = null, bs = -1;
    for (const q of this.tabs()) {
      if (q === p) continue;
      const top = q.cards[q.cards.length - 1];
      let sc = -1;
      if (!top) sc = idx > 0 ? 1 : -1;
      else if (top.up && top.r === cd.r + 1) sc = top.s === cd.s ? 4 + this.runLen(q) * 0.01 : 2;
      if (sc > bs) { bs = sc; best = q; }
    }
    return bs > 0 ? best : null;
  },
  runLen(q) { let n = 1; for (let i = q.cards.length - 1; i > 0 && this.run(q, i - 1); i--) n++; return n; },
  doMove(from, idx, to) {
    T.save(this.state());
    T.move(from, idx, to);
    s.moves++; s.score--;
    E.sfx.flip(); E.haptic('light');
    this.after([from, to]);
  },
  // 옮긴 뒤: 뒷면 카드 뒤집기 · 완성된 묶음 치우기 · 승리 확인
  after(piles) {
    for (const p of piles) {
      this.collect(p);
      const top = p.cards[p.cards.length - 1];
      if (p.kind === 'tab' && top && !top.up) { top.up = true; E.sfx.tap(); }
    }
    T.layout(); this.hud();
    if (s.done === 8 && !s.won) {
      s.won = true;
      E.sfx.win(); E.haptic('success'); E.banner('모두 치웠어요!', 'crown', 1500);
      for (let k = 0; k < 8; k++) E.burst(E.W / 2, E.H / 2, ['#FFD34D', '#FF6FB5', '#43D9FF', '#3DDC97'][k % 4], 20, 420);
      E.end(null, { score: Math.max(0, s.score), delay: 1.4, title: '클리어!', stats: [['점수', s.score], ['이동', s.moves + '번'], ['시간', fmtClock(E.t)]] });
    }
  },
  collect(p) {
    const n = p.cards.length;
    if (p.kind !== 'tab' || n < 13) return;
    const run = p.cards.slice(n - 13);
    if (run[0].r !== 13 || !run.every((cd, i) => cd.up && cd.s === run[0].s && cd.r === 13 - i)) return;
    const d = T.get('d' + s.done);
    p.cards.splice(n - 13);
    run.reverse().forEach((cd, i) => { cd.delay = i * 0.03; d.cards.push(cd); }); // K가 맨 위로 오게
    s.done++; s.score += 100;
    E.sfx.clear(); E.haptic('success');
    E.popup('+100', p.x + T.cw / 2, s.barY - 20, '#FFD34D', 20);
  },
  deal() {
    const st = T.get('stock');
    if (!st.cards.length) return;
    if (this.tabs().some((p) => !p.cards.length)) { E.banner('빈 줄이 있으면 카드를 나눌 수 없어요', 'info', 1600); E.sfx.wrong(); return; }
    T.save(this.state());
    this.tabs().forEach((p, i) => { const cd = st.cards.pop(); cd.up = true; cd.delay = i * 0.05; p.cards.push(cd); });
    s.moves++; s.score--;
    E.sfx.drop(); E.haptic('medium');
    this.after(this.tabs());
  },
  undo() {
    const cur = this.state(), prev = T.undo();
    if (!prev) { E.sfx.wrong(); return; }
    // 되돌리기도 한 번의 이동으로 친다 (윈도우 점수 규칙). 되돌린 묶음의 +100은 빼낸다
    s.done = prev.done; s.moves = cur.moves + 1; s.score = cur.score - 1 - (cur.done - prev.done) * 100;
    E.sfx.move(); this.hud();
  },
  hint() {
    // 가장 쓸모 있는 이동 찾기 (이미 알맞게 붙어 있는 카드를 옆으로만 옮기는 헛수는 빼고)
    let best = null;
    for (const p of this.tabs()) {
      for (let i = 0; i < p.cards.length; i++) {
        if (!this.run(p, i)) continue;
        const cd = p.cards[i], par = p.cards[i - 1];
        const parentOk = par && par.up && par.r === cd.r + 1, parentSame = parentOk && par.s === cd.s;
        const reveals = par && !par.up;
        for (const q of this.tabs()) {
          if (q === p) continue;
          const top = q.cards[q.cards.length - 1];
          let sc = 0;
          if (!top) sc = i > 0 && !parentOk ? 1 + (reveals ? 2 : 0) : 0;
          else if (top.up && top.r === cd.r + 1) {
            const same = top.s === cd.s;
            if (parentSame || (parentOk && !same)) continue;
            sc = (same ? 5 : 2) + (reveals ? 3 : 0) + (i === 0 ? 1 : 0);
          }
          if (sc > 0 && (!best || sc > best.sc)) best = { sc, cards: p.cards.slice(i).concat(top ? [top] : []) };
        }
      }
    }
    if (best) { T.flash(best.cards); E.sfx.ui(); return; }
    const st = T.get('stock');
    if (st.cards.length) { T.flash(st.cards.slice(-1)); E.banner('옮길 곳이 없어요. 카드를 나눠 보세요', 'info', 1500); }
    else E.banner('더 이상 옮길 곳이 없어요. 되돌리기로 다른 길을 찾아 보세요', 'info', 2000);
  },

  /* ---------- 입력 ---------- */
  down(x, y) {
    if (s.won) return;
    const b = btnAt(s.btns, x, y);
    if (b) { b.on = true; setTimeout(() => (b.on = false), 120); return b.id === 'undo' ? this.undo() : this.hint(); }
    const st = T.get('stock');
    if (st.cards.length && x >= st.x - 4 * T.cw * 0.2 && x <= st.x + T.cw && y >= st.y && y <= st.y + T.ch) return this.deal();
    const h = T.hit(x, y);
    if (!h || h.pile.kind !== 'tab' || h.idx < 0) return;
    if (!this.run(h.pile, h.idx)) { if (h.pile.cards[h.idx].up) T.nope(h.pile.cards.slice(h.idx)); return; }
    T.startDrag(h.pile, h.idx, x, y);
  },
  move(x, y) { T.moveDrag(x, y); },
  up(x, y) {
    const d = T.endDrag();
    if (!d) return;
    if (!d.moved) { // 탭: 알맞은 자리로 자동 이동
      const q = this.bestTarget(d.pile, d.idx);
      if (q) this.doMove(d.pile, d.idx, q); else { T.nope(d.cards); E.sfx.wrong(); }
      return;
    }
    const first = d.cards[0], to = T.dropAt(first.x + T.cw / 2, first.y + T.ch / 2, d.pile);
    if (to && this.canDrop(d.cards, to)) this.doMove(d.pile, d.idx, to);
    else { T.layout(); E.sfx.move(); }
  },
  key(k) { if (k === 'z' || k === 'Backspace') this.undo(); else if (k === 'h') this.hint(); else if (k === ' ') this.deal(); },

  update(dt) {
    T.update(dt);
    E.hud({ center: String(s.score) });
  },
  draw(c) {
    const { cw, ch } = T, st = T.get('stock');
    // 녹색 펠트
    const g = c.createRadialGradient(E.W / 2, E.H * 0.35, 0, E.W / 2, E.H * 0.35, E.H * 0.8);
    g.addColorStop(0, '#15603F'); g.addColorStop(1, '#0A2E20');
    c.fillStyle = g; c.fillRect(0, 0, E.W, E.H);
    // 남은 나눠 주기 횟수만큼 뒷면을 겹쳐 보여 준다
    const deals = Math.ceil(st.cards.length / 10);
    for (let k = 1; k < deals; k++) drawBack(c, st.x - k * cw * 0.2, st.y, cw, ch);
    if (!deals) { c.globalAlpha = 0.4; E.text('나눔 끝', st.x + cw / 2, st.y + ch / 2, 11, '#fff', 800); c.globalAlpha = 1; }
    T.draw(c, (p) => (p.kind === 'tab' ? null : false));
    drawButtons(c, s.btns);
    if (s.done === 0) E.text('완성한 묶음', 8 + cw * 1.1, s.barY + ch / 2, 11, 'rgba(255,255,255,.35)', 700);
  },
};
