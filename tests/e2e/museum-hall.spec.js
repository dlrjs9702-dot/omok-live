const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError, spaceOn } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');
const Together = require('../../lib/island-together');
const M = require('../../public/plaza/island-museum.js');

// v1.10.231 M 박물관 전시관: in at the museum's door; the curator's 「기증해요」 gives the biggest of a fish from my bag -- it
// comes into its tank (on another's screen in the hall too), its plaque its size and my name; an empty slot says so; the
// board by the door counts; out at the hall's door. PC and phone.
test('박물관 전시관: 문으로 들어가 관장에게 기증하면 그 수조에 생기고 명판·빈 칸·안내판, 다른 사람 화면에도', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const a = await shopper(browser, request, isMobile ? '기증왕m' : '기증왕', 0, 'male'); const b = await shopper(browser, request, isMobile ? '구경꾼m' : '구경꾼', 0, 'female');
  for (const who of [a, b]) { await who.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); }
  const { page } = a;
  const fish = isMobile ? 'fish_eel' : 'fish_carp'; const size = Math.round((60 + (Date.now() % 100000) / 10000) * 10) / 10; // (bigger each run: the island's museum keeps the last)
  await post(request, '/api/test/island/give', a.token, { itemId: fish, qty: 1, meta: { size } });
  const door = Together.museumDoor(T.MUSEUM);
  const goIn = async (who) => expect.poll(async () => {
    if (await who.page.evaluate(() => window.PlazaDebug().space) === 'museum') return 'museum';
    await who.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [door.x, door.z]); await who.page.waitForTimeout(500); await spaceOn(who.page, 'museum', isMobile); await who.page.waitForTimeout(800);
    return who.page.evaluate(() => window.PlazaDebug().space);
  }, { timeout: 30000, intervals: [300] }).toBe('museum');
  await goIn(b); await goIn(a);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().museum()?.board || ''), { timeout: 15000 }).toMatch(/전시 \d+\/46/);
  const empty = (await get(request, '/api/island/museum', a.token)).data.exhibits.find((x) => !x.by);
  if (empty) expect((await page.evaluate((id) => window.PlazaDebug().museum().slots[id], empty.id)).plaque).toContain('아직 기증받지 못했어요');
  // the curator: 「기증해요」 -> the fish
  await expect.poll(async () => {
    if (await page.locator('#curatorCard').isVisible()) return true;
    await page.evaluate(([lx, lz]) => { const w = window.IslandMuseum.world(lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [M.TALK.lx, M.TALK.lz]);
    await page.waitForTimeout(400); await spaceOn(page, 'museum:curator', isMobile); await page.waitForTimeout(600);
    return page.locator('#curatorCard').isVisible();
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  await page.locator('#curatorCard button', { hasText: '기증해요' }).click();
  await page.locator('#curatorCard button', { hasText: `${size} cm` }).click();
  const swap = page.getByRole('button', { name: '바꿔 걸기', exact: true }); if (await swap.isVisible().catch(() => false)) await swap.click(); // (a fish an earlier run gave: asked in the card)
  await expect(page.locator('#toast')).toContainText(`${size} cm`, { timeout: 10000 });
  for (const who of [a, b]) { // (b in the hall: the island's event, asked again)
    await expect.poll(() => who.page.evaluate((id) => window.PlazaDebug().museum()?.slots[id], fish), { timeout: 15000 }).toMatchObject({ shown: true });
    expect((await who.page.evaluate((id) => window.PlazaDebug().museum().slots[id], fish)).plaque).toContain(`${size} cm\n${isMobile ? '기증왕m' : '기증왕'}님 기증`);
  }
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-${isMobile ? 'phone' : 'pc'}.png` });
  // out at the hall's door: back by the museum
  await page.keyboard.press('Escape');
  await expect.poll(async () => {
    if (await page.evaluate(() => window.PlazaDebug().space) === 'island') return 'island';
    await page.evaluate(() => { const d = window.PlazaDebug(); const e = d.doors['museum:exit']; d.teleport(e.x, e.z); });
    await page.waitForTimeout(400); await spaceOn(page, 'museum:exit', isMobile); await page.waitForTimeout(800);
    return page.evaluate(() => window.PlazaDebug().space);
  }, { timeout: 30000, intervals: [300] }).toBe('island');
  const at = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z })); expect(Math.hypot(at.x - door.x, at.z - door.z)).toBeLessThan(3);
  await expectNoScriptError(page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});
