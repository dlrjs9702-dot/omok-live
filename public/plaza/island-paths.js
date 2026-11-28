// 섬 길 다시 만들기 「땅에 칠하는 길」 (gamecenter-notes docs/path-paint-design-20261025.md) ②: the walks as a picture the
// ground's own shader reads, so a walk is painted into the ground (no strip laid over it -- nothing to float, sink or
// flicker where two meet). One RGBA texel per cell of the ground:
//   R  how far inside the nearest walk's edge (metres, + inside), ±EDGE_RANGE over 0..255 -- linear filtering keeps it smooth
//   G,B  where along that walk, as cos/sin of 2π·along/ALONG_PERIOD (a phase filters well across texels; atan2 gets it back)
//   A  the walk's tier: 0 none, 85 trail, 170 walk, 255 town
// The same file in the browser (island.js) and for the tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandPaths = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const EDGE_RANGE = 1.5; const ALONG_PERIOD = 4; const TIER = { trail: 85, walk: 170, town: 255 };
  // curves: [{ w, tier, pts: [[x, z], ...] }]; the field covers x0..x0+size, z0..z0+size in res x res cells
  function buildPathField(curves, { x0, z0, size, res = 1024, keep = () => true }) {
    const cell = size / res; const best = new Float32Array(res * res).fill(-Infinity); const out = new Uint8Array(res * res * 4);
    for (const c of curves) {
      const half = c.w / 2; const reach = half + EDGE_RANGE; let along = 0;
      for (let i = 1; i < c.pts.length; i += 1) {
        const [ax, az] = c.pts[i - 1]; const [bx, bz] = c.pts[i]; const dx = bx - ax; const dz = bz - az; const len = Math.hypot(dx, dz);
        if (!len) continue;
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - x0) / cell)); const i1 = Math.min(res - 1, Math.ceil((Math.max(ax, bx) + reach - x0) / cell));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz) - reach - z0) / cell)); const j1 = Math.min(res - 1, Math.ceil((Math.max(az, bz) + reach - z0) / cell));
        for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
          const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len * len)));
          const inside = half - Math.hypot(x - ax - dx * t, z - az - dz * t); const k = j * res + i;
          if (inside <= best[k] || inside < -EDGE_RANGE || !keep(x, z)) continue;
          best[k] = inside; const phase = ((along + len * t) / ALONG_PERIOD) * Math.PI * 2;
          out[k * 4] = Math.round((Math.max(-1, Math.min(1, inside / EDGE_RANGE)) * 0.5 + 0.5) * 255);
          out[k * 4 + 1] = Math.round((Math.cos(phase) * 0.5 + 0.5) * 255); out[k * 4 + 2] = Math.round((Math.sin(phase) * 0.5 + 0.5) * 255);
          out[k * 4 + 3] = TIER[c.tier] || TIER.walk;
        }
        along += len;
      }
    }
    return out;
  }
  // where walks meet (one's point by another's, as the old junction discs): the stones there have no direction -- the
  // two walks' courses would meet in a crooked seam (길 시범 검토 ⓪-1) -- 1 within r of a meeting, fading out 1.5 m past it
  function junctionsOf(curves, near = 0.9, apart = 6) {
    const out = [];
    curves.forEach((c, ci) => c.pts.forEach(([x, z]) => {
      if (out.some((j) => Math.hypot(j.x - x, j.z - z) < apart)) return;
      const other = curves.find((o, oi) => oi !== ci && o.pts.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < near));
      if (other) out.push({ x, z, r: Math.max(c.w, other.w) / 2 + 0.6 });
    }));
    return out;
  }
  function buildJunctionField(junctions, { x0, z0, size, res = 1024 }) {
    const cell = size / res; const out = new Uint8Array(res * res);
    for (const j of junctions) {
      const reach = j.r + 1.5;
      const i0 = Math.max(0, Math.floor((j.x - reach - x0) / cell)); const i1 = Math.min(res - 1, Math.ceil((j.x + reach - x0) / cell));
      const k0 = Math.max(0, Math.floor((j.z - reach - z0) / cell)); const k1 = Math.min(res - 1, Math.ceil((j.z + reach - z0) / cell));
      for (let k = k0; k <= k1; k += 1) for (let i = i0; i <= i1; i += 1) {
        const d = Math.hypot(x0 + (i + 0.5) * cell - j.x, z0 + (k + 0.5) * cell - j.z); const w = Math.max(0, Math.min(1, 1 - (d - j.r) / 1.5));
        out[k * res + i] = Math.max(out[k * res + i], Math.round(w * 255));
      }
    }
    return out;
  }
  // the painted network of 달마루섬 (path-paint 설계 ① 연결망 한 곳): the walks, cut where they pass under 대청마당's paving, the
  // hall's yard, a bridge or a stream (a trail 60% of its width); each building's short way from its door to the nearest
  // walk; each hall's paved way to the plaza's edge -- and where paint may go
  function paintedWalks(T) {
    const P = T.dalmaru.PLAZA; const plazaDist = (x, z) => Math.max(Math.abs(x - P.x) - P.hw, P.d0 - z, z - P.d1);
    const cut = (x, z) => T.onBridge(x, z) || T.streamDist(x, z) < T.STREAM_HALF + 0.4 || plazaDist(x, z) < -0.2 || T.inTownhall(x, z, -0.2);
    const out = [];
    for (const w of T.walkCurves) {
      let run = []; const flush = () => { if (run.length > 1) out.push({ pts: run, w: w.tier === 'trail' ? w.w * 0.6 : w.w, tier: w.tier }); run = []; };
      for (const p of w.pts) { if (cut(p[0], p[1])) flush(); else run.push(p); }
      flush();
    }
    for (const b of T.BUILDINGS) { // (v1.10.13 문 앞 길)
      if (b.kind === 'cottage' || b.kind === 'hall' || b.kind === 'facade' || plazaDist(b.x, b.z) < 3) continue;
      const dx = b.face[0] - b.x; const dz = b.face[1] - b.z; const l = Math.hypot(dx, dz) || 1; const door = [b.x + (dx / l) * 2.4, b.z + (dz / l) * 2.4];
      let best = null; T.walkCurves.forEach((w) => w.pts.forEach(([x, z]) => { const d = Math.hypot(x - door[0], z - door[1]); if (!best || d < best.d) best = { d, x, z, w }; }));
      if (!best || best.d < best.w.w / 2 + 0.6 || best.d > 9) continue;
      const end = [best.x - ((best.x - door[0]) / best.d) * (best.w.w / 2 - 0.3), best.z - ((best.z - door[1]) / best.d) * (best.w.w / 2 - 0.3)];
      const n = Math.max(2, Math.ceil(Math.hypot(end[0] - door[0], end[1] - door[1]) / 0.8));
      const pts = Array.from({ length: n + 1 }, (_, k) => [door[0] + ((end[0] - door[0]) * k) / n, door[1] + ((end[1] - door[1]) * k) / n]);
      if (pts.some(([x, z]) => T.streamDist(x, z) < T.STREAM_HALF + 0.4)) continue;
      out.push({ pts, w: 1.7, tier: best.w.tier });
    }
    for (const id of Object.keys(T.SPOTS).filter((k) => T.SPOTS[k].kind === 'hall')) { // (3회차 20: the hall's paved way onto 대청마당)
      const door = T.facilityDoor(id); if (!door) continue; const s = T.SPOTS[id]; const fl = Math.hypot(s.face[0] - s.x, s.face[1] - s.z) || 1;
      const d = { x: door.x - ((s.face[0] - s.x) / fl) * 1.5, z: door.z - ((s.face[1] - s.z) / fl) * 1.5 };
      const ex = Math.max(P.x - P.hw + 0.3, Math.min(P.x + P.hw - 0.3, d.x)); const ez = Math.max(P.d0 + 0.3, Math.min(P.d1 - 0.3, d.z)); const l = Math.hypot(ex - d.x, ez - d.z);
      if (l < 0.5 || l > 8) continue;
      const n = Math.max(2, Math.ceil(l / 0.8)); out.push({ pts: Array.from({ length: n + 1 }, (_, k) => [d.x + ((ex - d.x) * k) / n, d.z + ((ez - d.z) * k) / n]), w: 3.2, tier: 'town' });
    }
    return { curves: out, paintable: (x, z) => !cut(x, z) };
  }
  // the ground's maps (one texel per GROUND/res metres, row 0 at the ground's north edge): where paint goes and how --
  //   path-a  R inside the edge, G/B the course's phase      path-b  R tier, G where walks meet (B: the cover map's gravel)
  function buildPathMaps(T, res = 1024, at = null) { // (at { x0, z0, size }: another square than the ground's -- N1 new island's)
    const size = at?.size ?? T.GROUND.size; const box = { x0: at?.x0 ?? -size / 2, z0: at?.z0 ?? -size / 2, size, res };
    const { curves, paintable } = paintedWalks(T);
    const field = buildPathField(curves, { ...box, keep: paintable }); const join = buildJunctionField(junctionsOf(curves), box);
    const a = new Uint8Array(res * res * 3); const b = new Uint8Array(res * res * 3);
    for (let k = 0; k < res * res; k += 1) { a[k * 3] = field[k * 4]; a[k * 3 + 1] = field[k * 4 + 1]; a[k * 3 + 2] = field[k * 4 + 2]; b[k * 3] = field[k * 4 + 3]; b[k * 3 + 1] = join[k]; }
    return { a, b, box };
  }
  // T1 길 넓히기 (notes docs/island-expansion-20261115.md §9, 171A): the taxi road as its own map -- the ground's shader paints two
  // lanes, a kerb and a walk each side from it, over the walks:
  //   road  R the signed distance from the road's middle (metres, + its right), ±ROAD_RANGE over 0..255, unbroken out to
  //         ROAD_RANGE -- across the middle it runs straight, so filtered texels still find a thin line, and its slope gives the
  //         road's direction (the dashes)
  //         G where it is painted (1 within MASK of the middle)   B a 건널목 (1 within CROSS_HALF of one, along)
  // A filtered texel between the road and none reads a mixed R -- so where, is told by G alone. Not painted on a bridge or
  // 대청마당's paving (each has its own floor) nor out on the sea
  const ROAD_RANGE = 5; const MASK = 4.4; const MOUTH = 64; /* (435: B 0.25 -- a T's mouth, under a 건널목's 0.46) */ /* (±5 m in 8 bits: 3.9 cm a step -- 10 m showed steps along a bend's lines) */
  function buildRoadMap(T, X, res = 1024, at = null) {
    const size = at?.size ?? T.GROUND.size; const x0 = at?.x0 ?? -size / 2; const z0 = at?.z0 ?? -size / 2; const cell = size / res; const n = res * res;
    const out = new Uint8Array(n * 3); const best = new Float32Array(n).fill(Infinity); for (let k = 0; k < n; k += 1) out[k * 3] = 255;
    const P = T.dalmaru?.PLAZA; const plazaDist = P ? (x, z) => Math.max(Math.abs(x - P.x) - P.hw, P.d0 - z, z - P.d1) : () => 1;
    const keep = (x, z) => !T.onBridge(x, z) && plazaDist(x, z) >= -0.2 && T.coastDist(x, z) > -1.5;
    /* (1.10.395 N4-c: every road -- the road on to 별마루섬 too; a 건널목 counts on the road it stands on) */
    const crossAlong = []; const segs = [];
    /* (1.10.404 문제 기록 3353cf17, notes issues-taxi-resident §13 A 「마당으로」: the stretch along 대청마당's north edge (both its ends within 2 m of it)
       not painted -- half of it lay on the paving, a lane and a walk cut off at the tiles; the road coming down ends square at the edge, the
       terminal on the paving. Still a road for the cars -- only its paint) */
    const alongPlaza = (p, q) => P && Math.abs(plazaDist(p[0], p[1])) < 2 && Math.abs(plazaDist(q[0], q[1])) < 2;
    /* (1.10.412: a road ending at a round place (X.TURN_PADS) ends square there -- no rounded cap of lines beside the place) */
    const padEnd = (pt) => (X.TURN_PADS || []).some((pad) => Math.hypot(pt[0] - pad.x, pt[1] - pad.z) < pad.r + 0.5);
    /* (1.10.435 문제 기록 1b9f6edf: a T (X.TEES) -- the cars' corner curves not painted; the shore road straight across and the stem squared off at its
       middle painted instead; in the mouth no yellow or edge line, after) */
    const teeAt = (t, x, z) => { const dx = x - t.x; const dz = z - t.z; return { a: dx * t.ux + dz * t.uz, l: dx * t.uz - dz * t.ux }; };
    const inCorner = (pt) => (X.TEES || []).some((t) => { const { a, l } = teeAt(t, pt[0], pt[1]); const [a0, a1, lm] = t.box || [-0.3, 9, 4.5]; return a >= a0 - 1e-6 && a <= a1 && Math.abs(l) <= lm; }); /* (the cars' Y from the junction 8.4 m down the stem; 436 each T its own box) */
    /* (435: a road drawn the other way from one it meets (X.PAINT_FLIP: L2 · L1 run west from where ROUTE · EXT run east) has its sides told the
       other way round -- the middle's sign the same either side of the joint; a flip there filtered to 0, a squiggle of yellow over the lanes) */
    const flips = new Set(X.PAINT_FLIP || []); const seen = new Set(); /* (435: a piece another road has painted already -- the T's stem is ROUTE's and L2's both -- once, the first road's: its crossing and side) */
    const again = (p, q) => { const k = `${p}>${q}`; const back = `${q}>${p}`; if (seen.has(k) || seen.has(back)) return true; seen.add(k); return false; };
    /* (436: a square end a plane across the line there, for every piece within 10 m of it -- a joint's round from the piece before reached past a
       short last piece: L1's 1.6 m into its round place, a T's stem at a stop) */
    const plane = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [b[0], b[1], (b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
    (X.ROADS || [X.ROUTE]).forEach((route, r) => { let total = 0; const flip = flips.has(route) ? -1 : 1; const n = route.length - 1; const end = padEnd(route[n]) ? plane(route[n - 1], route[n]) : null;
      for (let i = 1; i < route.length; i += 1) { const p = route[i - 1]; const q = route[i]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]); if (!alongPlaza(p, q) && !(inCorner(p) && inCorner(q)) && !again(p, q)) segs.push({ p, q, len, at: total, r, flip, ...(end && Math.hypot(p[0] - end[0], p[1] - end[1]) < 10 ? { cut: [end] } : {}) }); total += len; } });
    /* (436: a stem drawn from the junction (the way its road runs on from there) squared at its first point; `far` -- its other end square too) */
    const atJ = (t, pt) => Math.hypot(pt[0] - t.x, pt[1] - t.z) < 0.01;
    (X.TEES || []).forEach((t, k) => { for (const [n, line, stem] of [[0, t.bar, false], [1, t.stem, true]]) { if (!line) continue; const r = (X.ROADS || [X.ROUTE]).length + k * 2 + n; let total = 0; /* (its own road each -- a crossing on the stem not along the bar) */
      const j0 = stem && atJ(t, line[0]); const sqEnd = stem && (!j0 || t.far); const sqStart = stem && (j0 || t.far);
      const n1 = line.length - 1; const cut = [...(sqEnd ? [plane(line[n1 - 1], line[n1])] : []), ...(sqStart ? [plane(line[1], line[0])] : [])];
      for (let i = 1; i < line.length; i += 1) { const p = line[i - 1]; const q = line[i]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]); segs.push({ p, q, len, at: total, r, ...(cut.length ? { cut } : {}) }); total += len; } } });
    const footOf = (x, z) => { let b = null; for (const s of segs) { const dx = s.q[0] - s.p[0]; const dz = s.q[1] - s.p[1]; const t = Math.max(0, Math.min(1, ((x - s.p[0]) * dx + (z - s.p[1]) * dz) / (s.len * s.len || 1e-9))); const d = Math.hypot(x - s.p[0] - dx * t, z - s.p[1] - dz * t); if (!b || d < b.d) b = { d, along: s.at + s.len * t, r: s.r }; } return b; };
    for (const c of X.CROSSINGS || []) { const f = footOf(c.x, c.z); crossAlong.push({ r: f.r, along: f.along }); }
    const reach = ROAD_RANGE;
    for (const s of segs) {
      if (!s.len) continue; const dx = s.q[0] - s.p[0]; const dz = s.q[1] - s.p[1];
      const i0 = Math.max(0, Math.floor((Math.min(s.p[0], s.q[0]) - reach - x0) / cell)); const i1 = Math.min(res - 1, Math.ceil((Math.max(s.p[0], s.q[0]) + reach - x0) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(s.p[1], s.q[1]) - reach - z0) / cell)); const j1 = Math.min(res - 1, Math.ceil((Math.max(s.p[1], s.q[1]) + reach - z0) / cell));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
        const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell; const k = j * res + i;
        const tr = ((x - s.p[0]) * dx + (z - s.p[1]) * dz) / (s.len * s.len); if ((s.cut &&s.cut.some(([px, pz, ux, uz]) => (x - px) * ux + (z - pz) * uz > 0))) continue; const t = Math.max(0, Math.min(1, tr));
        const d = Math.hypot(x - s.p[0] - dx * t, z - s.p[1] - dz * t); if (d >= best[k] || d >= reach) continue;
        best[k] = d;
        const side = (Math.sign((x - s.p[0]) * dz - (z - s.p[1]) * dx) || 1) * (s.flip || 1); /* (+: the road's right, heading p -> q; 435 a flipped road's left) */
        const along = s.at + s.len * t; const cross = crossAlong.reduce((w, a) => (a.r !== s.r ? w : Math.max(w, 1 - Math.max(0, Math.min(1, (Math.abs(along - a.along) - (X.CROSS_HALF ?? 2.2)) / 0.4)))), 0);
        out[k * 3] = Math.max(0, Math.min(255, Math.round(((side * d) / ROAD_RANGE * 0.5 + 0.5) * 255)));
        out[k * 3 + 1] = d < MASK ? 255 : 0; out[k * 3 + 2] = d < MASK ? Math.round(cross * 255) : 0;
      }
    }
    /* (1.10.412 L3: a dead end's round place (X.TURN_PADS) -- asphalt to r - 1.6 with its white edge line 0.44 m in, a kerb, the walk to r; no yellow middle.
       As a distance from the road's middle: 0.2 at its centre to 2.3 at the kerb, then the walk's own; the road's own where that is further in) */
    /* (436: the place's sign the side its road's end tells there -- L1 painted the other way now (PAINT_FLIP), the place too) */
    const padSign = (pad) => { let b = null; for (const s of segs) { const dx = s.q[0] - s.p[0]; const dz = s.q[1] - s.p[1]; const t = Math.max(0, Math.min(1, ((pad.x - s.p[0]) * dx + (pad.z - s.p[1]) * dz) / (s.len * s.len || 1e-9))); const d = Math.hypot(pad.x - s.p[0] - dx * t, pad.z - s.p[1] - dz * t); if (!b || d < b.d) b = { d, side: (Math.sign((pad.x - s.p[0]) * dz - (pad.z - s.p[1]) * dx) || 1) * (s.flip || 1) }; } return b ? b.side : 1; };
    for (const pad of X.TURN_PADS || []) { const inner = pad.r - (3.9 - 2.3); const sg = padSign(pad); const i0 = Math.max(0, Math.floor((pad.x - pad.r - x0) / cell)); const i1 = Math.min(res - 1, Math.ceil((pad.x + pad.r - x0) / cell)); const j0 = Math.max(0, Math.floor((pad.z - pad.r - z0) / cell)); const j1 = Math.min(res - 1, Math.ceil((pad.z + pad.r - z0) / cell));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) { const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell; const k = j * res + i; const r = Math.hypot(x - pad.x, z - pad.z); if (r >= pad.r) continue;
        const off = r <= inner ? 0.2 + (r * 2.1) / inner : 2.3 + (r - inner); const was = out[k * 3 + 1] ? Math.abs((out[k * 3] / 255 - 0.5) * 2 * ROAD_RANGE) : Infinity; if (off >= was) continue;
        out[k * 3] = Math.round(((sg * off) / ROAD_RANGE * 0.5 + 0.5) * 255); out[k * 3 + 1] = 255; out[k * 3 + 2] = 0; } }
    /* (435: a T's mouth -- from 0.12 m off the shore road's middle to the stem's own, within the stem's lanes: plain asphalt (B MOUTH: no yellow, no
       edge line -- the stem's middle and the shore road's edge end there; island.js), the shore road's own side's sign kept) */
    for (const t of X.TEES || []) { const i0 = Math.max(0, Math.floor((t.x - 4 - x0) / cell)); const i1 = Math.min(res - 1, Math.ceil((t.x + 4 - x0) / cell)); const j0 = Math.max(0, Math.floor((t.z - 4 - z0) / cell)); const j1 = Math.min(res - 1, Math.ceil((t.z + 4 - z0) / cell));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) { const { a, l } = teeAt(t, x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell); if (a <= 0.12 || a > 3.9 || Math.abs(l) >= 2.3) continue;
        const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell; const [p, q] = t.stem; const sd = Math.sign((x - p[0]) * (q[1] - p[1]) - (z - p[1]) * (q[0] - p[0])) || 1; /* (the stem's own side: the sign turns inside the mouth and at the shore road's middle, never at a kerb) */
        const k = j * res + i; out[k * 3] = Math.round(((sd * Math.max(Math.abs(l), 0.3)) / ROAD_RANGE * 0.5 + 0.5) * 255); out[k * 3 + 1] = 255; out[k * 3 + 2] = MOUTH; } } /* (the stem's own distance on, so its kerbs meet it smoothly -- its lines hidden by MOUTH) */
    for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) { const k = j * res + i; if (out[k * 3 + 1] && !keep(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) { out[k * 3 + 1] = 0; out[k * 3 + 2] = 0; } }
    return out;
  }
  /* (1.10.423 다듬기 164 「역 앞 횡단보도」: a 건널목's bars straight from walk to walk -- not bent along a turning road: each crossing's foot on its
     road and that road's right there [x, z, nx, nz]; the ground's shader measures the bars across the nearest one's straight line) */
  function crossFrames(X) {
    const out = [];
    for (const c of X?.CROSSINGS || []) {
      /* (435: a T's painted stem or shore road within 0.5 m first -- its crossing square across the paint, not along the cars' Y under it) */
      const tees = (X.TEES || []).flatMap((t) => [t.stem, t.bar]).filter(Boolean); let b = null;
      for (const route of [...tees, ...(X.ROADS || [X.ROUTE])]) { if (b?.tee && b.d < 0.5) break; const tee = tees.includes(route);
        for (let i = 1; i < route.length; i += 1) { const p = route[i - 1]; const q = route[i]; const dx = q[0] - p[0]; const dz = q[1] - p[1]; const L = Math.hypot(dx, dz); if (!L) continue; const t = Math.max(0, Math.min(1, ((c.x - p[0]) * dx + (c.z - p[1]) * dz) / (L * L))); const fx = p[0] + dx * t; const fz = p[1] + dz * t; const d = Math.hypot(c.x - fx, c.z - fz); if (!b || d < b.d) b = { d, x: fx, z: fz, nx: dz / L, nz: -dx / L, tee }; } }
      if (b) out.push([b.x, b.z, b.nx, b.nz]);
    }
    return out;
  }
  return { EDGE_RANGE, ALONG_PERIOD, TIER, ROAD_RANGE, MOUTH, buildPathField, junctionsOf, buildJunctionField, paintedWalks, buildPathMaps, buildRoadMap, crossFrames };
}));
