// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md): two stops -- 대청마당 and 툇마루섬 마을 (v1.10.285) -- and the one road between,
// shared word for word by the server (who rides, where they are now, where they come out) and the page (the car on the road,
// the rider in it, the same on every screen). Pure numbers.
//   타기 1.2 s -> 출발(slowly faster, 1.5 s) -> 달리기 (16 m/s, the bridge too) -> 멈춤 (slower, 1.5 s) -> 내리기 1.0 s
// A ride is { from, startedAt, runMs? } (runMs: the tests' short road); poseAt(ride, now) says where the car is and how.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandTaxi = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // the road, 대청마당 -> 툇마루섬 마을; the other way is the same road backwards. v1.10.285 (notes docs/taxi-fix-20261108.md, 사용자
  // 「뚫고 지나가버려」): found once on a 0.5 m grid (the walks' middles preferred, every solid at least the car's half width +
  // 0.3 m off, no water but the bridges, no stairs) and straightened, its points 4 m apart at most -- test/island-taxi.test.js walks
  // it every half metre both ways. The island end at the user's own spot (문제 기록 「택시 위치」 -13.3, 173.1: the village front).
  // T1 길 넓히기 (notes docs/island-expansion-20261115.md §9, 171A): the middle moved toward land where the water is close --
  // 물가 거리 d 53~112 by 2.6 m (the bay's railing now the walk's outer edge), the east shore d 187~245 by 2 m, 툇마루섬 d 332~345
  // by 2 m north -- eased over 10 m (work/t1-roads/route.cjs)
  const ROUTE = [[8,-53],[4.4,-52.6],[0.8,-52.2],[0.7,-48.5],[0.7,-44.7],[0.6,-40.9],[0.6,-37.1],[0.5,-33.3],[0.5,-29.5],[0.5,-25.7],[0.4,-21.9],[0.4,-18.1],[0.4,-16.2],[0.6,-14.3],[1.2,-12.4],[2.1,-10],[2.5,-8.4],[4,-7.7],[7.8,-7.3],[11.6,-6.9],[15.4,-6.5],[19.2,-6.1],[22.9,-5.7],[26.5,-4.6],[30,-3.4],[33.3,-2.2],[36.7,-1.1],[40.2,0.1],[43.9,1.4],[47.1,3.3],[50.5,5.3],[53.9,7.3],[57.3,9.3],[58.5,10.2],[59.6,11.4],[60.7,12.6],[62,14.9],[63.1,16.6],[64.4,18],[67.3,20.5],[70.2,23.1],[73,25.7],[74.8,27.3],[77.1,30.5],[79.4,33.6],[81.6,36.6],[83.9,39.6],[86.3,42.8],[87.3,44.3],[89,47.7],[90.7,51.2],[92.4,54.6],[93.3,56.3],[94.6,59.9],[95.3,62],[96.1,63.6],[98.2,66.7],[99,68.3],[99.6,70.1],[100.3,74],[101,78],[101.6,81.9],[102.2,85.4],[102.8,88.7],[102.7,92.5],[102.6,96.1],[102.5,99.7],[102.4,103.3],[102.3,107],[101.7,110.5],[101,114.3],[100.4,117.8],[100.1,119.3],[98.9,123],[97.8,126.5],[96.9,129.2],[96.1,131],[95.4,132.4],[94.5,133.6],[92.8,135.6],[90.9,136.9],[88,139.2],[86.3,139.8],[82.3,139.8],[78.4,139.9],[74.4,139.9],[70.5,140],[66.5,140],[62.6,140.1],[58.6,140.1],[54.7,140.2],[50.8,140.3],[46.8,140.3],[42.9,140.4],[38.9,140.4],[35,140.5],[31,140.5],[27.1,140.6],[24.6,140.6],[22.6,140.4],[21.2,140.1],[17.7,139.2],[15.8,138.9],[14.3,138.8],[10.3,138.9],[6.4,138.9],[2.4,139],[0.5,139.1],[-1,139.4],[-3.5,140.1],[-5.5,140.7],[-7.4,141.1],[-11.4,141.1],[-15.3,141.2],[-19.2,141.3],[-19.3,145.2],[-19.4,149.1],[-19.4,153.1],[-19.5,157],[-19.6,160.9],[-19.6,164.9],[-19.7,168.8],[-19.7,172.8],[-16,172.9],[-13.3,173.1]];
  const BRIDGE = { x0: 38, x1: 81, z0: 136, z1: 144 }; // (the east 윤슬다리: slower there until 1.10.327 -- SLOW is FAST now)
  // v1.10.317 C1 건널목 (notes docs/taxi-yield-20261109.md, 사용자 「큰길을 건너는 자리는 건널목 몇 곳으로 모아요」): where the islanders go
  // over the road -- where their rounds did cross (before the stop and 대청마당, the bend by the hall's walk, off the bridge's
  // west end, the 툇마루섬 end toward the house street), each slid along the road to the nearest place with nothing solid
  // within 5 m; elsewhere they keep to its sides (island-npcs). CROSS_HALF: the crossing's half width along the road. Nothing
  // solid is put within CROSS_CLEAR of one (dalmaru-island taxiClear). T1: eleven -- the two stops' fronts, four of the stops to
  // come (T3: 배 타는 곳, 박물관, 달끝나루, 툇마루섬 갈림길; 물가 거리 has none -- the bay's railing is the walk's edge there, within
  // 5 m of any), the bridge's west end, the 툇마루섬 house walk, three on the east shore (its middle, two where rounds cross by
  // the bend -- the bay-side walk there runs out at the water)
  // ROAD (T1 171A): two lanes of 2.3 m and a walk of 1.6 m each side -- 3.9 m from the middle to the walk's outer edge; the
  // ground's road map (island-paths buildRoadMap) paints it, nothing solid stands in it (dalmaru-island roadClear)
  const CROSSINGS = Object.freeze([[2.4,-52.4],[0.8,-13.7],[92.7,55.1],[102.5,101],[88.4,138.9],[36.4,140.5],[-10.9,141.1],[-19.3,146.5],[-19.7,168],[96.7,129.7],[100.1,119.3]].map(([x, z]) => Object.freeze({ x, z })));
  const CROSS_CLEAR = 5;
  const CROSS_HALF = 2.2;
  const ROAD = Object.freeze({ lane: 2.3, walk: 1.6, half: 3.9 });
  const STOPS = {
    plaza: { id: 'plaza', label: '대청마당', to: 'isle', sign: '🚕 섬 택시 · 툇마루섬 마을까지' },
    isle: { id: 'isle', label: '툇마루섬 마을', to: 'plaza', sign: '🚕 섬 택시 · 대청마당까지' },
  };
  const ENTER = 1200; const EXIT = 1000; const EASE = 1500; const FAST = 16; /* (v1.10.285: 10 -> 13; 1.10.327 사용자 「16의 속도로 올려」 -- faster than a bike's 12) */ const SLOW = FAST; /* (1.10.327 사용자 「다리 위에서도 도로와 동일한 속도」: no slow stretch -- nor on a higher bridge later) */ const STEP = 50; // (ms; m/s)
  // 1.10.327 택시 요금 (notes docs/taxi-yield-20261109.md 「택시 요금」, 사용자 2026-11-16): everyone pays -- a ride's base fare (경제 값
  // taxi:fare) or the day's pass (taxi:dayPass: that Seoul day, any number of rides); EXTRA: what a pair of stops adds to the base
  // by distance once there are more stops (none now -- the two stops are the base)
  const FARE = 1000; const DAY_PASS = 5000; const EXTRA = Object.freeze({});
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
  // v1.10.317 택시 서서 기다리기 (notes docs/taxi-yield-20261109.md A1~A3): a ride's own clock -- its time table read at the road's
  // time, which runs at a rate the server sets (1 the table's pace, 0 standing, a little: creeping by at a walk). `warp` { at, tau,
  // r0, r1, ms }: from server time `at` (road time `tau` then) the rate eases r0 -> r1 over ms, then stays; before `at` it ran at
  // r0. The server sets each change LEAD ms ahead, so every screen has it before it starts; none: the table's own time
  const LEAD = 300; const RAMP = 900;
  function roadNow(ride, now) {
    const w = ride?.warp; if (!w) return now; const dt = now - w.at;
    if (dt <= 0) return w.tau + dt * w.r0;
    if (dt < w.ms) return w.tau + w.r0 * dt + ((w.r1 - w.r0) * dt * dt) / (2 * w.ms);
    return w.tau + ((w.r0 + w.r1) / 2) * w.ms + w.r1 * (dt - w.ms);
  }
  const rateOf = (ride, now) => { const w = ride?.warp; if (!w) return 1; const dt = now - w.at; return dt <= 0 ? w.r0 : dt >= w.ms ? w.r1 : w.r0 + ((w.r1 - w.r0) * dt) / w.ms; };
  // (the server) the road's rate toward r1 from LEAD ms on -- the old warp folded into where the road is then
  function warpTo(ride, r1, now, ms = RAMP) { const at = now + LEAD; ride.warp = { at, tau: roadNow(ride, at), r0: rateOf(ride, at), r1, ms }; return ride.warp; }
  // the server time the road reaches road time `road` (a car standing or creeping for someone: as if it went on at its pace from
  // now -- a wait is soon over; "832초" read the stop while one crept)
  function realAt(ride, road, now) {
    const w = ride?.warp; if (!w) return road;
    if (w.r1 < 1) { const from = Math.max(now, w.at); return from + Math.max(0, road - roadNow(ride, from)); }
    const end = w.at + w.ms; const tauEnd = roadNow(ride, end);
    return road >= tauEnd ? end + (road - tauEnd) / w.r1 : w.at + Math.max(0, road - w.tau) / Math.max(0.05, (w.r0 + w.r1) / 2);
  }
  // 1.10.340 택시 비켜 가기 (notes taxi-yield 133A): `side` { at, from, to, ms } -- the car's offset to its own right (m), easing
  // from -> to from server time `at`; `ghost` { at, until } -- see-through while it goes by someone with no room aside. The server
  // sets each LEAD ms ahead (as `warp`), so every screen -- the rider's too -- has the car in the same place
  const sideAt = (ride, now) => { const w = ride?.side; if (!w) return 0; const dt = now - w.at; return dt <= 0 ? w.from : dt >= w.ms ? w.to : w.from + (w.to - w.from) * smooth(dt / w.ms); };
  const ghostAt = (ride, now) => { const g = ride?.ghost; return Boolean(g && now >= g.at && !(g.until && now >= g.until)); };
  const shifted = (p, off) => (off ? { ...p, x: p.x + Math.cos(p.yaw) * off, z: p.z - Math.sin(p.yaw) * off } : p);
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
    const real = now; now = roadNow(ride, now); /* (317: on the road's own clock) */
    const t = tableOf(ride.from, ride.runMs); const e = now - ride.startedAt;
    if (e < ENTER) { const p = along(t, 0); return { phase: 'enter', ...p, d: 0, pitch: 0, roll: 0, k: e / ENTER }; }
    const r = e - ENTER;
    if (r >= t.runMs) { const p = along(t, t.total); const k = (r - t.runMs) / EXIT; return { phase: k >= 1 ? 'done' : 'exit', ...p, d: t.total, pitch: 0, roll: 0, k: Math.min(1, k) }; }
    const i = r / t.step; const i0 = Math.floor(i); const d = t.ds[Math.min(t.ds.length - 1, i0)] + ((t.ds[Math.min(t.ds.length - 1, i0 + 1)] - t.ds[Math.min(t.ds.length - 1, i0)]) * (i - i0));
    const p = along(t, d); const ahead = along(t, Math.min(t.total, d + 3));
    const acc = r < EASE * (t.runMs / (t.ds.length * STEP) || 1) ? 'start' : r > t.runMs - EASE * (t.runMs / (t.ds.length * STEP) || 1) ? 'stop' : 'run';
    return shifted({ phase: acc, ...p, d, pitch: acc === 'start' ? -0.04 : acc === 'stop' ? 0.05 : 0, roll: Math.max(-0.06, Math.min(0.06, wrap(ahead.yaw - p.yaw) * 0.25)), k: d / t.total }, sideAt(ride, real)); /* (340: aside, by server time) */
  }
  // v1.10.294 7: the stop's car for a ride -- its way there (poseAt), then empty: turning round where it let the rider out (TURN
  // ms), the same road back on the same timing reversed, turning round again into its place at its stop; null once it stands
  // there. backOf: when that is (the stop has no car till then -- TAXI_AWAY)
  const TURN = 3000;
  const backRoad = (ride) => ride.startedAt + durationOf(ride) + TURN + tableOf(ride.from, ride.runMs).runMs + TURN;
  const backOf = (ride, now = Date.now()) => realAt(ride, backRoad(ride), now); // (317: in server time -- later by every wait)
  // (317) the ride over (the rider out at the other stop) by server time `now`
  const rideOver = (ride, now) => roadNow(ride, now) >= ride.startedAt + durationOf(ride);
  function carAt(ride, now) {
    const p = poseAt(ride, now); if (p.phase !== 'done') return p;
    const real = now; now = roadNow(ride, now);
    const t = tableOf(ride.from, ride.runMs); const e = now - ride.startedAt - durationOf(ride);
    const turn = (q, k) => ({ phase: 'turn', ...q, yaw: wrap(q.yaw + Math.PI * smooth(k)), d: q.d, pitch: 0, roll: 0, k });
    if (e < TURN) return turn({ ...along(t, t.total), d: t.total }, e / TURN);
    const r = e - TURN; if (r < t.runMs) {
      const i = (t.runMs - r) / t.step; const i0 = Math.floor(i); const at = (j) => t.ds[Math.min(t.ds.length - 1, Math.max(0, j))]; const d = at(i0) + (at(i0 + 1) - at(i0)) * (i - i0);
      const q = along(t, d); return shifted({ phase: 'back', ...q, yaw: wrap(q.yaw + Math.PI), d, pitch: 0, roll: 0, k: 1 - d / t.total }, sideAt(ride, real));
    }
    const k = (r - t.runMs) / TURN; if (k >= 1) return null;
    const s = along(t, 0); return turn({ ...s, yaw: wrap(s.yaw + Math.PI), d: 0 }, k);
  }
  // where the rider stands once out (and where a ride cut off counts them): beside the car as it stands at the other stop
  const arrivalOf = (ride) => { const t = tableOf(ride.from, ride.runMs); const p = along(t, t.total); return beside(p.x, p.z, p.yaw, ALIGHT); };
  // the door's opening (0 shut .. 1 open) through a getting in or out (motion-utils doorAngle: in 0..0.14 open, 0.86..1 shut;
  // out 0..0.12 open, 0.80..1 shut)
  const doorOf = (phase, k) => (phase === 'enter' ? (k < 0.5 ? smooth(k / 0.14) : 1 - smooth((k - 0.86) / 0.14)) : phase === 'exit' ? (k < 0.5 ? smooth(k / 0.12) : 1 - smooth((k - 0.8) / 0.2)) : 0);
  const fareOf = ({ fare = FARE, from = '', to = '' } = {}) => Math.max(0, Math.round(Number(fare) || 0)) + (EXTRA[`${from}>${to}`] || 0);
  // v1.10.294 6a: the screen's clock offset a frame toward the server's -- at most `step` ms, at once past `jump` (a first
  // reading, a sleep): a clock answer moving it tens of ms at once made a moving car jump that far
  const easeClock = (view, server, step = 2, jump = 1000) => (view == null || Math.abs(server - view) > jump ? server : view + Math.max(-step, Math.min(step, server - view)));
  return { CROSSINGS, CROSS_HALF, CROSS_CLEAR, ROAD, LEAD, RAMP, sideAt, ghostAt, shifted, roadNow, rateOf, warpTo, realAt, rideOver, TURN, backOf, carAt, easeClock, ROUTE, STOPS, BRIDGE, ENTER, EXIT, EASE, FAST, SLOW, FARE, DAY_PASS, EXTRA, BOARD, ALIGHT, SEAT, roadOf, stopOf, dropOf, driveOf, tableOf, durationOf, poseAt, arrivalOf, doorOf, fareOf };
}));
