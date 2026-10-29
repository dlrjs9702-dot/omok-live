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
  for (const s of seats) { const { lx, lz } = H.local(lot, s.x, s.z); assert.ok(Math.abs(lx - 1) < 0.2 && Math.abs(lz - 1) < 0.65, `${lx},${lz}`); } // (6회차 4: the two 1.12 m apart)
  const [p, q2] = seats; assert.ok(Math.hypot(p.x - q2.x, p.z - q2.z) > 1.05, '머리가 겹치지 않을 간격');
  // v1.10.189: only the backless ones are sat on any way
  assert.ok(seats.every((s) => s.anyDir === false));
  for (const id of ['stool__oak', 'floor_cushion__mint']) assert.ok(H.seatsOf(lot, { uid: 'x', id, x: 0, z: 0, rot: 0 }).every((s) => s.anyDir === true), id);
  const w = H.world(lot, 1, 1); const q = H.clamp(lot, w.x, w.z, [sofa]); const { lx, lz } = H.local(lot, q.x, q.z); const b = H.boxOf(sofa);
  assert.ok(lx < b.x0 - 0.29 || lx > b.x1 + 0.29 || lz < b.z0 - 0.29 || lz > b.z1 + 0.29);
});

// (실내 크기 다시, 사용자 2026-10-21: 오두막 9×9·25·10, 작은 집 12×12·45·20, 큰 집 16×13·70·30 with its half wall and window seat)
test('집 단계(묶음 4-2): 오두막 9×9 → 작은 집 12×12 → 큰 집 16×13 -- 가구는 그 자리, 벽 가구는 새 벽으로, 큰 집의 반벽·창가 의자', () => {
  assert.deepEqual([1, 2, 3].map((n) => { const s = H.stageOf(n); return [s.w, s.d, s.pieces, s.fish]; }), [[9, 9, 25, 10], [12, 12, 45, 20], [16, 13, 70, 30]]);
  assert.equal(H.stageOf(undefined).n, 2); assert.equal(H.TOP_STAGE, 4); // (v1.10.112's houses: 작은 집; R8: the 2층 큰 집 on top)
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

// R8 4단계 큰 집 2층: the 1층 the 큰 집's with the stairs at its front left (no piece on them; one in their way goes back to
// the 창고 when the house grows), the 2층 a room of its own (90 m behind, its hole kept clear, one comes up behind it),
// each floor its own pieces (`floor: 2` up there) and count, both floors' fish together
test('집 4단계(R8): 2층 큰 집 — 1층 계단 자리·2층 계단 구멍은 비움, 층마다 가구, 2층은 따로 떨어진 방', () => {
  const s4 = H.stageOf(4); const up = H.stageOf('upper');
  assert.deepEqual([s4.w, s4.d, s4.pieces, s4.fish, s4.house, up.pieces, up.room, up.tile], [16, 13, 70, 40, 'manor2', 50, 'upper_room', '_s4']);
  assert.equal(H.MAX_PIECES, 120); assert.equal(H.doorOf(H.LOTS[0], 4).x, H.doorOf(H.LOTS[0], 3).x); // (the same door)
  const chair = { uid: 'a', id: 'armchair__oak', x: -7, z: -4, rot: 0 };
  assert.equal(H.placeError(chair, [], 3), null); assert.match(H.placeError(chair, [], 4), /벽|겹/); // (the stairs)
  assert.match(H.placeError(chair, [], 'upper'), /벽|겹/); assert.equal(H.placeError({ ...chair, x: 0, z: 0 }, [], 'upper'), null); // (the hole)
  assert.deepEqual(H.grownPieces([chair, { ...chair, uid: 'b', x: 0, z: 0 }], 4).back, ['a']);
  const lot = H.LOTS[0]; const up2 = H.upperLot(lot);
  assert.ok(Math.hypot(H.roomOf(up2).x - H.roomOf(lot).x, H.roomOf(up2).z - H.roomOf(lot).z) >= 80, '따로 떨어진 방');
  assert.deepEqual(H.entryOf('upper'), [-7, -0.95]);
  const inHole = H.world(up2, -7, -4); const kept = H.local(up2, ...Object.values(H.clamp(up2, inHole.x, inHole.z, [], 'upper')));
  assert.ok(kept.lx >= -6 + 0.29 || kept.lz >= -1.5 + 0.29, `구멍 밖으로: ${JSON.stringify(kept)}`);
  const home = { stage: 4, pieces: [{ ...chair, uid: 'f1', x: 0, z: 0 }, { ...chair, uid: 'f2', x: 1, z: 1, floor: 2 }] };
  assert.deepEqual([H.floorView(home, 1).pieces.map((p) => p.uid), H.floorView(home, 2).pieces.map((p) => p.uid), H.floorView(home, 2).stage], [['f1'], ['f2'], 'upper']);
  assert.equal(H.allSeatsOf(up2, H.floorView({ stage: 4, pieces: [] }, 2)).length, 1); // (the 2층's window seat)
});

// (문제 기록 3회차 6 「벽면에 딱 안 붙어」) a piece stands on the 0.25 m steps or flush against a wall, whatever its depth;
// snapPos settles a slid piece on the nearest of those (pushed up to a wall: flush)
test('내 집 가구: 0.25 m 칸이나 벽에 딱 붙은 자리, 미끄러진 자리는 가장 가까운 그곳으로', () => {
  const st = H.stageOf(2); const sofa = { uid: 'u', id: 'sofa__mint', rot: 0, x: 0, z: 0 }; const [w, d] = H.SIZE.sofa;
  const back = st.hz - d / 2; const side = st.hx - w / 2;
  assert.equal(H.placeError({ ...sofa, z: back }, [], 2), null); // (5.425: not on the steps, flush with the back wall)
  assert.equal(H.placeError({ ...sofa, x: -side, z: back }, [], 2), null); // (into the corner)
  assert.match(H.placeError({ ...sofa, z: back - 0.1 }, [], 2), /자리/);
  assert.equal(H.placeError({ ...sofa, z: back - 0.1 }, [], 2, { free: true }), null); // (held, on its way)
  assert.deepEqual(H.snapPos({ ...sofa, z: back }, 2), { x: 0, z: back });
  assert.deepEqual(H.snapPos({ ...sofa, z: 9 }, 2), { x: 0, z: back });
  assert.deepEqual(H.snapPos({ ...sofa, x: 1.13, z: 1.38 }, 2), { x: 1.25, z: 1.5 });
  assert.deepEqual(H.snapPos({ ...sofa, rot: 1, x: 9 }, 2), { x: st.hx - d / 2, z: 0 }); // (turned: its depth along x)
});

// 207 집 꾸미기 (gamecenter-notes docs/home-tabletop-20261029.md 1, 사용자 「곤충상자 같은 작은 건 책상 위에 올릴 수 있게」):
// a small thing all inside a desk's top stands on it (its top's height, 0.05 m places), half over its edge is the floor's rule
// (an overlap), two on one top not on each other, a desk with things on it not moved; the floor as before
test('집 꾸미기: 작은 물건은 책상·탁자 위에, 걸치면 바닥 규칙, 위끼리 안 겹침, 위에 있으면 책상 못 옮김', () => {
  const desk = { uid: 'd', id: 'desk__oak', x: 1, z: 2, rot: 0 }; // (1.2 x 0.63: x 0.4~1.6, z 1.685~2.315)
  const box = { uid: 'i', id: 'insect_case__oak', x: 0.75, z: 2, rot: 1 }; // (0.34 x 0.6 turned: x 0.58~0.92, z 1.7~2.3)
  assert.equal(H.placeError(box, [desk]), null, '책상 안 곤충 상자');
  assert.equal(H.supportOf(box, [desk])?.uid, 'd'); assert.equal(H.liftOf(box, [desk]), H.TOPS.desk); assert.ok(H.TOPS.desk > 0.7 && H.TOPS.desk < 0.85, '모델 윗면');
  assert.match(H.placeError({ ...box, x: 0.73 }, [desk]), /자리/, '위에서는 0.05 칸');
  assert.equal(H.placeError({ ...box, x: 1.15 }, [desk]), null, '0.05 칸 어디나');
  const half = { ...box, x: 0.25 }; assert.equal(H.supportOf(half, [desk]), null); assert.match(H.placeError(half, [desk]), /다른 가구와 겹쳐요/, '반쯤 걸침 → 바닥 규칙');
  const globe = { uid: 'g', id: 'xmas_snow_globe__plain', x: 0.8, z: 2, rot: 0 };
  assert.match(H.placeError(globe, [desk, box]), /위에 놓인 다른 물건과 겹쳐요/, '같은 책상 위 둘 겹침');
  assert.equal(H.placeError({ ...globe, x: 1.3 }, [desk, box]), null, '같은 책상 위 나란히');
  assert.deepEqual(H.heldOn(desk, [box, { ...globe, x: 1.3 }]).map((p) => p.uid), ['i', 'g'], '책상 위에 있는 것');
  assert.equal(H.placeError({ uid: 's', id: 'sofa__mint', x: 3, z: 2, rot: 0 }, [desk, box]), null, '바닥 규칙 그대로');
  assert.match(H.placeError({ ...desk, uid: 'd2', x: 1.25 }, [desk]), /겹쳐요/, '책상끼리는 겹침');
  assert.equal(H.placeError(desk, [box]), null, '제자리 책상: 위의 것은 걸리지 않음'); assert.match(H.placeError({ ...desk, x: 0.25 }, [box]), /겹쳐요/, '조금 옮기면 걸친 물건과 겹침');
  assert.equal(H.supportOf({ uid: 'r', id: 'sofa__mint', x: 1, z: 2, rot: 0 }, [desk]), null, '큰 가구는 안 올라감');
  assert.equal(H.supportOf({ uid: 'n', id: 'radio__red', x: 1, z: 2, rot: 0 }, [{ ...desk, id: 'nightstand__oak' }]), null, '협탁은 위가 평평하지 않아 뺌');
  // V1 (assets 86): on a top the 곤충 상자 is the small tabletop one -- its own footprint decides (0.36 x 0.24), the floor one's not
  const small = { uid: 'c2', id: 'insect_case__walnut', x: 0.6, z: 2, rot: 0 }; // (0.42~0.78 on the desk; the floor one's 0.6 would stick out)
  assert.equal(H.supportOf(small, [desk])?.uid, 'd', '탁상형 크기로 위'); assert.equal(H.placeError(small, [desk]), null);
  assert.deepEqual(H.topBox(small), { x0: 0.42, x1: 0.78, z0: 1.88, z1: 2.12 }); assert.ok(H.TANKS.insect_case_desk.insects);
  // on a top the arrows' snap: the nearest 0.05 place, kept on it
  assert.deepEqual(H.snapPos({ ...box, x: 0.6123, z: 2.01 }, 2, [desk]), { x: 0.6, z: 2 });
  // a house grown: the desk first, what is on it after
  const grown = H.grownPieces([box, desk], 3); assert.deepEqual(grown.back, []); assert.equal(H.supportOf(grown.pieces.find((p) => p.uid === 'i'), grown.pieces)?.uid, 'd');
});
