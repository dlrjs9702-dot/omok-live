const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');

// 문제 기록 1103 6 (사용자 「실내에서 밖으로 나갈 때 어디서 나갈지 명확하게 딱 보이지가 않아. 푹 파인 공간이 있어서 거기로
// 가면 자동으로 나가는 방향으로」): every way out a doorway -- walked into toward the outside, out on the island; just come
// in, not out again till I have stepped out of it; turned back in it, I stay. The 관공서, the 잡화점, the 박물관, the 구치소
// (looking on) and a house. PC and phone; SHOT_DIR the doorways' photos.
test('문간: 다섯 방 모두 문간으로 걸어가면 밖, 들어오자마자는 안 나감, 문간에서 돌아서면 남음', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 420000 : 300000);
  const who = await shopper(browser, request, isMobile ? '문간m' : '문간', 3000000, 'female'); const { page } = who;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.in', 'third'); if (shots) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const space = () => page.evaluate(() => window.PlazaDebug().space);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap().catch(() => {}); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  const into = async (door, want) => { // (as the doors: a slow runner may not have my place yet)
    for (let k = 0; k < 6 && await space() !== want; k += 1) { await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); }, door); await page.waitForTimeout(600); await press(); await expect.poll(space, { timeout: 8000 }).toBe(want).catch(() => {}); }
    expect(await space()).toBe(want);
  };
  const way = () => page.evaluate(() => window.PlazaDebug().doorway());
  const walk = async (key, ms) => { await page.locator('#plazaStage').focus(); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  const faceOut = (w) => page.evaluate((yaw) => window.PlazaDebug().setCamYaw(yaw + Math.PI), w.yawOut); // (the third person: W walks away from the camera)
  const outBy = async (name) => {
    const w = await way(); expect(w).toBeTruthy();
    await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [w.room.x, w.room.z]); await faceOut(w); await page.waitForTimeout(400);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-doorway-${name}.png` });
    await expect.poll(async () => { if (await space() !== 'island') await walk('KeyW', 900); return space(); }, { timeout: 30000, intervals: [200] }).toBe('island');
  };
  // the 관공서: just in, walked straight back toward the way out -- not out at once; out of the doorway and in again: out
  await into('townhall', 'townhall');
  const lot = (await get(request, '/api/home', who.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', who.token, { lot, roof: 'red' })).status).toBe(200);
  // in the doorway (been out of it first), turned back toward the room and walked: I stay
  { const w = await way(); expect(w).toMatchObject({ id: 'room:exit' });
    await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [w.room.x, w.room.z]); await faceOut(w); await page.waitForTimeout(300); expect((await way()).armed).toBe(true);
    await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [w.mouth.x, w.mouth.z]); await page.waitForTimeout(300);
    await walk('KeyS', 1200); expect(await space()).toBe('townhall'); }
  await outBy('townhall');
  for (const [door, sp] of [['store', 'store'], ['museum', 'museum'], ['jail', 'jail'], [`home:${lot}`, 'home']]) {
    await into(door, sp);
    // just come in (by the way out): walked out toward it, not out -- till I have stepped out of the doorway once
    const w = await way(); if (w.inside) expect(w.armed, sp).toBe(false); // (the 잡화점 comes in past the doorway already)
    await outBy(sp);
  }
  await expectNoScriptError(page);
  await post(request, '/api/test/home/release', who.token, {}).catch(() => {});
  await who.context.close();
});
