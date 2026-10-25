'use strict';
// E1 계절 행사 (gamecenter-notes docs/season-events-design-20261025.md): the harvest festival through the real server --
// stamps for its tasks (a day's cap each, the cooking judged by the host, the feast only on the last evening), spent at the
// stall on its goods (furniture into 가구 창고, a title worn), nothing out of its days; the administrator moves its days
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const C = require('../public/plaza/island-calendar');
const T = require('../public/plaza/island-terrain');

test('수확제: 할 일마다 도장(하루 한도), 요리 심사, 마지막 날 저녁 잔치, 가판대 교환(가구·칭호), 기간 밖은 없음, 관리자 기간 옮기기', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'festival-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter, admin } = await boot(t, dir);
  const a = await enter(await issue('수확하는이'));
  const clock = (s) => req('/api/test/festival/clock', null, { at: Date.parse(`${s}+09:00`) });
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  const F = T.FARM; const P = C.PLACES;
  // out of its days: none, the next one named
  await clock('2026-11-19T12:00:00');
  let v = (await req('/api/island/festival', a)).data; assert.equal(v.festival, null); assert.equal(v.next.id, 'harvest-2026');
  assert.equal((await req('/api/island/festival/harvest', a, {})).data.error, 'NO_FESTIVAL');
  // day 1: three harvests at the field (a vegetable and a stamp each), the fourth no; the cooking by the host (three things)
  await clock('2026-11-20T12:00:00'); await stand({ x: F.x, z: F.z });
  for (let k = 1; k <= 3; k += 1) { const r = await req('/api/island/festival/harvest', a, {}); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.festival.stamps, k); }
  assert.equal((await req('/api/island/festival/harvest', a, {})).data.error, 'TASK_DONE');
  const vegetables = async () => ((await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'harvest') || {}).qty || 0;
  assert.equal(await vegetables(), 3);
  assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })).data.error, 'TOO_FAR');
  await stand(P.host);
  assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'trash', 'harvest'] })).data.error, 'BAD_RECIPE');
  const cooked = await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] }); assert.equal(cooked.status, 200, JSON.stringify(cooked.data));
  assert.ok(cooked.data.score > 0 && cooked.data.say); assert.equal(cooked.data.festival.stamps, 5); assert.equal(await vegetables(), 0);
  assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })).data.error, 'TASK_DONE');
  // the feast only on the last day's evening
  await stand(P.feast); assert.equal((await req('/api/island/festival/feast', a, {})).data.error, 'TASK_CLOSED');
  // day 2: five more -> the title (10)
  await clock('2026-11-21T12:00:00'); await stand({ x: F.x, z: F.z }); for (let k = 0; k < 3; k += 1) await req('/api/island/festival/harvest', a, {});
  await stand(P.host); assert.equal((await req('/api/island/festival/cook', a, { items: ['harvest', 'harvest', 'harvest'] })).data.festival.stamps, 10);
  await stand(P.feast); assert.equal((await req('/api/island/festival/buy', a, { id: 'title_harvest' })).data.error, 'TOO_FAR'); // (the host stands at the stall: from there it is in reach)
  await stand(P.stall); const title = await req('/api/island/festival/buy', a, { id: 'title_harvest' }); assert.equal(title.status, 200, JSON.stringify(title.data)); assert.equal(title.data.festival.stamps, 0);
  assert.equal((await req('/api/island/festival/buy', a, { id: 'title_harvest' })).data.error, 'OWNED');
  assert.ok((await req('/api/skins', a)).data.dexTitles.some((x) => x.id === 'title_event_harvest'));
  assert.equal((await req('/api/skins/title', a, { skinId: 'title_event_harvest' })).data.avatar.title, '풍년');
  assert.equal((await req('/api/island/festival/buy', a, { id: 'straw_sheaf' })).data.error, 'NOT_ENOUGH');
  // the last day's evening: the feast (3) -> the 볏단 into 가구 창고
  await clock('2026-11-26T19:00:00'); await stand(P.feast); const feast = await req('/api/island/festival/feast', a, {}); assert.equal(feast.status, 200, JSON.stringify(feast.data)); assert.equal(feast.data.festival.stamps, 3);
  await stand(P.stall); assert.equal((await req('/api/island/festival/buy', a, { id: 'straw_sheaf' })).status, 200);
  const pieces = (await req('/api/island/furniture/mine', a)).data.pieces; assert.deepEqual(pieces.map((p) => [p.id, p.name, p.model]), [['straw_sheaf__plain', '볏단 장식', 'harvest.straw_sheaf']]);
  // the next day: over (the stamps with it)
  await clock('2026-11-27T09:00:00'); assert.equal((await req('/api/island/festival', a)).data.festival, null);
  // the administrator: its days moved -- on again for those days
  assert.equal((await req('/api/admin/calendar', admin, { override: { 'harvest-2026': { start: '2026-11-27', end: '2026-11-28' } } })).status, 200);
  assert.equal((await req('/api/island/festival', a)).data.festival.id, 'harvest-2026');
  await req('/api/admin/calendar', admin, { override: { 'harvest-2026': { off: true } } }); assert.equal((await req('/api/island/festival', a)).data.festival, null);
});
