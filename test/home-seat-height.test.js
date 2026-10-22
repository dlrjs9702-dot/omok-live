'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../public/plaza/island-home');
const A = require('../public/plaza/island-assets');

// 문제 기록 3회차 3 「앉을 때 소파 위에 떠 있어」: every seat-bearing piece's registered seat is its model's own seat (the face
// straight under it), and a sitter's body sits on it -- the scene lifts a seat 0.28 and SitIdle's seat of the body is 0.26
// above the root, as on a plaza bench (0.54 seat, root 0.28 up)
const SEAT_LIFT = 0.28; const BODY_SEAT = 0.26;
test('내 집 앉을 자리: 모델 방석 높이 그대로, 앉은 몸이 방석 위에 (소파·의자·벤치·침대)', { timeout: 60000 }, async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const ray = new THREE.Raycaster();
  const lot = H.LOTS[0]; let checked = 0;
  for (const [shape, seats] of Object.entries(H.SEATS)) {
    const id = Object.keys(A.REGISTRY).find((k) => k.startsWith(`furn.${shape}__`)); if (!id) continue; // (the window seat: the room's own)
    const b = fs.readFileSync(path.join(__dirname, '../public', A.REGISTRY[id].url));
    const g = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); g.scene.updateMatrixWorld(true);
    for (const [x, y, z] of seats) {
      ray.set(new THREE.Vector3(x, 0.9, z), new THREE.Vector3(0, -1, 0)); const hit = ray.intersectObject(g.scene, true)[0];
      assert.ok(hit && Math.abs(hit.point.y - y) < 0.015, `${shape}: 등록 ${y}, 모델 ${hit?.point.y.toFixed(3)}`);
    }
    const piece = { uid: 'u', id: `${shape}__x`, x: 0, z: 0, rot: 0 };
    const got = H.allSeatsOf(lot, { pieces: [piece], stage: 1 }); assert.equal(got.length, seats.length, shape);
    got.forEach((s, k) => assert.ok(Math.abs(s.y + SEAT_LIFT + BODY_SEAT - (H.ROOM.y + seats[k][1])) < 1e-9, `${shape} ${k}: 몸이 방석 위`));
    checked += 1;
  }
  assert.ok(checked >= 7, `${checked} shapes`);
});
