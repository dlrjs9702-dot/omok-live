'use strict';
// 1.10.325 크리스마스 마켓 (IslandCalendar.PLACES.market; notes christmas-boost-20261115 P1, plaza-relayout 54A): three stalls east of the
// contest tent facing the fountain, on standable ground off the walks' middle; a snack bought only with the winter decor up, at
// the stall's front, its price taken once a request, held five minutes and seen by others; the festival's 「마켓 들르기」
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const C = require('../public/plaza/island-calendar.js');
const T = require('../public/plaza/island-terrain.js');

test('크리스마스 마켓 자리: 대회 천막 동쪽 세 칸, 분수를 봄, 사는 자리는 설 수 있음, 대청마당 다시 배치 자리', () => {
  const M = C.PLACES.market; assert.deepEqual(M.map((m) => [m.id, m.x, m.z]), [['cocoa', 27, -104.5], ['sweetpotato', 31, -104.5], ['fishbread', 35, -104.5]]);
  for (const m of M) {
    const front = { x: m.x - Math.sin(m.yaw), z: m.z - Math.cos(m.yaw) }; assert.ok(Math.hypot(front.x, front.z + 84) < Math.hypot(m.x, m.z + 84), `${m.id} 앞이 분수 쪽`);
    const buy = { x: m.x - Math.sin(m.yaw) * 1.13, z: m.z - Math.cos(m.yaw) * 1.13 }; assert.ok(T.walkable(buy.x, buy.z), `${m.id} 사는 자리`);
  }
  assert.ok(C.FESTIVALS.find((f) => f.id === 'christmas-2026').tasks.market, '도장 과제 「마켓 들르기」');
  // 54A·56A: 미션판 on the 알림마루 row's north end, 기부함 by the 거래소, 벽화 in the north-west 쉼터
  assert.deepEqual([T.dalmaru.PLACES.missions.x, T.dalmaru.PLACES.missions.z], [-42.2, -82]); assert.deepEqual([T.SPOTS.donate.x, T.SPOTS.donate.z], [3.5, -62]); assert.deepEqual([T.dalmaru.PLACES.mural.x, T.dalmaru.PLACES.mural.z], [-33, -105]);
});

test('크리스마스 마켓 서버: 겨울 장식일 때만, 가판대 앞에서, 한 요청에 한 번, 손에 든 간식이 다른 사람에게 보임', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasmarket-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('간식손님')); const b = await server.enter(await server.issue('구경손님'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '간식손님');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 300000, category: 'other', memo: '시험', requestId: crypto.randomUUID() });
  const m = C.PLACES.market[0]; const buy = { x: m.x - Math.sin(m.yaw) * 1.13, z: m.z - Math.cos(m.yaw) * 1.13 };
  await req('/api/plaza/state', a, { x: buy.x, z: buy.z, yaw: 0, moving: false });
  const order = (who, body) => req('/api/island/market/buy', who, { stall: m.id, requestId: crypto.randomUUID(), ...body });
  await req('/api/admin/island/decor', server.admin, { mode: 'off' }).catch(() => {});
  const closed = await order(a); if (closed.status !== 200) assert.equal(closed.data.error, 'CLOSED');
  const d = await req('/api/admin/island/decor', server.admin, { mode: 'winter' }); assert.equal(d.status, 200, JSON.stringify(d.data));
  const bal = async () => (await req('/api/points', a)).data.balance; const before = await bal();
  const rid = crypto.randomUUID(); const r1 = await order(a, { requestId: rid }); assert.equal(r1.status, 200, JSON.stringify(r1.data)); assert.equal(r1.data.snack.id, 'cocoa');
  assert.equal(await bal(), before - m.price); await order(a, { requestId: rid }); assert.equal(await bal(), before - m.price, '같은 요청은 한 번');
  await req('/api/plaza/state', a, { x: buy.x + 6, z: buy.z, yaw: 0, moving: false }); void b;
  assert.equal((await order(a)).data.error, 'TOO_FAR');
});
