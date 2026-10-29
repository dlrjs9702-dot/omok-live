const { test, expect } = require('@playwright/test');
const { shopper, post, uniqueIp, expectNoScriptError } = require('./skin-support');

// Q2 (gamecenter-notes docs/interact-quests-20261029.md 3, 사용자 「내 할 일이 지금 3가지만 출력되고 있는데 나머지 전체를 조회할 수
// 있는 칸」): four asks -- the card three lines and 「+1개 더 · 전체 보기」, the window 「내 할 일」 all four (grouped); one
// dropped there -- the card and the window both one less. The story's line by the islander's name (사용자 「할 일에
// 오탐정이라고 나와」: 누리). 사용자 「채팅 아이콘이 커지면서 메신저와 살짝 겹치고 있어. 색만 바뀌게」: someone's chat -- the
// 「채팅」 tab the same size, clear of 「메신저」, another colour; opened, its own again. PC and phone.
test('할 일 전체 보기·카드 이름·채팅 단추 색만', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const a = await shopper(browser, request, isMobile ? '할일많음m' : '할일많음', 0, 'female'); const { page, token } = a;
  const b = await shopper(browser, request, isMobile ? '말거는이m' : '말거는이', 0, 'male');
  for (const p of [page, b.page]) { await p.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }); await p.reload(); }
  for (const p of [page, b.page]) await expect.poll(() => p.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  page.on('dialog', (d) => d.accept());
  // four asks: the card three and the rest behind a line
  const Q = require('../../lib/island-quests'); const n = (await post(request, '/api/test/quest/take', token, { stories: Q.visibleStories(Date.now()) })).data.track.length; expect(n).toBeGreaterThanOrEqual(4); // (this week's asks, all taken)
  const card = page.locator('#questTracker');
  await expect.poll(async () => { await page.evaluate(() => window.PlazaWarp(window.PlazaDebug().x + 0.5, window.PlazaDebug().z)); return card.locator('.questLine').count(); }, { timeout: 30000 }).toBe(3);
  await expect(card.locator('.questMore')).toHaveText(`+${n - 3}개 더 · 전체 보기`);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-quest-more.png` });
  await card.locator('.questMore').click();
  const list = page.locator('#questListCard'); await expect(list.locator('.questLine')).toHaveCount(n); await expect(list.locator('h4')).toHaveText(['주민 부탁']);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-quest-list.png` });
  // one dropped in the window: both one less
  const last = list.locator('.questLine').last(); const key = await last.getAttribute('data-key'); await last.click();
  await list.getByRole('button', { name: '그만둘래요' }).click();
  await expect(list.locator('.questLine')).toHaveCount(n - 1); await expect(list.locator(`.questLine[data-key="${key}"]`)).toHaveCount(0);
  await page.locator('#plazaCloseBtn').click();
  await expect(card.locator('.questLine')).toHaveCount(3); await expect(card.locator('.questMore')).toHaveCount(n - 1 > 3 ? 1 : 0);
  // the story's line: 누리 (her name, not 「오 탐정」)
  await post(request, '/api/test/story', token, { doc: { chapters: {}, cur: { n: 5, c: 0 } } }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await expect(card.locator('.questLine b', { hasText: '누리' })).toHaveCount(1, { timeout: 30000 }); await expect(card).not.toContainText('오 탐정');
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-quest-name.png` });
  // someone's chat: the tab the same size, clear of 「메신저」, another colour; opened, its own colour again
  await page.evaluate(() => document.getElementById('islandMessengerTab').classList.remove('hidden'));
  const tab = page.locator('#islandChatTab'); const before = await tab.boundingBox(); const colour = () => tab.evaluate((el) => getComputedStyle(el).backgroundColor); const plain = await colour();
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-chat-tab-plain.png` });
  await expect.poll(async () => { await request.post('/api/lobby/chat', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': b.token }, data: { text: '안녕하세요' } }); await page.waitForTimeout(1500); return tab.evaluate((el) => el.classList.contains('unread')); }, { timeout: 30000 }).toBe(true);
  const after = await tab.boundingBox(); expect([Math.round(after.width), Math.round(after.height)]).toEqual([Math.round(before.width), Math.round(before.height)]);
  const messenger = await page.locator('#islandMessengerTab').boundingBox(); expect(after.x + after.width).toBeLessThanOrEqual(messenger.x);
  expect(await colour()).not.toBe(plain);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-chat-tab-new.png` });
  await tab.click(); await expect(page.locator('#islandChatPanel')).toBeVisible(); await expect(tab).not.toHaveClass(/unread/);
  await page.mouse.move(2, 2); await expect.poll(colour).toBe(plain); // (the pointer off it: not its hover colour)
  await expectNoScriptError(page); await a.context.close(); await b.context.close();
});
