'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const J = require('../public/plaza/island-jail');

// R4 구치소 (gamecenter-notes IDEAS 「구치소 — 체납자 반성문」)
test('구치소 규칙: 날마다 같은 문장 3개, 비교 정규화, 철창 안·밖 경계', () => {
  const a = J.sentencesOf('2026-10-23'); assert.equal(a.length, 3); assert.equal(new Set(a).size, 3);
  assert.deepEqual(J.sentencesOf('2026-10-23'), a, '그날은 모두 같은 문장');
  assert.notDeepEqual(J.sentencesOf('2026-10-24'), a);
  assert.equal(J.sentencesOf('2026-10-23', 2).length, 2);
  assert.ok(J.same('  나는 섬의  주민세를 성실히 내겠습니다 ', '나는 섬의 주민세를 성실히 내겠습니다.'));
  assert.ok(!J.same('나는 섬의 주민세를 성실히 내겠읍니다.', '나는 섬의 주민세를 성실히 내겠습니다.'));
  const door = J.world(0, -4); // in front of the room's door: an inmate is put back in the cell
  const p = J.clamp(door.x, door.z, true); assert.ok(J.inCell(p.x, p.z));
  const inside = J.world(0, 3); // a visitor asking for the cell stands outside it
  const q = J.clamp(inside.x, inside.z); assert.ok(!J.inCell(q.x, q.z) && J.inJail(q.x, q.z));
  const r = J.clamp(inside.x, inside.z, 'free'); assert.ok(J.inCell(r.x, r.z), '풀려난 사람은 열린 철창 안을 걸어 나옴');
});

test('구치소 서버: 체납자는 철창 안에서 시작, 반성문 3문장 통과·시간 초과 재시도, 그날 다시 안 갇힘, 납부로 풀림', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jail-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const rich = await server.enter(await server.issue('부자')); const poor = await server.enter(await server.issue('빈털터리'));
  const newbie = await server.enter(await server.issue('새내기'));
  const balance = async (who) => (await req('/api/points', who)).data.balance;
  // (주민세 고지서: a day's bill, not paid by its due day -- owed from the midnight after)
  await req('/api/test/tax', rich, { day: '2026-09-01' }); await req('/api/test/tax', rich, { day: '2026-09-05' });
  assert.ok((await req('/api/island/tax', poor)).data.debt > 0);
  const gate = T.facilityDoor('jail');
  // a debtor on their first day, and one owing nothing: not taken
  assert.equal((await req('/api/plaza/state', newbie, { x: gate.x, z: gate.z, yaw: 0 })).data.jail, null, '가입 첫날 제외');
  assert.equal((await req('/api/plaza/state', rich, { x: gate.x, z: gate.z + 1, yaw: 0 })).data.jail, null);
  // the debtor: in the cell from the first pose of a visit
  await req('/api/test/jail', poor, { veteran: true });
  const first = (await req('/api/plaza/state', poor, { x: gate.x, z: gate.z, yaw: 0 })).data;
  assert.equal(first.jail.inmate, true); assert.ok(J.inCell(first.x, first.z)); assert.equal(first.corrected, true);
  const out = J.world(0, -3); const held = (await req('/api/plaza/state', poor, { x: out.x, z: out.z, yaw: 0 })).data;
  assert.ok(J.inCell(held.x, held.z), '철창 밖으로 못 나감');
  const exit = J.world(J.ROOM.exit.lx, J.ROOM.exit.lz);
  assert.equal((await req('/api/island/jail/leave', poor, {})).data.error, 'JAILED');
  // a visitor: in at the door, never in the cell
  assert.equal((await req('/api/island/jail/enter', rich, {})).status, 200);
  const cell = J.world(0, 3); const look = (await req('/api/plaza/state', rich, { x: cell.x, z: cell.z, yaw: 0 })).data;
  assert.ok(J.inJail(look.x, look.z) && !J.inCell(look.x, look.z));
  assert.equal((await req('/api/island/jail/start', rich, {})).data.error, 'NOT_JAILED');
  // the essay: wrong, too late, then right three times
  const s = (await req('/api/island/jail/start', poor, {})).data; assert.deepEqual([s.i, s.count], [0, 3]); assert.ok(s.left > 15000);
  const chat = async (text) => (await req('/api/lobby/chat', poor, { text })).data.jail;
  assert.deepEqual([(await chat('모르겠어요')).say, (await req('/api/island/jail', poor)).data.essay.i], ['다시.', 0]);
  await req('/api/test/jail', poor, { expire: true });
  const late = await chat(s.sentence); assert.deepEqual([late.say, late.i], ['다시.', 0], '시간 초과면 같은 문장 다시');
  let said = late; for (let k = 0; k < 2; k += 1) { said = await chat(said.sentence); assert.deepEqual([said.say, said.i], ['좋습니다.', k + 1]); }
  const done = await chat(said.sentence); assert.equal(done.passed, true); assert.ok(done.say);
  const board = (await req('/api/island/jail', rich)).data; assert.equal(board.passed, 1); assert.equal(board.log.length, 5, '구경꾼은 안에서 그날 반성문 기록을 봄');
  assert.equal((await req('/api/island/jail', newbie)).data.log.length, 0, '밖에서는 안 보임');
  // let out: through the open cell, out at the room's door; the same day, not taken again
  const free = (await req('/api/plaza/state', poor, { x: cell.x, z: cell.z + 0.5, yaw: 0 })).data; assert.equal(free.jail.inmate, 'free'); assert.ok(J.inCell(free.x, free.z));
  await req('/api/plaza/state', poor, { x: exit.x, z: exit.z, yaw: 0 });
  assert.equal((await req('/api/island/jail/leave', poor, {})).data.space, 'island');
  await req('/api/plaza/leave', poor, {});
  assert.equal((await req('/api/plaza/state', poor, { x: gate.x, z: gate.z, yaw: 0 })).data.jail, null, '통과는 그날 하루');
  // 「지금 세금 내기」: paid in full from the cell, it opens
  await req('/api/test/jail', newbie, { veteran: true }); await req('/api/plaza/leave', newbie, {});
  assert.equal((await req('/api/plaza/state', newbie, { x: gate.x, z: gate.z, yaw: 0 })).data.jail.inmate, true);
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '새내기');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 300000, category: 'other', memo: '시험', requestId: crypto.randomUUID() });
  const paid = (await req('/api/island/tax', newbie, { requestId: 'jail-pay-0001' })).data; assert.equal(paid.debt, 0);
  assert.equal((await req('/api/island/jail', newbie)).data.inmate, 'free');
});
