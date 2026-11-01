const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError, spaceOn, revealTalk } = require('./skin-support');
const P = require('../../public/plaza/island-projects.js');

// v1.10.222 섬 가꾸기 사업 (gamecenter-notes docs/spending-sinks-20261025.md ①): the 기부함 shows the project filling (mine, the
// savings); filled -- its works that day (the fence round the fountain, the sign, 바위 by it to talk to: the roster on); the next
// day open -- the new fountain in the old one's place, a sign before it, SPACE: who gave; then the flower path. PC and phone;
// with SHOT_DIR the photos (the fountain's works and open, the flower path from above too).
test('섬 가꾸기: 기부함 막대, 다 모이면 공사(울타리·안내판·바위), 다음 날 열림(새 분수·명판), 꽃길', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const a = await shopper(browser, request, isMobile ? '섬가꿈m' : '섬가꿈', 3000000, 'female'); const { page } = a;
  const tp = (body) => post(request, '/api/test/projects', a.token, body);
  expect((await tp({ reset: true })).status).toBe(200);
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const scene = () => page.evaluate(() => window.PlazaDebug().projects());
  // the 기부함 (its own box: the server takes a 기부 there only): 400,000 -- the bar and mine
  const atBox = async () => { await page.evaluate(async () => { const d = window.PlazaDebug().doors.donate; await window.PlazaWarp(d.x, d.z); window.PlazaDebug().place('donate'); }); await spaceOn(page, '', isMobile); await expect(page.locator('#donationDialog')).toBeVisible(); };
  const give = async (amount) => { await page.locator('#donationAmount').fill(String(amount)); await page.locator('#donationSubmit').click(); const done = page.waitForResponse((r) => r.url().endsWith('/api/donation') && r.request().method() === 'POST'); await page.locator('#donationSubmit').click(); expect((await done).status()).toBe(200); };
  await atBox(); await give(400000);
  const bar = page.locator('#donationProject'); await expect(bar).toContainText('대청마당 분수 새 단장'); await expect(bar).toContainText('400,000P / 1,000,000P'); await expect(bar).toContainText('내가 보탠 400,000P');
  await shot('donation-bar', 600);
  // filled (and 100,000 over: saved) -- the works today
  await give(700000);
  await expect(bar).toContainText('공사 중'); await expect(bar).toContainText('적립 100,000P');
  await page.locator('#donationCloseBtn').click();
  const day = (await tp({})).data.day; await request.post('/api/test/roster', { data: { on: true, day } });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  try {
    await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['works:fountain']);
    await expect.poll(async () => (await scene()).keeper, { timeout: 20000 }).toBe(true);
    const k = P.SITES.fountain.keeper; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 0.6, z + 2.2); g.setCamYaw(0.25); g.setCamPitch?.(0.12); }, [k.x, k.z]);
    await shot('works');
    await expect(page.locator('#plazaHint')).toContainText('바위', { timeout: 10000 }); await expect.poll(() => spaceOn(page, 'works:keeper', isMobile), { timeout: 10000 }).toBe(true); await revealTalk(page);
    await expect(page.locator('#plazaDialog')).toContainText('내일이면 분수가 열려요'); await expect(page.locator('#plazaDialog')).not.toContainText('둘러볼게요'); await expect(page.locator('#plazaDialog')).not.toContainText('{me}'); /* (총괄 222 검토 1: their own talk, no shop) */ await shot('works-talk', 600);
    await page.keyboard.press('Escape');
  } finally { await request.post('/api/test/roster', { data: { on: false } }); }
  // the next day: open -- the new fountain, its sign; SPACE at it: who gave
  expect((await tp({ nextDay: true })).data.state.open.map((o) => o.id)).toEqual(['fountain']);
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['open:fountain']); expect((await scene()).dropTop).toBeGreaterThan(2.5);
  const q = P.SITES.fountain.plaque; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 1.2, z + 3.4); g.setCamYaw(0.3); g.setCamPitch?.(0.15); }, [q.x, q.z]);
  await shot('fountain-open');
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z + 1), [q.x, q.z]); await expect.poll(() => spaceOn(page, 'plaque:fountain', isMobile), { timeout: 10000 }).toBe(true); await revealTalk(page);
  await expect(page.locator('#plazaDialog')).toContainText(isMobile ? '섬가꿈m' : '섬가꿈'); await shot('plaque', 600); await page.keyboard.press('Escape');
  // the flower path: filled from the savings and a 기부, works, open
  const v = (await get(request, '/api/island/projects', a.token)).data; expect([v.cur.id, v.cur.raised]).toEqual(['flower_path', 100000]);
  await atBox(); await give(1400000); await page.locator('#donationCloseBtn').click();
  expect((await tp({ nextDay: true })).data.state.open.map((o) => o.id)).toEqual(['fountain', 'flower_path']);
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['open:flower_path', 'open:fountain']);
  const s = P.PLANTERS[0]; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x - 3, z + 4); g.setCamYaw(2.2); g.setCamPitch?.(0.2); }, [s.x, s.z]);
  await shot('flower-path', 2500);
  if (process.env.SHOT_DIR) { await page.evaluate(([x, z]) => window.PlazaDebug().overview(true, [x, 45, z]), [(P.PLANTERS[0].x + P.PLANTERS[P.PLANTERS.length - 1].x) / 2, (P.PLANTERS[0].z + P.PLANTERS[P.PLANTERS.length - 1].z) / 2]); await shot('flower-path-above', 2500); await page.evaluate(() => window.PlazaDebug().overview(false)); }
  await tp({ reset: true });
  await expectNoScriptError(page); await a.context.close();
});
