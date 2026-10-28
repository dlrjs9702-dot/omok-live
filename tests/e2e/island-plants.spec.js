const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');
const Plants = require('../../lib/island-plants');

// B 45 꽃·나무 심기 (assets 45): a seed from the bag goes into the ground where I stand (not on the plaza), both players see
// it, fertilizer once makes it grow faster; one plant a spot. PC 전용 (the same scene on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('심기: 꽃씨를 심으면 둘 다 보이고, 비료는 한 번, 광장·바로 옆에는 못 심는다', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '정원사', 100000, 'female');
  const b = await shopper(browser, request, '구경꾼', 100000, 'male');
  for (const w of [a, b]) {
    await w.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await w.page.reload();
    await expect.poll(() => w.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  }
  for (const [itemId, qty] of [['seed_flower_pink', 2], ['fertilizer', 2]]) expect((await post(request, '/api/test/island/give', a.token, { itemId, qty })).status).toBe(200);
  // a spot that takes a flower (the server's own rules), and the plaza that does not
  const existing = (await get(request, '/api/island/plants', a.token)).data.plants;
  let spot = null;
  const PC = require('../../public/plaza/island-terrain.js').PLAZA_C || { x: 0, z: 0 }; // (round the plaza, either island)
  for (let k = 0; k < 360 && !spot; k += 5) for (const r of [40, 55, 70]) { const x = PC.x + Math.cos(k) * r; const z = PC.z + Math.sin(k) * r; if (!Plants.refuse('flower', x, z, existing)) { spot = { x, z }; break; } }
  const call = (path, body) => a.page.evaluate(async ([path, body]) => { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': document.body.dataset.session }, body: JSON.stringify({ ...body, requestId: crypto.randomUUID() }) }); return { status: r.status, data: await r.json() }; }, [path, body]);
  const stand = async (x, z) => { await a.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [x, z]); await a.page.waitForTimeout(1500); };
  await stand(PC.x, PC.z + 6); expect((await call('/api/island/plant', { itemId: 'seed_flower_pink' })).status).toBe(409); // the plaza
  await require('./skin-support').standAt(request, a, spot.x, spot.z); // (CI: a long jump the server put back -- again until it holds)
  let planted = null; // (again until the server has me there -- a slow runner sends the move later)
  await expect.poll(async () => (planted = await call('/api/island/plant', { itemId: 'seed_flower_pink' })).status, { timeout: 20000 }).toBe(200);
  expect(planted.status, JSON.stringify(planted.data)).toBe(200); expect(planted.data.plant.stage).toBe(0);
  expect((await call('/api/island/plant', { itemId: 'seed_flower_pink' })).status).toBe(409); // right beside it
  const id = planted.data.plant.id;
  for (const w of [a, b]) await expect.poll(() => w.page.evaluate((id) => window.PlazaDebug().plants().some((p) => p.id === id), id), { timeout: 20000 }).toBe(true);
  expect((await get(request, '/api/island/plants', b.token)).data.plants.find((p) => p.id === id)).toMatchObject({ kind: 'flower', color: 'pink', stage: 0, mine: false });
  // fertilizer from the bag onto the plant by me, once
  await a.page.locator('#islandBagTab').click();
  await a.page.locator('.islandBagSlot[data-item="fertilizer"]').click(); // (v1.10.195: the slot picked, its bubble)
  await a.page.locator('.islandBagSlot[data-item="fertilizer"]').getByRole('menuitem', { name: '비료 주기' }).click();
  await expect(a.page.locator('#toast')).toContainText('비료를 줬어요');
  expect((await get(request, '/api/island/plants', a.token)).data.plants.find((p) => p.id === id).fertilized).toBe(true);
  expect((await call('/api/island/fertilize', { plantId: id })).status).toBe(409);
  await expectNoScriptError(a.page);
  await a.context.close(); await b.context.close();
});
