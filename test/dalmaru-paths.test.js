'use strict';
// 패치 묶음 1 섬 길 정리 (gamecenter-notes docs/patch-bundles-20261020.md): every place on 달마루섬 is reached from
// 대청마당 along the walks -- the walks joined into one network with the plaza, each place within reach of a walk of it,
// and no walk ending where nothing is (a dead end).
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const R = require('../public/plaza/island-train.js');

const ON = T.MAP === 'dalmaru';
const REACH = 3.5; // a place this far from a walk's edge is on it
const near = (p, w, pad = 0) => w.pts.some(([x, z]) => Math.hypot(x - p.x, z - p.z) <= w.w / 2 + pad);

function network() {
  const W = T.walkCurves; const D = T.dalmaru; const P = D.PLAZA;
  const inPlaza = (x, z) => Math.abs(x - P.x) < P.hw + 1 && z > P.d0 - 1 && z < P.d1 + 1;
  const parent = W.map((_, i) => i); const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < W.length; i += 1) for (let j = i + 1; j < W.length; j += 1) {
    if (W[i].pts.some(([x, z]) => near({ x, z }, W[j], W[i].w / 2 + 0.3))) parent[find(i)] = find(j);
  }
  // the ridge's stairs join the walks at its foot to those at its top
  const S = T.STAIRS; const foot = { x: S.x + S.nx * 1.7, z: S.z + S.nz * 1.7 }; const top = { x: S.x + S.ux * S.len + S.nx * 1.7, z: S.z + S.uz * S.len + S.nz * 1.7 };
  const at = (p) => W.map((w, i) => (near(p, w, 3) ? i : -1)).filter((i) => i >= 0);
  for (const i of at(foot)) for (const j of at(top)) parent[find(i)] = find(j);
  const plazaRoots = new Set(W.map((w, i) => (w.pts.some(([x, z]) => inPlaza(x, z)) ? find(i) : -1)).filter((r) => r >= 0));
  const linked = (i) => plazaRoots.has(find(i));
  return { W, inPlaza, linked };
}

function places() {
  const D = T.dalmaru; const PL = D.PLACES; const S = T.STAIRS; const out = [];
  for (const id of Object.keys(T.SPOTS)) { const d = T.facilityDoor(id); if (d) out.push([`문:${id}`, d]); }
  for (const id of Object.keys(R.STATIONS)) out.push([`역:${R.STATIONS[id].name}`, R.stationOf(id).spot]);
  out.push(['계단 발치', { x: S.x + S.nx * 1.7, z: S.z + S.nz * 1.7 }], ['계단 꼭대기', { x: S.x + S.ux * S.len + S.nx * 1.7, z: S.z + S.uz * S.len + S.nz * 1.7 }]);
  T.COTTAGES.forEach((c, k) => { const l = Math.hypot(c.face[0] - c.x, c.face[1] - c.z) || 1; out.push([`집${k + 1}`, { x: c.x + ((c.face[0] - c.x) / l) * 4, z: c.z + ((c.face[1] - c.z) / l) * 4 }]); });
  const B = typeof T.bridges === 'function' ? T.bridges() : T.bridges;
  B.forEach((b, k) => { for (const s of [-1, 1]) out.push([`다리${k + 1} ${s < 0 ? '앞' : '뒤'}`, { x: b.x + b.ux * b.half * s, z: b.z + b.uz * b.half * s }]); });
  for (const id of ['notice', 'contest']) if (PL[id]) out.push([id, PL[id]]);
  // (the buildings and decks by their way in: the museum's door, the lighthouse's walk side, the pier's and the dock's land ends)
  const M = T.MUSEUM; out.push(['박물관 문', { x: M.x - Math.sin(M.yaw) * 4.9, z: M.z - Math.cos(M.yaw) * 4.9 }]);
  const L = PL.lighthouse; const lw = [-88, 140]; const ll = Math.hypot(lw[0] - L.x, lw[1] - L.z); out.push(['초승등대', { x: L.x + ((lw[0] - L.x) / ll) * 4.5, z: L.z + ((lw[1] - L.z) / ll) * 4.5 }]);
  out.push(['달끝나루 부두', T.PIER.root], ['배 타는 곳', { x: T.DOCK.rects[1].x, z: T.DOCK.rects[1].z - T.DOCK.rects[1].half }]);
  out.push(['농부 밭', T.FARM.farmer]);
  // (묶음 3) the village's minigame residents where they stand
  for (const k of ['painter', 'busker', 'stationmaster', 'electrician', 'builder', 'librarian', 'grandpa']) if (T.VILLAGE?.[k]) out.push([`주민:${k}`, T.VILLAGE[k]]);
  return out.filter(([, p]) => p && Number.isFinite(p.x));
}

test('달마루섬 길: 모든 장소가 대청마당에서 길로 이어지고, 길은 한 덩어리, 막다른 길 없음', { skip: !ON && '달마루섬 전용' }, () => {
  const { W, inPlaza, linked } = network();
  const cut = W.map((w, i) => (linked(i) ? null : `길${i + 1}(${w.tier})`)).filter(Boolean);
  const unreached = places().filter(([, p]) => !inPlaza(p.x, p.z) && !W.some((w, i) => linked(i) && near(p, w, REACH))).map(([n, p]) => `${n}(${Math.round(p.x)},${Math.round(p.z)})`);
  const all = places().map(([, p]) => p);
  const dead = [];
  W.forEach((w, i) => { for (const [x, z] of [w.pts[0], w.pts[w.pts.length - 1]]) {
    const p = { x, z };
    if (inPlaza(x, z) || W.some((o, j) => j !== i && near(p, o, w.w / 2 + 0.3)) || all.some((q) => Math.hypot(q.x - x, q.z - z) <= REACH + w.w / 2)) continue;
    dead.push(`길${i + 1} 끝(${Math.round(x)},${Math.round(z)})`);
  } });
  assert.deepEqual({ cut, unreached, dead }, { cut: [], unreached: [], dead: [] });
});

// 묶음 1 대청마당 바닥 (assets 59): what is walked round -- the gardens and channels -- keeps off the walks, the doors,
// 알림마루 and the plaza's places, and every rim seat is stood by on open ground (the server lets one sit within 2.8 m)
test('대청마당 바닥: 정원·물길은 길·문·알림마루·광장 자리를 비키고, 정원 앉을 자리는 모두 다가갈 수 있다', { skip: !ON && '달마루섬 전용' }, () => {
  const D = T.dalmaru; const PL = D.PLACES; const V = T.paving(); const S = T.structureSolids();
  const mine = S.filter((s) => [...V.gardens, ...V.channels].some((g) => Math.hypot(g.x - s.x, g.z - s.z) < 5.5));
  assert.ok(V.gardens.length === 6 && V.channels.length === 10 && V.curbs.length > 20);
  const hits = [];
  for (const s of mine) {
    T.walkCurves.forEach((w, i) => { if (w.pts.some(([x, z]) => Math.hypot(x - s.x, z - s.z) < w.w / 2 + s.r + 0.3)) hits.push(`길${i + 1}`); });
    for (const id of Object.keys(T.SPOTS)) { const d = T.facilityDoor(id); if (d && Math.hypot(d.x - s.x, d.z - s.z) < s.r + 2.5) hits.push(`문:${id}`); }
    for (const k of ['notice', 'spawn', 'mural', 'bookcart', 'birthday']) if (Math.hypot(PL[k].x - s.x, PL[k].z - s.z) < s.r + 3.5) hits.push(k);
  }
  const blocked = (x, z) => !T.walkable(x, z) || S.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.35) || T.plazaProps().benches.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 0.35);
  const seats = T.plazaProps().seats.filter((s) => s.id.startsWith('g'));
  const lonely = seats.filter((s) => { for (let r = 0.4; r <= 2.6; r += 0.2) for (let a = 0; a < 16; a += 1) if (!blocked(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r)) return false; return true; }).map((s) => s.id);
  assert.equal(seats.length, 4 * 4 + 2 * 6);
  assert.deepEqual({ hits: [...new Set(hits)], lonely }, { hits: [], lonely: [] });
});
