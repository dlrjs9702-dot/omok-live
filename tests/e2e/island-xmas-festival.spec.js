const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, spaceOn, standAt, expectNoScriptError } = require('./skin-support');

// X2 크리스마스 (gamecenter-notes docs/asset-proposal-christmas-20261027.md): in its days the stall wears its dress and the
// host's sack stands by; a gift from the sack goes in my hands and to the islander named on it (in their talk); the snow
// field rolls three balls, stacks and dresses them -- my snowman on the field with the day's others; the last evening's
// gathering by the plaza's tree. PC and phone.
const DIR = process.env.SHOT_DIR;
async function shoot(page, name, w = 720, h = 900) {
  if (!DIR) return; const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
  const cw = Math.min(box.width - 10, w); const ch = Math.min(box.height - 10, h);
  await page.screenshot({ path: `${DIR}/${test.info().project.name}-${name}.png`, clip: { x: box.x + (box.width - cw) / 2, y: box.y + (box.height - ch) / 2, width: cw, height: ch } });
}
// stand at w looking at o, the camera behind me (or, front: before me, looking back at me)
const look = (page, w, o, front = false) => page.evaluate(([w, o, front]) => { const d = window.PlazaDebug(); d.teleport(w.x, w.z); const y = Math.atan2(o.x - w.x, o.z - w.z); d.faceYaw(y); d.setCamYaw(front ? y : y + Math.PI); }, [w, o, front]);

test('크리스마스 행사: 가판대 덧씌움·선물 자루, 선물 받아 이웃에게, 눈사람 굴리고 쌓고 꾸미기, 성탄 저녁 모임', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 600000 : 300000);
  expect((await post(request, '/api/test/festival/clock', null, { at: Date.parse('2026-12-21T12:00:00+09:00') })).status).toBe(200);
  const admin = await adminToken(request);
  try {
    const who = await shopper(browser, request, isMobile ? '성탄m' : '성탄p', 0, 'female'); const { page, token } = who;
    await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
    await page.evaluate(() => window.PlazaDebug().halloween.set(false));
    if (DIR) { await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'day' } }); await request.post('/api/admin/island/decor', { headers: { 'X-Session-Token': admin }, data: { mode: 'winter' } }); await request.post('/api/admin/island/weather', { headers: { 'X-Session-Token': admin }, data: { mode: 'clear' } }); }
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().festival()?.on), { timeout: 30000 }).toBe('christmas-2026');
    expect(await page.evaluate(() => window.PlazaDebug().festival().sign)).toBe('🎄 크리스마스');
    const P = await page.evaluate(() => window.IslandCalendar.PLACES);
    await expect.poll(() => page.evaluate(() => ['xmas.stall_dress', 'xmas.gift_sack'].map((id) => window.PlazaDebug().assets.shown?.[id])), { timeout: 90000 }).toEqual(['model', 'model']);
    expect(await page.evaluate(() => window.PlazaDebug().festival().doors)).toEqual(expect.arrayContaining(['fest:host', 'fest:stall', 'fest:sack'])); // (no harvest, no feast)
    expect(await page.evaluate(() => window.PlazaDebug().festival().doors.includes('fest:harvest'))).toBe(false);
    const front = (p, d, turn = 0) => ({ x: p.x - Math.sin(p.yaw + turn) * d, z: p.z - Math.cos(p.yaw + turn) * d }); // (the stall's front is its -Z)
    await look(page, front(P.stall, 6), P.stall); await page.waitForTimeout(2500); await shoot(page, 'stall-front', 900, 700);
    await look(page, front(P.stall, 6, Math.PI / 4), P.stall); await page.waitForTimeout(1500); await shoot(page, 'stall-45', 900, 700);

    // 선물 배달: SPACE by the sack -> a gift in my hands for an islander; in their talk, 「선물 배달 왔어요」 -> a stamp
    const sack = await page.evaluate(() => window.PlazaDebug().festival().at['fest:sack']);
    await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaWarp(x, z), sack); await page.waitForTimeout(400); return spaceOn(page, 'fest:sack', isMobile); }, { timeout: 30000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().festival().xmas?.gift), { timeout: 15000 }).toMatch(/^(red|green|blue)$/);
    await expect(page.locator('#toast')).toContainText('갖다주세요');
    const gift = (await get(request, '/api/island/festival', token)).data.festival.gift;
    await page.evaluate(() => { const d = window.PlazaDebug(); d.faceTo(d.x, d.z + 5); d.setCamYaw(0); });
    await page.locator('#plazaStage').focus(); for (let i = 0; i < 3; i++) await page.keyboard.press('KeyQ');
    await page.waitForTimeout(1500); await shoot(page, 'gift-carry');
    const dialog = page.locator('#plazaDialog'); const giveBtn = dialog.locator('button[data-topic="xmasGift"]');
    await expect.poll(async () => {
      if (await giveBtn.isVisible()) return true;
      if (await dialog.isVisible()) await page.keyboard.press('Escape');
      await post(request, '/api/test/island/free-residents', token, {});
      await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, gift.n);
      await page.waitForTimeout(1500); for (let k = 0; k < 6 && !(await giveBtn.isVisible()); k += 1) { await page.keyboard.press('Space'); await page.waitForTimeout(200); }
      return giveBtn.isVisible();
    }, { timeout: 120000, intervals: [300] }).toBe(true);
    await shoot(page, 'gift-talk', 1000, 900);
    const gave = page.waitForResponse((r) => r.url().includes('/api/island/festival/gift')); await giveBtn.click(); expect((await gave).status()).toBe(200);
    await expect(page.locator('#toast')).toContainText('선물을 건넸어요');
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().festival().xmas?.gift), { timeout: 10000 }).toBe(null);

    // others' snowmen first (the field's day: Low files), then mine -- three balls rolled, set down, dressed
    const S = P.snow;
    await Promise.all([0, 1, 2].map(async (k) => {
      const issued = (await post(request, '/api/admin/keys', admin, { label: `눈사람${k}` })).data; const key = issued.html.match(/name="token" value="([^"]+)"/)[1];
      const res = await request.post('/guest-entry', { headers: { 'X-Forwarded-For': `10.9.${k}.${Math.floor(Math.random() * 200) + 1}`, 'Content-Type': 'application/x-www-form-urlencoded' }, data: `token=${encodeURIComponent(key)}` });
      const t = (await res.text()).match(/data-session="([^"]+)"/)[1];
      const z = S.z - 2.5 + k * 2.5; const walk = async (x0, x1) => { for (let i = 0; i <= 6; i += 1) { await post(request, '/api/plaza/state', t, { x: x0 + ((x1 - x0) * i) / 6, z, yaw: x1 > x0 ? Math.PI / 2 : -Math.PI / 2, moving: i < 6 }); await new Promise((r) => { setTimeout(r, 250); }); } }; // (steps: a jump is corrected)
      await walk(S.x - 3.5, S.x - 3.5);
      for (let b = 0; b < 3; b += 1) { const [x0, x1] = b % 2 ? [S.x + 1, S.x - 3.5] : [S.x - 3.5, S.x + 1]; await post(request, '/api/island/festival/snowman', t, { step: 'roll' }); await walk(x0, x1); await new Promise((r) => { setTimeout(r, (2 - b) * 1500 + k * 400); }); const dropped = await post(request, '/api/island/festival/snowman', t, { step: 'drop' }); expect(dropped.status, JSON.stringify(dropped.data)).toBe(200); }
      expect((await post(request, '/api/island/festival/snowman', t, { step: 'finish', parts: { carrot: 1, coal: 2 + k, twig: k, bucket: k > 0 ? 1 : 0, scarf: k === 2 ? 1 : 0 } })).status).toBe(200);
    }));
    await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [S.x + 2, S.z + S.d / 2 - 1]);
    const snowStep = async (step) => { const r = page.waitForResponse((x) => x.url().includes('/api/island/festival/snowman')); await expect.poll(() => spaceOn(page, 'fest:snow', isMobile), { timeout: 15000 }).toBe(true); const res = await r; expect(res.status(), `${step}: ${await res.text()}`).toBe(200); };
    for (let b = 0; b < 3; b += 1) { // (rolled about: set down 4 m or more from where it started -- the server's 3 m)
      await standAt(request, who, S.x + (b % 2 ? 2.5 : -2.5), S.z);
      await snowStep('roll'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().festival().xmas?.rolling)).toBe(true);
      if (isMobile) await page.waitForTimeout(2200 + (2 - b) * 1500); else { await page.locator('#plazaStage').focus(); await page.keyboard.down('KeyA'); await page.waitForTimeout(2200 + (2 - b) * 1500); await page.keyboard.up('KeyA'); }
      if (b === 0) await shoot(page, 'snow-rolling', 1000, 800);
      await standAt(request, who, S.x + (b % 2 ? -2.5 : 2.5), S.z + 1);
      await snowStep('drop');
    }
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().festival().xmas?.mine.split(',').length), { timeout: 10000 }).toBe(3);
    await expect.poll(() => spaceOn(page, 'fest:snow', isMobile), { timeout: 15000 }).toBe(true);
    const card = page.locator('#snowmanCard'); await expect(card).toBeVisible(); const finish = card.getByRole('button', { name: '다 만들었어요' });
    await expect(finish).toBeDisabled(); await expect(card.locator('.snowPart[aria-pressed="true"]')).toHaveCount(0); // (bare at first: nothing done, nothing to hand in)
    if (DIR) await page.screenshot({ path: `${DIR}/${test.info().project.name}-snow-dress-bare.png` });
    for (const p of ['carrot', 'coal', 'coal', 'bucket', 'scarf']) await card.locator(`.snowPart[data-part="${p}"]`).click();
    await expect(card.locator('.snowPart[data-part="coal"]')).toHaveText('숯 2/5'); await expect(finish).toBeEnabled();
    if (DIR) await page.screenshot({ path: `${DIR}/${test.info().project.name}-snow-dress.png` });
    const done = page.waitForResponse((r) => r.url().includes('/api/island/festival/snowman')); await finish.click(); expect((await done).status()).toBe(200);
    await expect(page.locator('#toast')).toContainText('도장 +3');
    const day = (await get(request, '/api/island/festival', token)).data.snowmen; expect(day.filter((m) => m.mine)).toHaveLength(1); // (the day's field, the other screens' too: the server's list, mine in it)
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().festival().xmas?.snowmen.length), { timeout: 15000 }).toBe(day.length);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().assets.shown?.['snow.ball_low']), { timeout: 60000 }).toBe('model');
    expect((await get(request, '/api/island/festival', token)).data.festival.stamps).toBe(4);
    await look(page, { x: S.x, z: S.z + S.d / 2 + 5 }, { x: S.x, z: S.z }); await page.waitForTimeout(3000); await shoot(page, 'snowmen', 1000, 800);

    // the stall: the six goods; the last evening: the gathering by the plaza's tree (6)
    await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [front(P.stall, 1.6).x, front(P.stall, 1.6).z]);
    await expect.poll(() => spaceOn(page, 'fest:stall', isMobile), { timeout: 15000 }).toBe(true);
    const shop = page.locator('#festivalCard'); await expect(shop.locator('.festivalShop li')).toHaveCount(6); await expect(shop.locator('.festivalTab[aria-pressed="true"]')).toHaveText('가판대'); await expect(shop).toContainText('크리스마스 트리');
    if (DIR) await page.screenshot({ path: `${DIR}/${test.info().project.name}-stall-shop.png` });
    await page.locator('#plazaCloseBtn').click();
    expect((await post(request, '/api/test/festival/clock', null, { at: Date.parse('2026-12-25T19:00:00+09:00') })).status).toBe(200);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.festival?.()?.doors.includes('fest:gather')), { timeout: 60000 }).toBe(true);
    const g = await page.evaluate(() => window.PlazaDebug().festival().at['fest:gather']);
    await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaWarp(x, z), g); await page.waitForTimeout(400); return spaceOn(page, 'fest:gather', isMobile); }, { timeout: 30000 }).toBe(true);
    await expect(page.locator('#toast')).toContainText('도장 +6');
    await expectNoScriptError(page); await who.context.close();
  } finally {
    await post(request, '/api/test/festival/clock', null, { at: 0 });
    if (DIR) { await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'auto' } }); await request.post('/api/admin/island/decor', { headers: { 'X-Session-Token': admin }, data: { mode: 'auto' } }); await request.post('/api/admin/island/weather', { headers: { 'X-Session-Token': admin }, data: { mode: 'auto' } }); }
  }
});
