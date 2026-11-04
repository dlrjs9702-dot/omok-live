const { test, expect } = require('@playwright/test');
const { shopper, get, post, adminToken, spaceOn, standAt, revealTalk, expectNoScriptError } = require('./skin-support');

// A4 주말 섬 대회, v1.10.238 대회 천막 (문제 기록 1103 7 「중앙 광장에 주민이 대회용 천막을 쳐 놓고 거기서 입장하는 걸로」): the bar
// says where (대청마당 대회 천막) and a tap points the way; the tent stands with 가락 before it; his 「참가하기」 opens the week's
// game hall game as a contest round (its tag and time left); only rounds opened there count -- the bar's live top 3, and
// at the end 1st~3rd and every entrant paid once, the winner on the plaza, the tent still there with the results. The test
// moves the contest's clock and holds the event at 두더지 잡기 (/api/test/contest/clock). PC and phone (the tent's talk and
// the round's tag where they differ); with SHOT_DIR photos (the tent by day and night, the talk, the round, the bar).
test('섬 대회 천막: 띠가 천막을 가리키고, 가락에게 참가하기 → 대회 판, 천막 판만 순위, 끝나면 시상 1회와 동상', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 200000);
  const NA = isMobile ? '대회일등m' : '대회일등'; const NB = isMobile ? '대회이등m' : '대회이등';
  const a = await shopper(browser, request, NA, 100000, 'female'); const b = await shopper(browser, request, NB, 100000, 'male');
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  const shot = async (page, name, wait = 1500) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-contest-${name}.png` }); } };
  const K = require('../../public/plaza/island-calendar.js').PLACES.keeper;
  const round = async (who, score) => { // (a contest round as the tent opens it: by the tent)
    await post(request, '/api/plaza/state', who.token, { x: K.x, z: K.z, yaw: 0, moving: false }); await post(request, '/api/island/contest/join', who.token, {});
    const id = (await post(request, '/api/solo/reflex/start', who.token, { game: 'whack', level: 'easy', contest: true })).data.id; expect(id).toBeTruthy();
    await post(request, '/api/test/reflex/age', who.token, { id, ageMs: 31000 });
    return (await post(request, '/api/solo/reflex/finish', who.token, { id, score })).data;
  };
  try {
    if (process.env.SHOT_DIR) { await set('time', 'day'); await set('weather', 'clear'); }
    expect((await post(request, '/api/test/contest/clock', a.token, { to: 'live', kind: 'whack' })).data.phase).toBe('live');
    const { page } = a;
    await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); if (shots) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const bar = page.locator('#contestBar');
    await expect(bar).toContainText('두더지 잡기 대회', { timeout: 15000 }); await expect(bar).toContainText('대청마당 대회 천막');
    await bar.click(); await expect(page.locator('#toast')).toContainText('화살표를 따라 대청마당 대회 천막');
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().contestTent()?.shown)).toBe(true);
    expect(await page.evaluate(() => window.PlazaDebug().contestTent())).toMatchObject({ name: '가락', sign: '🏆 섬 대회 · 두더지 잡기' });
    // the tent's keeper: 「참가하기」 -- the round at once, the contest's tag over it; ✕ back to the island
    const dialog = page.locator('#plazaDialog');
    const door = await page.evaluate(() => window.PlazaDebug().contestTent().door); await standAt(request, a, door.x, door.z); // (the server's own spot of me: by the tent)
    const talkTill = (name) => expect.poll(async () => {
      if (await dialog.getByRole('button', { name }).isVisible()) return true;
      await page.evaluate(() => { const p = window.PlazaDebug(); const d = p.contestTent().door; p.teleport(d.x, d.z); p.setCamYaw?.(-0.47 + Math.PI); }); await page.waitForTimeout(700); /* (back by 가락 -- a photo may have taken me off) */ await spaceOn(page, 'contest:tent', isMobile); await page.waitForTimeout(900);
      return dialog.getByRole('button', { name }).isVisible();
    }, { timeout: 40000 }).toBe(true);
    await talkTill('참가하기');
    await expect(page.locator('#plazaDialogTitle')).toHaveText('섬 대회 · 가락'); await expect(dialog).toContainText('두더지 잡기 대회 중이에요');
    if (process.env.SHOT_DIR) await revealTalk(page); await shot(page, 'talk', 600);
    await dialog.getByRole('button', { name: '참가하기' }).click();
    await expect(page.locator('#reflexView')).toBeVisible({ timeout: 20000 }); await expect(page.locator('.reflexContestTag')).toContainText(/🏆 대회 · 남은 \d+:\d\d/); await expect(page.locator('.reflexContestTag')).toBeVisible(); // (the round started: the server took it as the tent's)
    await shot(page, 'round', 2500);
    await page.locator('#reflexQuitBtn').click(); await expect(page.locator('#reflexView')).toBeHidden({ timeout: 15000 });
    if (process.env.SHOT_DIR) { // (총괄 238 검토 사진) a 카드놀이 contest's round: everyone's one deal, 「대회」 over it -- then back to 두더지
      await post(request, '/api/test/contest/clock', a.token, { to: 'live', kind: 'klondike' }); await expect(bar).toContainText('카드놀이 대회', { timeout: 20000 });
      await talkTill('참가하기'); await dialog.getByRole('button', { name: '참가하기' }).click();
      await expect(page.locator('.reflexContestTag')).toBeVisible({ timeout: 20000 }); await shot(page, 'cards', 2500);
      await page.locator('#reflexQuitBtn').click(); await expect(page.locator('#reflexView')).toBeHidden({ timeout: 15000 });
      await post(request, '/api/test/contest/clock', a.token, { to: 'live', kind: 'whack' }); await expect(bar).toContainText('두더지 잡기 대회', { timeout: 20000 });
    }
    // only the tent's rounds count: the game hall's is its own
    const free = (await post(request, '/api/solo/reflex/start', b.token, { game: 'whack', level: 'normal' })).data.id; await post(request, '/api/test/reflex/age', b.token, { id: free, ageMs: 31000 });
    expect((await post(request, '/api/solo/reflex/finish', b.token, { id: free, score: 900 })).data.contest).toBe(null);
    await round(a, 260); await round(b, 220); await round(a, 240); // a's best is kept
    const view = (await get(request, '/api/island/contest', a.token)).data;
    expect(view.top.map((r) => [r.name, r.score])).toEqual([[NA, 260], [NB, 220]]);
    expect(view.mine).toEqual({ score: 260, rank: 1 });
    await expect(bar).toContainText(`1위 ${NA}`, { timeout: 20000 });
    await shot(page, 'bar', 300);
    if (process.env.SHOT_DIR) { // (the tent seen whole, by day and by night)
      await page.evaluate(() => { const C = window.IslandCalendar.PLACES.tent; const p = window.PlazaDebug(); p.teleport(C.x + 1.5, C.z + 7); p.setCamYaw?.(Math.atan2(1.5, 7)); p.setCamPitch?.(0.12); });
      await shot(page, 'tent-day', 2500); await set('time', 'night'); await shot(page, 'tent-night', 3500); await set('time', 'day');
    }
    const before = [(await get(request, '/api/points', a.token)).data.balance, (await get(request, '/api/points', b.token)).data.balance];
    expect((await post(request, '/api/test/contest/clock', a.token, { to: 'end' })).data.phase).toBe('done');
    const after = [(await get(request, '/api/points', a.token)).data.balance, (await get(request, '/api/points', b.token)).data.balance];
    expect([after[0] - before[0], after[1] - before[1]]).toEqual([31000, 16000]); // 1st 30,000 + entry 1,000; 2nd 15,000 + 1,000
    const last = (await get(request, '/api/island/contest', b.token)).data.last;
    expect(last).toMatchObject({ rewarded: true, entrants: 2, top: [{ rank: 1, score: 260 }, { rank: 2, score: 220 }] });
    await post(request, '/api/test/contest/clock', a.token, { to: 'end' }); // settled once
    expect((await get(request, '/api/points', a.token)).data.balance).toBe(after[0]);
    await expect.poll(() => page.evaluate((n) => window.PlazaDebug().statues.some((s) => s.name === n), NA), { timeout: 20000 }).toBe(true);
    await expect(bar).toContainText('우승', { timeout: 20000 });
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().contestTent()?.shown), { timeout: 20000 }).toBe(true); // (the results there for half an hour)
    await talkTill('닫기'); await expect(dialog).toContainText(`1위 ${NA}`); await expect(dialog).toContainText('끝났어요'); // (after it: 1st~3rd from 가락)
    if (process.env.SHOT_DIR) await revealTalk(page); await shot(page, 'after', 600);
    await expectNoScriptError(page);
  } finally {
    await post(request, '/api/test/contest/clock', a.token, { to: 'reset' });
    if (process.env.SHOT_DIR) { await set('time', 'auto'); await set('weather', 'auto'); }
  }
  await a.context.close(); await b.context.close();
});
