// 1.10.390 N3-b 자연 구역 탐방선 (gamecenter-notes docs/n3-plan-20261120.md §4-2, 사용자 결정 37): four boats between 배 타는 곳 (달마루섬) and
// 별마루섬 부두, called like the taxi -- shared word for word by the server (whose seat, which boat where) and the page (the boats on the
// water, the riders in them, the same on every screen). Pure numbers and rules, no clock of its own: every call is given `now`.
//   a boat at a boarding berth: docked -> someone boards -> hold (6 s, others may come) -> sail (ahead off its berth, the lane at 13 m/s, 8 under
//   the bridge, into the other side's unloading berth ahead) -> unload (3 s) -> parked -> shift (empty: astern out, round, astern into a boarding
//   berth -- inner first) -> docked; or, its outer boarding berth taken, back (empty, straight across). 1.10.409 결정 75 · assets 172
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
  /* 1.10.409 assets 172 넓은 부두 + 결정 75 「전부 a」 (notes docs/dock-maneuver-20261122.md): both docks one model -- a 22 x 4 m float and a 3 x 10 m arm
     off its +x end out to sea. The dock's own frame: x along the float (+x the arm's end), +z out to sea; its root at the float's middle (the
     model's root moved 0.5 m seaward, the gangway where it was). Three berths: 0 the outer boarding one, 1 the inner (bows away from the arm), 2 the
     unloading one along the arm (bow to the shore); the waiting spot on the unloading berth's way in */
  const PI = Math.PI;
  const ROOTS = Object.freeze({ dal: Object.freeze({ x: 0, z: 2, yaw: 0 }), byeol: Object.freeze({ x: 223.1, z: 197, yaw: -PI / 2 }) });
  const MODEL = Object.freeze({ berths: [[-6.5, 3.75, -PI / 2], [2.5, 3.75, -PI / 2], [12.75, 7.5, PI]], offshore: [13.75, 34, PI], exits: [[-6.5, 1], [2.5, 1], [9.5, 7.5]] /* (the third's: the arm's middle) */ });
  const toWorld = (id, mx, mz) => { const d = ROOTS[id]; const c = Math.cos(d.yaw); const s = Math.sin(d.yaw); return { x: d.x + mx * c + mz * s, z: d.z - mx * s + mz * c }; };
  const fromWorld = (id, wx, wz) => { const d = ROOTS[id]; const dx = wx - d.x; const dz = wz - d.z; const c = Math.cos(d.yaw); const s = Math.sin(d.yaw); return { x: dx * c - dz * s, z: dx * s + dz * c }; };
  const poseW = (id, [mx, mz, psi]) => Object.freeze({ ...toWorld(id, mx, mz), yaw: Math.atan2(Math.sin(psi + ROOTS[id].yaw), Math.cos(psi + ROOTS[id].yaw)) });
  const dockOf = (id, label, other, along) => Object.freeze({ id, label, other, float: Object.freeze({ x: ROOTS[id].x, z: ROOTS[id].z, half: 11, w: 4, along }), lane: id === 'dal' ? 0 : LANE.length - 1,
    berths: Object.freeze(MODEL.berths.map((b) => poseW(id, b))), offshore: poseW(id, MODEL.offshore) });
  const DOCKS = Object.freeze({ dal: dockOf('dal', '배 타는 곳', 'byeol', 'x'), byeol: dockOf('byeol', '별마루섬 부두', 'dal', 'z') });
  /* (1.10.434 Codex P3-21: shared boarding region covering the entire 22 x 4 m float and its 3 x 10 m arm, with margin -- client and server agree) */
  function nearDock(id, x, z, margin = 2.0) {
    const d = DOCKS[id]; if (!d || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    const loc = fromWorld(id, x, z);
    const onFloat = Math.abs(loc.x) <= d.float.half + margin && Math.abs(loc.z) <= d.float.w / 2 + margin;
    const onArm = loc.x >= 8 - margin && loc.x <= 12.5 + margin && loc.z >= -margin && loc.z <= 10 + margin;
    return onFloat || onArm;
  }
  const OUTER = 0; const INNER = 1; const UNLOAD_BERTH = 2;
  // the model's marks (assets 134 ferry.json), in the model's own frame (bow -Z); turned into the boat's frame (bow +Z) by (-x, -z)
  const NODES = Object.freeze({ seats: Object.freeze([[-0.55, 0.8, -0.63], [0.55, 0.8, -0.63], [-0.55, 0.8, 0.42], [0.55, 0.8, 0.42]]), captain: Object.freeze([0.72, 0.35, -1.7]), deck: 0.35, gateZ: 1.45, beam: 3.0, length: 8.0 });
  const SEAT_DROP = 0.26; // (assets 134: the body's root the seat mark less 0.26 -- SitIdle)
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // a point of the boat (its own frame: model x, y, z) in the world, for a pose { x, z, yaw, y }
  const worldOf = (pose, [mx, my, mz]) => { const hx = -mx; const hz = -mz; const c = Math.cos(pose.yaw); const s = Math.sin(pose.yaw); return { x: pose.x + hx * c + hz * s, y: (pose.y || 0) + my, z: pose.z - hx * s + hz * c }; };
  const seatAt = (pose, k) => { const p = worldOf(pose, NODES.seats[k]); return { x: p.x, y: p.y - SEAT_DROP, z: p.z, yaw: pose.yaw }; };
  const captainAt = (pose) => { const p = worldOf(pose, NODES.captain); return { x: p.x, y: p.y, z: p.z, yaw: pose.yaw }; };
  // where one steps off: on the float 1 m in from its sea edge beside a boarding berth, or the arm's middle by the unloading one (172 HANDOFF §4)
  function exitOf(dockId, berth) { const e = MODEL.exits[berth >= 0 && berth < 3 ? berth : 0]; return toWorld(dockId, e[0], e[1]); }
  // ---- the way across: a berth, the lane on this way's right, a berth (or the waiting spot) -- sampled every metre with its time ----
  function laneSide(dir) {
    const pts = dir > 0 ? LANE : [...LANE].reverse(); const out = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l; const nz = (b[0] - a[0]) / l; out.push([pts[i][0] + nx * SIDE, pts[i][1] + nz * SIDE]);
    }
    return out;
  }
  /* ---- 1.10.409 결정 75 (dock-maneuver §2 · §3): each berth's ways as pieces in the dock's frame -- sideways (the first and last metre only),
     ahead, astern (empty boats only), arcs -- every pose with its own bow; a rider's boat always leaves its boarding berth ahead and comes into the
     other side's unloading berth ahead; an empty one backs out of the unloading berth, turns, and backs into a boarding berth ---- */
  const pose0 = ([x, z, psi]) => ({ x, z, psi });
  const side = (p, dx, dz, n = 8) => { const out = []; for (let k = 1; k <= n; k += 1) out.push({ x: p.x + (dx * k) / n, z: p.z + (dz * k) / n, psi: p.psi, kind: 'side' }); return out; };
  const line = (p, len, g = 1) => { const out = []; const n = Math.max(1, Math.ceil(len / 0.25)); for (let k = 1; k <= n; k += 1) out.push({ x: p.x + g * Math.sin(p.psi) * ((len * k) / n), z: p.z + g * Math.cos(p.psi) * ((len * k) / n), psi: p.psi, kind: g > 0 ? 'ahead' : 'astern' }); return out; };
  const arc = (p, R, dpsi, g = 1) => { const out = []; const L = R * Math.abs(dpsi); const n = Math.max(1, Math.ceil(L / 0.25)); let { x, z, psi } = p; for (let k = 1; k <= n; k += 1) { const ds = L / n; const mid = psi + dpsi / n / 2; x += g * Math.sin(mid) * ds; z += g * Math.cos(mid) * ds; psi += dpsi / n; out.push({ x, z, psi, kind: g > 0 ? 'ahead' : 'astern' }); } return out; };
  const run = (start, steps) => { const poses = [{ ...start, kind: 'start' }]; for (const st of steps) poses.push(...st(poses[poses.length - 1])); return poses; };
  const B0 = pose0(MODEL.berths[0]); const B1 = pose0(MODEL.berths[1]); const BU = pose0(MODEL.berths[2]); const OFF = pose0(MODEL.offshore);
  const backOut = [(p) => side(p, 1, 0), (p) => line(p, 17, -1), (p) => arc(p, 8, PI / 2)]; /* (off the arm, astern past its tip, ahead round toward the boarding side -- never the arm's far side: 별마루다리 there) */
  const TEMPLATES = Object.freeze({
    out: [run(B0, [(p) => side(p, 0, 1), (p) => line(p, 3), (p) => arc(p, 9, PI / 2)]), run(B1, [(p) => side(p, 0, 1), (p) => line(p, 12), (p) => arc(p, 9, PI / 2)]),
      run(BU, [...backOut, (p) => arc(p, 8, PI / 2)]) /* (a third boat: straight back across, empty) */],
    in: run(OFF, [(p) => line(p, 26.5), (p) => side(p, -1, 0)]),
    shift: [0, 1].map((k) => run(BU, [...backOut, (p) => line(p, 17.2), (p) => arc(p, 12, -PI / 6), (p) => line(p, 4.1), (p) => arc(p, 12, PI / 6), (p) => arc(p, 11.1, PI / 4, -1), (p) => arc(p, 11.1, -PI / 4, -1), (p) => line(p, k ? 13.8 : 4.8, -1), (p) => side(p, 0, -1)])),
  });
  const placed = (id, poses) => poses.map((p) => ({ ...toWorld(id, p.x, p.z), yaw: Math.atan2(Math.sin(p.psi + ROOTS[id].yaw), Math.cos(p.psi + ROOTS[id].yaw)), kind: p.kind }));
  const ACCEL = 1.5; const PACE = Object.freeze({ side: [0.7, 0.5], astern: [2, 1], ahead: [6, ACCEL] }); /* ([m/s, m/s²] -- a piece's own; the lane FAST, SLOW under the bridge) */
  const groupOf = (k) => (k === 'lane' ? 'ahead' : k);
  // times along the samples: standing at each end and wherever the way changes between sideways, ahead and astern; never over a piece's pace
  function timed(samples) {
    let d = 0; samples[0].d = 0; for (let i = 1; i < samples.length; i += 1) { d += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z); samples[i].d = d; }
    const pace = (i) => { const s = samples[i]; return s.kind === 'lane' ? [s.slow ? SLOW : FAST, ACCEL] : PACE[s.kind] || PACE.ahead; };
    const n = samples.length; const v = new Array(n).fill(Infinity); v[0] = 0; v[n - 1] = 0;
    for (let i = 1; i < n - 1; i += 1) { if (groupOf(samples[i].kind) !== groupOf(samples[i + 1].kind)) v[i] = 0; else v[i] = Math.min(pace(i)[0], pace(i + 1)[0]); }
    for (let i = 1; i < n; i += 1) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * pace(i)[1] * (samples[i].d - samples[i - 1].d)));
    for (let i = n - 2; i >= 0; i -= 1) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * pace(i + 1)[1] * (samples[i + 1].d - samples[i].d)));
    samples[0].t = 0; for (let i = 1; i < n; i += 1) { const ds = samples[i].d - samples[i - 1].d; const avg = (v[i - 1] + v[i]) / 2; samples[i].t = samples[i - 1].t + (avg > 1e-3 ? ds / avg : 2 * Math.sqrt(ds / pace(i)[1])) * 1000; }
    return { samples, ms: samples[n - 1].t, length: d };
  }
  const chaikin = (pts) => { let p = pts; for (let pass = 0; pass < 4; pass += 1) { /* (409: four passes -- the turn onto 별마루섬's way in kinked 30° between metres with two) */ const r = [p[0]]; for (let i = 0; i < p.length - 1; i += 1) { const [ax, az] = p[i]; const [bx, bz] = p[i + 1]; if (i > 0) r.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]); if (i < p.length - 2) r.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } r.push(p[p.length - 1]); p = r; } return p; };
  const paths = new Map();
  /* a crossing: off its berth (0 / 1 ahead, 2 the empty third's way back), the lane on this way's right (its dock-end points left out, none within 12 m
     of where the berth's ways meet it), into the other side's unloading berth ahead (bTo 2) or to its waiting spot on that way (bTo -1) */
  function pathOf(from, bFrom, to, bTo) {
    const key = `${from}:${bFrom}>${to}:${bTo}`; if (paths.has(key)) return paths.get(key);
    const A = placed(from, TEMPLATES.out[bFrom >= 0 && bFrom < 3 ? bFrom : 0]); const inn = placed(to, TEMPLATES.in); const Bw = bTo === UNLOAD_BERTH ? inn : [inn[0]];
    const j0 = A[A.length - 1]; const j1 = Bw[0]; const ahead = (p, m) => [p.x + Math.sin(p.yaw) * m, p.z + Math.cos(p.yaw) * m];
    /* (no lane point within GAP m of where a berth's way meets it, and LEAD m straight on from / into it: the lane's last points near 별마루섬 lay
       behind the new way in, a zigzag of 135° turned in a few metres) */
    const GAP = 25; const LEAD = 12;
    const mid = laneSide(from === 'dal' ? 1 : -1).slice(1, -1).filter(([x, z]) => Math.hypot(x - j0.x, z - j0.z) > GAP && Math.hypot(x - j1.x, z - j1.z) > GAP);
    const pts = chaikin([[j0.x, j0.z], ahead(j0, LEAD), ...mid, ahead(j1, -LEAD), [j1.x, j1.z]]); const lane = [];
    for (let i = 1; i < pts.length; i += 1) { const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i]; const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L)); for (let k = 1; k <= n; k += 1) { const x = ax + ((bx - ax) * k) / n; const z = az + ((bz - az) * k) / n; lane.push({ x, z, kind: 'lane', slow: Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < BRIDGE.r }); } }
    lane.pop(); /* (its last the way in's first) */ const all = [j0, ...lane, Bw[0]]; /* (the lane's bow by the way 1.5 m either side -- round its corners, never off it by 15°) */
    for (let i = 1; i < all.length - 1; i += 1) { const a = all[i - 1]; const b = all[i + 1]; const k = Math.hypot(b.x - a.x, b.z - a.z) > 0.5 ? 1 : 2; const a2 = all[Math.max(0, i - k)]; const b2 = all[Math.min(all.length - 1, i + k)]; all[i].yaw = Math.atan2(b2.x - a2.x, b2.z - a2.z); }
    const out = { key, ...timed([...A, ...lane, ...Bw].map((s, i) => ({ ...s, kind: i === A.length + lane.length ? 'ahead' : s.kind }) /* (the way in's first: still going ahead, no stop where the lane meets it) */)), endYaw: Bw[Bw.length - 1].yaw, clearMs: 0, inMs: Infinity }; out.clearMs = out.samples[A.length - 1].t; if (bTo === UNLOAD_BERTH) out.inMs = out.samples[A.length + lane.length].t; paths.set(key, out); return out;
  }
  const moorPath = (id) => { const key = `moor:${id}`; if (!paths.has(key)) paths.set(key, { key, ...timed(placed(id, TEMPLATES.in)) }); return paths.get(key); };
  const shiftPath = (id, k) => { const key = `shift:${id}:${k}`; if (!paths.has(key)) paths.set(key, { key, ...timed(placed(id, TEMPLATES.shift[k])) }); return paths.get(key); };
  function alongPath(p, ms) {
    const S = p.samples; const i = ms <= 0 ? 0 : ms >= p.ms ? S.length - 1 : -1;
    if (i >= 0) return { x: S[i].x, z: S[i].z, yaw: S[i].yaw, kind: S[Math.max(1, i)].kind };
    let lo = 0; let hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].t <= ms) lo = m; else hi = m; }
    const a = S[lo]; const b = S[hi]; const k = (ms - a.t) / (b.t - a.t || 1);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + wrap(b.yaw - a.yaw) * k, kind: b.kind };
  }
  /* (the wake only going ahead -- not astern, not sideways: dock-maneuver §4 화면) */
  const along = (p, ms) => { const q = alongPath(p, ms); return { x: q.x, z: q.z, yaw: q.yaw, moving: ms < p.ms, wake: q.kind === 'ahead' || q.kind === 'lane' }; };
  function poseAt(boat, now, scale = 1) {
    const ms = (now - boat.t0) * scale; const berthPose = (dock, k) => { const b = k >= 0 ? DOCKS[dock].berths[k] : DOCKS[dock].offshore; return { x: b.x, z: b.z, yaw: b.yaw, moving: false, wake: false }; };
    if (boat.phase === 'sail') return along(pathOf(boat.from, boat.berthFrom, boat.to, boat.berthTo), ms);
    if (boat.phase === 'moor') return along(moorPath(boat.at), ms);
    if (boat.phase === 'shift') return along(shiftPath(boat.at, boat.berth), ms);
    if (boat.phase === 'wait') return berthPose(boat.at, -1);
    return DOCKS[boat.at] ? berthPose(boat.at, boat.berth) : { x: 0, z: 0, yaw: 0, moving: false, wake: false };
  }
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
  /* (1.10.409 결정 75: the berths held -- a boat at one, on its way to one, mooring into the unloading one, or shifting (its new one and the unloading
     one it backs out of, the water in front of the dock its own till it is in)) */
  const usedBerths = (fleet, dock, except) => { const used = new Set(); for (const b of fleet.boats) { if (b === except) continue;
    if (b.phase === 'sail') { if (b.to === dock && b.berthTo >= 0) used.add(b.berthTo); continue; } if (b.at !== dock || b.phase === 'wait' || b.berth < 0) continue; used.add(b.berth); if (b.phase === 'shift') used.add(UNLOAD_BERTH); }
    return used; };
  const freeBerth = (fleet, dock, except) => (usedBerths(fleet, dock, except).has(UNLOAD_BERTH) ? -1 : UNLOAD_BERTH); /* (arrivals: always the unloading berth, else the waiting spot) */
  /* (an empty boat off the unloading berth: the inner boarding berth first, the outer if the inner is taken -- none while the outer is: the inner's way
     in and out passes it) */
  const shiftTarget = (fleet, dock, b) => { const used = usedBerths(fleet, dock, b); return used.has(OUTER) ? -1 : used.has(INNER) ? OUTER : INNER; };
  // the water in front of a dock one boat's at a time (1.10.434 Codex P2-20): leaving, shifting, mooring, and final approach share one dock-water reservation
  const leaving = (fleet, dock, b, now) => fleet.boats.some((o) => o !== b && o.phase === 'sail' && o.from === dock && now < (o.clearAt ?? 0));
  const shifting = (fleet, dock, b) => fleet.boats.some((o) => o !== b && o.at === dock && o.phase === 'shift');
  const mooring = (fleet, dock, b) => fleet.boats.some((o) => o !== b && o.at === dock && o.phase === 'moor');
  const arriving = (fleet, dock, b, now) => fleet.boats.some((o) => o !== b && o.phase === 'sail' && o.to === dock && o.berthTo === UNLOAD_BERTH && now >= (o.inAt ?? Infinity));
  const dockWaterBusy = (fleet, dock, b, now) => leaving(fleet, dock, b, now) || shifting(fleet, dock, b) || mooring(fleet, dock, b) || arriving(fleet, dock, b, now);
  const busyForShift = (fleet, dock, b, now) => dockWaterBusy(fleet, dock, b, now) || fleet.boats.some((o) => o !== b && o.at === dock && (o.phase === 'hold' || o.phase === 'back'));
  const busyForLeave = (fleet, dock, b, now) => dockWaterBusy(fleet, dock, b, now);
  const busyForMoor = (fleet, dock, b, now) => dockWaterBusy(fleet, dock, b, now);
  function depart(fleet, b, now) { b.from = b.at; b.to = DOCKS[b.at].other; b.berthFrom = b.berth; b.berthTo = freeBerth(fleet, b.to, b); b.phase = 'sail'; b.t0 = now; b.at = null; b.berth = -1; const p = pathOf(b.from, b.berthFrom, b.to, b.berthTo); b.until = now + p.ms / fleet.scale; b.clearAt = now + p.clearMs / fleet.scale; b.inAt = Number.isFinite(p.inMs) ? now + p.inMs / fleet.scale : Infinity; }
  /* (boardable: the outer boarding berth's boat first; the inner's only while the outer is empty and nothing shifting into it -- its way out passes
     there. Never one at the unloading berth: a rider's boat never backs out) */
  const boardable = (fleet, dock) => fleet.boats.filter((b) => b.at === dock && (b.phase === 'hold' || b.phase === 'docked') && (b.berth === OUTER || (b.berth === INNER && !usedBerths(fleet, dock, b).has(OUTER)))).sort((a, c) => a.berth - c.berth);
  // board at a dock: a boat holding there with room, else one staying (it starts holding) -- or the queue
  function board(fleet, dock, token, now) {
    if (!DOCKS[dock]) return { error: 'BAD_DOCK' }; if (riderOf(fleet, token)) return { error: 'RIDING' };
    const here = boardable(fleet, dock);
    const pick = here.find((b) => b.phase === 'hold' && freeSeats(b)) || here.find((b) => b.phase === 'docked');
    if (!pick) { const q = fleet.queues[dock]; if (!q.some((e) => e.token === token)) q.push({ token, at: now }); return { queued: true, place: q.findIndex((e) => e.token === token) + 1, etaMs: etaOf(fleet, dock, now) }; }
    const seat = pick.seats.indexOf(null); pick.seats[seat] = token; if (pick.phase === 'docked') { pick.phase = 'hold'; pick.until = now + HOLD / fleet.scale; }
    if (!freeSeats(pick) && !busyForLeave(fleet, dock, pick, now)) depart(fleet, pick, now); /* (full: off now, unless the water before the dock is another's -- then at the next tick) */
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
  /* (1.10.409 결정 75: an empty boat at the unloading berth -- `parked` till the water before the dock is free, then it shifts to a boarding berth
     (inner first), or, when the outer one's taken, goes straight back across (`back`, empty: a rider's boat never backs out)) */
  const rest = (fleet, b, now) => { b.phase = 'parked'; b.until = 0; b.t0 = now; };
  const shiftMsOf = (dock, k, S) => shiftPath(dock, k).ms / S;
  // when a boat will next take people at a dock (ms from now): one at a boarding berth now 0, one shifting there when it is in, one at the
  // unloading berth or on its way once it has shifted, else one at the other dock: across and back
  function etaOf(fleet, dock, now) {
    let best = Infinity; const S = fleet.scale; const shift = shiftMsOf(dock, INNER, S); const cross = pathOf(DOCKS[dock].other, OUTER, dock, UNLOAD_BERTH).ms / S;
    if (boardable(fleet, dock).some((b) => freeSeats(b))) return 0; /* (a full one holding till the water before the dock is free: not for them) */
    for (const b of fleet.boats) {
      if (b.at === dock && b.phase === 'shift') best = Math.min(best, b.until - now);
      if (b.at === dock && (b.phase === 'unload' || b.phase === 'moor')) best = Math.min(best, Math.max(0, b.until - now) + (b.phase === 'moor' ? UNLOAD / S : 0) + shift);
      if (b.at === dock && b.phase === 'parked') best = Math.min(best, shift);
      if (b.at === dock && b.phase === 'wait') best = Math.min(best, moorPath(dock).ms / S + UNLOAD / S + shift);
      if (b.phase === 'sail' && b.to === dock) best = Math.min(best, b.until - now + (b.seats.some(Boolean) ? UNLOAD / S : 0) + shift);
      if (b.phase === 'sail' && b.from === dock) best = Math.min(best, b.until - now + UNLOAD / S + shiftMsOf(b.to, INNER, S) + HOLD / S + cross + shift);
    }
    return Number.isFinite(best) ? Math.max(0, Math.round(best)) : Math.round(HOLD / S + cross + shift);
  }
  // the fleet's clock moved on: holds run out, crossings end, unloading ends; the queues boarded where a boat now takes people.
  // canBoard(token, dock): still there for it (the server's own look: on the island, near the float). Returns what changed.
  function tick(fleet, now, { canBoard = () => true } = {}) {
    const out = { changed: false, released: [], boarded: [] };
    for (let guard = 0; guard < 12; guard += 1) {
      let moved = false;
      for (const b of fleet.boats) {
        if (b.phase === 'hold' && (now >= b.until || !freeSeats(b)) && !busyForLeave(fleet, b.at, b, now)) { depart(fleet, b, now); moved = true; continue; }
        if (b.phase === 'back' && !busyForLeave(fleet, b.at, b, now)) { depart(fleet, b, now); moved = true; continue; }
        if (b.phase === 'parked' && !busyForShift(fleet, b.at, b, now)) { const k = shiftTarget(fleet, b.at, b);
          if (k >= 0) { b.phase = 'shift'; b.berth = k; b.t0 = now; b.until = now + shiftMsOf(b.at, k, fleet.scale); } else b.phase = 'back'; moved = true; continue; }
        if (b.phase === 'shift' && now >= b.until) { b.phase = 'docked'; b.until = 0; moved = true; continue; }
        if (b.phase === 'sail' && now >= b.until) {
          b.at = b.to; b.berth = b.berthTo; const riders = b.seats.some(Boolean); const arrive = b.until;
          if (b.berth < 0) { b.phase = 'wait'; b.t0 = arrive; } else if (riders) { b.phase = 'unload'; b.until = arrive + UNLOAD / fleet.scale; } else rest(fleet, b, arrive);
          moved = true; continue;
        }
        /* (the waiting spot is on the unloading berth's way in: in ahead once the berth and dock water are free -- 434 P2-20) */
        if (b.phase === 'wait') { if (freeBerth(fleet, b.at, b) === UNLOAD_BERTH && !busyForMoor(fleet, b.at, b, now)) { b.berth = UNLOAD_BERTH; b.phase = 'moor'; b.t0 = now; b.until = now + moorPath(b.at).ms / fleet.scale; moved = true; } continue; }
        if (b.phase === 'moor' && now >= b.until) { if (b.seats.some(Boolean)) { b.phase = 'unload'; b.until += UNLOAD / fleet.scale; } else rest(fleet, b, now); moved = true; continue; }
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
        while (q.length) { const b = boardable(fleet, dock).find((x) => (x.phase === 'hold' && freeSeats(x)) || x.phase === 'docked'); if (!b) break;
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
    const holding = here.filter((b) => b.phase === 'hold').sort((a, b) => a.until - b.until)[0];
    if (holding) return `곧 출발 · ${Math.max(0, Math.ceil((holding.until - now) / 1000))}초`;
    const ready = here.filter((b) => b.phase === 'docked' && (b.berth === OUTER || b.berth === INNER)).length; if (ready) return `탐방선 · 배 ${ready}척`; /* (409: at the boarding berths -- not one parked at the unloading one) */
    const eta = Math.max(0, Math.ceil(((v.eta?.[dock] ?? 0) - (now - v.at)) / 1000));
    return `배 오는 중 · ${eta}초${myPlace ? ` · 내 순서 ${myPlace}번째` : ''}`;
  }
  return { SEATS, HOLD, UNLOAD, MOOR, FAST, SLOW, BOATS, BRIDGE, SIDE, LANE, DOCKS, NODES, SEAT_DROP, worldOf, seatAt, captainAt, exitOf, nearDock, laneSide, pathOf, poseAt, sailMs,
    ROOTS, MODEL, OUTER, INNER, UNLOAD_BERTH, moorPath, shiftPath, boardable, shiftTarget, /* (409 결정 75) */
    createFleet, riderOf, countAt, freeBerth, board, leave, drop, etaOf, tick, view, signOf };
}));
