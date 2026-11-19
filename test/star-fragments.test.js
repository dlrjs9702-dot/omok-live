'use strict';
// 366 별똥별 소원 → 별 조각 (notes docs/star-wish-20261118.md): the items (merchant 3,000 / 30,000, never the 잡화점), the shiny one
// fixed per account and star (10 % by default), the four star furniture recipes; a wish the next day gives a fragment once, and a
// wish made before the switch still gives 300P
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Items = require('../lib/island-items');
const Stars = require('../lib/island-stars');
const Farm = require('../public/plaza/island-farm');
const Furn = require('../public/plaza/island-furniture');
const Home = require('../public/plaza/island-home');
const Yard = require('../public/plaza/island-yard');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');

test('별 조각: 상인 값·잡화점 안 팖, 반짝이는 확률은 계정·별마다 고정 약 10 %, 별 가구 4가지 틀과 자리', () => {
  assert.equal(Items.ITEMS.star_fragment.price, 3000); assert.equal(Items.ITEMS.star_fragment_shiny.price, 30000);
  for (const id of ['star_fragment', 'star_fragment_shiny']) { assert.equal(Items.ITEMS[id].at, 'merchant'); assert.ok(!Items.ITEMS[id].shop, `${id}: 잡화점에서 안 팖`); }
  let n = 0; for (let s = 0; s < 5000; s += 1) if (Stars.shinyOf('acc', s, 10)) n += 1; assert.ok(n > 400 && n < 600, `${n}/5000`);
  assert.equal(Stars.shinyOf('acc', 7, 10), Stars.shinyOf('acc', 7, 10)); assert.equal(Stars.shinyOf('acc', 7, 0), false); assert.equal(Stars.shinyOf('acc', 7, 100), true);
  assert.deepEqual(Farm.CRAFTS.star_lamp.takes, { star_fragment: 5 }); assert.deepEqual(Farm.CRAFTS.star_mobile.takes, { star_fragment: 8 });
  assert.deepEqual(Farm.CRAFTS.star_rug.takes, { star_fragment: 10, star_fragment_shiny: 1 }); assert.deepEqual(Farm.CRAFTS.star_ornament.takes, { star_fragment: 6, star_fragment_shiny: 1 });
  for (const k of ['star_lamp', 'star_mobile', 'star_rug', 'star_ornament']) assert.ok(Furn.good(Farm.CRAFTS[k].good), `${k}: 가구로 있음`);
  assert.ok(!Furn.YARD_GOODS.some((g) => g.yardShape === 'star_ornament'), '마당 별 장식은 상점에 없음'); assert.ok(Furn.good('yard_star_ornament__plain').yard);
  assert.deepEqual(Home.SIZE.star_rug, [2, 1.4, 0.04]); assert.ok(Yard.ITEMS.star_ornament.glow);
});

test('별똥별 반짝이 이벤트(369 검토 #3): 그 별이 떨어질 때 열린 잡기 이벤트가 반짝이는 조각 확률을 올림, 밖이면 그대로', () => {
  const ev = [{ id: 'e1', kind: 'catch', target: 'star', mult: 2, startAt: 1000, endAt: 5000 }];
  assert.equal(Stars.shinyPctAt(10, ev, 2000), 20); assert.equal(Stars.shinyPctAt(10, ev, 6000), 10, '이벤트 밖'); assert.equal(Stars.shinyPctAt(10, [], 2000), 10);
  assert.equal(Stars.shinyPctAt(10, [{ ...ev[0], target: 'pick' }], 2000), 10, '다른 대상');
  const closed = [{ ...ev[0], closedAt: 3000 }]; assert.equal(Stars.shinyPctAt(10, closed, 2000), 20, '일찍 끝낸 이벤트도 그동안 떨어진 별에는'); assert.equal(Stars.shinyPctAt(10, closed, 3500), 10, '끝낸 뒤는 아님');
  assert.equal(Stars.shinyPctAt(10, [{ ...ev[0], closedAt: 9000 }], 7000), 10, '끝날 시각 뒤에 늦게 끝내도 늘어나지 않음 (370)');
  // over many accounts the shiny share follows it
  let n = 0; for (let s = 0; s < 4000; s += 1) if (Stars.shinyOf(`acc${s}`, 7, Stars.shinyPctAt(10, ev, 2000))) n += 1; assert.ok(n > 650 && n < 950, `${n}/4000`);
});

test('소원: 다음 날 별 조각 한 번(다시 봐도 더 안 줌), 바꾸기 전에 빈 소원은 300P', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'star-frag-')); rmAtExit(dir);
  let server = await boot(t, dir); let { req } = server;
  const keyA = await server.issue('소원A'); const keyB = await server.issue('소원B');
  let a = await server.enter(keyA); let b = await server.enter(keyB);
  for (const s of [a, b]) await req('/api/plaza/state', s, { x: 0, z: -80, yaw: 0, moving: false });
  const star = (await req('/api/test/island/star-now', a, {})).data.id; assert.match(star, /^star_\d+$/);
  for (const s of [a, b]) assert.equal((await req('/api/island/stars/wish', s, { id: star })).status, 200);
  // A: the next day (36 h on) -- a fragment, once
  await req('/api/test/island/star-now', a, { plusMs: 36 * 3600000 });
  /* (Codex 361~370 #5: the old claim's record not read -- held, nothing paid under a new claim; the next look pays it) */
  await req('/api/test/store/fail', null, { method: 'settlementOf' }); const held = (await req('/api/island/stars', a)).data; assert.deepEqual(held.fragments, [], '읽지 못하면 보류');
  const got = (await req('/api/island/stars', a)).data; assert.equal(got.gift, 0); assert.equal(got.fragments.length, 1); assert.equal(got.fragments[0].n, 1);
  const bag = (await req('/api/island/bag', a)).data.items; assert.equal(bag.filter((e) => /^star_fragment/.test(e.itemId)).reduce((n, e) => n + e.qty, 0), 1);
  assert.deepEqual((await req('/api/island/stars', a)).data.fragments, [], '한 번만');
  // B wished before the switch: the switch moved after the star (as if B's wish came before the release) -- 300P
  await server.stop(); const file = path.join(dir, 'points.json'); const data = JSON.parse(await fs.readFile(file, 'utf8'));
  /* (Codex 361~370 #7: the wish's shiny chance kept with it -- the default 10 % here) */
  const bDoc = Object.entries(data.quests || {}).find(([k, d]) => k.endsWith('|stars') && (d.wished || []).includes(star))?.[1]; assert.equal(bDoc?.pct?.[star], 10, JSON.stringify(bDoc));
  data.island.world.starsFragmentFrom = { at: Date.now() + 10 * 86400000 }; await fs.writeFile(file, JSON.stringify(data));
  server = await boot(t, dir); ({ req } = server); b = await server.enter(keyB);
  await req('/api/test/island/star-now', b, { plusMs: 36 * 3600000 });
  const old = (await req('/api/island/stars', b)).data; assert.equal(old.gift, 300); assert.deepEqual(old.fragments, []);
});

// 369 검토 P1: the fragment's claim was `star_gift_<slot>` for everyone -- only the first wisher of a star got one. Each account its own
// claim now; one paid under the old one is not paid again
test('소원 별 조각: 같은 별에 빈 두 계정이 둘 다 받고, 옛 claim으로 이미 받은 계정은 다시 안 받음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'star-frag2-')); rmAtExit(dir);
  let server = await boot(t, dir); let { req } = server;
  const keys = [await server.issue('별둘A'), await server.issue('별둘B'), await server.issue('별둘C')];
  let [a, b, c] = await Promise.all(keys.map((k) => server.enter(k)));
  for (const s of [a, b, c]) await req('/api/plaza/state', s, { x: 0, z: -80, yaw: 0, moving: false });
  const star = (await req('/api/test/island/star-now', a, {})).data.id; const slot = Stars.slotOfId(star);
  for (const s of [a, b, c]) assert.equal((await req('/api/island/stars/wish', s, { id: star })).status, 200);
  // C as paid under the old claim (before this fix): its record under `island_give:star_gift_<slot>`
  await server.stop(); const file = path.join(dir, 'points.json'); const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const wishers = Object.keys(data.quests || {}).filter((k) => k.endsWith('|stars')).map((k) => k.slice(0, -'|stars'.length)); assert.equal(wishers.length, 3, '셋이 빔');
  const cId = wishers[2]; /* (one of the three, paid under the old claim) */
  data.settlements[`island_give:star_gift_${slot}`] = { kind: 'island_give', settlementId: `island_give:star_gift_${slot}`, at: new Date().toISOString(), userId: cId, itemId: 'star_fragment', qty: 1 };
  await fs.writeFile(file, JSON.stringify(data));
  server = await boot(t, dir); ({ req } = server); [a, b, c] = await Promise.all(keys.map((k) => server.enter(k)));
  await req('/api/test/island/star-now', a, { plusMs: 36 * 3600000 });
  const fragsOf = async (s) => ((await req('/api/island/stars', s)).data.fragments || []).reduce((n, f) => n + f.n, 0);
  const got = []; for (const s of [a, b, c]) got.push(await fragsOf(s));
  const bagFrags = async (s) => ((await req('/api/island/bag', s)).data.items || []).filter((e) => /^star_fragment/.test(e.itemId)).reduce((n, e) => n + e.qty, 0);
  const inBags = []; for (const s of [a, b, c]) inBags.push(await bagFrags(s));
  // the one paid under the old claim (whichever of the three it is) has none now; the other two one each
  assert.equal(got.reduce((x, y) => x + y, 0), 2, `새로 받은 수 ${got}`); assert.equal(inBags.filter((n) => n === 1).length, 2, `가방 ${inBags}`);
  for (const s of [a, b, c]) assert.equal(await fragsOf(s), 0, '다시 봐도 더 안 줌');
  // (369 검토 #4: a paid wish off the doc -- a look every 60 s asks the store for none of them again)
  await server.stop(); const after = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const [k, d] of Object.entries(after.quests || {})) if (k.endsWith('|stars')) assert.ok(!(d.wished || []).includes(star), `${k.slice(0, 6)}… 받은 소원은 목록에서 빠짐`);
});
