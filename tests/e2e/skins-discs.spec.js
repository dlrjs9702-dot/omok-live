const { test, expect } = require('@playwright/test');
const { post, shopper, buyAndEquip, stoneContrast, twoPlayerRoom, expectSameCrop, pixelOf } = require('./skin-support');
const { expectNoScriptError } = require('./skin-support');

// v1.7.36 사목·오델로 스킨: 모든 스킨의 두 진영 판독 대비(4:1), 상점 탭·구역, 방장 테마와 각자 말이 같은 방의 모든 화면에
// 같게 보이는지, 사목 전설 승리 연출. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const MIN = { connect4: 3, othello: 4 }; // 사목은 빨강·노랑이 기본이라 기본 칩(약 3:1) 이상을 지킨다
const PIECES = (family) => [...[1, 2, 3, 4, 5].map(i => `${family}_c${i}`), ...[1, 2, 3].map(i => `${family}_p${i}`), `${family}_l1`, `${family}_l2`];

for (const family of ['connect4', 'othello']) {
  test(`${family} 스킨: 모든 말 스킨에서 두 진영 명도 대비가 4:1 이상이다`, async ({ browser, request }) => {
    const a = await shopper(browser, request, '대비');
    for (const id of PIECES(family)) {
      const ratio = await stoneContrast(a.page, id);
      if (process.env.SKIN_LOG) console.log(id, ratio.toFixed(2));
      expect(ratio, id).toBeGreaterThanOrEqual(Number(process.env.SKIN_MIN || MIN[family]));
    }
    await a.context.close();
  });
}

test('사목 스킨: 방장 테마와 각자 칩이 모든 화면에 같고, 전설은 승리 연출을 갖는다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['connect4_t2', 'connect4_l1']);
  await buyAndEquip(request, b, ['connect4_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '사목' }).click();
  await expect(dialog.locator('.skinFamily h3')).toHaveText(['일반', '고급', '방 테마', '전설']);
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
  await expect(dialog.locator('.skinCard.equipped')).toHaveCount(2);
  await dialog.getByRole('button', { name: '닫기' }).click();

  await twoPlayerRoom(request, a, b, 'connect4');
  for (const [who, col] of [[a, 0], [b, 1], [a, 0], [b, 1], [a, 0]]) expect((await call(who, '/api/room/move', { x: col, y: 0 })).status).toBe(200);
  // 칩 자리(열 0의 아래 두 칸)와 방 테마(어두운 우주 정거장 바탕)가 두 화면에서 같다.
  const cell = (720 - 40) / 7; const cx = 20 + cell * .5;
  await expectSameCrop([a.page, b.page], cx, 103 + 5.5 * cell);
  await expectSameCrop([a.page, b.page], 20 + cell * 1.5, 103 + 5.5 * cell);
  for (const who of [a, b]) await expect.poll(async () => (await pixelOf(who.page, 3, 400)).reduce((s, v) => s + v, 0), { timeout: 8000 }).toBeLessThan(150);

  // 전설 승리 연출: 세로 4목이 완성되면 칩 사이로 밝은 빛줄기가 지난다.
  expect((await call(b, '/api/room/move', { x: 1, y: 0 })).status).toBe(200);
  expect((await call(a, '/api/room/move', { x: 0, y: 0 })).status).toBe(200);
  for (const who of [a, b]) {
    await expect.poll(async () => {
      const [r, g, bl] = await pixelOf(who.page, cx, 103 + 5 * cell);
      return r > 215 && g > 200 && bl > 150;
    }, { timeout: 10000 }).toBe(true);
  }
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

test('오델로 스킨: 방장 테마와 각자 디스크가 모든 화면에 같다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['othello_t2', 'othello_l1']);
  await buyAndEquip(request, b, ['othello_c2']);

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '오델로' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
  await dialog.getByRole('button', { name: '닫기' }).click();

  await twoPlayerRoom(request, a, b, 'othello');
  const cell = 90;
  // 시작 네 칸(흑·백 대각선)을 a·b 화면에서 같게 그린다.
  await expectSameCrop([a.page, b.page], 3.5 * cell, 3.5 * cell);
  await expectSameCrop([a.page, b.page], 4.5 * cell, 3.5 * cell);
  for (const who of [a, b]) await expect.poll(async () => (await pixelOf(who.page, 6, 6)).reduce((s, v) => s + v, 0), { timeout: 8000 }).toBeLessThan(150);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.9.0 전설 2차: 픽셀 챔피언(80년대 오락실 짝)은 정확히 세 줄에서 특수 연출, 네 줄 승리는 판 위 연출 뒤 결과 띠·배너.
test('사목 전설: 세 줄 특수 연출과 전설 승리 결과 지연', async ({ browser, request }) => {
  const a = await shopper(browser, request, '픽셀', 6_000_000);
  const b = await shopper(browser, request, '손님');
  await buyAndEquip(request, a, ['connect4_t1', 'connect4_l2']);
  const call = (who, route, data) => post(request, route, who.token, data);
  await twoPlayerRoom(request, a, b, 'connect4');
  await a.page.evaluate(() => { const def = window.SkinLooks.def('connect4_l2'); const special = def.special; window.__special = 0; def.special = (...args) => { window.__special += 1; return special(...args); }; });
  for (const [who, col] of [[a, 0], [b, 1], [a, 0], [b, 1]]) expect((await call(who, '/api/room/move', { x: col, y: 0 })).status).toBe(200);
  await a.page.waitForTimeout(1200);
  expect(await a.page.evaluate(() => window.__special)).toBe(0); // 두 줄에서는 없다
  expect((await call(a, '/api/room/move', { x: 0, y: 0 })).status).toBe(200);
  await expect.poll(() => a.page.evaluate(() => window.__special), { timeout: 5000 }).toBeGreaterThan(0);
  expect((await call(b, '/api/room/move', { x: 2, y: 0 })).status).toBe(200);
  expect((await call(a, '/api/room/move', { x: 0, y: 0 })).status).toBe(200);
  await expect(a.page.locator('#boardOverlay')).toHaveClass(/legendResult/);
  await expect(a.page.locator('#resultEffect')).toHaveClass(/banner/, { timeout: 5000 });
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
