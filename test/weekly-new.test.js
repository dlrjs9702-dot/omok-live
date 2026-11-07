'use strict';
// v1.10.227 주간 신상 (gamecenter-notes docs/weekly-new-20261102.md): a week from Monday 00:00 Seoul; the 옷가게's rare and
// legend look items ten a week (two a slot, two legends, none of last week's; not the Halloween, winter, IP or transformation
// ones), the rest hidden and not sold or given -- owned ones still worn; the 3층's rare pieces six a week on their own shelf
// (no shape twice), none on the daily display; the board's note once a week. And the giant tuna in the big tanks: six places.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const S = require('../lib/skins');
const F = require('../public/plaza/island-furniture');
const H = require('../public/plaza/island-home');

test('주간 신상 규칙: 월요일 0시 경계, 같은 주 같은 10종·6점, 지난주와 안 겹침, 부위·전설 둘까지, 계절·IP·변신 안 돌림', () => {
  assert.equal(F.weekOf(Date.parse('2026-11-08T23:59:59+09:00')), 0, '일요일 23:59');
  assert.equal(F.weekOf(Date.parse('2026-11-09T00:00:00+09:00')), 1, '월요일 0:00');
  assert.equal(F.weekEndsAt(0), Date.parse('2026-11-09T00:00:00+09:00'));
  assert.equal(S.WEEKLY_POOL.length, 46);
  for (const id of S.WEEKLY_POOL) { const s = S.skinById(id); assert.ok(['rare', 'legend'].includes(s.tier) && s.family === 'avatar' && s.slot !== 'transform' && !s.ip && !id.startsWith('avatar_winter_'), id); }
  for (const id of ['avatar_hair_17', 'avatar_outfit_18', 'avatar_cape_12', 'avatar_necklace_11']) assert.ok(!S.WEEKLY_POOL.includes(id), `할로윈 ${id}`);
  let last = [];
  for (let w = 0; w < 12; w += 1) {
    const ids = S.weeklySkins(w); assert.equal(ids.length, 10, `${w}주`); assert.deepEqual(S.weeklySkins(w), ids, '같은 주는 같게');
    assert.ok(ids.every((id) => !last.includes(id)), `${w}주: 지난주와 안 겹침`);
    const bySlot = {}; for (const id of ids) bySlot[S.skinById(id).slot] = (bySlot[S.skinById(id).slot] || 0) + 1;
    assert.ok(Object.values(bySlot).every((n) => n <= 2), `${w}주 부위 둘까지`); assert.ok(ids.filter((id) => S.skinById(id).tier === 'legend').length <= 2, `${w}주 전설 둘까지`);
    const pieces = F.weeklyOf(w); assert.equal(pieces.length, 6); assert.equal(new Set(pieces.map((id) => F.good(id).shape)).size, 6, '가구 모양 안 겹침');
    assert.ok(pieces.every((id) => F.good(id).rarity === 'rare' && F.good(id).kind === 'floor'));
    last = ids;
  }
  for (let d = 1; d <= 28; d += 1) { const day = `2026-11-${String(d).padStart(2, '0')}`.replace('2026-11-29', '2026-12-01'); for (const [slot, id] of Object.entries(F.displayOf(day))) assert.ok(F.good(id).rarity !== 'rare' || slot === 'wide0', `${day} ${slot}: 드묾은 신상 진열대에만`); }
});

test('참치는 6칸: 큰 수조 참치 1 + 2마리, 참치 둘째·셋째 물고기 거절, 벽면 둘, 이미 든 벽면 수조는 그대로', () => {
  const f = (...ids) => ids.map((itemId) => ({ itemId }));
  assert.equal(H.fits('aquarium_big', 'fish_giant_tuna'), true); assert.equal(H.fits('aquarium_pillar', 'fish_giant_tuna'), true); assert.equal(H.fits('fish_tank', 'fish_giant_tuna'), false);
  assert.equal(H.tankRoom('aquarium_big', f('fish_giant_tuna', 'fish_goby'), 'fish_goby'), true, '참치 1 + 2마리');
  assert.equal(H.tankRoom('aquarium_big', f('fish_giant_tuna', 'fish_goby', 'fish_goby'), 'fish_goby'), false, '셋째 물고기');
  assert.equal(H.tankRoom('aquarium_big', f('fish_giant_tuna'), 'fish_giant_tuna'), false, '참치 둘째');
  assert.equal(H.tankRoom('aquarium_wall', f('fish_giant_tuna'), 'fish_giant_tuna'), true); assert.equal(H.tankRoom('aquarium_wall', f('fish_giant_tuna', 'fish_giant_tuna'), 'fish_goby'), false, '벽면 참치 둘이면 가득');
  assert.equal(H.tankUsed(f('fish_giant_tuna', 'fish_giant_tuna', 'fish_giant_tuna')), 18, '이미 셋 든 벽면 수조: 그대로(더 넣기만 막힘)'); assert.equal(H.tankRoom('aquarium_wall', f('fish_giant_tuna', 'fish_giant_tuna', 'fish_giant_tuna'), 'fish_goby'), false);
});

test('주간 신상 서버: 숨긴 희귀 사기·선물 거절, 이번 주 것은 삼, 주가 바뀌어도 산 것은 그대로·입기, 3층 신상 진열대, 게시판 쪽지 주마다 한 번', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('신상손님')); const b = await server.enter(await server.issue('신상친구'));
  await req('/api/test/points-credit', a, { amount: 3000000 });
  // the test server sells all until a test holds a week
  const hidden0 = S.WEEKLY_POOL.find((id) => !S.weeklySkins(0).includes(id));
  assert.equal((await req('/api/skins', a)).data.weekly, null);
  assert.equal((await req('/api/test/new-week', a, { week: 0 })).data.on, true);
  const view = (await req('/api/skins', a)).data.weekly; assert.deepEqual(view.ids, S.weeklySkins(0)); assert.ok(view.hidden.includes(hidden0));
  assert.equal((await req('/api/skins/buy', a, { skinId: hidden0 })).data.error, 'NOT_THIS_WEEK', '숨긴 것 사기');
  const bKey = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '신상친구');
  assert.equal((await req('/api/skins/gift', a, { skinId: hidden0, to: bKey.id, requestId: crypto.randomUUID() })).data.error, 'NOT_THIS_WEEK', '숨긴 것 선물');
  const mine = S.weeklySkins(0)[0]; const bought = await req('/api/skins/buy', a, { skinId: mine }); assert.equal(bought.status, 200, JSON.stringify(bought.data));
  // the next week: it is mine still (not hidden from me), worn; not on sale to others
  await req('/api/test/new-week', a, { week: 1 }); assert.ok(!S.weeklySkins(1).includes(mine));
  const next = (await req('/api/skins', a)).data; assert.ok(next.owned.includes(mine)); assert.ok(!next.weekly.hidden.includes(mine), '가진 건 숨기지 않음');
  assert.equal((await req('/api/skins/equip', a, { skinId: mine })).status, 200, '가진 것 입기');
  assert.equal((await req('/api/skins/buy', a, { skinId: mine })).status, 200, '가진 것 다시: 그냥 답');
  assert.equal((await req('/api/skins/buy', b, { skinId: mine })).data.error, 'NOT_THIS_WEEK');
  // the 3층: the week's six on their shelf, at the rare price
  const shop = (await req('/api/island/furniture', a)).data; assert.deepEqual(shop.weekly.map((d) => d.id), F.weeklyOf(1)); assert.ok(shop.weekly.every((d) => d.price === 15000));
  assert.ok(shop.display.every((d) => d.rarity !== 'rare' || d.slot === 'wide0'));
  // the board: one note a week
  const notes = async () => (await req('/api/announcements', a)).data.items.filter((n) => n.title.startsWith('[이번 주 신상]')).length;
  await req('/api/test/new-week', a, { week: 1 }); await req('/api/test/new-week', a, { week: 1 });
  await new Promise((done) => setTimeout(done, 300)); assert.equal(await notes(), 2, '0주·1주 하나씩');
  await req('/api/test/new-week', a, { week: null });
});
