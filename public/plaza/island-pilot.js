// v1.10.275 그래픽 시범 (gamecenter-notes docs/graphics-pilot-20261107.md, assets 106 Nature Megapack Extended, RG Poly CC0):
// one grass patch west of the plaza's north path -- where its plants stand and its blades of grass grow. Every screen
// lays it out the same from one seed; nothing here is solid or a game thing (plants keep off the trees and rocks, the
// plaza, the path). Browser and node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandPilot = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ZONE = Object.freeze({ x: -15, z: -40, r: 9.5 });
  const PATH_X = -5.5; // (the north path's west edge: nothing east of it)
  const CUT_R = 0.75; // (round a weed, an insect, a thing on the ground: no blades -- they stay easy to see)
  // the 24 models (assets 106 pick.md), how many of each in the patch and how far they keep off a tree or rock
  const KINDS = Object.freeze({
    grass_tuft: [18, 0.3], grass_short: [22, 0.3], grass_broad: [10, 0.3], grass_reed: [6, 0.4],
    flower_blue: [6, 0.4], flower_daisy: [8, 0.4], flower_red: [6, 0.4], flower_lily: [4, 0.4],
    bush_round: [2, 0.9], bush_berry: [2, 0.9], bush_leafy: [3, 0.8], bush_fern: [4, 0.6],
    rock_pebble: [8, 0.3], rock_flat: [2, 0.6], mushroom_red: [3, 0.3], mushroom_brown: [3, 0.3],
  });
  const IDS = Object.freeze(['tree_poplar', 'tree_round', 'tree_cluster', 'tree_twin', 'tree_fir', 'tree_fir_slim', 'bush_round', 'bush_berry', 'bush_leafy', 'bush_fern',
    'rock_boulder', 'rock_flat', 'rock_block', 'rock_pebble', 'grass_broad', 'grass_tuft', 'grass_short', 'grass_reed', 'flower_blue', 'flower_daisy', 'flower_red', 'flower_lily', 'mushroom_red', 'mushroom_brown']);
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // where a thing may grow: in the patch, west of the path, off the plaza, `gap` clear of every solid
  const free = (T, solids, x, z, gap) => Math.hypot(x - ZONE.x, z - ZONE.z) <= ZONE.r && x <= PATH_X && !(T.inPlaza && T.inPlaza(x, z)) && solids.every((s) => Math.hypot(x - s.x, z - s.z) > (s.r || 0.5) + gap);
  const solidsNear = (T) => [...(T.natureSolids?.() || []), ...(T.structureSolids?.() || []), ...(T.villageSolids?.() || [])].filter((s) => Math.hypot(s.x - ZONE.x, s.z - ZONE.z) < ZONE.r + 3);
  // the plants: { id, x, z, yaw, s } -- mushrooms by a tree or rock, the rest anywhere free, not on one another
  function plants(T) {
    const solids = solidsNear(T); const r = rng(1061); const out = [];
    for (const [id, [n, gap]] of Object.entries(KINDS)) {
      for (let k = 0, tries = 0; k < n && tries < n * 60; tries += 1) {
        let x; let z;
        if (id.startsWith('mushroom') && solids.length) { const s = solids[Math.floor(r() * solids.length)]; const a = r() * Math.PI * 2; const d = (s.r || 0.5) + 0.4 + r() * 0.8; x = s.x + Math.sin(a) * d; z = s.z + Math.cos(a) * d; }
        else { const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * ZONE.r; x = ZONE.x + Math.sin(a) * d; z = ZONE.z + Math.cos(a) * d; }
        if (!free(T, solids, x, z, gap) || out.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(gap, p.gap))) continue;
        out.push({ id, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, yaw: Math.round(r() * 628) / 100, s: Math.round((0.85 + r() * 0.3) * 100) / 100, gap }); k += 1;
      }
    }
    return out.map(({ gap, ...p }) => p);
  }
  // the blades: { x, z, yaw, h } -- thinner toward the patch's edge, none on a solid
  function blades(T, count) {
    const solids = solidsNear(T); const r = rng(2751); const out = [];
    for (let tries = 0; out.length < count && tries < count * 4; tries += 1) {
      const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * ZONE.r; const x = ZONE.x + Math.sin(a) * d; const z = ZONE.z + Math.cos(a) * d;
      const e = Math.min(1, Math.max(0, (d / ZONE.r - 0.55) / 0.45)); if (r() < e * e * (3 - 2 * e) || !free(T, solids, x, z, 0.12)) continue; /* (thinning out from halfway: no edge to see) */
      out.push({ x, z, yaw: r() * Math.PI * 2, h: 0.12 + r() * 0.14 });
    }
    return out;
  }
  const inZone = (x, z, pad = 0) => Math.hypot(x - ZONE.x, z - ZONE.z) <= ZONE.r + pad;
  return Object.freeze({ ZONE, PATH_X, CUT_R, KINDS, IDS, plants, blades, inZone });
}));
