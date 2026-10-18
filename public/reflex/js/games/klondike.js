import { E } from '../engine.js';
import { Table, drawTable, card, shuffle, isRed, drawButtons, btnAt, fmtClock, SPADE, HEART, DIAMOND, CLUB } from './cards.js';
import { rng } from './pz-util.js'; // 아일랜드 v1.10.70: the deal from the server's seed (E.opts.seed), so the server can replay it

// 카드놀이(클론다이크) — 윈도우 '카드놀이'와 같은 규칙
// · 7줄: 1~7장, 맨 위만 앞면. 남은 24장은 더미.
// · 더미를 누르면 1장(쉬움) 또는 3장(어려움)을 넘긴다. 다 넘기면 다시 뒤집어 처음부터 (횟수 제한 없음).
// · 줄에서는 색을 번갈아 1씩 작아지게 쌓는다. 빈 줄에는 K(또는 K로 시작하는 묶음)만 놓을 수 있다.
// · 맨 위 4칸에는 무늬별로 A부터 K까지 쌓는다. 52장을 모두 올리면 승리. 빨리 끝낼수록 높은 순위.
let s, T;

export default {
  id: 'klondike', name: '카드놀이', cat: 'card',
  color: '#E0457B', c2: '#9C2A6E', c3: '#4A0F33',
  tagline: '모든 카드를 무늬별로 A부터 K까지 올리세요', // 아일랜드: 「윈도우의 그 카드놀이!」 (a product name) left out
  howto: [['drag', '카드를 끌어서 색이 다르고 숫자가 1 큰 카드 위에 놓아요. 탭하면 알맞은 자리로 가요'], ['cards', '왼쪽 위 더미를 누르면 카드를 넘겨요. 빈 줄에는 K만 놓을 수 있어요'], ['trophy', '무늬별로 A부터 K까지 위 4칸에 모두 올리면 클리어. 빠를수록 높은 순위!']],
  unit: 'time', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간', noTint: true, bg: '#0B2419',
  levels: true, levelIds: ['easy', 'hard'], defaultLevel: 'easy', levelTitle: '넘기기',
  levelNames: { easy: '1장 넘기기', hard: '3장 넘기기' },
  levelNote: '1장: 더미를 한 장씩 넘겨요 · 3장: 세 장씩 넘기고 맨 위 한 장만 쓸 수 있어요',
  rankRule: '클리어 시간이 빠른 순',

  get _T() { return T; }, // 자동 테스트용
  get _s() { return s; },

  init() {
    T = new Table();
    const deck = shuffle([SPADE, HEART, DIAMOND, CLUB].flatMap((su) => Array.from({ length: 13 }, (_, i) => card(su, i + 1))), rng(E.opts?.seed ?? Date.now()));
    const stock = T.add('stock', 'stock', { noDrop: true });
    T.add('waste', 'waste', { fan: 'waste3', hidden: true, noDrop: true });
    for (let i = 0; i < 4; i++) T.add('f' + i, 'found');
    for (let i = 0; i < 7; i++) T.add('t' + i, 'tab', { fan: 'down' });
    s = { draw: E.level === 'hard' ? 3 : 1, moves: 0, passes: 0, won: false, auto: false, autoT: 0 };
    stock.cards = deck;
    this.layout();
    let n = 0;
    for (let row = 0; row < 7; row++) for (let i = row; i < 7; i++) { const cd = stock.cards.pop(); cd.delay = n++ * 0.02; T.get('t' + i).cards.push(cd); }
    for (let i = 0; i < 7; i++) { const p = T.get('t' + i); p.cards[p.cards.length - 1].up = true; }
    for (const cd of T.all()) { cd.placed = true; cd.x = stock.x; cd.y = stock.y; }
    T.layout();
    E.hud({ center: '0:00', right: '이동 0' });
  },
  layout() {
    const gap = E.W < 400 ? 5 : 8;
    T.cw = Math.min(E.W > 900 ? Math.min(124, (E.bottom - E.top) / 6.2) : 80, (E.W - 12 - gap * 6) / 7); /* (A3 G4: bigger on a wide PC frame) */ T.ch = T.cw * 1.4;
    const { cw, ch } = T, x0 = (E.W - (cw * 7 + gap * 6)) / 2, col = (i) => x0 + i * (cw + gap), y0 = E.top + 4;
    T.get('stock').x = col(0); T.get('stock').y = y0;
    T.get('waste').x = col(1); T.get('waste').y = y0;
    for (let i = 0; i < 4; i++) { const p = T.get('f' + i); p.x = col(3 + i); p.y = y0; }
    const by = E.bottom - 46;
    for (let i = 0; i < 7; i++) { const p = T.get('t' + i); p.x = col(i); p.y = y0 + ch + 14; p.maxH = by - 8 - p.y; }
    s.btns = [{ id: 'undo', label: '되돌리기', x: E.W / 2 - 84, y: by, w: 80, h: 40 }, { id: 'hint', label: '힌트', x: E.W / 2 + 4, y: by, w: 80, h: 40 }];
    T.layout();
  },
  tabs() { return T.piles.filter((p) => p.kind === 'tab'); },
  founds() { return T.piles.filter((p) => p.kind === 'found'); },
  state() { return { moves: s.moves, passes: s.passes }; },

  /* ---------- 규칙 ---------- */
  // 줄에서 idx부터 끝까지가 색을 번갈아 1씩 작아지는 앞면 카드인가
  run(p, idx) {
    const c = p.cards;
    if (idx < 0 || idx >= c.length || !c[idx].up) return false;
    for (let i = idx + 1; i < c.length; i++) if (!c[i].up || isRed(c[i].s) === isRed(c[i - 1].s) || c[i].r !== c[i - 1].r - 1) return false;
    return true;
  },
  canPick(p, idx) {
    if (idx < 0) return false;
    if (p.kind === 'tab') return this.run(p, idx);
    return (p.kind === 'waste' || p.kind === 'found') && idx === p.cards.length - 1;
  },
  canDrop(cards, to) {
    const cd = cards[0], top = to.cards[to.cards.length - 1];
    if (to.kind === 'found') return cards.length === 1 && (top ? top.s === cd.s && top.r === cd.r - 1 : cd.r === 1);
    if (to.kind === 'tab') return top ? top.up && isRed(top.s) !== isRed(cd.s) && top.r === cd.r + 1 : cd.r === 13;
    return false;
  },
  // 탭했을 때 갈 곳: 올리기 > 다른 줄 (빈 줄은 K가 줄 맨 아래가 아닐 때만)
  target(p, idx) {
    const cards = p.cards.slice(idx);
    if (cards.length === 1 && p.kind !== 'found') for (const f of this.founds()) if (this.canDrop(cards, f)) return f;
    let empty = null;
    for (const q of this.tabs()) {
      if (q === p || !this.canDrop(cards, q)) continue;
      if (q.cards.length) return q;
      if (!(p.kind === 'tab' && idx === 0)) empty ||= q;
    }
    return empty;
  },
  doMove(from, idx, to) {
    T.save(this.state());
    T.move(from, idx, to);
    s.moves++;
    E.sfx.flip(); E.haptic('light');
    if (to.kind === 'found') E.sfx.score();
    this.after(from);
  },
  after(from) {
    const top = from?.cards[from.cards.length - 1];
    if (from?.kind === 'tab' && top && !top.up) { top.up = true; E.sfx.tap(); }
    T.layout();
    if (this.founds().every((f) => f.cards.length === 13)) return this.win();
    // 더미·버린 카드가 없고 줄의 카드가 모두 앞면이면 남은 건 자동으로 올린다
    if (!s.auto && !T.get('stock').cards.length && !T.get('waste').cards.length && this.tabs().every((p) => p.cards.every((cd) => cd.up))) {
      s.auto = true; s.autoT = 0.25; E.banner('자동으로 마무리할게요', 'sparkle', 1200);
    }
  },
  win() {
    if (s.won) return;
    s.won = true;
    const ms = Math.round(E.t * 1000);
    E.sfx.win(); E.haptic('success');
    for (let k = 0; k < 8; k++) E.burst(E.W / 2, E.H / 2, ['#FFD34D', '#FF6FB5', '#43D9FF', '#3DDC97'][k % 4], 20, 420);
    E.end(null, { score: ms, delay: 1.3, title: '클리어!', stats: [['시간', fmtClock(E.t)], ['이동', s.moves + '번'], ['방식', s.draw === 3 ? '3장' : '1장']] });
  },
  flip() {
    const st = T.get('stock'), w = T.get('waste');
    T.save(this.state());
    if (!st.cards.length) {
      if (!w.cards.length) { T.hist.pop(); return; }
      // 다 넘겼으면 버린 카드를 뒤집어 다시 더미로
      st.cards = w.cards.reverse().map((cd) => { cd.up = false; return cd; }); w.cards = []; w.fanFrom = 0;
      s.passes++; E.sfx.flip();
    } else {
      w.fanFrom = w.cards.length;
      for (let i = 0; i < s.draw && st.cards.length; i++) { const cd = st.cards.pop(); cd.up = true; cd.delay = i * 0.06; w.cards.push(cd); }
      E.sfx.flip();
    }
    s.moves++;
    T.layout();
    this.after(null);
  },
  undo() {
    const prev = T.undo();
    if (!prev) { E.sfx.wrong(); return; }
    s.moves = prev.moves + 1; s.passes = prev.passes; s.auto = false;
    const w = T.get('waste'); w.fanFrom = Math.max(0, w.cards.length - s.draw); T.layout();
    E.sfx.move();
  },
  hint() {
    const srcs = [T.get('waste'), ...this.tabs()];
    // 1) 위로 올릴 수 있는 카드  2) 뒷면 카드를 드러내는 이동  3) 버린 카드를 줄로
    let best = null;
    const consider = (sc, cards) => { if (!best || sc > best.sc) best = { sc, cards }; };
    for (const p of srcs) {
      const n = p.cards.length;
      if (!n) continue;
      const top = p.cards[n - 1];
      for (const f of this.founds()) if (this.canDrop([top], f)) consider(5, [top, ...f.cards.slice(-1)]);
      if (p.kind === 'waste') { for (const q of this.tabs()) if (this.canDrop([top], q)) consider(3, [top, ...q.cards.slice(-1)]); continue; }
      const i0 = p.cards.findIndex((cd) => cd.up);
      if (i0 < 0 || !this.run(p, i0)) continue;
      for (const q of this.tabs()) {
        if (q === p || !this.canDrop(p.cards.slice(i0), q)) continue;
        if (!q.cards.length && i0 === 0) continue; // 줄 전체를 빈 줄로 옮기는 건 헛수
        consider(i0 > 0 ? 4 : 1, [...p.cards.slice(i0), ...q.cards.slice(-1)]);
      }
      // 묶음의 일부만 옮기기: 드러나는 카드를 위로 올릴 수 있으면 권하고, 더미까지 다 썼으면 길을 찾도록 그냥 옮기는 수도 권한다
      const noStock = !T.get('stock').cards.length && !T.get('waste').cards.length;
      for (let i = i0 + 1; i < n; i++) for (const q of this.tabs()) {
        if (q === p || !q.cards.length || !this.canDrop(p.cards.slice(i), q)) continue;
        const up = this.founds().some((f) => this.canDrop([p.cards[i - 1]], f));
        if (up || noStock) consider(up ? 3.5 : 0.5, [...p.cards.slice(i), ...q.cards.slice(-1)]);
      }
    }
    if (best) { T.flash(best.cards); E.sfx.ui(); return; }
    if (T.get('stock').cards.length || T.get('waste').cards.length) { T.flash(T.get('stock').cards.slice(-1)); E.banner('더미에서 카드를 넘겨 보세요', 'info', 1400); }
    else E.banner('더 이상 옮길 곳이 없어요. 되돌리기로 다른 길을 찾아 보세요', 'info', 2000);
  },

  /* ---------- 입력 ---------- */
  down(x, y) {
    if (s.won || s.auto) return;
    const b = btnAt(s.btns, x, y);
    if (b) { b.on = true; setTimeout(() => (b.on = false), 120); return b.id === 'undo' ? this.undo() : this.hint(); }
    const h = T.hit(x, y);
    if (!h) return;
    if (h.pile.kind === 'stock') return this.flip();
    if (!this.canPick(h.pile, h.idx)) { if (h.idx >= 0 && h.pile.cards[h.idx].up) T.nope(h.pile.cards.slice(h.idx)); return; }
    T.startDrag(h.pile, h.idx, x, y);
  },
  move(x, y) { T.moveDrag(x, y); },
  up() {
    const d = T.endDrag();
    if (!d) return;
    if (!d.moved) {
      const q = this.target(d.pile, d.idx);
      if (q) this.doMove(d.pile, d.idx, q); else { T.nope(d.cards); E.sfx.wrong(); }
      return;
    }
    const first = d.cards[0], to = T.dropAt(first.x + T.cw / 2, first.y + T.ch / 2, d.pile);
    if (to && this.canDrop(d.cards, to)) this.doMove(d.pile, d.idx, to);
    else { T.layout(); E.sfx.move(); }
  },
  key(k) { if (k === 'z' || k === 'Backspace') this.undo(); else if (k === 'h') this.hint(); else if (k === ' ') this.flip(); },

  update(dt) {
    T.update(dt);
    E.hud({ center: fmtClock(E.t), right: `이동 ${s.moves}` });
    // 자동 마무리: 올릴 수 있는 가장 작은 카드부터 차례로
    if (s.auto && !s.won && (s.autoT -= dt) <= 0) {
      s.autoT = 0.09;
      let pick = null;
      for (const p of this.tabs()) {
        const top = p.cards[p.cards.length - 1];
        if (!top) continue;
        const f = this.founds().find((q) => this.canDrop([top], q));
        if (f && (!pick || top.r < pick.cd.r)) pick = { p, f, cd: top };
      }
      if (pick) { T.move(pick.p, pick.p.cards.length - 1, pick.f); s.moves++; E.sfx.tap(); if (this.founds().every((f) => f.cards.length === 13)) this.win(); }
    }
  },
  draw(c) {
    drawTable(c); // (A3 G3-5: the shared card table)
    T.draw(c, (p) => (p.kind === 'stock' ? { label: T.get('waste').cards.length ? '↻' : '' } : p.kind === 'found' ? { label: 'A' } : p.kind === 'tab' ? { label: 'K' } : null));
    drawButtons(c, s.btns);
  },
};
