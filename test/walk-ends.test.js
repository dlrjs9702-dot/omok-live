'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');
const R = require('../public/plaza/island-train');

// 문제 기록 3회차 10 「이쪽 길은 좀 정비를 해야겠어. 연속성이 없어」: no walk ends in the air -- each end of every walk lands on
// another walk, 대청마당 or the hall's yard, a door (a facility's, a house lot's), a bridge's end, the ridge stairs' foot or
// top, a station's way in, the waterfront's promenade, or one of the island's named places (6 m round)
const seg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
test('길 끝: 허공에서 끝나는 길 없음 (다른 길·마당·문·다리·계단·역·이름 있는 곳)', { skip: !T.dalmaru }, () => {
  const near = (x, z, list, r) => list.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const doors = Object.keys(T.SPOTS).map((id) => T.facilityDoor(id)).filter(Boolean);
  const homeDoors = T.HOME_LOTS.map((l) => ({ x: l.x - Math.sin(l.yaw) * 4.6, z: l.z - Math.cos(l.yaw) * 4.6 }));
  const bridgeEnds = T.bridges.flatMap((b) => [{ x: b.x - b.ux * b.half, z: b.z - b.uz * b.half }, { x: b.x + b.ux * b.half, z: b.z + b.uz * b.half }]);
  const S = T.STAIRS; const stairs = [0, S.len].map((u) => ({ x: S.x + S.ux * u + S.nx * 1.7, z: S.z + S.uz * u + S.nz * 1.7 }));
  const stations = Object.values(R.STATIONS).map((s) => ({ x: s.entry[0], z: s.entry[1] }));
  const places = []; const walkIn = (o) => { if (!o || typeof o !== 'object') return; if (Number.isFinite(o.x) && Number.isFinite(o.z)) places.push(o); else Object.values(o).forEach(walkIn); };
  walkIn(T.dalmaru.PLACES); walkIn(T.SPOTS); walkIn(T.WATERFRONT);
  const loose = [];
  T.walkCurves.forEach((w, wi) => {
    for (const [x, z] of [w.pts[0], w.pts[w.pts.length - 1]]) {
      const onWalk = T.walkCurves.some((o, oi) => { if (oi === wi) return false; let d = Infinity; for (let i = 1; i < o.pts.length; i += 1) d = Math.min(d, seg(x, z, ...o.pts[i - 1], ...o.pts[i])); return d < o.w / 2 + 0.7; }); // (a band with its soft edge, 0.35 m out, touches it)
      if (onWalk || T.inPlaza(x, z, 0.5) || T.inTownhall(x, z, 0.5) || near(x, z, doors, 3) || near(x, z, homeDoors, 2.5) || near(x, z, bridgeEnds, 2) || near(x, z, stairs, 2.5) || near(x, z, stations, 4) || near(x, z, places, 6)) continue;
      loose.push(`walk ${wi} (${w.tier}) ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  });
  assert.deepEqual(loose, []);
  // nor runs out over the ridge stairs' treads (its band drawn down the cliff beside them): walks meet them at the foot and
  // on the ridge by the top step
  const onTreads = T.walkCurves.flatMap((w, wi) => w.pts.filter(([x, z]) => T.onStairs(x, z)).map(([x, z]) => `walk ${wi} ${x.toFixed(1)},${z.toFixed(1)}`));
  assert.deepEqual(onTreads, []);
});
