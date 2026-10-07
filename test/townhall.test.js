'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const { createIslandEvents } = require('../lib/island-events');

// v1.10.41 관공서 확장: the marble town hall and its walled yard stand on ground at the plaza's top, clear of the stream
// and every walk; nothing of the island's nature, no event and no weed is laid inside them; the door is in the yard.
test('관공서 확장: 광장 높이 대지, 개울·산책로와 겹치지 않고, 안에는 자연물·이벤트가 없다', () => {
  const TH = T.TOWNHALL;
  for (const [lx, lz] of [[0, 0], [-8, -6], [8, 6], [0, 12], [-8, 16], [8, 16], [0, 20]]) {
    const p = T.townhallWorld(lx, lz); assert.ok(Math.abs(T.heightAt(p.x, p.z) - T.PLAZA_H) < 1e-6, `${lx},${lz} 높이`);
  }
  for (let lz = TH.body.z0; lz <= TH.yard.z1; lz += 0.5) for (const lx of [-TH.yard.hx, TH.yard.hx]) { const p = T.townhallWorld(lx, lz); assert.ok(T.streamDist(p.x, p.z) > T.STREAM_HALF + 0.5, `벽 ${lx},${lz} 개울`); }
  for (let lx = -TH.yard.hx; lx <= TH.yard.hx; lx += 0.5) { const p = T.townhallWorld(lx, TH.yard.z1); assert.ok(T.streamDist(p.x, p.z) > T.STREAM_HALF + 0.5, `앞벽 ${lx}`); }
  for (const w of T.walkCurves) for (const [x, z] of w.pts) assert.ok(!T.inTownhall(x, z, w.w / 2), `산책로 ${x.toFixed(1)},${z.toFixed(1)}`);
  const n = T.nature();
  for (const list of [n.trees, n.bushes, n.tufts, n.flowers, n.lampSpots]) assert.ok(list.every((o) => !T.inTownhall(o.x, o.z, 1)));
  for (let seed = 1; seed <= 6; seed += 1) { let s = seed; const ev = createIslandEvents({ random: () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; } }); assert.ok([...ev.events.values()].every((e) => !T.inTownhall(e.x, e.z, 1))); }
  const door = T.townhallWorld(0, 8.6); assert.ok(T.inTownhallYard(door.x, door.z) && T.walkable(door.x, door.z));
  const out = T.townhallWorld(0, TH.yard.z1 + 1.4); assert.ok(!T.inTownhallYard(out.x, out.z) && T.walkable(out.x, out.z));
});
