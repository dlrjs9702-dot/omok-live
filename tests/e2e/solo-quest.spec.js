const { test, expect } = require('@playwright/test');
const { post, get, shopper, expectNoScriptError } = require('./skin-support');

// v1.10.37 혼자 하는 게임 · 연계 퀘스트 · 원거리 플레이어 (사용자 확정 2026-10-06/07). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

async function islandPage(page) {
  await page.setViewportSize({ width: 960, height: 680 });
  await page.evaluate(() => {
    localStorage.removeItem('gc.testClassic');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
}

test('지뢰찾기: 로비 「지뢰찾기」 → 난이도·판, 오른쪽 클릭 깃발, 다 열면 클리어·보상·최고 기록', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '지뢰손님');
  const { page, token } = a;
  await page.locator('#soloMinesBtn').click();
  await expect(page.locator('#minesDialog')).toBeVisible();
  await expect(page.locator('#minesLevels button')).toHaveText(['초급 2,000P', '중급 4,000P', '고급 8,000P']);
  await expect(page.locator('#minesBoard .minesCell')).toHaveCount(81);
  const cell = (i) => page.locator(`#minesBoard .minesCell[data-i="${i}"]`);
  await cell(40).click();
  await expect(cell(40)).toHaveClass(/open/);
  const mines = new Set((await post(request, '/api/test/solo/peek', token, { ageMs: 60000 })).data.mines);
  const mine = [...mines][0];
  await cell(mine).click({ button: 'right' });
  await expect(cell(mine)).toHaveClass(/flag/);
  await expect(page.locator('#minesLeft')).toHaveText('💣 9');
  const before = (await get(request, '/api/points', token)).data.balance;
  for (let i = 0; i < 81; i += 1) {
    if (mines.has(i) || /open/.test(await cell(i).getAttribute('class'))) continue;
    await cell(i).click();
    await expect(cell(i)).toHaveClass(/open/);
    if (/클리어/.test(await page.locator('#minesStatus').textContent())) break;
  }
  await expect(page.locator('#minesStatus')).toContainText('클리어');
  await expect(page.locator('#minesStatus')).toContainText('+2,000P');
  await expect(page.locator('#minesBest')).toContainText('최고');
  expect((await get(request, '/api/points', token)).data.balance).toBe(before + 2000);
  await page.locator('#minesCloseBtn').click();
  await expectNoScriptError(page);
  await a.context.close();
});

test('연계 퀘스트: 할머니 노란 별 → 말 걸기 부탁·추적 줄 → 다 하면 초록 ✓ → 보고 보상, 멀리 있는 사람 이름표는 보인다', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '부탁손님');
  const b = await shopper(browser, request, '멀리손님');
  await islandPage(a.page); await islandPage(b.page);
  const { page, token } = a;
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests()), { timeout: 20000 }).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'questgranny', mark: 'new' })]));
  await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questgranny'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기', { timeout: 10000 });
  await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toBeVisible();
  await expect(page.locator('#plazaDialog')).toContainText('정원사 할머니');
  await expect(page.locator('#plazaDialog')).toContainText('잡초 20포기');
  await page.locator('#plazaDialog .lostRequest button, #plazaDialog button.primary').first().click();
  await expect(page.locator('#questTracker')).toHaveText('정원사 할머니 · 잡초 0/20', { timeout: 10000 });
  await post(request, '/api/test/quest/note', token, { what: 'weed', qty: 20 });
  await expect(page.locator('#questTracker')).toContainText('완료 ✓', { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().find((q) => q.id === 'questgranny').mark), { timeout: 10000 }).toBe('ready');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('+2,000P');
  await expect(page.locator('#plazaDialog')).toContainText('열매 5개');
  // someone far off: the name tag is drawn out of the fog, the chat bubble only near
  await b.page.evaluate(() => window.PlazaDebug().place('climb'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().farSight()), { timeout: 20000 }).toEqual([expect.objectContaining({ tag: true })]);
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});
