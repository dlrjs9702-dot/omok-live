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
  return { EDGE_RANGE, ALONG_PERIOD, TIER, buildPathField, junctionsOf, buildJunctionField };
}));
