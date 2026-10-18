'use strict';

// B 45 꽃·나무 심기 (IDEAS 「함께하는 섬」, assets 45 planting-v1): a seed or a sapling from the bag goes into the ground
// where I stand, and grows by the server clock in four stages for everyone to see -- a flower (5 colours) in about a day,
// a tree in about six. Fertilizer, once per plant, makes the rest of its growth twice as fast. Never on the plaza, a walk,
// water, a facility's yard, the farm or the village props, and apart from the next plant. The page draws what this says.
const T = require('../public/plaza/island-terrain.js');

const KINDS = Object.freeze({
  seed_flower_red: { kind: 'flower', color: 'red' }, seed_flower_yellow: { kind: 'flower', color: 'yellow' }, seed_flower_white: { kind: 'flower', color: 'white' },
  seed_flower_pink: { kind: 'flower', color: 'pink' }, seed_flower_purple: { kind: 'flower', color: 'purple' }, sapling: { kind: 'tree', color: null },
});
const STAGE_MS = Object.freeze({ flower: 8 * 3600000, tree: 2 * 86400000 }); // a stage each; 3 stages after planting
const GAP = Object.freeze({ flower: 0.6, tree: 3.2 }); // how far from the next plant (each side's own)
const PER_ACCOUNT = 20; const ISLAND_MAX = 600;

// the stage now (0..3): fertilizing at f makes the time after it count double
function stageOf(p, now) {
  const step = STAGE_MS[p.kind]; if (!step) return 0;
  const f = Number.isFinite(p.fertilizedAt) && p.fertilizedAt > p.plantedAt ? Math.min(now, p.fertilizedAt) : null;
  const grown = f === null ? now - p.plantedAt : (f - p.plantedAt) + 2 * Math.max(0, now - f);
  return Math.max(0, Math.min(3, Math.floor(grown / step)));
}
// why a spot will not take a plant (or null): the shared island rules, then the plants already there
function refuse(kind, x, z, plants = []) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !T.walkable(x, z)) return '여기에는 심을 수 없어요.';
  if (Math.hypot(x, z) < T.PLAZA_R + 2) return '광장에는 심을 수 없어요.';
  if (T.walkDist(x, z) < 0.4 || T.streamDist(x, z) < T.STREAM_HALF + 1) return '길이나 물가에는 심을 수 없어요.';
  if (Object.values(T.SPOTS).some((s) => Math.hypot(s.x - x, s.z - z) < 7) || T.COTTAGES.some((c) => Math.hypot(c.x - x, c.z - z) < 5)) return '건물 앞에는 심을 수 없어요.';
  if (Math.abs(x - T.FARM.x) < T.FARM.w / 2 + 2 && Math.abs(z - T.FARM.z) < T.FARM.d / 2 + 2) return '밭에는 심을 수 없어요.';
  if (T.villageSolids().some((v) => Math.hypot(v.x - x, v.z - z) < v.r + 1)) return '마을 소품 곁에는 심을 수 없어요.';
  if (plants.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(GAP[kind], GAP[p.kind]))) return kind === 'tree' ? '나무는 다른 꽃·나무와 조금 떨어져야 해요.' : '바로 옆에 이미 심겨 있어요.';
  return null;
}

module.exports = { KINDS, STAGE_MS, GAP, PER_ACCOUNT, ISLAND_MAX, stageOf, refuse };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const p = { kind: 'flower', plantedAt: 0 };
  assert.deepEqual([0, 8, 16, 24, 99].map((h) => stageOf(p, h * 3600000)), [0, 1, 2, 3, 3]);
  assert.equal(stageOf({ ...p, fertilizedAt: 4 * 3600000 }, 8 * 3600000), 1); // 4 h + 4 h double = 12 h
  assert.equal(stageOf({ ...p, fertilizedAt: 4 * 3600000 }, 12 * 3600000), 2); // 4 + 16 = 20 h
  assert.equal(stageOf({ kind: 'tree', plantedAt: 0 }, 5 * 86400000), 2);
  assert.ok(refuse('flower', 0, 0)); // the plaza
  let spot = null; for (let a = 0; a < 360 && !spot; a += 7) for (const r of [30, 45, 60, 75]) { const x = Math.cos(a) * r; const z = Math.sin(a) * r; if (!refuse('flower', x, z)) { spot = { x, z }; break; } }
  assert.ok(spot, 'somewhere takes a flower');
  assert.ok(refuse('tree', spot.x + 1, spot.z, [{ kind: 'flower', ...spot }]));
  assert.equal(refuse('flower', spot.x + 0.7, spot.z, [{ kind: 'flower', ...spot }]), null);
  console.log('island-plants ok');
}
