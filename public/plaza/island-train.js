// v1.10.48: two coast stations, one grade-separated figure-eight, four trains 60s apart.
// Each half takes 120s (114s moving + 6s stopped); shared server-authoritative block reservations.
(function (root, factory) {
  const terrain = typeof module === 'object' && module.exports ? require('./island-terrain.js') : root.IslandTerrain;
  const api = factory(terrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandTrain = api;
}(typeof self !== 'undefined' ? self : this, (T) => {
  const { lerp } = T;
  const SEA = -0.6; // the sea's surface in the game (the drawing's heights are over the sea)
  const TRAVEL = 114; const DWELL = 6; const CYCLE = 2 * (TRAVEL + DWELL); // each half 120s, full circuit 240s
  const SURFACE = 0.025; // the running line over the rail's glass (the carriage's root stands on it)
  const CLEAR = 2.6; // a carriage's underside over ground one can walk on, anywhere but at a station
  // the carriage (Codex train_carriage, front -Z, doors on its left): four seats -- the avatar's root, facing forward
  const SEATS = [[-0.67, 0.725, -1.06], [0.67, 0.725, -1.06], [-0.67, 0.725, 1.06], [0.67, 0.725, 1.06]];
  const CAR = { width: 3.12, length: 4.52, under: 0.3 }; // its underside this far under the running line
  const DOCK = [3.24, -0.55, 0]; // the carriage's root in its platform's frame (the platform on the carriage's left)
  // a line's `side`: the doors' side of the way it runs (-1 left, the model as made; +1 right: the view line's stations are
  // on its right, so its carriage is drawn mirrored across its length -- doors, seats and all)
  const STATIONS = { B: { name: '동해안역', entry: [99.78, -8.73] }, D: { name: '남서해안역', entry: [-83.1, 69.73] } };
  const LINES = {
    tour: { name: '관광 열차', side: -1, order: ['B', 'D'], trains: [{ id: 1, offset: 0 }, { id: 2, offset: 60 }, { id: 3, offset: 120 }, { id: 4, offset: 180 }] },
  };
  // Wide seaward sightseeing curves and 40m straight docking corridors.
  const corridor = (x,z,y,dx,dz,id) => [-20,-10,0,10,20].map(k => [x+dx*k,z+dz*k,y,k===0?id:null,dx,dz]);
  const routes = { tour: [
    ...corridor(109.7,-9.6,7,.8,-.6,'B'), [150,-70,12], [120,-160,15], [30,-130,18],
    [0,0,18,null,-.5,Math.sqrt(.75)], [-45,85,15], ...corridor(-90.8,76.2,7,-.8,-.6,'D'),
    [-150,30,12], [-145,-95,18], [-65,-60,24], [0,0,24,null,.8,.6], [50,55,14]
  ] };
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
    const leg = Math.floor(p / (TRAVEL + DWELL)); const inLeg = p - leg * (TRAVEL + DWELL);
    const from = L.order[leg]; const to = L.order[(leg + 1) % L.order.length];
    const s0 = L.stops[from]; let s1 = L.stops[to]; if (s1 <= s0) s1 += L.route.LENGTH;
    if (inLeg < TRAVEL) return { id, line: t.line, from, s: lerp(s0, s1, ease(inLeg / TRAVEL)), stop: null, next: to, eta: TRAVEL - inLeg, wait: 0, moved: s1 - s0 };
    return { id, line: t.line, from, s: s1, stop: to, next: L.order[(leg + 2) % L.order.length], eta: 0, wait: TRAVEL + DWELL - inLeg, moved: 0 };
  }
  let service = null;
  function setService(snapshot) { service = snapshot || null; }
  // The station block starts BEFORE braking, so a queued train cannot reach an occupied platform.
  const boundaries = [0, 38, 76, 110, 120, 158, 196, 230, 240];
  function blockAt(id, cursor) {
    const phase = ((cursor / 1000 - trainOf(id).offset) % CYCLE + CYCLE) % CYCLE;
    const zone = boundaries.findIndex((end, i) => i > 0 && phase < end) - 1;
    return { zone, remaining: (boundaries[zone + 1] - phase) * 1000 };
  }
  function trainAt(id, ms) {
    const clock = service?.clocks?.find((c) => c.id === id);
    if (!clock) return timetableAt(id, ms);
    // Extrapolate only up to the next boundary. A stale response cannot let a client depart without a reservation.
    const boundary = blockAt(id, clock.cursor).remaining;
    const dt = clock.held ? 0 : Math.min(Math.max(0, ms - service.at), Math.max(0, boundary - 0.001));
    return { ...timetableAt(id, clock.cursor + dt), held: clock.held };
  }
  // The server owns progress and admits a train to its next block only after the previous occupant vacates.
  // Held trains keep their previous reservation; resuming never catches up by teleporting.
  function createTraffic(ms) {
    let at = ms;
    const clocks = TRAINS.map(({ id }) => ({ id, cursor: ms, held: false, zone: blockAt(id, ms - .001).zone }));
    const blocked = new Set();
    const key = (zone) => 'tour:zone:' + zone;
    const keys = (c) => [key(c.zone)];
    function departures() {
      const waiting = clocks.filter(c => blockAt(c.id, c.cursor).zone !== c.zone);
      const allowed = new Set(waiting.filter(c => !blocked.has(key(blockAt(c.id, c.cursor).zone))));
      // Vacating a block and entering the next is atomic, including simultaneous departures.
      let changed;
      do {
        changed = false;
        for (const c of allowed) {
          const target = blockAt(c.id, c.cursor).zone;
          if (clocks.some(other => other !== c && other.zone === target && !allowed.has(other))) {
            allowed.delete(c); changed = true;
          }
        }
      } while (changed);
      for (const c of waiting) {
        c.held = !allowed.has(c);
        if (!c.held) c.zone = blockAt(c.id, c.cursor).zone;
      }
    }
    function advance(now) {
      let remaining = Math.max(0, now - at); at = now;
      departures();
      while (remaining > 0.00001) {
        const moving = clocks.filter((c) => !c.held);
        let dt = remaining;
        for (const c of moving) {
          dt = Math.min(dt, blockAt(c.id, c.cursor).remaining);
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
    const p = PLATFORMS.find(p => p.station === station);
    // Beyond the deck's end, on the same side of the track: neither shaft nor upper walkway crosses a carriage.
    return { x: p.x + Math.sin(p.yaw) * (station==='B'?-5.5:5.5), z: p.z + Math.cos(p.yaw) * (station==='B'?-5.5:5.5), y: T.heightAt(...STATIONS[station].entry) };
  }
  // Distance from the centre to the deck's near edge along the approach direction.
  function platformEdgeDistance(p, x, z) {
    const dx = x - p.x; const dz = z - p.z; const length = Math.hypot(dx, dz);
    if (!length) return 0;
    const c = Math.cos(p.yaw); const s = Math.sin(p.yaw);
    const ux = Math.abs((dx * c - dz * s) / length);
    const uz = Math.abs((dx * s + dz * c) / length);
    return Math.min(ux > 1e-9 ? 1.7 / ux : Infinity, uz > 1e-9 ? 2.7 / uz : Infinity);
  }
  // v1.10.47 had 84 offshore supports (79 outer, 5 view). Keep 28 total even on the longer rails.
  const PILLARS = [];
  for (const [line,L] of Object.entries(LINES)) {
    const r = L.route; const sea = [];
    for (let s = 4; s < r.LENGTH - 4; s += 9) {
      const i = r.S.findIndex((v) => v >= s); const x = r.xs[i]; const z = r.zs[i];
      if (T.coastDist(x, z) < 0) sea.push({ x, z, top: r.ys[i] - .2, foot: SEA - .6 });
    }
    const count = 28;
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
  T.addNatureBlock((x,z,radius) => Object.entries(STATIONS).some(([id,st]) => {
    const lift=liftOf(id);
    return T.segDist(x,z,...st.entry,lift.x,lift.z)<1+radius || Math.hypot(x-lift.x,z-lift.z)<1.5+radius;
  }));
  T.addTreeBlock((x, z) => liftSites.some(p => Math.hypot(p.x-x,p.z-z)<2.5) || Object.values(LINES).some(({ route: r }) => { for (let i = 0; i < r.S.length; i += 2) { if (Math.abs(r.xs[i] - x) > 5 || Math.abs(r.zs[i] - z) > 5) continue; if (Math.hypot(r.xs[i] - x, r.zs[i] - z) < 5 && r.ys[i] - T.heightAt(x, z) < 11) return true; } return false; }));
  return { CYCLE, TRAVEL, DWELL, SURFACE, CLEAR, SEATS, CAR, DOCK, SEA, STATIONS, LINES, TRAINS, PLATFORMS, PILLARS, platformSpot, platformClamp, platformEdgeDistance, liftOf, pointAt, trainAt, timetableAt, createTraffic, setService, carOf, seatAt, docked, nextAt, stationOf: (id) => STATIONS[id] ? { id, ...STATIONS[id], spot: { x: STATIONS[id].entry[0], z: STATIONS[id].entry[1] } } : null };
}));
