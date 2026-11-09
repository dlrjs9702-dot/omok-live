// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md): two stops -- 대청마당 and 툇마루섬 마을 (v1.10.285) -- and the one road between,
// shared word for word by the server (who rides, where they are now, where they come out) and the page (the car on the road,
// the rider in it, the same on every screen). Pure numbers.
//   타기 1.2 s -> 출발(slowly faster, 1.5 s) -> 달리기 (10 m/s, 6 on the bridge) -> 멈춤 (slower, 1.5 s) -> 내리기 1.0 s
// A ride is { from, startedAt, runMs? } (runMs: the tests' short road); poseAt(ride, now) says where the car is and how.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandTaxi = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // the road, 대청마당 -> 툇마루섬 마을; the other way is the same road backwards. v1.10.285 (notes docs/taxi-fix-20261108.md, 사용자
  // 「뚫고 지나가버려」): found once on a 0.5 m grid (the walks' middles preferred, every solid at least the car's half width +
  // 0.3 m off, no water but the bridges, no stairs) and straightened, its points 4 m apart at most -- test/island-taxi.test.js walks
  // it every half metre both ways. The island end at the user's own spot (문제 기록 「택시 위치」 -13.3, 173.1: the village front)
  const ROUTE = [[8,-53],[4.4,-52.6],[0.8,-52.2],[0.7,-48.5],[0.7,-44.7],[0.6,-40.9],[0.6,-37.1],[0.5,-33.3],[0.5,-29.5],[0.5,-25.7],[0.4,-21.9],[0.4,-18.1],[0.3,-14.3],[0.3,-10.5],[0.3,-6.7],[3.3,-5.2],[7.1,-4.8],[10.9,-4.4],[14.7,-4],[18.5,-3.6],[22.3,-3.2],[25.7,-2.1],[29.1,-0.9],[32.5,0.3],[35.9,1.4],[39.3,2.6],[42.8,3.8],[46.2,5.8],[49.6,7.8],[53,9.8],[56.4,11.8],[59.8,13.8],[62.3,16],[64.8,18.3],[67.3,20.5],[69.8,22.8],[72.3,25],[74.8,27.3],[76.8,30.1],[78.9,32.9],[81,35.8],[83.1,38.6],[85.2,41.4],[87.3,44.3],[88.8,47.3],[90.3,50.3],[91.8,53.3],[93.3,56.3],[94.3,59.1],[95.3,62],[96.3,64.9],[97.3,67.8],[97.8,71.3],[98.4,74.8],[99,78.3],[99.6,81.8],[100.2,85.3],[100.8,88.8],[100.7,92.4],[100.6,96],[100.5,99.6],[100.4,103.2],[100.3,106.8],[99.6,110.6],[98.9,114.4],[98.3,118.3],[97.1,121.9],[96,125.5],[94.9,129.1],[93.8,132.8],[92.3,135.8],[89.8,137.8],[87.3,139.8],[83.3,139.8],[79.4,139.9],[75.4,139.9],[71.5,140],[67.5,140],[63.6,140.1],[59.6,140.1],[55.7,140.2],[51.8,140.3],[47.8,140.3],[43.9,140.4],[39.9,140.4],[36,140.5],[32,140.5],[28.1,140.6],[24.1,140.6],[20.2,140.7],[16.3,140.8],[12.3,140.8],[8.4,140.9],[4.4,140.9],[0.5,141],[-3.5,141],[-7.4,141.1],[-11.4,141.1],[-15.3,141.2],[-19.2,141.3],[-19.3,145.2],[-19.4,149.1],[-19.4,153.1],[-19.5,157],[-19.6,160.9],[-19.6,164.9],[-19.7,168.8],[-19.7,172.8],[-16.5,172.9],[-13.3,173.1]];
  const BRIDGE = { x0: 38, x1: 81, z0: 136, z1: 144 }; // (the east 윤슬다리: slower there)
  const STOPS = {
    plaza: { id: 'plaza', label: '대청마당', to: 'isle', sign: '🚕 섬 택시 · 툇마루섬 마을까지' },
    isle: { id: 'isle', label: '툇마루섬 마을', to: 'plaza', sign: '🚕 섬 택시 · 대청마당까지' },
  };
  const ENTER = 1200; const EXIT = 1000; const EASE = 1500; const FAST = 13; /* (v1.10.285: 10 -> 13 -- the road along the walks is 400 m, a ride still under 40 s) */ const SLOW = 6; const STEP = 50; // (ms; m/s)
  const FARE = 1000; // (경제 값 taxi:fare's default)
  const roadOf = (from) => (from === 'isle' ? ROUTE.slice().reverse() : ROUTE.slice());
  const segs = (pts) => pts.slice(1).map((q, i) => { const p = pts[i]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]); const mx = (p[0] + q[0]) / 2; const mz = (p[1] + q[1]) / 2;
    return { p, q, len, yaw: Math.atan2(q[0] - p[0], q[1] - p[1]), slow: mx >= BRIDGE.x0 && mx <= BRIDGE.x1 && mz >= BRIDGE.z0 && mz <= BRIDGE.z1 }; });
  const smooth = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // (assets 99 motions.json, the model's frame turned round: one gets in by the door on the car's right -- enter_L [-1.5, 0, 1.18]
  // -- and is out at exit_L [-1.75, 0, 1.27]; here from the car's middle, across (+ its right) and along (- behind))
  const BOARD = { across: 1.5, along: -1.18 }; const ALIGHT = { across: 1.75, along: -1.27 };
  // a rider's root in the car (assets 99: the back seat -- the body's hips [0, 0.38, 0] over its root at [0, 0.10, 0.12], the car's
  // floor, turned round here). v1.10.286 (notes docs/taxi-fix-20261108.md 6절): it was 0.48 (the hips added twice) -- the head through
  // the roof and the getting in and out 0.38 m over the ground; test/island-taxi.test.js seats every body and hair under the roof
  const SEAT = { x: 0, y: 0.10, z: -0.12 };
  const beside = (x, z, yaw, at) => ({ x: x + Math.cos(yaw) * at.across + Math.sin(yaw) * at.along, z: z - Math.sin(yaw) * at.across + Math.cos(yaw) * at.along });
  // a stop's place: where the car stands (the road's end, facing the road), the shelter beside it, where one gets in
  function stopOf(id) {
    const road = roadOf(id === 'isle' ? 'isle' : 'plaza'); const [a, b] = road; const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const nx = Math.cos(yaw); const nz = -Math.sin(yaw); // (the car's right)
    return { ...STOPS[id], x: a[0], z: a[1], yaw, shelter: { x: a[0] + nx * 3.2 - Math.sin(yaw) * 1.2, z: a[1] + nz * 3.2 - Math.cos(yaw) * 1.2, yaw: yaw - Math.PI / 2 }, out: beside(a[0], a[1], yaw, BOARD) };
  }
  // (v1.10.272 총괄: the door to the bench at both ends) where an arriving car stops: across the shelter from the standing one
  // (DROP m to the stop's right), facing back along the road -- so its door, on its right, is to the shelter; come in straight
  // over the last IN m; the drive is the road to there, its points within 10 m of the stop left out
  const DROP = 6.4; const IN = 6;
  function dropOf(id) {
    const s = stopOf(id); const x = s.x + Math.cos(s.yaw) * DROP; const z = s.z - Math.sin(s.yaw) * DROP;
    return { x, z, yaw: wrap(s.yaw + Math.PI), approach: [x + Math.sin(s.yaw) * IN, z + Math.cos(s.yaw) * IN] };
  }
  const driveOf = (from) => { const s = stopOf(STOPS[from].to); const d = dropOf(s.id); return [...roadOf(from).slice(0, -1).filter(([x, z]) => Math.hypot(x - s.x, z - s.z) > 10), d.approach, [d.x, d.z]]; };
  // the time table of a ride's drive: distance gone by each 50 ms, easing in and out; a short road (runMs) is the same drive faster
  const tables = new Map();
  function tableOf(from, runMs) {
    const key = `${from}|${runMs || 0}`; if (tables.has(key)) return tables.get(key);
    const road = driveOf(from); const ss = segs(road); const total = ss.reduce((n, s) => n + s.len, 0);
    const speedAt = (d) => { let k = 0; let at = 0; while (k < ss.length - 1 && at + ss[k].len < d) { at += ss[k].len; k += 1; } return ss[k].slow ? SLOW : FAST; };
    let cruise = 0; for (const s of ss) cruise += s.len / (s.slow ? SLOW : FAST); const M = cruise * 1000 + EASE; // (easing in and out costs half a ramp each)
    const out = [0]; let d = 0; let u = 0;
    while (d < total && out.length < 100000) { u += STEP; const f = smooth(u / EASE) * smooth((M - u) / EASE + 0.02); d = Math.min(total, d + speedAt(d) * Math.max(0.04, f) * STEP / 1000); out.push(d); }
    const scale = runMs ? runMs / (out.length * STEP) : 1;
    const t = { road, ss, total, ds: out, step: STEP * scale, runMs: out.length * STEP * scale };
    tables.set(key, t); return t;
  }
  const durationOf = (ride) => ENTER + tableOf(ride.from, ride.runMs).runMs + EXIT;
  // where along the road at distance d: the point, the heading (eased across each corner), the lean of a turn
  function along(t, d) {
    let k = 0; let at = 0; while (k < t.ss.length - 1 && at + t.ss[k].len < d) { at += t.ss[k].len; k += 1; }
    const s = t.ss[k]; const u = s.len ? Math.min(1, Math.max(0, (d - at) / s.len)) : 0; const x = s.p[0] + (s.q[0] - s.p[0]) * u; const z = s.p[1] + (s.q[1] - s.p[1]) * u;
    let yaw = s.yaw; const R = 4; // (a corner taken over 4 m either side)
    if (k > 0 && d - at < R) yaw = t.ss[k - 1].yaw + wrap(s.yaw - t.ss[k - 1].yaw) * (0.5 + 0.5 * smooth((d - at) / R));
    else if (k < t.ss.length - 1 && at + s.len - d < R) yaw = s.yaw + wrap(t.ss[k + 1].yaw - s.yaw) * 0.5 * (1 - smooth((at + s.len - d) / R));
    return { x, z, yaw, k };
  }
  // the ride at `now`: phase enter | start | run | stop | exit | done, where the car is, its heading and lean (back as it goes,
  // forward as it stops, over in a turn), how far the wheels have rolled
  function poseAt(ride, now) {
    const t = tableOf(ride.from, ride.runMs); const e = now - ride.startedAt;
    if (e < ENTER) { const p = along(t, 0); return { phase: 'enter', ...p, d: 0, pitch: 0, roll: 0, k: e / ENTER }; }
    const r = e - ENTER;
    if (r >= t.runMs) { const p = along(t, t.total); const k = (r - t.runMs) / EXIT; return { phase: k >= 1 ? 'done' : 'exit', ...p, d: t.total, pitch: 0, roll: 0, k: Math.min(1, k) }; }
    const i = r / t.step; const i0 = Math.floor(i); const d = t.ds[Math.min(t.ds.length - 1, i0)] + ((t.ds[Math.min(t.ds.length - 1, i0 + 1)] - t.ds[Math.min(t.ds.length - 1, i0)]) * (i - i0));
    const p = along(t, d); const ahead = along(t, Math.min(t.total, d + 3));
    const acc = r < EASE * (t.runMs / (t.ds.length * STEP) || 1) ? 'start' : r > t.runMs - EASE * (t.runMs / (t.ds.length * STEP) || 1) ? 'stop' : 'run';
    return { phase: acc, ...p, d, pitch: acc === 'start' ? -0.04 : acc === 'stop' ? 0.05 : 0, roll: Math.max(-0.06, Math.min(0.06, wrap(ahead.yaw - p.yaw) * 0.25)), k: d / t.total };
  }
  // v1.10.294 7: the stop's car for a ride -- its way there (poseAt), then empty: turning round where it let the rider out (TURN
  // ms), the same road back on the same timing reversed, turning round again into its place at its stop; null once it stands
  // there. backOf: when that is (the stop has no car till then -- TAXI_AWAY)
  const TURN = 3000;
  const backOf = (ride) => ride.startedAt + durationOf(ride) + TURN + tableOf(ride.from, ride.runMs).runMs + TURN;
  function carAt(ride, now) {
    const p = poseAt(ride, now); if (p.phase !== 'done') return p;
    const t = tableOf(ride.from, ride.runMs); const e = now - ride.startedAt - durationOf(ride);
    const turn = (q, k) => ({ phase: 'turn', ...q, yaw: wrap(q.yaw + Math.PI * smooth(k)), d: q.d, pitch: 0, roll: 0, k });
    if (e < TURN) return turn({ ...along(t, t.total), d: t.total }, e / TURN);
    const r = e - TURN; if (r < t.runMs) {
      const i = (t.runMs - r) / t.step; const i0 = Math.floor(i); const at = (j) => t.ds[Math.min(t.ds.length - 1, Math.max(0, j))]; const d = at(i0) + (at(i0 + 1) - at(i0)) * (i - i0);
      const q = along(t, d); return { phase: 'back', ...q, yaw: wrap(q.yaw + Math.PI), d, pitch: 0, roll: 0, k: 1 - d / t.total };
    }
    const k = (r - t.runMs) / TURN; if (k >= 1) return null;
    const s = along(t, 0); return turn({ ...s, yaw: wrap(s.yaw + Math.PI), d: 0 }, k);
  }
  // where the rider stands once out (and where a ride cut off counts them): beside the car as it stands at the other stop
  const arrivalOf = (ride) => { const t = tableOf(ride.from, ride.runMs); const p = along(t, t.total); return beside(p.x, p.z, p.yaw, ALIGHT); };
  // the door's opening (0 shut .. 1 open) through a getting in or out (motion-utils doorAngle: in 0..0.14 open, 0.86..1 shut;
  // out 0..0.12 open, 0.80..1 shut)
  const doorOf = (phase, k) => (phase === 'enter' ? (k < 0.5 ? smooth(k / 0.14) : 1 - smooth((k - 0.86) / 0.14)) : phase === 'exit' ? (k < 0.5 ? smooth(k / 0.12) : 1 - smooth((k - 0.8) / 0.2)) : 0);
  const fareOf = ({ hasHome = false, fare = FARE } = {}) => (hasHome ? 0 : Math.max(0, Math.round(Number(fare) || 0)));
  // v1.10.294 6a: the screen's clock offset a frame toward the server's -- at most `step` ms, at once past `jump` (a first
  // reading, a sleep): a clock answer moving it tens of ms at once made a moving car jump that far
  const easeClock = (view, server, step = 2, jump = 1000) => (view == null || Math.abs(server - view) > jump ? server : view + Math.max(-step, Math.min(step, server - view)));
  return { TURN, backOf, carAt, easeClock, ROUTE, STOPS, BRIDGE, ENTER, EXIT, EASE, FAST, SLOW, FARE, BOARD, ALIGHT, SEAT, roadOf, stopOf, dropOf, driveOf, tableOf, durationOf, poseAt, arrivalOf, doorOf, fareOf };
}));
