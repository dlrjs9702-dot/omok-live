'use strict';
// 1.10.414 S2 캠핑장 안 (사용자 결정 72 · 73, 검토 notes docs/safe-zones-visible-20261122.md §2-2, assets 164 · 176 · 177): the office, the hearth set
// and three tents at the review's places, each facing the fire, off the walks and each other; 모락 at the office's keeper spot, clear to stand and talk
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js');
const D = T.dalmaru; const C = D?.NEW_ISLE?.camp;

test('S2 캠핑장 안: 관리소 · 화덕 · 텐트 셋이 검토 자리, 모닥불 쪽을 봄, 길 · 서로 · 목책에서 떨어짐', { skip: !D && '달마루섬 전용' }, () => {
  const want = { camp_office: [256, 259.5], camp_hearth_set: [248.7, 249.13], tent_peaked: [266.5, 242.5], tent_round: [269.5, 251], tent_ridge: [265, 259] };
  assert.equal(P.CAMP2.length, 5);
  const all = P.CAMP2.map(([x, z, yaw, k]) => ({ kind: P.CAMP2_KINDS[k], x, z, yaw, cs: P.circlesAt(P.CAMP2_KINDS[k], x, z, yaw) }));
  for (const p of all) {
    assert.deepEqual([p.x, p.z], want[p.kind], p.kind);
    if (p.kind !== 'camp_hearth_set') { const fx = -Math.sin(p.yaw); const fz = -Math.cos(p.yaw); const d = Math.hypot(C.x - p.x, C.z - p.z); assert.ok((fx * (C.x - p.x) + fz * (C.z - p.z)) / d > 0.999, `${p.kind}: its -Z to the fire`); }
    for (const c of p.cs) { assert.ok(T.walkDist(c.x, c.z) >= c.r, `${p.kind}: off the walks at ${c.x.toFixed(1)},${c.z.toFixed(1)}`); assert.ok(Math.hypot(c.x - C.x, c.z - C.z) + c.r < C.ring.r - 1.5, `${p.kind}: well inside the palisade`); assert.ok(T.walkable(c.x, c.z)); }
    for (const q of all) if (q !== p) for (const a of p.cs) for (const b of q.cs) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r + 0.8, `${p.kind} / ${q.kind}: room to walk between`);
    for (const o of P.CAMP) { const r = o[3] === 0 ? 0.6 : 0.25; for (const a of p.cs) assert.ok(Math.hypot(a.x - o[0], a.z - o[1]) >= a.r + r + 0.8, `${p.kind} by the middle fire's set`); }
    for (const l of T.nature().lampSpots) for (const a of p.cs) assert.ok(Math.hypot(a.x - l.x, a.z - l.z) >= a.r + 0.6, `${p.kind} by a lamp ${l.x},${l.z}`);
  }
  /* (모락: 176 keeper (1.4, 0, -3.3) in the office's frame -- clear of everything, by the review's (257.5, 256.5)) */
  const [ox, oz, oyaw] = P.CAMP2.find((p) => P.CAMP2_KINDS[p[3]] === 'camp_office'); const kx = ox + Math.cos(oyaw) * 1.4 + Math.sin(oyaw) * -3.3; const kz = oz - Math.sin(oyaw) * 1.4 + Math.cos(oyaw) * -3.3;
  assert.ok(Math.hypot(kx - 257.5, kz - 256.5) < 1.2, `${kx},${kz}`); assert.ok(P.solids().every((o) => Math.hypot(o.x - kx, o.z - kz) >= o.r + 0.45), 'room for 모락');
});

test('S2 모락 · 등록: 말 걸기(camp:keeper)가 대화를 열고, 모델 · 표정 · 관리소 · 화덕이 등록됨', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8'); assert.match(app, /id === 'camp:keeper' \? campKeeperTalk\(\)/); assert.match(app, /function campKeeperTalk/);
  const scene = fs.readFileSync(path.join(__dirname, '../public/plaza/plaza-scene.js'), 'utf8'); assert.match(scene, /doors\['camp:keeper'\]/); assert.match(scene, /character\.walker\.morak_work/);
  globalThis.GC_ISLAND_MAP = 'dalmaru'; const A = require('../public/plaza/island-assets.js'); const R = A.REGISTRY;
  for (const id of ['byeolmaru.camp_office', 'newisle.camp_hearth_set', 'character.walker.morak_work', 'npc_face.morak', 'land.tent_peaked', 'land.tent_round', 'land.tent_ridge']) assert.ok(R[id], id);
  assert.equal(R['byeolmaru.camp_office'].keepNodes, true); assert.equal(R['byeolmaru.camp_office'].snow, true); assert.equal(R['newisle.camp_hearth_set'].nightGlow, true);
  for (const f of ['byeolmaru-v1/camp_office.glb', 'byeolmaru-v1/camp_office_low.glb', 'newisle-v1/camp_hearth_set.glb', 'newisle-v1/camp_hearth_set_low.glb', 'characters/npc_walker_morak_work.glb', 'characters/npc_walker_morak_work_low.glb', 'characters/npc_face_morak.glb']) assert.ok(fs.existsSync(path.join(__dirname, '../public/assets/island', f)), f);
});
