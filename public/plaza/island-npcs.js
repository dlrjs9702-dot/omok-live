// v1.10.12 게임 아일랜드 배회 NPC (비공개 IDEAS 「서버 공용 랜덤 이벤트」 중 일반 배회 NPC 약 10명): islanders who stroll from
// place to place along the walks, stop for a while, and go on. Nothing about them is sent over the network: each one's
// round is worked out from a fixed seed on the island's own map (the same file in the browser and on the server), and
// where they are at a moment is a pure function of the server clock -- so every screen shows them in the same places.
// A round is a loop through 5–7 stopping places (never straight back the way they came), found with A* on a coarse
// grid that keeps off water, cliffs, buildings, trees and the plaza fountain, and prefers the walks.
// They are kept apart from event NPCs (lib/island-events.js): their state here is only where they walk.
(function (root, factory) {
  const terrain = typeof module === 'object' && module.exports ? require('./island-terrain.js') : root.IslandTerrain;
  const api = factory(terrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandNpcs = api;
}(typeof self !== 'undefined' ? self : this, (T) => {
  const COUNT = 10; // IDEAS: about 10
  const CELL = 1.5; const EXTENT = 120; const N = Math.round((EXTENT * 2) / CELL);
  const MARGIN = 1.1; // more than half a cell's diagonal: every point of a free cell is standable
  const STOP_MIN = 3; const STOP_MAX = 9; // seconds standing at each stopping place
  const LOOKS = [ // shirt, hair, skin, hat (null = none)
    [0xf4a261, 0x3d2b1f, 0xffdcbc, null], [0x8ecae6, 0x6b4a2b, 0xffe0c4, 0xffffff], [0xb5838d, 0x2b2b2b, 0xf1c9a5, null],
    [0x90be6d, 0x8b5a2b, 0xffdcbc, 0xf2c14e], [0xe76f51, 0xd9d4cc, 0xf1c9a5, null], [0x6d6875, 0x3d2b1f, 0xffe0c4, 0x2b2b2b],
    [0xffb4a2, 0x6b4a2b, 0xffdcbc, null], [0x2a9d8f, 0x2b2b2b, 0xf1c9a5, 0xe9c46a], [0xcdb4db, 0x8b5a2b, 0xffe0c4, null],
    [0xffd166, 0x3d2b1f, 0xffdcbc, 0x118ab2],
  ];

  const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const BUILDING_R = { cottage: 3.9, hall: 13, shop: 3.4, house: 3.4, office: 3.4, townhall: 3.4, tower: 3.5, gazebo: 3.2, board: 1.6, npc: 1.6, desk: 1.6, stall: 1.8, donation: 1.4, mapboard: 1.4 };

  // On a bridge deck, with a little room (a bridge is a way over its stream).
  // the whole cell (its centre and corners) on the deck, so a path through it never clips the water at the side
  const onAnyBridge = (x, z) => [[0, 0], [-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].every(([dx, dz]) => T.onBridge(x + dx, z + dz));
  const cellOf = (x, z) => [Math.floor((x + EXTENT) / CELL), Math.floor((z + EXTENT) / CELL)];
  const centre = (i, j) => ({ x: -EXTENT + (i + 0.5) * CELL, z: -EXTENT + (j + 0.5) * CELL });
  let grid = null; // Uint8Array: 0 free, 1 blocked; and the cost of stepping on each cell
  function buildGrid() {
    if (grid) return grid;
    const blocked = new Uint8Array(N * N); const cost = new Float32Array(N * N);
    const solids = T.natureSolids();
    const near = new Map(); // a coarse bucket of the nature solids
    for (const s of solids) { const k = `${Math.floor(s.x / 6)},${Math.floor(s.z / 6)}`; if (!near.has(k)) near.set(k, []); near.get(k).push(s); }
    const spots = T.BUILDINGS; // v1.10.13: the cottages too
    const props = T.plazaProps();
    const sceneProps = [...props.benches, ...props.lamps, ...props.beds, ...T.RESERVED_LOTS.map((l) => ({ x: l.x, z: l.z, r: 3.2 }))];
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
      const x = -EXTENT + (i + 0.5) * CELL; const z = -EXTENT + (j + 0.5) * CELL; const id = j * N + i;
      let bad = T.coastDist(x, z) < 2.2 + T.cliffAt(x, z) * 1.2 + MARGIN || Math.hypot(x - T.POND.x, z - T.POND.z) < T.POND.r + 0.2 + MARGIN || Math.hypot(x, z) < 4.4;
      if (!bad) for (const s of spots) if (Math.hypot(x - s.x, z - s.z) < (BUILDING_R[s.kind] || 2)) { bad = true; break; }
      if (!bad) for (const s of T.STATUE_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 1.9) { bad = true; break; }
      // v1.10.16: the plaza's benches, lamps and flower beds and the shop street's reserved lot, as the scene places them.
      // Measured to the whole cell, not its centre: a lamp on a cell corner would otherwise leave all four cells round it
      // free and a diagonal step straight through it; this way every step between free cells keeps 0.5 clear.
      if (!bad) for (const s of sceneProps) {
        const dx = Math.max(0, Math.abs(x - s.x) - CELL / 2); const dz = Math.max(0, Math.abs(z - s.z) - CELL / 2);
        if (Math.hypot(dx, dz) < s.r + 0.5) { bad = true; break; }
      }
      if (!bad) for (let a = -1; a <= 1 && !bad; a += 1) for (let b = -1; b <= 1 && !bad; b += 1) for (const s of near.get(`${Math.floor(x / 6) + a},${Math.floor(z / 6) + b}`) || []) if (Math.hypot(x - s.x, z - s.z) < s.r + 0.5) { bad = true; break; }
      blocked[id] = bad ? 1 : 0;
      cost[id] = 2.4;
    }
    for (const curve of T.streamCurves) for (const [x, z] of curve) { // the streams (bridges stay open)
      const reach = T.STREAM_HALF + 0.25 + MARGIN + 0.6; const [i0, j0] = cellOf(x - reach, z - reach); const [i1, j1] = cellOf(x + reach, z + reach);
      for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j += 1) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i += 1) {
        const c = centre(i, j); if (T.streamDist(c.x, c.z) < T.STREAM_HALF + 0.25 + MARGIN && !onAnyBridge(c.x, c.z)) blocked[j * N + i] = 1;
      }
    }
    for (const w of T.walkCurves) for (const [x, z] of w.pts) { // the walks are preferred (cheaper to step on)
      const r = w.w / 2; const [i0, j0] = cellOf(x - r, z - r); const [i1, j1] = cellOf(x + r, z + r);
      for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j += 1) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i += 1) {
        const c = centre(i, j); if (Math.hypot(c.x - x, c.z - z) <= r + 0.2) cost[j * N + i] = 1;
      }
    }
    grid = { blocked, cost };
    return grid;
  }
  const free = (i, j) => i >= 0 && j >= 0 && i < N && j < N && !grid.blocked[j * N + i];

  // A* over the grid (8 directions, no corner cutting), then the corners cut where the straight line stays clear.
  function findPath(a, b) {
    buildGrid();
    const [si, sj] = cellOf(a.x, a.z); const [ti, tj] = cellOf(b.x, b.z);
    if (!free(si, sj) || !free(ti, tj)) return null;
    const start = sj * N + si; const goal = tj * N + ti;
    const g = new Float32Array(N * N).fill(Infinity); const from = new Int32Array(N * N).fill(-1); const closed = new Uint8Array(N * N);
    const heap = []; // [f, id]
    const push = (f, id) => { heap.push([f, id]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1; const r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    g[start] = 0; push(0, start);
    while (heap.length) {
      const [, id] = pop();
      if (closed[id]) continue;
      if (id === goal) break;
      closed[id] = 1;
      const i = id % N; const j = (id - i) / N;
      for (let dj = -1; dj <= 1; dj += 1) for (let di = -1; di <= 1; di += 1) {
        if (!di && !dj) continue;
        const ni = i + di; const nj = j + dj;
        if (!free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
        const nid = nj * N + ni; const step = (di && dj ? Math.SQRT2 : 1) * grid.cost[nid];
        if (g[id] + step < g[nid]) { g[nid] = g[id] + step; from[nid] = id; push(g[nid] + Math.hypot(ti - ni, tj - nj), nid); }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const cells = []; for (let id = goal; id >= 0; id = from[id]) { cells.push(id); if (id === start) break; }
    cells.reverse();
    const pts = cells.map((id) => centre(id % N, Math.floor(id / N)));
    pts[0] = { x: a.x, z: a.z }; pts[pts.length - 1] = { x: b.x, z: b.z };
    return smoothPath(pts);
  }
  function clearLine(p, q) {
    const d = Math.hypot(q.x - p.x, q.z - p.z); const n = Math.ceil(d / 0.4);
    for (let k = 1; k < n; k += 1) { const t = k / n; const x = p.x + (q.x - p.x) * t; const z = p.z + (q.z - p.z) * t; const [i, j] = cellOf(x, z); if (!free(i, j)) return false; }
    return true;
  }
  function smoothPath(pts) {
    const out = [pts[0]]; let k = 0;
    while (k < pts.length - 1) {
      let far = k + 1;
      for (let m = Math.min(pts.length - 1, k + 12); m > k + 1; m -= 1) if (clearLine(pts[k], pts[m])) { far = m; break; } // stays near the walk: short shortcuts only
      out.push(pts[far]); k = far;
    }
    return out;
  }

  // Stopping places: points on the walks, clear of the grid's blocks and well away from every building door.
  let stops = null;
  function stopPlaces() {
    if (stops) return stops;
    buildGrid();
    stops = [];
    for (const w of T.walkCurves) for (let i = 4; i < w.pts.length; i += 9) {
      const [x, z] = w.pts[i];
      const [ci, cj] = cellOf(x, z);
      if (!free(ci, cj) || Math.hypot(x, z) < T.PLAZA_R + 2) continue;
      if (Object.values(T.SPOTS).some((s) => Math.hypot(x - s.x, z - s.z) < 8)) continue;
      if (stops.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
      stops.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
    }
    return stops;
  }

  // One islander's round: legs between stopping places and the time each part takes. Cached.
  const rounds = new Map();
  function round(n) {
    if (rounds.has(n)) return rounds.get(n);
    const rnd = seeded(0x5eed1 + n * 7919);
    const places = stopPlaces();
    const speed = 1.25 + rnd() * 0.5;
    const route = [places[Math.floor(rnd() * places.length)]];
    for (let guard = 0; route.length < 5 + Math.floor(rnd() * 3) && guard < 400; guard += 1) {
      const last = route[route.length - 1]; const before = route[route.length - 2];
      const next = places[Math.floor(rnd() * places.length)];
      const d = Math.hypot(next.x - last.x, next.z - last.z);
      if (d < 14 || d > 55 || route.includes(next)) continue;
      if (before && Math.hypot(next.x - before.x, next.z - before.z) < 10) continue; // never straight back
      if (!findPath(last, next)) continue; // across water with no bridge near: somewhere else
      route.push(next);
    }
    const parts = []; let t = 0;
    for (let k = 0; k < route.length; k += 1) {
      const a = route[k]; const b = route[(k + 1) % route.length];
      const stop = STOP_MIN + rnd() * (STOP_MAX - STOP_MIN);
      parts.push({ t0: t, t1: t + stop, pts: [a], moving: false }); t += stop;
      const path = findPath(a, b) || findPath(b, a)?.slice().reverse() || [a, a];
      for (let m = 0; m < path.length - 1; m += 1) {
        const p = path[m]; const q = path[m + 1]; const len = Math.hypot(q.x - p.x, q.z - p.z);
        if (len < 1e-6) continue;
        parts.push({ t0: t, t1: t + len / speed, pts: [p, q], moving: true }); t += len / speed;
      }
    }
    const look = LOOKS[n % LOOKS.length];
    const r = { period: t, parts, speed, look: { shirt: look[0], hair: look[1], skin: look[2], hat: look[3] }, phase: rnd() * t };
    rounds.set(n, r);
    return r;
  }
  // Where islander n is at server time `ms`: { x, z, yaw, moving }.
  function at(n, ms) {
    const r = round(n);
    const t = (((ms / 1000 + r.phase) % r.period) + r.period) % r.period;
    let lo = 0; let hi = r.parts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (r.parts[mid].t0 <= t) lo = mid; else hi = mid - 1; }
    const part = r.parts[lo];
    if (!part.moving) { // standing: facing the way they will walk next
      const next = r.parts[(lo + 1) % r.parts.length]; const p = part.pts[0]; const q = next.pts[1] || next.pts[0];
      return { x: p.x, z: p.z, yaw: Math.atan2(q.x - p.x, q.z - p.z), moving: false };
    }
    const [p, q] = part.pts; const k = (t - part.t0) / (part.t1 - part.t0);
    return { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k, yaw: Math.atan2(q.x - p.x, q.z - p.z), moving: true };
  }

  // v1.10.16 이동 현실화: how the islanders are drawn walking on a screen. The shared round (`at`) stays the plan every
  // screen agrees on; what is drawn is that point plus a small local offset, which only grows to step around what the
  // coarse route grid does not know (benches, flower beds, a fence, a lamp), around each other and around people, and
  // shrinks back to the route by itself (RETURN per second) -- so it never builds up, and screens drift apart only while
  // something is being avoided. Every move is swept in short steps through the scene's real collision circles and kept
  // on standable ground, so a slow frame cannot tunnel through a thin prop and no push ever lands in water or a wall.
  // `solidsNear(x, z)` gives the circles {x, z, r} that may touch a character standing at (x, z).
  // WARP: a target further than this from where it is drawn cannot come from walking (a frame moves the target less
  // than 0.5 even mid-avoidance); it means a paused tab, and the islander is put straight back on its round.
  // MAX_OFF: stuck in a pocket further than this from the round (props packed together) -- put back on the round.
  // TOP: the fastest an islander is ever drawn going (catching up with its round after stepping round something: a jog)
  const WALKER = { R: 0.42, SEP: 0.9, SWEEP: 0.22, RETURN: 2.5, WARP: 1.5, MAX_OFF: 5, TOP: 4 };
  function createWalkers({ walkable, solidsNear }) {
    const { R, SEP, SWEEP, RETURN, WARP, MAX_OFF, TOP } = WALKER;
    // out of every circle it stands in; a point can be in two (a fence next to a tree), so settle a few times
    function pushOut(x, z, r = R) {
      for (let pass = 0; pass < 3; pass += 1) {
        let changed = false;
        for (const s of solidsNear(x, z)) {
          let dx = x - s.x; let dz = z - s.z; let d = Math.hypot(dx, dz); const min = s.r + r;
          if (d >= min) continue;
          if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
          x = s.x + (dx / d) * min; z = s.z + (dz / d) * min; changed = true;
        }
        if (!changed) break;
      }
      return [x, z];
    }
    // inside no circle (with a hair of tolerance)
    const clear = (x, z) => solidsNear(x, z).every((s) => Math.hypot(x - s.x, z - s.z) >= s.r + R - 0.01);
    const free = (x, z) => walkable(x, z) && clear(x, z);
    // a short walk from (px, pz) toward (nx, nz): sampled every SWEEP and pushed out of the circles at each sample.
    // A sample still not free (water, coast, cliff, or wedged where two circles meet) first tries keeping one axis,
    // then the same step turned 45 and 90 degrees either way -- sliding along the edge and round the end of a group of
    // props -- and otherwise the walk stops at the last free point for this frame.
    const TURNS = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    function move(px, pz, nx, nz) {
      const count = Math.max(1, Math.ceil(Math.hypot(nx - px, nz - pz) / SWEEP));
      const sx = (nx - px) / count; const sz = (nz - pz) / count; const len = Math.hypot(sx, sz);
      let x = px; let z = pz; const stuck = !free(px, pz); // already inside (just placed): any way out is taken
      // a way round counts only if it really gets somewhere (a push straight back into the same corner does not)
      const usable = (p) => free(p[0], p[1]) && Math.hypot(p[0] - x, p[1] - z) > len * 0.3;
      for (let k = 1; k <= count; k += 1) {
        let [tx, tz] = pushOut(x + sx, z + sz);
        if (!free(tx, tz)) {
          let found = null;
          for (const [cx, cz] of [[x + sx, z], [x, z + sz]]) { const p = pushOut(cx, cz); if (usable(p)) { found = p; break; } }
          for (let i = 0; !found && i < TURNS.length; i += 1) {
            const c = Math.cos(TURNS[i]); const s = Math.sin(TURNS[i]);
            const p = pushOut(x + sx * c - sz * s, z + sx * s + sz * c); if (usable(p)) found = p;
          }
          if (found) [tx, tz] = found; else if (!stuck) break;
        }
        x = tx; z = tz;
      }
      return [x, z];
    }
    const list = [];
    // a new islander starts where its round has it now (not at the origin, walking over to it)
    function add(n, ms) {
      const pose = at(n, ms); const [x, z] = pushOut(pose.x, pose.z);
      const w = { n, x, z, px: x, pz: z, bx: pose.x, bz: pose.z, pose, speed: 0, heading: null };
      list.push(w); return w;
    }
    // One frame. `people` are other circles to give way to ({x, z, r}: me, other players, event visitors).
    let resyncs = 0; // times an islander was put back on its round (a paused tab, or stuck)
    let lastMs = null;
    function step(ms, frameDt, people = []) {
      // the time that really passed on the server clock the rounds run on (a scene caps its frame step for animation;
      // on a slow PC that cap would leave the islanders falling ever further behind their rounds)
      const dt = lastMs === null ? frameDt : Math.min(1, Math.max(0, (ms - lastMs) / 1000)); lastMs = ms;
      const keep = Math.exp(-RETURN * dt);
      for (const w of list) { // 1) the shared route, plus what is left of the offset
        const pose = at(w.n, ms); w.px = w.x; w.pz = w.z;
        let tx = pose.x + (w.x - w.bx) * keep; let tz = pose.z + (w.z - w.bz) * keep;
        const want = Math.hypot(tx - w.x, tz - w.z);
        w.warped = want > WARP || Math.hypot(w.x - w.bx, w.z - w.bz) > MAX_OFF; // a long pause (a hidden tab), or stuck: back on the round at once
        if (want > TOP * dt) { tx = w.x + ((tx - w.x) * TOP * dt) / want; tz = w.z + ((tz - w.z) * TOP * dt) / want; } // never faster than a jog
        if (w.warped) { [w.x, w.z] = pushOut(pose.x, pose.z); w.speed = 0; resyncs += 1; } else [w.x, w.z] = move(w.x, w.z, tx, tz);
        w.bx = pose.x; w.bz = pose.z; w.pose = pose;
      }
      for (let pass = 0; pass < 3; pass += 1) { // 2) apart from each other, in a fixed order
        for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i]; const b = list[j];
          const dx = a.x - b.x; const dz = a.z - b.z; let d = Math.hypot(dx, dz);
          if (d >= SEP) continue;
          let ux; let uz;
          if (d < 1e-5) { const angle = ((a.n * 17 + b.n * 31) % 16) * (Math.PI / 8); ux = Math.cos(angle); uz = Math.sin(angle); d = 0; } else { ux = dx / d; uz = dz / d; }
          const shift = (SEP - d) / 2 + 0.005;
          // pushed straight apart, two meeting head-on on a walk would only shove each other back; whoever has the other
          // ahead of them also steps to their own right -- meeting, both do and pass; following, the one behind overtakes
          const [ra, rb] = [[a, b], [b, a]].map(([me, other]) => {
            if (!me.pose.moving) return [0, 0];
            const hx = Math.sin(me.pose.yaw); const hz = Math.cos(me.pose.yaw);
            return hx * (other.x - me.x) + hz * (other.z - me.z) > 0 ? [hz * shift, -hx * shift] : [0, 0];
          });
          [a.x, a.z] = move(a.x, a.z, a.x + ux * shift + ra[0], a.z + uz * shift + ra[1]);
          // b takes whatever a could not (a against a wall or a prop): the pair still ends SEP apart where there is room
          const left = SEP + 0.005 - Math.hypot(a.x - b.x, a.z - b.z);
          if (left > 0) [b.x, b.z] = move(b.x, b.z, b.x - ux * left + rb[0], b.z - uz * left + rb[1]);
        }
      }
      for (const w of list) for (const o of people) { // 3) out of people's way
        let dx = w.x - o.x; let dz = w.z - o.z; let d = Math.hypot(dx, dz); const min = R + o.r;
        if (d >= min) continue;
        if (d < 1e-5) { dx = 1; dz = 0; d = 1; }
        [w.x, w.z] = move(w.x, w.z, o.x + (dx / d) * min, o.z + (dz / d) * min);
      }
      for (const w of list) { // the drawn pace and heading pick the walk and the facing
        if (w.warped) continue;
        const moved = Math.hypot(w.x - w.px, w.z - w.pz); const v = dt > 0 ? moved / dt : 0;
        w.speed += (v - w.speed) * Math.min(1, dt * 10);
        if (moved > dt * 0.3) w.heading = Math.atan2(w.x - w.px, w.z - w.pz);
      }
    }
    return { list, add, step, pushOut, move, clear, resyncs: () => resyncs };
  }

  return { COUNT, WALKER, round, at, findPath, stopPlaces, buildGrid, createWalkers, free: (x, z) => { buildGrid(); const [i, j] = cellOf(x, z); return free(i, j); } };
}));
