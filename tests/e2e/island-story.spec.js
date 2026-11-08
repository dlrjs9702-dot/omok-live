const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, spaceOn, expectNoScriptError, walkStory } = require('./skin-support');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// v1.10.277 시험 정리 2차 (docs/test-audit-20261107.md §6): S1 and S2 one player -- S2 sets its story (every chapter done) and
// reloads, as its own spec did.
// S1 섬 이야기 (gamecenter-notes docs/island-story-bible-20261027.md 5절): 아는 사이 봄이 offers 1장 (「이야기 들려줘요」 → the
// note with 할게요 / 다음에요), the 할 일 card's line, 대청마당 reached → ✓, back to 봄이 (「다녀왔어요」) → the story note;
// the book from the bag (주민 이야기 1/3 with the note in full, 초승등대 eight cells, 행사 이야기 none yet). PC and phone.
// S2 섬 이야기 장면 (notes story/residents-20261027.md 「S2 정함」): the 기록관's 「섬 일지」 (pages read as opened), the little
// door under 초승등대 -- 「살펴보기」: locked, the box at its foot gives the missing page (piece 7); 오 탐정's 「결론 듣기」 (the
// board full, 노을 할머니 단짝): six papers paged through, the door opening with the second; the board stamped. PC and phone.
// (ZZ_SHOT: the island's own models, and the lighthouse at night)
test('섬 이야기: 이야기 부탁 → 할 일 → ✓ → 쪽지·이야기 책; 장면: 섬 일지 → 등대 아래 문 → 결론 듣기 → 수사판 도장', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 900000 : 600000);
  const who = await shopper(browser, request, isMobile ? '이야기폰' : '이야기손', 200000, 'female'); const { page, token } = who;
  { // S1
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
    // (v1.10.267 1-2: the 부탁 as a talk -- my replies to it, its note with the 받기 replies)
    await expect(choices.first()).toHaveAttribute('data-topic', 'sreply'); await expect(page.locator('#plazaDialog .questNote')).toHaveCount(0);
    await walkStory(page);
    await expect(page.locator('#plazaDialog .questNote')).toContainText('꽃 이름 맞히기 놀이');
    await expect(page.locator('#plazaDialog .questNote')).toContainText('대청마당');
    await expect(choices.last()).toHaveText('나중에 할게요'); await expect(page.locator('#plazaDialog .talkPast')).toHaveCount(2);
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
    await choices.first().click(); await lines();
    const note = page.locator('#storyNoteDialog');
    await expect(note).toBeHidden(); await walkStory(page); // (1-2: 다녀왔어요 and the note's talk first, the paper at its end)
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
    await talkTo(5); await lines(); await skipErrand(); if (!(await choices.filter({ hasText: '수사판 보기' }).count())) await choices.filter({ hasText: '⋯ 더 보기' }).click(); /* (v1.10.267 3-0: the first slot his story's step, if any) */ await choices.filter({ hasText: '수사판 보기' }).click();
    await expect(book).toBeVisible(); await expect(book.locator('[data-tab="lighthouse"]')).toHaveClass(/selected/); await expect(dialog).toBeHidden(); // (the talk ended under it)
  }
  { // S2
    const done = Object.fromEntries([...Array(10).keys()].map((n) => [String(n), 3]));
    await post(request, '/api/test/story', token, { doc: { chapters: done, read: [] } });
    await page.evaluate((real) => { localStorage.removeItem('gc.testClassic'); if (!real) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.ZZ_SHOT));
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const shot = async (name) => { if (process.env.ZZ_SHOT) { await page.waitForTimeout(800); await page.screenshot({ path: `${process.env.ZZ_SHOT}-${name}-${isMobile ? 'phone' : 'pc'}.png` }); } };
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug?.().hatch), { timeout: 30000 }).toBe(true); // (가람's 3장: the door seen)
    // 기록관: 「섬 일지」 -- three blank, eight pages, each read as opened
    await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const r = d.doors.records; d.teleport(r.x, r.z); }); await page.waitForTimeout(500); await spaceOn(page, 'records', isMobile); await page.waitForTimeout(600); return page.locator('#plazaDialog .storyShelf').isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
    await page.locator('#plazaDialog .storyShelf button', { hasText: '섬 일지' }).click();
    const book = page.locator('#storyBookDialog'); await expect(book).toBeVisible(); await expect(page.locator('#storyBookTitle')).toHaveText('섬 일지');
    await expect(book.locator('.storyLogBlank')).toHaveCount(3); await expect(book.locator('.storyLogPage')).toHaveCount(8); await expect(book.locator('.storyLogPage.locked')).toHaveCount(0);
    for (let k = 0; k < 8; k += 1) await book.locator('.storyLogPage summary').nth(k).click();
    await expect.poll(async () => (await post(request, '/api/test/story', token, {})).data.doc.read.length).toBe(8);
    await shot('1log');
    await book.locator('#storyBookClose').click();
    // the little door: locked, the box at its foot -- the missing page
    const atDoor = () => page.evaluate(async () => { const L = window.IslandTerrain.dalmaru.PLACES.lighthouse; await window.PlazaWarp(L.x + 1, L.z - 6.5); window.PlazaDebug().faceTo(L.x, L.z); });
    const viewDoor = () => page.evaluate(async () => { const L = window.IslandTerrain.dalmaru.PLACES.lighthouse; await window.PlazaWarp(L.x + 2, L.z - 15); window.PlazaDebug().faceTo(L.x, L.z - 3); window.PlazaDebug().setCamYaw(Math.PI); }); // (a step back: the door at the tower's foot in sight)
    if (process.env.ZZ_SHOT) { await viewDoor(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug().door), { timeout: 60000 }).not.toBeNull(); await shot('2door'); } // (the model in)
    await atDoor();
    const inspect = page.locator('#storyInspectBtn'); await expect(inspect).toBeVisible({ timeout: 20000 });
    await inspect.click();
    const note = page.locator('#storyNoteDialog'); await expect(note).toBeVisible(); await expect(note.locator('h3')).toContainText('빠진 쪽');
    await expect(note.locator('.storyPiece')).toContainText('조각 7');
    await shot('3missing');
    await note.locator('#storyNoteClose').click();
    const shut = await page.evaluate(() => window.PlazaDebug().storyDebug().door);
    // 오 탐정: 「결론 듣기」 (노을 할머니 단짝) -- six papers; the door opens with the second
    for (let k = 0; k < 3; k += 1) await post(request, '/api/test/affinity', token, { n: 4, delta: 10 });
    const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
    await expect.poll(async () => {
      if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async () => { const w = window.PlazaDebug().wanderers.find((o) => o.n === 5); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(5); }); await page.waitForTimeout(700); }
      return talking();
    }, { timeout: 120000, intervals: [300] }).toBe(true);
    await require('./skin-support').revealTalk(page);
    const choices = page.locator('#plazaDialog .talkChoices button');
    if (await page.locator('#plazaDialog .questNote', { hasText: '오늘 안에' }).count()) await choices.filter({ hasText: '다음에요' }).click(); // (a day's errand asked first)
    await expect(choices.first()).toHaveText('결론 듣기'); await expect(choices.filter({ hasText: '⋯ 더 보기' })).toHaveCount(1); /* (v1.10.267 3-0: 결론 in the first slot, 수사판 under 더 보기) */
    await choices.first().click();
    await expect(note).toBeVisible(); await expect(note.locator('h3')).toHaveText('마지막 장 · 수사판의 결론');
    await note.locator('.storyNext').click(); await expect(note.locator('h3')).toHaveText('마지막 장 · 등대 아래 문');
    if (shut !== null) await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug().door)).not.toBe(shut);
    await note.locator('.storyNext').click(); await expect(note.locator('h3')).toHaveText('마지막 장 · 다음 이웃에게');
    await expect(note.locator('p').first()).toHaveText('새 이웃이 왔구나. 어서 오렴.');
    await shot('4letter');
    for (const title of ['등불을 맡기며', '하람의 헌사', '그날 밤']) { await note.locator('.storyNext').click(); await expect(note.locator('h3')).toHaveText(`마지막 장 · ${title}`); }
    await expect(note.locator('.storyNext')).toHaveCount(0); await expect(note.locator('.storyWord').first()).toContainText('이솔');
    const box = await note.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    await note.locator('#storyNoteClose').click();
    // the board: eight cells, each stamped
    await expect(dialog).toBeHidden(); // (the talk ended with the papers)
    await page.locator('#islandBagTab').click(); await page.locator('#islandStoryBtn').click();
    await book.locator('[data-tab="lighthouse"]').click();
    await expect(book.locator('.storyPieceCell.found')).toHaveCount(8); await expect(book.locator('.storyStamp')).toHaveCount(8);
    await expect(book.locator('.storyBookBody')).toContainText('마지막 장 · 초승 등불');
    await shot('5board');
    await book.locator('#storyBookClose').click();
    if (process.env.ZZ_SHOT) { await viewDoor(); await shot('6dooropen'); }
    if (process.env.ZZ_SHOT) { // (the lighthouse at night: the lamp's beat)
      const admin = await adminToken(request); const set = (mode) => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } });
      await set('night'); await page.waitForTimeout(4000);
      await page.evaluate(async () => { const L = window.IslandTerrain.dalmaru.PLACES.lighthouse; await window.PlazaWarp(-40, L.z - 4); window.PlazaDebug().faceTo(L.x, L.z); window.PlazaDebug().setCamYaw(Math.PI / 2); window.PlazaDebug().setCamPitch(-0.3); }); // (총괄 검토: from 윤슬다리, the camera tilted up as a player drags it -- the lamp in sight)
      const lamp = new Set(); for (let k = 0; k < 12; k += 1) { lamp.add(await page.evaluate(() => window.PlazaDebug().storyDebug().lamp)); await page.waitForTimeout(250); }
      expect([...lamp].sort()).toEqual([0.15, 2.4]); // (its beat: on and off at night)
      await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug().halo), { intervals: [50] }).toBeGreaterThan(0.5); await page.screenshot({ path: `${process.env.ZZ_SHOT}-7night-${isMobile ? 'phone' : 'pc'}.png` }); // (the moment it is on)
      await set('auto');
    }
  }
  await expectNoScriptError(page);
  await who.context.close();
});
