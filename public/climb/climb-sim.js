// v1.9.4 상시 등반 도전: the course and the physics, shared word for word by the server (lib/climb-runner, the only
// authority on where a climber is) and the browser (which runs the same steps ahead so play feels instant, then
// accepts the server's state). A climber is moved only by inputs, one fixed 1/30 s tick at a time; the course and
// every moving part are a pure function of the tick count, so both sides compute the same thing.
// Units are metres; y points up, the ground is y = 0 and the summit platform is y = 3000.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClimbSim = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const W = 24; // course width
  const TOP = 3000;
  const DT = 1 / 30;
  const TICKS_PER_SECOND = 30;
  const G = 25; const JUMP = 11; const SPEED = 5; const CLIMB = 3.2; const MAX_FALL = 18;
  const HALF_W = 0.35; const HEIGHT = 1.5;
  const BIT = { left: 1, right: 2, jump: 4, up: 8, down: 16 };

  // Seeded random numbers, so the course is the same everywhere.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Ten 300 m sections, each with its own idea (the order of difficulty rises with height).
  const SECTIONS = [
    { name: '들판 계단', style: 'wide' }, { name: '나무 사다리', style: 'ladder' }, { name: '조약돌 발판', style: 'small' },
    { name: '흔들 다리', style: 'moving' }, { name: '두 갈래 길', style: 'branch' }, { name: '굴러오는 공', style: 'balls' },
    { name: '바람 협곡', style: 'ropes' }, { name: '오르내리는 발판', style: 'lifts' }, { name: '구름 미로', style: 'mix' },
    { name: '정상 탑', style: 'summit' },
  ];

  function buildCourse() {
    const rnd = mulberry32(0x3000c11b);
    const range = (a, b) => a + (b - a) * rnd();
    const platforms = []; const ladders = []; const balls = []; const gusts = [];
    const plat = (cx, w, y, move = null) => {
      const half = w / 2; const x0 = Math.max(0, cx - half); const x1 = Math.min(W, cx + half);
      platforms.push({ x0, x1, y, move, shelf: false }); return platforms[platforms.length - 1];
    };
    platforms.push({ x0: 0, x1: W, y: 0, move: null, shelf: true });
    // A full-width shelf every 100 m: a fall never costs more than one stretch, and every shelf is a safe place to stop.
    const shelf = (y) => { platforms.push({ x0: 0, x1: W, y, move: null, shelf: true }); };
    const clampX = (x, w) => Math.min(W - w / 2 - 0.5, Math.max(w / 2 + 0.5, x));

    // One chain of platforms from (x, y) up to yEnd; returns the last spot.
    function chain(x, y, yEnd, style, lane = null) {
      let cx = x; let cw = 4; let step = 0;
      const laneMin = lane ? lane[0] : 0; const laneMax = lane ? lane[1] : W;
      while (y < yEnd - 0.01) {
        step += 1;
        const hard = style === 'summit' || style === 'mix';
        const w = { wide: range(4, 6), ladder: range(3, 4.5), small: range(1.3, 2.1), moving: range(2.1, 2.8), branch: range(2, 3), balls: range(2.6, 3.4), ropes: range(2.2, 3), lifts: range(2.3, 3), mix: range(1.6, 2.4), summit: range(1.4, 2) }[style];
        // a ladder or a rope: climb a long way at once
        if ((style === 'ladder' && step % 4 === 0) || (style === 'ropes' && step % 3 === 0) || (style === 'branch' && lane && lane[0] < 6 && step % 3 === 0)) {
          const len = Math.min(yEnd - y, style === 'ropes' ? range(8, 13) : range(6, 10));
          if (len > 3) {
            const lx = Math.min(laneMax - 1, Math.max(laneMin + 1, cx + range(-cw / 2 + 0.4, cw / 2 - 0.4)));
            ladders.push({ x: lx, y0: y, y1: y + len, kind: style === 'ropes' ? 'rope' : 'ladder' });
            y += len; cw = 3; cx = clampX(lx + range(-0.8, 0.8), cw); plat(cx, cw, y);
            continue;
          }
        }
        let dy = hard ? range(1.8, 2.15) : style === 'wide' ? range(1.5, 1.85) : range(1.6, 2.05);
        if (y + dy > yEnd) dy = yEnd - y;
        const ny = y + dy;
        if (ny >= yEnd - 0.01) break; // the shelf at yEnd is the next step (full width, always reachable)
        const gap = dy > 1.8 ? 1.3 : 2.3;
        const reach = cw / 2 + w / 2 + gap;
        let nx = cx + (rnd() < 0.5 ? -1 : 1) * range(Math.min(1, reach * 0.4), reach);
        nx = Math.min(laneMax - w / 2 - 0.3, Math.max(laneMin + w / 2 + 0.3, clampX(nx, w)));
        if (Math.abs(nx - cx) > reach) nx = cx + Math.sign(nx - cx) * reach;
        let move = null;
        if ((style === 'moving' && step % 2 === 0) || ((style === 'mix' || style === 'summit') && step % 3 === 0)) {
          move = { axis: 'x', amp: range(1.6, 3), period: range(2.6, 4), phase: rnd() };
          nx = Math.min(W - w / 2 - move.amp - 0.3, Math.max(w / 2 + move.amp + 0.3, nx));
        } else if (style === 'lifts' && step % 2 === 0) {
          move = { axis: 'y', amp: range(0.8, 1.4), period: range(3, 4.2), phase: rnd() };
        }
        const p = plat(nx, w, ny, move);
        // a ball rolls back and forth just above this step (knocks a climber back)
        if (style === 'balls' || ((style === 'mix' || style === 'summit') && step % 4 === 1)) {
          balls.push({ cx: (p.x0 + p.x1) / 2, cy: ny + 0.75, r: 0.45, amp: (p.x1 - p.x0) / 2 + 1.2, period: range(2.2, 3.2), phase: rnd() });
        }
        cx = nx; cw = w; y = ny;
      }
      return { x: cx, y: yEnd };
    }

    let x = W / 2; let y = 0;
    for (let s = 0; s < SECTIONS.length; s += 1) {
      const style = SECTIONS[s].style;
      for (let k = 1; k <= 3; k += 1) {
        const yEnd = s * 300 + k * 100;
        if (style === 'branch') { // two ways up: ladders on the left, jumps on the right; both reach the shelf
          chain(5, y, yEnd, 'branch', [0.5, 10.5]);
          chain(19, y, yEnd, 'small', [13.5, 23.5]);
        } else {
          chain(x, y, yEnd, style);
        }
        if (style === 'ropes' || (style === 'summit' && k === 2)) gusts.push({ y0: y + 10, y1: yEnd - 10, dir: k % 2 ? 1 : -1, strength: style === 'summit' ? 3.2 : 2.6, period: 4, on: 0.5, phase: rnd() });
        y = yEnd;
        if (yEnd < TOP) shelf(yEnd);
        x = range(5, 19);
      }
    }
    platforms.push({ x0: W / 2 - 4, x1: W / 2 + 4, y: TOP, move: null, shelf: true, summit: true });
    platforms.sort((a, b) => a.y - b.y);
    return { platforms, ladders, balls, gusts };
  }
  const COURSE = buildCourse();
  const ys = COURSE.platforms.map((p) => p.y);
  const lowerBound = (v) => { let lo = 0; let hi = ys.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ys[mid] < v) lo = mid + 1; else hi = mid; } return lo; };

  // Where a platform / ball / gust is at a given tick.
  const wave = (m, tick) => Math.sin(((tick * DT) / m.period + m.phase) * Math.PI * 2);
  function platformAt(p, tick) {
    if (!p.move) return p;
    const d = p.move.amp * wave(p.move, tick);
    return p.move.axis === 'x' ? { x0: p.x0 + d, x1: p.x1 + d, y: p.y } : { x0: p.x0, x1: p.x1, y: p.y + d };
  }
  const ballAt = (b, tick) => ({ x: b.cx + b.amp * wave(b, tick), y: b.cy, r: b.r });
  const gustAt = (g, tick) => (((tick * DT) / g.period + g.phase) % 1 < g.on ? g.dir * g.strength : 0);

  function newState() {
    return { x: W / 2, y: 0, vx: 0, vy: 0, grounded: true, plat: 0, climb: -1, stun: 0, jumpHeld: false, tick: 0 };
  }

  function platformsNear(yLow, yHigh) {
    const out = [];
    for (let i = lowerBound(yLow - 3); i < ys.length && ys[i] <= yHigh + 3; i += 1) out.push(i);
    return out;
  }

  // Advance one tick with an input bitmask. Mutates and returns the state.
  function step(s, input) {
    const tick = s.tick;
    const left = input & BIT.left; const right = input & BIT.right; const jump = input & BIT.jump; const up = input & BIT.up; const down = input & BIT.down;
    const control = s.stun <= 0;
    if (s.stun > 0) s.stun -= 1;
    const jumpPress = jump && !s.jumpHeld; s.jumpHeld = Boolean(jump);
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    // ride a moving platform
    if (s.grounded && s.plat >= 0) {
      const p = COURSE.platforms[s.plat];
      if (p.move) { const a = platformAt(p, tick); const b = platformAt(p, tick + 1); s.x += b.x0 - a.x0; s.y = b.y; }
    }

    // ladders and ropes
    if (s.climb < 0 && control && (up || down)) {
      for (let i = 0; i < COURSE.ladders.length; i += 1) {
        const l = COURSE.ladders[i];
        if (Math.abs(s.x - l.x) < 0.5 && ((up && s.y >= l.y0 - 0.05 && s.y < l.y1 - 0.1) || (down && s.y > l.y0 + 0.1 && s.y <= l.y1 + 0.05))) { s.climb = i; s.x = l.x; s.vx = 0; s.vy = 0; s.grounded = false; s.plat = -1; break; }
      }
    }
    if (s.climb >= 0) {
      const l = COURSE.ladders[s.climb];
      if (jumpPress && dir) { s.climb = -1; s.vy = JUMP * 0.65; s.vx = dir * SPEED; }
      else {
        s.vy = control ? ((up ? 1 : 0) - (down ? 1 : 0)) * (l.kind === 'rope' ? CLIMB * 0.85 : CLIMB) : 0; s.vx = 0;
        s.y += s.vy * DT;
        if (s.y >= l.y1) { s.y = l.y1; s.climb = -1; s.vy = 0; }
        else if (s.y <= l.y0) { s.y = l.y0; s.climb = -1; s.vy = 0; }
        else { s.tick = tick + 1; return s; }
      }
    }

    // walking, jumping, falling
    let gust = 0;
    for (const g of COURSE.gusts) if (s.y >= g.y0 && s.y <= g.y1) gust += gustAt(g, tick);
    const target = control ? dir * SPEED : s.vx;
    s.vx = s.grounded ? target : s.vx + (target - s.vx) * (control ? 0.25 : 0.04);
    if (control && jumpPress && s.grounded) { s.vy = JUMP; s.grounded = false; s.plat = -1; }
    s.vy = Math.max(-MAX_FALL, s.vy - G * DT);
    const prevY = s.y;
    s.x = Math.min(W - HALF_W, Math.max(HALF_W, s.x + (s.vx + gust) * DT));
    s.y += s.vy * DT;

    // land on the highest platform crossed this tick (platforms are one-way: jump up through, stand on top)
    s.grounded = false; s.plat = -1;
    if (s.vy <= 0) {
      let best = -1; let bestY = -Infinity;
      for (const i of platformsNear(s.y, prevY)) {
        const p = platformAt(COURSE.platforms[i], tick + 1);
        if (s.x + HALF_W < p.x0 || s.x - HALF_W > p.x1) continue;
        const was = COURSE.platforms[i].move ? platformAt(COURSE.platforms[i], tick).y : p.y;
        if (prevY >= Math.min(was, p.y) - 0.001 && s.y <= p.y + 0.0001 && p.y > bestY) { best = i; bestY = p.y; }
      }
      if (best >= 0) { s.y = bestY; s.vy = 0; s.grounded = true; s.plat = best; }
    }
    if (s.y < 0) { s.y = 0; s.vy = 0; s.grounded = true; s.plat = 0; }
    if (s.y > TOP) { s.y = TOP; s.vy = Math.min(0, s.vy); }

    // a rolling ball knocks the climber back
    for (const b of COURSE.balls) {
      if (Math.abs(b.cy - s.y) > 3) continue;
      const p = ballAt(b, tick + 1);
      if (Math.hypot(p.x - s.x, p.y - (s.y + HEIGHT / 2)) < p.r + 0.45) { s.vx = (s.x >= p.x ? 1 : -1) * 7; s.vy = 6; s.stun = 12; s.grounded = false; s.plat = -1; break; }
    }
    s.tick = tick + 1;
    return s;
  }

  // A safe place to end: standing still on a platform that does not move, not knocked back, not on a ladder.
  function isSafe(s) {
    if (!s.grounded || s.plat < 0 || s.stun > 0 || s.climb >= 0) return false;
    return !COURSE.platforms[s.plat].move;
  }
  const altitude = (s) => Math.max(0, Math.min(TOP, Math.floor(s.y + 1e-6)));
  const sectionAt = (y) => SECTIONS[Math.min(SECTIONS.length - 1, Math.floor(Math.max(0, y) / 300))];

  return { W, TOP, DT, TICKS_PER_SECOND, BIT, HALF_W, HEIGHT, SECTIONS, COURSE, newState, step, isSafe, altitude, sectionAt, platformAt, ballAt, gustAt };
}));
