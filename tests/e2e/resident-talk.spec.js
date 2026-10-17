const { test, expect } = require('@playwright/test');
const { shopper, get, expectNoScriptError } = require('./skin-support');

// v1.10.91 주민 대화·심부름 (사용자 2026-10-18): any walking islander talks (name, their own words); the day's errands
// show a star over the asker, the tracker says where to go, and the one at the end pays once. PC and phone.
test('주민 대화: 걷는 주민에게 말 걸기, 심부름 받고 끝내면 사례', async ({ browser, request }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '심부름꾼', 500000, 'male');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const dialog = page.locator('#plazaDialog');
  // stand by islander n (they stroll: next to them again until one stands and the prompt is theirs), then Space
  // (they stand 3-9 s at a stop: next to them again, Space while the prompt is theirs, until the talk is open)
  const talkTo = async (n) => {
    await page.locator('#plazaStage').focus();
    await expect.poll(async () => {
      if (/talkMode/.test(await dialog.getAttribute('class') || '')) return true;
      const ready = await page.evaluate((n) => { const d = window.PlazaDebug(); if (d.near === `resident:${n}`) return true; const w = d.wanderers.find((o) => o.n === n); window.PlazaWarp(w.x + 1.1, w.z); return false; }, n);
      if (ready) { await page.keyboard.press('Space'); await page.waitForTimeout(800); } else await page.waitForTimeout(500);
      return /talkMode/.test(await dialog.getAttribute('class') || '');
    }, { timeout: 120000, intervals: [200] }).toBe(true);
    expect(await page.evaluate(() => window.PlazaDebug().talkView?.id)).toBe(`resident:${n}`); // the talk camera (사용자 2026-10-18: every talk)
  };
  const close = async () => { await page.keyboard.press('Escape'); await expect(dialog).not.toHaveClass(/talkMode/); };
  const view = (await get(request, '/api/island/errands', token)).data;
  expect(view.total).toBe(3);
  const askers = Object.entries(view.marks).filter(([, m]) => m === 'new').map(([n]) => Number(n));
  expect(askers.length).toBeGreaterThan(0);
  const before = (await get(request, '/api/points', token)).data.balance;
  // the asker: the request (their name on the window), then the tracker
  await talkTo(askers[0]);
  await expect(page.locator('#plazaDialogTitle')).not.toHaveText('');
  await expect(page.locator('.lostRequestLine').first()).toHaveText(/전해 줄래요|못 봤어요/);
  await expect(page.locator('#plazaDialog .lookMeta')).toContainText(/처음 본 사이 ♥/); // 호감도 (the first talk of the day +1)
  await close();
  const track = (await get(request, '/api/island/errands', token)).data.track;
  expect(track).toHaveLength(1);
  await expect(page.locator('#questTracker')).toContainText('심부름');
  // the one it is for (and, for someone to find, back to the asker): paid once
  await talkTo(track[0].to); await close();
  let now = (await get(request, '/api/island/errands', token)).data;
  if (now.done === 0) { await talkTo(now.track[0].to); await close(); now = (await get(request, '/api/island/errands', token)).data; }
  expect(now.done).toBe(1);
  expect([1500, 2000]).toContain((await get(request, '/api/points', token)).data.balance - before);
  // someone else, with nothing for me: their own words
  const idle = [...Array(10).keys()].find((n) => !(n in now.marks));
  if (idle != null) { await talkTo(idle); await expect(page.locator('.lostRequestLine').first()).toHaveText(/「.+」/); await close(); }
  await expectNoScriptError(page);
  await who.context.close();
});
