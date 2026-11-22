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
  const ROUTE = [[8,-53],[4.4,-52.6],[0.8,-52.2],[0.7,-48.5],[0.7,-44.7],[0.6,-40.9],[0.6,-37.1],[0.5,-33.3],[0.5,-29.5],[0.5,-25.7],[0.4,-21.9],[0.4,-18.1],[0.4,-16.2],[0.6,-14.3],[1.2,-12.4],[2.1,-10],[2.5,-8.4],[4,-7.7],[7.8,-7.3],[11.6,-6.9],[15.4,-6.5],[19.2,-6.1],[22.9,-5.7],[26.5,-4.6],[30,-3.4],[33.3,-2.2],[36.7,-1.1],[40.2,0.1],[43.9,1.4],[47.1,3.3],[50.5,5.3],[53.9,7.3],[57.3,9.3],[58.5,10.2],[59.6,11.4],[60.7,12.6],[62,14.9],[63.1,16.6],[64.4,18],[67.3,20.5],[70.2,23.1],[73,25.7],[74.8,27.3],[77.1,30.5],[79.4,33.6],[81.6,36.6],[83.9,39.6],[86.3,42.8],[87.3,44.3],[89,47.7],[90.7,51.2],[92.4,54.6],[93.3,56.3],[94.6,59.9],[95.3,62],[96.1,63.6],[98.2,66.7],[99,68.3],[99.6,70.1],[100.3,74],[101,78],[101.6,81.9],[102.2,85.4],[102.8,88.7],[102.7,92.5],[102.6,96.1],[102.5,99.7],[102.4,103.3],[102.3,107],[101.7,110.5],[101,114.3],[100.4,117.8],[100.1,119.3],[98.9,123],[97.8,126.5],[96.9,129.2],[96.1,131],[95.4,132.4],[94.5,133.6],[92.8,135.6],[90.9,136.9],[88,139.2],[86.3,140],[82.3,140],[78.4,140],[74.4,140],[70.5,140],[66.5,140],[62.6,140],[58.6,140],[54.7,140],[50.8,140],[46.8,140],[42.9,140],[38.9,140],[35,140],[31,140],[27.1,140.6],[24.6,140.6],[22.6,140.4],[21.2,140.1],[17.7,139.2],[15.8,138.9],[14.3,138.8],[10.3,138.9],[6.4,138.9],[2.4,139],[0.5,139.1],[-1,139.4],[-3.5,140.1],[-5.5,140.7],[-7.4,141.1],[-11.4,141.1],[-15.3,141.2],[-19.2,141.3],[-19.3,145.2],[-19.4,149.1],[-19.4,153.1],[-19.5,157],[-19.6,160.9],[-19.6,164.9],[-19.7,168.8],[-19.7,172.8],[-16,172.9],[-13.3,173.1]];
  /* (1.10.407 assets 170, notes bridges-two-way §6: over the wide 윤슬다리 (x 31 ~ 87.35) the road's middle on the bridge's own, z 140 -- it lay up to 0.5 m
     off; two lanes there now, each car in its own) */
  /* 1.10.395 N4-c (notes n4-plan-20261120 §5-3): the road on to 별마루섬 -- from the corner before 툇마루섬 마을's stop (ROUTE's third
     last point) north up the neck's walk (x -20), east along the village street (z 236: the yards' front fences stand at 232.1 and
     239.9 whatever their size, the road's 7.8 m just between), straight on past lot14's corner to x 116, then 별마루다리's walk, over
     the bridge and through the wide gate (assets 163) to 10.5 m inside it, where the third stop comes (396). Found on today's ground
     (work: build-ext395): no water but the bridge, no slope over 0.3, no yard of any size within 3.9 m, nothing built in its band.
     The roads are ROADS -- the ground's band, its paint, the islanders' crossings and what is put beside it read them all.
     1.10.408 assets 171 (notes bridges-two-way §6): over the wide 별마루다리 (x 165.25 ~ 227) the middle on the bridge's own, z 226 -- it lay 0.4 m off */
  const EXT = [[-19.7,172.8],[-19.7,175.4],[-19.8,178],[-19.9,180.7],[-19.9,183.3],[-20,186],[-20,189.8],[-20,193.6],[-20,197.5],[-20,201.3],[-20,205.1],[-20,208.9],[-20,212.7],[-20,216.5],[-20,220.4],[-20,224.2],[-20,228],[-19.6,230.1],[-19.2,232.2],[-17,235.2],[-15,235.6],[-13,236],[-9.1,236],[-5.2,236],[-1.3,236],[2.6,236],[6.5,236],[10.5,236],[14.4,236],[18.3,236],[22.2,236],[26.1,236],[30,236],[33.9,236],[37.8,236],[41.7,236],[45.6,236],[49.5,236],[53.5,236],[57.4,236],[61.3,236],[65.2,236],[69.1,236],[73,236],[76.9,236],[80.8,236],[84.7,236],[88.6,236],[92.5,236],[96.5,236],[100.4,236],[104.3,236],[108.2,236],[112.1,236],[116,236],[118.4,235],[120.9,234.1],[124.7,233.7],[128.3,233.4],[131.8,233],[135.1,232.7],[138.7,232.2],[142,231.6],[144.8,231],[147.8,230.2],[151.2,229],[154.9,227.6],[156.9,227],[159.1,226.5],[161.6,226.1],[165.3,226],[169,226],[172.9,226],[176.1,226],[179.4,226],[182.7,226],[186.1,226],[189.5,226],[192.8,226],[196,226],[199.3,226],[202.9,226],[206.5,226],[210.3,226],[213.9,226],[217.5,226],[220.8,226],[224.5,226],[226.2,226],[228.2,225.9],[231.1,226.6],[234.8,227.5],[238.4,228.4]];
  /* 1.10.411 L2 (사용자 결정 67 · 69, notes taxi-island-loop §2 A ㄱ~ㅂ): the west road's south half -- from the corner by 배 타는 곳 (ROUTE's vertex
     there, the graph's junction) along the west waterfront, the west shore and over the west river (assets 173, on its axis) to 초승 곶 -- and (1.10.412 L3)
     on over the west 윤슬다리 (high and wide now, z 140) to the 툇마루섬 fork, ROUTE's vertex there: the ring closed, the island's road a loop and
     its spurs (notes taxi-island-loop §4: P · E · W · N · M · X1 · X2 · V). The east road mirrored (x -> -x), 2.6 m west round (-100, 72) and 1.5 m east at the cape
     where the band's edge met the water (work: l2gen) */
  const L2 = [[0.4,-16.2],[-0.6,-14.3],[-1.2,-12.4],[-2.1,-10],[-2.5,-8.4],[-4,-7.7],[-7.8,-7.3],[-11.6,-6.9],[-15.4,-6.5],[-19.2,-6.1],[-22.9,-5.7],[-26.5,-4.6],[-30,-3.4],[-33.3,-2.2],[-36.7,-1.1],[-40.2,0.1],[-43.9,1.4],[-47.1,3.3],[-50.5,5.3],[-53.9,7.3],[-57.3,9.3],[-58.5,10.2],[-59.6,11.4],[-60.7,12.6],[-62,14.9],[-63.1,16.6],[-64.4,18],[-67.3,20.5],[-70.2,23.1],[-73,25.7],[-74.8,27.3],[-77.1,30.5],[-79.4,33.6],[-81.6,36.6],[-83.9,39.6],[-86.3,42.8],[-87.3,44.3],[-88.78,47.31],[-89.6,49.13],[-95.4,61.87],[-96.22,63.69],[-99.1,66.7],[-100.7,68.3],[-102.1,70.1],[-102.9,74],[-103.6,78],[-104.2,81.9],[-104.8,85.4],[-105.4,88.7],[-105.3,92.5],[-105.2,96.1],[-105.1,99.7],[-105,103.3],[-104.9,107],[-104.3,110.5],[-103.6,114.3],[-103,117.8],[-102.7,119.3],[-101.5,123],[-99.8,126.5],[-97.3,129.2],[-95.5,131],[-94.2,132.4],[-93,133.6],[-91.4,135.6],[-90.2,136.9],[-88,139.2],[-86.3,140],[-82.3,140],[-78.4,140],[-74.4,140],[-70.5,140],[-66.5,140],[-62.6,140],[-58.6,140],[-54.7,140],[-50.8,140],[-46.8,140],[-42.9,140],[-38.9,140],[-35,140],[-31,140],[-27,140.4],[-23,141],[-19.2,141.3]];
  /* 1.10.411 L1 (사용자 결정 65-4 A, notes issues-taxi-resident §4 · assets 179 ①): the village street's west half -- off EXT at the neck's corner (its
     vertex (-19.2, 232.2)), round the corner as EXT turns east (mirrored), along z 236 between the yards' front fences (232.1 · 239.9) to x -126 */
  const L1 = [[-19.2, 232.2], [-21.4, 235.2], [-23.4, 235.6], [-25.4, 236], ...Array.from({ length: 26 }, (_, i) => [-29.4 - i * 3.8, 236]), [-126, 236]];
  const ROADS = Object.freeze([ROUTE, EXT, L2, L1]);
  /* (1.10.405 L0: the roads whose ground is banked up where it is low (dalmaru-island roadBank) -- the first road; the loop's new roads go here too.
     Not EXT: banked, it would build 8 m out into the sea by 별마루다리's west end. 411: L2, along the west shore) */
  const BANKED = Object.freeze([ROUTE, L2]);
  /* (the village street: its lamps keep to its walks -- 3.3 m out, as they stood -- the yards' fences right behind them) */
  const STREET = Object.freeze({ x0: -126, x1: 116, z: 236, lamp: 3.3 }); /* (411 L1: its west half too -- assets 179 ①) */
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
    [-20,224],[-12,236],[14,236],[42,236],[70,236],[98,236],
    /* (1.10.411 L1: the west half's yard gates, as the east's -- assets 179 ①) */
    [-42,236],[-70,236],[-98,236],[-126,236],
    /* (1.10.411 L2: where the islanders' rounds cross it, as T1 did the east -- the west waterfront (3), the west shore, by its end at the cape) */
    [-25.2,-5],[-34.2,-1.9],[-48.3,4],[-102.4,71.5], /* (the third slid 6.5 m on: a waterfront lamp 4.6 m off at -42.6) */
    /* (1.10.412 L3: the west 윤슬다리's two, the east's mirrored (92.8, 135.6) · (25.5, 140.6) -- onto the line, clear (work: slide411)) */
    [-91.9,134.9],[-25.5,140.6],
    /* (and on the east waterfront, 9.5 m on from its mirror -- clear of 물가 거리's curbs: the bench there by the bay (40.1, 3.3) a round's stop now) */
    [50.9,5.5]].map(([x, z]) => Object.freeze({ x, z })));
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
    return { p, q, len, yaw: Math.atan2(q[0] - p[0], q[1] - p[1]), slow: mx >= BRIDGE.x0 && mx <= BRIDGE.x1 && mz >= BRIDGE.z0 && mz <= BRIDGE.z1, turn: i < (pts.turn || 0) - 1 /* (411: a road stop's turning round) */ }; });
  const TURN_V = 2.5; /* (411: m/s round a stop's half circle -- a walk) */
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
    /* (1.10.411 L1 · L2 (assets 179 ③, 결정 65-3 A both sides): stops on the new roads -- `road` and `d` along it from its start (+1 the right going
       from the corner / westward); the west waterfront's bay side a sign on its walk (signOut 1.0, the railing its edge) as the village street's) */
    westWaterfront: Object.freeze({ id: 'westWaterfront', label: '서쪽 물가 거리', road: 'L2', d: 48, side: 1, signOut: 1.0 }),
    hanokGate: Object.freeze({ id: 'hanokGate', label: '한옥 마을 어귀', road: 'L2', d: 72.6, side: 1 }),
    stones: Object.freeze({ id: 'stones', label: '징검다리·농장', road: 'L2', d: 112.4, side: 1 }),
    choseung: Object.freeze({ id: 'choseung', label: '초승 등대·초승역', road: 'L2', d: 183.9, side: 1 }), /* (179's 185.4 less 1.5: its sign off a post) */
    villageWest: Object.freeze({ id: 'villageWest', label: '마을 서쪽', road: 'L1', d: null, at: [-112, 236], side: 1, signOut: 1.0 }),
  });
  /* (a stop on another road than the trunk: its place by `d` along that road, or the nearest to `at`) */
  const NAMED = Object.freeze({ L1, L2 });
  const alongOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i += 1) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
  function atAlong(pts, d) { const c = alongOf(pts); let i = 1; while (i < pts.length - 1 && c[i] < d) i += 1; const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i]; const t = Math.max(0, Math.min(1, (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1))); return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az) }; }
  const dOn = (pts, [x, z]) => { const c = alongOf(pts); let best = null; for (let i = 1; i < pts.length; i += 1) { const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i]; const L = c[i] - c[i - 1] || 1e-9; const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L))); const e = Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t); if (!best || e < best.e) best = { e, d: c[i - 1] + L * t }; } return best.d; };
  const stopD = (r) => (r.d ?? dOn(NAMED[r.road], r.at));
  const atStop = (id, ds = 0) => { const r = ROADSTOPS[id]; return r.road ? atAlong(NAMED[r.road], stopD(r) + ds) : atS(r.s + ds); };
  const isTerminal = (id) => Boolean(STOPS[id]); const labelOf = (id) => (STOPS[id] || ROADSTOPS[id])?.label || '';
  const sOf = (id) => (id === 'plaza' ? 0 : id === 'isle' ? SJ : id === 'head' ? TRUNK_LEN : ROADSTOPS[id] ? ROADSTOPS[id].s ?? 1e4 + (ROADSTOPS[id].road === 'L1' ? 1e3 : 0) + stopD(ROADSTOPS[id]) /* (411: off the trunk -- after it, L2 then L1, by their own way) */ : NaN); /* (397: 마을 at its corner on the trunk -- distanceOf adds its spur) */
  const toOf = (ride) => ride.to || STOPS[ride.from]?.to; // (a ride's end: named, or the other terminal as before 392)
  // a stop's curb: the car's spot at the road's side by its sign, facing the way from 대청마당; its sign 1.2 m further out
  /* (1.10.410 사용자 결정 65-3 A, notes issues-taxi-resident §3: a stop on both sides of the road -- `side` +1 the right going from 대청마당, -1 the other;
     a car stands on its own way's side, never across the middle line) */
  /* (`far`: the far side's own -- along the road by ds, its sign signOut from the curb -- where its first place met the gangway, the bay's railing or a
     lamp: test/island-taxi's stop checks) */
  const FAR = Object.freeze({ dock: { ds: -0.5 }, waterfront: { ds: 2, signOut: 0.8 }, dalkkeut: { ds: -1 }, isleFork: { ds: 1 }, westWaterfront: { ds: 18.5, signOut: 1.0 } /* (411: the land side's on its walk too, 18.5 m on -- its lamps and benches every few metres: the first clear place on the bend (no base place within d 36 ~ 62 had both sides clear)) */ });
  const farDs = (id, side) => (side !== ROADSTOPS[id].side ? FAR[id]?.ds || 0 : 0); /* (a side's place along its road, from the stop's) */
  function curbOf(id, side = ROADSTOPS[id].side) { const base = ROADSTOPS[id]; const s0 = side < 0 ? -1 : 1; const far = s0 !== base.side ? FAR[id] || {} : {};
    const r = { ...base, side: s0, signOut: far.signOut ?? base.signOut }; const p = atStop(id, far.ds || 0); const c = (LANE + 1.2) * r.side; const so = (r.signOut ?? 2.2) * r.side; return { x: p.x + Math.cos(p.yaw) * c, z: p.z - Math.sin(p.yaw) * c, yaw: r.side < 0 ? Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)) : p.yaw /* (410: the far side's car faces the other way) */, side: r.side, sign: { x: p.x + Math.cos(p.yaw) * (c + so), z: p.z - Math.sin(p.yaw) * (c + so), yaw: p.yaw - (Math.PI / 4) * r.side } }; } /* (1.10.398 에셋 검사 2회차 「길에서 옆면만」: its plate turned 45° -- read coming along the road and from across it, both faces) */ /* (397 ⑥⑦: on the village street the sign on its walk -- signOut 1.0, the yards' fences behind) */
  // the road between two places: its start (a terminal's front place, or a stop's curb), the road's points past 10 m of a terminal end and
  // 6 m of a stop, its end (a terminal's drop spot by its shelter, or a stop's curb). Between the two terminals: the drive as before
  function driveBetween(from, to, curb) {
    if (STOPS[from] && STOPS[from].to === to) return driveOf(from);
    return driveByGraph(from, to, curb); /* (1.10.405 L0: by the roads' graph -- the trunk's own way while the roads are a tree) */
  }
  /* 1.10.405 L0 길 계산 틀 (notes taxi-island-loop-20261122 §4, 사용자 결정 69): the roads as a graph -- each road cut into pieces where another
     begins or ends on it; a place stands on a piece (its foot: its point on the road); between two places the shortest way along the pieces.
     Today's roads are a tree -- one way between any two, the trunk's own, the same points and lengths; the island's loop (L2, L3) is pieces
     more, nothing else here */
  const ptKey = ([x, z]) => `${Math.round(x * 100)},${Math.round(z * 100)}`;
  const GRAPH = (() => {
    const ends = new Set(); for (const r of ROADS) { ends.add(ptKey(r[0])); ends.add(ptKey(r[r.length - 1])); }
    const nodes = new Map(); const nodeOf = (p) => { const k = ptKey(p); if (!nodes.has(k)) nodes.set(k, { id: nodes.size, x: p[0], z: p[1] }); return nodes.get(k); };
    const pieces = [];
    for (const r of ROADS) { let c0 = 0; for (let i = 1; i < r.length; i += 1) if (i === r.length - 1 || ends.has(ptKey(r[i]))) { const pts = r.slice(c0, i + 1); const cum = [0]; for (let k = 1; k < pts.length; k += 1) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); pieces.push({ pts, cum, len: cum[cum.length - 1], a: nodeOf(pts[0]).id, b: nodeOf(pts[pts.length - 1]).id }); c0 = i; } }
    const n = nodes.size; const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity))); const hop = Array.from({ length: n }, () => Array(n).fill(-1)); const by = Array.from({ length: n }, () => Array(n).fill(-1));
    pieces.forEach((p, k) => { if (p.len < D[p.a][p.b]) { D[p.a][p.b] = p.len; D[p.b][p.a] = p.len; hop[p.a][p.b] = p.b; hop[p.b][p.a] = p.a; by[p.a][p.b] = k; by[p.b][p.a] = k; } });
    for (let k = 0; k < n; k += 1) for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (D[i][k] + D[k][j] < D[i][j]) { D[i][j] = D[i][k] + D[k][j]; hop[i][j] = hop[i][k]; }
    return { pieces, D, hop, by };
  })();
  // a point's foot on the roads: its piece, how far along it, the point there
  function footOn(x, z) {
    let best = null;
    GRAPH.pieces.forEach((p, k) => { for (let i = 1; i < p.pts.length; i += 1) { const [ax, az] = p.pts[i - 1]; const [bx, bz] = p.pts[i]; const dx = bx - ax; const dz = bz - az; const L = Math.hypot(dx, dz) || 1e-9; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L))); const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (!best || d < best.d - 1e-9) best = { d, piece: k, along: p.cum[i - 1] + L * t, x: ax + dx * t, z: az + dz * t }; } });
    return best;
  }
  const footOf = (id) => { const p = id === 'plaza' ? ROUTE[0] : id === 'isle' ? ROUTE[ROUTE.length - 1] : id === 'head' ? EXT[EXT.length - 1] : (() => { const q = atStop(id); return [q.x, q.z]; })(); return footOn(p[0], p[1]); };
  // a piece's points from `along` a to b (either way), ends included
  function stretch(p, a, b) {
    const at = (s) => { let i = 1; while (i < p.pts.length - 1 && p.cum[i] < s) i += 1; const t = (s - p.cum[i - 1]) / ((p.cum[i] - p.cum[i - 1]) || 1); return [p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * t, p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * t]; };
    const inner = p.pts.map((q, i) => [q, p.cum[i]]).filter(([, s]) => (a < b ? s > a + 1e-6 && s < b - 1e-6 : s < a - 1e-6 && s > b + 1e-6)).map(([q]) => q); if (a > b) inner.reverse();
    return [at(a), ...inner, at(b)];
  }
  // the shortest way between two feet: { len, pts }
  function wayBetween(fa, fb) {
    const A = GRAPH.pieces[fa.piece]; const B = GRAPH.pieces[fb.piece];
    if (fa.piece === fb.piece) return { len: Math.abs(fb.along - fa.along), pts: stretch(A, fa.along, fb.along) };
    let best = null;
    for (const [na, ca] of [[A.a, fa.along], [A.b, A.len - fa.along]]) for (const [nb, cb] of [[B.a, fb.along], [B.b, B.len - fb.along]]) { const len = ca + GRAPH.D[na][nb] + cb; if (!best || len < best.len - 1e-9) best = { len, na, nb }; }
    const pts = stretch(A, fa.along, best.na === A.a ? 0 : A.len);
    for (let u = best.na; u !== best.nb;) { const w = GRAPH.hop[u][best.nb]; const p = GRAPH.pieces[GRAPH.by[u][w]]; const seg = stretch(p, p.a === u ? 0 : p.len, p.a === u ? p.len : 0); pts.push(...seg.slice(1)); u = w; }
    pts.push(...stretch(B, best.nb === B.a ? 0 : B.len, fb.along).slice(1));
    return { len: best.len, pts };
  }
  /* 1.10.412 L3 「섬 한 바퀴」 (사용자 결정 69 A, notes taxi-island-loop §6): a ride whose end is where it began -- once round the ring (the pieces on
     the island's one loop), 윤슬만 on the car's right (its lane the waterside one); from a place off the ring out along its spur to the ring's
     nearest corner, round, and back the same way */
  const RING = (() => {
    const P = GRAPH.pieces;
    const joined = (a, b, skip) => { const seen = new Set([a]); const q = [a]; while (q.length) { const u = q.pop(); if (u === b) return true; P.forEach((p, k) => { if (k === skip) return; const v = p.a === u ? p.b : p.b === u ? p.a : -1; if (v >= 0 && !seen.has(v)) { seen.add(v); q.push(v); } }); } return false; };
    const C = P.map((_, k) => k).filter((k) => P[k].a !== P[k].b && joined(P[k].a, P[k].b, k)); if (C.length < 2) return null;
    let pts = []; let u = P[C[0]].a; let k = C[0]; const used = new Set();
    for (;;) { used.add(k); const p = P[k]; const fwd = p.a === u; const seg = fwd ? p.pts : [...p.pts].reverse(); pts.push(...(pts.length ? seg.slice(1) : seg)); u = fwd ? p.b : p.a; const next = C.find((j) => !used.has(j) && (P[j].a === u || P[j].b === u)); if (next === undefined) break; k = next; }
    let area = 0; for (let i = 1; i < pts.length; i += 1) area += pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1]; if (area > 0) pts = pts.reverse(); /* (x, z: the inside on the right going round -- the right (dz, -dx)) */
    const cum = [0]; for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const corners = []; for (const j of C) for (const n of [P[j].a, P[j].b]) if (!corners.some((c) => c.id === n)) { const q = P[j].a === n ? P[j].pts[0] : P[j].pts[P[j].pts.length - 1]; corners.push({ id: n, x: q[0], z: q[1] }); }
    return { pts, cum, len: cum[cum.length - 1], pieces: new Set(C), corners };
  })();
  const loops = new Map();
  function loopWay(id) {
    if (!RING) return { len: 0, pts: [] }; if (loops.has(id)) return loops.get(id);
    const f = footOf(id); let out = []; let at = [f.x, f.z];
    if (!RING.pieces.has(f.piece)) { let best = null; for (const c of RING.corners) { const w = wayBetween(f, footOn(c.x, c.z)); if (!best || w.len < best.len - 1e-9) best = w; } out = best.pts; at = out[out.length - 1]; }
    const d = dOn(RING.pts, at); const round = [...stretch(RING, d, RING.len), ...stretch(RING, 0, d).slice(1)];
    const pts = [...out, ...(out.length ? round.slice(1) : round), ...[...out].reverse().slice(1)].filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
    let len = 0; for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const w = { len, pts }; loops.set(id, w); return w;
  }
  const wayOf = (from, to) => (from === to ? loopWay(from) : wayBetween(footOf(from), footOf(to)));
  const loopLenOf = (id) => loopWay(id).len;
  // where one gets in at a place: by the car's door as it stands there (a terminal's front place, a stop's curb)
  const boardOf = (id, side) => { if (STOPS[id]) return stopOf(id).out; const c = curbOf(id, side); return beside(c.x, c.z, c.yaw, BOARD); }; /* (410: by the car on the side it stands) */
  /* (L0: between two places by the graph -- its start (a terminal's front place, a stop's curb), the way's points past m0 of the start and m1 of the
     end (10 m by a terminal, 6 by a stop; 마을 none -- its spur's own; into 마을 the points within 10 m of its stop left out, then its approach), its
     end (a terminal's drop spot by its shelter, or a stop's curb)) */
  /* (1.10.410 결정 65-3 A: the side of a road stop a drive comes in on -- its own way's, the right of where it goes -- and the side it would leave
     from; `curb`: the side the car stands on as it sets off (where it came in), else its leaving side. One standing on the other side turns in
     the road first: 5 m on the way it faces, round, back past its stop) */
  const sideAlong = (id, dx, dz) => { const p = atStop(id); return dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw) >= 0 ? 1 : -1; };
  const dirOf = (pts, last) => { const n = pts.length; for (let i = last ? n - 1 : 1; last ? i > 0 : i < n; i += last ? -1 : 1) { const dx = pts[i][0] - pts[i - 1][0]; const dz = pts[i][1] - pts[i - 1][1]; if (Math.hypot(dx, dz) > 0.01) return [dx, dz]; } return [0, 1]; };
  const arriveSide = (from, to) => (ROADSTOPS[to] && (from !== to || RING) ? sideAlong(to, ...dirOf(wayOf(from, to).pts, true)) : null); /* (412: back where it began -- 「섬 한 바퀴」) */
  const leaveSide = (from, to) => (ROADSTOPS[from] && (from !== to || RING) ? sideAlong(from, ...dirOf(wayOf(from, to).pts, false)) : null);
  /* (411: a road stop's side its own foot on the road -- the far side may stand a little along it (FAR)) */
  const footAt = (id, side) => { if (!ROADSTOPS[id] || !side) return footOf(id); const q = atStop(id, farDs(id, side)); return footOn(q.x, q.z); };
  function driveByGraph(from, to, curb) {
    const kOut = ROADSTOPS[from] ? (curb === 1 || curb === -1 ? curb : leaveSide(from, to)) : null; const kIn = ROADSTOPS[to] ? arriveSide(from, to) : null;
    const w = from === to ? loopWay(from).pts : wayBetween(footAt(from, kOut), footAt(to, kIn)).pts; /* (412 「섬 한 바퀴」) */ const m0 = from === 'isle' ? -0.01 : isTerminal(from) ? 10 : 6; const m1 = to === 'isle' ? -0.01 : isTerminal(to) ? 10 : 6;
    const cum = [0]; for (let i = 1; i < w.length; i += 1) cum.push(cum[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1])); const total = cum[cum.length - 1];
    const st = to === 'isle' ? stopOf('isle') : null;
    const mids = w.filter((p, i) => i > 0 && i < w.length - 1 && cum[i] > m0 && total - cum[i] > m1 && !(st && total - cum[i] < 30 && Math.hypot(p[0] - st.x, p[1] - st.z) <= 10)); /* (412: by the end only -- a ride round from 툇마루섬 sets off by it) */
    const out = leaveSide(from, to); const k = ROADSTOPS[from] ? (curb === 1 || curb === -1 ? curb : out) : null;
    /* (1.10.411 총괄 「옆으로 미끄러짐 · 제자리 돌기」: one standing on the other side turns round slowly -- 3 m on, then a half circle (1.75 m) from its curb
       into the far lane, at a walk, the bow along it, a moment's stop; its lane from there, no easing out of the middle) */
    let turn = 0;
    const start = isTerminal(from) ? [(() => { const s = stopOf(from); return [s.x, s.z]; })()] : (() => { const c = curbOf(from, k); if (k === out) return [[c.x, c.z]];
      const p = atStop(from, farDs(from, k)); const a = [Math.sin(p.yaw), Math.cos(p.yaw)]; const b = [Math.cos(p.yaw), -Math.sin(p.yaw)]; const at = (u, v) => [p.x + a[0] * u + b[0] * v, p.z + a[1] * u + b[1] * v];
      const pts = [[c.x, c.z], at(3 * k, (LANE + 1.2) * k)]; const cv = ((LANE + 1.2 - LANE) / 2) * k; const R = (LANE + 1.2 + LANE) / 2;
      for (let i = 1; i <= 24; i += 1) { const th = (Math.PI * i) / 24; pts.push(at(3 * k + R * k * Math.sin(th), cv + R * k * Math.cos(th))); } turn = pts.length; return pts; })();
    const end = isTerminal(to) ? (() => { const d = dropOf(to); return [d.approach, [d.x, d.z]]; })() : (() => { const c = curbOf(to, arriveSide(from, to)); return [[c.x, c.z]]; })();
    const road = [...start, ...mids, ...end]; if (turn) road.turn = turn; return road;
  }
  const distanceByGraph = (from, to) => (from === to ? 0 : wayBetween(footOf(from), footOf(to)).len);
  // the road's length between two places -- what a fare is by (n4-plan §5-5)
  const distances = new Map(); /* (1.10.405 L0: the shortest way along the roads' graph -- the places never move, kept once a pair) */
  const distanceOf = (from, to) => { if (from === to) return 0; const k = `${from}>${to}`; if (!distances.has(k)) distances.set(k, distanceByGraph(from, to)); return distances.get(k); };
  // 1.10.391 N4-a (notes docs/n4-plan-20261120.md §5-1, 사용자 N4 §8): keep right -- every car LANE m to its own right of the road's
  // middle, eased in over the first and last LANE_EASE m of a drive; on the one-lane bridge (and LANE_EASE m before it) the middle.
  // Each point of a drive keeps its offset (`offs`): a car going back the same road is shifted by it in its own frame -- its right too
  const LANE = 1.15; const LANE_EASE = 8;
  /* (1.10.397 N4-c: 별마루다리 one lane too -- 61.75 m, and through the wide gate at its head (4.4 m between the posts) to 5 m inside it) */
  /* (1.10.405 L0: the bridges the roads cross, from the island's own list (dalmaru-terrain BRIDGES, those with a `taxi` box) -- a bridge added there, the
     west one to come, is one lane here at once; these two only where the terrain is not at hand) */
  const TERRAIN = typeof module === 'object' && module.exports ? (() => { try { return require('./dalmaru-terrain.js'); } catch { return null; } })() : globalThis.DalmaruTerrain;
  const BRIDGE2 = Object.freeze({ x0: 164.5, x1: 233, z0: 222.5, z1: 229.5 });
  const fromTerrain = (TERRAIN?.BRIDGES || []).filter((b) => b.taxi).map((b) => b.taxi); const BRIDGES = Object.freeze(TERRAIN?.BRIDGES ? fromTerrain : [BRIDGE, BRIDGE2]); /* (1.10.408 assets 171: none one lane now -- both wide; an empty list is the terrain's word, not a missing one) */
  const TAXI_GATES = TERRAIN?.TAXI_GATES || [{ x: 228.23, z: 225.65 }]; const GATE_STOP = 4; const GATE_HOLD = 1200; const GATE_FAR = 15; /* (406 결정 65-1) */
  const bridgeOut = (x, z) => Math.min(...BRIDGES.map((b) => (z < b.z0 - 4 || z > b.z1 + 4 ? Infinity : Math.max(0, b.x0 - x, x - b.x1))));
  const bridgeOf = (x, z, m = 0) => BRIDGES.findIndex((b) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 && z <= b.z1); /* (which one-lane bridge a point is on, -1 none) */
  function laneOffs(road) {
    const ds = [0]; for (let i = 1; i < road.length; i += 1) ds.push(ds[i - 1] + Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1])); const total = ds[ds.length - 1];
    const turn = road.turn || 0; /* (411: a turning round's points lie where they are; after it the car is in its lane already) */
    return road.map(([x, z], i) => (i < turn ? 0 : LANE * Math.min(1, turn ? 1 : ds[i] / LANE_EASE, (total - ds[i]) / LANE_EASE, bridgeOut(x, z) / LANE_EASE)));
  }
  // the time table of a ride's drive: distance gone by each 50 ms, easing in and out; a short road (runMs) is the same drive faster
  const tables = new Map();
  function tableOf(from, runMs, to = STOPS[from]?.to, curb) {
    const key = `${from}|${to}|${runMs || 0}|${curb ?? ''}`; if (tables.has(key)) return tables.get(key);
    const road = driveBetween(from, to, curb); /* (392: between any two places; the two terminals as before; 410: from the side the car stands on) */ const ss = segs(road); const total = ss.reduce((n, s) => n + s.len, 0); const offs = laneOffs(road);
    const paceOf = (s) => (s.turn ? TURN_V : s.slow ? SLOW : FAST);
    const speedAt = (d) => { let k = 0; let at = 0; while (k < ss.length - 1 && at + ss[k].len < d) { at += ss[k].len; k += 1; } return paceOf(ss[k]); };
    /* (1.10.406 사용자 결정 65-1 A: a wide gate on the way, met on the road -- not one the car starts beside (its leaves open as it is boarded) -- the car
       eases to a stand GATE_STOP m before it, waits GATE_HOLD ms while it swings fully open, then eases on; in the table, so every screen has it) */
    const holds = [];
    for (const g of TAXI_GATES) { let best = null; let at = 0; for (const s of ss) { const dx = s.q[0] - s.p[0]; const dz = s.q[1] - s.p[1]; const t = Math.max(0, Math.min(1, ((g.x - s.p[0]) * dx + (g.z - s.p[1]) * dz) / ((s.len * s.len) || 1e-9))); const e = Math.hypot(g.x - s.p[0] - dx * t, g.z - s.p[1] - dz * t); if (!best || e < best.e) best = { e, along: at + s.len * t }; at += s.len; }
      if (best && best.e < 3 && best.along > GATE_FAR && best.along < total - 1) holds.push({ at: best.along - GATE_STOP, ms: GATE_HOLD }); }
    /* (411: round at a walk, then a moment's stand before it pulls away) */
    if (road.turn) holds.push({ at: ss.filter((s) => s.turn).reduce((n, s) => n + s.len, 0), ms: 400 });
    holds.sort((a, b) => a.at - b.at);
    const out = [0]; let d = 0; let legFrom = 0; const legs = [...holds.map((h) => h.at), total];
    for (let li = 0; li < legs.length; li += 1) {
      const end = legs[li]; let cruise = 0; { let at = 0; for (const s of ss) { const a = Math.max(at, legFrom); const b = Math.min(at + s.len, end); if (b > a) cruise += (b - a) / paceOf(s); at += s.len; } } const M = cruise * 1000 + EASE; // (easing in and out costs half a ramp each)
      let u = 0; while (d < end && out.length < 100000) { u += STEP; const f = smooth(u / EASE) * smooth((M - u) / EASE + 0.02); d = Math.min(end, d + speedAt(d) * Math.max(0.04, f) * STEP / 1000); out.push(d); }
      if (li < legs.length - 1) for (let k = 0; k < holds[li].ms / STEP; k += 1) out.push(d);
      legFrom = end;
    }
    const scale = runMs ? runMs / (out.length * STEP) : 1;
    const t = { road, ss, total, offs, ds: out, step: STEP * scale, runMs: out.length * STEP * scale };
    tables.set(key, t); return t;
  }
  const inOf = (ride) => (ride.empty ? 0 : ENTER); const outOf = (ride) => (ride.empty ? 1 : EXIT); /* (392: a car going empty -- no one getting in or out) */
  const durationOf = (ride) => inOf(ride) + tableOf(ride.from, ride.runMs, toOf(ride), ride.curb).runMs + outOf(ride);
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
    /* (411: round a stop's half circle the bow along it -- from one chord's middle way to the next's, unbroken where the circle meets the straight) */
    const mid = (a, b) => a + wrap(b - a) / 2;
    if (s.turn) { const prev = k > 0 ? t.ss[k - 1].yaw : s.yaw; const next = k < t.ss.length - 1 ? t.ss[k + 1].yaw : s.yaw; const a0 = mid(prev, s.yaw);
      yaw = a0 + wrap(mid(s.yaw, next) - a0) * u; return { x, z, yaw, k, o: t.offs ? t.offs[k] + (t.offs[k + 1] - t.offs[k]) * u : 0 }; }
    const afterTurn = k > 0 && t.ss[k - 1].turn;
    if (k > 0 && !afterTurn && d - at < R) yaw = t.ss[k - 1].yaw + wrap(s.yaw - t.ss[k - 1].yaw) * (0.5 + 0.5 * smooth((d - at) / R));
    else if (k < t.ss.length - 1 && at + s.len - d < R) yaw = s.yaw + wrap(t.ss[k + 1].yaw - s.yaw) * 0.5 * (1 - smooth((at + s.len - d) / R));
    if (afterTurn && d - at < 1) { const a0 = mid(t.ss[k - 1].yaw, s.yaw); yaw = a0 + wrap(yaw - a0) * smooth(d - at); } /* (411: out of the circle onto the way, unbroken) */
    const o = t.offs ? t.offs[k] + (t.offs[k + 1] - t.offs[k]) * u : 0; /* (391: the lane's offset here) */
    return { x, z, yaw, k, o };
  }
  // the ride at `now`: phase enter | start | run | stop | exit | done, where the car is, its heading and lean (back as it goes,
  // forward as it stops, over in a turn), how far the wheels have rolled
  function poseAt(ride, now) {
    const real = now; now = roadNow(ride, now); /* (317: on the road's own clock) */
    const t = tableOf(ride.from, ride.runMs, toOf(ride), ride.curb); const e = now - ride.startedAt;
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
  const backRoad = (ride) => { const t = ride.stay ? null : tableOf(ride.from, ride.runMs, toOf(ride), ride.curb); const tail = t && isTerminal(ride.from) ? homeTail(ride, t) : null; /* (404: a terminal's way round, PARK; 405 L0: home by the drop spot) */
    return ride.startedAt + durationOf(ride) + (ride.stay && isTerminal(toOf(ride)) ? PARK : TURN) + (ride.stay ? 0 : tail ? tail.rCut + tail.ms + PARK : t.runMs + TURN); };
  const backOf = (ride, now = Date.now()) => realAt(ride, backRoad(ride), now); // (317: in server time -- later by every wait; 391: or parked where it stays)
  const PLACES = 2; const BACK = 4.5; // (391: a stop's standing places -- 0 its front, where one gets in; 1 the same way 4.5 m behind it)
  function placeOf(id, k = 0, side) { if (!STOPS[id]) { const c = curbOf(id, side); return { x: c.x, z: c.z, yaw: c.yaw }; } /* (392: a stop's one place, its curb; 410: on the side it came in on) */ const s = stopOf(id); const b = k ? BACK : 0; return { x: s.x - Math.sin(s.yaw) * b, z: s.z - Math.cos(s.yaw) * b, yaw: s.yaw }; }
  /* (1.10.404 문제 기록 de84f895, notes issues-taxi-resident §12: a car staying at a terminal went from where it let its rider out into its place in a
     straight line, turning round as it slid -- sideways and backwards, through the shelter. Now front first: on from the drop spot the way it faces,
     round the shelter's far side in a half circle (DROP across), and up into its place from behind; PARK ms, eased at both ends) */
  /* (1.10.405 L0: a car back home empty leaves the road HOME_CUT m out and goes to the drop spot at HOME_V m/s, as one arriving with a rider -- then the same
     way round into its place) */
  const HOME_CUT = 11; const HOME_V = 6; const homeTails = new Map();
  function homeTail(ride, t) {
    const key = `${ride.from}:${ride.runMs || 0}:${toOf(ride)}`; if (homeTails.has(key)) return homeTails.get(key);
    const s = stopOf(ride.from); /* (off the road where one arriving with a rider leaves it: HOME_CUT m from the stop in a straight line -- the road bends by it) */
    let i = t.ds.findIndex((dd) => { const q = along(t, dd); return Math.hypot(q.x - s.x, q.z - s.z) >= HOME_CUT; }); if (i < 0) i = t.ds.length - 1; const a = along(t, t.ds[i]); const d = dropOf(ride.from);
    const by = a.yaw + Math.PI; const p0 = [a.x + Math.cos(by) * a.o, a.z - Math.sin(by) * a.o]; /* (where it is then: in its lane, going back) */
    let pts = [p0, [p0[0] + Math.sin(by) * 3, p0[1] + Math.cos(by) * 3], d.approach, [d.x, d.z]]; /* (on as it goes 3 m, then the corners rounded -- two passes a quarter in, the ends kept) */
    for (let pass = 0; pass < 2; pass += 1) { const r = [pts[0]]; for (let k = 0; k < pts.length - 1; k += 1) { const [ax, az] = pts[k]; const [bx, bz] = pts[k + 1]; if (k > 0) r.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]); if (k < pts.length - 2) r.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } r.push(pts[pts.length - 1]); pts = r; } const cum = [0]; for (let k = 1; k < pts.length; k += 1) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const out = { rCut: t.runMs - i * t.step, pts, cum, len: cum[cum.length - 1], ms: (cum[cum.length - 1] / HOME_V) * 1000, endYaw: d.yaw }; homeTails.set(key, out); return out;
  }
  function tailAt(tl, s) {
    const at = (u) => { u = Math.max(0, Math.min(tl.len, u)); let i = 1; while (i < tl.pts.length - 1 && tl.cum[i] < u) i += 1; const f = (u - tl.cum[i - 1]) / ((tl.cum[i] - tl.cum[i - 1]) || 1); return [tl.pts[i - 1][0] + (tl.pts[i][0] - tl.pts[i - 1][0]) * f, tl.pts[i - 1][1] + (tl.pts[i][1] - tl.pts[i - 1][1]) * f]; };
    const p = at(s); const a = at(s - 0.5); const b = at(s + 0.5); /* (its heading the way it goes there -- the corners are round) */
    return { x: p[0], z: p[1], yaw: s >= tl.len - 0.01 ? tl.endYaw : Math.atan2(b[0] - a[0], b[1] - a[1]) };
  }
  const PARK = 5000; const PARK_OUT = 4.5; /* (out as far as the place behind -- the half circle starts there: clear of 대청마당's tree at (16.3, -47.1)) */
  function parkPose(id, place, k) {
    const s = stopOf(id); const fx = Math.sin(s.yaw); const fz = Math.cos(s.yaw); const rx = Math.cos(s.yaw); const rz = -Math.sin(s.yaw);
    const R = DROP / 2; const goal = place ? -BACK : 0; const L1 = PARK_OUT; const L2 = Math.PI * R; const L3 = goal + PARK_OUT; const d = (L1 + L2 + L3) * smooth(k);
    let u; let v; let du; let dv;
    if (d <= L1) { u = -d; v = DROP; du = -1; dv = 0; }
    else if (d <= L1 + L2) { const a = (d - L1) / R; u = -L1 - R * Math.sin(a); v = R + R * Math.cos(a); du = -Math.cos(a); dv = -Math.sin(a); }
    else { u = -L1 + (d - L1 - L2); v = 0; du = 1; dv = 0; }
    const dx = du * fx + dv * rx; const dz = du * fz + dv * rz;
    return { phase: 'turn', x: s.x + u * fx + v * rx, z: s.z + u * fz + v * rz, yaw: Math.atan2(dx, dz), d: 0, pitch: 0, roll: 0, k };
  }
  const glide = (a, b, k, d) => { const s = smooth(k); return { phase: 'turn', x: a.x + (b.x - a.x) * s, z: a.z + (b.z - a.z) * s, yaw: a.yaw + wrap(b.yaw - a.yaw) * s, d, pitch: 0, roll: 0, k }; };
  // (317) the ride over (the rider out at the other stop) by server time `now`
  const rideOver = (ride, now) => roadNow(ride, now) >= ride.startedAt + durationOf(ride);
  /* (1.10.401 Codex 391~400 #1: the ride on the table's own clock -- for looking ahead along its road -- keeps where it goes (to, empty, stay,
     park); only the waits and the aside (warp, side, ghost) are left out. Without `to` a ride from a stop between the terminals had no end:
     curbOf(undefined) threw in the server's tick and the process stopped) */
  const timeless = (ride) => ({ from: ride.from, startedAt: ride.startedAt, ...(Number.isFinite(ride.runMs) ? { runMs: ride.runMs } : {}), ...(ride.to ? { to: ride.to } : {}), ...(ride.empty ? { empty: true } : {}), ...(typeof ride.stay === 'boolean' ? { stay: ride.stay, park: ride.park ?? 0 } : {}), ...(ride.curb === 1 || ride.curb === -1 ? { curb: ride.curb } : {}) /* (410) */ });
  function carAt(ride, now) {
    const p = poseAt(ride, now); if (p.phase !== 'done') return p;
    const real = now; now = roadNow(ride, now);
    const t = tableOf(ride.from, ride.runMs, toOf(ride), ride.curb); const e = now - ride.startedAt - durationOf(ride);
    const turn = (q, k) => ({ phase: 'turn', ...q, yaw: wrap(q.yaw + Math.PI * smooth(k)), d: q.d, pitch: 0, roll: 0, k });
    if (ride.stay) { if (isTerminal(toOf(ride))) { if (e >= PARK) return null; return parkPose(toOf(ride), ride.park || 0, e / PARK); } if (e >= TURN) return null; const a = along(t, t.total); return glide(a, placeOf(toOf(ride), ride.park || 0, arriveSide(ride.from, toOf(ride))), e / TURN, t.total); } /* (391: into its place there; 404: a terminal's the way round) */
    if (e < TURN) return turn({ ...along(t, t.total), d: t.total }, e / TURN);
    const r = e - TURN; const tail = isTerminal(ride.from) ? homeTail(ride, t) : null;
    if (tail && r >= tail.rCut) { /* (1.10.405 L0 · 문제 기록 de84f895: home the way it came in -- to the drop spot, then front first into its place; never into the front place's middle) */
      const q = r - tail.rCut; if (q < tail.ms) { const p = tailAt(tail, (q / tail.ms) * tail.len); return { phase: 'turn', ...p, d: 0, pitch: 0, roll: 0, k: q / tail.ms }; }
      const k = (q - tail.ms) / PARK; return k >= 1 - 1e-9 ? null : parkPose(ride.from, ride.park || 0, k); /* (at backOf itself: in its place, done -- its sum's rounding aside) */
    }
    if (r < t.runMs) {
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
  /* (1.10.403 문제 기록 6d2679c4·de84f895, notes issues-taxi-resident-20261122 ⑤: the one behind pulled up from the moment the rider got in, over
     2 s, while the front car stood 1.2 s for the rider and then pulled away -- 1.6 s the two in one place, flickering. Now it starts once the
     front car is in and 1.1 s on its way (4.5 m and more ahead by then); a screen eases it from its place behind, as before) */
  const PULL_AFTER = (ride) => inOf(ride) + 1100;
  const standingAt = (fleet, stop) => fleet.cars.filter((c) => !c.ride && c.at === stop).sort((a, b) => a.place - b.place);
  // a ride from `from`: its car (the front one), the one behind pulled up, where it goes after -> { car, undo } or null (none standing)
  function takeCar(fleet, from, ride, now) {
    const standing = standingAt(fleet, from); const car = standing[0]; if (!car) return null;
    const place = car.place; car.ride = ride; car.at = null; ride.car = car.id; ride.seat = 0; const pulled = [];
    if (ROADSTOPS[from] && (car.curb === 1 || car.curb === -1)) ride.curb = car.curb; /* (410: off from the side of the road it stands on) */
    for (const c of standing.slice(1)) if (c.place > 0 && !standingAt(fleet, from).some((o) => o.place === 0)) { pulled.push({ c, place: c.place, pulledAt: c.pulledAt, at: now + PULL_AFTER(ride) }); c.place = 0; c.pulledAt = now + PULL_AFTER(ride); } /* (403: after the front one has gone) */
    /* (1.10.403 Codex 391~400 #2: undone -- a fare refused -- only this car back, and the one it had pulled up if that one is still standing as it
       was left and has not started up yet; never the whole fleet as it stood before: someone else's car taken meanwhile stays theirs) */
    return { car, undo: () => {
      if (car.ride !== ride) return; car.ride = null; car.at = from; delete ride.car; delete ride.seat;
      const back = pulled.filter((w) => !w.c.ride && w.c.at === from && w.c.place === 0 && w.c.pulledAt === w.at);
      for (const w of back) { w.c.place = w.place; w.c.pulledAt = w.pulledAt; }
      car.place = back.length ? place : freePlace(fleet, from, car);
    } };
  }
  // the clock moved on: a ride just over decides where its car goes (stays where that stop has fewer than PLACES, else back home) and
  // which place it takes; each car whose glide or way back is over stands in it -> whether anything changed
  // (392 N4-b) after a ride to a stop, or to a full terminal from a stop: empty to the nearest terminal with room (by the road; none: the nearer)
  const nearestRoom = (fleet, from, except) => Object.keys(STOPS).filter((t) => t !== from) /* (412: never to where it is -- that would be once round the island) */.sort((a, b) => distanceOf(a, from) - distanceOf(b, from)).find((t) => fleet.cars.filter((c) => c !== except && headingTo(c) === t).length < PLACES) || Object.keys(STOPS).filter((t) => t !== from).sort((a, b) => distanceOf(a, from) - distanceOf(b, from))[0];
  function goEmpty(fleet, c, from, now) { const to = nearestRoom(fleet, from, c); const runMs = c.ride?.runMs || fleet.runMs;
    const curb = ROADSTOPS[from] ? (c.ride ? arriveSide(c.ride.from, toOf(c.ride)) : c.curb) : null; /* (410: off from the side it came in on, or stands on) */
    c.ride = { from, to, startedAt: now, empty: true, car: c.id, seat: 0, ...(runMs ? { runMs } : {}), stay: true, park: 0, ...(curb === 1 || curb === -1 ? { curb } : {}) }; c.ride.park = freePlace(fleet, to, c); c.at = null; c.waitUntil = 0; }
  const WAIT = 15000; // (a car fetched to a stop waits this long for its caller, then goes to the nearest terminal with room)
  function settle(fleet, now) {
    let moved = false;
    for (const c of fleet.cars) if (c.ride && c.ride.stay === undefined && rideOver(c.ride, now)) {
      const to = toOf(c.ride); moved = true;
      if (isTerminal(to) && countAt(fleet, to) < PLACES) { c.ride.stay = true; c.ride.park = freePlace(fleet, to, c); }
      else if (isTerminal(to) && isTerminal(c.ride.from) && countAt(fleet, c.ride.from) < PLACES) { c.ride.stay = false; c.ride.park = freePlace(fleet, c.ride.from, c); } /* (the way back the same road, as before) */
      /* (1.10.403 Codex 391~400 #10: home filled meanwhile -- others stayed there after letting their riders out: not back into a taken place, but on
         empty to the nearest terminal with room, the one left with none) */
      else goEmpty(fleet, c, to, now); /* (392: from where it let its rider out) */
    }
    for (const c of fleet.cars) if (c.ride && c.ride.stay !== undefined && now >= backOf(c.ride, now)) {
      const fetched = c.ride.empty && !isTerminal(toOf(c.ride)); c.at = c.ride.stay ? toOf(c.ride) : c.ride.from; c.place = c.ride.park || 0;
      if (ROADSTOPS[c.at]) c.curb = arriveSide(c.ride.from, c.at); else delete c.curb; /* (410: the side of a road stop it stands on -- where it came in) */ c.ride = null; c.pulledAt = 0; c.waitUntil = fetched ? now + WAIT : 0; moved = true; }
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
  const arrivalOf = (ride) => { const t = tableOf(ride.from, ride.runMs, toOf(ride), ride.curb); const p = along(t, t.total); return beside(p.x, p.z, p.yaw, ALIGHT); };
  // the door's opening (0 shut .. 1 open) through a getting in or out (motion-utils doorAngle: in 0..0.14 open, 0.86..1 shut;
  // out 0..0.12 open, 0.80..1 shut)
  const doorOf = (phase, k) => (phase === 'enter' ? (k < 0.5 ? smooth(k / 0.14) : 1 - smooth((k - 0.86) / 0.14)) : phase === 'exit' ? (k < 0.5 ? smooth(k / 0.12) : 1 - smooth((k - 0.8) / 0.2)) : 0);
  const fareOf = ({ fare = FARE, from = '', to = '' } = {}) => Math.max(0, Math.round(Number(fare) || 0)) + (EXTRA[`${from}>${to}`] || 0);
  // v1.10.294 6a: the screen's clock offset a frame toward the server's -- at most `step` ms, at once past `jump` (a first
  // reading, a sleep): a clock answer moving it tens of ms at once made a moving car jump that far
  const easeClock = (view, server, step = 2, jump = 1000) => (view == null || Math.abs(server - view) > jump ? server : view + Math.max(-step, Math.min(step, server - view)));
  // (392 N4-b, 결정 40 A · n4-plan §5-5) a fare by the road's length: per100 a 100 m (the nearest 100 m), at least min
  const fareByRoad = (from, to, per100 = 250, min = 500) => Math.max(Math.round(Number(min) || 0), Math.round(Number(per100) || 0) * Math.round((from === to ? loopLenOf(from) : distanceOf(from, to)) / 100)); /* (412: 「섬 한 바퀴」 by its own length) */
  const LOOP_LABEL = '섬 한 바퀴(구경)';
  const PLACE_IDS = () => ['plaza', 'isle', 'head', ...Object.keys(ROADSTOPS)].sort((a, b) => sOf(a) - sOf(b)); /* (397: by the trunk -- 마을 at its corner, 별마루섬 입구 last) */
  /* (1.10.405 L0: the terminals' ways off the road -- round the shelter into each place, and home from the road to the drop spot -- as lines, for what keeps
     clear of them (dalmaru-island taxiClear: nothing growing there)) */
  let parkPaths = null;
  const PARK_PATHS = () => parkPaths || (parkPaths = Object.keys(STOPS).flatMap((id) => [
    ...[0, 1].map((k) => Array.from({ length: 41 }, (_, i) => { const p = parkPose(id, k, i / 40); return [p.x, p.z]; })),
    homeTail({ from: id, to: STOPS[id].to, startedAt: 0 }, tableOf(id, undefined, STOPS[id].to)).pts]));
  return { GRAPH, RING, loopWay, loopLenOf, LOOP_LABEL, /* (412 「섬 한 바퀴」) */ footOn, BANKED, PARK_PATHS, boardOf, arriveSide, leaveSide, FAR, /* (410 결정 65-3 A; 411 the far sides' table, for the checks) */ ROADSTOPS, ROAD_LEN, sOf, atS, curbOf, driveBetween, distanceOf, fareByRoad, PLACE_IDS, isTerminal, labelOf, toOf, sendCar, WAIT, nearestRoom, /* (392 N4-b) */
    LANE, PLACES, BACK, placeOf, laneOffs, createFleet, takeCar, settle, etaAt, fleetView, countAt, standingAt, onBridgeBox: (x, z, m = 0) => bridgeOf(x, z, m) >= 0, bridgeOf, BRIDGES, /* (391 N4-a; 397 both one-lane bridges) */ TRUNK, TRUNK_LEN, SPUR,
    CROSSINGS, CROSS_HALF, CROSS_CLEAR, ROAD, LEAD, RAMP, sideAt, ghostAt, shifted, roadNow, rateOf, warpTo, realAt, rideOver, timeless, PULL_AFTER, PARK, parkPose, TURN, backOf, carAt, easeClock, ROUTE, EXT, ROADS, STREET, ROAD_ENDS: Object.freeze([ROUTE[0], ROUTE[ROUTE.length - 1], EXT[EXT.length - 1]]) /* (395: the stops at the roads' ends -- kept clear round, as the two were) */, STOPS, BRIDGE, ENTER, EXIT, EASE, FAST, SLOW, FARE, DAY_PASS, EXTRA, BOARD, ALIGHT, SEAT, roadOf, stopOf, dropOf, driveOf, tableOf, durationOf, poseAt, arrivalOf, doorOf, fareOf };
}));
