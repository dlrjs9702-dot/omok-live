const { test, expect } = require('@playwright/test');
const { shopper, post, get, intoMall, standAt, expectNoScriptError } = require('./skin-support');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// v1.10.226 가구 리폼 (gamecenter-notes docs/furniture-reform-20261102.md): a sofa placed in my house, a guest inside; at the
// 3층 counter 「가구 리폼」 -- my pieces (「놓임」), the sofa's colours (「지금」 not to be chosen), 「바꾸기 · 3,000P」; the guest
// sees the new colour at once, in the same place and turn. PC and phone; SHOT_DIR photos (the real models only then).
test('가구 리폼: 3층 계산대 → 놓인 소파 색 바꾸기 → 집 안 손님 화면도 바로 바뀜', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  const tag = isMobile ? 'm' : 'p';
  expect((await request.post('/api/test/roster', { data: { on: true } })).ok()).toBe(true); // (the counter's keeper: the roster is off on the test server)
  const a = await shopper(browser, request, `리폼주인${tag}`, 100000, 'female'); const { page } = a;
  const b = await shopper(browser, request, `리폼손님${tag}`, 0, 'male');
  const real = Boolean(process.env.SHOT_DIR);
  for (const who of [a, b]) { await who.page.evaluate((real) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); if (real) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, real); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); }
  const press = async (p = page) => { if (isMobile) await p.locator('#plazaHint').tap(); else { await p.locator('#plazaStage').focus(); await p.keyboard.press('Space'); } };
  const shot = async (name, p = page, wait = 1500) => { if (!process.env.SHOT_DIR) return; await p.waitForTimeout(wait); await p.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const goTo = async (p, door, text) => expect.poll(async () => { await p.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); }, door); await p.waitForTimeout(500); return p.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain(text);
  const through = async (p, door, text, space) => {
    for (let tries = 0; tries < 4 && await p.evaluate(() => window.PlazaDebug().space) !== space; tries += 1) {
      if (await p.locator('#plazaDialog').isVisible()) await p.locator('#plazaCloseBtn').click();
      await goTo(p, door, text); if (await p.evaluate(() => window.PlazaDebug().space) === space) break;
      await press(p); await expect.poll(() => p.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe(space).catch(() => {});
    }
    expect(await p.evaluate(() => window.PlazaDebug().space)).toBe(space);
  };
  let lot = null;
  try {
    // a house (the 민원실), the sofa in it, turned
    { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); } // (both start at the same spot: round them first)
    await through(page, 'townhall', '관공서 들어가기', 'townhall');
    lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
    expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'green' })).status).toBe(200);
    await through(page, 'room:exit', '나가기', 'island');
    const [sofa] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['sofa__mint'] })).data.pieces;
    await through(page, `home:${lot}`, '내 집 들어가기', 'home');
    expect((await post(request, '/api/home/place', a.token, { uid: sofa.uid, x: 0, z: 1, rot: 1 })).status).toBe(200);
    await through(page, 'home:exit', '나가기', 'island'); await through(page, `home:${lot}`, '내 집 들어가기', 'home'); // (in again: the room as it is now)
    await expect.poll(() => page.evaluate((uid) => window.PlazaDebug().home()?.ids[uid], sofa.uid), { timeout: 15000 }).toBe('sofa__mint');
    await shot('reform-before');
    await through(page, 'home:exit', '나가기', 'island');
    // the guest in, the mint sofa there
    await through(b.page, `home:${lot}`, '집 구경하기', 'home');
    await expect.poll(() => b.page.evaluate((uid) => window.PlazaDebug().home()?.ids[uid], sofa.uid), { timeout: 15000 }).toBe('sofa__mint');
    // the 3층 counter: 「가구 리폼」 -- the sofa (placed), its colours, navy
    await intoMall(page, null, isMobile);
    await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('승강기');
    await press(); await page.locator('#liftCard button[data-floor="3"]').click();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('furniture');
    // (by the counter: SPACE talks to its keeper -- 「가구 리폼」 there)
    await expect.poll(async () => { if (await page.locator('#plazaDialog .reformOpen').isVisible()) return true; await page.evaluate(() => { const F = window.IslandFurniture; const w = F.world(F.CHECKOUT.lx, F.CHECKOUT.lz - 1); window.PlazaDebug().teleport(w.x, w.z); }); await page.waitForTimeout(600); await press(); await page.waitForTimeout(800); return page.locator('#plazaDialog .reformOpen').isVisible(); }, { timeout: 30000 }).toBe(true);
    await page.locator('#plazaDialog .reformOpen').click();
    const box = page.locator('#reformBox'); await expect(box).toBeVisible();
    const item = box.locator(`.furniturePiece[data-uid="${sofa.uid}"]`); await expect(item).toContainText('놓임'); await item.click();
    await expect(box.locator('.reformColors button')).toHaveCount(4); await expect(box.locator('.reformColors button[data-to="sofa__mint"]')).toBeDisabled();
    await box.locator('.reformColors button[data-to="sofa__navy"]').click(); await expect(box.locator('.reformGo')).toBeEnabled();
    await expect(box.locator('[role="status"]')).toContainText('남색');
    await shot('reform-window', page, 1200);
    const before = (await get(request, '/api/points', a.token)).data.balance;
    await box.locator('.reformGo').click();
    await expect.poll(async () => (await get(request, '/api/island/furniture/mine', a.token)).data.pieces.find((p) => p.uid === sofa.uid).id, { timeout: 15000 }).toBe('sofa__navy');
    expect((await get(request, '/api/points', a.token)).data.balance).toBe(before - 3000);
    await expect(box.locator('.reformColors button[data-to="sofa__navy"]')).toBeDisabled(); // (now 「지금」)
    // the guest's room: navy at once, the same place and turn
    await expect.poll(() => b.page.evaluate((uid) => window.PlazaDebug().home()?.ids[uid], sofa.uid), { timeout: 15000 }).toBe('sofa__navy');
    expect((await get(request, '/api/home', a.token)).data.mine.pieces.find((p) => p.uid === sofa.uid)).toMatchObject({ x: 0, z: 1, rot: 1 });
    await shot('reform-after', b.page);
    await page.locator('#plazaCloseBtn').click();
  } finally { if (lot) await post(request, '/api/test/home/release', a.token, {}).catch(() => {}); await request.post('/api/test/roster', { data: { on: false } }).catch(() => {}); }
  await expectNoScriptError(page); await expectNoScriptError(b.page); await a.context.close(); await b.context.close();
});
