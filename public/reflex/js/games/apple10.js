// 사과 게임: 숫자(1~9)가 적힌 사과 판에서 네모로 끌어 묶은 숫자의 합이 정확히 10이면 사과가 없어진다 (사과 하나 1점)
// · 판은 세로 화면에 맞춰 가로 10 × 세로 16 · 제한 시간은 난이도(3분 · 2분 · 1분 30초)
// · 더 이상 10을 만들 수 있는 네모가 없으면 시간이 남아도 끝난다 (모든 네모의 합을 누적 합으로 바로 확인)
// · 처음 묶기 힌트: 판을 시작하고 hintAt초 동안 하나도 못 지우면 10이 되는 가장 작은 네모를 깜빡여 보여 준다 (한 번 지우면 끝)
//   — 규칙(합 10)을 모르고 아무렇게나 묶다가 나가는 사람이 많아서 (2026-10-26 운영 현황: 시작 3 · 끝 0)
import { E } from '../engine.js';

// 규칙 숫자 (안내 글 · 시험이 같이 쓴다)
export const APPLE = { cols: 10, rows: 16, sum: 10, time: { easy: 180, normal: 120, hard: 90 }, hintAt: 7, practiceMax: 20 };
// 첫 판 연습 (GPT 게임별 검토 M03 · 2026-10-28): 이 기기에서 이 제한 시간을 처음 하는 사람(최고 기록 없음)은 힌트 네모를 한 번 묶어 보는 연습부터
// · 연습 동안은 제한 시간 · 점수가 흐르지 않고, 연습으로 묶은 사과는 지우지 않는다(판 그대로 — 오늘의 한판 · 도전장 판도 바뀌지 않음)
// · practiceMax초 안에 못 묶으면 연습을 끝내고 그냥 시작 (자리를 비운 사람 · 자동 시험이 끝나지 않는 판이 되지 않게)
const RED = '#FF4D5E';

let s;
export default {
  id: 'apple10', name: '사과 게임', cat: 'puzzle',
  color: '#FF5A5F', c2: '#E8364F', c3: '#6B0F1A',
  tagline: '합이 10이 되게 사과를 묶어 지우세요',
  howto: [['drag', '사과 위를 네모로 끌어 묶어요'], ['bolt', '묶은 숫자를 더해 정확히 10이면 사과가 없어져요'], ['clock', '제한 시간 안에 최대한 많이 지우세요. 사과 하나가 1점이에요']],
  hudLabel: '점수', hudBar: true, customRight: true,
  levels: true, levelLegacy: 'normal', levelTitle: '제한 시간',
  levelNames: { easy: '3분', normal: '2분', hard: '1분 30초' },
  levelNote: '제한 시간마다 최고 기록과 랭킹이 따로예요',

  init() {
    const { cols, rows } = APPLE;
    // 판 숫자는 시드 난수(E.rand): 같은 시드 = 같은 판 (같은 판 도전장 · 2026-10-27)
    s = { cols, rows, v: Array.from({ length: cols * rows }, () => 1 + Math.floor((E.rand || Math.random)() * 9)), time: APPLE.time[E.level] || APPLE.time.normal, sel: null, groups: 0, flash: [], over: false, hint: null, wait: 0 };
    s.left = s.time;
    this.layout();
    if (!this.hasMove()) return this.init(); // 처음부터 만들 수 없는 판은 다시 (거의 없음)
    if (E.best == null && !E.online && !E.p2) { s.practice = 0.001; s.hint = this.findMove(); }
  },
  /** 연습 끝 → 진짜 시작 (ok: 직접 묶어 봄) */
  endPractice(ok) {
    s.practice = 0; s.hint = null; s.wait = 0;
    E.banner(ok ? '좋아요! 이렇게 묶으면 지워져요 · 이제 진짜 시작!' : '이제 시간이 흐르기 시작해요', ok ? 'sparkle' : 'clock', 2200);
    if (ok) { E.sfx.goal?.(); E.haptic('success'); }
  },
  layout() {
    const { cols, rows } = s;
    s.cell = Math.floor(Math.min((E.W - 20) / cols, (E.bottom - E.top - 36) / rows, 46));
    s.ox = Math.round((E.W - s.cell * cols) / 2); s.oy = Math.round(E.top + (E.bottom - E.top - s.cell * rows) / 2);
  },
  cellOf(x, y) {
    const c = Math.max(0, Math.min(s.cols - 1, Math.floor((x - s.ox) / s.cell))), r = Math.max(0, Math.min(s.rows - 1, Math.floor((y - s.oy) / s.cell)));
    return [r, c];
  },
  rect() {
    const { r0, c0, r1, c1 } = s.sel;
    return [Math.min(r0, r1), Math.min(c0, c1), Math.max(r0, r1), Math.max(c0, c1)];
  },
  /** 네모 안 사과의 합 · 개수 */
  sumOf([ra, ca, rb, cb]) {
    let sum = 0, n = 0;
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) { const v = s.v[r * s.cols + c]; if (v) { sum += v; n++; } }
    return [sum, n];
  },
  /** 10을 만들 수 있는 네모가 하나라도 남았는지 (누적 합으로 모든 네모를 확인) */
  hasMove() {
    const { cols, rows, v } = s, W = cols + 1, P = new Int32Array((rows + 1) * W);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) P[(r + 1) * W + c + 1] = v[r * cols + c] + P[r * W + c + 1] + P[(r + 1) * W + c] - P[r * W + c];
    for (let ra = 0; ra < rows; ra++) for (let rb = ra; rb < rows; rb++) for (let ca = 0; ca < cols; ca++) for (let cb = ca; cb < cols; cb++) {
      const sum = P[(rb + 1) * W + cb + 1] - P[ra * W + cb + 1] - P[(rb + 1) * W + ca] + P[ra * W + ca];
      if (sum === APPLE.sum) return true;
      if (sum > APPLE.sum) break; // 오른쪽으로 넓힐수록 합은 줄지 않는다
    }
    return false;
  },

  /** 10이 되는 네모 중 사과가 가장 적은 것 [ra, ca, rb, cb] (없으면 null) — 처음 묶기 힌트 */
  findMove() {
    const { cols, rows } = s;
    let best = null, bn = 1e9;
    for (let ra = 0; ra < rows; ra++) for (let ca = 0; ca < cols; ca++) for (let rb = ra; rb < rows; rb++) for (let cb = ca; cb < cols; cb++) {
      const [sum, n] = this.sumOf([ra, ca, rb, cb]);
      if (sum > APPLE.sum) break;
      if (sum === APPLE.sum && n < bn) { best = [ra, ca, rb, cb]; bn = n; }
    }
    return best;
  },

  // 네모는 처음 누른 손가락 하나로만 (GPT 게임별 검토 A01: 두 번째 손가락이 선택을 덮어써 맞는 네모가 안 지워졌다)
  down(x, y, id) {
    if (s.sel) return;
    const [r, c] = this.cellOf(x, y);
    s.sel = { r0: r, c0: c, r1: r, c1: c, id };
  },
  move(x, y, dx, dy, id) {
    if (!s.sel || id !== s.sel.id) return;
    const [r, c] = this.cellOf(x, y);
    s.sel.r1 = r; s.sel.c1 = c;
  },
  /** 취소(전화 · 알림 · 정지): 네모만 버리고 지우지 않는다 (검토 G02 · G09) */
  cancel(id) { if (s.sel && (id == null || id === s.sel.id)) s.sel = null; },
  up(x, y, id) {
    if (!s.sel || id !== s.sel.id) return;
    if (x != null) { const [r, c] = this.cellOf(x, y); s.sel.r1 = r; s.sel.c1 = c; } // 손을 뗀 칸까지 (검토 A02: 마지막 이동 신호가 없으면 끝 칸이 빠졌다)
    const rc = this.rect(), [sum, n] = this.sumOf(rc);
    s.sel = null;
    if (sum !== APPLE.sum) {
      if (n > 1 && sum > 0) E.sfx.tick?.();
      // 첫 묶기 전까지: 왜 안 지워지는지 알려 준다 (한 개만 눌렀는지 · 합이 몇인지 — 2026-11-12 운영 숫자: 첫 판 10초 안에 그만두는 사람이 많음)
      const now = performance.now();
      if ((s.practice || !s.groups) && n > 0 && now - (s.tipAt || 0) > 2500) { s.tipAt = now; E.banner(n === 1 ? '한 개만 누르면 안 돼요 · 끌어서 네모로 여러 개를 묶어요' : `합이 ${sum}이에요 · 정확히 10이 되게 묶어요`, 'info', 1800); }
      return;
    }
    const [ra, ca, rb, cb] = rc;
    if (s.practice) { // 연습: 반짝이기만 하고 지우지 않는다 (판 그대로) · 점수 없음
      for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) if (s.v[r * s.cols + c]) s.flash.push({ x: s.ox + (c + 0.5) * s.cell, y: s.oy + (r + 0.5) * s.cell, t: 0.3 });
      E.acted?.(); return this.endPractice(true);
    }
    for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) {
      const i = r * s.cols + c;
      if (!s.v[i]) continue;
      s.v[i] = 0;
      const cx = s.ox + (c + 0.5) * s.cell, cy = s.oy + (r + 0.5) * s.cell;
      s.flash.push({ x: cx, y: cy, t: 0.3 });
      E.burst(cx, cy, RED, 5, 160, 3);
    }
    s.groups++;
    s.hint = null; // 한 번 지웠으면 힌트는 그만
    E.add(n, s.ox + ((ca + cb + 1) / 2) * s.cell, s.oy + ra * s.cell - 8, '#FFD35C');
    E.sfx.note(60 + Math.min(n, 12) * 2, 0.12, 0.16); E.haptic('light');
    if (!this.hasMove()) this.finish('더 이상 10을 만들 수 없어요');
  },
  finish(title) {
    if (s.over) return;
    s.over = true;
    const left = s.v.filter(Boolean).length;
    E.end(null, { delay: 1, title, stats: [['지운 사과', (s.cols * s.rows - left) + '개'], ['묶은 횟수', s.groups + '번'], ['남은 시간', Math.max(0, Math.ceil(s.left)) + '초']] });
  },

  update(dt) {
    if (s.over) return;
    if (s.practice) {
      if (s.practice < 0.8 && s.practice + dt >= 0.8) E.banner('연습 먼저! 빛나는 네모처럼 끌어서 합이 10인 사과를 묶어 보세요 · 그동안 시간은 안 흘러요', 'bolt', 4200); // 처음 하는 사람용 게임 소개 · 조작 안내(play.js) 다음에
      s.practice += dt;
      for (const f of s.flash) f.t -= dt;
      s.flash = s.flash.filter((f) => f.t > 0);
      E.hud({ bar: 1, barColor: '#3DDC97', right: '연습' });
      if (s.practice > APPLE.practiceMax) this.endPractice(false);
      return;
    }
    s.left -= dt;
    if (!s.groups && !s.hint && (s.wait += dt) >= APPLE.hintAt) {
      s.hint = this.findMove();
      if (s.hint) E.banner('합이 10이 되는 사과를 네모로 묶어 보세요', 'bolt', 3000);
    }
    for (const f of s.flash) f.t -= dt;
    s.flash = s.flash.filter((f) => f.t > 0);
    E.hud({ bar: s.left / s.time, barColor: s.left < 15 ? '#FF5A79' : '#FF8A5C', right: Math.max(0, Math.ceil(s.left)) + '초' });
    if (s.left <= 0) { E.sfx.lose(); this.finish('시간 종료'); }
  },

  draw(c) {
    const { cols, rows, cell, ox, oy } = s;
    c.fillStyle = 'rgba(255,255,255,.04)'; E.rr(ox - 6, oy - 6, cols * cell + 12, rows * cell + 12, 14); c.fill();
    const sel = s.sel ? this.rect() : null, [sum] = sel ? this.sumOf(sel) : [0];
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      const v = s.v[r * cols + col];
      if (!v) continue;
      const x = ox + (col + 0.5) * cell, y = oy + (r + 0.5) * cell, R = cell * 0.42;
      const inSel = sel && r >= sel[0] && r <= sel[2] && col >= sel[1] && col <= sel[3];
      c.fillStyle = inSel ? (sum === APPLE.sum ? '#3DDC97' : sum > APPLE.sum ? '#FF8A9A' : '#FF7A86') : RED;
      c.beginPath(); c.arc(x, y + R * 0.06, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(x - R * 0.35, y - R * 0.3, R * 0.28, 0, Math.PI * 2); c.fill(); // 반짝임
      c.fillStyle = '#5BC46A'; c.beginPath(); c.ellipse(x + R * 0.25, y - R * 0.95, R * 0.28, R * 0.13, -0.5, 0, Math.PI * 2); c.fill(); // 잎
      E.text(String(v), x, y + R * 0.1, Math.round(cell * 0.46), '#fff', 900);
    }
    for (const f of s.flash) { c.globalAlpha = f.t / 0.3; c.strokeStyle = '#FFD35C'; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, cell * (0.6 - f.t), 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
    if (s.hint && !sel) { // 처음 묶기 힌트: 깜빡이는 초록 테두리
      const [ra, ca, rb, cb] = s.hint, x = ox + ca * cell, y = oy + ra * cell, w = (cb - ca + 1) * cell, h = (rb - ra + 1) * cell;
      c.globalAlpha = 0.45 + 0.45 * Math.sin(E.t * 6); c.strokeStyle = '#3DDC97'; c.lineWidth = 3; c.setLineDash([7, 5]); E.rr(x, y, w, h, 8); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    if (sel) {
      const [ra, ca, rb, cb] = sel, x = ox + ca * cell, y = oy + ra * cell, w = (cb - ca + 1) * cell, h = (rb - ra + 1) * cell;
      const ok = sum === APPLE.sum;
      c.fillStyle = ok ? 'rgba(61,220,151,.16)' : 'rgba(255,255,255,.08)'; E.rr(x, y, w, h, 8); c.fill();
      c.strokeStyle = ok ? '#3DDC97' : sum > APPLE.sum ? '#FF5A79' : 'rgba(255,255,255,.7)'; c.lineWidth = 2.5; E.rr(x, y, w, h, 8); c.stroke();
      const ty = y > oy + 30 ? y - 14 : y + h + 14;
      E.text(String(sum), x + w / 2, ty, 18, ok ? '#3DDC97' : sum > APPLE.sum ? '#FF5A79' : '#fff', 900);
    }
  },
};
