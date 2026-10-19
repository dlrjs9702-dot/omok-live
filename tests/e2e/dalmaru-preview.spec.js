const { test, expect } = require('@playwright/test');
const { shopper, get, post, adminToken, expectNoScriptError } = require('./skin-support');

// 달마루섬 개편 1단계 (gamecenter-notes docs/dalmaru-implementation-20261019.md): the new island's land behind the
// administrator's preview switch -- the server tells only an administrator, only while it is on; a preview page walks
// the bare island on its own (nothing of its position goes to the server), with its own map. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test('달마루섬 미리보기: 관리자 스위치일 때만 새 섬, 미리보기 화면은 혼자 걷고 위치를 보내지 않음', async ({ browser, request }) => {
  test.setTimeout(240000);
  const admin = await adminToken(request);
  const who = await shopper(browser, request, '미리보기', 0, 'male'); const { page, token } = who;
  try {
    expect((await get(request, '/api/island/map', admin)).data.map).toBe('classic'); // (off by default)
    expect((await post(request, '/api/admin/switches', admin, { dalmaruPreview: true })).data.switches.dalmaruPreview).toBe(true);
    expect((await get(request, '/api/island/map', admin)).data.map).toBe('dalmaru');
    expect((await get(request, '/api/island/map', token)).data.map).toBe('classic'); // (everyone else: the island they have)
    // a page told to preview (as app.js keeps it for an administrator): the new land, walked on this screen only
    const posted = []; page.on('request', (r) => { if (r.url().includes('/api/plaza/state')) posted.push(r.url()); });
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); localStorage.setItem('gc.islandMap', 'dalmaru'); });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running).catch(() => false), { timeout: 90000 }).toBe(true); // (the page may reload itself on the way)
    // (the page asked the server, which says 'classic' to a guest -- so it went back: the preview is the administrator's)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('gc.islandMap')).catch(() => 'reloading'), { timeout: 30000 }).toBe(null);
    await page.evaluate(() => localStorage.setItem('gc.islandMap', 'dalmaru'));
    await page.route('**/api/island/map', (route) => route.fulfill({ json: { ok: true, map: 'dalmaru' } })); // (as for an administrator)
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running).catch(() => false), { timeout: 90000 }).toBe(true); // (the page may reload itself on the way)
    expect(await page.evaluate(() => window.IslandTerrain.MAP)).toBe('dalmaru');
    const at = await page.evaluate(() => { const d = window.PlazaDebug(); const P = window.IslandTerrain.dalmaru.PLAZA; return { x: d.x, z: d.z, inPlaza: Math.abs(d.x - P.x) < P.hw && d.z > P.d0 && d.z < P.d1 }; });
    expect(at.inPlaza).toBe(true); // 대청마당
    posted.length = 0;
    await page.locator('#plazaStage').focus(); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowUp');
    expect(Math.hypot(...(await page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z])).map((v, i) => v - [at.x, at.z][i]))).toBeGreaterThan(0.5);
    await page.waitForTimeout(3500); expect(posted).toHaveLength(0); // (walked here alone)
    const bridge = await page.evaluate(() => { const b = window.IslandTerrain.bridges[0]; window.PlazaDebug().teleport(b.x, b.z); return b; });
    await page.waitForTimeout(800);
    expect(await page.evaluate(([x, z]) => window.IslandTerrain.walkable(x, z) && window.IslandTerrain.heightAt(x, z) > 0.5, [bridge.x, bridge.z])).toBe(true); // 윤슬다리 over the water
    expect(await page.evaluate(() => window.IslandTerrain.walkable(0, 60))).toBe(false); // 윤슬만
    await expectNoScriptError(page);
  } finally {
    await post(request, '/api/admin/switches', admin, { dalmaruPreview: false });
    await who.context.close();
  }
});
