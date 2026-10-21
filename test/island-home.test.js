'use strict';
// 묶음 4 내 집 (gamecenter-notes docs/my-home-20261020.md): the rules the browser shows and the server enforces --
// twelve lots off the walks, a piece inside the room, not on another, not in the doorway; the hung ones on a wall;
// what each tank (and the insect case) takes; a sofa's seats where it stands, turned.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/plaza/island-home.js');
const T = require('../public/plaza/island-terrain.js');

test('내 집: 집터 12곳은 길·물 밖 평지, 문 앞은 걸을 수 있다', () => {
  assert.equal(H.LOTS.length, 12);
  for (const lot of H.LOTS) {
    const d = H.doorOf(lot);
    assert.ok(T.walkable(d.x, d.z), `${lot.id} 문 앞`);
    assert.ok(!T.walkCurves.some((w) => w.pts.some(([x, z]) => Math.hypot(x - lot.x, z - lot.z) < 3.2)), `${lot.id}는 길 밖`);
  }
});

test('내 집: 놓기 규칙 -- 방 안·0.25 칸·겹침·문간·벽 가구', () => {
  const sofa = { uid: 'a', id: 'sofa__mint', x: 0, z: 0, rot: 0 };
  assert.equal(H.placeError(sofa, []), null);
  assert.match(H.placeError({ ...sofa, x: 0.1 }, []), /자리/);
  assert.match(H.placeError({ ...sofa, x: 5.75 }, []), /방 밖/); // (the 작은 집: 12 x 12 m since 2026-10-21)
  assert.match(H.placeError({ ...sofa, uid: 'b', x: 0.5 }, [sofa]), /겹쳐요/);
  assert.match(H.placeError({ ...sofa, z: -5 }, []), /문 앞/);
  assert.equal(H.placeError({ uid: 'r', id: 'rug_round__sage', x: 0, z: 0, rot: 0 }, [sofa]), null); // (a rug under it)
  const clock = { uid: 'c', id: 'wall_clock__oak', x: 0, z: 5.75, rot: 0 };
  assert.equal(H.placeError(clock, [sofa]), null);
  assert.match(H.placeError({ ...clock, z: 0 }, []), /벽에 거는/);
  assert.equal(H.placeError({ ...clock, x: 5.75, z: 0, rot: 1 }, []), null); // (on the side wall, turned)
});

test('내 집: 수조는 크기·칸, 곤충 상자는 곤충 하나', () => {
  assert.ok(H.fits('fish_tank', 'fish_goby')); assert.ok(!H.fits('fish_tank', 'fish_giant_tuna')); assert.ok(H.fits('aquarium_wall', 'fish_giant_tuna'));
  assert.ok(!H.fits('fish_tank', 'insect_ladybird')); assert.ok(H.fits('insect_case', 'insect_ladybird')); assert.ok(!H.fits('insect_case', 'fish_goby'));
  assert.equal(H.TANKS.insect_case.slots, 1);
});

test('내 집: 앉을 자리는 가구를 따라 돌고, 서 있는 자리는 가구 밖', () => {
  const lot = H.LOTS[0]; const sofa = { uid: 's', id: 'sofa__mint', x: 1, z: 1, rot: 1 };
  const seats = H.seatsOf(lot, sofa); assert.equal(seats.length, 2);
  for (const s of seats) { const { lx, lz } = H.local(lot, s.x, s.z); assert.ok(Math.abs(lx - 1) < 0.2 && Math.abs(lz - 1) < 0.5, `${lx},${lz}`); }
  const w = H.world(lot, 1, 1); const q = H.clamp(lot, w.x, w.z, [sofa]); const { lx, lz } = H.local(lot, q.x, q.z); const b = H.boxOf(sofa);
  assert.ok(lx < b.x0 - 0.29 || lx > b.x1 + 0.29 || lz < b.z0 - 0.29 || lz > b.z1 + 0.29);
});

// (실내 크기 다시, 사용자 2026-10-21: 오두막 9×9·25·10, 작은 집 12×12·45·20, 큰 집 16×13·70·30 with its half wall and window seat)
test('집 단계(묶음 4-2): 오두막 9×9 → 작은 집 12×12 → 큰 집 16×13 -- 가구는 그 자리, 벽 가구는 새 벽으로, 큰 집의 반벽·창가 의자', () => {
  assert.deepEqual([1, 2, 3].map((n) => { const s = H.stageOf(n); return [s.w, s.d, s.pieces, s.fish]; }), [[9, 9, 25, 10], [12, 12, 45, 20], [16, 13, 70, 30]]);
  assert.equal(H.stageOf(undefined).n, 2); assert.equal(H.TOP_STAGE, 3); // (v1.10.112's houses: 작은 집)
  const sofa = { uid: 's', id: 'sofa__mint', x: 0, z: 3.75, rot: 0 };
  assert.match(H.placeError({ ...sofa, z: 4 }, [], 1), /방 밖/); assert.equal(H.placeError(sofa, [], 1), null);
  assert.match(H.placeError({ ...sofa, z: -3.5 }, [], 1), /문 앞/); // (the 오두막's doorway, nearer the middle)
  const clock = { uid: 'c', id: 'wall_clock__oak', x: 0, z: 4.25, rot: 0 }; assert.equal(H.placeError(clock, [], 1), null);
  const g = H.grownPieces([clock, sofa], 2); assert.deepEqual(g.back, []);
  assert.equal(g.pieces.find((p) => p.uid === 'c').z, 5.75); assert.equal(g.pieces.find((p) => p.uid === 's').z, 3.75);
  const g3 = H.grownPieces(g.pieces, 3); assert.equal(g3.pieces.find((p) => p.uid === 'c').z, 6.25); // (the 큰 집's back wall)
  assert.equal(H.placeError({ ...sofa, x: 3, z: 0 }, [], 3), null); // (through the arch)
  assert.match(H.placeError({ ...sofa, x: 2.75, z: 3 }, [], 3), /반벽|창가|벽/); // (in the half wall)
  assert.deepEqual(H.entryOf(1), [0, -3.6]); assert.deepEqual(H.entryOf(3), [0, -5.6]);
  const seats = H.allSeatsOf(H.LOTS[0], { stage: 3, pieces: [] }); assert.equal(seats.length, 1); assert.equal(seats[0].id, 'home:room0:0'); // (the window seat)
  assert.equal(H.allSeatsOf(H.LOTS[0], { stage: 2, pieces: [] }).length, 0);
});
