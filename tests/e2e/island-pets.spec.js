const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// B 47 반려동물: one bought at the 잡화점 walks behind me with its name (Walk while it catches up, Sit when I sit), the
// others see it too; put away, it is gone everywhere. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('반려동물: 가방에서 데리고 다니면 이름과 함께 따라오고 다른 화면에도 보임, 집에 두면 사라짐', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '강아지주인', 0, 'female');
  const b = await shopper(browser, request, '구경꾼', 0, 'male');
  for (const w of [a, b]) {
    await w.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await w.page.reload();
    await expect.poll(() => w.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  }
  expect((await post(request, '/api/island/pet', a.token, { kind: 'puppy', name: '바둑이' })).status).toBe(409); // (not in the bag)
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'pet_puppy', qty: 1 })).status).toBe(200);
  // from the bag's button, with a name (v1.10.192: asked on paper)
  await a.page.keyboard.press('KeyI'); await a.page.locator('.islandBagSlot[data-item="pet_puppy"] button').click();
  await expect(a.page.locator('#nameAskDialog')).toBeVisible(); await a.page.locator('#nameAskInput').fill('바둑이');
  const chosen = a.page.waitForResponse((r) => r.url().includes('/api/island/pet')); await a.page.locator('#nameAskOk').click();
  const res = await chosen; expect(res.status(), await res.text()).toBe(200);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')), { timeout: 30000 }).toMatchObject({ kind: 'puppy', name: '바둑이', loaded: true });
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().myId), { timeout: 30000 }).toBeTruthy(); // (CI 2차: the server's join reply first)
  const aId = await a.page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().find((p) => p.key === id), aId), { timeout: 30000 }).toMatchObject({ kind: 'puppy', name: '바둑이', loaded: true });
  // it follows: far, then Walk, then by me
  const stand = (x, z) => require('./skin-support').standAt(request, a, x, z); // (until page and server agree)
  await a.page.bringToFront(); // (a background page's frames are slowed)
  const clips = a.page.evaluate(() => new Promise((done) => { const seen = new Set(); const t0 = performance.now(); const f = () => { seen.add(window.PlazaDebug().pets().find((p) => p.key === 'me')?.clip); if (performance.now() - t0 < 3000) requestAnimationFrame(f); else done([...seen]); }; requestAnimationFrame(f); }));
  await stand(8, 6);
  expect(await clips).toContain('Walk'); // (it walked to catch up)
  await expect.poll(() => a.page.evaluate(() => { const d = window.PlazaDebug(); const p = d.pets().find((q) => q.key === 'me'); return Math.hypot(p.x - d.x, p.z - d.z) < 1.5 && p.clip; }), { timeout: 10000 }).toBe('Idle');
  for (const w of [a, b]) await expectNoScriptError(w.page);
  for (const w of [a, b]) await w.context.close();
});

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
