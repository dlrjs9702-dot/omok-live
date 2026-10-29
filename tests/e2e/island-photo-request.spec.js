const { test, expect } = require('@playwright/test');
const { shopper, post, get, standAt, spaceOn, expectNoScriptError } = require('./skin-support');
const Fishing = require('../../lib/island-fishing');
const T = require('../../public/plaza/island-terrain.js');

// Q2 사진 부탁 B안 (gamecenter-notes docs/interact-quests-20261029.md 1, 사용자 「B안으로 가자」): the tourist stands in a photo
// spot; a shot before a word pays nothing; a word -- 「여기서 저 좀 찍어 주세요!」, posing -- then a shot with them out of the
// frame (my back to them) is 「안 들어왔어요」, one from outside the spot is refused, one facing them from the spot pays 6,000P
// and the request ends. PC and phone.
test('관광객 사진 부탁: 말 안 걸고 ×, 등 돌리고 ×, 명소 밖 ×, 마주 보고 찍으면 6,000P', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 400000 : 240000);
  const who = await shopper(browser, request, isMobile ? '사진사m' : '사진사', 0, 'female'); const { page, token } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  let ev = null; // (an islander in a photo spot just now: asked again till one is)
  await expect.poll(async () => { ev = (await post(request, '/api/test/island/photo', null, {})).data.event; return Boolean(ev); }, { timeout: 120000, intervals: [2000] }).toBe(true);
  const spot = Fishing.photoSpotAt(ev.x, ev.z); expect(spot).toBeTruthy();
  const balance = async () => (await get(request, '/api/points', token)).data.balance;
  const before = await balance();
  // a shot before a word: nothing
  expect((await post(request, '/api/island/event', token, { id: ev.id, shot: true })).data.error).toBeTruthy();
  // by them, a word: asked, posing
  const by = await page.evaluate(([x, z]) => { const T2 = window.IslandTerrain; for (let k = 0; k < 16; k += 1) { const a = (k / 16) * Math.PI * 2; const p = { x: x + Math.sin(a) * 1.6, z: z + Math.cos(a) * 1.6 }; if (T2.walkable(p.x, p.z)) return p; } return { x: x + 1.6, z }; }, [ev.x, ev.z]);
  await standAt(request, who, by.x, by.z);
  await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaDebug().faceTo(x, z), [ev.x, ev.z]); return spaceOn(page, `ev:photo:${ev.id}`, isMobile); }, { timeout: 30000 }).toBe(true);
  await expect(page.locator('#toast')).toContainText('여기서 저 좀 찍어 주세요');
  if (process.env.SHOT_DIR) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-photo-pose.png` }); }
  await page.waitForTimeout(2200); // (the pose: 2 s)
  const shoot = async () => { await page.locator('#islandPhotoTab').click(); await expect(page.locator('#photoNowBtn')).toBeVisible(); await page.evaluate(() => { HTMLAnchorElement.prototype.click = () => {}; }); await page.locator('#photoNowBtn').click(); };
  const leave = async () => { if (await page.locator('#photoCloseBtn').isVisible()) await page.locator('#photoCloseBtn').click(); };
  // my back to them, the camera drawn in behind me (between us): not in the picture -- from 8.5~11.5 m off, in the same spot
  const stand = (() => { for (let d = 8.5; d <= 11.5; d += 0.5) for (let k = 0; k < 24; k += 1) { const a = (k / 24) * Math.PI * 2; const p = { x: ev.x + Math.sin(a) * d, z: ev.z + Math.cos(a) * d }; if (T.walkable(p.x, p.z) && Fishing.photoSpotAt(p.x, p.z)?.id === spot.id) return p; } return by; })();
  await standAt(request, who, stand.x, stand.z);
  await page.locator('#plazaStage').focus(); for (let i = 0; i < 4; i += 1) await page.keyboard.press('KeyQ'); // (drawn in)
  await page.evaluate(([tx, tz]) => { const d = window.PlazaDebug(); d.faceTo(d.x + (d.x - tx), d.z + (d.z - tz)); d.setCamYaw(Math.atan2(tx - d.x, tz - d.z)); }, [ev.x, ev.z]); await page.waitForTimeout(800);
  await shoot(); await expect(page.locator('#toast')).toContainText('사진에 안 들어왔어요', { timeout: 15000 });
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-photo-out.png` });
  await leave(); expect(await balance()).toBe(before);
  // from outside the spot (the server's check)
  const out = (() => { for (let d = spot.r + 2; d < spot.r + 30; d += 2) for (let k = 0; k < 12; k += 1) { const a = (k / 12) * Math.PI * 2; const p = { x: spot.x + Math.sin(a) * d, z: spot.z + Math.cos(a) * d }; if (T.walkable(p.x, p.z) && !Fishing.photoSpotAt(p.x, p.z)) return p; } return null; })();
  if (out) { await standAt(request, who, out.x, out.z); const r = await post(request, '/api/island/event', token, { id: ev.id, shot: true }); expect(r.status).toBe(409); expect(['OFF_SPOT', 'PHOTO_FAR']).toContain(r.data.error); }
  // facing them from the spot: in the picture -- paid, the request over
  await standAt(request, who, stand.x, stand.z);
  await page.evaluate(([tx, tz]) => { const d = window.PlazaDebug(); d.faceTo(tx, tz); d.setCamYaw(Math.atan2(d.x - tx, d.z - tz)); }, [ev.x, ev.z]);
  if (process.env.SHOT_DIR) { await page.waitForTimeout(600); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-photo-in.png` }); }
  await shoot(); await expect(page.locator('#toast')).toContainText('잘 나왔네요', { timeout: 15000 });
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-photo-done.png` });
  await leave(); expect(await balance()).toBe(before + 6000);
  expect(((await get(request, '/api/test/island/events', token)).data.events || []).some((e) => e.id === ev.id)).toBe(false);
  await expectNoScriptError(page); await who.context.close();
});
