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

  // no Esc on a phone: the ☰ button opens the menu (v1.10.63)
  await page.locator('#gameMenuBtn').tap();
  await expect(page.locator('#gameMenuDialog')).toBeVisible();
  await expect(page.locator('#logoutBtn')).toBeVisible();
  await page.locator('#gameMenuCloseBtn').tap();
  await expect(page.locator('#gameMenuDialog')).toBeHidden();

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

// v1.10.67 조이스틱 위치·크기 (사용자 2026-10-12): 메뉴 → 환경설정 → 「조이스틱 위치·크기」, drag the stick, size it, 완료;
// kept after a reload; 기본값 puts it back. Nothing walks while adjusting.
test('모바일 조이스틱: 위치 옮기기·크기 바꾸기, 새로고침 뒤 유지, 기본값으로 되돌리기', async ({ page, request }) => {
  test.setTimeout(90000);
  const admin = (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const issued = (await post(request, '/api/admin/keys', admin, { label: '조이스틱조정' })).data;
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  await post(request, '/api/avatar/gender', JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token, { gender: 'male' });
  await page.locator('#lobbyView').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    localStorage.removeItem('gc.testClassic');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  const stick = page.locator('#islandStick');
  const start = await stick.boundingBox();
  await page.locator('#gameMenuBtn').click();
  await page.locator('#stickEditBtn').click();
  await expect(page.locator('#stickEditBar')).toBeVisible();

  const before = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  const cdp = await page.context().newCDPSession(page);
  const cx = start.x + start.width / 2; const cy = start.y + start.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 120, y: cy - 150, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const moved = await stick.boundingBox();
  expect(moved.x - start.x).toBeGreaterThan(100);
  expect(start.y - moved.y).toBeGreaterThan(130);
  const after = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.2); // adjusting, not walking

  await page.locator('#stickSizeInput').fill('160');
  await expect.poll(async () => Math.round((await stick.boundingBox()).width)).toBe(160);
  // dragged against the left edge, the whole stick stays on the screen (Codex review)
  const big = await stick.boundingBox();
  const stage = await page.locator('#plazaStage').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: big.x + big.width / 2, y: big.y + big.height / 2, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 2, y: big.y + big.height / 2, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const edge = await stick.boundingBox();
  expect(edge.x).toBeGreaterThanOrEqual(stage.x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: edge.x + edge.width / 2, y: edge.y + edge.height / 2, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: big.x + big.width / 2, y: big.y + big.height / 2, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.locator('#stickDoneBtn').click();
  await expect(page.locator('#stickEditBar')).toBeHidden();
  const moved2 = await stick.boundingBox();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  const kept = await stick.boundingBox();
  expect(Math.round(kept.width)).toBe(160);
  expect(Math.abs(kept.x + kept.width / 2 - (moved2.x + moved2.width / 2))).toBeLessThan(4);

  await page.locator('#gameMenuBtn').click();
  await page.locator('#stickEditBtn').click();
  await page.locator('#stickResetBtn').click();
  await page.locator('#stickDoneBtn').click();
  const reset = await stick.boundingBox();
  expect(Math.round(reset.width)).toBe(Math.round(start.width));
  expect(Math.abs(reset.x - start.x)).toBeLessThan(2);
});

// v1.10.84 조작 배치 (사용자 2026-10-17): the right hand has 상호작용 · 걷기 · 뛰기 by default (the stick on the left); each is
// dragged and sized like the stick (the one touched last takes the slider), kept after a reload, and 기본값 puts all back.
// 걷기 tapped switches 느리게/보통; 뛰기 runs while held.
test('모바일 조작 배치: 오른손 상호작용·걷기·뛰기 기본 배치, 옮기기·크기·유지, 걷기 전환·뛰기 누르는 동안', async ({ page, request }) => {
  test.setTimeout(90000);
  const admin = (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const issued = (await post(request, '/api/admin/keys', admin, { label: '조작배치' })).data;
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  await post(request, '/api/avatar/gender', JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token, { gender: 'male' });
  await page.locator('#lobbyView').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    localStorage.removeItem('gc.testClassic');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  const W = page.viewportSize().width;
  const box = async (id) => page.locator(id).boundingBox();
  const stick = await box('#islandStick');
  expect(stick.x + stick.width / 2).toBeLessThan(W / 2); // left hand
  for (const id of ['#islandActBtn', '#islandWalkBtn', '#islandRunBtn']) { const b = await box(id); expect(b.x + b.width / 2, id).toBeGreaterThan(W / 2); } // right hand

  // 걷기: a tap switches to 느리게 and back; 뛰기: runs while held
  await page.locator('#islandWalkBtn').tap();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pace)).toBe('slow');
  await expect(page.locator('#islandWalkBtn')).toHaveText('느리게');
  await page.locator('#islandWalkBtn').tap();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pace)).toBe('walk');
  const cdp = await page.context().newCDPSession(page);
  const run = await box('#islandRunBtn');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: run.x + run.width / 2, y: run.y + run.height / 2, id: 7 }] });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pace)).toBe('run');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pace)).toBe('walk');

  // 조작 배치: 상호작용 dragged to the left and made bigger
  await page.locator('#gameMenuBtn').click();
  await page.locator('#stickEditBtn').click();
  await expect(page.locator('#stickEditBar')).toBeVisible();
  const act = await box('#islandActBtn');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: act.x + act.width / 2, y: act.y + act.height / 2, id: 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: act.x + act.width / 2 - 120, y: act.y + act.height / 2 - 100, id: 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#stickEditBar')).toContainText('상호작용');
  await page.locator('#stickSizeInput').fill('110');
  await expect.poll(async () => Math.round((await box('#islandActBtn')).width)).toBe(110);
  const moved = await box('#islandActBtn');
  expect(act.x - moved.x).toBeGreaterThan(80);
  await page.locator('#stickDoneBtn').click();
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  const kept = await box('#islandActBtn');
  expect(Math.round(kept.width)).toBe(110);
  expect(Math.abs(kept.x + kept.width / 2 - (moved.x + moved.width / 2))).toBeLessThan(4);
  await page.locator('#gameMenuBtn').click();
  await page.locator('#stickEditBtn').click();
  await page.locator('#stickResetBtn').click();
  await page.locator('#stickDoneBtn').click();
  const back = await box('#islandActBtn');
  expect(Math.abs(back.x - act.x)).toBeLessThan(2); expect(Math.round(back.width)).toBe(Math.round(act.width));
});
