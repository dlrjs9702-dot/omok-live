'use strict';
// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md 5절): the two stops are the road's ends, every point of the road on
// walkable ground or the bridge, the shelters and the steps out walkable; 25~40 s a ride (the tests' short road: 3 s), the
// phases in order and done at the other stop; the fare -- 0 for a home owner, else the economy value
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');
const X = require('../public/plaza/island-taxi');
const ok = (x, z) => T.walkable(x, z) || Boolean(T.onBridge(x, z));

test('택시 길: 두 정류장이 길 양 끝, 길 모든 점이 걸을 수 있는 땅이나 다리, 정류장 지붕·내리는 자리도', () => {
  const road = X.roadOf('plaza');
  assert.deepEqual([road[0], road.at(-1)], [[X.stopOf('plaza').x, X.stopOf('plaza').z], [X.stopOf('isle').x, X.stopOf('isle').z]]);
  assert.deepEqual(X.roadOf('isle'), road.slice().reverse());
  for (let i = 1; i < road.length; i += 1) { const [a, b] = [road[i - 1], road[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 0.5) { const x = a[0] + (b[0] - a[0]) * s / L; const z = a[1] + (b[1] - a[1]) * s / L; assert.ok(ok(x, z), `${x.toFixed(1)},${z.toFixed(1)}`); } }
  assert.ok(road.some(([x, z]) => T.onBridge(x, z)) || (() => { for (let x = 40; x < 80; x += 2) if (T.onBridge(x, 140)) return true; return false; })(), 'over the bridge');
  for (const id of ['plaza', 'isle']) { const s = X.stopOf(id); assert.ok(T.walkable(s.shelter.x, s.shelter.z), `${id} shelter`); assert.ok(T.walkable(s.out.x, s.out.z), `${id} out`); }
  assert.ok(Math.hypot(X.stopOf('plaza').x - T.SPAWN.x, X.stopOf('plaza').z - T.SPAWN.z) > 20, 'clear of the first spot');
});

// v1.10.285 (notes docs/taxi-fix-20261108.md 2절, 사용자 「지형 지물 다 무시하고 뚫고 지나가버려」): both drives -- the road and
// the last turn to the drop-off -- walked every half metre: every solid at least the car's half width + 0.3 m off, no water
// (bridges fine), no stairs, the car's height following the ground (no step over 0.5 m in half a metre -- a bridge end ramps 0.4; off the bridges on the
// drawn ground within 0.25 m); the island end at the user's spot (-13.3, 173.1), its shelter and car spots clear too
test('택시 길 확인: 양쪽 길을 0.5 m마다 -- 단단한 물체에서 차 반폭+0.3 m 밖, 물·계단 아님, 차 높이가 땅을 따라감, 툇마루섬 마을 정류장', () => {
  const solids = [...T.natureSolids(), ...T.structureSolids(), ...T.villageSolids()];
  const clear = (x, z) => Math.min(...solids.map((s) => Math.hypot(x - s.x, z - s.z) - (s.r || 0.5)));
  const HALF = 0.85; // (the car 1.7 m wide -- island-taxi-scene's stand-in, assets 99's model)
  for (const from of ['plaza', 'isle']) {
    const road = X.driveOf(from); let last = null;
    for (let i = 1; i < road.length; i += 1) {
      const [a, b] = [road[i - 1], road[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s <= L; s += 0.5) {
        const x = a[0] + (b[0] - a[0]) * s / L; const z = a[1] + (b[1] - a[1]) * s / L; const at = `${from} ${x.toFixed(1)},${z.toFixed(1)}`;
        assert.ok(clear(x, z) > HALF + 0.3, `${at} by a solid (${clear(x, z).toFixed(2)})`);
        assert.ok(ok(x, z) && !T.onStairs(x, z), `${at} water or stairs`);
        const y = T.heightAt(x, z); if (last != null) assert.ok(Math.abs(y - last) < 0.5, `${at} a step of ${(y - last).toFixed(2)} m`); last = y;
        if (!T.onBridge(x, z)) assert.ok(Math.abs(y - T.meshGroundHeight(x, z)) < 0.25, `${at} off the ground (${(y - T.meshGroundHeight(x, z)).toFixed(2)})`);
      }
    }
  }
  // (294 7) the empty car's way back -- turning round where it let the rider out, the same road back, turning round into its place:
  // every 0.5 m as the way there, and at the end standing just as the parked car does
  for (const from of ['plaza', 'isle']) {
    const ride = { from, startedAt: 0 }; const s = X.stopOf(from); let last = null;
    for (let now = X.durationOf(ride); now < X.backOf(ride); now += 50) {
      const p = X.carAt(ride, now); if (!p) break; assert.ok(['turn', 'back'].includes(p.phase), p.phase);
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.5) continue; last = p; const at = `${from} back ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      assert.ok(clear(p.x, p.z) > HALF + 0.3, `${at} by a solid`); assert.ok(ok(p.x, p.z) && !T.onStairs(p.x, p.z), `${at} water or stairs`);
    }
    const end = X.carAt(ride, X.backOf(ride) - 1); assert.ok(Math.hypot(end.x - s.x, end.z - s.z) < 0.01 && Math.abs(Math.sin(end.yaw - s.yaw)) < 0.01 && Math.cos(end.yaw - s.yaw) > 0, `${from} parked again`);
    assert.equal(X.carAt(ride, X.backOf(ride)), null);
  }
  const isle = X.stopOf('isle'); assert.equal(isle.label, '툇마루섬 마을'); assert.ok(Math.hypot(isle.x + 13.3, isle.z - 173.1) < 4, '사용자 자리');
  for (const id of ['plaza', 'isle']) { const s = X.stopOf(id); const d = X.dropOf(id); for (const [name, p] of [['shelter', s.shelter], ['stand', s], ['drop', d], ['out', s.out]]) assert.ok(clear(p.x, p.z) > 1 && ok(p.x, p.z), `${id} ${name} ${p.x.toFixed(1)},${p.z.toFixed(1)}`); }
});

test('택시 시간: 한 번 25~40초(시험 길은 3초), 타기→출발→달리기→멈춤→내리기 순서, 끝에서 도착 정류장 앞', () => {
  for (const from of ['plaza', 'isle']) {
    const ride = { from, startedAt: 1000 }; const dur = X.durationOf(ride);
    assert.ok(dur > 25000 && dur < 40000, `${from} ${dur}`);
    const seen = []; let last = -1;
    for (let t = 0; t <= dur + 200; t += 100) { const p = X.poseAt(ride, 1000 + t); if (seen.at(-1) !== p.phase) seen.push(p.phase); assert.ok(p.d >= last - 1e-9, 'never back'); last = p.d; }
    assert.deepEqual(seen, ['enter', 'start', 'run', 'stop', 'exit', 'done']);
    const end = X.poseAt(ride, 1000 + dur); const to = X.stopOf(X.STOPS[from].to); const drop = X.dropOf(to.id); assert.ok(Math.hypot(end.x - drop.x, end.z - drop.z) < 0.01);
    // (v1.10.272 총괄) it stands across the shelter from the standing car, facing back along the road: its door -- and where one
    // gets out -- to the shelter, as where one gets in at the start
    assert.ok(Math.abs(Math.atan2(Math.sin(end.yaw - drop.yaw), Math.cos(end.yaw - drop.yaw))) < 0.01, `${from} yaw`);
    const shelterOf = (p) => Math.hypot(p.x - to.shelter.x, p.z - to.shelter.z);
    assert.ok(shelterOf(X.arrivalOf(ride)) < shelterOf(end) && shelterOf(X.arrivalOf(ride)) < 3.5, `${from} out by the shelter`);
    const from0 = X.stopOf(from); assert.ok(Math.hypot(from0.out.x - from0.shelter.x, from0.out.z - from0.shelter.z) < Math.hypot(from0.x - from0.shelter.x, from0.z - from0.shelter.z), `${from} in by the shelter`);
    const pts = X.driveOf(from); for (let i = 1; i < pts.length; i += 1) { const [a, b] = [pts[i - 1], pts[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 0.5) { const x = a[0] + (b[0] - a[0]) * s / L; const z = a[1] + (b[1] - a[1]) * s / L; assert.ok(ok(x, z), `${from} drive ${x.toFixed(1)},${z.toFixed(1)}`); } }
    const out = X.arrivalOf(ride); assert.ok(T.walkable(out.x, out.z), `${from} out`); assert.ok(Math.abs(Math.hypot(out.x - end.x, out.z - end.z) - Math.hypot(1.75, 1.27)) < 0.01); // (beside the car as it stands: exit_L)
    assert.ok(Math.abs(Math.hypot(to.out.x - to.x, to.out.z - to.z) - Math.hypot(1.5, 1.18)) < 0.01); // (where one gets in: enter_L)
  }
  assert.equal(X.durationOf({ from: 'plaza', startedAt: 0, runMs: 3000 }), X.ENTER + 3000 + X.EXIT);
  assert.equal(X.poseAt({ from: 'plaza', startedAt: 0, runMs: 3000 }, X.ENTER + 3000 + X.EXIT).phase, 'done');
});

test('택시 문: 타기 0~0.14에 열고 0.86~1에 닫고, 내리기 0~0.12에 열고 0.80~1에 닫고, 달리는 동안 닫힘', () => {
  assert.equal(X.doorOf('enter', 0), 0); assert.equal(X.doorOf('enter', 0.14), 1); assert.equal(X.doorOf('enter', 0.5), 1); assert.equal(X.doorOf('enter', 1), 0);
  assert.equal(X.doorOf('exit', 0.12), 1); assert.equal(X.doorOf('exit', 0.79), 1); assert.equal(X.doorOf('exit', 1), 0); assert.equal(X.doorOf('run', 0.5), 0);
});

test('택시 요금: 집주인 무료, 집 없으면 경제 값(기본 1,000P)', () => {
  assert.equal(X.fareOf({ hasHome: true }), 0); assert.equal(X.fareOf({ hasHome: false }), 1000); assert.equal(X.fareOf({ hasHome: false, fare: 1500 }), 1500);
});

// v1.10.286 (notes docs/taxi-fix-20261108.md 6절, 밤에 지붕 위 회색 동그라미): every body and every hair seated by TaxiSit at the seat
// (hats are put away in the car) -- its top more than 0.05 m under the roof's underside straight over the seat (the model
// turned round in the game, as the body: the seat at the model's z -SEAT.z), and the seated body on the floor, not in it
test('택시 좌석: 가장 큰 몸·머리로 앉아도 머리 꼭대기가 지붕 아래 0.05 m 넘게, 발은 바닥 위', { timeout: 120000 }, async () => {
  const fs = require('node:fs'); const path = require('node:path'); const A = require('../public/plaza/island-assets');
  const THREE = await import('three'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready; const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => ({ name: 'test_blank_texture', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const load = async (url) => { const b = fs.readFileSync(path.join(__dirname, '../public', url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
  const base = A.REGISTRY['character.base']; const sit = (await load(base.clips.TaxiSit)).animations[0];
  const seated = async (url) => { const g = await load(url); const m = new THREE.AnimationMixer(g.scene); m.clipAction(sit).play(); m.update(sit.duration / 2); g.scene.updateMatrixWorld(true); const b = new THREE.Box3(); g.scene.traverse((o) => { if (o.isMesh) b.expandByObject(o, true); }); return b; };
  const urls = [base.url, base.bare.url, ...Object.entries(A.REGISTRY).filter(([id, e]) => /^wear\.(x2_)?hair_/.test(id) && e.url).map(([, e]) => e.url)];
  assert.ok(urls.length > 20, `${urls.length} bodies and hairs`);
  let top = -Infinity; let tallest = ''; let feet = Infinity;
  for (const url of urls) { const b = await seated(url); if (b.max.y > top) { top = b.max.y; tallest = url; } if (url === base.url) feet = b.min.y; }
  const car = await load(A.REGISTRY['taxi.car'].url); car.scene.updateMatrixWorld(true); const ray = new THREE.Raycaster();
  ray.set(new THREE.Vector3(-X.SEAT.x, X.SEAT.y + 0.3, -X.SEAT.z), new THREE.Vector3(0, 1, 0)); const roof = ray.intersectObject(car.scene, true)[0];
  ray.set(new THREE.Vector3(-X.SEAT.x, X.SEAT.y + 0.3, -X.SEAT.z - 0.33), new THREE.Vector3(0, -1, 0)); const floor = ray.intersectObject(car.scene, true)[0]; /* (under the feet, 0.33 ahead) */
  assert.ok(roof && floor, 'roof and floor over and under the seat');
  assert.ok(X.SEAT.y + top < roof.point.y - 0.05, `${path.basename(tallest)}: head ${(X.SEAT.y + top).toFixed(3)}, roof ${roof.point.y.toFixed(3)}`);
  assert.ok(Math.abs(X.SEAT.y + feet - floor.point.y) < 0.03, `feet ${(X.SEAT.y + feet).toFixed(3)}, floor ${floor.point.y.toFixed(3)}`);
});

// v1.10.294 6a (사용자 「택시가 이동이 끊기는 것」): the screen's clock eases to the server's -- 2 ms a frame, at once past 1 s
test('화면 시계: 장면마다 2 ms까지 따라가고, 1초 넘게 차이 나면 한 번에', () => {
  const X = require('../public/plaza/island-taxi.js');
  assert.equal(X.easeClock(null, 120), 120); assert.equal(X.easeClock(100, 160), 102); assert.equal(X.easeClock(100, 99), 99); assert.equal(X.easeClock(100, 40), 98);
  assert.equal(X.easeClock(0, 1500), 1500); assert.equal(X.easeClock(0, -1001), -1001);
  let v = 0; for (let k = 0; k < 30; k += 1) v = X.easeClock(v, 60); assert.equal(v, 60); /* (60 ms over 30 frames, no jump) */
});

// G4a 흩뿌리기 (notes docs/taxi-yield-20261109.md, docs/graphics-island-wide-20261108.md G4): every new thing that blocks
// -- the added bushes and rocks, the logs, the palms -- 3.2 m off the taxi's road (the car's half width + 1.5 m and the
// islanders' walk to be moved beside it), 10 m off its stops, 2.5 m off the walks and off the lots; an older rock by the
// road or a walk stays walked over; the pebble and the shore's low stones never block
test('택시 길 비우기: G4a 새 단단한 자연물은 길 3.2 m·정류장 10 m·걷는 길 2.5 m·집터 밖, 길가 옛 바위·자갈은 지나감', () => {
  const N = T.nature(); const R = X.ROUTE; const ends = [R[0], R.at(-1)];
  const far = (o, r, road, stop) => T.lineDist(o.x, o.z, R) > road + r && ends.every(([x, z]) => Math.hypot(o.x - x, o.z - z) > stop + r);
  const before = 510; const added = N.bushes.slice(before); /* (the island's own 510 first; the added after them) */
  assert.ok(added.length >= 150 && N.rocks.filter((r) => r.g4).length >= 110 && N.logs.length >= 30 && N.palms.length >= 15 && N.grass.length >= 200 && N.lilies.length >= 30, JSON.stringify([added.length, N.logs.length, N.palms.length]));
  const solid = [...added.map((b) => [b, 0.75 * b.s]), ...N.rocks.filter((r) => r.g4).map((r) => [r, r.s]), ...N.logs.map((l) => [l, 1.1]), ...N.palms.map((p) => [p, 0.4])];
  for (const [o, r] of solid) { assert.ok(far(o, r, 3.2, 10), `${o.x},${o.z} by the taxi`); assert.ok(!T.onLot(o.x, o.z, 1), `${o.x},${o.z} on a lot`); }
  for (const [o, r] of solid.filter(([o]) => !N.palms.includes(o))) assert.ok(T.walkDist(o.x, o.z) > 2.5 + r, `${o.x},${o.z} by a walk`);
  for (const s of T.natureSolids()) assert.ok(T.lineDist(s.x, s.z, R) > s.r + 0.85 + 0.3, `${s.x},${s.z} on the road`);
  for (const r of N.rocks) { if (['shore', 'rock_small'].includes(T.rockKind(r))) assert.equal(T.rockBlocks(r), false); else if (!r.g4 && !far(r, 0.8 * r.s, 3.2, 10)) assert.equal(T.rockBlocks(r), false, 'an older rock by the road'); }
  assert.ok(N.lilies.every((l) => T.dalmaru.lakeDist(l.x, l.z) < 0 || T.dalmaru.riverDist(l.x, l.z) < 0), 'lily pads on the water');
});