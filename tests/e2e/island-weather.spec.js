const { test, expect } = require('@playwright/test');
const { shopper, adminToken, get, expectNoScriptError } = require('./skin-support');

// A4 날씨 (IDEAS 「함께하는 섬」): the server's weather is the same for everyone; the administrator can hold it -- rain falls
// round me (snow in the winter zone), a rainbow arcs over the sea; 자동 lets the server clock decide again. PC 전용 (the
// same scene on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('섬 날씨: 관리자가 비·무지개로 정하면 모두의 섬이 따라 바뀌고, 겨울 구역은 눈, 자동으로 되돌림', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '날씨', 500000, 'male');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const admin = await adminToken(request);
  const set = (mode) => request.post('/api/admin/island/weather', { headers: { 'X-Session-Token': admin }, data: { mode } });
  expect((await request.post('/api/admin/island/weather', { data: { mode: 'rain' } })).status()).toBe(401); // the administrator only
  const weather = () => page.evaluate(() => window.PlazaDebug().weather());
  try {
    expect((await set('rain')).status()).toBe(200);
    expect((await get(request, '/api/island/weather', token)).data).toMatchObject({ mode: 'rain', kind: 'rain', fixed: true });
    await expect.poll(async () => (await weather()).kind, { timeout: 15000 }).toBe('rain');
    // where I stand decides rain or snow: a summer spot rains, a winter spot snows
    const spots = await page.evaluate(() => { const T = window.IslandTerrain; const now = Date.now(); const out = {}; for (let a = 0; a < 360 && Object.keys(out).length < 2; a += 15) { const x = Math.cos(a * Math.PI / 180) * 60; const z = Math.sin(a * Math.PI / 180) * 60; const s = T.seasonAt(x, z, now); if ((s === 'winter' || s === 'summer') && !out[s] && T.walkable(x, z)) out[s] = { x, z }; } return out; });
    if (spots.summer) { await page.evaluate(({ x, z }) => window.PlazaDebug().teleport(x, z), spots.summer); await expect.poll(async () => (await weather()).rain, { timeout: 10000 }).toBe(true); }
    if (spots.winter) { await page.evaluate(({ x, z }) => window.PlazaDebug().teleport(x, z), spots.winter); await expect.poll(async () => (await weather()).snow, { timeout: 10000 }).toBe(true); }
    expect((await set('rainbow')).status()).toBe(200);
    await expect.poll(async () => (await weather()).bow, { timeout: 15000 }).toBe(true);
    expect((await weather()).rain || (await weather()).snow).toBe(false);
  } finally { await set('auto'); }
  expect((await get(request, '/api/island/weather', token)).data).toMatchObject({ mode: 'auto', fixed: false });
  await expectNoScriptError(page);
  await who.context.close();
});
