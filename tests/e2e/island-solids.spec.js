const { test, expect } = require('@playwright/test');
const { shopper } = require('./skin-support');

// A-7 작은 버그 (사용자 2026-10-19 「관공서 마당 가운데·정문 밖에 아무것도 없는데 지나갈 수 없어」「마녀 항아리·호박을 뚫고
// 지나가」): what is shown is what blocks -- the contest winner's plinth only with a winner, the librarian's book cart only
// while it is out, October's decorations whenever they are out (by day too).
test('보이는 것만 막는다: 대회 동상 받침대·책 수레·할로윈 장식(낮에도)', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '벽찾기', 0, 'male'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }); // (the stand-ins: quick)
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const d = (fn, arg) => page.evaluate(fn, arg);
  // the plinth and the cart: blocking exactly when they are there
  const cs = await d(() => window.IslandTerrain.CONTEST_STATUE);
  await expect.poll(() => d(() => window.PlazaDebug().contestPlinth() === window.PlazaDebug().blocksAt(window.IslandTerrain.CONTEST_STATUE.x, window.IslandTerrain.CONTEST_STATUE.z))).toBe(true);
  const cart = await d(() => window.IslandTerrain.VILLAGE.bookcart);
  await d(() => window.PlazaDebug().village({ books: false }));
  expect(await d(([x, z]) => window.PlazaDebug().blocksAt(x, z), [cart.x, cart.z])).toBe(false);
  await d(() => window.PlazaDebug().village({ books: true }));
  expect(await d(([x, z]) => window.PlazaDebug().blocksAt(x, z), [cart.x, cart.z])).toBe(true);
  // October's decorations by day: out -> in the way; off -> not
  await d(() => window.PlazaDebug().setTime('day'));
  const hw = await d(() => window.PlazaDebug().hwAt());
  expect(hw).not.toBe(null);
  await d(() => window.PlazaDebug().halloween.set(true));
  await expect.poll(() => d(([x, z]) => window.PlazaDebug().blocksAt(x, z), [hw.x, hw.z])).toBe(true);
  await d(() => window.PlazaDebug().halloween.set(false));
  await expect.poll(() => d(([x, z]) => window.PlazaDebug().blocksAt(x, z), [hw.x, hw.z])).toBe(false);
  await who.context.close();
});
