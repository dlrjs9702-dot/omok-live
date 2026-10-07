'use strict';

// v1.10.31 게임 아일랜드 잡초 채집 (비공개 IDEAS 「잡초 채집」, 사용자 확정 2026-10-05): where the island's weeds are.
// At first the island's tufts of grass (island-terrain nature().tufts, `w<index>`) -- the same places every screen drew
// before. A pulled weed is gone for everyone; at 00:00 Asia/Seoul as many as were pulled since the last regrowth grow
// back somewhere new (`g<season day>-<n>`, chosen here from the day, so it is the same on every server start), never on
// a walk, in water, on a bridge, in a building's yard, by a door or a keeper, at the spawn or on the plaza, and never on
// top of another weed or a tree. The store (lib/point-store.js) keeps what was pulled and what grew, with the bags.
const T = require('../public/plaza/island-terrain.js');

const REACH = 2.5; // how close the server wants the player to pull one
const PULL_MS = 900; // about a second between starting and finishing (the client plays GatherWeed for 1 s)
const BASE = T.nature().tufts.map((t, i) => ({ id: `w${i}`, x: Math.round(t.x * 100) / 100, z: Math.round(t.z * 100) / 100 }));
const BY_BASE = new Map(BASE.map((w) => [w.id, w]));
const solids = T.natureSolids();
const doors = Object.values(T.SPOTS).map((s) => { const dx = s.face[0] - s.x; const dz = s.face[1] - s.z; const l = Math.hypot(dx, dz) || 1; return { x: s.x + (dx / l) * 3.5, z: s.z + (dz / l) * 3.5 }; });

// every weed out now: the first ones still there, then the grown ones
function active(state) {
  const out = BASE.filter((w) => !state.removed?.[w.id]);
  for (const g of state.added || []) out.push(g);
  return out;
}
const find = (state, id) => (id.startsWith('w') ? (!state.removed?.[id] && BY_BASE.get(id)) || null : (state.added || []).find((g) => g.id === id) || null);

// somewhere a new weed may grow
function fits(x, z, taken) {
  if (!T.walkable(x, z) || Math.hypot(x, z) < T.PLAZA_R + 4 || T.coastDist(x, z) < 3 || T.cliffAt(x, z) > 0.3) return false;
  if (T.walkDist(x, z) < 2.6 || T.streamDist(x, z) < T.STREAM_HALF + 1.5 || T.onBridge(x, z)) return false;
  if (Math.hypot(x - T.SPAWN.x, z - T.SPAWN.z) < 8) return false;
  for (const b of T.BUILDINGS) if (b.kind !== 'townhall' && Math.hypot(x - b.x, z - b.z) < (b.kind === 'hall' ? 14 : 6)) return false; // buildings, yards, keepers
  if (T.inTownhall(x, z, 3)) return false; // v1.10.41: the town hall and its walled yard
  for (const d of doors) if (Math.hypot(x - d.x, z - d.z) < 4) return false;
  for (const s of T.STATUE_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 3) return false;
  for (const s of solids) if (Math.abs(x - s.x) < 3 && Math.abs(z - s.z) < 3 && Math.hypot(x - s.x, z - s.z) < s.r + 0.6) return false;
  for (const w of taken) if (Math.abs(x - w.x) < 1 && Math.abs(z - w.z) < 1 && Math.hypot(x - w.x, z - w.z) < 0.9) return false;
  return true;
}
// `count` new weeds for a day (a season-day number), the same for the same day and state
function grow(day, count, state) {
  let seed = (day * 2654435761) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const taken = active(state); const out = [];
  for (let tries = 0; out.length < count && tries < count * 400; tries += 1) {
    const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * T.ISLAND_RADIUS;
    const x = Math.round(Math.cos(a) * r * 100) / 100; const z = Math.round(Math.sin(a) * r * 100) / 100;
    if (!fits(x, z, taken)) continue;
    const w = { id: `g${day}-${out.length}`, x, z }; out.push(w); taken.push(w);
  }
  return out;
}

module.exports = { REACH, PULL_MS, BASE, active, find, fits, grow };
