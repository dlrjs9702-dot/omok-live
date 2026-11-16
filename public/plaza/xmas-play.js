// 1.10.334 크리스마스 3 ② (gamecenter-notes docs/christmas-boost-20261115.md P2·P3, 사용자 18A·95A·96A·97A, assets 128): the
// sled hill on the grass south of 대청마당 and the two snow forts facing each other between it and the snow field -- set out
// only in the Christmas festival. The hill: 「썰매 타기」 at its foot puts one at the start on top, then down its track (the
// track's height, a run timed once by the slope); the forts: snowballs thrown with no score, a hit knocks the one hit and
// leaves snow on them, five throws a round (the stamp 「눈싸움 한 판」 once a day). The numbers both screens and the server
// share. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XmasPlay = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // the hill (assets 128 hill.json): its foot at `at`, its top the model's +Z (yaw: the model's +Z at world (sin, cos)); the
  // track's height every 0.4 m of z from the start (z 9.6) down to the foot (z 0), the run-out on the ground beyond it
  const HILL = Object.freeze({ at: Object.freeze({ x: -17, z: -115.5, yaw: Math.PI / 2 }), startZ: 9.6, step: 0.4, len: 12.5, half: 2.8, run: 6,
    y: Object.freeze([2.5, 2.5, 2.5, 2.499, 2.475, 2.422, 2.342, 2.24, 2.118, 1.978, 1.826, 1.662, 1.491, 1.316, 1.14, 0.965, 0.796, 0.635, 0.485, 0.35, 0.232, 0.135, 0.062, 0.016, 0]),
    door: -0.9, rider: 0.1 }); // (「썰매 타기」 0.9 m before the foot; the rider's root 0.10 m over the sled's -- ride.json)
  // the forts (fort.json's small fort: corners at x ±1.9, the front wall between, side walls back at z 1.9 turned 90°; its
  // front the model's -Z, toward the other), and the ground they are thrown over
  const FORTS = Object.freeze([Object.freeze({ x: -24.5, z: -107.5, yaw: -Math.PI / 2 }), Object.freeze({ x: -15.5, z: -107.5, yaw: Math.PI / 2 })]);
  const FORT_PIECES = Object.freeze([['corner', -1.9, 0, 0], ['wall', 0, 0, 0], ['corner', 1.9, 0, 0], ['wall', -1.9, 1.9, Math.PI / 2], ['wall', 1.9, 1.9, Math.PI / 2]].map(([kind, x, z, yaw]) => Object.freeze({ kind, x, z, yaw })));
  const FIGHT = Object.freeze({ x: -20, z: -107.5, w: 18, d: 8 }); // (both forts and the lane between)
  const THROW = Object.freeze({ gap: 800, round: 5, hand: 1.55, angle: 0.38, g: 9.8, far: 11, near: 2, chest: 1.1, hitR: 0.5, top: 1.75, life: 3000 });
  const RIDE = Object.freeze({ wait: 700, v0: 2.4, pull: 0.7, drag: 0.25, vmax: 6, stop: 3.2 }); // (m/s; m/s² along the slope, its share of g, and the snow's drag)

  const turn = (p, x, z) => ({ x: p.x + Math.cos(p.yaw) * x + Math.sin(p.yaw) * z, z: p.z - Math.sin(p.yaw) * x + Math.cos(p.yaw) * z });
  // the track's height over the hill's foot at the model's z (0 before the foot)
  function trackY(z) {
    if (z <= 0) return 0; if (z >= HILL.startZ) return HILL.y[0];
    const f = (HILL.startZ - z) / HILL.step; const i = Math.floor(f); const k = f - i; return HILL.y[i] + (HILL.y[Math.min(HILL.y.length - 1, i + 1)] - HILL.y[i]) * k;
  }
  // the run, timed once: [ms, z] from the start (z 9.6) to where it stops on the run-out (z -run at most)
  const RUN = (() => {
    const out = [[0, HILL.startZ]]; let t = RIDE.wait; let z = HILL.startZ; let v = RIDE.v0; const dt = 1 / 60; out.push([t, z]);
    while (z > -HILL.run && v > 0.05 && t < 20000) {
      const slope = (trackY(z) - trackY(z - 0.05)) / 0.05; const sin = slope / Math.hypot(1, slope);
      v = Math.min(RIDE.vmax, Math.max(0, v + ((z > 0 ? 9.8 * RIDE.pull * sin : 0) - (z > 0 ? RIDE.drag : RIDE.stop)) * dt));
      z -= v * dt / Math.hypot(1, slope); t += dt * 1000; out.push([Math.round(t), +z.toFixed(3)]);
    }
    return out;
  })();
  const RIDE_MS = RUN[RUN.length - 1][0];
  // where the run is `ms` after it began: the model's z, the height over the foot, the nose's pitch down (rad), done
  function rideAt(ms) {
    if (ms >= RIDE_MS) { const z = RUN[RUN.length - 1][1]; return { z, y: trackY(z), pitch: 0, done: true }; }
    let lo = 0; let hi = RUN.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (RUN[mid][0] <= ms) lo = mid; else hi = mid; }
    const [ta, za] = RUN[lo]; const [tb, zb] = RUN[hi]; const z = za + (zb - za) * ((ms - ta) / Math.max(1, tb - ta));
    return { z, y: trackY(z), pitch: Math.atan((trackY(z + 0.2) - trackY(z - 0.2)) / 0.4), done: false };
  }
  // the hill's model point (x across, z along) on the island
  const hillPoint = (x, z) => turn(HILL.at, x, z);
  // the model z of an island point along the hill's track (its distance across too), for one seen riding it
  function hillLocal(x, z) { const dx = x - HILL.at.x; const dz = z - HILL.at.z; const c = Math.cos(HILL.at.yaw); const s = Math.sin(HILL.at.yaw); return { u: dx * c - dz * s, v: dx * s + dz * c }; }
  const onHill = (x, z, m = 0) => { const l = hillLocal(x, z); return Math.abs(l.u) <= HILL.half + m && l.v >= -m && l.v <= HILL.len + m; };
  // what blocks while set out (assets 128 solids.json): the hill's 36 circles (its foot's first 0.95 m left free), each fort
  // piece's -- a wall's seven, a corner's one
  function solids() {
    const out = [];
    for (const x of [-1.8, -0.6, 0.6, 1.8]) for (let k = 0; k < 9; k += 1) { const p = hillPoint(x, 1 + 1.2 * k); out.push({ x: p.x, z: p.z, r: 0.95, kind: 'hill' }); }
    for (const f of FORTS) for (const pc of FORT_PIECES) {
      const c = turn(f, pc.x, pc.z); const yaw = f.yaw + pc.yaw;
      if (pc.kind === 'corner') out.push({ x: c.x, z: c.z, r: 0.4, h: 1.54, kind: 'fort' });
      else for (let k = -3; k <= 3; k += 1) { const p = turn({ ...c, yaw }, k * 0.4, 0); out.push({ x: p.x, z: p.z, r: 0.3, h: 1.32, kind: 'fort' }); }
    }
    return out;
  }
  const inFight = (x, z, m = 0) => Math.abs(x - FIGHT.x) <= FIGHT.w / 2 + m && Math.abs(z - FIGHT.z) <= FIGHT.d / 2 + m;
  // a throw: from the hand toward `yaw`, through chest height `d` metres off (with no one aimed at, the farthest)
  function throwOf(from, yaw, d) {
    const dist = Math.max(THROW.near, Math.min(THROW.far, Number(d) || THROW.far)); const c = Math.cos(THROW.angle);
    const v = Math.sqrt((THROW.g * dist * dist) / (2 * c * c * Math.max(0.3, dist * Math.tan(THROW.angle) + THROW.hand - THROW.chest)));
    return { x: from.x, y: from.y + THROW.hand, z: from.z, yaw, vh: v * c, vy: v * Math.sin(THROW.angle), d: dist };
  }
  const ballAt = (b, s) => ({ x: b.x + Math.sin(b.yaw) * b.vh * s, y: b.y + b.vy * s - (THROW.g * s * s) / 2, z: b.z + Math.cos(b.yaw) * b.vh * s });
  // a ball at p hits one standing at q (feet at q.y): within the body's round and below the head
  const hits = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) <= THROW.hitR && p.y >= q.y + 0.2 && p.y <= q.y + THROW.top;
  // the act a throw is seen by (its metres, whole, so the others draw the same arc)
  const throwAct = (d) => `snow:throw:${Math.max(THROW.near, Math.min(THROW.far, Math.round(d || THROW.far)))}`;
  const ACTS = Object.freeze(['snow:hit', 'sled', ...Array.from({ length: THROW.far - THROW.near + 1 }, (_, k) => `snow:throw:${THROW.near + k}`)]);
  return { HILL, FORTS, FORT_PIECES, FIGHT, THROW, RIDE, RUN, RIDE_MS, trackY, rideAt, hillPoint, hillLocal, onHill, solids, inFight, throwOf, ballAt, hits, throwAct, ACTS, turn };
}));
