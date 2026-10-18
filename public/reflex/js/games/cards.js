// 카드 게임 공용 — 카드 그리기 · 더미(파일) 배치 · 끌어서 옮기기 · 되돌리기 · 움직임 연출
// 스파이더 · 카드놀이(클론다이크) · 프리셀 · 하트 · 스페이드가 함께 쓴다.
import { E } from '../engine.js';

export const SPADE = 0, HEART = 1, DIAMOND = 2, CLUB = 3;
export const SUIT_NAME = ['스페이드', '하트', '다이아몬드', '클로버'];
export const isRed = (s) => s === HEART || s === DIAMOND;
export const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let uid = 0;
export const card = (s, r, up = false) => ({ id: ++uid, s, r, up, x: 0, y: 0, tx: 0, ty: 0, delay: 0, placed: false });
export function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------------- 그리기 ---------------- */
// 무늬는 글꼴 대신 직접 그린다 (폰에 따라 ♥가 이모지로 바뀌는 문제 방지)
export function suitPath(c, s, cx, cy, z) {
  c.beginPath();
  if (s === HEART) {
    c.moveTo(cx, cy + z * 0.42);
    c.bezierCurveTo(cx - z * 0.64, cy + z * 0.02, cx - z * 0.44, cy - z * 0.54, cx, cy - z * 0.18);
    c.bezierCurveTo(cx + z * 0.44, cy - z * 0.54, cx + z * 0.64, cy + z * 0.02, cx, cy + z * 0.42);
  } else if (s === DIAMOND) {
    c.moveTo(cx, cy - z * 0.5); c.lineTo(cx + z * 0.36, cy); c.lineTo(cx, cy + z * 0.5); c.lineTo(cx - z * 0.36, cy); c.closePath();
  } else if (s === SPADE) {
    c.moveTo(cx, cy - z * 0.48);
    c.bezierCurveTo(cx - z * 0.62, cy - z * 0.02, cx - z * 0.4, cy + z * 0.42, cx, cy + z * 0.14);
    c.bezierCurveTo(cx + z * 0.4, cy + z * 0.42, cx + z * 0.62, cy - z * 0.02, cx, cy - z * 0.48);
    c.moveTo(cx, cy + z * 0.02); c.lineTo(cx - z * 0.17, cy + z * 0.5); c.lineTo(cx + z * 0.17, cy + z * 0.5); c.closePath();
  } else {
    const r = z * 0.21;
    c.moveTo(cx + r, cy - z * 0.22); c.arc(cx, cy - z * 0.22, r, 0, 6.283);
    c.moveTo(cx - z * 0.23 + r, cy + z * 0.07); c.arc(cx - z * 0.23, cy + z * 0.07, r, 0, 6.283);
    c.moveTo(cx + z * 0.23 + r, cy + z * 0.07); c.arc(cx + z * 0.23, cy + z * 0.07, r, 0, 6.283);
    c.moveTo(cx, cy - z * 0.05); c.lineTo(cx - z * 0.16, cy + z * 0.5); c.lineTo(cx + z * 0.16, cy + z * 0.5); c.closePath();
  }
  c.fill();
}
export function drawSuit(c, s, cx, cy, z, color) { c.fillStyle = color || (isRed(s) ? '#E0334F' : '#1B1E33'); suitPath(c, s, cx, cy, z); }

const BACK = { a: '#3B4BD8', b: '#1E2A8A', line: 'rgba(255,255,255,.22)' };
// A3 G3-5 트럼프 한 벌: the card table -- green felt in a wooden frame (도둑잡기's room table has the same, styles.css)
export function drawTable(c) {
  const g = c.createRadialGradient(E.W / 2, E.H * 0.35, 0, E.W / 2, E.H * 0.35, E.H * 0.8);
  g.addColorStop(0, '#15603F'); g.addColorStop(1, '#0A2E20');
  c.fillStyle = g; c.fillRect(0, 0, E.W, E.H);
  const f = E.W < 500 ? 4 : 10; // (a phone's cards run close to the edge: a thin frame there)
  c.strokeStyle = '#6b3f1d'; c.lineWidth = f; c.strokeRect(f / 2, f / 2, E.W - f, E.H - f);
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.5; c.strokeRect(f + 1, f + 1, E.W - 2 * f - 2, E.H - 2 * f - 2);
}
export function drawBack(c, x, y, w, h) {
  const r = Math.max(3, w * 0.12);
  c.fillStyle = 'rgba(0,0,0,.3)'; E.rr(x, y + 1.5, w, h, r); c.fill();
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, BACK.a); g.addColorStop(1, BACK.b);
  c.fillStyle = '#F4F5FC'; E.rr(x, y, w, h, r); c.fill();
  c.fillStyle = g; E.rr(x + 2, y + 2, w - 4, h - 4, Math.max(2, r - 1.5)); c.fill();
  c.strokeStyle = BACK.line; c.lineWidth = 1;
  E.rr(x + 4.5, y + 4.5, w - 9, h - 9, Math.max(2, r - 3)); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.16)'; suitPath(c, SPADE, x + w / 2, y + h / 2, Math.min(w, h) * 0.34);
}
/**
 * 앞면 카드
 * @param {{hl?:boolean, dim?:number}} o hl: 강조(힌트·선택), dim: 어둡게(0~1)
 */
export function drawCard(c, x, y, w, h, cd, o = {}) {
  if (!cd.up) return drawBack(c, x, y, w, h);
  const r = Math.max(3, w * 0.12), col = isRed(cd.s) ? '#E0334F' : '#1B1E33';
  c.fillStyle = 'rgba(0,0,0,.3)'; E.rr(x, y + 1.5, w, h, r); c.fill();
  c.fillStyle = o.hl ? '#FFF4C2' : '#FBFBFE'; E.rr(x, y, w, h, r); c.fill();
  c.strokeStyle = o.hl ? '#FFB020' : 'rgba(20,24,60,.2)'; c.lineWidth = o.hl ? 2.5 : 1; c.stroke();
  const fs = Math.max(10, Math.min(w * 0.36, 19));
  const label = RANK[cd.r];
  E.text(label, x + 3, y + fs * 0.62, label.length > 1 ? fs * 0.9 : fs, col, 800, 'left');
  drawSuit(c, cd.s, x + w - fs * 0.5, y + fs * 0.6, fs * 0.8, col);
  // 카드 가운데: 숫자 카드는 큰 무늬, 그림 카드는 큰 글자
  if (h > w * 1.2) {
    const cy = y + h * 0.6, z = Math.min(w * 0.55, h * 0.4);
    if (cd.r > 10) { E.text(label, x + w / 2, cy, z * 0.9, col, 900); drawSuit(c, cd.s, x + w / 2, cy + z * 0.62, z * 0.36, col); }
    else drawSuit(c, cd.s, x + w / 2, cy, z, col);
  }
  if (o.dim) { c.fillStyle = `rgba(10,12,30,${o.dim})`; E.rr(x, y, w, h, r); c.fill(); }
}
export function drawSlot(c, x, y, w, h, label, s) {
  const r = Math.max(3, w * 0.12);
  c.fillStyle = 'rgba(255,255,255,.05)'; E.rr(x, y, w, h, r); c.fill();
  c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.2; c.stroke(); c.setLineDash([]);
  if (s != null) drawSuit(c, s, x + w / 2, y + h / 2, w * 0.42, 'rgba(255,255,255,.16)');
  else if (label) E.text(label, x + w / 2, y + h / 2, Math.min(14, w * 0.3), 'rgba(255,255,255,.32)', 800);
}

/* ---------------- 판: 더미 배치 · 끌기 · 되돌리기 ---------------- */
export class Table {
  constructor() { this.piles = []; this.cw = 40; this.ch = 56; this.drag = null; this.hist = []; this.hint = null; this.shake = null; }
  /** fan: 'down'(아래로 펼침) · 'stack'(겹쳐 쌓음) · 'waste3'(오른쪽으로 3장) */
  add(id, kind, o = {}) { const p = { id, kind, x: 0, y: 0, fan: 'stack', maxH: 0, cards: [], ...o }; this.piles.push(p); return p; }
  get(id) { return this.piles.find((p) => p.id === id); }
  all() { return this.piles.flatMap((p) => p.cards); }

  /** 각 카드가 있어야 할 자리 계산 (펼친 더미는 화면에 들어가게 간격을 줄인다) */
  layout() {
    const { cw, ch } = this;
    for (const p of this.piles) {
      const n = p.cards.length;
      if (p.fan === 'down') {
        let gd = Math.max(4, ch * 0.13), gu = Math.max(12, ch * 0.3);
        const downs = p.cards.filter((cd) => !cd.up).length, ups = n - downs;
        const need = downs * gd + Math.max(0, ups - 1) * gu + ch;
        if (p.maxH && need > p.maxH && n > 1) {
          const room = p.maxH - ch - downs * gd;
          gu = Math.max(8, room / Math.max(1, ups - 1));
          if (gu === 8) gd = Math.max(2, (p.maxH - ch - (ups - 1) * gu) / Math.max(1, downs));
        }
        let y = p.y;
        p.cards.forEach((cd, i) => { cd.tx = p.x; cd.ty = y; if (i < n - 1) y += cd.up ? gu : gd; });
        p.gu = gu;
      } else if (p.fan === 'waste3') {
        // 이번에 넘긴 카드들만 펼친다 (3장 넘기기에서 한 장을 쓰면 남은 두 장만 보이게)
        const from = Math.max(n - 3, Math.min(p.fanFrom ?? 0, n - 1));
        p.cards.forEach((cd, i) => { const k = Math.max(0, i - from); cd.tx = p.x + k * cw * 0.32; cd.ty = p.y; });
      } else p.cards.forEach((cd) => { cd.tx = p.x; cd.ty = p.y; });
      for (const cd of p.cards) if (!cd.placed) { cd.x = cd.tx; cd.y = cd.ty; cd.placed = true; }
    }
  }
  update(dt) {
    const k = 1 - Math.pow(0.0005, dt); // 부드럽게 따라가기
    for (const p of this.piles) for (const cd of p.cards) {
      if (this.drag?.cards.includes(cd)) continue;
      if (cd.delay > 0) { cd.delay -= dt; continue; }
      cd.x += (cd.tx - cd.x) * k; cd.y += (cd.ty - cd.y) * k;
      if (Math.abs(cd.tx - cd.x) < 0.3 && Math.abs(cd.ty - cd.y) < 0.3) { cd.x = cd.tx; cd.y = cd.ty; }
    }
    if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
    if (this.shake) { this.shake.t -= dt; if (this.shake.t <= 0) this.shake = null; }
  }
  moving(cd) { return cd.delay > 0 || Math.abs(cd.tx - cd.x) > 1 || Math.abs(cd.ty - cd.y) > 1; }
  draw(c, slot = () => null) {
    const { cw, ch } = this, later = [];
    for (const p of this.piles) {
      if (!p.hidden) { const sl = slot(p); if (sl !== false) drawSlot(c, p.x, p.y, cw, ch, sl?.label, sl?.suit); }
      // 쌓인 더미는 위의 두 장만 그린다 (나머지는 가려짐)
      const from = p.fan === 'stack' ? Math.max(0, p.cards.length - 2) : 0;
      p.cards.forEach((cd, i) => {
        if (i < from && !this.moving(cd)) return;
        if (this.drag?.cards.includes(cd) || this.moving(cd)) { later.push(cd); return; }
        this.card(c, cd);
      });
    }
    later.sort((a, b) => (this.drag?.cards.includes(a) ? 1 : 0) - (this.drag?.cards.includes(b) ? 1 : 0));
    for (const cd of later) if (cd.delay <= 0) this.card(c, cd);
  }
  card(c, cd) {
    const hl = this.hint?.cards.includes(cd);
    let x = cd.x;
    if (this.shake?.cards.includes(cd)) x += Math.sin(this.shake.t * 60) * 5 * (this.shake.t / 0.3);
    drawCard(c, x, cd.y, this.cw, this.ch, cd, { hl });
  }

  /** 누른 곳의 카드: 펼친 더미는 보이는 띠 기준, 쌓인 더미는 맨 위 카드 */
  hit(x, y) {
    const { cw, ch } = this;
    for (const p of this.piles) {
      const n = p.cards.length;
      if (p.fan === 'down') {
        if (x < p.x || x > p.x + cw) continue;
        for (let i = n - 1; i >= 0; i--) { const cd = p.cards[i]; if (y >= cd.ty && y <= cd.ty + ch) return { pile: p, idx: i }; }
        if (!n && y >= p.y && y <= p.y + ch) return { pile: p, idx: -1 };
      } else {
        const top = p.cards[n - 1];
        const x0 = top ? top.tx : p.x, y0 = top ? top.ty : p.y;
        if (x >= x0 && x <= x0 + cw && y >= y0 && y <= y0 + ch) return { pile: p, idx: n - 1 };
        if (!n && x >= p.x && x <= p.x + cw && y >= p.y && y <= p.y + ch) return { pile: p, idx: -1 };
      }
    }
    return null;
  }
  /** 끌어다 놓은 곳의 더미 (가장 가까운 더미, 펼친 더미는 세로로 넓게 받는다) */
  dropAt(x, y, except) {
    const { cw, ch } = this;
    let best = null, bd = Infinity;
    for (const p of this.piles) {
      if (p === except || p.noDrop) continue;
      const top = p.cards[p.cards.length - 1];
      const ty = top ? top.ty : p.y, cx = p.x + cw / 2;
      const inY = p.fan === 'down' ? y >= p.y - ch * 0.4 && y <= ty + ch * 1.6 : y >= p.y - ch * 0.5 && y <= p.y + ch * 1.5;
      if (!inY || Math.abs(x - cx) > cw * 0.9) continue;
      const d = Math.abs(x - cx) + Math.abs(y - (ty + ch / 2)) * 0.3;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  startDrag(pile, idx, x, y) {
    const cards = pile.cards.slice(idx), first = cards[0];
    this.drag = { pile, idx, cards, x0: x, y0: y, dx: x - first.x, dy: y - first.y, moved: false, offs: cards.map((cd) => cd.y - first.y) };
  }
  moveDrag(x, y) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 8) d.moved = true;
    if (!d.moved) return;
    d.cards.forEach((cd, i) => { cd.x = x - d.dx; cd.y = y - d.dy + d.offs[i]; });
  }
  /** 드래그 끝 → 드래그 정보 (드래그하는 사이 그 더미가 바뀌었으면 null: 카드는 제자리로)
   *  (예전에는 다른 손가락 · 키로 되돌리기 · 넘기기 · 나누기를 한 뒤 놓으면, 검사는 처음 잡은 카드로 하고
   *   옮기기는 그 자리의 지금 카드들로 해서 빈칸에 두 장이 들어가는 등 규칙이 깨졌다 — 5차 검토 B5-01) */
  endDrag() {
    const d = this.drag;
    this.drag = null;
    if (d && (d.pile.cards.length - d.idx !== d.cards.length || d.cards.some((cd, i) => d.pile.cards[d.idx + i] !== cd))) { this.layout(); return null; }
    return d;
  }
  /** 카드 옮기기 (from 더미의 idx부터 끝까지 → to 더미 맨 위) */
  move(from, idx, to) { const cards = from.cards.splice(idx); to.cards.push(...cards); this.layout(); return cards; }
  flash(cards, t = 1.4) { this.hint = { cards, t }; }
  nope(cards) { this.shake = { cards, t: 0.3 }; }

  /* 되돌리기: 카드 순서와 앞뒷면 + 게임 정보(점수 등)를 저장 */
  save(extra = {}) {
    this.hist.push({ piles: this.piles.map((p) => p.cards.map((cd) => [cd, cd.up])), extra: JSON.parse(JSON.stringify(extra)) });
    if (this.hist.length > 300) this.hist.shift();
  }
  undo() {
    const h = this.hist.pop();
    if (!h) return null;
    this.drag = null; // 잡고 있던 카드는 놓는다 (되돌린 판에서 다시 잡는다)
    this.piles.forEach((p, i) => { p.cards = h.piles[i].map(([cd, up]) => { cd.up = up; return cd; }); });
    this.layout();
    return h.extra;
  }
}

/* ---------------- 아래쪽 버튼 줄 ---------------- */
export function drawButtons(c, btns) {
  for (const b of btns) {
    if (b.hidden) continue;
    c.fillStyle = b.on ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)';
    E.rr(b.x, b.y, b.w, b.h, 14); c.fill();
    c.globalAlpha = b.disabled ? 0.35 : 1;
    E.text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 13.5, '#fff', 800);
    c.globalAlpha = 1;
  }
}
export const btnAt = (btns, x, y) => btns.find((b) => !b.hidden && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
export const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
