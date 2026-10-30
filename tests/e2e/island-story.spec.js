const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');

// S1 섬 이야기 (gamecenter-notes docs/island-story-bible-20261027.md 5절): 아는 사이 봄이 offers 1장 (「이야기 들려줘요」 → the
// note with 할게요 / 다음에요), the 할 일 card's line, 대청마당 reached → ✓, back to 봄이 (「다녀왔어요」) → the story note;
// the book from the bag (주민 이야기 1/3 with the note in full, 초승등대 eight cells, 행사 이야기 none yet). PC and phone.
test('섬 이야기: 이야기 부탁 → 할 일 줄 → 곳에 가면 ✓ → 쪽지, 가방의 이야기 책', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 600000 : 300000);
  const who = await shopper(browser, request, isMobile ? '이야기폰' : '이야기손', 200000, 'female'); const { page, token } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const dialog = page.locator('#plazaDialog');
  const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  const talkTo = async (n) => {
    await expect.poll(async () => {
      if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, n); await page.waitForTimeout(700); }
      return talking();
    }, { timeout: 120000, intervals: [300] }).toBe(true);
  };
  const lines = () => require('./skin-support').revealTalk(page);
  const close = async () => { await expect.poll(async () => { if (await talking()) await page.keyboard.press('Escape'); await page.waitForTimeout(400); return talking(); }, { timeout: 20000 }).toBe(false); };
  const shot = async (name) => { if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-${name}-${isMobile ? 'phone' : 'pc'}.png` }); };
  const choices = page.locator('#plazaDialog .talkChoices button');
  // (a day's errand of theirs is asked first -- 「오늘 안에」 on its note: 「다음에요」, then the talk's own choices)
  const skipErrand = async () => { if (await page.locator('#plazaDialog .questNote', { hasText: '오늘 안에' }).count()) { await choices.filter({ hasText: '다음에요' }).click(); await lines(); } };
  // 아는 사이 봄이: 「이야기 들려줘요」 first
  await post(request, '/api/test/affinity', token, { n: 0, delta: 5 });
  await talkTo(0); await lines(); await skipErrand();
  await expect(choices.first()).toHaveText('이야기 들려줘요');
  await choices.first().click(); await lines();
  await expect(page.locator('#plazaDialog .questNote')).toContainText('꽃 이름 맞히기 놀이');
  await expect(page.locator('#plazaDialog .questNote')).toContainText('대청마당');
  await expect(choices).toHaveText(['할게요!', '다음에요']);
  await shot('1offer');
  await choices.first().click(); await lines();
  await close();
  // the 할 일 card: who asked, what, where
  const line = page.locator('#questTracker .questLine', { hasText: '대청마당 꽃 구경하기' });
  await expect(line).toBeVisible(); await expect(line.locator('b')).toHaveText('봄이');
  // (C4 P3-6) a day's errand taken too: its line kept beside the story's
  const asker = Number(Object.entries((await get(request, '/api/island/errands', token)).data.marks).find(([n, m]) => m === 'new' && Number(n) !== 0)[0]);
  await talkTo(asker); await lines(); await expect(choices).toHaveText(['할게요!', '다음에요']); // (the asker asks at once)
  await choices.first().click(); await lines(); await close();
  await expect(page.locator('#questTracker .questLine')).toHaveCount(2); await expect(page.locator('#questTracker .questLine', { hasText: '심부름' })).toBeVisible();
  await shot('2track');
  // 대청마당: ✓ 돌아가 말해요
  await page.evaluate(async () => { const P = window.IslandTerrain.AREAS.plaza; await window.PlazaWarp(P.x + 4, P.z + 6); });
  await expect(page.locator('#questTracker .questLine.ready', { hasText: '돌아가 말해요' })).toBeVisible({ timeout: 30000 });
  // back to 봄이: 「다녀왔어요」 → the note
  await talkTo(0); await lines(); await skipErrand();
  await expect(choices.first()).toHaveText('다녀왔어요');
  await choices.first().click();
  const note = page.locator('#storyNoteDialog');
  await expect(note).toBeVisible(); await expect(note.locator('h3')).toHaveText('1장 · 꽃 이름 맞히기 놀이');
  await expect(note.locator('.storyNoteBody p')).toHaveCount(6); await expect(note.locator('.storySign')).toHaveText('— 봄이');
  const box = await note.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  await shot('3note');
  await note.locator('#storyNoteClose').click(); await expect(note).toBeHidden();
  await close();
  // the book: the bag's 「이야기」
  await page.locator('#islandBagTab').click(); await page.locator('#islandStoryBtn').click();
  const book = page.locator('#storyBookDialog'); await expect(book).toBeVisible(); await expect(page.locator('#islandBagDialog')).toBeHidden(); // (nothing behind the book)
  const spring = book.locator('.storyResident').first(); await expect(spring.locator('summary small')).toHaveText('1/3');
  await spring.locator('summary').click();
  await expect(spring.locator('.storyChapter').first()).toContainText('이름을 부르면서 인사하는 거요');
  await expect(spring.locator('.storyChapter.locked')).toHaveCount(2);
  await shot('4book');
  await book.locator('[data-tab="lighthouse"]').click(); await expect(book.locator('.storyPieceCell')).toHaveCount(8); await expect(book.locator('.storyPieceCell.locked')).toHaveCount(8);
  await shot('5pieces');
  await book.locator('[data-tab="events"]').click(); await expect(book.locator('.storyBookBody')).toContainText('아직 받은 행사 이야기가 없어요');
  // (Codex 검토 5차 P3-5) two tabs fast, the first one's answer late: the last one asked stays
  let late = true; await page.route('**/api/island/story', async (route) => { if (late) { late = false; await new Promise((r) => setTimeout(r, 1500)); } await route.continue(); });
  await book.locator('[data-tab="residents"]').click(); await book.locator('[data-tab="lighthouse"]').click();
  await expect(book.locator('.storyPieceCell')).toHaveCount(8); await page.waitForTimeout(2000);
  await expect(book.locator('[data-tab="lighthouse"]')).toHaveAttribute('aria-selected', 'true'); await expect(book.locator('.storyPieceCell')).toHaveCount(8);
  await page.unroute('**/api/island/story');
  await shot('6events');
  await book.locator('#storyBookClose').click();
  // 오 탐정: 「수사판 보기」 -- the book at 초승등대
  await talkTo(5); await lines(); await skipErrand(); await choices.filter({ hasText: '수사판 보기' }).click();
  await expect(book).toBeVisible(); await expect(book.locator('[data-tab="lighthouse"]')).toHaveClass(/selected/); await expect(dialog).toBeHidden(); // (the talk ended under it)
  await expectNoScriptError(page);
  await who.context.close();
});
