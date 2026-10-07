// v1.10.47 공중 관광열차 (비공개 IDEAS 「공중 관광열차」, 사용자 확정 2026-10-07 · 설계 갱신 2026-10-08): sightseeing trains on
// glass rails. Four stations -- A 내부 강변역 (by the widened north-west stream, high up), B 동해안역, C 북해안역, D 남서해안역
// -- and two lines that never share a rail: 외곽 (round the coast, D -> B -> C -> D, two trains 144 s apart) and 전망
// (A -> C -> high over the central plaza -> D -> A, two trains). Every leg 90 s, every stop 6 s, a round 288 s, run all day
// with or without anyone on board. At C and D the coast line stops low and the view line high (two platforms, one lift).
// Shared by the browser and server, like island-terrain.js: cubic rail curves with straight docking corridors,
// sampled at sub-metre spacing. A train position follows the server clock --
// the server reserves segments and station tracks; clients share its progress clocks, including safety holds.
(function (root, factory) {
  const terrain = typeof module === 'object' && module.exports ? require('./island-terrain.js') : root.IslandTerrain;
  const api = factory(terrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandTrain = api;
}(typeof self !== 'undefined' ? self : this, (T) => {
  const { lerp } = T;
  const SEA = -0.6; // the sea's surface in the game (the drawing's heights are over the sea)
  const TRAVEL = 90; const DWELL = 6; const CYCLE = 3 * (TRAVEL + DWELL); // seconds
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
    outer: { name: '외곽 열차', side: -1, order: ['D', 'B', 'C'], trains: [{ id: 1, offset: 0 }, { id: 2, offset: 144 }] },
    view: { name: '전망 열차', side: 1, order: ['A', 'C', 'D'], trains: [{ id: 3, offset: 48 }, { id: 4, offset: 192 }] },
  };
  // Wide seaward sightseeing curves and 40m straight docking corridors.
  const corridor = (x,z,y,dx,dz,id) => [-20,-10,0,10,20].map(k => [x+dx*k,z+dz*k,y,k===0?id:null,dx,dz]);
  const inv = 1 / Math.sqrt(2);
  const routes = {
    outer: [
      ...corridor(-90.8,76.2,2.2,inv,inv,'D'), [-45,125,5.5], [10,150,6.5], [80,135,6.5], [140,80,6.5], [145,25,4.5],
      ...corridor(109.7,-9.6,2.2,-.4,-Math.sqrt(.84),'B'), [95,-70,6.5], [65,-140,6.5], [10,-150,6.5],
      ...corridor(-18.4,-104.6,8,-1,0,'C'), [-80,-125,6.5], [-140,-75,6.5], [-150,0,5], [-140,50,3.5],
    ],
    view: [
      ...corridor(-22.6,-35,13.4,0,-1,'A'), [-65,-70,15], [-75,-110,16], [-48.4,-104.6,12.4],
      ...corridor(-18.4,-104.6,14.4,1,0,'C'), [45,-145,18], [95,-130,19], [105,-75,19], [55,-40,19], [0,-4,17.4], [-45,45,14], [-65.05,57.29,8.4],
      ...corridor(-90.8,76.2,8.4,-.8,.6,'D'), [-135,95,8.4], [-160,65,10], [-140,20,14], [-80,-5,15], [-60,-10,14], [-22.6,5,13.4],
    ],
  };
  for (const [name,line] of Object.entries(LINES)) {
    const raw = routes[name]; const n=raw.length; const xs=[], zs=[], ys=[], S=[]; const stops={}; let distance=0;
    for(let i=0;i<n;i++) {
      const prev=raw[(i+n-1)%n], a=raw[i], b=raw[(i+1)%n], next=raw[(i+2)%n];
      const tangent=(p,q,r) => { const dx=r[0]-p[0],dz=r[1]-p[1]; const d=Math.hypot(dx,dz); const length=Math.min(Math.hypot(q[0]-p[0],q[1]-p[1]),Math.hypot(r[0]-q[0],r[1]-q[1]))*.4; return [dx/d*length,dz/d*length]; };
      const span=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const direction=(v,p,q,r) => v[4] != null ? [v[4]*span*.4,v[5]*span*.4] : (() => { const t=tangent(p,q,r),length=Math.hypot(...t);return t.map(x=>x/length*span*.4); })();
      const ta=direction(a,prev,a,b), tb=direction(b,a,b,next); const steps=Math.max(4,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*1.5));
      for(let k=0;k<steps;k++) {
        const t=k/steps; const f=(v,p,q,w)=>(1-t)**3*v+3*(1-t)**2*t*p+3*(1-t)*t*t*q+t**3*w;
        const x=f(a[0],a[0]+ta[0],b[0]-tb[0],b[0]); const z=f(a[1],a[1]+ta[1],b[1]-tb[1],b[1]);
        const y=lerp(a[2],b[2],t*t*(3-2*t))+SEA;
        if(xs.length) distance+=Math.hypot(x-xs.at(-1),z-zs.at(-1));
        xs.push(x);zs.push(z);ys.push(y);S.push(distance); if(k===0&&a[3]) stops[a[3]]=distance;
      }
    }
    distance+=Math.hypot(xs[0]-xs.at(-1),zs[0]-zs.at(-1)); xs.push(xs[0]);zs.push(zs[0]);ys.push(ys[0]);S.push(distance);
    line.route={xs,zs,ys,S,LENGTH:distance};line.stops=stops;
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
  const ease = (u) => { const t = u * TRAVEL; const ramp = 4; const distance = TRAVEL - ramp;
    if (t < ramp) return t * t / (2 * ramp * distance);
    if (t > TRAVEL - ramp) return 1 - (TRAVEL - t) ** 2 / (2 * ramp * distance);
    return (t - ramp / 2) / distance;
  };
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
        const phase = ((c.cursor / 1000 - trainOf(c.id).offset) % (TRAVEL + DWELL) + TRAVEL + DWELL) % (TRAVEL + DWELL);
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
  // Walk only inside the platform deck, inset by the player's radius; never on the running rail.
  function platformClamp(line, station, x, z) {
    const p = platformOf(line, station); const c = Math.cos(p.yaw); const s = Math.sin(p.yaw);
    const dx = x - p.x; const dz = z - p.z;
    const lx = Math.max(-1.1, Math.min(1.1, dx * c - dz * s));
    const lz = Math.max(-2.1, Math.min(2.1, dx * s + dz * c));
    return { x: p.x + lx * c + lz * s, y: p.y, z: p.z - lx * s + lz * c, yaw: p.yaw };
  }
  function liftOf(station) {
    const plats = PLATFORMS.filter((p) => p.station === station); const [ex, ez] = STATIONS[station].entry;
    const cx = plats.reduce((a, p) => a + p.x, 0) / plats.length; const cz = plats.reduce((a, p) => a + p.z, 0) / plats.length;
    const heading = Math.atan2(cx - ex, cz - ez);
    // The 2.5m shaft must clear the walking corridor and station entrance, even on the narrow coast.
    for (const radius of [4, 5, 6, 7, 8, 9, 10]) for (const turn of [0, .3, -.3, .6, -.6, .9, -.9, 1.2, -1.2, Math.PI]) {
      const x = ex + Math.sin(heading + turn) * radius; const z = ez + Math.cos(heading + turn) * radius;
      if (T.walkDist(x, z) < 3.2 || [-2, -1, 0, 1, 2].some((dx) => [-2, -1, 0, 1, 2].some((dz) => T.onBridge(x + dx, z + dz))) || T.BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 8)) continue;
      if (T.coastDist(x, z) > 0 && !T.walkable(x, z)) continue;
      return { x, z, y: T.coastDist(x, z) < 0 ? SEA : T.heightAt(x, z) };
    }
    throw new Error('No clear lift site: ' + station);
  }
  // v1.10.47 had 84 offshore supports (79 outer, 5 view). Keep 28 total even on the longer rails.
  const PILLARS = [];
  for (const [line,L] of Object.entries(LINES)) {
    const r = L.route; const sea = [];
    for (let s = 4; s < r.LENGTH - 4; s += 9) {
      const i = r.S.findIndex((v) => v >= s); const x = r.xs[i]; const z = r.zs[i];
      if (T.coastDist(x, z) < 0) sea.push({ x, z, top: r.ys[i] - .2, foot: SEA - .6 });
    }
    const count = line === 'outer' ? 26 : 2;
    for (let i=0;i<count;i++) PILLARS.push(sea[Math.floor((i+.5)*sea.length/count)]);
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
  const liftSites = Object.keys(STATIONS).map(liftOf);
  T.addTreeBlock((x, z) => liftSites.some(p => Math.hypot(p.x-x,p.z-z)<2.5) || Object.values(LINES).some(({ route: r }) => { for (let i = 0; i < r.S.length; i += 2) { if (Math.abs(r.xs[i] - x) > 5 || Math.abs(r.zs[i] - z) > 5) continue; if (Math.hypot(r.xs[i] - x, r.zs[i] - z) < 5 && r.ys[i] - T.heightAt(x, z) < 11) return true; } return false; }));
  return { CYCLE, TRAVEL, DWELL, SURFACE, CLEAR, SEATS, CAR, DOCK, SEA, STATIONS, LINES, TRAINS, PLATFORMS, PILLARS, platformSpot, platformClamp, liftOf, pointAt, trainAt, timetableAt, createTraffic, setService, carOf, seatAt, docked, nextAt, stationOf: (id) => STATIONS[id] ? { id, ...STATIONS[id], spot: { x: STATIONS[id].entry[0], z: STATIONS[id].entry[1] } } : null };
}));
