'use strict';
// G4b 채집 (notes docs/graphics-island-wide-20261108.md 「더 넣을 자연물」, assets 112): the island's collectables -- six
// mushrooms (two of the 106 pilot, four of 112; the blue one rare), a four-leaf clover (very rare, in the clover by the woods'
// edge) and two kinds of fallen twigs under the trees. Each lies on a fixed spot worked out here from the island's nature (the
// same on every server start); picked, it grows back on that spot after its time (lib/island-events.js `fixed` resources).
// The mushrooms grow round the G4a fallen logs more than anywhere. Nothing here blocks, but none lies inside what blocks, on
// water, on a walk (2.5 m), by the taxi's road or its band (5 m) or its stops (10 m) -- G4a's ground rules.
const H = 3600000;
const KINDS = Object.freeze({
  /* item: the bag's -- the five common mushrooms all 「버섯」 (its cooking, gifts, the 「버섯 3개」 부탁 kept), the blue its own; regrowMs: back on
     its spot after (사용자 「추천대로」 2026-11-11; no daily cap -- v1.10.35 「개인 일일 상한 없음」). The regrowth keeps the island's
     shared supply under the economy's 520,000 P/h (island-events.test): about 31,700 P/h for all 83, where the random six 「버섯」 were 36,000 */
  mushroom_brown: { name: '갈색 버섯', item: 'mushroom', model: 'mushroom_brown', group: 'mushroom', share: 22, regrowMs: 3 * H },
  mushroom_red: { name: '빨간 버섯', item: 'mushroom', model: 'mushroom_red', group: 'mushroom', share: 20, regrowMs: 3 * H },
  mushroom_brown_cap: { name: '큰 갓 버섯', item: 'mushroom', model: 'mushroom_brown_cap', group: 'mushroom', share: 20, regrowMs: 3 * H },
  mushroom_red_cone: { name: '빨간 고깔 버섯', item: 'mushroom', model: 'mushroom_red_cone', group: 'mushroom', share: 18, regrowMs: 3 * H },
  mushroom_bolete: { name: '노란 그물 버섯', item: 'mushroom', model: 'mushroom_bolete', group: 'mushroom', share: 16, regrowMs: 3 * H },
  mushroom_blue: { name: '푸른 버섯', item: 'mushroom_blue', model: 'mushroom_blue', group: 'mushroom_blue', share: 4, regrowMs: 6 * H },
  twig_branch: { name: '떨어진 나뭇가지', item: 'branch', model: 'branch_fork', group: 'twig', regrowMs: 3 * H },
  twig_bundle: { name: '잔가지', item: 'twig', model: 'twigs', group: 'twig', regrowMs: 3 * H },
  clover_four: { name: '네잎클로버', item: 'clover_four', model: 'clover_four_leaf', group: 'clover', regrowMs: 12 * H },
});
/* 잡초 (A안, 총괄 2026-11-11): its own store, night regrowth (by what the island pulled) and 1.4 s pull stay in lib/island-weeds.js --
   4,300 of them are no events; here only its row in the one table of what is gathered */
const TABLE = Object.freeze({ ...KINDS, weed: Object.freeze({ name: '잡초', item: 'weed', group: 'weed', regrowMs: null /* (00:00, as many as pulled) */ }) });
const COUNTS = Object.freeze({ mushroom: 44, twig: 34, clover: 5 }); // (spots on the island: 44 mushrooms -- 4 % blue, at least 2 --, 34 twigs, 5 clovers)
const TAXI_KEEP = 5; const STOP_KEEP = 10; const WALK_KEEP = 2.5;

function spotsOf(T, Taxi) {
  const n = T.nature(); const solids = T.natureSolids();
  const route = Taxi?.ROUTE || []; const stops = route.length ? [route[0], route.at(-1)].map(([x, z]) => ({ x, z })) : []; /* (the stops at the road's two ends, as G4a's taxiClear) */
  const segDist = (x, z) => { let best = Infinity; for (let i = 1; i < route.length; i += 1) { const [ax, az] = route[i - 1]; const [bx, bz] = route[i]; const dx = bx - ax; const dz = bz - az; const l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return best; };
  const taken = [];
  /* (as every find (island-events clear): off buildings and their yards, statues, the story givers' feet -- and 3 m off a fruit tree's picking
     spot, where SPACE picks the fruit) */
  const givers = Object.values(require('./island-quests').STORIES).map((s) => s.at); const picks = (T.harvestTrees?.() || []).map((h) => h.approach);
  const offBuilt = (x, z) => T.BUILDINGS.every((b) => b.kind === 'townhall' || Math.hypot(x - b.x, z - b.z) >= (b.kind === 'hall' ? 14 : b.kind === 'facade' ? 18 : 7)) && T.STATUE_SPOTS.every((s) => Math.hypot(x - s.x, z - s.z) >= 3)
    && givers.every((q) => Math.hypot(x - q.x, z - q.z) >= 5) && picks.every((p) => Math.hypot(x - p.x, z - p.z) >= 3);
  const ok = (x, z) => offBuilt(x, z) && T.walkable(x, z) && (!T.settledSpot || T.settledSpot(x, z)) && !T.onBridge?.(x, z) && !T.onStairs?.(x, z) && T.walkDist(x, z) > WALK_KEEP && segDist(x, z) > TAXI_KEEP
    && stops.every((s) => Math.hypot(x - s.x, z - s.z) > STOP_KEEP) && !(T.inPlaza && T.inPlaza(x, z, 3)) && !T.inTownhall?.(x, z, 2) && !(T.onLot && T.onLot(x, z, 1)) && !T.inVillage?.(x, z)
    && solids.every((s) => Math.abs(x - s.x) > 3 || Math.abs(z - s.z) > 3 || Math.hypot(x - s.x, z - s.z) > s.r + 0.5) /* (room to stand by it, as every find: island-events.test) */ && taken.every((p) => Math.hypot(x - p.x, z - p.z) > 1.6);
  let seed = 0x4b1d; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = []; const add = (group, x, z) => { const p = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 }; taken.push(p); out.push({ group, ...p, yaw: Math.round(rnd() * 628) / 100 }); };
  const ring = (cx, cz, r0, r1) => { for (let k = 0; k < 12; k += 1) { const a = rnd() * Math.PI * 2; const d = r0 + rnd() * (r1 - r0); const x = cx + Math.cos(a) * d; const z = cz + Math.sin(a) * d; if (ok(x, z)) return [x, z]; } return null; };
  // mushrooms: round the fallen logs first (60 % of them), then under the trees
  const logs = n.logs || []; const trees = n.trees.filter((t) => !['stump', 'sapling'].includes(T.treeKind?.(t)));
  for (let i = 0; i < logs.length && out.filter((s) => s.group === 'mushroom').length < Math.round(COUNTS.mushroom * 0.6); i += 1) { const p = ring(logs[i].x, logs[i].z, 1.2, 1.9); if (p) add('mushroom', ...p); }
  for (let guard = 0; out.filter((s) => s.group === 'mushroom').length < COUNTS.mushroom && guard < 4000; guard += 1) { const t = trees[Math.floor(rnd() * trees.length)]; const p = ring(t.x, t.z, 1.4, 2.6); if (p) add('mushroom', ...p); }
  for (let guard = 0; out.filter((s) => s.group === 'twig').length < COUNTS.twig && guard < 4000; guard += 1) { const t = trees[Math.floor(rnd() * trees.length)]; const p = ring(t.x, t.z, 1.2, 3); if (p) add('twig', ...p); }
  // four-leaf clovers: in the open grass beside the flowers (the clover cover's edge-of-woods band), off any tree
  const flowers = n.flowers || [];
  for (let guard = 0; out.filter((s) => s.group === 'clover').length < COUNTS.clover && guard < 2000; guard += 1) { const f = flowers[Math.floor(rnd() * flowers.length)]; const p = f && ring(f.x, f.z, 1, 3); if (p && trees.every((t) => Math.hypot(t.x - p[0], t.z - p[1]) > 2)) add('clover', ...p); }
  // each spot's kind: the mushrooms by their shares (at least two blue ones), the twigs half and half
  const shrooms = Object.entries(KINDS).filter(([, k]) => k.group.startsWith('mushroom')); const total = shrooms.reduce((s, [, k]) => s + k.share, 0); let blue = 0;
  out.forEach((s, i) => {
    if (s.group === 'twig') s.kind = i % 2 ? 'twig_branch' : 'twig_bundle';
    else if (s.group === 'clover') s.kind = 'clover_four';
    else { let r = rnd() * total; s.kind = shrooms.find(([, k]) => (r -= k.share) < 0)?.[0] || 'mushroom_brown'; if (s.kind === 'mushroom_blue') blue += 1; }
    s.id = `${s.kind}:${i}`;
  });
  for (const s of out) if (blue < 2 && s.group === 'mushroom' && s.kind !== 'mushroom_blue') { s.kind = 'mushroom_blue'; s.id = `${s.kind}:${out.indexOf(s)}`; blue += 1; }
  return out.map(({ id, kind, x, z, yaw }) => ({ id, kind, x, z, yaw }));
}

module.exports = { KINDS, TABLE, COUNTS, TAXI_KEEP, STOP_KEEP, WALK_KEEP, spotsOf };
