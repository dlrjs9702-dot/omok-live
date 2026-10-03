const { test, expect } = require('@playwright/test');
const { post, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// v1.8.8 3D 광장 로비 V1: 방향키 이동, 시설 근처 안내, Space·클릭이 같은 시설 창을 열고, 창이 열린 동안 이동이 멈추며,
// 시설 창은 기존 로비 기능 그대로(게임관에서 방 만들기). 「기존 로비」 전환은 브라우저에 기억된다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const state = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { x: d.x, z: d.z, near: d.near, running: d.running }; });

async function intoPlaza(browser, request, label, points = 0) {
  const who = await shopper(browser, request, label, points);
  await expect(who.page.locator('#lobbyView')).toBeVisible();
  await who.page.locator('#lobbyModeBtn').click(); // the specs start in the classic lobby (playwright.config.js)
  await expect(who.page.locator('#plazaStage canvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => state(who.page).then((s) => s?.running), { timeout: 10000 }).toBe(true);
  return who;
}

test('광장: 방향키로 걷고, 시설 앞 안내, Space와 클릭이 같은 창을 열며 창이 열린 동안 멈춘다', async ({ browser, request }) => {
  const a = await intoPlaza(browser, request, '광장');
  const { page } = a;
  await expect(page.locator('#announcementsCard')).toBeHidden(); // the classic lobby sections are put away

  // Arrow keys move the character.
  const start = await state(page);
  await page.keyboard.down('ArrowUp'); // held until it has walked (a busy machine renders few frames)
  await expect.poll(async () => start.z - (await state(page)).z, { timeout: 10000 }).toBeGreaterThan(0.3);
  await page.keyboard.up('ArrowUp');

  // At the shop door: a short hint, and Space opens the skin shop over the square.
  await page.evaluate(() => window.PlazaDebug().place('shop'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 상점');
  await page.keyboard.press('Space');
  await expect(page.locator('#skinShopDialog')).toBeVisible();
  const before = await state(page);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  const during = await state(page);
  expect(Math.hypot(during.x - before.x, during.z - before.z)).toBeLessThan(0.01); // no walking while a window is open
  await page.keyboard.press('Escape');
  await expect(page.locator('#skinShopDialog')).toBeHidden();
  await page.keyboard.down('ArrowDown'); // back to walking right away
  await expect.poll(async () => { const now = await state(page); return Math.hypot(now.x - during.x, now.z - during.z); }, { timeout: 10000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('ArrowDown');

  // A click on a facility runs the same action: the board opens the notices in a window, closing puts them back.
  await page.evaluate(() => window.PlazaDebug().place('board'));
  await page.waitForTimeout(300);
  const board = await page.evaluate(() => window.PlazaDebug().screenOf('board'));
  await page.mouse.click(board.x, board.y);
  await expect(page.locator('#plazaDialog')).toBeVisible();
  await expect(page.locator('#plazaDialogTitle')).toHaveText('게시판');
  await expect(page.locator('#plazaDialog #announcementsCard')).toBeVisible();
  await page.locator('#plazaCloseBtn').click();
  await expect(page.locator('#plazaDialog')).toBeHidden();
  await expect(page.locator('#lobbyHighlights #announcementsCard')).toHaveCount(1);

  // The mission board and the records hall.
  await page.evaluate(() => window.PlazaDebug().place('missions'));
  await page.keyboard.press('Space');
  await expect(page.locator('#missionDialog')).toBeVisible();
  await page.locator('#missionTabEvents').click(); // v1.8.9: the events tab is live (open events or "none")
  await expect(page.locator('#missionPanelEvents')).toBeVisible();
  await expect(page.locator('#eventSummary')).not.toHaveText('');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.PlazaDebug().place('records'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 전적관');
  await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog #myRecordsCard')).toBeVisible();
  await page.keyboard.press('Escape');

  // Attendance: the keeper pays the daily reward once.
  await page.evaluate(() => window.PlazaDebug().place('attendance'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 출석');
  await page.keyboard.press('Space');
  await expect(page.locator('#attendanceBtn')).toHaveText('오늘 출석 완료');

  await expectNoScriptError(page);
  await a.context.close();
});

test('광장: 게임관 창에서 방을 만들면 방으로 들어가고, 나오면 광장으로 돌아오며, 기존 로비 선택은 기억된다', async ({ browser, request }) => {
  const a = await intoPlaza(browser, request, '게임관');
  const { page } = a;
  await page.evaluate(() => window.PlazaDebug().place('games'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임관');
  await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog #publicRoomsCard')).toBeVisible();
  await page.locator('#plazaDialog #createRoomBtn').click();
  await expect(page.locator('#roomView')).toBeVisible();
  await expect(page.locator('#plazaDialog')).toBeHidden();
  expect((await state(page)).running).toBe(false); // the square sleeps while in a room
  await page.locator('#leaveRoomBtn').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expect.poll(() => state(page).then((s) => s?.running)).toBe(true);
  await expect(page.locator('.lobbyTopGrid #createRoomBtn')).toHaveCount(1); // the section went back home

  // 「기존 로비」 brings the classic lobby back and stays chosen after a reload.
  await page.locator('#lobbyModeBtn').click();
  await expect(page.locator('#plazaStage')).toBeHidden();
  await expect(page.locator('#announcementsCard')).toBeVisible();
  await page.reload();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expect(page.locator('#plazaStage')).toBeHidden();
  await expect(page.locator('#lobbyModeBtn')).toHaveText('광장');
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.9.2 광장 V2: 상점의 광장 아바타 탭(헤어·의상·모자, 칭호)과 광장 캐릭터가 같은 모습이고, 장착하면 바로 바뀐다.
test('광장 아바타: 상점에서 산 헤어·의상·모자와 전설 칭호가 광장 캐릭터와 이름표에 바로 나온다', async ({ browser, request }) => {
  const a = await intoPlaza(browser, request, '아바타', 7_000_000);
  const { page } = a;
  await buyAndEquip(request, a, ['avatar_hair_6', 'avatar_outfit_5', 'omok_l1']);
  expect((await post(request, '/api/skins/buy', a.token, { skinId: 'avatar_hat_4' })).status).toBe(200); // owned, not worn yet
  expect((await post(request, '/api/skins/title', a.token, { skinId: 'omok_l1' })).status).toBe(200);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look), { timeout: 8000 }).toEqual({ hair: 'avatar_hair_6', outfit: 'avatar_outfit_5' });
  expect(await page.evaluate(() => window.PlazaDebug().title)).toBe('천상 바둑');
  expect(await page.evaluate(() => window.PlazaDebug().tag)).toBe(true);

  // 상점(광장의 상점 건물): 광장 아바타 탭, 칸 표시, 칭호 구역; 장착하면 캐릭터가 바로 바뀐다.
  await page.evaluate(() => window.PlazaDebug().place('shop'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 상점');
  await page.keyboard.press('Space');
  const dialog = page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '광장 아바타' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(16);
  await expect(dialog.locator('.skinCard').filter({ hasText: '왕관' })).toContainText('고급 · 모자·장식');
  await expect(dialog.locator('.skinTitle.selected')).toHaveText('천상 바둑');
  await dialog.locator('.skinCard').filter({ hasText: '왕관' }).getByRole('button', { name: '장착' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look.hat), { timeout: 8000 }).toBe('avatar_hat_4');
  await dialog.locator('.skinTitle').filter({ hasText: '칭호 없음' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().title), { timeout: 8000 }).toBe(null);
  await expectNoScriptError(page);
  await a.context.close();
});
