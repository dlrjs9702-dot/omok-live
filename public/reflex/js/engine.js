// 게임 엔진: 캔버스 · 루프 · 입력 · 파티클 · HUD · 점수/최고 기록
import { sfx } from './audio.js';
import { haptic } from './native.js';
import { $, rand, fmtNum, fmtScore } from './util.js';
import { icon } from './icons.js';
import { lvName } from './levels.js';

const cv = $('#stage');
const c = cv.getContext('2d');
const hudEl = $('#hud'), hudScore = $('#hudScore'), hudLabel = $('#hudLabel'), hudRight = $('#hudRight');
const hudBar = $('#hudBar'), hudBarFill = hudBar.firstElementChild, hudLives = $('#hudLives'), bannerEl = $('#banner');

export const FONT = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'system-ui,sans-serif';

export const E = {
  c, W: 0, H: 0, dpr: 1,
  top: 0, bottom: 0, safeTop: 0, safeBottom: 0,
  game: null, state: 'idle', score: 0, t: 0,
  best: null, beatBest: false, // 이번 판 시작 전 내 최고 기록 / 경신 여부
  level: 'normal', // 1:1 대결 게임의 AI 난이도
  fx: { shape: 'circle' }, // 꾸미기: 파티클 모양 (보이는 것만 바뀜)
  p2: false, // 둘이 하기 (한 폰으로 2인 대결)
  online: null, // 온라인 대결 중이면 한 판의 상태 (net.js createMatch)
  revived: false, // 이번 판에 이어하기를 이미 썼는지 (판마다 한 번 · 모두 같은 조건)
  touches: null, // 화면에 닿아 있는 모든 손가락 {id → {x, y}} (2인 조작용)
  pointer: { x: 0, y: 0, down: false, id: null },
  keys: {},
  sfx, haptic,
  onEnd: null,
};

/* ---------------- 레이아웃 ---------------- */
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--sat);padding-bottom:var(--sab)';
document.body.appendChild(probe);

function measure() {
  const cs = getComputedStyle(probe);
  E.safeTop = parseFloat(cs.paddingTop) || 0;
  E.safeBottom = parseFloat(cs.paddingBottom) || 0;
  E.dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 게임 화면 크기 = 캔버스 크기 (PC 가로 화면에서는 가운데 세로 틀 안에서 한다 — game.css)
  E.W = cv.clientWidth || innerWidth; E.H = cv.clientHeight || innerHeight;
  cv.width = Math.round(E.W * E.dpr); cv.height = Math.round(E.H * E.dpr);
  c.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
  E.top = E.game ? Math.round(hudEl.getBoundingClientRect().bottom + 10) : E.safeTop + 80;
  E.netBarY = E.top + 2; // 차례 온라인 대결: HUD 아래에 두 사람의 차례 · 남은 시간 막대
  if (E.online?.kind === 'turn') E.top += 44;
  E.bottom = E.H - E.safeBottom - 12;
  bgGrad = null;
}
addEventListener('resize', () => {
  measure();
  if (E.game?.layout && E.state !== 'idle') E.game.layout();
});

/* ---------------- 파티클 / 팝업 / 흔들림 ---------------- */
let parts = [], pops = [], shakeT = 0, shakeMag = 0, flashA = 0, flashC = '#fff';
const glowCache = new Map();
function glowSprite(color) {
  let s = glowCache.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color); gr.addColorStop(0.35, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowCache.set(color, s);
  return s;
}

Object.assign(E, {
  /** 부드러운 발광 원 (shadowBlur 대신 사전 렌더 스프라이트) */
  glow(x, y, r, color, alpha = 1) {
    c.globalAlpha = alpha;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  },
  burst(x, y, color, n = 14, speed = 260, size = 3.5) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.8), max: 0.8, size: rand(size * 0.6, size * 1.3), color, hue: rand(0, 360), rot: rand(0, 6) });
    }
  },
  popup(text, x, y, color = '#fff', size = 22) {
    pops.push({ text, x, y, color, size, life: 0.9 });
  },
  shake(mag = 8) { shakeMag = Math.max(shakeMag, mag); shakeT = 0.3; },
  flash(color = '#fff', a = 0.35) { flashC = color; flashA = a; },

  /** 점수 추가 (+팝업) */
  add(n, x, y, color) {
    E.setScore(E.score + n);
    if (x != null) E.popup('+' + n, x, y, color || '#fff');
  },
  setScore(v) {
    const up = v > E.score;
    E.score = v;
    if (!E._hideScore) {
      hudScore.textContent = fmtNum(v);
      if (up) { hudScore.classList.remove('bump'); void hudScore.offsetWidth; hudScore.classList.add('bump'); }
    }
    checkBest();
  },

  /** HUD 설정: {label, center, right, bar, barColor, lives:[n,max]} */
  hud(o) {
    if ('label' in o) hudLabel.textContent = o.label;
    if ('center' in o && hudScore.textContent !== o.center) hudScore.textContent = o.center;
    if ('right' in o) setRight(o.right, false);
    if ('bar' in o) {
      hudBar.hidden = o.bar == null;
      if (o.bar != null) {
        const tf = `scaleX(${Math.max(0, Math.min(1, o.bar)).toFixed(3)})`;
        if (hudBarFill.style.transform !== tf) hudBarFill.style.transform = tf;
      }
    }
    if ('barColor' in o && hudBarFill.style.getPropertyValue('--bar') !== o.barColor) hudBarFill.style.setProperty('--bar', o.barColor);
    if ('lives' in o) {
      const [n, max] = o.lives;
      hudLives.hidden = false;
      if (hudLives.childElementCount !== max) hudLives.innerHTML = Array.from({ length: max }, () => icon('heart')).join('');
      [...hudLives.children].forEach((el, i) => el.classList.toggle('off', i >= n));
    }
  },
  banner(text, ic = 'check', ms = 1800) {
    bannerEl.innerHTML = icon(ic) + text;
    bannerEl.classList.add('show');
    clearTimeout(E._bt);
    E._bt = setTimeout(() => bannerEl.classList.remove('show'), ms);
  },

  /**
   * 게임 종료
   * outcome: 1:1 대결 게임은 'win' | 'draw' | 'loss', 점수 게임은 null
   */
  end(outcome, { stats = [], title, delay = 0.7, score, net = false, final = false, proof, rec } = {}) {
    // 일시정지 중에 끝남 (바둑 계가 · 체스 AI처럼 늦게 오는 답): 보관했다가 이어서 할 때 끝낸다
    // (예전에는 버려서 판이 끝났는데 결과로 가지 못하고 멈춰 있었다 — 4차 검토 B1-01)
    if (E.state === 'paused') { E._pausedEnd ||= [outcome, { stats, title, delay, score, net, final, proof, rec }]; return; }
    if (E.state !== 'play') return;
    // 차례 온라인 대결: 승패는 서버가 정한다 → 게임이 알아챈 끝(통계 · 연출 시간)만 적어 두고 서버 결과를 기다린다
    if (E.online?.kind === 'turn' && !net) { E.online.localEnd = { stats, title, delay }; return; }
    // 이어하기: 이어 할 수 있는 게임(game.revive)은 판마다 한 번, 끝내기 전에 물어본다 (화면: E.onRevive) · 완주(final)는 묻지 않는다
    if (E.game.revive && !E.revived && !E.online && !E.p2 && E.onRevive && !final) {
      E.state = 'revive'; E._pending = [outcome, { stats, title, delay, score }];
      E.onRevive();
      return;
    }
    if (score !== undefined) E.score = score;
    if (!E.game.mode) outcome = null;
    E.state = 'ending';
    E._endT = delay;
    E._result = { outcome, score: E.game.noScore ? null : E.score, stats, title, duration: E.t, proof, rec }; // proof: 논리 퍼즐 오늘의 문제 풀이 { date, sol } (서버가 확인) · rec: 미리 보낼 기록함에 적어 둔 기록 { rid, at }
  },

  /** 이어하기: 게임이 안전한 상태로 되돌린 뒤 계속 (시간 · 점수는 그대로) */
  reviveNow() { if (E.state !== 'revive') return; E.revived = true; E.state = 'play'; E.game.revive(); },
  /** 이어하지 않고 끝내기 */
  giveUp() { if (E.state !== 'revive') return; E.revived = true; E.state = 'play'; const [o, opts] = E._pending; E.end(o, { ...opts, delay: 0.25 }); },

  /* 그리기 도우미 */
  rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); },
  text(str, x, y, size = 16, color = '#fff', weight = 800, align = 'center', base = 'middle') {
    c.font = `${weight} ${size}px ${FONT}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = base;
    c.fillText(str, x, y);
  },
});

// 매 프레임 호출돼도 내용이 같으면 DOM을 건드리지 않는다
function setRight(html, done) {
  if (hudRight._html === html && hudRight.classList.contains('done') === !!done) return;
  hudRight._html = html;
  hudRight.innerHTML = html;
  hudRight.classList.toggle('done', !!done);
  hudRight.hidden = !html;
}

function bestHtml() {
  if (E.beatBest) return icon('crown') + '신기록';
  return E.best == null ? icon('sparkle') + '첫 기록 도전' : icon('trophy') + fmtScore(E.best, E.game.unit);
}
// 높을수록 좋은 점수 게임: 진행 중 최고 기록을 넘으면 바로 알려 준다
function checkBest() {
  const g = E.game;
  if (!g || g.lowerBetter || E.best == null || E.beatBest || E.state !== 'play') return;
  if (E.score > E.best) {
    E.beatBest = true;
    if (!E._customRight) setRight(bestHtml(), true);
    E.banner('최고 기록 경신!', 'crown');
    sfx.goal(); haptic('success');
  }
}

/* ---------------- 시작 / 정지 ---------------- */
export function startGame(game, { best = null, level = 'normal', fx = null, p2 = false, online = null, power = null, opts = {} } = {}) {
  E.game = game;
  E.level = level;
  E.opts = opts || {}; // 판 설정 (오목 규칙 · 먼저 두기 등 — 게임 정의의 options)
  E.power = power; // AI 세기 연습 (바둑 쉬움 · 보통) — 없으면 게임 기본 세기
  E.online = game.online || game.party ? online : null; // party: 여럿이 판 (윷놀이 온라인)
  E.p2 = !E.online && p2 && game.mode === 'versus';
  E.fx = fx || { shape: 'circle' };
  E.score = 0; E.t = 0; E.best = best; E.beatBest = false; E.revived = false; E._pausedEnd = null;
  E._hideScore = !!game.hideScore; E._customRight = !!game.customRight;
  parts = []; pops = []; shakeT = 0; flashA = 0;
  E.pointer.down = false; E.pointer.id = null; activePointers.clear();
  for (const k in E.keys) E.keys[k] = false;
  hudLabel.textContent = E.online?.kind === 'party' ? `${game.hudLabel} · 온라인 ${E.online.players.length}명`
    : E.online && !E.online.ai ? `나 : ${E.online.opp.nick} · 온라인`
    : E.p2 ? (game.p2Label || '1P vs 2P') + ' · 둘이 하기'
    : (game.hudLabel ?? '점수') + (game.mode === 'versus' || game.levels ? ' · ' + (game.levelNames?.[level] || lvName(level)) : '');
  hudScore.textContent = game.hideScore ? '' : '0';
  hudBar.hidden = !game.hudBar;
  hudBarFill.style.transform = 'scaleX(1)';
  hudBarFill.style.setProperty('--bar', game.color);
  hudLives.hidden = true; hudLives.innerHTML = '';
  bannerEl.classList.remove('show');
  setRight(game.customRight ? '' : bestHtml(), false);
  measure();
  game.init();
  E.state = 'play';
}
export function stopGame() { E.state = 'idle'; E.game = null; E.online = null; E._pausedEnd = null; }
export function pauseGame() { if (E.state === 'play') E.state = 'paused'; }
export function resumeGame() {
  if (E.state !== 'paused') return;
  E.state = 'play';
  last = performance.now();
  E.game.resume?.();
  const pe = E._pausedEnd; // 일시정지 중에 끝난 판 → 바로 결과로
  if (pe) { E._pausedEnd = null; E.end(...pe); }
}

/* ---------------- 입력 ---------------- */
const activePointers = new Map();
E.touches = activePointers;
// 캔버스 기준 좌표 (PC에서는 게임 틀이 화면 가운데에 있어서 왼쪽 여백을 뺀다)
const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch { /* 캡처 실패해도 입력은 계속 처리 */ }
  const [x, y] = pos(e);
  activePointers.set(e.pointerId, { x, y });
  if (E.pointer.id == null) Object.assign(E.pointer, { x, y, down: true, id: e.pointerId });
  E.pointer.type = e.pointerType; // (A3 G3-1: a mouse places a stone at once, a touch shows it first)
  if (E.state === 'play') E.game.down?.(x, y, e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  const p = activePointers.get(e.pointerId);
  if (!p) return;
  const [x, y] = pos(e), dx = x - p.x, dy = y - p.y;
  p.x = x; p.y = y;
  if (e.pointerId === E.pointer.id) { E.pointer.x = x; E.pointer.y = y; }
  if (E.state === 'play') E.game.move?.(x, y, dx, dy, e.pointerId);
});
function up(e) {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.delete(e.pointerId);
  const [x, y] = pos(e);
  if (e.pointerId === E.pointer.id) { E.pointer.down = false; E.pointer.id = null; }
  if (E.state === 'play') E.game.up?.(x, y, e.pointerId);
}
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => {
  if (!E.game || E.state !== 'play') return;
  E.keys[e.key] = true;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (!e.repeat || E.game.keyRepeat) E.game.key?.(e.key);
});
addEventListener('keyup', (e) => { E.keys[e.key] = false; });

/* ---------------- 파티클 모양 (꾸미기) ---------------- */
function drawParticle(shape, x, y, r, rot) {
  c.beginPath();
  if (shape === 'square') { c.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4); return; }
  if (shape === 'star') {
    for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  } else if (shape === 'heart') {
    c.moveTo(x, y + r * 0.8);
    c.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
    c.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.8);
  } else if (shape === 'petal') c.ellipse(x, y, r, r * 0.5, rot, 0, 6.283);
  else c.arc(x, y, r, 0, 6.283);
  c.fill();
}

/* ---------------- 차례 온라인 대결: 차례 막대 · 서버 결과 ---------------- */
const NET_WHY = {
  win: { resign: '상대가 기권했어요', time: '상대의 시간이 다 됐어요', left: '상대가 나갔어요', agree: '무승부 합의' },
  loss: { resign: '기권했어요', time: '시간이 다 돼서 졌어요', left: '연결이 끊겨 졌어요' },
  draw: { agree: '무승부에 합의했어요', moves: '수 제한으로 무승부' },
};
function turnWatch() {
  const o = E.online;
  if (!o.result || o._ended) return;
  o._ended = true;
  const r = o.result, L = o.localEnd || {};
  const outcome = r.r === 'win' ? 'win' : r.r === 'loss' ? 'loss' : 'draw';
  const title = r.r === 'unknown' ? '연결이 끊겨 결과를 확인하지 못했어요' : r.r === 'void' ? (r.why === 'server' ? '서버 점검으로 무효가 됐어요' : '대결이 무효가 됐어요') : NET_WHY[outcome]?.[r.why] || L.title || { win: '승리!', loss: '패배', draw: '무승부' }[outcome];
  const quick = ['resign', 'time', 'left', 'agree', 'server', 'error'].includes(r.why);
  E.end(outcome, { net: true, title, stats: L.stats?.length ? L.stats : [['수', (r.st?.moves ?? 0) + '수']], delay: quick ? 0.4 : L.delay ?? 1.2 });
}
let beepAt = 0;
function drawNetBar() {
  const o = E.online, g = E.game, names = g.seatNames || ['선', '후'];
  const y = E.netBarY, h = 34, w = (E.W - 36) / 2, now = performance.now();
  const pill = (x, who, seat, active, extra) => {
    c.globalAlpha = active ? 1 : 0.55;
    c.fillStyle = active ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)';
    E.rr(x, y, w, h, 12); c.fill();
    if (active) { c.strokeStyle = g.color; c.lineWidth = 2; E.rr(x + 1, y + 1, w - 2, h - 2, 11); c.stroke(); }
    E.text(`${who} · ${names[seat]}`, x + 12, y + h / 2, 12.5, '#fff', 800, 'left');
    E.text(extra, x + w - 12, y + h / 2, 13, active && o.left < 10 && extra.includes(':') ? '#FF6B6B' : '#fff', 900, 'right');
    c.globalAlpha = 1;
  };
  const t = Math.ceil(o.left), clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const mine = o.turn === o.you && !o.result, nick = o.opp.nick.length > 7 ? o.opp.nick.slice(0, 7) + '…' : o.opp.nick;
  pill(12, '나', o.you, mine, mine ? (o.waiting ? '확인 중' : clock) : '대기');
  const gone = o.oppWait > now ? `끊김 ${Math.ceil((o.oppWait - now) / 1000)}` : '';
  pill(24 + w, o.ai ? 'AI' : nick, 1 - o.you, !mine && !o.result, gone || (!mine && !o.result ? (o.ai ? '생각 중' : clock) : '대기'));
  // 내 차례 마지막 5초: 매초 삐
  if (mine && !o.waiting && t <= 5 && t > 0 && now - beepAt > 900 && E.state === 'play') { beepAt = now; sfx.beep?.(); }
  if (o.lost) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, y + h + 6, E.W, 28); E.text('연결이 끊겼어요 · 다시 연결하는 중…', E.W / 2, y + h + 20, 12.5, '#FFE08A', 800); }
}

/* ---------------- 루프 ---------------- */
let last = performance.now(), bgGrad = null, bgFor = null;
function drawBg() {
  const g = E.game;
  c.fillStyle = g.bg || '#0B0C1A';
  c.fillRect(0, 0, E.W, E.H);
  if (g.noTint) return;
  if (!bgGrad || bgFor !== g) {
    bgGrad = c.createRadialGradient(E.W * 0.5, -E.H * 0.1, 0, E.W * 0.5, -E.H * 0.1, E.H * 0.9);
    bgGrad.addColorStop(0, g.color + '38'); bgGrad.addColorStop(1, g.color + '00');
    bgFor = g;
  }
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, E.W, E.H);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const g = E.game;
  if (!g || E.state === 'idle') return;

  if (E.state === 'play') { E.t += dt; g.update(dt); if (E.online?.kind === 'turn') turnWatch(); }
  // 화면 크기가 0에 가까울 때(창을 숨기는 중 등)는 그리지 않는다 — 판 크기가 음수가 되어 그리기 오류가 난다
  if (E.W >= 60 && E.H >= 60) drawFrame(g, dt);
  if (E.state === 'ending') {
    E._endT -= dt;
    if (E._endT <= 0) { E.state = 'over'; E.onEnd?.(E._result); }
  }
}
function drawFrame(g, dt) {
  const running = E.state === 'play' || E.state === 'ending' || E.state === 'revive';
  if (running) {
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.vy += 180 * dt; p.life -= dt; }
    parts = parts.filter((p) => p.life > 0);
    for (const p of pops) { p.y -= 46 * dt; p.life -= dt; }
    pops = pops.filter((p) => p.life > 0);
    if (shakeT > 0) shakeT -= dt;
    if (flashA > 0) flashA = Math.max(0, flashA - dt * 1.6);
  }

  c.save();
  if (shakeT > 0 && running) {
    const m = shakeMag * (shakeT / 0.3);
    c.translate(rand(-m, m), rand(-m, m));
  } else shakeMag = 0;
  drawBg();
  g.draw(c);
  // 파티클
  c.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    const a = Math.max(0, p.life / p.max);
    c.globalAlpha = a;
    c.fillStyle = E.fx.rainbow ? `hsl(${p.hue} 95% 65%)` : p.color;
    drawParticle(E.fx.shape, p.x, p.y, p.size * (0.5 + a * 0.5) * (E.fx.shape === 'circle' ? 1 : 1.5), p.rot + (1 - a) * 3);
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  for (const p of pops) {
    c.globalAlpha = Math.min(1, p.life / 0.4);
    E.text(p.text, p.x, p.y, p.size, p.color, 900);
  }
  c.globalAlpha = 1;
  c.restore();
  if (E.online?.kind === 'turn') drawNetBar();
  if (flashA > 0) { c.globalAlpha = flashA; c.fillStyle = flashC; c.fillRect(0, 0, E.W, E.H); c.globalAlpha = 1; }
}
measure();
requestAnimationFrame(frame);
