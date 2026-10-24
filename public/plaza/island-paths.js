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
  function buildPathMaps(T, res = 1024) {
    const size = T.GROUND.size; const box = { x0: -size / 2, z0: -size / 2, size, res };
    const { curves, paintable } = paintedWalks(T);
    const field = buildPathField(curves, { ...box, keep: paintable }); const join = buildJunctionField(junctionsOf(curves), box);
    const a = new Uint8Array(res * res * 3); const b = new Uint8Array(res * res * 3);
    for (let k = 0; k < res * res; k += 1) { a[k * 3] = field[k * 4]; a[k * 3 + 1] = field[k * 4 + 1]; a[k * 3 + 2] = field[k * 4 + 2]; b[k * 3] = field[k * 4 + 3]; b[k * 3 + 1] = join[k]; }
    return { a, b, box };
  }
  return { EDGE_RANGE, ALONG_PERIOD, TIER, buildPathField, junctionsOf, buildJunctionField, paintedWalks, buildPathMaps };
}));
