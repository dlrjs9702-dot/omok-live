// 1.10.390 N3-b 자연 구역 탐방선 (gamecenter-notes docs/n3-plan-20261120.md §4-2, 사용자 결정 37): four boats between 배 타는 곳 (달마루섬) and
// 별마루섬 부두, called like the taxi -- shared word for word by the server (whose seat, which boat where) and the page (the boats on the
// water, the riders in them, the same on every screen). Pure numbers and rules, no clock of its own: every call is given `now`.
//   a boat at a dock: docked -> someone boards -> hold (6 s, others may come) -> sail (13 m/s, 8 under the bridge) -> unload (3 s)
//   -> stays (docked) while its dock has 2 boats or fewer, else back (6 s, may be boarded) -> sails back empty or with whoever came
//   no boat at a dock: the callers queued in order, the first boat there takes up to four
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandBoat = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const SEATS = 4; const HOLD = 6000; const UNLOAD = 3000; const MOOR = 4000; const FAST = 13; const SLOW = 8; const BOATS = 4;
  const BRIDGE = { x: 59.35, z: 140, r: 20 }; // (the high 윤슬다리's 40 m over the lane: slower)
  const SIDE = 2.5; // (keep to the right: each way 2.5 m off the lane's middle -- the boats 3.2 wide, 1.8 m between)
  // the lane's middle (the 11-17 plan's, notes n3-plan §3-1; its 별마루섬 end off the dock's float to the west)
  const LANE = Object.freeze([[0, 10], [16, 60], [44, 100], [58, 126], [59.35, 140], [62, 168], [78, 184], [120, 186], [170, 186], [200, 190], [212, 195]].map((p) => Object.freeze(p)));
  // a boat's yaw: its bow toward (sin yaw, cos yaw) (the model's bow -Z, turned by the entry's rotationY π)
  // the docks: three berths each (two along the float's sea side, one off its end) and a waiting spot 8 m out; `float` the float's middle
  const DOCKS = Object.freeze({
    dal: Object.freeze({ id: 'dal', label: '배 타는 곳', other: 'byeol', float: Object.freeze({ x: 0, z: 1.5, half: 6, w: 3, along: 'x' }), lane: 0,
      /* (the third off the float's east end, 1.9 m out -- right by it the beach is shallow: test/island-boat measures every hull's water) */
      berths: Object.freeze([{ x: -4.3, z: 4.85, yaw: Math.PI / 2 }, { x: 4.3, z: 4.85, yaw: Math.PI / 2 }, { x: 9.5, z: 6.5, yaw: 0 }].map((b) => Object.freeze(b))),
      offshore: Object.freeze({ x: 0, z: 13, yaw: 0 }) }),
    byeol: Object.freeze({ id: 'byeol', label: '별마루섬 부두', other: 'dal', float: Object.freeze({ x: 223.6, z: 197, half: 6, w: 3, along: 'z' }), lane: LANE.length - 1,
      /* (the third 4.5 m off the float's north end, along it -- closer the bottom is too shallow) */
      berths: Object.freeze([{ x: 220.25, z: 192.7, yaw: Math.PI }, { x: 220.25, z: 201.3, yaw: Math.PI }, { x: 221.5, z: 186.5, yaw: -Math.PI / 2 }].map((b) => Object.freeze(b))),
      offshore: Object.freeze({ x: 212, z: 197, yaw: -Math.PI / 2 }) }),
  });
  // the model's marks (assets 134 ferry.json), in the model's own frame (bow -Z); turned into the boat's frame (bow +Z) by (-x, -z)
  const NODES = Object.freeze({ seats: Object.freeze([[-0.55, 0.8, -0.63], [0.55, 0.8, -0.63], [-0.55, 0.8, 0.42], [0.55, 0.8, 0.42]]), captain: Object.freeze([0.72, 0.35, -1.7]), deck: 0.35, gateZ: 1.45, beam: 3.0, length: 8.0 });
  const SEAT_DROP = 0.26; // (assets 134: the body's root the seat mark less 0.26 -- SitIdle)
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // a point of the boat (its own frame: model x, y, z) in the world, for a pose { x, z, yaw, y }
  const worldOf = (pose, [mx, my, mz]) => { const hx = -mx; const hz = -mz; const c = Math.cos(pose.yaw); const s = Math.sin(pose.yaw); return { x: pose.x + hx * c + hz * s, y: (pose.y || 0) + my, z: pose.z - hx * s + hz * c }; };
  const seatAt = (pose, k) => { const p = worldOf(pose, NODES.seats[k]); return { x: p.x, y: p.y - SEAT_DROP, z: p.z, yaw: pose.yaw }; };
  const captainAt = (pose) => { const p = worldOf(pose, NODES.captain); return { x: p.x, y: p.y, z: p.z, yaw: pose.yaw }; };
  // where one steps off: on the float, beside the boat's door (the side toward the float), 1 m in from its edge
  function exitOf(dockId, berth) {
    const d = DOCKS[dockId]; const b = berth >= 0 ? d.berths[berth] : d.berths[0]; const f = d.float;
    if (f.along === 'x') return { x: Math.max(f.x - f.half + 1, Math.min(f.x + f.half - 1, b.x)), z: f.z + (b.z > f.z ? 1 : -1) * (f.w / 2 - 1) };
    return { x: f.x + (b.x > f.x ? 1 : -1) * (f.w / 2 - 1), z: Math.max(f.z - f.half + 1, Math.min(f.z + f.half - 1, b.z)) };
  }
  // ---- the way across: a berth, the lane on this way's right, a berth (or the waiting spot) -- sampled every metre with its time ----
  function laneSide(dir) {
    const pts = dir > 0 ? LANE : [...LANE].reverse(); const out = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l; const nz = (b[0] - a[0]) / l; out.push([pts[i][0] + nx * SIDE, pts[i][1] + nz * SIDE]);
    }
    return out;
  }
  const paths = new Map();
  function pathOf(from, bFrom, to, bTo) {
    const key = `${from}:${bFrom}>${to}:${bTo}`; if (paths.has(key)) return paths.get(key);
    const A = DOCKS[from]; const B = DOCKS[to]; const start = bFrom >= 0 ? A.berths[bFrom] : A.offshore; const end = bTo >= 0 ? B.berths[bTo] : B.offshore;
    let pts = [[start.x, start.z], ...laneSide(from === 'dal' ? 1 : -1), [end.x, end.z]];
    /* (404 문제 기록 7e6f3839: the corners rounded -- two passes cutting each a quarter in, the berth and the far end kept -- a boat turns, it does not
       snap from one heading to the next) */
    for (let pass = 0; pass < 2; pass += 1) { const r = [pts[0]]; for (let i = 0; i < pts.length - 1; i += 1) { const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1]; if (i > 0) r.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]); if (i < pts.length - 2) r.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } r.push(pts[pts.length - 1]); pts = r; }
    const samples = [{ x: pts[0][0], z: pts[0][1], t: 0, d: 0 }]; let d = 0; let t = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i]; const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L));
      for (let k = 1; k <= n; k += 1) { const x = ax + ((bx - ax) * k) / n; const z = az + ((bz - az) * k) / n; const step = L / n; d += step; samples.push({ x, z, t: 0, d, slow: Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < BRIDGE.r }); }
    }
    /* (1.10.404 문제 기록 7e6f3839, notes issues-taxi-resident §15: it left at full speed at once, sliding sideways off the float while its bow turned
       over 6 s. Now from standing, ACCEL m/s² up to its pace and down again into its berth (never under CREEP m/s) -- the bow turned while it is
       still slow, TURN_MS at each end, the way it goes after) */
    for (let i = 1; i < samples.length; i += 1) { const a = samples[i - 1]; const b = samples[i]; const m = (a.d + b.d) / 2; const v = Math.max(CREEP, Math.min(b.slow ? SLOW : FAST, Math.sqrt(2 * ACCEL * m), Math.sqrt(2 * ACCEL * Math.max(0, d - m)))); b.t = a.t + ((b.d - a.d) / v) * 1000; }
    t = samples[samples.length - 1].t;
    const out = { key, samples, ms: t, length: d, endYaw: end.yaw }; paths.set(key, out); return out;
  }
  function alongPath(p, ms) {
    const S = p.samples; if (ms <= 0) { const a = S[0]; const b = S[1]; return { x: a.x, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }; }
    if (ms >= p.ms) { const a = S[S.length - 2]; const b = S[S.length - 1]; return { x: b.x, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }; }
    let lo = 0; let hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].t <= ms) lo = m; else hi = m; }
    const a = S[lo]; const b = S[hi]; const k = (ms - a.t) / (b.t - a.t || 1);
    const ya = S[Math.max(0, lo - 3)]; const yb = S[Math.min(S.length - 1, hi + 3)]; /* (404: the bow by the way 3 m either side -- round the lane's corners, not snapping at them) */
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(yb.x - ya.x, yb.z - ya.z) };
  }
  // the first and last TURN_MS of a crossing turn the bow from the berth's line to the lane's, and back (404: while still slow -- 6 s, at full speed, before)
  const TURN_MS = 2500; const ACCEL = 1.5; const CREEP = 0.8;
  function poseAt(boat, now, scale = 1) {
    const d = DOCKS[boat.at || boat.to]; const berthPose = (dock, k) => { const b = k >= 0 ? DOCKS[dock].berths[k] : DOCKS[dock].offshore; return { x: b.x, z: b.z, yaw: b.yaw, moving: false }; };
    if (boat.phase === 'sail') {
      const p = pathOf(boat.from, boat.berthFrom, boat.to, boat.berthTo); const ms = (now - boat.t0) * scale; const q = alongPath(p, ms);
      const start = boat.berthFrom >= 0 ? DOCKS[boat.from].berths[boat.berthFrom].yaw : DOCKS[boat.from].offshore.yaw; const end = p.endYaw;
      let yaw = q.yaw; if (ms < TURN_MS) yaw = start + wrap(q.yaw - start) * smooth(ms / TURN_MS); else if (p.ms - ms < TURN_MS) yaw = end + wrap(q.yaw - end) * smooth((p.ms - ms) / TURN_MS);
      return { x: q.x, z: q.z, yaw, moving: ms < p.ms };
    }
    if (boat.phase === 'moor') { const o = DOCKS[boat.at].offshore; const b = DOCKS[boat.at].berths[boat.berth]; const k = Math.min(1, ((now - boat.t0) * scale) / MOOR); const s = smooth(k); return { x: o.x + (b.x - o.x) * s, z: o.z + (b.z - o.z) * s, yaw: o.yaw + wrap(b.yaw - o.yaw) * s, moving: k < 1 }; }
    if (boat.phase === 'wait') return berthPose(boat.at, -1);
    return d ? berthPose(boat.at, boat.berth) : { x: 0, z: 0, yaw: 0, moving: false };
  }
  const smooth = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * (3 - 2 * t); };
  const sailMs = (boat, scale = 1) => pathOf(boat.from, boat.berthFrom, boat.to, boat.berthTo).ms / scale;

  // ---- the fleet (the server's; the page holds its view) ----
  function createFleet({ now = 0, scale = 1 } = {}) {
    /* (n: how many times it has let its riders off -- a page aboard sees it go up and is off at once, before its next pose's answer) */
    const boats = [0, 1, 2, 3].map((i) => ({ id: `b${i + 1}`, at: i < 2 ? 'dal' : 'byeol', berth: i % 2, phase: 'docked', t0: now, until: 0, from: null, to: null, berthFrom: -1, berthTo: -1, seats: [null, null, null, null], n: 0 }));
    return { boats, queues: { dal: [], byeol: [] }, scale, seq: 1 };
  }
  const SEATED = ['hold', 'back', 'sail', 'unload', 'wait', 'moor'];
  const riderOf = (fleet, token) => { for (const b of fleet.boats) { const k = b.seats.indexOf(token); if (k >= 0 && SEATED.includes(b.phase)) return { boat: b, seat: k }; } return null; };
  const freeSeats = (b) => b.seats.filter((s) => !s).length;
  // the boats a dock has or will have: there (any phase but sailing away) and on their way to it
  const countAt = (fleet, dock) => fleet.boats.filter((b) => (b.phase === 'sail' ? b.to === dock : b.at === dock)).length;
  const usedBerths = (fleet, dock, except) => new Set(fleet.boats.filter((b) => b !== except && ((b.phase === 'sail' && b.to === dock && b.berthTo >= 0) || (b.phase !== 'sail' && b.at === dock && b.berth >= 0 && b.phase !== 'wait'))).map((b) => (b.phase === 'sail' ? b.berthTo : b.berth)));
  const freeBerth = (fleet, dock, except) => { const used = usedBerths(fleet, dock, except); for (let k = 0; k < DOCKS[dock].berths.length; k += 1) if (!used.has(k)) return k; return -1; };
  function depart(fleet, b, now) { b.from = b.at; b.to = DOCKS[b.at].other; b.berthFrom = b.berth; b.berthTo = freeBerth(fleet, b.to, b); b.phase = 'sail'; b.t0 = now; b.at = null; b.berth = -1; b.until = now + sailMs(b, fleet.scale); }
  // board at a dock: a boat holding there with room, else one about to go back, else one staying (it starts holding) -- or the queue
  function board(fleet, dock, token, now) {
    if (!DOCKS[dock]) return { error: 'BAD_DOCK' }; if (riderOf(fleet, token)) return { error: 'RIDING' };
    const here = fleet.boats.filter((b) => b.at === dock);
    const pick = here.find((b) => b.phase === 'hold' && freeSeats(b)) || here.find((b) => b.phase === 'back' && freeSeats(b)) || here.find((b) => b.phase === 'docked');
    if (!pick) { const q = fleet.queues[dock]; if (!q.some((e) => e.token === token)) q.push({ token, at: now }); return { queued: true, place: q.findIndex((e) => e.token === token) + 1, etaMs: etaOf(fleet, dock, now) }; }
    const seat = pick.seats.indexOf(null); pick.seats[seat] = token; if (pick.phase === 'docked') { pick.phase = 'hold'; pick.until = now + HOLD / fleet.scale; }
    if (!freeSeats(pick)) depart(fleet, pick, now);
    fleet.queues[dock] = fleet.queues[dock].filter((e) => e.token !== token);
    return { ok: true, boat: pick, seat };
  }
  // off again before it goes (hold / back); out of a queue
  function leave(fleet, token, now) {
    for (const d of Object.keys(fleet.queues)) fleet.queues[d] = fleet.queues[d].filter((e) => e.token !== token);
    const r = riderOf(fleet, token); if (!r) return { ok: true, was: null };
    if (!['hold', 'back'].includes(r.boat.phase)) return { error: 'SAILING' };
    r.boat.seats[r.seat] = null; if (r.boat.phase === 'hold' && !r.boat.seats.some(Boolean)) { r.boat.phase = 'docked'; r.boat.until = 0; }
    return { ok: true, was: { id: r.boat.id, dock: r.boat.at, berth: r.boat.berth } }; /* (1.10.395 Codex 19: the berth they were at -- the second's way off is 8.6 m from the first's) */
  }
  // one gone (left the island, the page closed): their seat free at once, whatever the phase
  /* (1.10.395 Codex 8: a boat waiting to go that is empty now stays, as when one gets off) */
  function drop(fleet, token) { for (const d of Object.keys(fleet.queues)) fleet.queues[d] = fleet.queues[d].filter((e) => e.token !== token); for (const b of fleet.boats) { const k = b.seats.indexOf(token); if (k >= 0) { b.seats[k] = null; if (b.phase === 'hold' && !b.seats.some(Boolean)) { b.phase = 'docked'; b.until = 0; } } } }
  /* (1.10.395 Codex 8: an empty boat coming to rest -- the same rule as after unloading: a third at a dock goes back across, so neither
     side is left without one) */
  const rest = (fleet, b, now) => { if (countAt(fleet, b.at) > 2) { b.phase = 'back'; b.until = now + HOLD / fleet.scale; } else { b.phase = 'docked'; b.until = 0; } };
  // when a boat will next take people at a dock (ms from now): one there now 0, else the first on its way (its unloading too), else
  // one at the other dock: across and back
  function etaOf(fleet, dock, now) {
    let best = Infinity; const S = fleet.scale;
    for (const b of fleet.boats) {
      if (b.at === dock && ['docked', 'hold', 'back'].includes(b.phase)) return 0;
      if (b.at === dock && b.phase === 'unload') best = Math.min(best, b.until - now);
      if (b.at === dock && b.phase === 'moor') best = Math.min(best, (MOOR / S) - (now - b.t0) + UNLOAD / S);
      if (b.at === dock && b.phase === 'wait') best = Math.min(best, MOOR / S + UNLOAD / S + 3000 / S);
      if (b.phase === 'sail' && b.to === dock) best = Math.min(best, b.until - now + (b.seats.some(Boolean) ? UNLOAD / S : 0));
      if (b.phase === 'sail' && b.from === dock) best = Math.min(best, b.until - now + UNLOAD / S + HOLD / S + pathOf(b.to, 0, dock, 0).ms / S);
    }
    return Number.isFinite(best) ? Math.max(0, Math.round(best)) : Math.round((HOLD + pathOf(DOCKS[dock].other, 0, dock, 0).ms) / S);
  }
  // the fleet's clock moved on: holds run out, crossings end, unloading ends; the queues boarded where a boat now takes people.
  // canBoard(token, dock): still there for it (the server's own look: on the island, near the float). Returns what changed.
  function tick(fleet, now, { canBoard = () => true } = {}) {
    const out = { changed: false, released: [], boarded: [] };
    for (let guard = 0; guard < 12; guard += 1) {
      let moved = false;
      for (const b of fleet.boats) {
        if ((b.phase === 'hold' || b.phase === 'back') && now >= b.until) { depart(fleet, b, now); moved = true; continue; }
        if (b.phase === 'sail' && now >= b.until) {
          b.at = b.to; b.berth = b.berthTo; const riders = b.seats.some(Boolean); const arrive = b.until;
          if (b.berth < 0) { b.berth = freeBerth(fleet, b.at, b); if (b.berth >= 0) { b.phase = 'moor'; b.t0 = arrive; } else { b.phase = 'wait'; b.t0 = arrive; } }
          else if (riders) { b.phase = 'unload'; b.until = arrive + UNLOAD / fleet.scale; } else rest(fleet, b, arrive);
          moved = true; continue;
        }
        if (b.phase === 'wait') { const k = freeBerth(fleet, b.at, b); if (k >= 0) { b.berth = k; b.phase = 'moor'; b.t0 = now; moved = true; } else if (!b.seats.some(Boolean)) { depart(fleet, b, now); moved = true; } continue; } /* (395 Codex 8: an empty one with nowhere to tie up goes back across from offshore) */
        if (b.phase === 'moor' && now - b.t0 >= MOOR / fleet.scale) { if (b.seats.some(Boolean)) { b.phase = 'unload'; b.until = b.t0 + MOOR / fleet.scale + UNLOAD / fleet.scale; } else rest(fleet, b, now); moved = true; continue; }
        if (b.phase === 'unload' && now >= b.until) {
          for (let k = 0; k < SEATS; k += 1) if (b.seats[k]) { out.released.push({ token: b.seats[k], dock: b.at, ...exitOf(b.at, b.berth) }); b.seats[k] = null; } b.n += 1;
          b.outAt = b.at; b.outBerth = b.berth; /* (395 Codex 9: where they got off -- it may board and leave again in this same tick) */
          rest(fleet, b, now);
          moved = true; continue;
        }
      }
      // the queues: the first boat taking people at a dock takes them in order (those no longer there let go)
      for (const dock of Object.keys(fleet.queues)) {
        const q = fleet.queues[dock]; while (q.length && !canBoard(q[0].token, dock)) q.shift();
        while (q.length) { const b = fleet.boats.find((x) => x.at === dock && ((x.phase === 'hold' || x.phase === 'back') && freeSeats(x) || x.phase === 'docked')); if (!b) break;
          const e = q.shift(); if (!canBoard(e.token, dock)) continue; const r = board(fleet, dock, e.token, now); if (r.ok) { out.boarded.push({ token: e.token, id: r.boat.id, seat: r.seat }); moved = true; } }
      }
      if (!moved) break; out.changed = true;
    }
    return out;
  }
  // what the pages see (no tokens): each boat's phase and times, how full; the queues' lengths
  const view = (fleet, now) => ({ at: now, scale: fleet.scale, boats: fleet.boats.map((b) => ({ id: b.id, phase: b.phase, at: b.at, berth: b.berth, from: b.from, to: b.to, berthFrom: b.berthFrom, berthTo: b.berthTo, t0: b.t0, until: b.until, riders: b.seats.filter(Boolean).length, n: b.n, outAt: b.outAt || null, outBerth: b.outBerth ?? -1 })),
    queues: Object.fromEntries(Object.entries(fleet.queues).map(([d, q]) => [d, q.length])), eta: Object.fromEntries(Object.keys(DOCKS).map((d) => [d, etaOf(fleet, d, now)])) });
  // the sign at a dock and the hint's words (the page): 「탐방선 · 배 N척」 / 「곧 출발 · N초」 / 「배 오는 중 · N초 · 내 순서 K번째」
  function signOf(v, dock, now, myPlace = 0) {
    const here = v.boats.filter((b) => b.at === dock && b.phase !== 'sail');
    const holding = here.filter((b) => b.phase === 'hold' || b.phase === 'back').sort((a, b) => a.until - b.until)[0];
    if (holding) return `곧 출발 · ${Math.max(0, Math.ceil((holding.until - now) / 1000))}초`;
    const ready = here.filter((b) => b.phase === 'docked').length; if (ready) return `탐방선 · 배 ${ready}척`;
    const eta = Math.max(0, Math.ceil(((v.eta?.[dock] ?? 0) - (now - v.at)) / 1000));
    return `배 오는 중 · ${eta}초${myPlace ? ` · 내 순서 ${myPlace}번째` : ''}`;
  }
  return { SEATS, HOLD, UNLOAD, MOOR, FAST, SLOW, BOATS, BRIDGE, SIDE, LANE, DOCKS, NODES, SEAT_DROP, worldOf, seatAt, captainAt, exitOf, laneSide, pathOf, poseAt, sailMs,
    createFleet, riderOf, countAt, freeBerth, board, leave, drop, etaOf, tick, view, signOf };
}));
