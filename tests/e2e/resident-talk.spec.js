const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// v1.10.91 주민 대화·심부름 (사용자 2026-10-18): any walking islander talks (name, their own words); the day's errands
// show a star over the asker, the tracker says where to go, and the one at the end pays once. PC and phone.
// A-6 (docs/residents-talk-hills-20261018.md 1·2): walking or not; held on every screen while the window is open (also past
// the old 3-9 s stop), the choices after their words, let go on closing; someone else's talk says with whom.
test('주민 대화: 걷는 주민 붙잡기·선택지·두 화면 멈춤, 심부름 받고 끝내면 사례', async ({ browser, request }) => {
  test.setTimeout(300000);
  const who = await shopper(browser, request, '심부름꾼', 500000, 'male');
  const other = await shopper(browser, request, '구경꾼', 0, 'female');
  const { page, token } = who;
  for (const p of [page, other.page]) { await p.evaluate(() => localStorage.removeItem('gc.testClassic')); await p.reload(); }
  for (const p of [page, other.page]) await expect.poll(() => p.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const dialog = page.locator('#plazaDialog');
  const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  // (the debug helper stands me by them and talks at once -- CI's slow frames; the server still checks the distance, a
  // walk-off between is retried; an island event may take the islander meanwhile -- events first: let it go for the test)
  const talkTo = async (n) => {
    await expect.poll(async () => {
      if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate((n) => window.PlazaDebug().talkResident(n), n); await page.waitForTimeout(1500); }
      return talking();
    }, { timeout: 120000, intervals: [300] }).toBe(true);
    expect(await page.evaluate(() => window.PlazaDebug().talkView?.id)).toBe(`resident:${n}`); // the talk camera (사용자 2026-10-18: every talk)
  };
  const lines = async () => { for (let k = 0; k < 4 && await page.locator('.lostRequestLine.talkPending').count(); k += 1) await page.keyboard.press('Space'); };
  const choose = async (key) => { await Promise.all([page.waitForResponse((r) => r.url().includes('/api/island/resident/talk')), page.keyboard.press(key)]); await lines(); };
  const close = async () => { await page.keyboard.press('Escape'); await expect(dialog).not.toHaveClass(/talkMode/); };
  const holdOn = (p, n) => p.evaluate((n) => window.PlazaDebug().residentReservations[n]?.hold?.eventId || null, n);
  await post(request, '/api/test/island/free-residents', token, {}); // (CI: no resident still held by an earlier test's event)
  const view = (await get(request, '/api/island/errands', token)).data;
  expect(view.total).toBe(3);
  // someone with nothing for me: held for the talk on both screens, the choices, still held past the old stop, let go on closing
  const idle = [...Array(10).keys()].find((n) => !(n in view.marks));
  await talkTo(idle);
  await lines();
  const choices = page.locator('#plazaDialog .talkChoices button');
  await expect(choices).toHaveText(['요즘 어때요?', '섬 소문 있어요?', '부탁할 거 있어요?', '잘 가요']);
  await expect.poll(() => holdOn(other.page, idle), { timeout: 15000 }).toMatch(/^talk:/);
  const at = await other.page.evaluate((n) => window.PlazaDebug().wanderers[n], idle);
  await page.waitForTimeout(13000); // past the server's lease: the window renews it
  expect(await holdOn(other.page, idle)).toMatch(/^talk:/);
  const still = await other.page.evaluate((n) => window.PlazaDebug().wanderers[n], idle);
  expect(Math.hypot(still.x - at.x, still.z - at.z)).toBeLessThan(0.6);
  const busy = await post(request, '/api/island/resident/talk', other.token, { n: idle });
  expect(busy.status).toBe(409); expect(busy.data.message).toContain('심부름꾼님과 이야기 중');
  await choose('2'); // 섬 소문
  await expect(page.locator('.lostRequestLine').first()).toHaveText(/「.+」/);
  await expect(choices).toHaveCount(4);
  await choose('3'); // nothing to ask
  await expect(page.locator('.lostRequestLine').first()).toHaveText('「오늘은 괜찮아요. 마음만 받을게요!」');
  await page.keyboard.press('4'); await expect(dialog).not.toHaveClass(/talkMode/); // 잘 가요
  await expect.poll(() => holdOn(other.page, idle), { timeout: 15000 }).toBe(null);
  // the asker: the request (their name on the window) before the choices, then the tracker
  const askers = Object.entries(view.marks).filter(([, m]) => m === 'new').map(([n]) => Number(n));
  expect(askers.length).toBeGreaterThan(0);
  const before = (await get(request, '/api/points', token)).data.balance;
  await talkTo(askers[0]);
  await expect(page.locator('#plazaDialogTitle')).not.toHaveText('');
  await expect(page.locator('.lostRequestLine').first()).toHaveText(/전해 줄래요|못 봤어요|사다 줄래요|필요한데/);
  await expect(page.locator('#plazaDialog .lookMeta')).toContainText(/처음 본 사이 ♥/); // 호감도 (the first talk of the day +1)
  await close();
  const track = (await get(request, '/api/island/errands', token)).data.track;
  expect(track).toHaveLength(1);
  await expect(page.locator('#questTracker')).toContainText('심부름');
  if (track[0].to === askers[0]) { await expectNoScriptError(page); return; } // (a store errand: the good is general-store's test)
  // the one it is for (and, for someone to find, back to the asker): paid once
  await talkTo(track[0].to); await close();
  let now = (await get(request, '/api/island/errands', token)).data;
  if (now.done === 0) { await talkTo(now.track[0].to); await close(); now = (await get(request, '/api/island/errands', token)).data; }
  expect(now.done).toBe(1);
  expect([1500, 2000]).toContain((await get(request, '/api/points', token)).data.balance - before);
  await expectNoScriptError(page);
  await who.context.close(); await other.context.close();
});
