const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');
const Together = require('../../lib/island-together');

// B 47 곤충 채집·박물관: with a 잠자리채 on the grass the server sends an insect by; Space while it circles me puts it in
// the bag and the 도감; at the museum's door it is given once for the whole island with my name. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('곤충 채집: 잠자리채로 기다렸다 Space로 잡으면 가방·도감, 광장에서는 안 됨; 박물관 기증은 종류마다 한 번·이름', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '곤충박사', 0, 'male');
  const { page } = a;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const stand = (x, z) => require('./skin-support').standAt(request, a, x, z); // (until page and server agree)
  expect((await post(request, '/api/island/bug/start', a.token, {})).data.error).toBe('NO_BUGNET');
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
  await stand(0, 6); expect((await post(request, '/api/island/bug/start', a.token, {})).data.error).toBe('NOT_BUG_SPOT');
  // grass outside the plaza and the walks, in a summer or autumn zone today (some insect comes there day or night)
  let spot = null;
  for (let k = 0; k < 360 && !spot; k += 7) for (const r of [30, 40, 50]) { const x = Math.cos(k) * r; const z = Math.sin(k) * r; if (T.walkable(x, z) && T.walkDist(x, z) > 3 && T.coastDist(x, z) > 10 && T.streamDist(x, z) > 5 && !T.canFish(x, z) && !T.inTownhall(x, z, 3) && ['summer', 'autumn'].includes(T.seasonAt(x, z, Date.now()))) { spot = { x, z }; break; } }
  await stand(spot.x, spot.z);
  // from the bag's button: the net in hand, the insect comes, Space catches it
  await page.keyboard.press('KeyI'); await page.locator('.islandBagSlot[data-item="bugnet"] button').click();
  await expect(page.locator('.bugCatchBtn')).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => Boolean(window.PlazaDebug().bug()))).toBe(true); // (the net in hand, the insect on its way)
  const finish = page.waitForResponse((r) => r.url().includes('/api/island/bug/finish'));
  await page.keyboard.press('Space');
  const done = await finish; expect(done.status(), await done.text()).toBe(200);
  await expect(page.locator('.bugCatchBtn')).toBeHidden();
  let caught = null; await expect.poll(async () => (caught = (await get(request, '/api/island/bag', a.token)).data.items.find((e) => e.itemId.startsWith('insect_'))) ? true : false, { timeout: 10000 }).toBe(true);
  expect((await get(request, '/api/island/dex', a.token)).data.entries.find((e) => e.id === caught.itemId).count).toBe(1);
  // too early: away
  const early = (await post(request, '/api/island/bug/start', a.token, {})).data; expect((await post(request, '/api/island/bug/finish', a.token, { bugId: early.bugId })).data.error).toBe('BUG_EARLY');
  // 박물관: not away from its door; once per kind, with my name
  expect((await post(request, '/api/island/museum/donate', a.token, { itemId: caught.itemId })).status).toBe(409);
  const door = Together.museumDoor(T.MUSEUM); await stand(door.x, door.z);
  expect((await post(request, '/api/island/museum/donate', a.token, { itemId: 'bugnet' })).status).toBe(400);
  const before = (await get(request, '/api/island/museum', a.token)).data.exhibits.find((x) => x.id === caught.itemId).by; // (the island's museum: an earlier run may have given this kind)
  const given = await post(request, '/api/island/museum/donate', a.token, { itemId: caught.itemId });
  if (before) expect(given.data.error).toBe('ALREADY_SHOWN');
  else { expect(given.status).toBe(200); expect((await get(request, '/api/island/museum', a.token)).data.exhibits.find((x) => x.id === caught.itemId).by).toBe('곤충박사'); }
  expect((await post(request, '/api/island/museum/donate', a.token, { itemId: caught.itemId })).status).toBe(409);
  expect((await get(request, '/api/island/bag', a.token)).data.items.some((e) => e.itemId === caught.itemId)).toBe(Boolean(before));
  await page.keyboard.press('Escape');
  await expectNoScriptError(page);
  await a.context.close();
});
