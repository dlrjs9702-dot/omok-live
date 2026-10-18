import { E } from '../engine.js';
import { Table, card, isRed, drawButtons, btnAt, fmtClock, SPADE, HEART, DIAMOND, CLUB } from './cards.js';
import { HARD_DEALS } from './freecell-deals.js';
import { rng } from './pz-util.js';

// 프리셀 — 윈도우와 같은 규칙과 같은 게임 번호
// · 52장을 모두 앞면으로 8줄에 나눈다 (앞 4줄 7장, 뒤 4줄 6장). 왼쪽 위 4칸은 빈칸(한 장씩 보관), 오른쪽 위 4칸은 올리는 곳.
// · 한 번에 한 장씩 옮긴다. 줄에는 색을 번갈아 1씩 작아지게 쌓고, 빈 줄에는 아무 카드나 놓을 수 있다.
// · 여러 장 한 번에 옮기기는 빈칸·빈 줄로 한 장씩 옮기는 것과 같아서 (빈칸+1) × 2^(빈 줄) 장까지 된다.
// · 게임 번호: 윈도우 프리셀과 같은 섞기 공식 (1~32000번, 11982번은 풀 수 없어서 제외)
let s, T;

// 마이크로소프트 프리셀 섞기 (게임 번호가 같으면 윈도우와 같은 배치)
export function msDeal(num) {
  let seed = num;
  const rnd = () => { seed = (seed * 214013 + 2531011) & 0x7fffffff; return seed >> 16; };
  const deck = Array.from({ length: 52 }, (_, i) => 51 - i);
  for (let i = 0; i < 51; i++) { const j = 51 - (rnd() % (52 - i)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  // 카드 번호 c: 무늬 = c % 4 (클로버·다이아·하트·스페이드 순), 숫자 = c / 4 + 1
  return deck.map((c) => ({ s: [CLUB, DIAMOND, HEART, SPADE][c % 4], r: (c >> 2) + 1 }));
}

export default {
  id: 'freecell', name: '프리셀', cat: 'card',
  color: '#2F80ED', c2: '#1B4FB8', c3: '#0A2466',
  tagline: '빈칸을 잘 써서 모든 카드를 무늬별로 올리세요',
  howto: [['drag', '카드를 끌어서 색이 다르고 숫자가 1 큰 카드 위에 놓아요. 탭하면 알맞은 자리로 가요'], ['grid', '왼쪽 위 빈칸(쉬움 4개 · 어려움 3개)에는 아무 카드나 한 장씩 잠시 둘 수 있어요'], ['trophy', '무늬별로 A부터 K까지 오른쪽 위에 모두 올리면 클리어. 빠를수록 높은 순위!']],
  unit: 'time', lowerBetter: true, hideScore: true, customRight: true, hudLabel: '시간', noTint: true, bg: '#0B2419',
  rankRule: '클리어 시간이 빠른 순',
  levels: true, levelIds: ['easy', 'hard'], levelLegacy: 'easy', defaultLevel: 'easy', levelTitle: '빈칸',
  levelNames: { easy: '빈칸 4개', hard: '빈칸 3개' },
  levelNote: '빈칸 4개: 윈도우 프리셀과 같아요 · 빈칸 3개: 한 번에 옮길 수 있는 장수도 줄어요',

  get _T() { return T; }, // 자동 테스트용
  get _s() { return s; },

  init() {
    T = new Table();
    const cells = E.level === 'hard' ? 3 : 4;
    for (let i = 0; i < cells; i++) T.add('c' + i, 'cell');
    for (let i = 0; i < 4; i++) T.add('f' + i, 'found');
    for (let i = 0; i < 8; i++) T.add('t' + i, 'tab', { fan: 'down' });
    let num;
    const rnd = rng(E.opts?.seed ?? Date.now()); // 아일랜드 v1.10.70: the game number from the server's seed, so the server can replay it
    if (cells === 3) num = HARD_DEALS[Math.floor(rnd() * HARD_DEALS.length)]; // 빈칸 3개로 풀리는 것을 확인한 번호만
    else do num = 1 + Math.floor(rnd() * 32000); while (num === 11982);
    s = { num, moves: 0, won: false, autoT: 0 };
    this.layout();
    const cx = E.W / 2, cy = E.bottom;
    msDeal(num).forEach((d, i) => {
      const cd = card(d.s, d.r, true);
      cd.placed = true; cd.x = cx - T.cw / 2; cd.y = cy; cd.delay = i * 0.012;
      T.get('t' + (i % 8)).cards.push(cd);
    });
    T.layout();
    E.hud({ center: '0:00', right: '#' + num });
  },
  layout() {
    const gap = E.W < 400 ? 4 : 7;
    T.cw = Math.min(E.W > 900 ? Math.min(118, (E.bottom - E.top) / 6.6) : 76, (E.W - 12 - gap * 7) / 8); /* (A3 G4) */ T.ch = T.cw * 1.4;
    const { cw, ch } = T, x0 = (E.W - (cw * 8 + gap * 7)) / 2, col = (i) => x0 + i * (cw + gap), y0 = E.top + 4;
    this.kind('cell').forEach((p, i) => Object.assign(p, { x: col(i), y: y0 }));
    for (let i = 0; i < 4; i++) Object.assign(T.get('f' + i), { x: col(4 + i), y: y0 });
    const by = E.bottom - 46;
    for (let i = 0; i < 8; i++) { const p = T.get('t' + i); p.x = col(i); p.y = y0 + ch + 14; p.maxH = by - 8 - p.y; }
    s.btns = [{ id: 'undo', label: '되돌리기', x: E.W / 2 - 84, y: by, w: 80, h: 40 }, { id: 'hint', label: '힌트', x: E.W / 2 + 4, y: by, w: 80, h: 40 }];
    T.layout();
  },
  kind(k) { return T.piles.filter((p) => p.kind === k); },
  state() { return { moves: s.moves }; },

  /* ---------- 규칙 ---------- */
  run(p, idx) {
    const c = p.cards;
    if (idx < 0 || idx >= c.length) return false;
    for (let i = idx + 1; i < c.length; i++) if (isRed(c[i].s) === isRed(c[i - 1].s) || c[i].r !== c[i - 1].r - 1) return false;
    return true;
  },
  // 한 번에 옮길 수 있는 장수: (빈칸 + 1) × 2^(빈 줄) — 빈 줄로 옮길 때는 그 줄은 빼고 센다
  maxMove(to) {
    const cells = this.kind('cell').filter((p) => !p.cards.length).length;
    const empt = this.kind('tab').filter((p) => !p.cards.length && p !== to).length;
    return (cells + 1) * 2 ** empt;
  },
  canPick(p, idx) {
    if (idx < 0) return false;
    if (p.kind === 'tab') return this.run(p, idx);
    return p.kind === 'cell' && idx === p.cards.length - 1;
  },
  canDrop(cards, to) {
    const cd = cards[0], top = to.cards[to.cards.length - 1];
    if (to.kind === 'found') return cards.length === 1 && (top ? top.s === cd.s && top.r === cd.r - 1 : cd.r === 1);
    if (to.kind === 'cell') return cards.length === 1 && !top;
    if (to.kind === 'tab') {
      if (cards.length > this.maxMove(to)) return false;
      return !top || (isRed(top.s) !== isRed(cd.s) && top.r === cd.r + 1);
    }
    return false;
  },
  // 탭했을 때 갈 곳: 올리기 > 이어 붙일 줄 > 빈칸 > 빈 줄
  target(p, idx) {
    const cards = p.cards.slice(idx);
    for (const f of this.kind('found')) if (this.canDrop(cards, f)) return f;
    for (const q of this.kind('tab')) if (q !== p && q.cards.length && this.canDrop(cards, q)) return q;
    if (p.kind === 'tab') for (const q of this.kind('cell')) if (this.canDrop(cards, q)) return q;
    if (!(p.kind === 'tab' && idx === 0)) for (const q of this.kind('tab')) if (q !== p && !q.cards.length && this.canDrop(cards, q)) return q;
    return null;
  },
  doMove(from, idx, to) {
    T.save(this.state());
    T.move(from, idx, to);
    s.moves++;
    E.sfx.flip(); E.haptic('light');
    if (to.kind === 'found') E.sfx.score();
    s.autoT = 0.2;
    this.check();
  },
  check() {
    if (!s.won && this.kind('found').every((f) => f.cards.length === 13)) {
      s.won = true;
      E.sfx.win(); E.haptic('success');
      for (let k = 0; k < 8; k++) E.burst(E.W / 2, E.H / 2, ['#FFD34D', '#FF6FB5', '#43D9FF', '#3DDC97'][k % 4], 20, 420);
      E.end(null, { score: Math.round(E.t * 1000), delay: 1.3, title: '클리어!', stats: [['시간', fmtClock(E.t)], ['이동', s.moves + '번'], ['게임', '#' + s.num]] });
    }
  },
  // 윈도우처럼 '안전한' 카드는 알아서 올린다: A·2, 또는 색이 다른 두 무늬가 이미 (숫자-1)까지 올라가 있을 때
  safeAuto() {
    const F = this.kind('found'), top = (su) => F.find((f) => f.cards[0]?.s === su)?.cards.length || 0;
    for (const p of [...this.kind('cell'), ...this.kind('tab')]) {
      const cd = p.cards[p.cards.length - 1];
      if (!cd) continue;
      const f = F.find((q) => this.canDrop([cd], q));
      if (!f) continue;
      const opp = isRed(cd.s) ? [SPADE, CLUB] : [HEART, DIAMOND];
      if (cd.r <= 2 || opp.every((su) => top(su) >= cd.r - 1)) return { p, f };
    }
    return null;
  },
  undo() {
    const prev = T.undo();
    if (!prev) { E.sfx.wrong(); return; }
    s.moves = prev.moves + 1; s.autoT = 999; // 되돌린 직후에는 자동으로 올리지 않는다
    E.sfx.move();
  },
  hint() {
    let best = null;
    const consider = (sc, cards) => { if (!best || sc > best.sc) best = { sc, cards }; };
    for (const p of [...this.kind('cell'), ...this.kind('tab')]) {
      const n = p.cards.length;
      if (!n) continue;
      const top = p.cards[n - 1];
      for (const f of this.kind('found')) if (this.canDrop([top], f)) consider(6, [top, ...f.cards.slice(-1)]);
      // 옮길 수 있는 가장 긴 묶음을 다른 줄에 이어 붙이기
      let i0 = n - 1;
      if (p.kind === 'tab') while (i0 > 0 && this.run(p, i0 - 1)) i0--;
      for (let i = i0; i < n; i++) for (const q of this.kind('tab')) {
        if (q === p || !this.canDrop(p.cards.slice(i), q)) continue;
        const under = p.cards[i - 1], lateral = under && isRed(under.s) !== isRed(p.cards[i].s) && under.r === p.cards[i].r + 1;
        if (lateral) continue;
        if (q.cards.length) consider(p.kind === 'cell' ? 5 : 4, [...p.cards.slice(i), ...q.cards.slice(-1)]);
        else if (p.kind === 'cell' || i > 0) consider(2, p.cards.slice(i)); // 빈 줄로 옮기기 (줄 전체를 옮기는 건 헛수)
      }
    }
    if (best) { T.flash(best.cards); E.sfx.ui(); return; }
    E.banner('이어 붙일 곳이 없어요. 빈칸에 카드를 옮겨 길을 만들어 보세요', 'info', 2000);
  },

  /* ---------- 입력 ---------- */
  down(x, y) {
    if (s.won) return;
    const b = btnAt(s.btns, x, y);
    if (b) { b.on = true; setTimeout(() => (b.on = false), 120); return b.id === 'undo' ? this.undo() : this.hint(); }
    const h = T.hit(x, y);
    if (!h || !this.canPick(h.pile, h.idx)) { if (h && h.idx >= 0) T.nope(h.pile.cards.slice(h.idx)); return; }
    T.startDrag(h.pile, h.idx, x, y);
  },
  move(x, y) { T.moveDrag(x, y); },
  up() {
    const d = T.endDrag();
    if (!d) return;
    if (!d.moved) {
      const q = this.target(d.pile, d.idx);
      if (q) this.doMove(d.pile, d.idx, q);
      else { T.nope(d.cards); E.sfx.wrong(); if (d.cards.length > this.maxMove(null)) E.banner(`지금은 ${this.maxMove(null)}장까지만 한 번에 옮길 수 있어요`, 'info', 1500); }
      return;
    }
    const first = d.cards[0], to = T.dropAt(first.x + T.cw / 2, first.y + T.ch / 2, d.pile);
    if (to && this.canDrop(d.cards, to)) this.doMove(d.pile, d.idx, to);
    else {
      T.layout(); E.sfx.move();
      if (to?.kind === 'tab' && d.cards.length > this.maxMove(to)) E.banner(`빈칸이 부족해서 ${this.maxMove(to)}장까지만 옮길 수 있어요`, 'info', 1500);
    }
  },
  key(k) { if (k === 'z' || k === 'Backspace') this.undo(); else if (k === 'h') this.hint(); },

  update(dt) {
    T.update(dt);
    E.hud({ center: fmtClock(E.t), right: `#${s.num} · 이동 ${s.moves}` });
    if (!s.won && !T.drag && (s.autoT -= dt) <= 0) {
      const a = this.safeAuto();
      if (a) { T.move(a.p, a.p.cards.length - 1, a.f); E.sfx.tap(); s.autoT = 0.12; this.check(); }
      else s.autoT = 0.3;
    }
  },
  draw(c) {
    const g = c.createRadialGradient(E.W / 2, E.H * 0.35, 0, E.W / 2, E.H * 0.35, E.H * 0.8);
    g.addColorStop(0, '#15603F'); g.addColorStop(1, '#0A2E20');
    c.fillStyle = g; c.fillRect(0, 0, E.W, E.H);
    T.draw(c, (p) => (p.kind === 'found' ? { label: 'A' } : null));
    drawButtons(c, s.btns);
  },
};
