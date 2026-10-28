const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, standAt, expectNoScriptError } = require('./skin-support');

// X1 크리스마스 에셋 (gamecenter-notes docs/asset-proposal-christmas-20261027.md): the sweater (assets 78, made on the slim
// body -- baked, not narrowed again) and the earmuffs (77, a hat: not narrowed, no hair cover) in the coin shop like the 46
// winter clothes; the five house pieces (76) the Christmas stamp shop gives, placed in a house (the stocking rack hung on the
// back wall). The festival's own pieces (the stall's dress, the snowman, the countdown) are placed by X2.
const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const XMAS = ['xmas.tree_small', 'xmas.fireplace', 'xmas.snow_globe', 'xmas.stocking', 'xmas.gingerbread_house'];

async function shoot(page, request, name, wide) { // a big crop about the middle (a person) or near the whole canvas (a room)
  const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
  const w = Math.min(box.width, wide ? box.width - 20 : 720); const h = Math.min(box.height, wide ? box.height - 20 : 900);
  await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png`, clip: { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h } });
}

test('크리스마스 옷: 스웨터(날씬한 몸 그대로)·털 귀마개 — 코인 상점, 입으면 실물', async ({ browser, request }) => {
  test.setTimeout(180000);
  const { REGISTRY } = require('../../public/plaza/island-assets');
  expect(REGISTRY['wear.winter_outfit_xmas_sweater'].baked).toBe(true); expect(REGISTRY['wear.winter_hat_earmuffs'].baked).toBeUndefined();
  expect(REGISTRY['wear.winter_hat_earmuffs'].fit.cover).toBeUndefined();
  const who = await shopper(browser, request, '크리스마스옷', 5_000_000, 'female');
  const { page, token } = who;
  for (const id of ['avatar_winter_outfit_xmas_sweater', 'avatar_winter_hat_earmuffs']) {
    expect((await post(request, '/api/skins/buy', token, { skinId: id })).status).toBe(200);
    expect((await post(request, '/api/skins/equip', token, { skinId: id })).status).toBe(200);
  }
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.PlazaDebug().wardrobe || []).filter((p) => /winter_/.test(p)).sort()), { timeout: 90000 })
    .toEqual(['wear.winter_hat_earmuffs', 'wear.winter_outfit_xmas_sweater']);
  if (process.env.SHOT_DIR) { // by day: the front, from behind at a slant (the earmuffs' side), running toward the camera
    const admin = await adminToken(request);
    await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'day' } });
    await page.evaluate(async () => { const d = window.PlazaDebug(); d.halloween.set(false); await window.PlazaWarp(-26, -58); /* (대청마당, open paving) */ });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { const d = window.PlazaDebug(); d.faceTo(d.x, d.z + 5); d.setCamYaw(0); });
    await page.locator('#plazaStage').focus(); for (let i = 0; i < 3; i++) await page.keyboard.press('KeyQ');
    await page.waitForTimeout(1500); await shoot(page, request, 'sweater-front');
    await page.evaluate(() => window.PlazaDebug().setCamYaw(Math.PI * 0.75)); await page.waitForTimeout(1200); await shoot(page, request, 'earmuffs-side-back');
    await page.evaluate(() => window.PlazaDebug().setCamYaw(0)); await page.waitForTimeout(800);
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await page.waitForTimeout(900);
    await shoot(page, request, 'sweater-run');
    await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft');
    await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'auto' } });
  }
  await expectNoScriptError(page);
  await who.context.close();
});

test('크리스마스 집 가구 다섯: 도장 가게 몫(가구점 진열 없음), 집에 놓으면 실물 — 양말 걸이는 벽에', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const F = require('../../public/plaza/island-furniture'); const H = require('../../public/plaza/island-home');
  const ids = ['xmas_tree_small', 'xmas_fireplace', 'xmas_snow_globe', 'xmas_stocking', 'xmas_gingerbread_house'].map((s) => `${s}__plain`);
  for (const id of ids) expect(F.good(id)).toMatchObject({ event: true, zone: 'event' });
  expect(F.GOODS.some((g) => g.shape.startsWith('xmas_'))).toBe(false);
  expect(H.placeError({ id: 'xmas_stocking__plain', x: 0, z: 0, rot: 0 }, [], 1)).toContain('벽에 거는');
  const a = await shopper(browser, request, `성탄집${isMobile ? 'm' : 'p'}`, 3000000, 'female'); const { page } = a;
  expect((await post(request, '/api/test/login-id', null, { keyId: a.id, loginId: `xmas_${stamp()}`.slice(0, 20) })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  const goTo = async (door, text) => expect.poll(async () => { await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); }, door); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain(text);
  const through = async (door, text, space) => {
    for (let tries = 0; tries < 4 && await page.evaluate(() => window.PlazaDebug().space) !== space; tries += 1) {
      if (await page.locator('#plazaDialog').isVisible()) await page.locator('#plazaCloseBtn').click();
      await goTo(door, text); if (await page.evaluate(() => window.PlazaDebug().space) === space) break;
      await press(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe(space).catch(() => {});
    }
    expect(await page.evaluate(() => window.PlazaDebug().space)).toBe(space);
  };
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through('townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'red' })).status).toBe(200);
  const pieces = (await post(request, '/api/test/home/furniture', a.token, { ids })).data.pieces;
  await through('room:exit', '나가기', 'island');
  await through(`home:${lot}`, '내 집 들어가기', 'home');
  // the 오두막 (hz 4.35): the fireplace against the back wall, the rack hung beside it, the tree in the corner, the small two in front
  const spots = { xmas_fireplace__plain: [0, 4.025], xmas_stocking__plain: [-2, 4.31], xmas_tree_small__plain: [1.75, 3.25], xmas_snow_globe__plain: [-1.25, 2.75], xmas_gingerbread_house__plain: [-0.5, 2.75] };
  for (const p of pieces) { const [x, z] = spots[p.id]; const r = await post(request, '/api/home/place', a.token, { uid: p.uid, x, z, rot: 0 }); expect(r.status, `${p.id} ${JSON.stringify(r.data)}`).toBe(200); }
  await through('home:exit', '나가기', 'island'); await through(`home:${lot}`, '내 집 들어가기', 'home'); // (in again: the room as the server has it)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().home()?.pieces.length), { timeout: 15000 }).toBe(5);
  await expect.poll(() => page.evaluate((list) => list.map((id) => window.PlazaDebug().assets.shown?.[id]), XMAS), { timeout: 90000 }).toEqual(XMAS.map(() => 'model'));
  if (process.env.SHOT_DIR) { // from the front of the room toward the back wall, by day and at dusk (the tree's lights, the fire)
    const admin = await adminToken(request);
    for (const mode of ['day', 'evening']) {
      await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } });
      await page.evaluate(() => { const d = window.PlazaDebug(); const lotO = window.IslandHome.lotById(d.home().lot); const w = window.IslandHome.world(lotO, 0.75, 0); const c = window.IslandHome.world(lotO, 0.75, 4); d.teleport(w.x, w.z); const y = Math.atan2(c.x - w.x, c.z - w.z); d.faceYaw(y); d.setCamYaw(y + Math.PI); });
      await page.locator('#plazaStage').focus(); for (let i = 0; i < 2; i++) await page.keyboard.press('KeyQ');
      await page.waitForTimeout(3000); await shoot(page, request, `home-${mode}`, true);
    }
    await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'auto' } });
  }
  await through('home:exit', '나가기', 'island');
  await expectNoScriptError(page);
  await a.context.close();
});
