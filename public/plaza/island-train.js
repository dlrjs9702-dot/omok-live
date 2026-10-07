// v1.10.47 공중 관광열차 (비공개 IDEAS 「공중 관광열차」, 사용자 확정 2026-10-07 · 설계 갱신 2026-10-08): sightseeing trains on
// glass rails. Four stations -- A 내부 강변역 (by the widened north-west stream, high up), B 동해안역, C 북해안역, D 남서해안역
// -- and two lines that never share a rail: 외곽 (round the coast, D -> B -> C -> D, two trains 105 s apart) and 전망
// (A -> C -> high over the central plaza -> D -> A, one train). Every leg 60 s, every stop 10 s, a round 210 s, run all day
// with or without anyone on board. At C and D the coast line stops low and the view line high (two platforms, one lift).
// Shared word for word by the browser and the server, like island-terrain.js: the lines are the design drawing's (sampled
// every 3 m: x, z, rail height over the sea) and where a train is at a moment is a pure function of the server clock --
// the server reserves segments and station tracks; clients share its progress clocks, including safety holds.
(function (root, factory) {
  const terrain = typeof module === 'object' && module.exports ? require('./island-terrain.js') : root.IslandTerrain;
  const api = factory(terrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandTrain = api;
}(typeof self !== 'undefined' ? self : this, (T) => {
  const { TAU, lerp } = T;
  const SEA = -0.6; // the sea's surface in the game (the drawing's heights are over the sea)
  const TRAVEL = 60; const DWELL = 10; const CYCLE = 3 * (TRAVEL + DWELL); // seconds
  const SURFACE = 0.025; // the running line over the rail's glass (the carriage's root stands on it)
  const CLEAR = 2.6; // a carriage's underside over ground one can walk on, anywhere but at a station
  // the carriage (Codex train_carriage, front -Z, doors on its left): four seats -- the avatar's root, facing forward
  const SEATS = [[-0.67, 0.725, -1.06], [0.67, 0.725, -1.06], [-0.67, 0.725, 1.06], [0.67, 0.725, 1.06]];
  const CAR = { width: 3.12, length: 4.52, under: 0.3 }; // its underside this far under the running line
  const DOCK = [3.24, -0.55, 0]; // the carriage's root in its platform's frame (the platform on the carriage's left)
  // a line's `side`: the doors' side of the way it runs (-1 left, the model as made; +1 right: the view line's stations are
  // on its right, so its carriage is drawn mirrored across its length -- doors, seats and all)
  const STATIONS = { A: { name: '내부 강변역', entry: [-13, -35] }, B: { name: '동해안역', entry: [99.78, -8.73] }, C: { name: '북해안역', entry: [-16.7, -94.7] }, D: { name: '남서해안역', entry: [-83.1, 69.73] } };
  const LINES = {
    outer: { name: '외곽 열차', side: -1, order: ['D', 'B', 'C'], stops: { D: 0, B: 297.21, C: 483.15 }, trains: [{ id: 1, offset: 0 }, { id: 2, offset: 105 }], length0: 717.2, pts: [-90.8,76.2,2.2,-88.6,78.4,2.2,-86.3,80.5,2.21,-83.9,82.4,2.33,-81.4,84.3,2.46,-78.8,86.0,2.58,-76.2,87.6,2.71,-73.5,89.1,2.83,-70.7,90.5,2.95,-67.9,91.8,3.07,-65.1,93.0,3.2,-62.3,94.2,3.32,-59.5,95.2,3.44,-56.2,96.4,3.58,-53.0,97.6,3.72,-49.8,98.7,3.85,-46.5,99.8,3.99,-43.3,100.8,4.12,-40.1,101.8,4.26,-36.8,102.6,4.39,-33.6,103.4,4.53,-30.3,103.9,4.66,-27.0,104.4,4.79,-23.7,104.6,4.93,-20.4,104.7,5.06,-17.1,104.7,5.19,-13.8,104.7,5.32,-10.5,104.7,5.45,-7.3,104.8,5.58,-4.1,105.1,5.71,-0.9,105.6,5.84,2.3,106.5,5.97,5.6,107.6,6.11,8.6,108.7,6.24,11.6,110.1,6.37,14.7,111.5,6.5,17.9,112.9,6.5,21.2,114.3,6.5,24.0,115.4,6.5,26.9,116.4,6.5,30.3,117.2,6.5,33.8,117.8,6.5,37.2,117.9,6.5,40.5,117.6,6.5,43.7,116.9,6.5,46.8,115.8,6.5,49.7,114.3,6.5,52.4,112.4,6.5,55.0,110.4,6.5,57.5,108.1,6.5,59.8,105.7,6.5,62.0,103.2,6.5,64.1,100.6,6.5,66.1,98.0,6.5,68.1,95.5,6.5,70.0,92.9,6.5,71.8,90.3,6.5,73.6,87.7,6.39,75.3,85.1,6.27,76.9,82.5,6.14,78.5,79.9,6.02,80.0,77.3,5.9,81.7,74.3,5.76,83.5,71.3,5.62,85.2,68.4,5.49,86.9,65.5,5.35,88.7,62.7,5.22,90.6,59.9,5.09,92.5,57.2,4.96,94.5,54.6,4.82,96.7,51.9,4.69,98.8,49.3,4.55,101.1,46.6,4.41,103.0,44.3,4.29,104.9,41.9,4.17,106.8,39.4,4.04,108.5,36.8,3.92,110.2,34.2,3.79,111.7,31.5,3.67,113.0,28.7,3.55,114.1,25.8,3.42,114.9,22.9,3.3,115.5,19.8,3.18,115.8,16.8,3.05,115.9,13.7,2.93,115.7,10.6,2.81,115.3,7.6,2.68,114.6,4.5,2.56,113.8,1.5,2.43,112.9,-1.5,2.31,111.8,-4.4,2.2,110.7,-7.3,2.2,109.5,-10.1,2.2,108.2,-13.3,2.2,106.9,-16.4,2.26,105.6,-19.6,2.39,104.3,-22.6,2.53,103.0,-25.7,2.66,101.8,-28.7,2.79,100.5,-31.7,2.92,99.2,-34.6,3.05,97.8,-37.5,3.18,96.4,-40.4,3.3,95.0,-43.3,3.43,93.5,-46.1,3.56,92.1,-49.0,3.69,90.6,-51.8,3.81,89.2,-54.7,3.94,87.8,-57.6,4.07,86.4,-60.5,4.2,85.0,-63.5,4.33,83.6,-66.5,4.47,81.9,-69.4,4.6,80.1,-72.1,4.73,78.0,-74.6,4.86,75.6,-76.9,4.99,73.0,-78.9,5.13,70.2,-80.7,5.26,67.3,-82.4,5.39,64.4,-83.9,5.52,61.5,-85.5,5.65,58.8,-87.2,5.78,56.2,-89.0,5.91,53.7,-91.1,6.04,51.2,-93.4,6.18,48.8,-95.8,6.31,46.8,-98.1,6.43,44.7,-100.3,6.5,42.5,-102.6,6.5,40.2,-104.8,6.5,37.9,-107.0,6.5,35.4,-109.0,6.5,32.9,-110.9,6.5,30.2,-112.6,6.5,27.4,-114.0,6.5,24.5,-115.2,6.5,21.5,-116.1,6.5,18.5,-116.6,6.5,15.4,-116.8,6.5,12.3,-116.8,6.5,9.2,-116.4,6.5,6.1,-115.7,6.5,3.0,-114.8,6.5,0.0,-113.6,6.5,-2.9,-112.3,6.45,-5.8,-110.9,6.33,-8.6,-109.5,6.2,-11.4,-108.0,6.08,-14.0,-106.7,6,-17.1,-105.1,6,-20.2,-103.8,6,-23.2,-102.7,6,-26.3,-101.8,6.09,-29.4,-101.0,6.22,-32.6,-100.4,6.35,-35.9,-99.9,6.48,-39.2,-99.4,6.5,-42.5,-98.9,6.5,-45.9,-98.4,6.5,-49.3,-97.7,6.5,-52.7,-97.0,6.5,-56.0,-96.1,6.5,-58.9,-95.2,6.5,-61.8,-94.2,6.5,-64.6,-93.1,6.5,-67.4,-91.9,6.5,-70.1,-90.6,6.5,-72.8,-89.1,6.5,-75.3,-87.4,6.5,-77.7,-85.6,6.5,-80.0,-83.6,6.5,-82.1,-81.4,6.5,-84.0,-79.1,6.5,-85.7,-76.5,6.5,-87.2,-73.8,6.5,-88.5,-71.1,6.5,-89.7,-68.2,6.5,-90.7,-65.3,6.5,-91.6,-62.3,6.5,-92.4,-59.4,6.5,-93.3,-56.1,6.5,-94.2,-52.8,6.5,-95.1,-49.5,6.5,-96.0,-46.3,6.5,-96.8,-43.1,6.5,-97.6,-39.9,6.5,-98.3,-36.7,6.5,-98.8,-33.5,6.5,-99.2,-30.3,6.39,-99.3,-27.1,6.26,-99.3,-23.8,6.13,-99.0,-20.6,6.0,-98.6,-17.4,5.87,-98.0,-14.2,5.74,-97.4,-11.1,5.61,-96.7,-8.0,5.48,-96.1,-5.0,5.36,-95.6,-1.7,5.23,-95.3,1.7,5.09,-95.2,5.0,4.96,-95.5,8.4,4.82,-95.9,11.4,4.7,-96.6,14.4,4.58,-97.3,17.6,4.45,-98.2,20.9,4.31,-99.1,24.3,4.17,-99.9,27.2,4.05,-100.6,30.3,3.92,-101.3,33.4,3.8,-101.8,36.6,3.67,-102.3,39.8,3.54,-102.5,43.0,3.41,-102.6,46.2,3.28,-102.5,49.4,3.15,-102.1,52.6,3.02,-101.6,55.7,2.9,-100.8,58.8,2.77,-99.8,61.8,2.64,-98.6,64.6,2.52,-97.2,67.4,2.39,-95.5,70.1,2.27,-93.8,72.6,2.2,-91.8,75.0,2.2,-90.8,76.2,2.2] },
    view: { name: '전망 열차', side: 1, order: ['A', 'C', 'D'], stops: { A: 0, C: 81.28, D: 364.34 }, trains: [{ id: 3, offset: 35 }], length0: 499.75, pts: [-22.6,-35,13.4,-21.3,-37.9,13.4,-20.7,-41.2,13.4,-20.9,-44.5,13.41,-21.7,-47.5,13.42,-22.8,-50.4,13.39,-24.4,-53.0,13.36,-26.6,-55.7,13.31,-28.7,-58.1,13.26,-30.9,-60.4,13.2,-32.9,-62.9,13.15,-34.6,-65.4,13.09,-35.9,-68.5,13.01,-36.3,-71.8,12.93,-36.2,-75.3,12.83,-35.7,-78.4,12.75,-35.0,-81.5,12.66,-34.0,-84.6,12.57,-33.0,-87.5,12.5,-31.7,-90.6,12.43,-30.3,-93.3,12.38,-28.7,-96.2,12.35,-26.9,-98.7,12.37,-24.8,-100.9,12.4,-22.3,-102.8,12.4,-19.4,-104.2,12.4,-16.5,-105.2,12.4,-13.3,-106.1,12.4,-9.7,-106.8,12.42,-6.6,-107.1,12.48,-3.3,-107.1,12.59,0.2,-106.8,12.69,3.9,-106.0,12.84,7,-105,13,10.5,-103.6,13.21,13.4,-102.4,13.4,16.6,-100.9,13.62,19.9,-99.3,13.85,23.3,-97.6,14.1,26.7,-95.7,14.36,30.0,-93.8,14.63,33.2,-91.7,14.89,36.1,-89.6,15.14,38.8,-87.5,15.39,41.0,-85.3,15.61,43.2,-82.4,15.88,44.5,-79.5,16.11,44.9,-76.5,16.31,44.6,-73.2,16.5,43.7,-69.8,16.66,42.3,-66.4,16.82,40.5,-62.9,16.95,38.6,-59.4,17.08,36.6,-56.0,17.19,34.6,-52.7,17.28,32.8,-49.5,17.36,31.2,-46.5,17.4,29.6,-43.7,17.4,27.9,-40.9,17.4,26.1,-38.2,17.4,24.3,-35.6,17.4,22.4,-33.0,17.4,20.5,-30.5,17.4,18.6,-28.1,17.4,16.8,-25.6,17.4,14.9,-23.2,17.4,12.7,-20.3,17.4,10.7,-17.6,17.4,8.7,-15.0,17.4,6.8,-12.6,17.4,4.8,-10.1,17.4,2.6,-7.4,17.4,0.1,-4.6,17.4,-2.1,-2.1,17.4,-4.7,0.7,17.38,-6.7,2.9,17.34,-8.8,5.3,17.32,-10.9,7.7,17.29,-13.2,10.2,17.27,-15.5,12.8,17.24,-18.0,15.4,17.19,-20.5,18.1,17.13,-23.2,20.9,17.04,-25.9,23.6,16.92,-28.8,26.5,16.76,-31.7,29.3,16.56,-34.8,32.1,16.31,-38,35,16,-40.3,37.0,15.75,-42.8,39.2,15.45,-45.6,41.6,15.1,-48.5,44.0,14.71,-51.5,46.6,14.3,-54.7,49.2,13.85,-57.9,51.9,13.39,-61.2,54.6,12.92,-64.5,57.2,12.43,-67.7,59.8,11.95,-70.8,62.4,11.47,-73.9,64.8,11.0,-76.8,67.0,10.55,-79.6,69.1,9.81,-82.2,71.0,8.88,-85.6,73.3,8.4,-88.3,75.0,8.4,-91.1,76.2,8.4,-90.9,73.2,8.4,-89.2,70.3,8.41,-87.4,67.6,8.58,-85.4,64.6,9.04,-83.1,61.4,9.41,-80.8,58.0,9.73,-78.6,54.6,10.05,-76.4,51.2,10.36,-74.5,47.9,10.63,-72.8,44.9,10.87,-71.6,42.1,11.06,-70.3,38.3,11.29,-69.5,35.3,11.46,-68.7,32.3,11.64,-68.0,29.2,11.81,-67.3,26.1,11.98,-66.6,22.9,12.14,-66.0,19.8,12.29,-65.3,16.8,12.44,-64.5,13.8,12.58,-63.4,10.0,12.75,-62.1,6.5,12.9,-60.6,3.2,13.03,-58.8,0.2,13.13,-56.9,-2.6,13.21,-54.8,-5.2,13.26,-52.6,-7.7,13.3,-50.3,-10.1,13.33,-48.1,-12.3,13.35,-45.8,-14.5,13.36,-43.6,-16.5,13.37,-41.0,-19.0,13.39,-38.5,-21.4,13.41,-36.0,-23.6,13.43,-33.5,-25.5,13.43,-31.0,-27.4,13.42,-28.1,-29.4,13.4,-25.6,-31.5,13.4,-23.3,-33.9,13.4,-22.6,-35,13.4] },
  };
  // each line: samples every ~1 m along it (x, z, rail top y) and the length at each, closed (its end is its start)
  for (const line of Object.values(LINES)) {
    const raw = []; for (let i = 0; i < line.pts.length; i += 3) raw.push([line.pts[i], line.pts[i + 1], line.pts[i + 2] + SEA]);
    if (Math.hypot(raw[0][0] - raw[raw.length - 1][0], raw[0][1] - raw[raw.length - 1][1]) > 0.5) raw.push(raw[0].slice());
    const xs = [raw[0][0]]; const zs = [raw[0][1]]; const ys = [raw[0][2]]; const S = [0]; let s = 0;
    for (let i = 1; i < raw.length; i += 1) {
      const [ax, az, ay] = raw[i - 1]; const [bx, bz, by] = raw[i]; const d = Math.hypot(bx - ax, bz - az); if (d < 1e-6) continue;
      const n = Math.ceil(d); for (let k = 1; k <= n; k += 1) { xs.push(ax + ((bx - ax) * k) / n); zs.push(az + ((bz - az) * k) / n); ys.push(ay + ((by - ay) * k) / n); s += d / n; S.push(s); }
    }
    line.route = { xs, zs, ys, S, LENGTH: s };
    line.stops = Object.fromEntries(Object.entries(line.stops).map(([id, s0]) => [id, (s0 / line.length0) * s])); // the drawing's lengths, on this line
    delete line.pts;
  }
  function pointAt(line, s) {
    const { xs, zs, ys, S, LENGTH } = LINES[line].route; s = ((s % LENGTH) + LENGTH) % LENGTH;
    let lo = 0; let hi = S.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
    const u = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0;
    return { x: lerp(xs[lo], xs[hi], u), y: lerp(ys[lo], ys[hi], u), z: lerp(zs[lo], zs[hi], u), yaw: Math.atan2(xs[hi] - xs[lo], zs[hi] - zs[lo]) };
  }
  const TRAINS = Object.entries(LINES).flatMap(([line, L]) => L.trains.map((t) => ({ ...t, line })));
  const trainOf = (id) => TRAINS.find((t) => t.id === id) || null;
  // the timetable: from a stop TRAVEL to the next (gently off and gently in), DWELL there, on round the line's order
  const ease = (u) => u - Math.sin(TAU * u) / TAU;
  function timetableAt(id, ms) {
    const t = trainOf(id); const L = LINES[t.line]; const p = (((ms / 1000 - t.offset) % CYCLE) + CYCLE) % CYCLE;
    const leg = Math.min(2, Math.floor(p / (TRAVEL + DWELL))); const inLeg = p - leg * (TRAVEL + DWELL);
    const from = L.order[leg]; const to = L.order[(leg + 1) % 3];
    const s0 = L.stops[from]; let s1 = L.stops[to]; if (s1 <= s0) s1 += L.route.LENGTH;
    if (inLeg < TRAVEL) return { id, line: t.line, from, s: lerp(s0, s1, ease(inLeg / TRAVEL)), stop: null, next: to, eta: TRAVEL - inLeg, wait: 0, moved: s1 - s0 };
    return { id, line: t.line, from, s: s1, stop: to, next: L.order[(leg + 2) % 3], eta: 0, wait: TRAVEL + DWELL - inLeg, moved: 0 };
  }
  let service = null;
  function setService(snapshot) { service = snapshot || null; }
  function trainAt(id, ms) {
    const clock = service?.clocks?.find((c) => c.id === id);
    if (!clock) return timetableAt(id, ms);
    // Extrapolate only up to the next boundary. A stale response cannot let a client depart without a reservation.
    const st = timetableAt(id, clock.cursor);
    const boundary = (st.stop ? st.wait : st.eta) * 1000;
    const dt = clock.held ? 0 : Math.min(Math.max(0, ms - service.at), Math.max(0, boundary - 0.001));
    return { ...timetableAt(id, clock.cursor + dt), held: clock.held };
  }
  // The server owns actual progress. Reserve the next segment AND destination before leaving a platform;
  // delay freezes that train's clock, and it resumes from there instead of jumping back to the timetable.
  function createTraffic(ms) {
    let at = ms;
    const clocks = TRAINS.map(({ id }) => ({ id, cursor: ms, held: false }));
    const blocked = new Set();
    const keys = (c) => { const st = timetableAt(c.id, c.cursor); return st.stop || c.held
      ? [`${st.line}:station:${st.stop || st.from}`]
      : [`${st.line}:segment:${st.from}`, `${st.line}:station:${st.next}`]; };
    function departures() {
      for (const c of clocks) {
        const phase = ((c.cursor / 1000 - trainOf(c.id).offset) % 70 + 70) % 70;
        if (phase > 0.000001) continue;
        const st = timetableAt(c.id, c.cursor);
        const needed = [`${st.line}:segment:${st.from}`, `${st.line}:station:${st.next}`];
        c.held = needed.some((k) => blocked.has(k) || clocks.some((other) => other !== c && keys(other).includes(k)));
      }
    }
    function advance(now) {
      let remaining = Math.max(0, now - at); at = now;
      departures();
      while (remaining > 0.00001) {
        const moving = clocks.filter((c) => !c.held);
        let dt = remaining;
        for (const c of moving) {
          const st = timetableAt(c.id, c.cursor);
          dt = Math.min(dt, (st.stop ? st.wait : st.eta) * 1000);
        }
        if (dt < 0.00001) dt = Math.min(remaining, 0.001);
        for (const c of moving) c.cursor += dt;
        remaining -= dt; departures();
        if (!moving.length) break;
      }
      return { at, clocks: clocks.map((c) => ({ ...c })) };
    }
    return { advance, block: (key, on) => { if (on) blocked.add(key); else blocked.delete(key); }, reservations: () => clocks.map((c) => ({ id: c.id, keys: keys(c) })) };
  }
  // the carriage: its root on the running line, its front (-Z) along the way; a seat in the world, the avatar facing forward
  function carOf(id, ms) {
    const st = trainAt(id, ms); const p = pointAt(st.line, st.s);
    return { ...st, x: p.x, y: p.y + SURFACE, z: p.z, yaw: p.yaw, carYaw: p.yaw + Math.PI, mirror: LINES[st.line].side > 0 };
  }
  const local = (car, [lx, ly, lz]) => { const c = Math.cos(car.carYaw); const s = Math.sin(car.carYaw); lx *= car.mirror ? -1 : 1; return { x: car.x + c * lx + s * lz, y: car.y + ly, z: car.z - s * lx + c * lz }; };
  function seatAt(id, seat, ms) { const car = carOf(id, ms); return { ...local(car, SEATS[seat]), yaw: car.yaw }; }
  // a station's platform for a line: where the carriage stands there, and the platform on its left (DOCK)
  function platformOf(line, stationId) {
    const L = LINES[line]; const p = pointAt(line, L.stops[stationId]);
    const car = { x: p.x, y: p.y + SURFACE, z: p.z, carYaw: p.yaw + Math.PI, mirror: L.side > 0 };
    const at = local(car, [-DOCK[0], -DOCK[1], -DOCK[2]]);
    return { line, station: stationId, x: at.x, y: at.y, z: at.z, yaw: car.carYaw, mirror: car.mirror, car };
  }
  const PLATFORMS = Object.entries(LINES).flatMap(([line, L]) => L.order.map((id) => platformOf(line, id)));
  function platformSpot(line, station, slot = 0) {
    const p = platformOf(line, station); const x = (slot % 3 - 1) * 0.8; const z = Math.floor(slot / 3) - 1.5;
    const q = local({ x: p.x, y: p.y, z: p.z, carYaw: p.yaw, mirror: p.mirror }, [x, 0, z]);
    return { ...q, yaw: p.yaw };
  }
  function liftOf(station) {
    const plats = PLATFORMS.filter((p) => p.station === station); const [ex, ez] = STATIONS[station].entry;
    const cx = plats.reduce((a, p) => a + p.x, 0) / plats.length; const cz = plats.reduce((a, p) => a + p.z, 0) / plats.length;
    const d = Math.hypot(cx - ex, cz - ez) || 1;
    const x = ex + (cx - ex) * 2 / d; const z = ez + (cz - ez) * 2 / d;
    return { x, z, y: T.heightAt(x, z) };
  }
  // the trains standing at a station now (doors open)
  const docked = (ms, stationId) => TRAINS.map((t) => trainAt(t.id, ms)).filter((st) => st.stop === stationId && st.wait > 0.7 && st.wait <= DWELL - 0.7);
  // when the next train of each line calls at a station (whole seconds)
  function nextAt(stationId, ms) {
    const out = {};
    for (const [line, L] of Object.entries(LINES)) {
      if (!L.order.includes(stationId)) continue;
      let best = Infinity;
      for (const t of L.trains) {
        const clock = service?.clocks?.find((c) => c.id === t.id); if (clock?.held) continue;
        const cursor = clock ? clock.cursor + Math.max(0, ms - service.at) : ms;
        for (let dt = 0; dt <= CYCLE; dt += 1) if (timetableAt(t.id, cursor + dt * 1000).stop === stationId) { best = Math.min(best, dt); break; }
      }
      out[line] = Number.isFinite(best) ? best : null;
    }
    return out;
  }
  // no tree under a rail low enough to touch it (a tree stands up to about 9 m)
  T.addTreeBlock((x, z) => Object.values(LINES).some(({ route: r }) => { for (let i = 0; i < r.S.length; i += 2) { if (Math.abs(r.xs[i] - x) > 5 || Math.abs(r.zs[i] - z) > 5) continue; if (Math.hypot(r.xs[i] - x, r.zs[i] - z) < 5 && r.ys[i] - T.heightAt(x, z) < 11) return true; } return false; }));
  return { CYCLE, TRAVEL, DWELL, SURFACE, CLEAR, SEATS, CAR, DOCK, SEA, STATIONS, LINES, TRAINS, PLATFORMS, platformSpot, liftOf, pointAt, trainAt, timetableAt, createTraffic, setService, carOf, seatAt, docked, nextAt, stationOf: (id) => STATIONS[id] ? { id, ...STATIONS[id], spot: { x: STATIONS[id].entry[0], z: STATIONS[id].entry[1] } } : null };
}));
