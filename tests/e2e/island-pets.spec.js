const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// B 47 반려동물: one bought at the 잡화점 walks behind me with its name (Walk while it catches up, Sit when I sit), the
// others see it too; put away, it is gone everywhere. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

// (CI 2차 단축: the second half on its own -- the whole was over three minutes on the CI runner) the server keeps the
// pet: a page coming onto the island has it with me from the start, others see it, and put away it is gone everywhere
test('반려동물: 서버가 기억해 섬에 들어오면 처음부터 같이 있고, 집에 두면 모든 화면에서 사라짐', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '고양이주인', 0, 'female');
  const b = await shopper(browser, request, '이웃', 0, 'male');
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'pet_kitten', qty: 1 })).status).toBe(200);
  expect((await post(request, '/api/island/pet', a.token, { kind: 'kitten', name: '나비' })).status).toBe(200); // (what the bag's button sends)
  for (const w of [a, b]) {
    await w.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await w.page.reload();
    await expect.poll(() => w.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  }
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')?.kind), { timeout: 30000 }).toBe('kitten');
  const aId = await a.page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().find((p) => p.key === id)?.name, aId), { timeout: 30000 }).toBe('나비');
  expect((await post(request, '/api/island/pet', a.token, { kind: null })).status).toBe(200);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().some((p) => p.key === id), aId), { timeout: 30000 }).toBe(false);
  for (const w of [a, b]) await expectNoScriptError(w.page);
  for (const w of [a, b]) await w.context.close();
});
