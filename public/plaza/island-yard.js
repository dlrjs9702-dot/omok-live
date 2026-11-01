// v1.10.225 마당 꾸미기 (gamecenter-notes docs/yard-20261102.md, assets 70 yard-v1): outside each house on 툇마루섬 its
// owner's yard -- the twelve yard goods (bought on the 백화점 3층's 「마당」 shelf, kept in the 가구 창고) placed on 0.25 m
// steps, turned by quarters. The yard: a box round the house (2.5 m out at first, 4 m and 6 m once made bigger at the
// 관공서, each side only as far as the lot's own flat ground goes) less the house, the 1.4 m way from its door to the
// walk, the walks, water, slopes, the neighbours' side and what grows there (trees, bushes, lamps) -- 총괄 saw it drawn
// for all twelve lots (notes img/yard-225). Lot-local metres as island-home's houses: the lot's front -Z toward its walk.
// Browser and server: the server checks every placing with these same rules.
(function (root, factory) {
  const terrain = typeof module === 'object' && module.exports ? require('./island-terrain.js') : root.IslandTerrain;
  const api = factory(terrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandYard = api;
}(typeof self !== 'undefined' ? self : this, (T) => {
  const LOTS = (T.HOME_LOTS || []).map((l, i) => ({ id: `lot${i + 1}`, ...l }));
  const lotById = (id) => LOTS.find((l) => l.id === id) || null;
  // shape (its name: island-furniture YARD_GOODS) -> footprint [w, d] (its own x, z before turning), what it blocks (own x, z, r), seats (own x, z)
  const ITEMS = Object.freeze({
    fence_wood: { foot: [1, 0.3], solids: [[-0.4, 0, 0.15], [0, 0, 0.15], [0.4, 0, 0.15]], fence: true },
    fence_stone: { foot: [1, 0.35], solids: [[-0.4, 0, 0.18], [0, 0, 0.18], [0.4, 0, 0.18]], fence: true },
    fence_flower: { foot: [1, 0.3], solids: [[-0.4, 0, 0.15], [0, 0, 0.15], [0.4, 0, 0.15]], fence: true },
    stepping_stones: { foot: [0.75, 2], solids: [] },
    garden_light: { foot: [0.5, 0.5], solids: [[0, 0, 0.15]], glow: true },
    birdhouse: { foot: [0.5, 0.5], solids: [[0, 0, 0.18]] },
    flowerbed: { foot: [1.25, 0.75], solids: [[-0.3, 0, 0.32], [0.3, 0, 0.32]] },
    planter_box: { foot: [1, 0.5], solids: [[-0.22, 0, 0.26], [0.22, 0, 0.26]] },
    mailbox: { foot: [0.5, 0.5], solids: [[0, 0, 0.2]] },
    bench: { foot: [1.25, 0.5], solids: [[-0.35, 0.05, 0.25], [0.35, 0.05, 0.25]], seats: [[-0.3, -0.18], [0.3, -0.18]] },
    lantern_stone: { foot: [0.5, 0.5], solids: [[0, 0, 0.24]], glow: true },
    arch: { foot: [1.5, 0.5], solids: [[-0.65, 0, 0.12], [0.65, 0, 0.12]] }, // (only its two posts: walked through)
  });
  const SHAPES = Object.freeze(Object.keys(ITEMS));
  const goodId = (shape) => `yard_${shape}__plain`; // (in the 가구 창고 with the furniture: island-furniture's YARD_GOODS)
  const shapeOf = (id) => { const m = /^yard_([a-z_]+)__plain$/.exec(String(id || '')); return m && ITEMS[m[1]] ? m[1] : null; };
  const isYard = (id) => shapeOf(id) !== null;
  const LIMIT = Object.freeze([24, 40, 60]); // pieces a yard holds, by its level (1 at first, 2 and 3 made bigger)
  const LEVELS = LIMIT.length;
  const MARGIN = Object.freeze([2.5, 4, 6]); // how far round the house each level reaches
  // the house models' ground (home-v1 glb bounds, eaves and all) and 0.3 m round: [x0, x1, z0, z1]
  const FOOT = Object.freeze({ 1: [-2.95, 2.95, -3.0, 2.66], 2: [-3.8, 3.8, -4.0, 3.3], 3: [-5.65, 6.0, -6.48, 4.26], 4: [-5.65, 6.0, -6.48, 4.26] });
  const footOf = (stage) => FOOT[stage] || FOOT[2];
  const PATH = 0.7; // half the 1.4 m way from the door to the walk, kept clear
  const STEP = 0.25;

  const world = (lot, lx, lz) => { const c = Math.cos(lot.yaw); const s = Math.sin(lot.yaw); return { x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c }; };
  const local = (lot, x, z) => { const c = Math.cos(lot.yaw); const s = Math.sin(lot.yaw); const dx = x - lot.x; const dz = z - lot.z; return { lx: dx * c - dz * s, lz: dx * s + dz * c }; };
  // the ground itself, lot-local (whatever the house): fine to put a thing on, or why not
  let growing = null; // trees, bushes, lamps, the village's things near the lots (worked out once)
  const near = (list) => list.filter((g) => LOTS.some((l) => Math.hypot(g.x - l.x, g.z - l.z) < 24));
  const growth = () => (growing ||= near([...(T.natureSolids?.() || []), ...(T.structureSolids?.() || [])]));
  let lifting = null; const lifts = () => (lifting ||= Object.keys(T.dalmaru?.TRAIN?.stops || {}).map((id) => T.dalmaru.TRAIN.liftAt(id)));
  const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  const grounds = new Map();
  function groundOk(lot, lx, lz) {
    lx = Math.round(lx * 8) / 8; lz = Math.round(lz * 8) / 8; // (on a 1/8 m grid: worked out once a point)
    const key = `${lot.id}:${lx * 8}:${lz * 8}`; if (grounds.has(key)) return grounds.get(key);
    const { x, z } = world(lot, lx, lz); const D = T.dalmaru; let ok = true;
    if (!T.walkable(x, z) || (D && (D.riverDist(x, z) < 1.5 || D.lakeDist(x, z) < 1.5 || D.coastDist(x, z) < 2.5))) ok = false; // water
    else if (T.walkDist(x, z) < 0.4) ok = false; // a walk
    else { const h = T.heightAt(x, z); if (Math.max(Math.abs(T.heightAt(x + 0.5, z) - h), Math.abs(T.heightAt(x, z + 0.5) - h)) / 0.5 > 0.4) ok = false; } // too steep
    if (ok) { const me = Math.hypot(x - lot.x, z - lot.z); if (LOTS.some((o) => o.id !== lot.id && Math.hypot(x - o.x, z - o.z) < me + 1)) ok = false; } // the neighbour's side
    if (ok && (T.inTownhall?.(x, z, 1) || T.inVillage?.(x, z) || T.inPlaza?.(x, z, 1))) ok = false;
    if (ok && growth().some((g) => Math.hypot(x - g.x, z - g.z) < g.r + 0.3)) ok = false; // what grows or stands there
    if (ok && lifts().some((L) => Math.hypot(x - L.x, z - L.z) < 3.2 || segDist(x, z, L.x, L.z, L.entry[0], L.entry[1]) < 1.6)) ok = false; // a station's lift and the way to it (툇마루역, by lot 1)
    grounds.set(key, ok); return ok;
  }
  const inHouse = (stage, lx, lz) => { const f = footOf(stage); return lx > f[0] && lx < f[1] && lz > f[2] && lz < f[3]; };
  const inPath = (stage, lx, lz) => Math.abs(lx) < PATH && lz <= footOf(stage)[2];
  // how far each way from the house the ground goes on (a strip mostly fine), worked out once a lot and stage
  const reaches = new Map();
  function reachOf(lot, stage) {
    const key = `${lot.id}:${stage}`; if (reaches.has(key)) return reaches.get(key);
    const [x0, x1, z0, z1] = footOf(stage); const out = {};
    const dirs = { back: [0, 1, x0, x1, z1], front: [0, -1, x0, x1, -z0], left: [-1, 0, z0, z1, -x0], right: [1, 0, z0, z1, x1] };
    for (const [k, [ux, uz, a, b, start]] of Object.entries(dirs)) {
      let r = start;
      for (; r < start + MARGIN[LEVELS - 1]; r += STEP) {
        let bad = 0; let n = 0;
        for (let t = a; t <= b; t += 0.5) { if (k === 'front' && Math.abs(t) < 2) continue; n += 1; if (!groundOk(lot, ux ? ux * r : t, uz ? uz * r : t)) bad += 1; } // (the walk up to the door splits the front)
        if (bad / n > 0.3) break;
      }
      out[k] = r - start;
    }
    reaches.set(key, out); return out;
  }
  // the yard's box at a level: [x0, x1, z0, z1]
  function boxOf(lot, stage, level) {
    const [x0, x1, z0, z1] = footOf(stage); const r = reachOf(lot, stage); const m = MARGIN[Math.min(LEVELS, Math.max(1, level)) - 1];
    return [x0 - Math.min(m, r.left), x1 + Math.min(m, r.right), z0 - Math.min(m, r.front), z1 + Math.min(m, r.back)];
  }
  function usable(lot, stage, level, lx, lz) {
    const b = boxOf(lot, stage, level);
    return lx >= b[0] - 1e-6 && lx <= b[1] + 1e-6 && lz >= b[2] - 1e-6 && lz <= b[3] + 1e-6 && !inHouse(stage, lx, lz) && !inPath(stage, lx, lz) && groundOk(lot, lx, lz);
  }
  // the yard's room in m² (a 0.25 m grid), for the 관공서's 「넓히기」 line
  const areas = new Map();
  function areaOf(lot, stage, level) {
    const key = `${lot.id}:${stage}:${level}`; if (areas.has(key)) return areas.get(key);
    const b = boxOf(lot, stage, level); let n = 0;
    for (let lx = b[0] + STEP / 2; lx < b[1]; lx += STEP) for (let lz = b[2] + STEP / 2; lz < b[3]; lz += STEP) if (usable(lot, stage, level, lx, lz)) n += 1;
    const a = Math.round(n * STEP * STEP); areas.set(key, a); return a;
  }
  // a piece {uid, id, x, z, rot} (lot-local): its footprint box, its blocking circles and seats in the world
  function footBox(p) { const it = ITEMS[shapeOf(p.id)]; const [w, d] = p.rot % 2 ? [it.foot[1], it.foot[0]] : it.foot; return [p.x - w / 2, p.x + w / 2, p.z - d / 2, p.z + d / 2]; }
  const turn = (p, ox, oz) => { const a = (p.rot * Math.PI) / 2; return [p.x + ox * Math.cos(a) + oz * Math.sin(a), p.z - ox * Math.sin(a) + oz * Math.cos(a)]; };
  function solidsOf(lot, p) { const it = ITEMS[shapeOf(p.id)]; return (it?.solids || []).map(([ox, oz, r]) => { const [lx, lz] = turn(p, ox, oz); return { ...world(lot, lx, lz), r }; }); }
  function seatsOf(lot, p) {
    const it = ITEMS[shapeOf(p.id)]; const yaw = lot.yaw + (p.rot * Math.PI) / 2;
    return (it?.seats || []).map(([ox, oz], k) => { const [lx, lz] = turn(p, ox, oz); const w = world(lot, lx, lz); return { id: `yard:${lot.id}:${p.uid}:${k}`, x: Math.round(w.x * 100) / 100, z: Math.round(w.z * 100) / 100, yaw: yaw + Math.PI, name: '앉기' }; });
  }
  const overlap = (a, b) => a[0] < b[1] - 1e-6 && b[0] < a[1] - 1e-6 && a[2] < b[3] - 1e-6 && b[2] < a[3] - 1e-6;
  const onStep = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
  const samples = (a, b) => { const out = []; for (let v = a + 0.02; v < b - 0.02; v += STEP) out.push(v); out.push(b - 0.02); return out; }; // (across a footprint, its far edge too)
  // why a piece may not stand there (null: it may) -- in my yard, on the steps, clear of the house, the door's way, the
  // ground's edge and the other pieces (fences may share their end posts)
  function placeError(p, others, lot, stage, level) {
    const shape = shapeOf(p.id); if (!shape) return '마당 물건이 아니에요.';
    if (![p.x, p.z].every(Number.isFinite) || !onStep(p.x) || !onStep(p.z) || ![0, 1, 2, 3].includes(p.rot)) return '자리를 확인해 주세요.';
    const b = footBox(p);
    for (const lx of samples(b[0], b[1])) {
      for (const lz of samples(b[2], b[3])) {
        if (inHouse(stage, lx, lz)) return '집에 너무 붙었어요.';
        if (inPath(stage, lx, lz)) return '현관에서 길까지는 비워 둬요.';
        if (!usable(lot, stage, level, lx, lz)) return '마당 칸 밖이에요.';
      }
    }
    const fence = ITEMS[shape].fence;
    for (const o of others) { if (o.uid === p.uid) continue; if (fence && ITEMS[shapeOf(o.id)]?.fence) continue; if (overlap(b, footBox(o))) return '다른 물건과 겹쳐요.'; }
    return null;
  }
  // the pieces that no longer fit (a bigger house, say) -- they go back to the 가구 창고
  const misfits = (items, lot, stage, level) => items.filter((p, i) => placeError(p, items.slice(0, i), lot, stage, level));
  const limitOf = (level) => LIMIT[Math.min(LEVELS, Math.max(1, level)) - 1];
  // a lot-local spot snapped to the steps
  const snap = (v) => Math.round(v / STEP) * STEP;
  // is this spot (world) in the yard of that lot (its box at that level, a little round it): where 「마당 꾸미기」 shows
  function inYard(lot, stage, level, x, z, pad = 0.5) { const { lx, lz } = local(lot, x, z); const b = boxOf(lot, stage, level); return lx > b[0] - pad && lx < b[1] + pad && lz > b[2] - pad && lz < b[3] + pad && !inHouse(stage, lx, lz); }
  return { ITEMS, SHAPES, LIMIT, LEVELS, MARGIN, FOOT, PATH, STEP, LOTS, lotById, goodId, shapeOf, isYard, world, local, groundOk, inHouse, inPath, reachOf, boxOf, usable, areaOf, footBox, solidsOf, seatsOf, placeError, misfits, limitOf, snap, inYard };
}));
