const { test, expect } = require('@playwright/test');
const { shopper, get, expectNoScriptError } = require('./skin-support');

// H1 한판마당 혼자 퍼즐 (notes docs/hanpanmadang-share-20261112.md, 결정 9A · 58): the four played for a score open from their game hall cards
// (the 점수 퍼즐 set), each round opened by the server; 불빛 채우기 in reflex.spec's 퍼즐 test. PC and phone.
test('H1 점수 퍼즐: 숫자 밀기 · 블록 퍼즐 · 사과 게임 · 수박 만들기 -- 게임관 카드, 서버가 판을 열고, 화면이 돌아감', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '점수퍼즐'); const { page, token } = a;
  const cards = await page.evaluate(() => window.GamehallCatalog.GAMES.filter((g) => g.set === 'scored').map((g) => [g.id, g.name]));
  expect(cards).toEqual([['slide', '숫자 밀기'], ['blockpuzzle', '블록 퍼즐'], ['apple10', '사과 게임'], ['watermelon', '수박 만들기']]);
  const records = (await get(request, '/api/solo/reflex', token)).data.records; for (const [id] of cards) expect(records).toHaveProperty(id);
  for (const [id] of cards) {
    const started = page.waitForResponse((r) => r.url().endsWith('/api/solo/reflex/start') && r.request().method() === 'POST');
    await page.evaluate((g) => { window.GameLaunch.play(g); }, id);
    expect((await started).status(), id).toBe(200);
    await expect(page.locator('#reflexView .reflexFrame.playing'), id).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500); // (a moment of its frames: a script error would show)
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-h1-${id}.png` });
    await expectNoScriptError(page);
    await page.locator('#reflexQuitBtn').click(); await expect(page.locator('#reflexView .reflexFrame.playing')).toBeHidden();
  }
  await a.context.close();
});
