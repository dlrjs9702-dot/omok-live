'use strict';
// v1.10.228 물결에게 팔기 (사용자 「팔 수 없다」, 총괄 2026-11-02): with the roster on 물결 is seldom at the harbour -- a day at
// the 1층's counter, a day walking. Selling fish to him is where a talk with him is (questTalkPos): by him on his walk, at the
// counter on his counter day; far from him, TOO_FAR.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const R = require('../public/plaza/island-roster');
const N = require('../public/plaza/island-npcs');
const Calendar = require('../public/plaza/island-calendar');
const Store = require('../public/plaza/island-store');
const Quests = require('../lib/island-quests');

test('물결에게 팔기: 계산대 날은 1층 계산대에서, 걷는 날은 물결 옆에서, 멀면 TOO_FAR', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fisher-sell-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req: send, issue, enter, logs } = await boot(t, dir);
  // (CI 2026-11-02: one request of the walking loop came back 'fetch failed' with nothing in the server's log -- a kept-alive
  // socket closed as it was reused; once more, and the server's log if it is really gone)
  const req = async (...args) => { try { return await send(...args); } catch (error) { await new Promise((r) => { setTimeout(r, 300); }); try { return await send(...args); } catch (again) { throw new Error(`${again.message} (${again.cause?.code || ''})
${logs().slice(-3000)}`); } } };
  const a = await enter(await issue('물결손님'));
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  const sell = async (k) => { await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 1 }); return req('/api/island/sell', a, { place: 'fisher', requestId: `fisher-sell-${k}-0000` }); };
  // a counter day: at the 1층's counter, not at the harbour
  let day = Calendar.dayOf(Date.now());
  for (let k = 0; k < 200 && R.rosterOf(day).posts.mall1 !== 11; k += 1) day = Calendar.addDays(day, 1);
  assert.equal(R.rosterOf(day).posts.mall1, 11, day);
  await req('/api/test/roster', a, { on: true, day });
  await stand(Quests.STORIES.fisher.at); assert.equal((await sell('a')).data.error, 'TOO_FAR', '항구에는 없음');
  await stand(T.facilityDoor('store')); assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  await stand(Store.sectorPoint('mall:store'));
  const atCounter = await sell('b'); assert.equal(atCounter.status, 200, JSON.stringify(atCounter.data)); assert.ok(atCounter.data.paid > 0);
  await stand(Store.world(Store.ROOM.exit.lx, Store.ROOM.exit.lz)); assert.equal((await req('/api/island/store/leave', a, {})).status, 200);
  // a walking day: by him where he walks
  day = Calendar.dayOf(Date.now());
  for (let k = 0; k < 200 && !R.walks(11, day); k += 1) day = Calendar.addDays(day, 1);
  assert.ok(R.walks(11, day), day);
  await req('/api/test/roster', a, { on: true, day });
  const him = async () => N.residentAt(11, Date.now(), (await req('/api/island/resident/bye', a, { n: -1 })).data.residents?.[11] || null);
  let byHim = null; for (let i = 0; i < 20 && byHim?.status !== 200; i += 1) { await stand(await him()); byHim = await sell(`c${i}`); if (byHim.status !== 200) await new Promise((r) => { setTimeout(r, 250); }); }
  assert.equal(byHim.status, 200, JSON.stringify(byHim.data));
  const there = await him(); await stand({ x: there.x + 30, z: there.z }); assert.equal((await sell('d')).data.error, 'TOO_FAR', '멀리서');
  // the roster off (as before): at the harbour
  await req('/api/test/roster', a, { on: false });
  await stand(Quests.STORIES.fisher.at); assert.equal((await sell('e')).status, 200);
});
