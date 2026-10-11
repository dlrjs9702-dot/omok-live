const { test, expect } = require('@playwright/test');
const { post } = require('./skin-support');

// v1.10.62 모바일 아일랜드 (IDEAS 2026-10-11): on a touch-only phone the island opens (no classic lobby), a stick walks,
// the hint near a facility is the button that does what Space does, and the chat tab opens the input. 모바일 전용.
test.skip(({ isMobile }) => !isMobile, '모바일 전용 검증');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
const state = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { x: d.x, z: d.z, near: d.near }; });

test('모바일 아일랜드: 조이스틱으로 걷고, 근처 안내를 눌러 시설 창을 열고, 채팅 탭으로 입력한다', async ({ page, request }) => {
  test.setTimeout(90000); // one software-rendered 3D page
  const admin = (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const issued = (await post(request, '/api/admin/keys', admin, { label: '모바일섬' })).data;
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  await post(request, '/api/avatar/gender', token, { gender: 'female' });
  await page.locator('#lobbyView').waitFor({ state: 'visible' });
  await page.evaluate(() => { // the island itself, light: no 3D models (as in plaza.spec)
    localStorage.removeItem('gc.testClassic');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().halloween.set(false));
  await expect(page.locator('#islandStick')).toBeVisible();

  // a thumb on the stick, pushed up: the character walks, and stops when it lets go
  const box = await page.locator('#islandStick').boundingBox();
  const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const before = await state(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 50, id: 1 }] });
  await expect.poll(async () => { const s = await state(page); return Math.hypot(s.x - before.x, s.z - before.z); }).toBeGreaterThan(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const stopped = await state(page);
  await page.waitForTimeout(500);
  const later = await state(page);
  expect(Math.hypot(later.x - stopped.x, later.z - stopped.z)).toBeLessThan(0.3);

  // by the board the hint names it (no key to press) and tapping it opens the board
  const door = await page.evaluate(() => window.PlazaDebug().doors.board);
  await page.evaluate(async (d) => window.PlazaWarp(d.x, d.z + 1.5), door);
  await expect(page.locator('#plazaHint')).toHaveText('게시판');
  await page.locator('#plazaHint').tap();
  await expect(page.locator('#plazaDialogTitle')).toHaveText('게시판');
  expect(await page.evaluate(() => { const d = document.getElementById('plazaDialog'); return d.scrollWidth <= d.clientWidth; })).toBe(true);
  await page.locator('#plazaCloseBtn').tap();

  // two fingers on the island: apart brings the camera in, together takes it out, and the view does not turn meanwhile
  const view = () => page.evaluate(() => { const d = window.PlazaDebug(); return { zoom: d.zoom, yaw: d.camYaw }; });
  const pinch = async (from, to) => {
    const y = 420; const cx2 = page.viewportSize().width / 2;
    const at = (s) => [{ x: cx2 - s, y, id: 1 }, { x: cx2 + s, y, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(from)[0]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from) });
    for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(from + ((to - from) * i) / 6) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const before0 = await view();
  await pinch(40, 110);
  const closer = await view();
  expect(closer.zoom).toBeLessThan(before0.zoom); expect(closer.yaw).toBe(before0.yaw);
  await pinch(110, 40);
  expect((await view()).zoom).toBeGreaterThan(closer.zoom);

  // no Enter on a phone: the chat tab opens the input
  await page.locator('#islandChatTab').tap();
  await expect(page.locator('#islandChatInput')).toBeFocused();

  // turned sideways and back: the whole island stays on the screen (no scrolling), the stick and the map on it
  const viewport = page.viewportSize();
  for (const size of [{ width: viewport.height, height: viewport.width }, viewport]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => {
      const bottom = (id) => document.getElementById(id).getBoundingClientRect().bottom;
      return document.documentElement.scrollHeight <= innerHeight && bottom('plazaStage') <= innerHeight && bottom('islandStick') <= innerHeight;
    })).toBe(true);
  }
});
