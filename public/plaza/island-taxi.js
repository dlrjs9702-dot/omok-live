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
  /* 1.10.395 N4-c (notes n4-plan-20261120 §5-3): the road on to 별마루섬 -- from the corner before 툇마루섬 마을's stop (ROUTE's third
     last point) north up the neck's walk (x -20), east along the village street (z 236: the yards' front fences stand at 232.1 and
     239.9 whatever their size, the road's 7.8 m just between), straight on past lot14's corner to x 116, then 별마루다리's walk, over
     the bridge and through the wide gate (assets 163) to 10.5 m inside it, where the third stop comes (396). Found on today's ground
     (work: build-ext395): no water but the bridge, no slope over 0.3, no yard of any size within 3.9 m, nothing built in its band.
     The roads are ROADS -- the ground's band, its paint, the islanders' crossings and what is put beside it read them all */
  const EXT = [[-19.7,172.8],[-19.7,175.4],[-19.8,178],[-19.9,180.7],[-19.9,183.3],[-20,186],[-20,189.8],[-20,193.6],[-20,197.5],[-20,201.3],[-20,205.1],[-20,208.9],[-20,212.7],[-20,216.5],[-20,220.4],[-20,224.2],[-20,228],[-19.6,230.1],[-19.2,232.2],[-17,235.2],[-15,235.6],[-13,236],[-9.1,236],[-5.2,236],[-1.3,236],[2.6,236],[6.5,236],[10.5,236],[14.4,236],[18.3,236],[22.2,236],[26.1,236],[30,236],[33.9,236],[37.8,236],[41.7,236],[45.6,236],[49.5,236],[53.5,236],[57.4,236],[61.3,236],[65.2,236],[69.1,236],[73,236],[76.9,236],[80.8,236],[84.7,236],[88.6,236],[92.5,236],[96.5,236],[100.4,236],[104.3,236],[108.2,236],[112.1,236],[116,236],[118.4,235],[120.9,234.1],[124.7,233.7],[128.3,233.4],[131.8,233],[135.1,232.7],[138.7,232.2],[142,231.6],[144.8,231],[147.8,230.2],[151.2,229],[154.9,227.6],[156.9,227],[159.1,226.5],[161.6,226.1],[165.3,225.8],[169,225.6],[172.9,225.6],[176.1,225.6],[179.4,225.6],[182.7,225.7],[186.1,225.8],[189.5,225.9],[192.8,226],[196,226],[199.3,226],[202.9,226],[206.5,226],[210.3,226],[213.9,226],[217.5,226],[220.8,226],[224.5,226],[226.2,226],[228.2,225.9],[231.1,226.6],[234.8,227.5],[238.4,228.4]];
  const ROADS = Object.freeze([ROUTE, EXT]);
  /* (the village street: its lamps keep to its walks -- 3.3 m out, as they stood -- the yards' fences right behind them) */
  const STREET = Object.freeze({ x0: -13, x1: 116, z: 236, lamp: 3.3 });
  const BRIDGE = { x0: 31, x1: 88, z0: 136, z1: 144 }; // (the east 윤슬다리: slower there until 1.10.327 -- SLOW is FAST now; 1.10.389 N3-a: the high one, 56 m)
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
  // (1.10.389 N3-a: the high bridge's two -- its ramps now stand where they were -- each more than 5 m off its ends, on the road: (88.4, 138.9) -> (92.8, 135.6), (36.4, 140.5) -> (25.5, 140.6))
  const CROSSINGS = Object.freeze([[2.4,-52.4],[0.8,-13.7],[92.7,55.1],[102.5,101],[92.8,135.6],[25.5,140.6],[-10.9,141.1],[-19.3,146.5],[-19.7,168],[96.7,129.7],[100.1,119.3],
    /* (1.10.395 N4-c: on the new road -- the neck before the corner (the west street's walk to its east side) and the village street where
       each yard's walk comes to it, -14 (at -12: off the corner's bend) · 14 · 42 · 70 · 98) */
    [-20,224],[-12,236],[14,236],[42,236],[70,236],[98,236]].map(([x, z]) => Object.freeze({ x, z })));
  const CROSS_CLEAR = 5;
  const CROSS_HALF = 2.2;
  const ROAD = Object.freeze({ lane: 2.3, walk: 1.6, half: 3.9 });
  const STOPS = {
    plaza: { id: 'plaza', label: '대청마당', to: 'isle', sign: '🚕 섬 택시 · 툇마루섬 마을까지' },
    isle: { id: 'isle', label: '툇마루섬 마을', to: 'plaza', sign: '🚕 섬 택시 · 대청마당까지' },
    /* (1.10.397 N4-c, 결정 1 B · notes n4-plan §5-3·§5-4: the third, 10.5 m inside 별마루다리's wide gate -- EXT's end) */
    head: { id: 'head', label: '별마루섬 입구', to: 'isle', sign: '🚕 섬 택시 · 별마루섬 입구' },
  };
  const ENTER = 1200; const EXIT = 1000; const EASE = 1500; const FAST = 16; /* (v1.10.285: 10 -> 13; 1.10.327 사용자 「16의 속도로 올려」 -- faster than a bike's 12) */ const SLOW = FAST; /* (1.10.327 사용자 「다리 위에서도 도로와 동일한 속도」: no slow stretch -- nor on a higher bridge later) */ const STEP = 50; // (ms; m/s)
  // 1.10.327 택시 요금 (notes docs/taxi-yield-20261109.md 「택시 요금」, 사용자 2026-11-16): everyone pays -- a ride's base fare (경제 값
  // taxi:fare) or the day's pass (taxi:dayPass: that Seoul day, any number of rides); EXTRA: what a pair of stops adds to the base
  // by distance once there are more stops (none now -- the two stops are the base)
  const FARE = 1000; const DAY_PASS = 5000; const EXTRA = Object.freeze({});
  const roadOf = (from) => (from === 'isle' ? ROUTE.slice().reverse() : from === 'head' ? EXT.slice().reverse() /* (397: from its end back) */ : ROUTE.slice());
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
    const road = roadOf(id === 'isle' || id === 'head' ? id : 'plaza'); const [a, b] = road; const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
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
  // ---- 1.10.392 N4-b the road's places (notes n4-plan §3-3·§5-2): its two ends (STOPS -- the terminals) and the stops between (ROADSTOPS),
  // each at its distance along ROUTE from 대청마당 (s) and the side its sign stands on (+1: the right going from 대청마당). A ride is between
  // any two; a car going empty -- to fetch a caller, or to the nearest terminal with room -- is a ride with none in it (`empty`) ----
  const SR = [0]; for (let i = 1; i < ROUTE.length; i += 1) SR.push(SR[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1])); const ROAD_LEN = SR[SR.length - 1];
  /* 1.10.397 N4-c: the trunk -- ROUTE to the corner before 툇마루섬 마을's stop (JN, where EXT begins) and on along EXT to 별마루섬 입구; 마을's stop is a
     short spur off it at the corner (SPUR m: the corner to its standing place). A place's s is along the trunk (마을: the corner's), the road
     between two places along the trunk, the spur added for 마을 */
  const JN = ROUTE.length - 3; const TRUNK = [...ROUTE.slice(0, JN + 1), ...EXT.slice(1)];
  const TS = [0]; for (let i = 1; i < TRUNK.length; i += 1) TS.push(TS[i - 1] + Math.hypot(TRUNK[i][0] - TRUNK[i - 1][0], TRUNK[i][1] - TRUNK[i - 1][1]));
  const SJ = TS[JN]; const SPUR = ROAD_LEN - SR[JN]; const TRUNK_LEN = TS[TS.length - 1];
  function atS(s) { let i = 1; while (i < TRUNK.length - 1 && TS[i] < s) i += 1; const [ax, az] = TRUNK[i - 1]; const [bx, bz] = TRUNK[i]; const t = Math.max(0, Math.min(1, (s - TS[i - 1]) / (TS[i] - TS[i - 1] || 1))); return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az) }; }
  const ROADSTOPS = Object.freeze({
    dock: Object.freeze({ id: 'dock', label: '배 타는 곳', s: 52.3, side: 1 }), waterfront: Object.freeze({ id: 'waterfront', label: '물가 거리', s: 92.1, side: 1 }),
    museum: Object.freeze({ id: 'museum', label: '박물관·잔치마루', s: 177.2, side: 1 }),
    /* (1.10.395 사용자 결정 50 A: ④ before the bend at (102, 110) -- 6.75 m from both crossings either side (s 218.3 and 231.8), about 35 m to 달끝역's way in) */
    dalkkeut: Object.freeze({ id: 'dalkkeut', label: '달끝나루·달끝역', s: 225, side: 1 }), /* (1.10.397 N4-c ⑥ · ⑦ on the village street (notes n4-plan §3-3): x -3 (9 m from the crossing at -12) and x 106 (8 m past the one at 98); their
       signs on the south walk, the yards' fences behind -- signOut 1.0) */
    villageMid: Object.freeze({ id: 'villageMid', label: '마을 가운데', s: 475.1, side: 1, signOut: 1.0 }), villageEast: Object.freeze({ id: 'villageEast', label: '마을 동쪽 끝', s: 584.1, side: 1, signOut: 1.0 }),
    isleFork: Object.freeze({ id: 'isleFork', label: '툇마루섬 갈림길', s: 365, side: 1 }),
  });
  const isTerminal = (id) => Boolean(STOPS[id]); const labelOf = (id) => (STOPS[id] || ROADSTOPS[id])?.label || '';
  const sOf = (id) => (id === 'plaza' ? 0 : id === 'isle' ? SJ : id === 'head' ? TRUNK_LEN : ROADSTOPS[id]?.s ?? NaN); /* (397: 마을 at its corner on the trunk -- distanceOf adds its spur) */
  const toOf = (ride) => ride.to || STOPS[ride.from]?.to; // (a ride's end: named, or the other terminal as before 392)
  // a stop's curb: the car's spot at the road's side by its sign, facing the way from 대청마당; its sign 1.2 m further out
  function curbOf(id) { const r = ROADSTOPS[id]; const p = atS(r.s); const c = (LANE + 1.2) * r.side; const so = (r.signOut ?? 2.2) * r.side; return { x: p.x + Math.cos(p.yaw) * c, z: p.z - Math.sin(p.yaw) * c, yaw: p.yaw, sign: { x: p.x + Math.cos(p.yaw) * (c + so), z: p.z - Math.sin(p.yaw) * (c + so), yaw: p.yaw - (Math.PI / 2) * r.side } }; } /* (397 ⑥⑦: on the village street the sign on its walk -- signOut 1.0, the yards' fences behind) */
  // the road between two places: its start (a terminal's front place, or a stop's curb), the road's points past 10 m of a terminal end and
  // 6 m of a stop, its end (a terminal's drop spot by its shelter, or a stop's curb). Between the two terminals: the drive as before
  function driveBetween(from, to) {
    if (STOPS[from] && STOPS[from].to === to) return driveOf(from);
    /* (1.10.397: along the trunk; 마을's spur -- its stop to the corner -- before or after; between the trunk's ends no 10 m left off at the corner) */
    const s0 = sOf(from); const s1 = sOf(to); const dir = Math.sign(s1 - s0) || 1; const m0 = from === 'isle' ? -0.01 : isTerminal(from) ? 10 : 6; const m1 = to === 'isle' ? -0.01 : isTerminal(to) ? 10 : 6;
    const start = isTerminal(from) ? (() => { const s = stopOf(from); return [s.x, s.z]; })() : (() => { const c = curbOf(from); return [c.x, c.z]; })();
    const spur = ROUTE[ROUTE.length - 2]; /* (the spur's middle point, between the corner and 마을's stop) */
    const st = to === 'isle' ? stopOf('isle') : null; /* (into 마을's stop as the classic drive: the points within 10 m of it left out, then its approach) */
    const mids = TRUNK.filter((p, i) => (dir > 0 ? TS[i] > s0 + m0 && TS[i] < s1 - m1 : TS[i] < s0 - m0 && TS[i] > s1 + m1) && !(st && Math.hypot(p[0] - st.x, p[1] - st.z) <= 10)); if (dir < 0) mids.reverse();
    const end = isTerminal(to) ? (() => { const d = dropOf(to); return [d.approach, [d.x, d.z]]; })() : (() => { const c = curbOf(to); return [[c.x, c.z]]; })();
    return [start, ...(from === 'isle' ? [spur] : []), ...mids, ...end];
  }
  // where one gets in at a place: by the car's door as it stands there (a terminal's front place, a stop's curb)
  const boardOf = (id) => { if (STOPS[id]) return stopOf(id).out; const c = curbOf(id); return beside(c.x, c.z, c.yaw, BOARD); };
  // the road's length between two places -- what a fare is by (n4-plan §5-5)
  const distanceOf = (from, to) => (from === to ? 0 : Math.abs(sOf(to) - sOf(from)) + (from === 'isle' ? SPUR : 0) + (to === 'isle' ? SPUR : 0)); /* (397: 마을's spur) */
  // 1.10.391 N4-a (notes docs/n4-plan-20261120.md §5-1, 사용자 N4 §8): keep right -- every car LANE m to its own right of the road's
  // middle, eased in over the first and last LANE_EASE m of a drive; on the one-lane bridge (and LANE_EASE m before it) the middle.
  // Each point of a drive keeps its offset (`offs`): a car going back the same road is shifted by it in its own frame -- its right too
  const LANE = 1.15; const LANE_EASE = 8;
  /* (1.10.397 N4-c: 별마루다리 one lane too -- 61.75 m, and through the wide gate at its head (4.4 m between the posts) to 5 m inside it) */
  const BRIDGE2 = Object.freeze({ x0: 164.5, x1: 233, z0: 222.5, z1: 229.5 }); const BRIDGES = Object.freeze([BRIDGE, BRIDGE2]);
  const bridgeOut = (x, z) => Math.min(...BRIDGES.map((b) => (z < b.z0 - 4 || z > b.z1 + 4 ? Infinity : Math.max(0, b.x0 - x, x - b.x1))));
  const bridgeOf = (x, z, m = 0) => BRIDGES.findIndex((b) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 && z <= b.z1); /* (which one-lane bridge a point is on, -1 none) */
  function laneOffs(road) {
    const ds = [0]; for (let i = 1; i < road.length; i += 1) ds.push(ds[i - 1] + Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1])); const total = ds[ds.length - 1];
    return road.map(([x, z], i) => LANE * Math.min(1, ds[i] / LANE_EASE, (total - ds[i]) / LANE_EASE, bridgeOut(x, z) / LANE_EASE));
  }
  // the time table of a ride's drive: distance gone by each 50 ms, easing in and out; a short road (runMs) is the same drive faster
  const tables = new Map();
  function tableOf(from, runMs, to = STOPS[from]?.to) {
    const key = `${from}|${to}|${runMs || 0}`; if (tables.has(key)) return tables.get(key);
    const road = driveBetween(from, to); /* (392: between any two places; the two terminals as before) */ const ss = segs(road); const total = ss.reduce((n, s) => n + s.len, 0); const offs = laneOffs(road);
    const speedAt = (d) => { let k = 0; let at = 0; while (k < ss.length - 1 && at + ss[k].len < d) { at += ss[k].len; k += 1; } return ss[k].slow ? SLOW : FAST; };
    let cruise = 0; for (const s of ss) cruise += s.len / (s.slow ? SLOW : FAST); const M = cruise * 1000 + EASE; // (easing in and out costs half a ramp each)
    const out = [0]; let d = 0; let u = 0;
    while (d < total && out.length < 100000) { u += STEP; const f = smooth(u / EASE) * smooth((M - u) / EASE + 0.02); d = Math.min(total, d + speedAt(d) * Math.max(0.04, f) * STEP / 1000); out.push(d); }
    const scale = runMs ? runMs / (out.length * STEP) : 1;
    const t = { road, ss, total, offs, ds: out, step: STEP * scale, runMs: out.length * STEP * scale };
    tables.set(key, t); return t;
  }
  const inOf = (ride) => (ride.empty ? 0 : ENTER); const outOf = (ride) => (ride.empty ? 1 : EXIT); /* (392: a car going empty -- no one getting in or out) */
  const durationOf = (ride) => inOf(ride) + tableOf(ride.from, ride.runMs, toOf(ride)).runMs + outOf(ride);
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
    const o = t.offs ? t.offs[k] + (t.offs[k + 1] - t.offs[k]) * u : 0; /* (391: the lane's offset here) */
    return { x, z, yaw, k, o };
  }
  // the ride at `now`: phase enter | start | run | stop | exit | done, where the car is, its heading and lean (back as it goes,
  // forward as it stops, over in a turn), how far the wheels have rolled
  function poseAt(ride, now) {
    const real = now; now = roadNow(ride, now); /* (317: on the road's own clock) */
    const t = tableOf(ride.from, ride.runMs, toOf(ride)); const e = now - ride.startedAt;
    const IN = inOf(ride); const OUT = outOf(ride);
    if (e < IN) { const p = along(t, 0); return { phase: 'enter', ...p, d: 0, pitch: 0, roll: 0, k: e / IN }; }
    const r = e - IN;
    if (r >= t.runMs) { const p = along(t, t.total); const k = (r - t.runMs) / OUT; return { phase: k >= 1 ? 'done' : 'exit', ...p, d: t.total, pitch: 0, roll: 0, k: Math.min(1, k) }; }
    const i = r / t.step; const i0 = Math.floor(i); const d = t.ds[Math.min(t.ds.length - 1, i0)] + ((t.ds[Math.min(t.ds.length - 1, i0 + 1)] - t.ds[Math.min(t.ds.length - 1, i0)]) * (i - i0));
    const p = along(t, d); const ahead = along(t, Math.min(t.total, d + 3));
    const acc = r < EASE * (t.runMs / (t.ds.length * STEP) || 1) ? 'start' : r > t.runMs - EASE * (t.runMs / (t.ds.length * STEP) || 1) ? 'stop' : 'run';
    return shifted({ phase: acc, ...p, d, pitch: acc === 'start' ? -0.04 : acc === 'stop' ? 0.05 : 0, roll: Math.max(-0.06, Math.min(0.06, wrap(ahead.yaw - p.yaw) * 0.25)), k: d / t.total }, sideAt(ride, real) + p.o); /* (340: aside, by server time; 391: in its lane) */
  }
  // v1.10.294 7: the stop's car for a ride -- its way there (poseAt), then empty: turning round where it let the rider out (TURN
  // ms), the same road back on the same timing reversed, turning round again into its place at its stop; null once it stands
  // there. backOf: when that is (the stop has no car till then -- TAXI_AWAY)
  // (1.10.391 N4-a) a car that stays where it let its rider out (`ride.stay`, the server's call as it set off: that stop had fewer than two)
  // glides from where it stopped into its standing place there (`ride.park`) over TURN ms; one going back ends in `ride.park` at home
  const TURN = 3000;
  const backRoad = (ride) => ride.startedAt + durationOf(ride) + TURN + (ride.stay ? 0 : tableOf(ride.from, ride.runMs, toOf(ride)).runMs + TURN);
  const backOf = (ride, now = Date.now()) => realAt(ride, backRoad(ride), now); // (317: in server time -- later by every wait; 391: or parked where it stays)
  const PLACES = 2; const BACK = 4.5; // (391: a stop's standing places -- 0 its front, where one gets in; 1 the same way 4.5 m behind it)
  function placeOf(id, k = 0) { if (!STOPS[id]) { const c = curbOf(id); return { x: c.x, z: c.z, yaw: c.yaw }; } /* (392: a stop's one place, its curb) */ const s = stopOf(id); const b = k ? BACK : 0; return { x: s.x - Math.sin(s.yaw) * b, z: s.z - Math.cos(s.yaw) * b, yaw: s.yaw }; }
  const glide = (a, b, k, d) => { const s = smooth(k); return { phase: 'turn', x: a.x + (b.x - a.x) * s, z: a.z + (b.z - a.z) * s, yaw: a.yaw + wrap(b.yaw - a.yaw) * s, d, pitch: 0, roll: 0, k }; };
  // (317) the ride over (the rider out at the other stop) by server time `now`
  const rideOver = (ride, now) => roadNow(ride, now) >= ride.startedAt + durationOf(ride);
  function carAt(ride, now) {
    const p = poseAt(ride, now); if (p.phase !== 'done') return p;
    const real = now; now = roadNow(ride, now);
    const t = tableOf(ride.from, ride.runMs, toOf(ride)); const e = now - ride.startedAt - durationOf(ride);
    const turn = (q, k) => ({ phase: 'turn', ...q, yaw: wrap(q.yaw + Math.PI * smooth(k)), d: q.d, pitch: 0, roll: 0, k });
    if (ride.stay) { if (e >= TURN) return null; const a = along(t, t.total); return glide(a, placeOf(toOf(ride), ride.park || 0), e / TURN, t.total); } /* (391: into its place there) */
    if (e < TURN) return turn({ ...along(t, t.total), d: t.total }, e / TURN);
    const r = e - TURN; if (r < t.runMs) {
      const i = (t.runMs - r) / t.step; const i0 = Math.floor(i); const at = (j) => t.ds[Math.min(t.ds.length - 1, Math.max(0, j))]; const d = at(i0) + (at(i0 + 1) - at(i0)) * (i - i0);
      const q = along(t, d); return shifted({ phase: 'back', ...q, yaw: wrap(q.yaw + Math.PI), d, pitch: 0, roll: 0, k: 1 - d / t.total }, sideAt(ride, real) + q.o); /* (391: its own lane, its right going back) */
    }
    const k = (r - t.runMs) / TURN; if (k >= 1) return null;
    const s = along(t, 0); if (ride.park) return glide({ x: s.x, z: s.z, yaw: wrap(s.yaw + Math.PI) }, placeOf(ride.from, ride.park), k, 0); /* (391: its place behind) */
    return turn({ ...s, yaw: wrap(s.yaw + Math.PI), d: 0 }, k);
  }
  // ---- 1.10.391 N4-a the cars (notes n4-plan §4, 사용자 N4 §8 · 11-20 「가까운 빈자리를 채우는 걸로」): PLACES at each stop at the start; a ride
  // takes a stop's front car (the one behind pulls up); it stays where it lets its rider out when that stop has fewer than PLACES
  // (standing there, staying there after a ride, going back there), else it goes back empty to where it came from. The server keeps
  // `fleet`; pure here (test/island-taxi-fleet.test.js). A car: { id, at, place, ride, pulledAt } -- `at` null while out on `ride`
  function createFleet(now = 0) { const cars = []; let n = 0; for (const id of Object.keys(STOPS)) for (let k = 0; k < PLACES; k += 1) cars.push({ id: `t${++n}`, at: id, place: k, ride: null, pulledAt: 0 }); return { cars, at: now }; }
  /* (a car out whose ride has not ended yet is nobody's yet: where it goes is decided as its rider gets out -- settle) */
  const headingTo = (c) => (!c.ride ? c.at : c.ride.stay === true ? toOf(c.ride) : c.ride.stay === false ? c.ride.from : null);
  const countAt = (fleet, stop) => fleet.cars.filter((c) => headingTo(c) === stop).length;
  const freePlace = (fleet, stop, except) => { const used = new Set(fleet.cars.filter((c) => c !== except && headingTo(c) === stop).map((c) => (c.ride ? c.ride.park || 0 : c.place))); for (let k = 0; k < PLACES; k += 1) if (!used.has(k)) return k; return 0; };
  const standingAt = (fleet, stop) => fleet.cars.filter((c) => !c.ride && c.at === stop).sort((a, b) => a.place - b.place);
  // a ride from `from`: its car (the front one), the one behind pulled up, where it goes after -> { car, undo } or null (none standing)
  function takeCar(fleet, from, ride, now) {
    const standing = standingAt(fleet, from); const car = standing[0]; if (!car) return null;
    const was = fleet.cars.map((c) => ({ c, at: c.at, place: c.place, ride: c.ride, pulledAt: c.pulledAt }));
    car.ride = ride; car.at = null; ride.car = car.id; ride.seat = 0;
    for (const c of standing.slice(1)) if (c.place > 0 && !standingAt(fleet, from).some((o) => o.place === 0)) { c.place = 0; c.pulledAt = now; }
    return { car, undo: () => { for (const w of was) Object.assign(w.c, { at: w.at, place: w.place, ride: w.ride, pulledAt: w.pulledAt }); delete ride.car; delete ride.seat; } };
  }
  // the clock moved on: a ride just over decides where its car goes (stays where that stop has fewer than PLACES, else back home) and
  // which place it takes; each car whose glide or way back is over stands in it -> whether anything changed
  // (392 N4-b) after a ride to a stop, or to a full terminal from a stop: empty to the nearest terminal with room (by the road; none: the nearer)
  const nearestRoom = (fleet, from, except) => Object.keys(STOPS).sort((a, b) => distanceOf(a, from) - distanceOf(b, from)).find((t) => fleet.cars.filter((c) => c !== except && headingTo(c) === t).length < PLACES) || Object.keys(STOPS).sort((a, b) => distanceOf(a, from) - distanceOf(b, from))[0];
  function goEmpty(fleet, c, from, now) { const to = nearestRoom(fleet, from, c); const runMs = c.ride?.runMs || fleet.runMs; c.ride = { from, to, startedAt: now, empty: true, car: c.id, seat: 0, ...(runMs ? { runMs } : {}), stay: true, park: 0 }; c.ride.park = freePlace(fleet, to, c); c.at = null; c.waitUntil = 0; }
  const WAIT = 15000; // (a car fetched to a stop waits this long for its caller, then goes to the nearest terminal with room)
  function settle(fleet, now) {
    let moved = false;
    for (const c of fleet.cars) if (c.ride && c.ride.stay === undefined && rideOver(c.ride, now)) {
      const to = toOf(c.ride); moved = true;
      if (isTerminal(to) && countAt(fleet, to) < PLACES) { c.ride.stay = true; c.ride.park = freePlace(fleet, to, c); }
      else if (isTerminal(to) && isTerminal(c.ride.from)) { c.ride.stay = false; c.ride.park = freePlace(fleet, c.ride.from, c); } /* (the way back the same road, as before) */
      else goEmpty(fleet, c, to, now); /* (392: from where it let its rider out) */
    }
    for (const c of fleet.cars) if (c.ride && c.ride.stay !== undefined && now >= backOf(c.ride, now)) {
      const fetched = c.ride.empty && !isTerminal(toOf(c.ride)); c.at = c.ride.stay ? toOf(c.ride) : c.ride.from; c.place = c.ride.park || 0; c.ride = null; c.pulledAt = 0; c.waitUntil = fetched ? now + WAIT : 0; moved = true; }
    for (const c of fleet.cars) if (!c.ride && c.at && !isTerminal(c.at) && c.waitUntil && now >= c.waitUntil) { goEmpty(fleet, c, c.at, now); moved = true; } /* (no one got in: off) */
    return moved;
  }
  // (392 N4-b) a call at a stop: the nearest car standing at a terminal (its front one) is sent there empty -> the car, or null (none standing)
  function sendCar(fleet, stop, now, runMs) {
    const from = Object.keys(STOPS).filter((t) => standingAt(fleet, t).length).sort((a, b) => distanceOf(a, stop) - distanceOf(b, stop))[0]; if (!from) return null;
    const ride = { from, to: stop, startedAt: now, empty: true, ...(runMs ? { runMs } : {}) }; const took = takeCar(fleet, from, ride, now); if (!took) return null;
    ride.stay = true; ride.park = 0; return took.car;
  }
  // when a car will next stand at `stop` (ms from now; 0 one is there)
  function etaAt(fleet, stop, now) {
    if (standingAt(fleet, stop).length) return 0; let best = Infinity;
    for (const c of fleet.cars) { if (!c.ride) continue; const h = headingTo(c); /* (one not decided yet: as if it came back here, or stayed here after letting its rider out) */
      if (h === stop || (h === null && (c.ride.from === stop || toOf(c.ride) === stop))) best = Math.min(best, (h === null && c.ride.from !== stop ? realAt(c.ride, c.ride.startedAt + durationOf(c.ride) + TURN, now) : backOf(c.ride, now)) - now); }
    return Number.isFinite(best) ? Math.max(1, best) : 1000;
  }
  const fleetView = (fleet) => ({ cars: fleet.cars.map((c) => ({ id: c.id, at: c.at, place: c.place, pulledAt: c.pulledAt || 0, ride: c.ride })) });
  // where the rider stands once out (and where a ride cut off counts them): beside the car as it stands at the other stop
  const arrivalOf = (ride) => { const t = tableOf(ride.from, ride.runMs, toOf(ride)); const p = along(t, t.total); return beside(p.x, p.z, p.yaw, ALIGHT); };
  // the door's opening (0 shut .. 1 open) through a getting in or out (motion-utils doorAngle: in 0..0.14 open, 0.86..1 shut;
  // out 0..0.12 open, 0.80..1 shut)
  const doorOf = (phase, k) => (phase === 'enter' ? (k < 0.5 ? smooth(k / 0.14) : 1 - smooth((k - 0.86) / 0.14)) : phase === 'exit' ? (k < 0.5 ? smooth(k / 0.12) : 1 - smooth((k - 0.8) / 0.2)) : 0);
  const fareOf = ({ fare = FARE, from = '', to = '' } = {}) => Math.max(0, Math.round(Number(fare) || 0)) + (EXTRA[`${from}>${to}`] || 0);
  // v1.10.294 6a: the screen's clock offset a frame toward the server's -- at most `step` ms, at once past `jump` (a first
  // reading, a sleep): a clock answer moving it tens of ms at once made a moving car jump that far
  const easeClock = (view, server, step = 2, jump = 1000) => (view == null || Math.abs(server - view) > jump ? server : view + Math.max(-step, Math.min(step, server - view)));
  // (392 N4-b, 결정 40 A · n4-plan §5-5) a fare by the road's length: per100 a 100 m (the nearest 100 m), at least min
  const fareByRoad = (from, to, per100 = 250, min = 500) => Math.max(Math.round(Number(min) || 0), Math.round(Number(per100) || 0) * Math.round(distanceOf(from, to) / 100));
  const PLACE_IDS = () => ['plaza', 'isle', 'head', ...Object.keys(ROADSTOPS)].sort((a, b) => sOf(a) - sOf(b)); /* (397: by the trunk -- 마을 at its corner, 별마루섬 입구 last) */
  return { boardOf, ROADSTOPS, ROAD_LEN, sOf, atS, curbOf, driveBetween, distanceOf, fareByRoad, PLACE_IDS, isTerminal, labelOf, toOf, sendCar, WAIT, nearestRoom, /* (392 N4-b) */
    LANE, PLACES, BACK, placeOf, laneOffs, createFleet, takeCar, settle, etaAt, fleetView, countAt, standingAt, onBridgeBox: (x, z, m = 0) => bridgeOf(x, z, m) >= 0, bridgeOf, BRIDGES, /* (391 N4-a; 397 both one-lane bridges) */ TRUNK, TRUNK_LEN, SPUR,
    CROSSINGS, CROSS_HALF, CROSS_CLEAR, ROAD, LEAD, RAMP, sideAt, ghostAt, shifted, roadNow, rateOf, warpTo, realAt, rideOver, TURN, backOf, carAt, easeClock, ROUTE, EXT, ROADS, STREET, ROAD_ENDS: Object.freeze([ROUTE[0], ROUTE[ROUTE.length - 1], EXT[EXT.length - 1]]) /* (395: the stops at the roads' ends -- kept clear round, as the two were) */, STOPS, BRIDGE, ENTER, EXIT, EASE, FAST, SLOW, FARE, DAY_PASS, EXTRA, BOARD, ALIGHT, SEAT, roadOf, stopOf, dropOf, driveOf, tableOf, durationOf, poseAt, arrivalOf, doorOf, fareOf };
}));
