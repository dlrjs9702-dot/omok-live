const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, spaceOn, revealTalk, expectNoScriptError, walkStory } = require('./skin-support');

// v1.10.234 새 주민 17명 이야기 (gamecenter-notes docs/resident-stories-17-20261102.md): three of them to 단짝 -- 빛나 (walking;
// 윤슬다리, 이솔에게 말 걸기, 마루폭포), 김우성 (at the 구치소 desk: 「이야기해요」 on his talk; 구치소, 푸른숲골, 구치소 at night),
// 마루 (at the 관공서 gate: 「이야기해요」 on his; 관공서 twice, 달끝나루) -- each offer's place on its note, the 할 일 line, the
// place reached (✓), back for the note; the book's 27 with the three at 3/3. PC and phone; SHOT_DIR photos.
test('17명 이야기: 빛나·김우성·마루 단짝까지, 마루폭포·관공서·구치소 가 보기, 말 걸기 장, 밤 장, 이야기 책 27명', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 900000 : 600000);
  const admin = await adminToken(request); const time = (mode) => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } });
  // (the test server's roster is off -- 11/2 빛나 and 이솔 walk; the day's errands go by this day too now (server errandDay): on 11/3
  // 빛나 asked one, and her talk opened on its offer every run -- a day with no errand of theirs; skipErrand stays for the rest)
  await request.post('/api/test/roster', { data: { on: true, day: '2026-11-02' } });
  try {
    await time('day');
    const who = await shopper(browser, request, isMobile ? '열일곱폰' : '열일곱손', 200000, 'female'); const { page, token } = who;
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const dialog = page.locator('#plazaDialog'); const choices = page.locator('#plazaDialog .talkChoices button');
    const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
    const lines = () => revealTalk(page);
    const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(600); await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
    const close = async () => { await expect.poll(async () => { if (await dialog.isVisible()) await page.keyboard.press('Escape'); await page.waitForTimeout(400); return dialog.isVisible(); }, { timeout: 20000 }).toBe(false); };
    // (a day's errand asked first: 「다음에요」 -- only a note on screen; CI mobile-2 counted a hidden one left from before and waited
    // a minute for a button not there)
    // (CI 흔들림 묶음: the note looked at once, while the window was still being drawn, missed an offer and the next choice waited a
    // minute -- the offer's own 「다음에요」 counts too, and the choices are watched a moment for it)
    const skipErrand = async () => {
      const later = choices.filter({ hasText: '다음에요' }); const note = page.locator('#plazaDialog .questNote', { hasText: '오늘 안에' }).first();
      let offered = false; for (let k = 0; k < 3 && !offered; k += 1) { offered = await later.isVisible().catch(() => false) || await note.isVisible().catch(() => false); if (!offered) await page.waitForTimeout(400); }
      if (!offered) return;
      await later.waitFor({ state: 'visible', timeout: 20000 }).then(() => later.click(), () => {}); await lines();
    };
    const space = () => page.evaluate(() => window.PlazaDebug().space);
    // talking to them: a walker where it walks; 김우성 before his desk in the 구치소; 마루 at the gate -- the last two by 「이야기해요」
    // (CI 흔들림 묶음: a talk counts once its choices are there and still are a moment later -- a card drawn into the window after
    // the talk began (the walk-in's) took the choices away; shut and asked again then)
    const inTalk = async () => await talking() && await choices.count() > 0;
    const settled = async () => { if (!await inTalk()) return false; await page.waitForTimeout(1500); return inTalk(); };
    const walker = (n) => async () => {
      let since = 0;
      await expect.poll(async () => {
        if (await settled()) return true;
        if (await talking()) { since ||= Date.now(); if (Date.now() - since > 15000) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); since = 0; } return false; }
        since = 0; await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, n); await page.waitForTimeout(700);
        return false;
      }, { timeout: 120000, intervals: [300] }).toBe(true);
    };
    const intoJail = async () => {
      await expect.poll(async () => { if (await space() === 'jail') return true; await page.evaluate(() => window.PlazaDebug().place('jail')); await page.waitForTimeout(500); await spaceOn(page, 'jail', isMobile); await page.waitForTimeout(1200); return (await space()) === 'jail'; }, { timeout: 60000 }).toBe(true);
    };
    const outOfJail = async () => {
      await expect.poll(async () => { if (await space() !== 'jail') return true; await page.evaluate(() => window.PlazaDebug().place('jail:exit')); await page.waitForTimeout(500); await spaceOn(page, 'jail:exit', isMobile); await page.waitForTimeout(1200); return (await space()) !== 'jail'; }, { timeout: 60000 }).toBe(true);
    };
    // (CI #392 chromium-2: the card up, then 「이야기해요」 「not stable」 and gone -- on a slow runner the walk-in drew the card again
    // under the click; the button is pressed in the page the moment the card shows (no actionability wait) and the whole
    // step tried again until their talk is open)
    const byPost = (open, prefix, card) => async () => {
      await open();
      const btn = page.locator('#plazaDialog .postTalkBtn', { hasText: '이야기해요' });
      await expect.poll(async () => {
        if (await settled()) return true; /* (the desk's card drawn over the talk a moment after it began -- 「이야기해요」 pressed again) */
        if (await page.locator(card).isVisible() && await btn.isVisible()) { await lines().catch(() => {}); await btn.evaluate((el) => el.click()).catch(() => {}); await page.waitForTimeout(1200); return false; }
        if (await talking()) { await page.waitForTimeout(500); return false; }
        await page.evaluate((p) => { const d = window.PlazaDebug(); if (p !== 'jail:warden') return d.place(p); const J = window.IslandJail; const w = J.world(J.TALK.lx, J.TALK.lz); d.teleport(w.x, w.z); }, prefix); await page.waitForTimeout(500); /* (his desk is a counter, not a door: where one talks from) */ await spaceOn(page, prefix, isMobile); await page.waitForTimeout(900); return false; }, { timeout: 90000 }).toBe(true);
    };
    const warden = byPost(intoJail, 'jail:warden', '#wardenCard');
    const mayor = byPost(async () => { await outOfJail(); }, 'mayor', '#plazaDialog .postTalkBtn');
    const levelTo = async (n, min) => { for (let k = 0; k < 6; k += 1) { const pts = (await get(request, '/api/island/affinity', token)).data.residents[n].points; if (pts >= min) return; await post(request, '/api/test/affinity', token, { n, delta: Math.min(10, min - pts) }); } };
    const arrive = async (key) => {
      if (await space() === 'jail') await outOfJail();
      await page.evaluate(async (k) => { const p = window.IslandStory.PLACE[k](window.IslandTerrain); await window.PlazaWarp(p.x + 0.6, p.z + 0.6); }, key);
      await expect(page.locator('#questTracker .questLine.ready', { hasText: '돌아가 말해요' })).toBeVisible({ timeout: 30000 });
    };
    // one chapter: offered (its title and place on the note), 할게요, its 할 일 line, there (or the one it sends me to), back
    const chapter = async (n, c, open, go) => {
      const S = await page.evaluate(([n, c]) => { const ch = window.IslandStory.RESIDENTS[n][c]; const p = ch.go.at ? window.IslandStory.PLACE[ch.go.at](window.IslandTerrain) : null; return { title: ch.title, task: ch.task, at: ch.go.at || null, talk: ch.go.talk ?? null, night: Boolean(ch.go.night), label: p?.label || null }; }, [n, c]);
      await levelTo(n, [5, 15, 30][c]);
      await open(); await lines(); await skipErrand();
      await choices.filter({ hasText: '이야기 들려줘요' }).click(); /* (a quest's 「📜 부탁」 may come first) */ await lines();
      await walkStory(page); /* (v1.10.267 1-2: the 부탁 as a talk, to its 받기) */
      const note = page.locator('#plazaDialog .questNote'); await expect(note).toContainText(S.title);
      if (S.label) await expect(note).toContainText(S.label);
      await shot(`offer-${n}-${c + 1}`);
      // 할게요 -- till the server has it under way (CI mobile-2: at 2.7 fps a click before the choices settled took nothing)
      await expect.poll(async () => { if ((await get(request, '/api/island/story', token)).data.track?.title === S.title) return true; await lines().catch(() => {}); const yes = page.locator('#plazaDialog .talkChoices button[data-accept]').first(); if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {}); /* (its lines shown first: the buttons come after the last -- CI ▼ still up) */ await page.waitForTimeout(800); return false; }, { timeout: 90000 }).toBe(true);
      // (CI #389·#392: the line on the card before the window is shut -- the server had it, but the page's answer (its 할 일 line)
      // was still on its way when Escape ended the talk, and an answer after the end is dropped; only the 20 s refresh brought it)
      await expect(page.locator('#questTracker .questLine', { hasText: S.task }).or(page.locator('#questTracker .questLine.ready'))).toBeVisible({ timeout: 60000 }); /* (검토 #397: 마루 1·2장 -- I stand at its office already, so it is reached at once: the ✓ line in its place) */
      await lines(); await close();
      if (S.talk != null) { // (말 걸기 장: the one it sends me to -- 「부탁받고 왔어요」)
        await go(); await lines(); await skipErrand(); await choices.filter({ hasText: '부탁받고 왔어요' }).click(); /* (a quest's 「📜 부탁」 may come first) */ await lines(); await close();
        await expect(page.locator('#questTracker .questLine.ready', { hasText: '돌아가 말해요' })).toBeVisible({ timeout: 30000 });
      } else {
        if (S.night) await time('night');
        await arrive(S.at); await shot(`there-${S.at}-${n}-${c + 1}`);
        if (S.night) await time('day');
      }
      await open(); await lines(); await skipErrand();
      await choices.filter({ hasText: '다녀왔어요' }).click(); /* (a quest's 「📜 부탁」 may come first) */ await lines(); await walkStory(page); /* (1-2: 다녀왔어요 and the note's talk, the paper at its end) */
      const paper = page.locator('#storyNoteDialog'); await expect(paper).toBeVisible(); await expect(paper.locator('h3')).toHaveText(`${c + 1}장 · ${S.title}`);
      await expect(paper.locator('.storyNoteBody p')).toHaveCount(6); await expect(paper.locator('.storySign')).not.toHaveText('— ');
      if (c === 2) await shot(`note-${n}-3`);
      await paper.locator('#storyNoteClose').click(); await expect(paper).toBeHidden(); await close();
    };
    // 빛나: 윤슬다리 → 이솔에게 (말 걸기 장) → 마루폭포
    for (let c = 0; c < 3; c += 1) await chapter(12, c, walker(12), walker(8));
    // 김우성: 구치소 → 푸른숲골 → 구치소 at night (by day the place counts for nothing -- the unit test's; here its ✓ at night)
    for (let c = 0; c < 3; c += 1) await chapter(22, c, warden, null);
    if (await space() === 'jail') await outOfJail();
    // 마루: 관공서 → 관공서 → 달끝나루
    for (let c = 0; c < 3; c += 1) await chapter(23, c, mayor, null);
    const st = (await get(request, '/api/island/story', token)).data; expect(st.chapters).toMatchObject({ 12: 3, 22: 3, 23: 3 });
    // the book: all 27, the three at 3/3 -- 김우성's 3장 in full
    await page.locator('#islandBagTab').click(); await page.locator('#islandStoryBtn').click();
    const book = page.locator('#storyBookDialog'); await expect(book).toBeVisible();
    await expect(book.locator('.storyResident')).toHaveCount(27);
    for (const n of [12, 22, 23]) await expect(book.locator('.storyResident').nth(n).locator('summary small')).toHaveText('3/3');
    await shot('book-27'); await book.locator('.storyResident').nth(26).scrollIntoViewIfNeeded(); await shot('book-17');
    const woo = book.locator('.storyResident').nth(22); await woo.locator('summary').click(); await expect(woo.locator('.storyChapter.locked')).toHaveCount(0);
    await expect(woo.locator('summary b')).toHaveText('김우성'); await woo.scrollIntoViewIfNeeded(); await shot('book-useong');
    await book.locator('#storyBookClose').click();
    await expectNoScriptError(page);
    await who.context.close();
  } finally {
    await request.post('/api/test/roster', { data: { on: false } }); await time('auto');
  }
});
