const { test, expect } = require('@playwright/test');
const { get, shopper, expectNoScriptError } = require('./skin-support');

// v1.10.68 순발력 게임 (한판마당 자료): 싱글게임 → 「순발력 게임」 → 다섯 게임 목록 → 반응속도 다섯 라운드를 실제로 하고
// 결과·포인트, 판 중간에 그만두면 보고하지 않음, 나가면 아일랜드로. PC(마우스·Esc)와 휴대폰(터치) 모두.
test('순발력 게임: 목록 → 반응속도 완주 → 결과·+1,500P → 나가기', async ({ browser, request, isMobile }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '번개손');
  const { page, token } = a;
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloReflexBtn').click();
  await expect(page.locator('#reflexView')).toBeVisible();
  await expect(page.locator('.reflexCard strong')).toHaveText(['두더지 잡기', '반응속도', '다른 색 찾기', '숫자 터치', '비트 탭']);
  await expect(page.locator('.reflexToday')).toHaveText('오늘 받은 포인트 0P / 20,000P');

  // a round left in the middle: back to the game, nothing reported
  await page.locator('.reflexCard', { hasText: '두더지 잡기' }).click();
  await expect(page.locator('.reflexLevel')).toHaveText(['쉬움 · 1,000P', '보통 · 1,500P', '어려움 · 2,000P']);
  await page.locator('.reflexGo').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#reflexQuitBtn').click();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('.reflexGo')).toBeVisible();
  await page.locator('.reflexHead button', { hasText: '목록' }).click();

  const before = (await get(request, '/api/points', token)).data.balance;
  await page.locator('.reflexCard', { hasText: '반응속도' }).click();
  await page.locator('.reflexGo').click();
  const stage = page.locator('#stage');
  const green = () => page.evaluate(() => { // the screen turns green: tap now
    const c = document.getElementById('stage');
    const [r, g] = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.85), 1, 1).data;
    return g > 150 && r < 120;
  });
  for (let round = 0; round < 5; round += 1) {
    await expect.poll(green, { timeout: 10000, intervals: [50] }).toBe(true);
    await page.waitForTimeout(150); // under 90 ms the game takes a tap as a guess (a false start)
    await stage.click();
    await page.waitForTimeout(400); // the number shows before the next tap goes on
    await stage.click();
  }
  await expect(page.locator('#reflexResult')).toBeVisible();
  await expect(page.locator('.reflexScore')).toHaveText(/^\d+ms$/);
  await expect(page.locator('.reflexPaid')).toContainText('+1,500P');
  expect((await get(request, '/api/points', token)).data.balance).toBe(before + 1500);

  await page.locator('.reflexActions button', { hasText: '다른 게임' }).click();
  await expect(page.locator('.reflexToday')).toHaveText('오늘 받은 포인트 1,500P / 20,000P');
  if (isMobile) await page.locator('.reflexHead button', { hasText: '나가기' }).click();
  else await page.keyboard.press('Escape');
  await expect(page.locator('#reflexView')).toBeHidden();
  await expectNoScriptError(page);
  await a.context.close();
});
