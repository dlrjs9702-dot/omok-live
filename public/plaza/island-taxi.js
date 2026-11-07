// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md): two stops -- 대청마당 and 툇마루섬 입구 -- and the one road between,
// shared word for word by the server (who rides, where they are now, where they come out) and the page (the car on the road,
// the rider in it, the same on every screen). Pure numbers.
//   타기 1.2 s -> 출발(slowly faster, 1.5 s) -> 달리기 (10 m/s, 6 on the bridge) -> 멈춤 (slower, 1.5 s) -> 내리기 1.0 s
// A ride is { from, startedAt, runMs? } (runMs: the tests' short road); poseAt(ride, now) says where the car is and how.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandTaxi = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // the road, 대청마당 -> 툇마루섬 입구 (worked out on the island's walkable ground and its east bridge, the walks preferred);
  // the other way is the same road backwards
  const ROUTE = [[8, -50], [1, -14], [37, 2], [77, 31], [97, 71], [100, 98], [91, 135], [70, 139], [33, 143], [32, 146]];
  const BRIDGE = { x0: 38, x1: 81, z0: 136, z1: 144 }; // (the east 윤슬다리: slower there)
  const STOPS = {
    plaza: { id: 'plaza', label: '대청마당', to: 'isle', sign: '🚕 섬 택시 · 툇마루섬 입구까지' },
    isle: { id: 'isle', label: '툇마루섬 입구', to: 'plaza', sign: '🚕 섬 택시 · 대청마당까지' },
  };
  const ENTER = 1200; const EXIT = 1000; const EASE = 1500; const FAST = 10; const SLOW = 6; const STEP = 50; // (ms; m/s)
  const FARE = 1000; // (경제 값 taxi:fare's default)
  const roadOf = (from) => (from === 'isle' ? ROUTE.slice().reverse() : ROUTE.slice());
  const segs = (pts) => pts.slice(1).map((q, i) => { const p = pts[i]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]); const mx = (p[0] + q[0]) / 2; const mz = (p[1] + q[1]) / 2;
    return { p, q, len, yaw: Math.atan2(q[0] - p[0], q[1] - p[1]), slow: mx >= BRIDGE.x0 && mx <= BRIDGE.x1 && mz >= BRIDGE.z0 && mz <= BRIDGE.z1 }; });
  const smooth = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // (assets 99 motions.json, the model's frame turned round: one gets in by the door on the car's right -- enter_L [-1.5, 0, 1.18]
  // -- and is out at exit_L [-1.75, 0, 1.27]; here from the car's middle, across (+ its right) and along (- behind))
  const BOARD = { across: 1.5, along: -1.18 }; const ALIGHT = { across: 1.75, along: -1.27 };
  const beside = (x, z, yaw, at) => ({ x: x + Math.cos(yaw) * at.across + Math.sin(yaw) * at.along, z: z - Math.sin(yaw) * at.across + Math.cos(yaw) * at.along });
  // a stop's place: where the car stands (the road's end, facing the road), the shelter beside it, where one gets in
  function stopOf(id) {
    const road = roadOf(id === 'isle' ? 'isle' : 'plaza'); const [a, b] = road; const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const nx = Math.cos(yaw); const nz = -Math.sin(yaw); // (the car's right)
    return { ...STOPS[id], x: a[0], z: a[1], yaw, shelter: { x: a[0] + nx * 3.2 - Math.sin(yaw) * 1.2, z: a[1] + nz * 3.2 - Math.cos(yaw) * 1.2, yaw: yaw - Math.PI / 2 }, out: beside(a[0], a[1], yaw, BOARD) };
  }
  // the time table of a ride's drive: distance gone by each 50 ms, easing in and out; a short road (runMs) is the same drive faster
  const tables = new Map();
  function tableOf(from, runMs) {
    const key = `${from}|${runMs || 0}`; if (tables.has(key)) return tables.get(key);
    const road = roadOf(from); const ss = segs(road); const total = ss.reduce((n, s) => n + s.len, 0);
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
  // where the rider stands once out (and where a ride cut off counts them): beside the car as it stands at the other stop
  const arrivalOf = (ride) => { const t = tableOf(ride.from, ride.runMs); const p = along(t, t.total); return beside(p.x, p.z, p.yaw, ALIGHT); };
  // the door's opening (0 shut .. 1 open) through a getting in or out (motion-utils doorAngle: in 0..0.14 open, 0.86..1 shut;
  // out 0..0.12 open, 0.80..1 shut)
  const doorOf = (phase, k) => (phase === 'enter' ? (k < 0.5 ? smooth(k / 0.14) : 1 - smooth((k - 0.86) / 0.14)) : phase === 'exit' ? (k < 0.5 ? smooth(k / 0.12) : 1 - smooth((k - 0.8) / 0.2)) : 0);
  const fareOf = ({ hasHome = false, fare = FARE } = {}) => (hasHome ? 0 : Math.max(0, Math.round(Number(fare) || 0)));
  return { ROUTE, STOPS, BRIDGE, ENTER, EXIT, EASE, FAST, SLOW, FARE, BOARD, ALIGHT, roadOf, stopOf, tableOf, durationOf, poseAt, arrivalOf, doorOf, fareOf };
}));
