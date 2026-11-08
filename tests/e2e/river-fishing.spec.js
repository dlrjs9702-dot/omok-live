const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError, pressFishArrows } = require('./skin-support');

// v1.10.90 낚시 도감 21종 (IDEAS #future-fishing-dex): a stream's bank is a fishing spot too -- the float lands on the
// stream, a river fish comes in and goes to the bag (its new model in hand, its icon in the 도감). PC and phone.
test('강 낚시: 개울가에서 던지면 찌가 개울에, 강 물고기를 잡아 가방에', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000); // (v1.10.259: two big ones' tugs, up to 25 s each)
  const who = await shopper(browser, request, '강낚시', 500000, 'male');
  const { page, token } = who;
  expect((await post(request, '/api/test/island/give', token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200); // (낚싯대는 잡화점에서)
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testCatchHold', '1'); }); await page.reload(); // (v1.10.257: the catch card kept up till the test acts)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  await require('./skin-support').holdTool(page, 'fishing_rod'); // (206 Q2 5: the rod in hand to cast)
  if (process.env.THROTTLE) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) }); /* (265 흔들림: CI's slow frames, here -- THROTTLE=6) */
  const weeds = (await get(request, '/api/island/weeds', token)).data.weeds || [];
  // (CI #298 on a phone: a 매미 on the bank took the prompt -- an insect's, like a weed's, comes before fishing; the server's
  // layout of the next 10 minutes)
  for (const o of (await get(request, '/api/island/insects', token)).data.list || []) weeds.push([o.id, o.x, o.z]);
  const spot = await page.evaluate((weeds) => { // the river bank spot nearest the plaza with no weed or insect in reach (their prompts come first)
    const T = window.IslandTerrain; let best = null;
    const R = T.dalmaru ? 170 : 70; const step = T.dalmaru ? 1 : 0.5; const PC = T.PLAZA_C || { x: 0, z: 0 }; /* (달마루섬: its rivers and lake are further out) */ for (let x = -R; x <= R; x += step) for (let z = -R; z <= R; z += step) if (T.fishWater(x, z) === 'river' && (!T.dalmaru || T.dalmaru.riverDist(x, z) < 3) && [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([dx, dz]) => T.canFish(x + dx, z + dz)) && weeds.every(([, wx, wz]) => Math.hypot(wx - x, wz - z) > 4)) { const d = Math.hypot(x - PC.x, z - PC.z); if (!best || d < best.d) best = { x, z, d }; }
    return best;
  }, weeds);
  expect(spot).not.toBeNull();
  const warpAt = Date.now(); await page.evaluate(({ x, z }) => window.PlazaWarp(x, z), spot); const warpMs = Date.now() - warpAt;
  // (CI 3차, run 39704740141: the warp 111 m off took 4.3 s and the page then answered no call for 10 s -- that part of the
  // island is loaded as at an entry, so the entry's wait: until the page answers that it runs)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  // (CI 3차: canFish false for 10 s after the warp on CI, twice -- the nearest 'river' spot was (0, -6), a strip of shallow
  // water by 윤슬만's beach (fishWater's last case), a push of a few cm off it (an islander walking by) and no fishing; now
  // a bank of a real river (riverDist < 3) with room round it, put back there if moved off, and where it was if that fails)
  let at = null;
  await expect.poll(async () => { const t0 = Date.now(); at = { pending: true }; try { const r = await page.evaluate((s) => { const d = window.PlazaDebug(); if (!d.canFish()) d.teleport(s.x, s.z); return { can: d.canFish(), x: d.x, z: d.z, space: d.space }; }, spot); at = { ...r, ms: Date.now() - t0 }; return r.can; } catch (e) { at = { error: String(e).slice(0, 200), ms: Date.now() - t0 }; return false; } }, { timeout: 10000 }).toBe(true).catch((error) => { error.message += `\nlast: ${JSON.stringify(at)} warp: ${warpMs} ms spot: ${JSON.stringify(spot)}`; throw error; }); // (pending: the page did not answer the call at all)
  await expect(page.locator('#plazaHint')).toHaveText(/낚시$/, { timeout: 10000 }) // (a phone shows no SPACE);
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.bobber), { timeout: 10000 }).toBe(true);
  expect(await page.evaluate(() => { const b = window.PlazaDebug().fishing().at; const T = window.IslandTerrain; return T.dalmaru ? T.dalmaru.isWater(b.x, b.z) && T.dalmaru.coastDist(b.x, b.z) >= 0 : T.streamDist(b.x, b.z) < T.STREAM_HALF; })).toBe(true); // (달마루섬: inland water -- a river, 거울호수 or a pool) the float is on the stream
  await page.evaluate(() => window.PlazaDebug().fishBiteNow(12)); // (a long bite on the page; the server's just before the pull -- see plaza.spec)
  await expect(page.locator('#plazaHint')).toHaveText(/순서대로( \(WASD도 돼요\))?$/); // (1103 10: a PC's W/A/S/D said)
  if (isMobile) { // (F 사용자 아이폰 제보: the stick and the phone's buttons sat over the arrows -- each arrow's centre is its own button now)
    await expect(page.locator('#fishArrows .fishArrowPad button')).toHaveCount(4);
    if (process.env.ZZ_OUT) await page.screenshot({ path: `${process.env.ZZ_OUT}/fish-arrows-phone.png` });
    const hits = await page.evaluate(() => [...document.querySelectorAll('#fishArrows .fishArrowPad button')].map((b) => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; }));
    expect(hits).toEqual([true, true, true, true]);
    await expect(page.locator('#islandStick')).toBeHidden();
  }
  expect((await post(request, '/api/test/fish/bite', token, { species: 'catfish', size: 40 })).data.ok).toBe(true);
  await pressFishArrows(page, isMobile); // (3회차 4: the bite's arrows)
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'fish_catfish')?.qty || 0, { timeout: 10000 }).toBe(1)
    .catch(async (error) => { error.message += `\ntoast: ${await page.locator('#toast').textContent().catch(() => '?')}`; throw error; }); // (CI #293 once on a phone: which -- late or wrong -- to find why)
  // (9절 자랑 장면, assets 97) the first catfish held out: the camera before me, the third person, the catch in hand -- the card then
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()?.phase || null), { timeout: 8000 }).toBe('hold');
  expect(await page.evaluate(() => window.PlazaDebug().showOff())).toMatchObject({ kind: 'fish', big: false, fp: false });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()?.clip || null), { timeout: 5000 }).toMatch(/^ShowCatchBig(Hold)?$/); // (259: every fish in both hands)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()?.across || false), { timeout: 5000 }).toBe(true);
  if (isMobile) await expect(page.locator('#islandStick')).toBeVisible(); // (the stick back once the arrows are gone)
  // v1.10.257 잡기 카드 (docs/catch-card-20261103.md): the first catfish -- 「새 친구!」 on its card; 더보기 its 설명 (one line,
  // the island's two, where and when, its size and mine); 닫기 -- the note, tapped its 설명 again
  const N = require('../../lib/island-dex-notes').DEX_NOTES; const shot = async (n) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(700); await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${n}.png` }); } };
  const card = page.locator('#catchCard');
  await expect(card).toBeVisible(); await expect(card.locator('.catchRibbon')).toHaveText(['새 친구!']); await expect(card.locator('.catchFront .catchName')).toHaveText('메기');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()?.size || 0), { timeout: 15000 }).toBeGreaterThanOrEqual(0.45); // (총괄 #408: a 40 cm catfish shown big enough to see)
  if (process.env.SHOT_DIR) await page.evaluate(() => { window.PlazaDebug().showKeep(); window.PlazaDebug().setTime('night'); }); // (photos: past its 6 s for both lights)
  await expect(card.locator('.catchSize')).toHaveText('40.0 cm', { timeout: 5000 }); await shot('catch-first');
  if (process.env.SHOT_DIR) { await page.evaluate(() => window.PlazaDebug().setTime('day')); await page.waitForTimeout(500); await shot('catch-first-day'); await page.evaluate(() => window.PlazaDebug().setTime('auto')); }
  await card.locator('#catchMoreBtn').click(); await expect(card).toHaveClass(/flipped/);
  await expect(card.locator('.catchBack .catchLine')).toHaveText(N.fish_catfish.line); await expect(card.locator('.catchBack .catchStory p')).toHaveText(N.fish_catfish.story);
  await expect(card.locator('.catchFacts')).toContainText('강'); await expect(card.locator('.catchFacts')).toContainText('내 최고 40 cm'); await shot('catch-more');
  await card.locator('#catchCloseBtn').click(); await expect(card).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()), { timeout: 3000 }).toBe(null); // (put away, the camera home)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null); // the catch played out (the 13 new models: test/island-asset-pipeline)
  await expect(page.locator('#toast')).toHaveClass(/tappable/); await page.evaluate(() => document.getElementById('toast').click()); /* (CI #408 phone: a slow runner's toast gone before a pointer click landed) */ await expect(card).toHaveClass(/infoOnly/); await card.locator('#catchCloseBtn').click();
  // a bigger one: cast again with the card up (it shrinks), 「신기록!」 and the best before
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.bobber), { timeout: 10000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().fishBiteNow(12)); await expect(page.locator('#plazaHint')).toHaveText(/순서대로( \(WASD도 돼요\))?$/);
  expect((await post(request, '/api/test/fish/bite', token, { species: 'catfish', size: 55.5 })).data.ok).toBe(true);
  await pressFishArrows(page, isMobile);
  await expect(card).toBeVisible({ timeout: 10000 }); await expect(card.locator('.catchRibbon')).toHaveText(['신기록!']);
  await expect(card.locator('.catchLines')).toContainText('지난 최고 40 cm → +15.5 cm'); await shot('catch-best');
  // SPACE in the 자랑: skipped at once -- no cast from it (a second one casts)
  expect(await page.evaluate(() => window.PlazaDebug().showOff()?.phase)).toBe('hold');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()), { timeout: 1500 }).toBe(null); await expect(card).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 3000 }).toBe(null);
  // (the next cast: the card goes to its note -- the rod never waits on it; SPACE again while the catch still plays out)
  await expect.poll(async () => { if (!(await page.evaluate(() => window.PlazaDebug().fishing()?.phase))) { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); await page.waitForTimeout(400); } return page.evaluate(() => window.PlazaDebug().fishing()?.phase || null); }, { timeout: 15000, intervals: [300] }).toMatch(/cast|wait/);
  await expect(card).toBeHidden();
  await page.keyboard.press('Space'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null); // (pulled early: gone)
  // v1.10.259 타이밍 막대 (fishing-minigames 2절): the bar asked for the next cast -- a miss shakes it (「틀렸어요!」), a player in the
  // page presses while the needle is in the zone: a 붕어 pulled in; then back to the arrows
  // (CI #409: a cast by the server's answer -- the scene's bobber alone was no proof there was one there)
  const castNow = async () => {
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
    const started = page.waitForResponse((r) => r.url().includes('/api/island/fish/start'), { timeout: 15000 });
    await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
    const r = await started; expect(r.status(), await r.text().catch(() => '')).toBe(200);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.bobber || false), { timeout: 15000 }).toBe(true);
  };
  expect((await post(request, '/api/test/fish/mode', token, { mode: 'timing' })).data.ok).toBe(true);
  await castNow();
  if (!isMobile) { await page.keyboard.press('t'); await expect(page.locator('#toast')).toContainText('지금은 할 수 없어요'); await expect(page.locator('#emoteWheel')).toBeHidden(); } /* (v1.10.263: no wheel while fishing) */
  await page.evaluate(() => window.PlazaDebug().fishBiteNow(14)); expect((await post(request, '/api/test/fish/bite', token, { species: 'crucian_carp', slack: 20000, biteAgo: 2000 })).data.ok).toBe(true); /* (265: the server's bite before the page's, as for a player -- set after it, a quick last hit came "sooner than the bar allows" by the server's clock: FISH_WRONG) */
  const bar = page.locator('#fishTiming'); await expect(bar).toBeVisible({ timeout: 10000 }); await expect(page.locator('#plazaHint')).toHaveText(/^입질! 초록 칸에서 [2-5]번$/); /* (the cast's own fish's grade: 2~5) */
  /* (the player: one miss away from the zone, then each press in it -- by the bar's own clock and FishTug.inZone, as the page and the
     server judge it, not the needle a slow frame drew; 265 흔들림: at CI's 2.7 fps the drawing was a third of a second behind) */
  await page.evaluate(() => { const box = document.getElementById('fishTiming'); const T = window.FishTug; const key = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    let missed = false; const go = () => { if (box.classList.contains('hidden')) return; const g = window.FishGameDebug?.().bar; if (g && !(g.hold > performance.now())) { const ms = performance.now() - g.shownAt; const zone = g.t.zones[g.hit]; const inside = T.inZone(g.t, zone, ms) && T.inZone(g.t, zone, ms + 30);
      if (!missed && !T.inZone(g.t, zone, ms) && !T.inZone(g.t, zone, ms + 200)) { missed = true; key(); } else if (missed && inside) key(); } setTimeout(go, 10); }; go(); });
  await expect(bar).toHaveClass(/wrong/, { timeout: 10000 }); await expect(bar.locator('.fishTimingMiss')).toBeVisible(); // (총괄 #409: where it was pressed, the needle held there 0.5 s)
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-timing-bar.png` });
  await expect(bar).toBeHidden({ timeout: 20000 });
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'fish_crucian_carp')?.qty || 0, { timeout: 10000 }).toBe(1);
  await expect(card).toBeVisible({ timeout: 5000 }); await card.locator('#catchCloseBtn').click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
  expect((await post(request, '/api/test/fish/mode', token, { mode: null })).data.ok).toBe(true);
  // v1.10.259 대어 줄다리기 (docs/fishing-minigames-20261104.md 3절): a big one's arrows bring 「대어다!」 -- not in the bag yet; a
  // player in the page holds (SPACE / 「감기」) and lets go while it fights or the tension runs high: caught, held out in both
  // hands; then one held throughout -- the line snaps, nothing caught
  const bigBite = async (species) => {
    await castNow();
    await page.evaluate(() => window.PlazaDebug().fishBiteNow(14)); await expect(page.locator('#plazaHint')).toHaveText(/순서대로( \(WASD도 돼요\))?$/);
    expect((await post(request, '/api/test/fish/bite', token, { species, size: 150, slack: 20000, biteAgo: 2000 })).data.ok).toBe(true); await pressFishArrows(page, isMobile);
    await expect(page.locator('#fishTug')).toBeVisible({ timeout: 10000 }); await expect(page.locator('#fishTug .fishTugTitle')).toContainText('대어다!');
    expect(await page.evaluate(() => window.PlazaDebug().fishing()?.phase)).toBe('tug');
  };
  const space = (type) => page.evaluate((t) => window.dispatchEvent(new KeyboardEvent(t, { code: 'Space', key: ' ', bubbles: true })), type);
  await bigBite('sturgeon'); if (isMobile) await expect(page.locator('#fishTug .fishTugReel')).toBeVisible();
  await shot('tug-start');
  /* (the player: hold while the tension is under 60, in a fight under 30; the tug worked out to this moment from its plan and holds
     with FishTug.run, as the server does, not the bars a slow frame drew -- 265 흔들림: letting go in every fight caught it near
     the 25 s limit or let it get away, 1 in 50; this way every one of 800 tries, by 16 s, deciding as seldom as every 0.4 s) */
  await page.evaluate(() => { const box = document.getElementById('fishTug'); const T = window.FishTug;
    const key = (t) => window.dispatchEvent(new KeyboardEvent(t, { code: 'Space', key: ' ', bubbles: true })); let down = false;
    const id = setInterval(() => { const g = window.FishGameDebug?.().tug; if (box.classList.contains('hidden')) { if (down) key('keyup'); clearInterval(id); return; } if (!g) return; /* (v1.10.277: the tug's state a moment between two of its updates -- the player waits a tick; stopping for good there left the fish to get away) */
      const now = performance.now() - g.t0; const st = T.run(g.plan, g.down != null ? [...g.holds, [g.down, null]] : g.holds, now);
      const want = T.fightAt(g.plan, now) ? st.tension < 30 : st.tension < 60; if (want !== down) { down = want; key(want ? 'keydown' : 'keyup'); } }, 20); });
  if (process.env.SHOT_DIR) { await page.evaluate(() => new Promise((ok) => { const box = document.getElementById('fishTug'); const mo = new MutationObserver(() => { if (box.classList.contains('fight')) { mo.disconnect(); setTimeout(ok, 150); } }); mo.observe(box, { attributes: true }); setTimeout(() => { mo.disconnect(); ok(); }, 12000); })); /* (a fight just begun) */ await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-tug-fight.png` }); } // (at once: a fight lasts 0.6~1.4 s)
  await expect(page.locator('#fishTug')).toBeHidden({ timeout: 40000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().showOff()?.big || false), { timeout: 10000 }).toBe(true); await expect(card).toBeVisible({ timeout: 5000 }); await expect(card.locator('.catchRibbon')).toContainText(['대어!']); await shot('catch-big');
  await card.locator('#catchCloseBtn').click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'fish_sturgeon')?.qty || 0, { timeout: 10000 }).toBe(1);
  await bigBite('salmon'); await space('keydown'); await expect(page.locator('#fishTug .fishTugTension')).toHaveClass(/hot/, { timeout: 20000 }); if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-tug-hot.png` }); /* (at once: it snaps soon after) */
  await expect(page.locator('#fishTug')).toBeHidden({ timeout: 30000 }); await space('keyup'); await expect(page.locator('#toast')).toHaveText('줄이 끊어졌어요!');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
  expect(((await get(request, '/api/island/bag', token)).data.items || []).some((e) => e.itemId === 'fish_salmon')).toBe(false);
  // the bag's ⓘ and the 도감's cell: the same 설명
  await page.keyboard.press('KeyI'); await page.locator('.islandBagSlot[data-item="fish_catfish"]').first().click();
  await page.locator('#islandBagInfo .bagInfoMore').click(); await expect(card).toHaveClass(/infoOnly/); await expect(card.locator('.catchBack .catchName')).toHaveText('메기'); await shot('bag-info'); await card.locator('#catchCloseBtn').click();
  await page.locator('#islandDexBtn').click(); await page.locator('.islandDexTab[data-tab="fresh"]').click();
  /* (265 흔들림: one not on show in the museum either -- a fish another test gave there reads as known, its name shown) */
  const shown = ((await get(request, '/api/island/museum', token)).data.exhibits || []).filter((x) => x.by).map((x) => x.id);
  /* (v1.10.277: by the cell's own item, not its icon's file -- a fish's icon may be named for another, and a 붕어 given by
     museum-hall read as unfound here) */
  const k = await page.locator('.islandDexCell.opens.unfound').evaluateAll((cells, ids) => cells.findIndex((c) => !ids.includes(c.dataset.item)), shown); expect(k).toBeGreaterThanOrEqual(0);
  await page.locator('.islandDexCell.opens.unfound').nth(k).click(); await expect(card.locator('.catchBack')).toHaveClass(/unfound/); await expect(card.locator('.catchBack .catchName')).toHaveText('???');
  await expect(card.locator('.catchStory p')).toHaveCount(0); await shot('dex-unfound'); await card.locator('#catchCloseBtn').click();
  await expectNoScriptError(page);
  await who.context.close();
});
