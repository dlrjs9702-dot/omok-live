const { test, expect } = require('@playwright/test');
const { shopper, post } = require('./skin-support');
const R = require('../../public/plaza/island-roster.js'); const C = require('../../public/plaza/island-cast.js');

// 문제 기록 1103 9 (사용자 「일하는 자리는 모두 근무표 주민이」): the 박물관's 관장 the day's 한결·하람·이솔 by name; 느티 at the 정자
// on a day his 부탁 is not out; the guide's work at the 출석대 -- its stamp card's 「섬 안내」, the talk under the keeper's name.
// PC and phone.
test('근무 자리: 박물관 관장은 그날 근무 주민, 느티는 매일 정자, 안내는 출석대 주민이', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const day = '2026-11-05';
  expect((await post(request, '/api/test/roster', null, { on: true, day })).status).toBe(200);
  const who = await shopper(browser, request, isMobile ? '근무m' : '근무', 0, 'female'); const { page } = who;
  try {
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const r = R.rosterOf(day); const name = (n) => C.RESIDENTS[n].name;
    const press = async () => { if (isMobile) await page.locator('#plazaHint').tap().catch(() => {}); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
    const hintAt = (x, z, text) => expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [x, z]); await page.waitForTimeout(700); return page.locator('#plazaHint').textContent(); }, { timeout: 30000, intervals: [500] }).toContain(text);
    // 느티 at the 정자 (the tests' quest week is not his)
    const P = await page.evaluate(() => window.IslandTerrain.VILLAGE.grandpa); // (his 부탁's week his quest figure, else the day keeper -- 느티 either way)
    await hintAt(P.x + 1.1, P.z, `${name(r.posts.pavilion)}`);
    // the 출석대: its keeper, 「섬 안내」 -- the guide's topics under their name
    const A = await page.evaluate(() => window.PlazaDebug().doors.attendance); await hintAt(A.x, A.z, '출석');
    await press(); await page.getByRole('button', { name: '섬 안내' }).click();
    await expect(page.locator('#plazaDialogTitle')).toHaveText(`출석·안내 · ${name(r.posts.plaza)}`);
    await expect(page.getByRole('button', { name: '처음부터 다시 배우기' })).toBeVisible();
    await page.evaluate(() => document.getElementById('plazaDialog').close());
    // the 박물관: its 관장 the day's
    for (let k = 0; k < 6 && await page.evaluate(() => window.PlazaDebug().space) !== 'museum'; k += 1) { await page.evaluate(() => { const d = window.PlazaDebug(); const w = d.doors.museum; if (w) d.teleport(w.x, w.z); else d.place('museum'); }); await page.waitForTimeout(700); await press(); await page.waitForTimeout(1500); }
    expect(await page.evaluate(() => window.PlazaDebug().space)).toBe('museum');
    const t = await page.evaluate(() => window.IslandMuseum.world(window.IslandMuseum.TALK.lx, window.IslandMuseum.TALK.lz));
    await hintAt(t.x, t.z, `박물관 · ${name(r.posts.museum)} · 말 걸기`);
  } finally { await post(request, '/api/test/roster', null, { on: false }); await who.context.close(); }
});
