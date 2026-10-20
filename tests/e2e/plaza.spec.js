const { test, expect } = require('@playwright/test');
const { post, get, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// 게임 아일랜드: 방향키 이동, 시설 근처 안내, Space·클릭이 같은 시설 창을 열고, 창이 열린 동안 이동이 멈춘다.
// v1.9.7부터 일반 사용자에게 기존 로비 전환 UI는 없고, 계정 메뉴는 관리자 창(관리자만)·내 정보·접속 종료만 둔다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
// The plaza is one shared square and each page renders 3D: these run one after another (users of another test would
// walk into this one, and several software-rendered pages at once are slow).
test.describe.configure({ mode: process.env.CI ? 'parallel' : 'default' }); // (CI: each part has its own server and runs one test at a time -- 'parallel' lets the three PC parts split this file's tests, not the whole file into one)

// 달마루섬 5단계: the island the server runs (the same terrain file, ISLAND_MAP) -- the places these tests walk to come
// from it on either island
const T = require('../../public/plaza/island-terrain.js'); const DAL = T.MAP === 'dalmaru';
const PC = T.PLAZA_C || { x: 0, z: 0 };
const LANE = DAL ? { x: 0.6, z: -40 } : { x: -1, z: 22 }; // a straight walk going south (the harbour walk / 대청마당 to 물가 거리)
const state = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { x: d.x, z: d.z, near: d.near, running: d.running }; });

// These tests check movement, sync, collision and the island's rules, not its 3D models (tests/e2e/island-assets.spec.js
// does that): every registered model is switched off, so each page draws the light procedural island. On a CI runner
// (software rendering) several pages full of seasonal and Low models made these the slowest, flakiest tests.
// v1.10.29: and a smaller window (still a PC width, about half the pixels): on the 2-core CI runner two or three
// software-rendered pages starved each other's timers -- a first position post 23 s late, a toast 5 s late.
async function islandPage(page) {
  await page.setViewportSize({ width: 960, height: 680 });
  await page.evaluate(() => {
    localStorage.removeItem('gc.testClassic');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  });
  await page.reload();
}

async function intoPlaza(browser, request, label, points = 0, clockSkew = 0) {
  const who = await shopper(browser, request, label, points);
  await expect(who.page.locator('#lobbyView')).toBeVisible();
  if (clockSkew) await who.page.addInitScript((skew) => { const realNow = Date.now.bind(Date); Date.now = () => realNow() + skew; }, clockSkew);
  await islandPage(who.page);
  await expect(who.page.locator('#lobbyView')).toBeVisible();
  // (CI 2차: the island's own signal that it is shown -- on a busy runner the scene takes longer than 15 s to come up
  // after the lobby; the canvas is checked once it says so)
  await expect.poll(() => state(who.page).then((s) => s?.running), { timeout: 60000 }).toBe(true);
  await expect(who.page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible();
  // v1.10.41: these tests are about the island itself -- October's night (its decor, bats and lights) is the Halloween
  // tests' (island-assets.spec), and on a software-rendered runner it made this file too slow for its shard
  await who.page.evaluate(() => window.PlazaDebug().halloween.set(false));
  return who;
}

// v1.10.63 메뉴 (IDEAS 2026-10-11): no account bar; Esc opens the menu (not while typing), Esc closes it, the theme
// chosen there is kept, and a window opened from it replaces it
test('Esc 메뉴: 섬에서 Esc로 열고 닫기, 입력 중에는 열리지 않음, 테마 선택 유지, 내 정보로 넘어감', async ({ browser, request }) => {
  test.setTimeout(90000); // a 3D island page: slower on CI
  const a = await intoPlaza(browser, request, '메뉴');
  const { page } = a;
  try {
    const menu = page.locator('#gameMenuDialog');
    await expect(page.locator('.islandTopbar')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark'); // the default
    await page.locator('#plazaStage').focus();
    await page.keyboard.press('Escape');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.keyboard.press('Enter'); // the chat input: Esc there cancels the typing, never opens the menu
    await expect(page.locator('#islandChatInput')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.locator('#gameMenuBtn').click();
    await expect(menu).toBeVisible();
    await page.locator('input[name="gcTheme"][value="light"]').check();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    await page.locator('#myInfoBtn').click();
    await expect(page.locator('#myInfoDialog')).toBeVisible();
    await expect(menu).toBeHidden();
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    await page.evaluate(() => localStorage.removeItem('gc.theme'));
  } finally { await a.context.close(); }
});

test('광장 시설: 원거리 클릭은 창을 열지 않고 근처에서만 클릭·SPACE 실행', async ({ browser, request }) => {
  test.setTimeout(90000); // (CI 2차: the island's start alone may take up to 60 s on a busy runner)
  const a = await intoPlaza(browser, request, '근접 클릭');
  const { page } = a;
  try {
    const door = await page.evaluate(() => window.PlazaDebug().doors.board);
    await page.evaluate(async (d) => window.PlazaWarp(d.x + 4, d.z), door);
    await expect.poll(async () => {
      const p = await state(page); return Math.hypot(p.x - door.x, p.z - door.z);
    }).toBeGreaterThan(2.4);
    const far = await page.evaluate(() => window.PlazaDebug().screenOf('board'));
    await page.mouse.click(far.x, far.y);
    await expect(page.locator('#plazaDialog')).toBeHidden();
    await page.evaluate(async (d) => window.PlazaWarp(d.x, d.z), door);
    await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게시판');
    const near = await page.evaluate(() => window.PlazaDebug().screenOf('board'));
    await page.mouse.click(near.x, near.y);
    await expect(page.locator('#plazaDialogTitle')).toHaveText('게시판');
    await page.locator('#plazaCloseBtn').click();
    await page.keyboard.press('Space');
    await expect(page.locator('#plazaDialog')).toBeVisible();
    await expectNoScriptError(page);
  } finally { await a.context.close(); }
});

test('상점 전환: 이전 목록을 비우고 늦은 응답이 새 상점을 덮지 않는다', async ({ browser, request }) => {
  test.setTimeout(90000); // (CI 2차: the island's start alone may take up to 60 s on a busy runner)
  const a = await intoPlaza(browser, request, '상점 응답'); const { page } = a;
  let release; let firstSeen; const pending = new Promise((resolve) => { release = resolve; });
  const seen = new Promise((resolve) => { firstSeen = resolve; }); let requests = 0;
  try {
    await page.route('**/api/skins', async (route) => {
      const first = ++requests === 1; const response = await route.fetch(); const data = await response.json();
      data.balance = first ? 111 : 222;
      if (first) { firstSeen(); await pending; }
      await route.fulfill({ response, json: data });
    });
    await require('./skin-support').intoMall(page, 'shop'); // v1.10.92: the shops are the 백화점's sectors
    await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임 스킨 상점');
    await page.keyboard.press('Space'); await seen;
    await page.keyboard.press('Escape');
    await require('./skin-support').intoMall(page, 'hair');
    await expect(page.locator('#plazaHint')).toHaveText('SPACE · 미용실');
    await page.keyboard.press('Space');
    await expect(page.locator('#skinShopTitle')).toHaveText('미용실');
    await expect(page.locator('#skinShopBalance')).toHaveText('보유 222P');
    const lateResponse = page.waitForResponse((r) => r.url().endsWith('/api/skins') && r.status() === 200);
    release(); await lateResponse;
    await expect(page.locator('#skinShopBalance')).toHaveText('보유 222P');
    await expectNoScriptError(page);
  } finally { release(); await a.context.close(); }
});

test('개인 정보: 섬에서 보유 외형을 해제하고 클래식 PC 출석·미션은 유지', async ({ browser, request }) => {
  test.setTimeout(90000); // (CI 2차: the island's start alone may take up to the 60 s waited for below)
  const a = await shopper(browser, request, '보유 외형', 100000);
  try {
    await buyAndEquip(request, a, ['avatar_animal_cat_outfit']);
    await expect(a.page.locator('#islandFacilityActions')).toBeVisible();
    await islandPage(a.page);
    await expect.poll(() => a.page.evaluate(() => Boolean(window.PlazaDebug?.()?.running)).catch(() => false), { timeout: 60000 }).toBe(true); await expect(a.page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible(); // (CI 2차: the scene's own shown signal first)
    await expect(a.page.locator('#islandFacilityActions')).toBeHidden();
    await a.page.keyboard.press('Escape'); await a.page.locator('#myInfoBtn').click(); // v1.10.63: Esc 메뉴
    await a.page.locator('#myInfoDialog button[data-action="unequip"]').click();
    await expect.poll(async () => (await get(request, '/api/skins', a.token)).data.equipped?.avatar?.outfit || null).toBe(null);
    await a.page.keyboard.press('Escape');
    await expect(a.page.locator('#plazaStage')).toBeFocused();
    await expectNoScriptError(a.page);
  } finally { await a.context.close(); }
});

test('광장: 방향키로 걷고, 시설 앞 안내, Space와 클릭이 같은 창을 열며 창이 열린 동안 멈춘다', async ({ browser, request }) => {
  test.setTimeout(process.env.CI ? 120000 : 60000); /* (CI 2차: the island's start alone may take 60 s on the runner) */ // a software-rendered 3D page walking to two facilities: about 21-29 s on a CI runner already
  const a = await intoPlaza(browser, request, '광장');
  const { page } = a;
  await expect(page.locator('#announcementsCard')).toBeHidden(); // the classic lobby sections are put away

  // Arrow keys move the character.
  const start = await state(page);
  await page.keyboard.down('ArrowUp'); // held until it has walked (a busy machine renders few frames)
  await expect.poll(async () => start.z - (await state(page)).z, { timeout: 10000 }).toBeGreaterThan(0.3);
  await page.keyboard.up('ArrowUp');

  // At the shop door: a short hint, and Space opens the skin shop over the square.
  await require('./skin-support').intoMall(page, 'shop'); // v1.10.92: in the 백화점
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임 스킨 상점');
  await page.keyboard.press('Space');
  await expect(page.locator('#skinShopDialog')).toBeVisible();
  await expect(page.locator('#skinShopTitle')).toHaveText('게임 스킨 상점');
  await expect(page.locator('#skinShopDialog').getByRole('tab', { name: '광장 아바타' })).toHaveCount(0); // character skins: the shop next door
  const before = await state(page);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  const during = await state(page);
  expect(Math.hypot(during.x - before.x, during.z - before.z)).toBeLessThan(0.01); // no walking while a window is open
  await page.keyboard.press('Escape');
  await expect(page.locator('#skinShopDialog')).toBeHidden();
  await page.keyboard.down('ArrowDown'); // back to walking right away
  await expect.poll(async () => { const now = await state(page); return Math.hypot(now.x - during.x, now.z - during.z); }, { timeout: 10000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('ArrowDown');
  await require('./skin-support').outOfMall(page); // (v1.10.92: back out of the 백화점 to the island)

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
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 미션판'); // the next frame marks it as near (a slow runner pressed too early)
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

// v1.10.73 게임관 전면 개편 (IDEAS #future-gamehall-renewal): Space at the door opens the game hall's own screen (the island
// sleeps), every game is a card, a card opens its sheet, 방 만들기 there makes the room; out of the room back to the game
// hall, and 「‹ 섬으로」 (or Esc) back to the island where I was
test('게임 아일랜드: 게임관 전용 화면 → 카드 → 상세 시트 → 방 만들기, 나오면 게임관, ‹ 섬으로 아일랜드 유지', async ({ browser, request }) => {
  test.setTimeout(90000); // (CI 2차: the island's start alone may take up to 60 s on a busy runner)
  const a = await intoPlaza(browser, request, '게임관');
  const { page } = a;
  await page.evaluate(() => window.PlazaDebug().place('games'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임관');
  const at = await state(page);
  await page.keyboard.press('Space');
  const hall = page.locator('#gamehallView');
  await expect(hall).toBeVisible();
  expect((await state(page)).running).toBe(false); // the island sleeps behind it
  await expect(page.locator('#plazaDialog')).toBeHidden();
  const cards = hall.locator('.gameCard');
  await expect(cards).toHaveCount(await page.evaluate(() => window.GamehallCatalog.GAMES.length));
  await expect(hall.locator('.gamehallToday')).toContainText('오늘의 게임');
  await expect(hall.locator('[data-sum="week"]')).toHaveText('0판');
  await expect(hall.locator('.gameChoice, [data-game-mode]')).toHaveCount(0); // no 멀티/싱글 tabs, no old buttons
  // a chip shows its games only; arrow keys walk the chips
  await hall.locator('.gamehallChip[data-cat="ai"]').click();
  await expect(cards).toHaveCount(3);
  await page.keyboard.press('ArrowLeft');
  await expect(hall.locator('.gamehallChip[data-cat="solo"]')).toBeFocused();
  await hall.locator('.gamehallChip[data-cat="all"]').click();
  // the 오목 card: its sheet, 방 만들기 with 오목's own options only, the room
  await hall.locator('.gameCard[data-game="omok"]').click();
  const sheet = page.locator('#gameSheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('#gameSheetName')).toHaveText('오목');
  await expect(sheet.locator('.gameSheetHow li')).toHaveCount(3);
  await expect(sheet.locator('.gameSheetActions button')).toHaveText(['빠른 시작', '방 만들기', 'AI 연습']);
  await sheet.getByRole('button', { name: '방 만들기' }).click();
  await expect(sheet.locator('#omokModeChoices')).toBeVisible();
  await expect(sheet.locator('#baseballDigitChoices')).toBeHidden();
  await expect(sheet.locator('#gostopStakeChoices')).toBeHidden();
  await sheet.locator('#createRoomBtn').click();
  await expect(page.locator('#roomView')).toBeVisible();
  await expect(hall).toBeHidden();
  await expect(page.locator('.lobbyTopGrid #createRoomBtn')).toHaveCount(1); // the form went back home
  await page.locator('#leaveRoomBtn').click();
  await expect(hall).toBeVisible(); // back to choosing a game
  // AI 연습 opens that game's page (practice), and its 「‹ 게임관」 comes back here
  await hall.locator('.gameCard[data-game="connect4"]').click();
  await sheet.getByRole('button', { name: 'AI 연습' }).click();
  await expect(page.locator('#reflexView .reflexHead strong')).toHaveText('사목');
  await page.locator('.reflexHead button', { hasText: '게임관' }).click();
  await expect(hall).toBeVisible();
  // Esc closes a sheet, then leaves for the island where I stood
  await hall.locator('.gameCard[data-game="baseball"]').click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(hall).toBeHidden();
  await expect.poll(() => state(page).then((s) => s?.running)).toBe(true);
  const back = await state(page);
  expect(Math.hypot(back.x - at.x, back.z - at.z)).toBeLessThan(0.5);
  await expect(page.locator('#lobbyModeBtn')).toHaveCount(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug?.()?.running)).catch(() => false), { timeout: 60000 }).toBe(true); await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible(); // (CI 2차: the scene's own shown signal first)
  await expect(page.locator('#lobbyModeBtn')).toHaveCount(0);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.9.2 광장 V2: 상점의 광장 아바타 탭(헤어·의상·모자, 칭호)과 광장 캐릭터가 같은 모습이고, 장착하면 바로 바뀐다.
test('광장 아바타: 상점에서 산 헤어·의상·모자와 전설 칭호가 광장 캐릭터와 이름표에 바로 나온다', async ({ browser, request }) => {
  test.setTimeout(process.env.CI ? 120000 : 60000); /* (CI 2차: the island's start alone may take 60 s on the runner) */ // a software-rendered 3D page through the shop: 18-29 s on a CI runner, at the default 30 s on a slow one
  const a = await shopper(browser, request, '아바타', 7_000_000);
  const { page } = a;
  await buyAndEquip(request, a, ['avatar_hair_6', 'avatar_outfit_5', 'omok_l1']);
  expect((await post(request, '/api/skins/buy', a.token, { skinId: 'avatar_hat_4' })).status).toBe(200); // owned, not worn yet
  expect((await post(request, '/api/skins/title', a.token, { skinId: 'omok_l1' })).status).toBe(200);
  await islandPage(page);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); // (CI 2차: up to 60 s on the runner)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look), { timeout: 8000 }).toEqual({ hair: 'avatar_hair_6', outfit: 'avatar_outfit_5', gender: 'male' }); // v1.10.3: the look carries the chosen body
  expect(await page.evaluate(() => window.PlazaDebug().title)).toBe('천상 바둑');
  expect(await page.evaluate(() => window.PlazaDebug().tag)).toBe(true);

  // v1.10.30 상점가 꾸미기 점포 세분화: 옷가게는 의상과 칭호, 미용실은 헤어, 잡화점은 모자·장식만 판다; 장착하면 바로 바뀐다.
  const dialog = page.locator('#skinShopDialog');
  const visit = async (id, name, count) => {
    await require('./skin-support').intoMall(page, id); // v1.10.92: the shops are the 백화점's sectors
    await expect(page.locator('#plazaHint')).toHaveText(`SPACE · ${name}`);
    await page.keyboard.press('Space');
    await expect(dialog.locator('#skinShopTitle')).toHaveText(name);
    await expect(dialog.locator('.skinTab:not([data-slot])')).toHaveCount(1); await expect(dialog.locator('.skinTab:not([data-slot])')).toHaveAttribute('data-family', 'avatar'); // game skins are sold next door (3-1: the lone tab not shown)
    await expect(dialog.locator('.skinCard')).toHaveCount(count);
  };
  await visit('hair', '미용실', 34); // v1.10.74: +17 original hairstyles
  await expect(dialog.locator('.skinCard')).toContainText(['양갈래 머리']);
  await dialog.locator('#skinShopCloseBtn').click();
  await visit('accessories', '소품 가게', 57); /* v1.10.92 + 포차코 머리장식; B 46 + 산타 모자·루돌프 머리띠 */ // v1.10.74: +16 original and 11 character hats
  // v1.10.32: the five accessory slots, a tab each (the hats first)
  await expect(dialog.locator('.skinSlotTabs [role=tab]')).toHaveText(['모자·장식', '망토', '꼬리', '신발', '목걸이']);
  await expect(dialog.locator('.skinCard').filter({ hasText: '왕관' })).toContainText('고급 · 모자·장식');
  await dialog.locator('.skinSlotTabs [role=tab]').filter({ hasText: '망토' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(27); // v1.10.74: +8 original and 5 character capes; B 46 + 눈꽃 망토
  await expect(dialog.locator('.skinCard').filter({ hasText: '작은 날개 망토' })).toContainText('전설 · 망토');
  await expect(dialog.locator('.skinCard').filter({ hasText: '작은 날개 망토' })).toContainText('400,000P'); // 전설 (v1.10.35)
  await dialog.locator('.skinSlotTabs [role=tab]').filter({ hasText: '모자·장식' }).click();
  await expect(dialog.locator('.skinTitle')).toHaveCount(0); // the title is the clothes shop's
  await dialog.locator('.skinCard').filter({ hasText: '왕관' }).getByRole('button', { name: '장착' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look.hat), { timeout: 8000 }).toBe('avatar_hat_4');
  await dialog.locator('#skinShopCloseBtn').click();
  await visit('avatar', '옷가게', 62); /* v1.10.92 + 포차코 의상; B 46 + 산타 옷 */ // v1.10.74: +19 original and 11 character outfits
  await expect(dialog.locator('.skinTitle.selected')).toHaveText('천상 바둑');
  await expect(dialog.locator('.skinTitle.selected')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.skinTitle.selected')).toHaveCSS('outline-color', 'rgb(96, 165, 250)');
  await dialog.locator('.skinTitle').filter({ hasText: '칭호 없음' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().title), { timeout: 8000 }).toBe(null);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.9.3 광장 V3: 다른 접속자의 위치·방향·이름표가 보이고, 방에 들어가면 사라졌다가 돌아오면 다시 보이며, 새로고침해도 다시 보인다.
test('멀티유저 광장: 서로의 캐릭터와 이동이 보이고 입장·퇴장·새로고침이 반영된다', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D island pages at once (a slow CI runner went past 60 s, v1.10.2)
  const a = await intoPlaza(browser, request, '앨리스');
  const b = await intoPlaza(browser, request, '밥');
  const idOf = (who) => expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 30000 }) /* (the server's join reply: past 10 s on a busy runner) */.toBeTruthy().then(() => who.page.evaluate(() => window.PlazaDebug().myId));
  const aId = await idOf(a); const bId = await idOf(b);
  const seen = (who, id) => who.page.evaluate((other) => (window.PlazaDebug()?.others || []).find((o) => o.id === other) || null, id);
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).not.toBeNull();
  await expect.poll(() => seen(a, bId), { timeout: 10000 }).not.toBeNull();
  expect((await seen(b, aId)).tag).toBe(true);
  expect(await seen(a, aId)).toBeNull(); // never myself

  // a walks to the shop door: b sees a's character arrive there.
  // a warp, not place(): a walk-check from the spawn would stop at b when b happens to stand on the straight line (v1.9.6 collision)
  const door = await a.page.evaluate(async () => { const d = window.PlazaDebug().doors.records; /* (v1.10.92: the shops are inside the 백화점) */ await window.PlazaWarp(d.x, d.z); return { x: window.PlazaDebug().x, z: window.PlazaDebug().z }; });
  await expect.poll(async () => { const o = await seen(b, aId); return o ? Math.hypot(o.x - door.x, o.z - door.z) : 99; }, { timeout: 10000 }).toBeLessThan(0.5);

  // v1.10.8: a walks down the harbour walk; on b's screen a moves on evenly -- never backward, never faster than a
  // run in a frame (no surge after a late update), and arrives where a stopped
  await a.page.evaluate((p) => window.PlazaWarp(p.x, p.z), LANE);
  await expect.poll(async () => { const o = await seen(b, aId); return o ? Math.hypot(o.x - LANE.x, o.z - LANE.z) : 99; }, { timeout: 10000 }).toBeLessThan(0.5);
  const watching = b.page.evaluate((id) => new Promise((resolve) => { // until a stands still on b's screen again
    const out = []; const start = performance.now(); window.__walkDone = false;
    const tick = () => {
      const o = (window.PlazaDebug()?.others || []).find((p) => p.id === id); if (o) out.push({ t: performance.now(), z: o.z });
      const settled = window.__walkDone && out.length > 2 && Math.abs(out[out.length - 1].z - window.__walkEnd) < 0.05;
      if (!settled && performance.now() - start < 30000) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), aId);
  await a.page.keyboard.down('ArrowDown'); // held until a has walked a few steps (a slow runner draws few frames)
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().z), { timeout: 15000 }).toBeGreaterThan(LANE.z + 2);
  await a.page.keyboard.up('ArrowDown');
  await a.page.waitForTimeout(300);
  const end = await a.page.evaluate(() => window.PlazaDebug().z);
  await b.page.evaluate((z) => { window.__walkEnd = z; window.__walkDone = true; }, end);
  const walked = await watching;
  const steps = walked.slice(1).map((s, i) => ({ dz: s.z - walked[i].z, dt: (s.t - walked[i].t) / 1000 })).filter((s) => s.dt > 0);
  expect(Math.min(...steps.map((s) => s.dz))).toBeGreaterThan(-0.02); // never backward
  expect(Math.max(...steps.filter((s) => s.dt > 0.012).map((s) => s.dz / s.dt))).toBeLessThan(5.2 * 1.75); // no surge
  expect(walked[walked.length - 1].z).toBeCloseTo(end, 1); // b sees a arrive where a stopped

  // a goes into a room: gone from b's plaza; back in the lobby: there again.
  await a.page.evaluate(async () => { const d = window.PlazaDebug().doors.games; await window.PlazaWarp(d.x, d.z); });
  await expect(a.page.locator('#plazaHint')).toHaveText('SPACE · 게임관'); // the next frame marks it as near (a starved runner pressed too early and the window never opened)
  await a.page.keyboard.press('Space');
  await a.page.locator('.gameCard[data-game="omok"]').click(); // v1.10.73: the game hall's screen, 오목's sheet
  await a.page.getByRole('button', { name: '방 만들기' }).click();
  await a.page.locator('#gameSheet #createRoomBtn').click();
  await expect(a.page.locator('#roomView')).toBeVisible();
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).toBeNull();
  await a.page.locator('#leaveRoomBtn').click();
  await a.page.locator('#gamehallBackBtn').click(); // out of the game hall, back on the island
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).not.toBeNull();

  // b reloads (a reconnect): a is still there.
  await b.page.reload();
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); // (CI 2차: up to 60 s on the runner)
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).not.toBeNull();
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.9.5 주간 챔피언: 지난주 공동 1위 두 사람 모두 광장 이름표에 「챔피언」이 붙고, 다른 사람에게도 같게 보이며, 다시 접속해도 그대로다.
test('광장 챔피언: 공동 1위 둘 다 챔피언 이름표, 다른 사람에게도 보이고 재접속 후에도 유지', async ({ browser, request }) => {
  test.setTimeout(240000); // three 3D pages on a software renderer: 52-96 s on a CI runner already (v1.10.41: more with the town hall)
  const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const champs = [];
  for (const label of ['챔피언가', '챔피언나']) {
    const who = await shopper(browser, request, label);
    expect((await post(request, '/api/test/climb/record', who.token, { altitude: 3000, at: lastWeek })).status).toBe(200);
    champs.push(who);
  }
  const plain = await shopper(browser, request, '구경꾼');
  expect((await post(request, '/api/test/climb/record', plain.token, { altitude: 2950, at: lastWeek })).status).toBe(200);
  expect((await post(request, '/api/test/climb/settle', null, { reopen: true })).status).toBe(200); // a retried test settles last week again
  for (const who of [...champs, plain]) {
    await islandPage(who.page);
    await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); // three 3D pages on a software renderer (v1.10.41: 60 s, the island grew)
    await who.page.evaluate(() => window.PlazaDebug().halloween.set(false)); // October's night is the Halloween tests'
  }
  const idOf = async (who) => { await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 30000 }).toBeTruthy(); return who.page.evaluate(() => window.PlazaDebug().myId); };
  const [idA, idB, idC] = [await idOf(champs[0]), await idOf(champs[1]), await idOf(plain)];
  const seen = (who, id) => who.page.evaluate((other) => (window.PlazaDebug()?.others || []).find((o) => o.id === other) || null, id);
  // everyone sees the two champions marked, and the third not
  for (const [viewer, others] of [[plain, [idA, idB]], [champs[0], [idB]], [champs[1], [idA]]]) {
    for (const id of others) await expect.poll(() => seen(viewer, id).then((o) => o?.champion), { timeout: process.env.CI ? 30000 : 10000 }).toBe(true);
  }
  await expect.poll(() => seen(champs[0], idC).then((o) => o && o.champion), { timeout: 10000 }).toBe(false);
  for (const who of champs) await expect.poll(() => who.page.evaluate(() => window.PlazaDebug().champion), { timeout: 8000 }).toBe(true);
  expect(await plain.page.evaluate(() => window.PlazaDebug().champion)).toBe(false);
  // v1.10.29: the mark sits on its own row under the name (not after it), and a chat bubble goes above the whole tag
  const tag = await champs[0].page.evaluate(() => window.PlazaDebug().tagLayout);
  expect(tag.rows).toEqual({ marks: ['챔피언'], title: false });
  expect((await plain.page.evaluate(() => window.PlazaDebug().tagLayout)).rows).toEqual({ marks: [], title: false });
  await champs[0].page.locator('#plazaStage').focus();
  await champs[0].page.keyboard.press('Enter');
  await champs[0].page.keyboard.type('안녕');
  await champs[0].page.keyboard.press('Enter');
  await expect.poll(() => champs[0].page.evaluate(() => window.PlazaDebug().tagLayout.bubbleBottom), { timeout: 8000 }).toBeGreaterThan(tag.top);
  // the climb window names last week's champions
  await plain.page.evaluate(() => document.getElementById('climbBtn').click());
  await expect(plain.page.locator('#climbChampions')).toContainText('챔피언가');
  await expect(plain.page.locator('#climbChampions')).toContainText('챔피언나');
  await plain.page.keyboard.press('Escape');
  // a reconnect brings it back from the server
  await plain.page.evaluate(() => document.getElementById('climbDialog').close());
  await champs[1].context.close(); // fewer 3D pages while one reloads
  await champs[0].page.reload();
  await expect.poll(() => champs[0].page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  await expect.poll(() => champs[0].page.evaluate(() => window.PlazaDebug().champion), { timeout: 8000 }).toBe(true);
  await expect.poll(() => seen(plain, idA).then((o) => o?.champion), { timeout: 10000 }).toBe(true);
  for (const who of [champs[0], plain]) await expectNoScriptError(who.page);
  for (const who of [champs[0], plain]) await who.context.close();
});

// v1.9.6 광장 플레이어 충돌: 정면으로 막히고, 비스듬히 가면 옆으로 미끄러져 지나가며, 둘이 동시에 마주 걸어도
// 통과·순간이동이 없고, 누가 서 있어도 시설 입구는 막히지 않는다. (등반에서는 충돌 없음: climb.spec)
test('광장 충돌: 정면 막힘·대각선 미끄러짐·동시 접근·입구 막힘 없음', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D pages of the whole island on a software renderer: about 1.8 minutes on a slow CI runner
  const a = await intoPlaza(browser, request, '부딪는A');
  const b = await intoPlaza(browser, request, '부딪는B');
  // SLOW=6 reproduces a slow CI runner (CPU throttling) for this test
  if (process.env.SLOW) for (const who of [a, b]) { const cdp = await who.context.newCDPSession(who.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.SLOW) }); }
  const idOf = async (who) => { await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 10000 }).toBeTruthy(); return who.page.evaluate(() => window.PlazaDebug().myId); };
  const [aId, bId] = [await idOf(a), await idOf(b)];
  const me = (who) => who.page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  const seen = (who, id) => who.page.evaluate((other) => (window.PlazaDebug()?.others || []).find((o) => o.id === other) || null, id);
  const teleport = (who, x, z) => who.page.evaluate(([px, pz]) => window.PlazaWarp(px, pz), [x, z]);
  const settle = async (who, id, x, z) => expect.poll(async () => { const o = await seen(who, id); return o ? Math.hypot(o.x - x, o.z - z) : 99; }, { timeout: 10000 }).toBeLessThan(0.05);

  // (달마루섬: the same moves on an open part of 대청마당 -- 지금 섬's plaza is round the origin)
  const O = DAL ? { x: 12, z: -75 } : { x: 0, z: 0 }; // (묶음 1: x 20 is under the east long garden now)
  const tp = (who, x, z) => teleport(who, O.x + x, O.z + z); const meR = async (who) => { const m = await me(who); return { x: m.x - O.x, z: m.z - O.z }; };
  const settleR = (who, id, x, z) => settle(who, id, O.x + x, O.z + z);

  // 1) head-on: A walks straight at B and stops at the contact, never inside
  await tp(b, 0, 10); await tp(a, 0, 8.2);
  await settleR(a, bId, 0, 10);
  await a.page.keyboard.down('ArrowDown'); await a.page.waitForTimeout(1200); await a.page.keyboard.up('ArrowDown');
  let pa = await meR(a);
  expect(Math.hypot(pa.x, pa.z - 10)).toBeGreaterThan(0.86);
  expect(pa.z).toBeLessThan(10);

  // 2) at an angle: A slides along B and gets past, never closer than the contact
  await tp(a, -0.35, 8.4);
  let closest = 99;
  await a.page.keyboard.down('ArrowDown'); await a.page.keyboard.down('ArrowRight');
  for (let i = 0; i < 16; i += 1) { await a.page.waitForTimeout(60); pa = await meR(a); closest = Math.min(closest, Math.hypot(pa.x, pa.z - 10)); }
  await a.page.keyboard.up('ArrowDown'); await a.page.keyboard.up('ArrowRight');
  expect(closest).toBeGreaterThan(0.86);
  expect(pa.z).toBeGreaterThan(10.2); // got past B's side
  expect(pa.x).toBeGreaterThan(0.6);

  // 3) both at once, toward each other: no passing through, no jumps
  await tp(a, 0, 8.4); await tp(b, 0, 10.8);
  await settleR(a, bId, 0, 10.8); await settleR(b, aId, 0, 8.4);
  await a.page.keyboard.down('ArrowDown'); await b.page.keyboard.down('ArrowUp');
  // what each player sees: my character against the other one as drawn on my screen
  const onScreen = async (who, id) => { const [m, o] = [await me(who), await seen(who, id)]; return o ? Math.hypot(m.x - o.x, m.z - o.z) : 99; };
  let prevA = await meR(a); let prevB = await meR(b); let biggestStep = 0; let nearestSeen = 99;
  for (let i = 0; i < 15; i += 1) {
    await a.page.waitForTimeout(100);
    const [na, nb] = [await meR(a), await meR(b)];
    biggestStep = Math.max(biggestStep, Math.hypot(na.x - prevA.x, na.z - prevA.z), Math.hypot(nb.x - prevB.x, nb.z - prevB.z));
    nearestSeen = Math.min(nearestSeen, await onScreen(a, bId), await onScreen(b, aId));
    prevA = na; prevB = nb;
  }
  await a.page.keyboard.up('ArrowDown'); await b.page.keyboard.up('ArrowUp');
  expect(prevA.z).toBeLessThan(prevB.z); // nobody passed through
  expect(nearestSeen).toBeGreaterThan(0.45); // never drawn inside each other (a glide may briefly close the gap while the server settles)
  expect(biggestStep).toBeLessThan(1.2); // no teleporting back and forth
  // at rest: comes still (a server correction may still be gliding for a moment on a slow runner), and apart
  let ra = await meR(a);
  await expect.poll(async () => { const now = await meR(a); const moved = Math.hypot(now.x - ra.x, now.z - ra.z); ra = now; return moved; }, { timeout: 5000, intervals: [400] }).toBeLessThan(0.05);
  const rb = await meR(b);
  expect(Math.hypot(ra.x - rb.x, ra.z - rb.z)).toBeGreaterThan(0.5);

  // 4) B stands right in the shop's door: A still reaches the shop and opens it
  const shopDoor = await b.page.evaluate(() => window.PlazaDebug().doors.records); // (v1.10.92: an island door -- the 전적관's)
  await teleport(b, shopDoor.x, shopDoor.z);
  const door = await me(b);
  await settle(a, bId, door.x, door.z);
  await teleport(a, shopDoor.x + 1.5, shopDoor.z + 1.5); // then walk into the doorway B is standing in
  await a.page.evaluate(() => window.PlazaDebug().place('records'));
  await expect(a.page.locator('#plazaHint')).toHaveText('SPACE · 전적관');
  await a.page.keyboard.press('Space');
  await expect(a.page.locator('#plazaDialog')).toBeVisible();
  await a.page.keyboard.press('Escape');
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.2 게임 아일랜드 채팅: Enter opens the input right on the island (walking keys type, they do not walk), Enter sends
// through the lobby chat, the message pops up over the sender on both screens, Esc cancels, and the 「채팅」 tab shows
// the conversation in a see-through panel. No facility needed.
test('게임 아일랜드 채팅: Enter 입력·전송, 내 말풍선과 다른 사람 화면 말풍선, 입력 중 이동 없음, Esc 취소, 채팅 탭·투명도', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D island pages (see the collision test)
  const a = await intoPlaza(browser, request, '말하는A');
  const b = await intoPlaza(browser, request, '듣는B');
  const idOf = async (who) => { await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 10000 }).toBeTruthy(); return who.page.evaluate(() => window.PlazaDebug().myId); };
  const aId = await idOf(a);
  await expect.poll(() => b.page.evaluate((id) => (window.PlazaDebug().others || []).some((o) => o.id === id), aId), { timeout: 10000 }).toBe(true);
  const page = a.page;
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#islandChatInput')).toBeFocused();
  const before = await state(page);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft'); // typing, not walking
  await page.keyboard.type('안녕하세요 섬 친구들');
  const during = await state(page);
  expect(Math.hypot(during.x - before.x, during.z - before.z)).toBeLessThan(0.01);
  await page.keyboard.press('Enter');
  await expect(page.locator('#islandChatForm')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().bubble), { timeout: 8000 }).toBe('안녕하세요 섬 친구들');
  await expect.poll(() => b.page.evaluate((id) => (window.PlazaDebug().others || []).find((o) => o.id === id)?.bubble, aId), { timeout: 8000 }).toBe('안녕하세요 섬 친구들');
  // walking works again right after sending
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => { const now = await state(page); return Math.hypot(now.x - during.x, now.z - during.z); }, { timeout: 8000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('ArrowUp');
  // Esc cancels without sending
  await page.keyboard.press('Enter'); await page.keyboard.type('보내지 않을 말'); await page.keyboard.press('Escape');
  await expect(page.locator('#islandChatForm')).toBeHidden();
  // the other screen's tab marks the new message; the panel shows it and fades with the slider
  await expect(b.page.locator('#islandChatTab')).toHaveClass(/unread/);
  await b.page.locator('#islandChatTab').click();
  await expect(b.page.locator('#islandChatPanel')).toBeVisible();
  await expect(b.page.locator('#islandChatMessages')).toContainText('안녕하세요 섬 친구들');
  await expect(b.page.locator('#islandChatMessages')).not.toContainText('보내지 않을 말');
  await b.page.locator('#islandChatOpacity').fill('40');
  await expect.poll(() => b.page.locator('#islandChatPanel').evaluate((el) => getComputedStyle(el).backgroundColor)).toContain('0.4');
  // the bubble goes away after a few seconds
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().bubble), { timeout: 12000 }).toBe(null);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.2 시점 회전: dragging on the island turns the camera around me, ↑ then walks into the screen (the new view's
// forward), a drag that ends over a facility does not open it, and a plain click still does.
test('게임 아일랜드 시점: 마우스로 끌어 회전, 방향키는 화면 기준, 끌기는 시설을 열지 않고 클릭은 연다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '돌려보기');
  const { page } = a;
  const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
  const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
  expect(await page.evaluate(() => window.PlazaDebug().camYaw)).toBe(0);
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(cx - k * 20, cy);
  await page.mouse.up();
  // v1.10.21: the view eases to where the drag left it
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().camYaw), { timeout: 3000 }).toBeGreaterThan(1.2);
  await page.waitForTimeout(400);
  const yaw = await page.evaluate(() => window.PlazaDebug().camYaw);
  expect(yaw).toBeGreaterThan(1.2); expect(yaw).toBeLessThan(2); // 200 px ≈ 1.6 rad
  // the minimap (top right) turns with the view: the way I look stays at its top
  await expect.poll(async () => { const d = await page.evaluate(() => window.PlazaDebug()); return Math.abs(Math.atan2(Math.sin(d.minimap.turn - d.camYaw), Math.cos(d.minimap.turn - d.camYaw))); }, { timeout: 3000 }).toBeLessThan(0.01);
  await expect(page.locator('#plazaStage canvas.islandMinimap')).toBeVisible();
  await expect(page.locator('#plazaDialog')).toBeHidden();
  await expect(page.locator('#skinShopDialog')).toBeHidden();
  // ↑ walks away from the camera: along (-sin yaw, -cos yaw)
  const from = await state(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => { const now = await state(page); return Math.hypot(now.x - from.x, now.z - from.z); }, { timeout: 10000 }).toBeGreaterThan(0.6);
  await page.keyboard.up('ArrowUp');
  const to = await state(page);
  const dx = to.x - from.x; const dz = to.z - from.z; const len = Math.hypot(dx, dz);
  expect((dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / len).toBeGreaterThan(0.9);
  // dragging back the other way brings the usual view back
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(cx + k * 20, cy);
  await page.mouse.up();
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.PlazaDebug().camYaw)), { timeout: 3000 }).toBeLessThan(0.05);
  // a plain click on the board (no drag) still opens it
  await page.evaluate(() => window.PlazaDebug().place('board'));
  await page.waitForTimeout(400);
  const board = await page.evaluate(() => window.PlazaDebug().screenOf('board'));
  await page.mouse.click(board.x, board.y);
  await expect(page.locator('#plazaDialogTitle')).toHaveText('게시판');
  await page.locator('#plazaCloseBtn').click();
  // a drag that ends on the board turns the view and does not open it
  await page.mouse.move(board.x + 150, board.y); await page.mouse.down();
  for (let k = 1; k <= 6; k += 1) await page.mouse.move(board.x + 150 - k * 25, board.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator('#plazaDialog')).toBeHidden();
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.21 카메라 회전 확장: W/A/S/D and the mouse turn one shared view -- A/D round my character like dragging, W/S and
// dragging up/down tilt it (v1.10.40: up toward the sky to 45°, down 15°); a held key turns smoothly and stops on release;
// no turning while typing or while a window is open; the camera stays above the ground and out of buildings; the
// arrow keys still walk.
test('게임 아일랜드 카메라: WASD·마우스가 같은 시점을 돌리고, 하늘 쪽 45°·아래 15° 안, 입력창·창이 열린 동안은 무시, 지면·건물 밖', async ({ browser, request }) => {
  test.setTimeout(process.env.CI ? 300000 : 150000); // (CI: the slow runner's frames -- it ran out at 150 s)
  const a = await intoPlaza(browser, request, '카메라');
  const { page } = a;
  const cam = () => page.evaluate(() => { const d = window.PlazaDebug(); return { yaw: d.camYaw, pitch: d.camPitch, max: d.pitchMax, sky: d.skyMax, camera: d.camera }; });
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  await page.locator('#plazaStage').focus();
  const start = await cam();
  expect(start.pitch).toBe(0); expect(start.yaw).toBe(0);
  const max = start.max; expect(max).toBeCloseTo((15 * Math.PI) / 180, 5);
  const sky = start.sky; expect(sky).toBeCloseTo((45 * Math.PI) / 180, 5); // v1.10.40 하늘 보기

  // v1.10.62 확대·축소: the wheel moves the camera in (up) and out (down) within its range, and nothing else changes it
  const zoomNow = () => page.evaluate(() => window.PlazaDebug().zoom);
  const [zoomMin, zoomMax] = await page.evaluate(() => window.PlazaDebug().zoomRange);
  const zoom0 = await zoomNow();
  await page.mouse.move(480, 340);
  await page.mouse.wheel(0, -300); await expect.poll(zoomNow).toBeLessThan(zoom0);
  for (let i = 0; i < 20; i += 1) await page.mouse.wheel(0, 400);
  await expect.poll(zoomNow).toBe(zoomMax);
  for (let i = 0; i < 20; i += 1) await page.mouse.wheel(0, -400);
  await expect.poll(zoomNow).toBe(zoomMin);
  await page.evaluate(() => localStorage.removeItem('gc.islandZoom'));
  for (let i = 0; i < 40 && (await zoomNow()) < zoom0; i += 1) await page.mouse.wheel(0, 30); // back near the default for the rest

  // A turns like dragging left (yaw up), D the other way; on release it stops
  await hold('a', 600);
  await page.waitForTimeout(300);
  const afterA = await cam(); expect(afterA.yaw).toBeGreaterThan(0.3);
  await page.waitForTimeout(400);
  expect(Math.abs((await cam()).yaw - afterA.yaw)).toBeLessThan(0.02); // released: no more turning
  await hold('d', 600); await page.waitForTimeout(300);
  expect((await cam()).yaw).toBeLessThan(afterA.yaw - 0.3);

  // v1.10.40: W looks up toward the sky, never past 45°; S looks down from higher up, never past 15°
  await hold('w', 2500); await page.waitForTimeout(300);
  const up = await cam(); expect(up.pitch).toBeLessThan(-sky + 0.01); expect(up.pitch).toBeGreaterThanOrEqual(-sky - 1e-9);
  expect(up.camera.clear).toBeGreaterThan(0.9); // looking at the sky the camera is still above the ground
  await hold('s', 4000); await page.waitForTimeout(300);
  const down = await cam(); expect(down.pitch).toBeGreaterThan(max - 0.01); expect(down.pitch).toBeLessThanOrEqual(max + 1e-9);

  // the mouse moves the same view: dragging up looks up from where the keys left it, with no jump
  const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
  const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
  const before = await cam();
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let k = 1; k <= 8; k += 1) await page.mouse.move(cx - k * 10, cy - k * 10);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const dragged = await cam();
  expect(dragged.pitch).toBeLessThan(before.pitch - 0.15); // 80 px up: toward the sky
  expect(dragged.yaw).toBeGreaterThan(before.yaw + 0.4); // 80 px left
  // and the keys go on from there: sampled while A turns, the view only ever moves on from the dragged angle (the
  // keys' old angle is 0.64 back the other way) and the tilt stays where the drag left it
  let prev = dragged;
  await page.keyboard.down('a');
  for (let k = 0; k < 8; k += 1) {
    await page.waitForTimeout(60); const now = await cam();
    expect(now.yaw).toBeGreaterThanOrEqual(prev.yaw - 0.01); // no jump back to an old angle
    expect(Math.abs(now.pitch - dragged.pitch)).toBeLessThan(0.02);
    prev = now;
  }
  await page.keyboard.up('a');
  expect(prev.yaw).toBeGreaterThan(dragged.yaw);

  // typing a chat message: W/A/S/D are letters, not camera keys
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#islandChatInput')).toBeFocused();
  const typing = await cam();
  await page.keyboard.type('wasd');
  await page.waitForTimeout(300);
  expect(await page.locator('#islandChatInput').inputValue()).toBe('wasd');
  const typed = await cam(); expect(Math.abs(typed.yaw - typing.yaw)).toBeLessThan(0.02); expect(Math.abs(typed.pitch - typing.pitch)).toBeLessThan(0.02);
  await page.keyboard.press('Escape');

  // a window open over the island: no camera keys either
  await page.evaluate(() => window.PlazaDebug().place('records')); // (v1.10.92: a window of an island facility)
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 전적관');
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toBeVisible();
  const open = await cam();
  await hold('d', 500); await hold('w', 500); await page.waitForTimeout(200);
  const still = await cam(); expect(Math.abs(still.yaw - open.yaw)).toBeLessThan(0.02); expect(Math.abs(still.pitch - open.pitch)).toBeLessThan(0.02);
  await page.keyboard.press('Escape');
  await expect(page.locator('#skinShopDialog')).toBeHidden();

  // the arrows still walk
  const from = await state(page);
  await page.locator('#plazaStage').focus();
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => { const now = await state(page); return Math.hypot(now.x - from.x, now.z - from.z); }, { timeout: 10000 }).toBeGreaterThan(0.5);
  await page.keyboard.up('ArrowUp');

  // all round the island at the lowest tilt: above gentle ground (문제 기록 7: a cliff or the ridge behind is seen through, the
  // camera not lifted over it) and, inside a building, that building faded (behind the game hall, by houses, on the hill)
  await page.evaluate((m) => window.PlazaDebug().setCamPitch(-m), sky); // looking up at the sky: the camera at its lowest
  const spots = await page.evaluate(() => { const d = window.PlazaDebug(); return Object.values(d.doors).map((o) => [o.x, o.z]); });
  for (const [x, z] of spots) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await page.evaluate(([x, z, yaw]) => { const d = window.PlazaDebug(); d.setCamYaw(yaw); d.teleport(x, z); }, [x, z, yaw]);
      const c = (await cam()).camera;
      expect(await page.evaluate(()=>window.PlazaDebug().camDist)).toBeGreaterThanOrEqual(4);
      expect((c.clear > 0.9 || c.rise > 3), `${x.toFixed(1)},${z.toFixed(1)} @${yaw} ${JSON.stringify(c)}`).toBe(true);
      if (c.inBuilding) await expect.poll(async () => (await cam()).camera.faded, { timeout: 3000, message: `${x.toFixed(1)},${z.toFixed(1)} @${yaw}` }).toBeGreaterThan(0);
    }
  }

  // looking back at the game hall from its door: the hall between the camera and me is see-through
  await page.evaluate(async (hall) => { const at = window.PlazaDebug().doors.games; await window.PlazaWarp(at.x,at.z); window.PlazaDebug().setCamYaw(Math.atan2(hall.x - at.x, hall.z - at.z)); }, T.SPOTS.games); // (the camera on the hall's side: 지금 섬 north, 달마루섬 east)
  // The 0.25s fade advances on frames; a snap at the same scene clock only records the obstruction.
  await expect.poll(async () => (await cam()).camera.faded, {timeout:3000}).toBeGreaterThan(0);
  await page.evaluate(() => { const d = window.PlazaDebug(); d.setCamYaw(0); d.teleport(d.doors.games.x, d.doors.games.z); });
  await expect.poll(async () => (await cam()).camera.faded, { timeout: process.env.CI ? 15000 : 3000 }).toBe(0); // v1.10.45: it eases back after a short hold (CI: slow frames)

  // a resized window keeps the tilt in range
  await page.setViewportSize({ width: 820, height: 600 }); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(300);
  const after = await cam(); expect(after.pitch).toBeLessThanOrEqual(max + 1e-9); expect(after.pitch).toBeGreaterThanOrEqual(-sky - 1e-9);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.3 첫 접속 성별 선택: a new account is asked once on its first visit to the island (the window cannot be
// dismissed, the character waits), the choice shows on my character and on everyone else's screen, it is not asked
// again, and the server refuses to change it.
test('첫 접속 성별 선택: 처음 한 번만 묻고, 내 캐릭터·다른 사람 화면에 반영, 다시 묻지 않고 바꿀 수 없다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const watcher = await intoPlaza(browser, request, '구경');
  const a = await shopper(browser, request, '새친구', 0, null);
  const { page } = a;
  await islandPage(page);
  await expect(page.locator('#genderDialog')).toBeVisible({ timeout: 30000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#genderDialog')).toBeVisible(); // a choice is needed
  await expect(page.locator('#genderConfirmBtn')).toBeDisabled();
  let settled = await state(page); // (CI 2차: first still -- a just-started island may still be gliding to its spot on a slow runner)
  await expect.poll(async () => { const now = await state(page); const d = Math.hypot(now.x - settled.x, now.z - settled.z); settled = now; return d; }, { timeout: 15000, intervals: [500] }).toBeLessThan(0.005);
  const before = await state(page);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp');
  expect(Math.hypot((await state(page)).x - before.x, (await state(page)).z - before.z)).toBeLessThan(0.01);
  await page.locator('.genderChoice[data-gender="female"]').click();
  await page.locator('#genderConfirmBtn').click();
  await expect(page.locator('#genderDialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look.gender), { timeout: 8000 }).toBe('female');
  const myId = await page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => watcher.page.evaluate((id) => (window.PlazaDebug().others || []).find((o) => o.id === id)?.look?.gender, myId), { timeout: 10000 }).toBe('female');
  expect((await post(request, '/api/avatar/gender', a.token, { gender: 'male' })).status).toBe(409);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look.gender), { timeout: 8000 }).toBe('female');
  await expect(page.locator('#genderDialog')).toBeHidden();
  for (const who of [a, watcher]) await expectNoScriptError(who.page);
  for (const who of [a, watcher]) await who.context.close();
});

// v1.10.5 기부 동상: last week's donations are closed -- the same total goes to whoever reached it first -- its 1st and
// 2nd stand as statues in the central plaza, its 1st wears 「호구왕」 (on everyone's screen), and the donation box takes
// points (burned) after a second press that names the amount.
test('기부 동상: 지난주 1·2위 동상, 같은 금액은 먼저 도달한 사람이 1위, 1위 호구왕 이름표, 기부함에서 기부하면 포인트 소각', async ({ browser, request }) => {
  test.setTimeout(180000);
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  test.skip(kst.getUTCDay() === 1 && kst.getUTCHours() === 0 && kst.getUTCMinutes() < 31, '월요일 00:00~00:30(KST)은 동상 교체 전');
  const a = await intoPlaza(browser, request, '기부왕', 9_000_000);
  const b = await intoPlaza(browser, request, '기부둘', 9_000_000);
  const gift = 5_000_000 + Math.floor((Date.now() % 1_000_000) / 10) * 10; // bigger than any earlier attempt's (a retry keeps last week's rows)
  const lastWeek = Date.now() - 7 * 24 * 3600 * 1000;
  expect((await post(request, '/api/test/donation/record', a.token, { amount: gift, at: lastWeek })).status).toBe(200);
  await new Promise((r) => setTimeout(r, 30));
  expect((await post(request, '/api/test/donation/record', b.token, { amount: gift, at: lastWeek })).status).toBe(200); // same total, later
  expect((await post(request, '/api/test/donation/settle', null, { reopen: true })).status).toBe(200);
  const idOf = async (who) => { await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 10000 }).toBeTruthy(); return who.page.evaluate(() => window.PlazaDebug().myId); };
  const aId = await idOf(a);
  for (const who of [a, b]) await expect.poll(() => who.page.evaluate(() => window.PlazaDebug().statues.filter((s) => s.rank)), { timeout: 10000 }).toEqual([{ rank: 1, name: '기부왕' }, { rank: 2, name: '기부둘' }]); // (a weekend contest winner may stand too)
  expect(await a.page.evaluate(() => window.PlazaDebug().statueSizes.slice(0, 2))).toEqual(DAL ? [4.2, 3] : [2.6, 1.82]); // v1.10.30: a landmark, the 2nd 70% of the 1st (달마루섬: 영웅마루's 14 m and 10 m niches)
  // 문제 기록 10: the statues keep their colours (not one stone), the plates are big and grow with the distance
  if (DAL) await expect.poll(() => a.page.evaluate(() => Math.min(...window.PlazaDebug().statueLook().colors.slice(0, 2))), { timeout: 15000 }).toBeGreaterThan(3);
  const plates = async (x, z) => { await a.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [x, z]); await a.page.waitForTimeout(400); return a.page.evaluate(() => window.PlazaDebug().statueLook().plates); };
  const nearP = await plates(0, -112); const farP = await plates(0, -10);
  expect(Math.min(...nearP)).toBeGreaterThanOrEqual(4.4); expect(farP[0]).toBeGreaterThan(nearP[0] * 1.5);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().hoguking), { timeout: 10000 }).toBe(true);
  expect(await b.page.evaluate(() => window.PlazaDebug().hoguking)).toBe(false);
  await expect.poll(() => b.page.evaluate((id) => (window.PlazaDebug().others || []).find((o) => o.id === id)?.hoguking, aId), { timeout: 10000 }).toBe(true);

  // Each full-size landmark fades and recovers. Staying behind it neither rebuilds sight
  // bounds nor creates more ghost materials (the source materials stay on the other statue).
  for (const spot of DAL ? [] : [{ x: 12, z: 0 }, { x: 5.5, z: 7.5 }]) { // (달마루섬: the statues stand in 영웅마루's niches -- never between the camera and me)
    await a.page.evaluate(async (p) => { const d = window.PlazaDebug(); d.setCamPitch(0); d.setCamYaw(0); await window.PlazaWarp(p.x, p.z); }, spot);
    await expect.poll(() => a.page.evaluate(p => window.PlazaDebug().camera.occlusion.active.some(r => r.x === p.x && r.z === p.z + 5), spot)).toBe(true);
    const samples = await a.page.evaluate(async () => {
      const frames = [];
      for (let i = 0; i < 30; i++) { await new Promise(requestAnimationFrame); frames.push(window.PlazaDebug().camera.occlusion); }
      return frames;
    });
    expect(samples.at(-1).builds).toBe(samples[0].builds);
    expect(samples.slice(-10).map(s => s.materials)).toEqual(Array(10).fill(samples.at(-1).materials));
    await a.page.evaluate(async () => { const d = window.PlazaDebug(); d.setCamYaw(0); await window.PlazaWarp(-10, 0); });
    // The scene clock advances at most 50 ms per rendered frame. Two software WebGL
    // pages need 16 actual frames for the 400 ms hold + 250 ms recovery, not a wall timer.
    await a.page.evaluate(async () => { for (let i = 0; i < 16; i++) await new Promise(requestAnimationFrame); });
    await expect.poll(() => a.page.evaluate(p => window.PlazaDebug().camera.occlusion.active.some(r => r.x === p.x && r.z === p.z + 5), spot), { timeout: 3000 }).toBe(false);
  }

  // the donation box: amount, a second press naming it, then the points are gone (burned) and this week's total shows
  const page = b.page;
  const before = (await get(request, '/api/points', b.token)).data.balance;
  await page.evaluate(async () => { const d = window.PlazaDebug().doors.donate; await window.PlazaWarp(d.x, d.z); window.PlazaDebug().place('donate'); }); // (by it first: on 달마루섬 the other player at the spawn stands on the way)
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 기부');
  await page.keyboard.press('Space');
  await expect(page.locator('#donationDialog')).toBeVisible();
  await expect(page.locator('#donationLast')).toContainText('기부왕');
  await page.locator('#donationDialog [data-add="10000"]').click();
  await page.locator('#donationSubmit').click();
  await expect(page.locator('#donationSubmit')).toHaveText('10,000P 기부 확인'); // nothing is taken by the first press
  // v1.10.6: the server takes the first try but its answer is lost -- the retry is the same request, burned once
  let dropped = false;
  await page.route('**/api/donation', async (route) => {
    if (route.request().method() !== 'POST' || dropped) return route.fallback();
    dropped = true; await route.fetch(); return route.abort('connectionreset');
  });
  await page.locator('#donationSubmit').click();
  await expect.poll(() => dropped).toBe(true);
  await expect(page.locator('#donationSubmit')).toBeEnabled();
  await page.locator('#donationSubmit').click();
  await expect(page.locator('#donationSubmit')).toHaveText('10,000P 기부 확인');
  await page.locator('#donationSubmit').click();
  await expect(page.locator('#donationStatus')).toContainText('10,000P 기부했습니다');
  await expect(page.locator('#donationMine')).toContainText('이번 주 내 기부 10,000P');
  expect((await get(request, '/api/points', b.token)).data.balance).toBe(before - 10_000);
  await page.locator('#donationCloseBtn').click();
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.9.4 등반 입구 (kept with the other plaza tests: the plaza is one shared square, so its tests run one after another)
test('광장 등반 입구: Space와 클릭이 등반 창을 열고, 창이 열린 동안 멈췄다가 닫으면 다시 걷는다', async ({ browser, request }) => {
  test.setTimeout(process.env.CI ? 120000 : 60000); /* (CI 2차: the island's start alone may take 60 s on the runner) */
  const a = await shopper(browser, request, '입구');
  const { page } = a;
  await islandPage(page);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); // (CI 2차: up to 60 s on the runner)
  await page.evaluate(() => window.PlazaDebug().place('climb'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 등반 도전');
  await page.keyboard.press('Space');
  await expect(page.locator('#climbDialog')).toBeVisible();
  const before = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  const during = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  expect(Math.hypot(during.x - before.x, during.z - before.z)).toBeLessThan(0.01);
  await page.keyboard.press('Escape');
  await expect(page.locator('#climbDialog')).toBeHidden();
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => { const d = await page.evaluate(() => window.PlazaDebug()); return Math.hypot(d.x - during.x, d.z - during.z); }, { timeout: 10000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('ArrowDown');
  // a click on the gate does the same
  await page.evaluate(() => window.PlazaDebug().place('climb'));
  await page.waitForTimeout(300);
  const gate = await page.evaluate(() => window.PlazaDebug().screenOf('climb'));
  await page.mouse.click(gate.x, gate.y);
  await expect(page.locator('#climbDialog')).toBeVisible();
  await page.locator('#climbStartBtn').click();
  await expect(page.locator('#climbView')).toBeVisible();
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.7 게임 아일랜드 당일 위치: a reload (a new login the same day) starts where I last stood, not at the plaza.
test('당일 위치: 새로고침하면 오늘 마지막으로 서 있던 곳에서 시작한다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '위치복원');
  const { page } = a;
  const mid = T.walkCurves[1].pts[Math.floor(T.walkCurves[1].pts.length / 2)]; const SPOT = { x: Math.round(mid[0]), z: Math.round(mid[1]) }; // (a walk: the shop street, or 물가 거리)
  await page.evaluate((p) => window.PlazaWarp(p.x, p.z), SPOT);
  await expect.poll(async () => (await get(request, '/api/plaza/spot', a.token)).data.spot, { timeout: 10000 }).toEqual(SPOT);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug?.()?.running)).catch(() => false), { timeout: 60000 }).toBe(true); await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible(); // (CI 2차: the scene's own shown signal first)
  await expect.poll(() => state(page).then((s) => s?.running), { timeout: 10000 }).toBe(true);
  const at = await state(page);
  expect(Math.hypot(at.x - SPOT.x, at.z - SPOT.z)).toBeLessThan(0.6);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.10 이벤트 인벤토리: the bag (I or the 「가방」 tab) shows what I carry; the town hall settles trash and found
// wallets, the trader buys herbs, berries and mushrooms -- each takes only its own things.
test('가방·관공서·상인: 가방에 쌓이고, 관공서는 쓰레기·지갑만, 상인은 약재만 받아 포인트로 바꾼다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '가방손님');
  const { page } = a;
  for (const [itemId, qty] of [['trash', 3], ['herb', 2], ['wallet', 1], ['trash', 1]]) expect((await post(request, '/api/test/island/give', a.token, { itemId, qty })).status).toBe(200);
  await page.keyboard.press('KeyI');
  await expect(page.locator('#islandBagDialog')).toBeVisible();
  await expect(page.locator('#islandBagCount')).toHaveText('3/16');
  await expect(page.locator('#islandBagGrid [data-item="trash"]')).toContainText('×4');
  await page.locator('#islandBagCloseBtn').click();
  const before = (await get(request, '/api/points', a.token)).data.balance;
  await page.evaluate(() => window.PlazaDebug().place('townhall'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 관공서 들어가기');
  await page.keyboard.press('Space'); // v1.10.84: in, to the 민원실 -- its counter settles
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space)).toBe('townhall');
  // A-7: the window opens from its customer's chair -- seated, the camera on the clerk; closing it stands me up
  await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil'); window.PlazaDebug().teleport(c.x, c.z + 1.1); });
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 앉아서 민원 창구 업무');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().talkView?.id)).toBe('room:desk');
  await expect(page.locator('#islandPlaceSubmit')).toHaveText('정산 +14,000P');
  await page.locator('#islandPlaceSubmit').click();
  await expect(page.locator('#islandPlaceStatus')).toContainText('+14,000P');
  await expect(page.locator('#islandPlaceSubmit')).toBeDisabled();
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before + 14000); // v1.10.35 단가: 쓰레기 1,000 × 4 + 지갑 10,000
  await page.locator('#islandPlaceCloseBtn').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().z - window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil').z)).toBeGreaterThan(0.5); // (stood up, back into the hall -- not behind the desk)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().actLocked)).toBe(false); // (the stand-up motion done)
  // (달마루섬 5단계) the fourth window, 개명 신청: the 작명소's window from its chair
  await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-rename'); window.PlazaDebug().teleport(c.x, c.z + 1.1); });
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 앉아서 개명 신청 업무');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().talkView?.id)).toBe('room:rename');
  await expect(page.locator('#namingCurrent')).toContainText('가방손님');
  await page.locator('#namingCloseBtn').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().actLocked)).toBe(false);
  await page.evaluate(() => window.PlazaDebug().place('room:exit'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 나가기');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space)).toBe('island');
  // (a jump straight after leaving the hall can be put back by the server: again until it holds -- A-7)
  if (DAL) await require('./skin-support').intoMall(page, 'mall:stall'); // (달마루섬: the trader is the 백화점's 노점)
  else await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('trader')); await page.waitForTimeout(1200); return page.evaluate(() => window.PlazaDebug().near); }, { timeout: 30000 }).toBe('trader');
  await expect(page.locator('#plazaHint')).toHaveText(DAL ? 'SPACE · 노점' : 'SPACE · 상인');
  await page.keyboard.press('Space');
  await expect(page.locator('#islandPlaceSubmit')).toHaveText('판매 +8,000P');
  await page.locator('#islandPlaceSubmit').click();
  await expect(page.locator('#islandPlaceStatus')).toContainText('+8,000P');
  await page.locator('#islandPlaceCloseBtn').click();
  await page.locator('#islandBagTab').click();
  await expect(page.locator('#islandBagCount')).toHaveText('0/16');
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before + 22000); // + 약재 4,000 × 2
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.11 서버 공용 랜덤 이벤트: the minimap shows 「!」 only for events inside its round view; standing at one shows
// 「SPACE · 줍기」 (or 채집); solving it takes it off every screen at once.
test('일반 자원: 미니맵 ! 없음, 근접 강조·SPACE 채집·다른 화면 소멸', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D island pages
  const a = await intoPlaza(browser, request, '이벤트손님');
  const b = await intoPlaza(browser, request, '이벤트구경');
  const target = (await get(request, '/api/test/island/events', a.token)).data.events.find((e) => e.type === 'mushroom' && e.state === 'open');
  const key = `ev:${target.type}:${target.id}`;
  const spotNear = (page, from, min, max) => page.evaluate(({ from, min, max }) => { // somewhere one may stand, min..max away
    const d = window.PlazaDebug();
    for (let r = min; r <= max; r += 0.5) for (let k = 0; k < 24; k += 1) { const x = from.x + Math.cos(k * 0.26) * r; const z = from.z + Math.sin(k * 0.26) * r; if (d.walkable(x, z)) return { x, z }; }
    return null;
  }, { from, min, max });
  const shownMatchesRange = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d.minimap.markers === d.markers.filter((m) => Math.hypot(m.x - d.x, m.z - d.z) <= 38).length; });

  // 60 away: the event is known to my screen but not on the minimap
  const far = await spotNear(a.page, target, 58, 70);
  await a.page.evaluate(({ x, z }) => window.PlazaWarp(x, z), far);
  await expect.poll(() => a.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 10000 }).toBe(true);
  await expect.poll(() => shownMatchesRange(a.page), { timeout: 5000 }).toBe(true);
  expect(await a.page.evaluate((t) => window.PlazaDebug().markers.some((m) => Math.hypot(m.x - t.x, m.z - t.z) < 0.01), target)).toBe(false);

  // b watches from nearby; a walks up to it: the 「!」 is on a's minimap and Space solves it
  const watch = await spotNear(b.page, target, 12, 20);
  await b.page.evaluate(({ x, z }) => window.PlazaWarp(x, z), watch);
  await expect.poll(() => b.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 10000 }).toBe(true);
  const close = await spotNear(a.page, target, 0.4, 0.8); // nearer than any weed beside it (the nearest thing is what Space does)
  await a.page.evaluate(({ x, z }) => window.PlazaWarp(x, z), close);
  await expect(a.page.locator('#plazaHint')).toHaveText(/SPACE · 버섯 · 채집/, { timeout: 10000 });
  expect(await a.page.evaluate(t => window.PlazaDebug().markers.some(m => Math.hypot(m.x-t.x,m.z-t.z)<0.01),target)).toBe(false);
  expect(await shownMatchesRange(a.page)).toBe(true);
  await a.page.keyboard.press('Space');
  await expect(a.page.locator('#toast, .toast').first()).toBeVisible({ timeout: 15000 }); // after the gathering motion (slower on CI)
  await expect.poll(() => b.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 5000 }).toBe(false);
  await expect.poll(() => a.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 5000 }).toBe(false);
  expect((await get(request, '/api/test/island/events', a.token)).data.events.find(e=>e.id===target.id).state).toBe('growing');
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.12 배회 NPC: about ten islanders stroll on every screen, in the same places at the same moment (no packets:
// each screen works out their rounds from the server clock), and they walk.
test('배회 NPC: 10명이 걸어 다니고, 두 화면에서 같은 자리에 보인다', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D island pages
  const a = await intoPlaza(browser, request, '구경꾼하나');
  const b = await intoPlaza(browser, request, '구경꾼둘');
  await post(request, '/api/test/island/free-residents', a.token, {}); // (no resident held by an earlier test's event: they all walk their rounds)
  const islanders = (page) => page.evaluate(() => window.PlazaDebug().wanderers);
  await expect.poll(async () => (await islanders(a.page)).length, { timeout: 15000 }).toBe(10);
  await expect.poll(async () => (await islanders(b.page)).length, { timeout: 15000 }).toBe(10);
  await a.page.waitForTimeout(1500); // both have heard the server clock (pose answers)
  // Where an islander's round has it is a pure function of the server clock (island-npcs.js `at`), so the two screens
  // show the same places when they agree on that clock. (v1.10.16: comparing the drawn spots directly measured mostly
  // how far apart the two software-rendered pages' last frames were; what is drawn is checked against the round below.)
  const both = await Promise.all([a.page, b.page].map((page) => page.evaluate(() => { const t = window.PlazaDebug().serverNow(); return { t, list: Array.from({ length: 10 }, (_, n) => window.IslandNpcs.at(n, t)) }; })));
  const lag = Math.abs(both[0].t - both[1].t) / 1000; // the two screens' server clocks (and the two reads) a moment apart
  for (let n = 0; n < 10; n += 1) {
    const p = both[0].list[n]; const q = both[1].list[n];
    expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeLessThan(0.2 + lag * 2); // the same place on the shared round
  }
  const first = await islanders(a.page); await a.page.waitForTimeout(4000); const later = await islanders(a.page);
  expect(first.filter((p, n) => Math.hypot(p.x - later[n].x, p.z - later[n].z) > 1).length).toBeGreaterThan(2); // they walk

  // v1.10.16: over several seconds of real frames, every islander stands on the ground (feet at the terrain or deck
  // height), on standable ground, inside no collision circle, apart from the others and close to its shared round
  const R = await a.page.evaluate(() => window.PlazaDebug().wandererR);
  for (let k = 0; k < 12; k += 1) {
    const list = await islanders(a.page);
    for (const w of list) {
      expect(w.grounded, `n${w.n} 지면`).toBe(true);
      expect(w.walkable, `n${w.n} 설 수 있는 땅`).toBe(true);
      expect(w.clear, `n${w.n} 장애물 밖 (${w.x.toFixed(2)}, ${w.z.toFixed(2)})`).toBe(true);
      expect(w.off, `n${w.n} 경로 근처`).toBeLessThan(5);
    }
    for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
      expect(Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z), `n${i}·n${j} 겹치지 않음`).toBeGreaterThan(2 * R * 0.9);
    }
    await a.page.waitForTimeout(500);
  }
  // standing right where an islander is: it steps out of my way instead of walking through me -- one the island's request
  // has not taken (v1.10.73: a resident held for a photo or lost-thing request stays at its place by design; picking
  // islander 0 failed whenever the open request held it, as in the 2026-10-11 CI run past midnight -- reproduced at
  // 00:02 and 14:00 KST alike)
  const target = (await islanders(a.page)).find((w) => !w.held);
  await a.page.evaluate(({ x, z }) => window.PlazaDebug().teleport(x, z), target);
  await a.page.waitForTimeout(400);
  const gap = await a.page.evaluate((n) => { const d = window.PlazaDebug(); const w = d.wanderers.find((o) => o.n === n); return { d: Math.hypot(w.x - d.x, w.z - d.z), min: d.wandererR + d.radiusAt(d.x, d.z) }; }, target.n);
  expect(gap.d).toBeGreaterThan(gap.min - 0.05);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.63 주민 대화 말풍선 + 몰입형 카메라: a resident's words at the bottom, one line at a time (Space), the camera in
// close on the two of us while they talk (a request taken: the two-shot), and back to my own view when it closes
test('주민 대화: 아래 말풍선, Space로 다음 줄, 숫자로 답, 카메라가 다가갔다가 돌아온다', async ({ browser, request }) => {
  test.setTimeout(90000);
  const a = await intoPlaza(browser, request, '말벗');
  const { page } = a;
  const lost = (await post(request, '/api/test/island/lost', a.token, {})).data.event;
  await page.evaluate(([x, z]) => window.PlazaWarp(x + 0.8, z), [lost.npc.x, lost.npc.z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기', { timeout: 15000 });
  // the owner is what Space talks to (a walking islander or a facility may come nearer for a moment on CI)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().near), { timeout: 15000 }).toBe(`ev:lost_owner:${lost.id}`);
  await page.waitForTimeout(800); // the camera settles behind me
  const before = await page.evaluate(() => window.PlazaDebug().camera);
  await page.locator('#plazaStage').focus();
  const dialog = page.locator('#plazaDialog');
  // (a resident event's owner takes Space only once it has walked in: a slow runner shows the prompt a little earlier;
  // Space again is ignored once the window is open)
  await expect.poll(async () => { if (!/talkMode/.test(await dialog.getAttribute('class') || '')) await page.keyboard.press('Space'); return /talkMode/.test(await dialog.getAttribute('class') || ''); }, { timeout: 20000, intervals: [1500] }).toBe(true); // after the server answers the talk (slow on CI)
  const box = await dialog.boundingBox(); const view = page.viewportSize();
  expect(box.y + box.height).toBeGreaterThan(view.height - 60); // at the bottom
  expect(box.y).toBeGreaterThan(view.height * 0.4); // the island stays in sight above it
  const lines = page.locator('.lostRequest .lostRequestLine');
  await expect(lines.nth(0)).toBeVisible();
  await expect(lines.nth(1)).toBeHidden();
  await page.keyboard.press('Space');
  await expect(lines.nth(1)).toBeVisible();
  await expect(dialog).toBeVisible(); // that Space was the next line, not the answer
  expect(await page.evaluate(() => window.PlazaDebug().talkView)).toMatchObject({ shot: true });
  // v1.10.64: the arrows reach 닫기 too (the answers, then 닫기, round again)
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#plazaCloseBtn')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.lostRequest button').first()).toBeFocused();
  await page.waitForTimeout(900);
  const during = await page.evaluate(() => window.PlazaDebug().camera);
  expect(Math.hypot(during.x - before.x, during.y - before.y, during.z - before.z)).toBeGreaterThan(2);
  await page.keyboard.press('1'); // the first answer: 찾아볼게요
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.PlazaDebug().talkView)).toBeNull();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.PlazaDebug().camera);
  expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeLessThan(1.5);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.73 (IDEAS #bug-event-resident-stuck): a resident taken for a request walks there on the route grid -- from the
// far side of the plaza on October's night (pumpkins out), round the jack-o'-lantern -- and the talk opens on arrival;
// a screen that was paused when the request began (a hidden tab, the game hall) shows them at the place at once
test('이벤트 주민: 광장 반대편에서 길을 찾아 의뢰 자리에 도착하고, 멈췄던 화면은 바로 그 자리에', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await intoPlaza(browser, request, '의뢰손님');
  const { page } = a;
  await page.evaluate(() => window.PlazaDebug().halloween.set(true));
  const gap = (n) => page.evaluate((n) => { const d = window.PlazaDebug(); const w = d.wanderers.find((o) => o.n === n); const h = d.residentReservations[n].hold; return h ? Math.hypot(w.x - h.x, w.z - h.z) : null; }, n);
  const lost = (await post(request, '/api/test/island/lost', a.token, {})).data.event;
  expect(lost?.npc).toBeTruthy();
  const n = lost.npc.resident;
  await expect.poll(() => gap(n), { timeout: 15000 }).not.toBeNull();
  await page.evaluate(({ n, x, z, pc, dal }) => { const dx = x - pc.x; const dz = z - pc.z; const r = Math.hypot(dx, dz); window.PlazaDebug().placeWanderer(n, dal ? x - (dx / r) * Math.min(20, r) : pc.x - (dx / r) * 7, dal ? z - (dz / r) * Math.min(20, r) : pc.z - (dz / r) * 7); }, { n, x: lost.npc.x, z: lost.npc.z, pc: PC, dal: DAL }); // (across the plaza's middle from it; 달마루섬 is far bigger -- 20 m from it toward the plaza)
  await expect.poll(() => gap(n), { timeout: 60000, intervals: [1000] }).toBeLessThan(0.05);
  // (by them -- from the side no weed is on: a weed within reach takes SPACE first)
  await expect.poll(async () => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [lost.npc.x + dx, lost.npc.z + dz]); await page.waitForTimeout(400);
      if (await page.locator('#plazaHint').textContent() === 'SPACE · 말 걸기') return true;
    }
    return false;
  }, { timeout: 30000 }).toBe(true);
  // paused: no frames while the request is taken, then a resident far from its place is drawn right at it
  await page.evaluate(() => { const raf = window.requestAnimationFrame; const held = []; window.__thaw = () => { window.requestAnimationFrame = raf; for (const cb of held.splice(0)) raf(cb); }; window.requestAnimationFrame = (cb) => { held.push(cb); return 0; }; });
  const next = (await post(request, '/api/test/island/lost', a.token, {})).data.event;
  expect(next?.npc).toBeTruthy();
  await page.evaluate(({ n, x, z }) => window.PlazaDebug().placeWanderer(n, x + 30, z), { n: next.npc.resident, x: next.npc.x, z: next.npc.z });
  await expect.poll(() => gap(next.npc.resident), { timeout: 15000 }).not.toBeNull(); // heard while paused
  await page.waitForTimeout(1200);
  const frame = page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  await page.evaluate(() => window.__thaw()); await frame;
  expect(await gap(next.npc.resident)).toBeLessThan(0.05);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.32 운반·전달: a lost thing picked up stays in my hands (in front of the chest, the arms holding it) while I stand
// and walk, the other players see it in mine; given back, the owner takes it hand to hand and only then goes
test('운반·전달: 주운 분실물을 들고 걷고, 다른 사람에게도 보이며, 주인이 받아 든 뒤 떠난다', async ({ browser, request }) => {
  test.setTimeout(180000); // (two island pages; a CI runner took past two minutes)
  const a = await intoPlaza(browser, request, '운반꾼');
  const b = await intoPlaza(browser, request, '구경꾼');
  const { page } = a;
  const lost = (await post(request, '/api/test/island/lost', a.token, {})).data.event;
  expect(lost?.npc).toBeTruthy();
  // The event borrows the same resident on both screens: ten walkers, one identity, exact server wait position (CI 2차: before talking to them --
  // still on the way there, the 말 걸기 by them was another islander's)
  // (both near the owner first: an event is sent to those within 90 m, and on 달마루섬 a lost thing's owner may stand
  // farther than that from the plaza -- the reason this was flaky by the hour, not slowness)
  for (const who of [a, b]) await who.page.evaluate(([x, z]) => window.PlazaWarp(x + 6, z), [lost.npc.x, lost.npc.z]);
  for (const who of [a,b]) {
    await expect.poll(()=>who.page.evaluate(id=>{
      const d=window.PlazaDebug(); const actor=d.eventResidents.find(e=>e.key===`ev:lost_owner:${id}`);
      return actor && {n:actor.n,reused:actor.reused,count:d.wanderers.length,
        near:Math.hypot(actor.x-d.residentReservations[actor.n].hold.x,actor.z-d.residentReservations[actor.n].hold.z)<.01};
    },lost.id),{timeout:60000}).toEqual({n:lost.npc.resident,reused:true,count:10,near:true}); // (달마루섬 is bigger: the walk there takes longer)
  }
  // v1.10.34 부탁: talking to the owner -- what they lost, and its place on my map from anywhere
  await page.evaluate(([x, z]) => window.PlazaWarp(x + 0.8, z), [lost.npc.x, lost.npc.z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialogTitle')).toHaveText('분실물 찾아주기');
  await expect(page.locator('.lostRequest')).toContainText('잃어버렸어요');
  await expect(page.locator('.lostRequest')).toContainText('사례 10,000P');
  await page.locator('.lostRequest button').click();
  await expect(page.locator('#plazaDialog')).toBeHidden();
  await expect.poll(() => page.evaluate((id) => window.PlazaDebug().events.includes(`ev:lost_item:${id}`), lost.id), { timeout: 10000 }).toBe(true); // 12-32 away, on my map
  await page.evaluate(([x, z]) => window.PlazaWarp(x + 0.25, z), [lost.x, lost.z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 줍기', { timeout: 15000 });
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().carry), { timeout: 15000 }).toMatchObject({ mine: lost.id, arms: true, held: true });
  // walking with it
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(() => window.PlazaDebug().carry)).toMatchObject({ mine: lost.id, arms: true, held: true });
  // someone else nearby sees it in my hands
  const here = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z }));
  await b.page.evaluate(([x, z]) => window.PlazaWarp(x + 3, z), [here.x, here.z]);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().carry.others), { timeout: 15000 }).toBe(1);
  // given back: still in my hands a moment, then in the owner's, then the owner goes
  await page.evaluate(([x, z]) => window.PlazaWarp(x + 0.8, z), [lost.npc.x, lost.npc.z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 돌려주기', { timeout: 15000 });
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().carry), { timeout: 10000 }).toMatchObject({ mine: null, arms: false, held: false });
  await expect.poll(() => page.evaluate((id) => window.PlazaDebug().events.includes(`ev:lost_owner:${id}`), lost.id), { timeout: 10000 }).toBe(false);
  // in that order: handed over (Give), held in the owner's hand (Receive) a while, then gone
  const steps = await page.evaluate(() => window.PlazaDebug().lastReturn);
  expect(steps.id).toBe(lost.id);
  expect(steps.steps.map(([name]) => name)).toEqual(['give', 'received', 'gone']);
  expect(steps.steps[1][1]).toBeGreaterThanOrEqual(650); expect(steps.steps[2][1] - steps.steps[1][1]).toBeGreaterThanOrEqual(1200);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().carry.others), { timeout: 15000 }).toBe(0);
  for(const who of [a,b]) {
    await expect.poll(()=>who.page.evaluate(n=>{
      const d=window.PlazaDebug(),w=d.wanderers.find(w=>w.n===n);
      return {count:d.wanderers.length,held:w.held,clear:w.clear,walkable:w.walkable,delay:d.residentReservations[n].delay>0};
    },lost.npc.resident)).toEqual({count:10,held:false,clear:true,walkable:true,delay:true});
    await expectNoScriptError(who.page);
  }
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});

// v1.10.31 잡초 채집: only the nearest weed is offered; Space pulls it in about a second (GatherWeed) and the bag gets
// one; the pulled weed is gone from the island's list. v1.10.40 채집 공통 시스템 (IDEAS 후속 확정 2026-10-07): while
// pulling I stay where I stand -- the arrows do nothing -- and the camera still turns
test('잡초 채집: 가장 가까운 한 포기만, Space 약 1초 뒤 가방 +1, 채집 중에는 제자리(카메라는 회전), 섬에서 사라짐', async ({ browser, request }) => {
  test.setTimeout(90000);
  const a = await intoPlaza(browser, request, '잡초꾼');
  const { page } = a;
  const list = (await get(request, '/api/island/weeds', a.token)).data.weeds; // 1,400 on a fresh island (fewer after other tests pulled some)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().weeds.count), { timeout: 15000 }).toBe(list.length);
  const [id, x, z] = list.find(([, wx, wz]) => Math.hypot(wx, wz) > 30 && Math.hypot(wx - 20, wz - 20) > 5);
  // Stand at the actual weed: the old +0.8m offset could correctly select a nearer coin.
  await page.evaluate(([px, pz]) => window.PlazaWarp(px, pz), [x, z]);
  await expect.poll(() => page.evaluate(([px, pz]) => { const d = window.PlazaDebug(); return Math.hypot(d.x - px, d.z - pz); }, [x, z])).toBeLessThan(0.1);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 잡초 · 뽑기');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().weeds.near)).toBe(`weed:${id}`);
  const pulledId = (await page.evaluate(() => window.PlazaDebug().weeds.near)).slice(5);
  const bagCount = async () => ((await get(request, '/api/island/bag', a.token)).data.items || []).find((e) => e.itemId === 'weed')?.qty || 0;
  let releaseFinish; const finishGate=new Promise(resolve=>{releaseFinish=resolve;});
  await page.route('**/api/island/weed/finish',async route=>{await finishGate;await route.continue();});
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().gather?.kind), { timeout: 5000 }).toBe('weed');
  const from = await state(page); const yaw0 = await page.evaluate(() => window.PlazaDebug().camYaw);
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('a'); await page.waitForTimeout(400);
  const held = await state(page); const yaw1 = await page.evaluate(() => window.PlazaDebug().camYaw);
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('a');
  expect(Math.hypot(held.x - from.x, held.z - from.z)).toBeLessThan(0.05); // not a step
  expect(yaw1).toBeGreaterThan(yaw0 + 0.1); // the camera turned
  releaseFinish();
  await expect.poll(bagCount, { timeout: 10000 }).toBe(1); // and the pull went on to the end
  await expect.poll(() => page.evaluate((w) => window.PlazaDebug().weeds.at(w), pulledId)).toBe(null);
  expect((await get(request, '/api/island/weeds', a.token)).data.weeds.some(([w]) => w === pulledId)).toBe(false);
  void id;
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.41 관공서 확장: the mayor stands in the yard's gate; without his leave a step into the yard is put back out at the
// gate (the server), SPACE by him asks once and he lets me in for the rest of the visit, stepping aside
test('관공서 정문 시장: 허가 전에는 마당에 못 들어가고, 말을 걸어 허가받으면 비켜서고 들어갈 수 있다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '시장손님');
  const { page } = a;
  expect((await post(request, '/api/test/townhall-strict', a.token, {})).status).toBe(200);
  await page.evaluate(() => window.PlazaDebug().halloween.set(false));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().townhall().pass), { timeout: 10000 }).toBe(false); // the next pose's answer
  const th = await page.evaluate(() => window.PlazaDebug().townhall());
  // straight into the yard (as a hand-made pose would): the server puts me back at the gate
  await page.evaluate(() => window.PlazaDebug().place('townhall'));
  await expect.poll(async () => { const s = await state(page); return Math.hypot(s.x - th.out.x, s.z - th.out.z); }, { timeout: 15000 }).toBeLessThan(0.6);
  // asking the mayor
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  // v1.10.45: a click on the hall from out here opens nothing -- only SPACE at its door, in the yard
  await page.evaluate(() => { const T = window.IslandTerrain.TOWNHALL; window.PlazaDebug().setCamYaw(Math.atan2(T.sin, T.cos)); });
  await page.waitForTimeout(500);
  const hallAt = await page.evaluate(() => window.PlazaDebug().screenOf('townhall'));
  await page.mouse.click(hallAt.x, hallAt.y); await page.waitForTimeout(500);
  await expect(page.locator('#islandPlaceDialog')).toBeHidden();
  expect(await page.locator('#plazaStage .plazaCanvas').evaluate((c) => c.style.cursor)).not.toBe('pointer');
  await expect(page.locator('#plazaDialog')).toHaveClass(/talkMode/); // still talking to him (v1.10.63: the speech bubble)
  await page.keyboard.press('Space'); // the bubble's one line is out: Space answers 「용무가 있습니다」
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().townhall().pass)).toBe(true);
  // 문제 기록 8: the gate stays shut while he is still on his way aside; no October pumpkin on his walk
  expect(await page.evaluate(() => window.PlazaDebug().townhall().solidOpen)).toBe(false);
  expect(await page.evaluate(() => { const t = window.PlazaDebug().townhall(); const pts = [t.gate, t.mid, t.aside]; const near = (p) => pts.some((q, i) => { const r = pts[i + 1]; if (!r) return false; const dx = r.x - q.x; const dz = r.z - q.z; const k = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.z - q.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - q.x - dx * k, p.z - q.z - dz * k) < 0.8; }); return window.PlazaDebug().halloween.decor().pumpkins?.filter(near).length ?? 0; })).toBe(0);
  // he steps out of the gate, then aside along the outside of the wall: never back inside the yard behind the wall
  const walk = [];
  for (let k = 0; k < 40; k += 1) { walk.push(await page.evaluate(() => { const t = window.PlazaDebug().townhall(); return window.IslandTerrain.townhallLocal(t.mayorAt.x, t.mayorAt.z); })); await page.waitForTimeout(100); }
  const z1 = await page.evaluate(() => window.IslandTerrain.TOWNHALL.yard.z1);
  for (const w of walk) expect(Math.abs(w.lx) < 1.2 || w.lz > z1 + 0.6, JSON.stringify(w)).toBe(true);
  await expect.poll(async () => { const t = await page.evaluate(() => window.PlazaDebug().townhall()); return Math.hypot(t.mayorAt.x - t.aside.x, t.mayorAt.z - t.aside.z); }, { timeout: 15000 }).toBeLessThan(0.1); // he steps aside
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().townhall().solidOpen)).toBe(true); // (and then the gate opens)
  await page.evaluate(() => window.PlazaDebug().place('townhall'));
  await page.waitForTimeout(1500);
  const inside = await page.evaluate(() => { const d = window.PlazaDebug(); return [d.x, d.z]; });
  expect(await page.evaluate(([x, z]) => window.IslandTerrain.inTownhallYard(x, z), inside)).toBe(true);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 관공서 들어가기');
  // v1.10.45: walking at the hall from the yard stops at the foot of the steps and along the terrace's front, never into it
  // The lowest sky view must also clear the yard walls, pillars and lamps, while retaining the 4m distance floor.
  for (const [lx, lz] of [[0, 11], [-7, 13], [7, 13], [0, 17]]) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const view = await page.evaluate(([lx, lz, yaw]) => {
        const d = window.PlazaDebug(), p = window.IslandTerrain.townhallWorld(lx, lz);
        d.teleport(p.x, p.z); d.setCamPitch(-d.skyMax); d.setCamYaw(yaw);
        const now = window.PlazaDebug(); return { camera: now.camera, distance: now.camDist };
      }, [lx, lz, yaw]);
      const c = view.camera; // (문제 기록 7: no lift -- a wall or the hall the camera stands in fades instead)
      if (c.inBuilding) await expect.poll(() => page.evaluate(() => window.PlazaDebug().camera.faded), { timeout: 3000, message: `${lx},${lz}@${yaw}` }).toBeGreaterThan(0);
      expect((c.clear > 0.9 || c.rise > 3), JSON.stringify(c)).toBe(true); expect(view.distance).toBeGreaterThanOrEqual(4);
    }
  }
  // (달마루섬: the cliff front -- the walk straight at it, stopped within a body's half-width and its circles' scallop of the front)
  await page.evaluate((DAL) => { const d = window.PlazaDebug(); d.setCamPitch(0); d.setCamYaw(DAL ? window.IslandTerrain.TOWNHALL.ry : 0); }, DAL);
  for (const lx of [0, 4.6, -6.5]) {
    await page.evaluate((x) => { const p = window.IslandTerrain.townhallWorld(x, 9.5); window.PlazaDebug().teleport(p.x, p.z); }, lx);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1800); await page.keyboard.up('ArrowUp');
    const at = await page.evaluate(() => { const d = window.PlazaDebug(); return window.IslandTerrain.townhallLocal(d.x, d.z); });
    expect(at.lz, `${lx}: ${JSON.stringify(at)}`).toBeGreaterThan(DAL ? T.TOWNHALL.body.z1 - 0.65 : Math.abs(at.lx) < 3.3 ? 7.4 : 6.3);
  }
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.42 낚시·도감: SPACE by the water casts (I stay put), the bite shows a 「!」 over the bobber and SPACE pulls the
// server's fish into the bag and the 도감; the bag window's 도감 page shows it among the silhouettes
test('낚시: 물가에서 SPACE로 던지고, 입질 때 당기면 가방·도감에 들어간다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '낚시꾼');
  const { page } = a;
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200); // (사용자 2026-10-18: 낚싯대는 잡화점에서)
  // (the pier's far end: 지금 섬's runs south, 달끝나루 out from the east cape)
  const pierAt = (k, side) => (DAL ? { x: T.PIER.x + T.PIER.ux * k - T.PIER.uz * side, z: T.PIER.z + T.PIER.uz * k + T.PIER.ux * side } : { x: T.PIER.x + side, z: T.PIER.z + k });
  await page.evaluate((p) => window.PlazaWarp(p.x, p.z), pierAt(DAL ? 7 : 9, 0));
  const b = await intoPlaza(browser, request, '구경꾼'); // v1.10.89 원격 낚시: someone close by sees it
  await b.page.evaluate((p) => window.PlazaWarp(p.x, p.z), pierAt(DAL ? 4 : 10, DAL ? 1 : 2.5));
  const seen = () => b.page.evaluate(() => window.PlazaDebug().othersActs().find((o) => o.act?.startsWith('fish:'))?.act || null);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().canFish())).toBe(true);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 낚시', { timeout: 10000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.phase), { timeout: 10000 }).toMatch(/cast|wait/);
  await expect.poll(seen, { timeout: 10000 }).toMatch(/^fish:(cast|wait)$/);
  const from = await state(page);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp');
  const still = await state(page); expect(Math.hypot(still.x - from.x, still.z - from.z)).toBeLessThan(0.05); // fishing holds me in place
  // (a long bite on the page, the server's bite just before the pull: one PlazaDebug() call alone took ~2 s on CI, past
  // the server's 2.2 s window)
  // (CI 2차: on a slow runner the cast's own wait can run out before this -- cast again then, until the bite is on)
  await expect.poll(async () => {
    if (!(await page.evaluate(() => window.PlazaDebug().fishing()?.phase))) { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); return 'cast again'; }
    await page.evaluate(() => window.PlazaDebug().fishBiteNow(12)); return page.locator('#plazaHint').textContent();
  }, { timeout: 40000, intervals: [1500] }).toBe('SPACE · 당기기');
  await expect.poll(seen, { timeout: 5000 }).toBe('fish:reel');
  expect((await post(request, '/api/test/fish/bite', a.token, { species: 'mackerel' })).data.ok).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(seen, { timeout: 8000 }).not.toBe('fish:reel'); // past the reel there (the catch -- a moment's pose a slow page may miss -- or done); the bag below is the server's own catch
  await expect.poll(async () => ((await get(request, '/api/island/bag', a.token)).data.items || []).find((e) => e.itemId === 'fish_mackerel')?.qty || 0, { timeout: 10000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
  await expect.poll(seen, { timeout: 8000 }).toBe(null); await b.context.close();
  await page.keyboard.press('KeyI'); await page.locator('#islandDexBtn').click();
  await expect(page.locator('#islandBagCount')).toHaveText('1/43'); // v1.10.43: + the 7 photo spots; v1.10.90 + 13 fish; B 47 + 12 insects
  await expect(page.locator('.islandDexCell:not(.unfound)')).toHaveText(/고등어/);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.43 기념사진 모드: 「사진」 hides the page around the island and every name tag, holds me in place; 「촬영」 saves a PNG
// and by a photo spot keeps it in the 기념사진 page; Esc leaves
test('기념사진: 사진 모드에서 UI·이름표를 숨기고, 촬영하면 PNG 저장·장소 기록, Esc로 나온다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '사진가');
  const { page } = a;
  await page.evaluate((p) => window.PlazaWarp(p.x, p.z + 7), PC);
  await page.locator('#islandPhotoTab').click();
  await expect(page.locator('body')).toHaveClass(/photoMode/);
  await expect(page.locator('#photoBar')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().photo().hidden)).toBeGreaterThan(0);
  const from = await state(page);
  await page.locator('#plazaStage').focus(); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp');
  const still = await state(page); expect(Math.hypot(still.x - from.x, still.z - from.z)).toBeLessThan(0.05);
  const download = page.waitForEvent('download');
  await page.locator('#photoShootBtn').click();
  expect((await download).suggestedFilename()).toMatch(/^game-island-\d{8}-\d{6}\.png$/);
  await expect(page.locator('.toast')).toContainText(DAL ? '대청마당' : '중앙광장');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/photoMode/);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().photo())).toEqual({ on: false, hidden: 0 });
  await page.keyboard.press('KeyI'); await page.locator('#islandPhotoBtn').click();
  await expect(page.locator('#islandBagCount')).toHaveText('1/7');
  await expectNoScriptError(page);
  await a.context.close();
});

test('기념사진: 카운트다운·캡처 대기 취소, 재진입과 접속 종료가 이전 촬영을 저장하지 않는다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a=await intoPlaza(browser,request,'취소사진');const {page}=a;
  await page.evaluate((p)=>window.PlazaWarp(p.x, p.z + 7), PC);
  let downloads=0;let records=0;
  page.on('download',()=>downloads++);
  page.on('request',r=>{if(r.url().endsWith('/api/island/photo') && r.method()==='POST') records++;});
  for(const close of ['escape','button']) {
    await page.locator('#islandPhotoTab').click();await page.locator('#photoShootBtn').click();
    await expect(page.locator('#photoCount')).toHaveText('3');
    if(close==='escape') await page.keyboard.press('Escape');else await page.locator('#photoCloseBtn').click();
    await expect(page.locator('#photoCount')).toBeHidden();
    await expect.poll(()=>page.evaluate(()=>window.PlazaDebug().photo())).toEqual({on:false,hidden:0});
    await page.waitForTimeout(3200); // the old countdown would have saved after three seconds
    expect(downloads).toBe(0);expect(records).toBe(0);
  }
  await page.evaluate(()=>{
    const canvas=document.querySelector('canvas.plazaCanvas');const original=canvas.toBlob;
    canvas.toBlob=function(callback,type){canvas.toBlob=original;window.releaseCancelledPhoto=()=>callback(new Blob(['cancelled'],{type}));};
  });
  await page.locator('#islandPhotoTab').click();await page.locator('#photoShootBtn').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseCancelledPhoto)).toBe('function');
  await page.keyboard.press('Escape');
  await page.locator('#islandPhotoTab').click();const newDownload=page.waitForEvent('download');
  expect(await page.evaluate(async()=>{
    document.getElementById('photoShootBtn').click();window.releaseCancelledPhoto();await Promise.resolve();
    return !document.getElementById('photoCount').classList.contains('hidden');
  })).toBe(true); // old finally must not release the new countdown/pose; no CDP delay between these actions
  const saved=await newDownload;expect(saved.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.locator('.toast')).toContainText(DAL ? '대청마당' : '중앙광장');
  expect(downloads).toBe(1);expect(records).toBe(1);
  await page.keyboard.press('Escape');
  await page.locator('#islandPhotoTab').click();
  // Photo mode hides the normal header; exercise its real logout handlers while the countdown is pending.
  let releaseLogout;const logoutGate=new Promise(resolve=>{releaseLogout=resolve;});
  await page.route('**/api/logout',async route=>{await logoutGate;await route.continue();});
  await page.evaluate(()=>{document.getElementById('photoShootBtn').click();document.getElementById('logoutBtn').click();document.getElementById('logoutConfirmBtn').click();});
  await page.waitForTimeout(3200);expect(downloads).toBe(1);expect(records).toBe(1);
  releaseLogout();
  await expect(page.locator('#gateView')).toBeVisible();await expect(page.locator('#photoCount')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/photoMode/);
  await page.waitForTimeout(3200);expect(downloads).toBe(1);expect(records).toBe(1);
  await expectNoScriptError(page);await a.context.close();
});

// v1.10.81 기념사진 2버튼 (IDEAS #future-photo-action): 「즉시 촬영」 saves at once and keeps what I am doing (seated here);
// 「포즈 촬영」 waits for it to end (a word, nothing stopped); standing, it is the countdown and PhotoPose as before
test('기념사진 2버튼: 앉은 채 즉시 촬영(자세 유지·카운트다운 없음), 포즈 촬영은 행동 뒤', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '즉시사진'); const { page } = a;
  const seat = await page.evaluate(() => { const d = window.PlazaDebug(); const taken = d.takenSeats(); return d.seats.find((s) => !taken[s.id]); });
  await page.evaluate(([x, z, yaw]) => window.PlazaWarp(x + Math.sin(yaw) * 1.2, z + Math.cos(yaw) * 1.2), [seat.x, seat.z, seat.yaw]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 앉기', { timeout: 10000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(true);
  await page.locator('#islandPhotoTab').click();
  await expect(page.locator('body')).toHaveClass(/photoMode/);
  const download = page.waitForEvent('download');
  await page.locator('#photoNowBtn').click();
  await expect(page.locator('#photoCount')).toBeHidden(); // no countdown
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  expect(await page.evaluate(() => window.PlazaDebug().act())).toMatchObject({ sitting: true }); // still seated
  await page.locator('#photoShootBtn').click();
  await expect(page.locator('.toast')).toContainText('즉시 촬영');
  await expect(page.locator('#photoCount')).toBeHidden();
  await page.keyboard.press('ArrowUp'); // the photo mode holds me: still seated
  expect(await page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/photoMode/);
  await expectNoScriptError(page); await a.context.close();
});

// v1.10.47 공중 관광열차: by a stop's boarding spot SPACE gets on the train standing there (riding on its seat, the other
// screen draws me there too), the hint tells the next stop between stops, and SPACE at the next stop gets off onto its spot
test('관광열차: 정류장에서 타고, 다른 화면에도 열차 위에 보이며, 다음 정류장에서 내린다', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await intoPlaza(browser, request, '열차손님', 0, 120000);
  const b = await intoPlaza(browser, request, '열차구경');
  // (either island's timetable: train 1's last stop of a round, S0, and the next, S1 -- 지금 섬 동해안역 then 남서해안역)
  const plan = await a.page.evaluate(() => { const R = window.IslandTrain; const out = []; for (let s = 0; s < R.CYCLE * 2; s += 0.5) { const st = R.timetableAt(1, s * 1000).stop; if (st && (!out.length || out[out.length - 1].st !== st || s - out[out.length - 1].at > 10)) out.push({ at: s, st }); } return { cycle: R.CYCLE, out, names: Object.fromEntries(Object.entries(R.STATIONS).map(([k, v]) => [k, v.name])) }; });
  const k0 = plan.out.filter((x) => x.at < plan.cycle).length - 1; const [A0, A1] = [plan.out[k0], plan.out[k0 + 1]];
  const S0 = A0.st; const S1 = A1.st; const N1 = plan.names[S1]; const round = plan.cycle * 1000;
  const T0 = A0.at - 6; const T1 = A1.at - 6; const MID = A0.at + 6 + (A1.at - A0.at - 6) / 3;
  // Native click honors disabled state. Avoid the multi-frame pointer actionability delay on a software GPU,
  // which can itself consume the entire 4.6s open-door window; the rendered hint is checked before each action.
  const clickDockButton = (button) => button.evaluate(b => b.click());
  // (CI: a slow runner misses the 4.6 s door window between the check and the press -- open it again, press again)
  const inWindow = async (sec, done, press) => expect.poll(async () => {
    if (await done()) return true;
    await shiftTo(sec); await press(); await a.page.waitForTimeout(1500); return done();
  }, { timeout: 90000, intervals: [200] }).toBe(true);
  const riding = () => a.page.evaluate(() => window.PlazaDebug().train().riding?.id ?? null);
  const shiftTo = async (sec) => { const now = Date.now(); const r = await post(request, '/api/test/train-shift', a.token, { ms: Math.ceil(now / round) * round + sec * 1000 - now }); expect(r.status).toBe(200); await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().shift), { timeout: 10000 }).toBe(r.data.trainShift); };
  await shiftTo(T0); // approach the east stop before the open-door window
  const stop = await a.page.evaluate((S0) => window.IslandTrain.stationOf(S0).spot, S0);
  await a.page.evaluate(([x, z]) => window.PlazaWarp(x, z), [stop.x, stop.z]);
  await expect(a.page.locator('#trainMainBtn')).toHaveText('승강장 올라가기', { timeout: 15000 });
  await expect(a.page.locator('#trainMainBtn')).toBeVisible(); await expect(a.page.locator('#plazaHint')).toBeHidden();
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('Space');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().platform?.station)).toBe(S0);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().lifting)).toBe(false);
  const beforeWalk = await state(a.page);
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.down('ArrowRight'); await a.page.waitForTimeout(300); await a.page.keyboard.up('ArrowRight');
  const afterWalk = await state(a.page); expect(Math.hypot(afterWalk.x - beforeWalk.x, afterWalk.z - beforeWalk.z)).toBeGreaterThan(.2);
  // (CI 3차: the window put a second into the doors' open time and the button read and pressed in one call -- waiting for
  // its text and then clicking took the slow runner past the 4.6 s window every time)
  const pressIf = (text) => a.page.locator('#trainMainBtn').evaluate((b, text) => { if (b.textContent.includes(text) && !b.hidden && !b.disabled) b.click(); }, text);
  await inWindow(A0.at + 1, async () => await riding() === 1, async () => {
    await pressIf('타기 · 관광 열차');
  });
  expect((await a.page.evaluate(() => window.PlazaDebug().train())).y).toBeGreaterThan(2.5); // up on the car's seat over the stream
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().train().othersRiding), { timeout: 15000 }).toBe(1);
  // between stops: the next stop and when, not a key to press
  await shiftTo(MID);
  await expect(a.page.locator('#plazaHint')).toContainText(`다음 정류장 · ${N1}`, { timeout: 15000 });
  await expect(a.page.locator('#plazaHint')).not.toContainText('SPACE');
  await expect(a.page.locator('#plazaHint')).toBeVisible(); await expect(a.page.locator('#trainMainBtn')).toBeHidden();
  await expect(a.page.locator('#trainMainBtn')).toHaveText('');
  // at the southwest stop: off, anywhere inside its walkable platform
  await inWindow(A1.at + 1, async () => await riding() === null, async () => {
    await pressIf(`내리기 · ${N1}`);
  });
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().lifting)).toBe(false);
  const deck = await a.page.evaluate(() => { const d=window.PlazaDebug(),p=d.train().platform;const q=window.IslandTrain.platformClamp(p.line,p.station,d.x,d.z);return { station:p.station, drift:Math.hypot(q.x-d.x,q.z-d.z),height:q.y,y:d.train().y }; });
  expect(deck.station).toBe(S1);expect(deck.drift).toBeLessThan(.01);expect(deck.y).toBeCloseTo(deck.height,1);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().train().othersRiding), { timeout: 15000 }).toBe(0);
  await post(request, '/api/test/train-shift', a.token, { ms: 0 });
  await expectNoScriptError(a.page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});

// (CI 2차 단축: the menu's ride on its own -- the whole was past three minutes on the CI runner) up at the second stop's
// platform: the menu says when, 타기 only while a train stands there, then off and down again
test('관광열차 메뉴: 승강장에서 시간에 맞춰 타기·내리기·내려가기', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await intoPlaza(browser, request, '열차메뉴', 0, 120000);
  // (either island's timetable: train 1's last stop of a round, S0, and the next, S1 -- 지금 섬 동해안역 then 남서해안역)
  const plan = await a.page.evaluate(() => { const R = window.IslandTrain; const out = []; for (let s = 0; s < R.CYCLE * 2; s += 0.5) { const st = R.timetableAt(1, s * 1000).stop; if (st && (!out.length || out[out.length - 1].st !== st || s - out[out.length - 1].at > 10)) out.push({ at: s, st }); } return { cycle: R.CYCLE, out, names: Object.fromEntries(Object.entries(R.STATIONS).map(([k, v]) => [k, v.name])) }; });
  const k0 = plan.out.filter((x) => x.at < plan.cycle).length - 1; const [A0, A1] = [plan.out[k0], plan.out[k0 + 1]];
  const S0 = A0.st; const S1 = A1.st; const N1 = plan.names[S1]; const round = plan.cycle * 1000;
  const T0 = A0.at - 6; const T1 = A1.at - 6; const MID = A0.at + 6 + (A1.at - A0.at - 6) / 3;
  const clickDockButton = (button) => button.evaluate(b => b.click());
  const shiftTo = async (sec) => { const now = Date.now(); const r = await post(request, '/api/test/train-shift', a.token, { ms: Math.ceil(now / round) * round + sec * 1000 - now }); expect(r.status).toBe(200); await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().shift), { timeout: 10000 }).toBe(r.data.trainShift); };
  const stop = await a.page.evaluate((S) => window.IslandTrain.stationOf(S).spot, S1);
  await a.page.evaluate(([x, z]) => window.PlazaWarp(x, z), [stop.x, stop.z]);
  await expect(a.page.locator('#trainMainBtn')).toHaveText('승강장 올라가기', { timeout: 15000 });
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('Space');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().platform?.station)).toBe(S1);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().lifting)).toBe(false);
  await shiftTo(T1); // renew the stop window after waiting for the other software-rendered page
  await expect(a.page.locator('#trainMainBtn')).toHaveText('타기 · 관광 열차', { timeout: 15000 });
  await a.page.locator('#trainMenuBtn').click();
  await expect(a.page.getByRole('button', { name: '타기', exact: true })).toBeVisible(); // a PC clock 2 minutes fast: the menu uses the same corrected server clock as the train
  await shiftTo(T1 - 8);
  await expect(a.page.getByRole('button', { name: '타기', exact: true })).toBeDisabled();
  await shiftTo(T1);
  await expect(a.page.getByRole('button', { name: '타기', exact: true })).toBeEnabled({ timeout: 15000 });
  // (CI: a slow runner can miss the 4.6 s door window between the check and the click -- open it again and press again)
  await expect.poll(async () => {
    if (await a.page.evaluate(() => window.PlazaDebug().train().riding?.id) === 1) return 1;
    await shiftTo(T1); const go = a.page.getByRole('button', { name: '타기', exact: true });
    if (!await go.isVisible()) await a.page.locator('#trainMenuBtn').click();
    if (await expect(go).toBeEnabled({ timeout: 15000 }).then(() => true, () => false)) await clickDockButton(go);
    await a.page.waitForTimeout(1500); return a.page.evaluate(() => window.PlazaDebug().train().riding?.id);
  }, { timeout: 60000, intervals: [200] }).toBe(1);
  await shiftTo(T1); await expect(a.page.locator('#trainMainBtn')).toHaveText(`내리기 · ${N1}`, { timeout: 15000 }); const offResponse = a.page.waitForResponse(r => r.url().endsWith('/api/island/train/alight')); await clickDockButton(a.page.locator('#trainMainBtn')); const offResult = await offResponse; expect(await offResult.json()).toMatchObject({ ok: true, stop: S1 });
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().platform?.line)).toBe('tour');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().lifting)).toBe(false);
  await a.page.locator('#trainMenuBtn').click();
  await a.page.getByRole('button', { name: '내려가기', exact: true }).click();
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().lifting)).toBe(false);
  expect(await a.page.evaluate(() => window.PlazaDebug().train().platform)).toBe(null);
  await post(request, '/api/test/train-shift', a.token, { ms: 0 });
  await expectNoScriptError(a.page);
  await a.context.close();
});

// v1.10.44 앉기·이모트·게임 초대: SPACE by a plaza bench sits (the seat is mine on the server; the other screen draws me
// sitting there), an arrow stands me up; SPACE by another player opens 인사·환호·게임 초대 -- a wave shows on their screen,
// and an invite goes with the room I make
test('앉기·인사·게임 초대: 벤치에 앉고 다른 화면에도 보이며, 인사는 상대 화면에서 재생, 게임 초대가 간다', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await intoPlaza(browser, request, '앉는이');
  const b = await intoPlaza(browser, request, '보는이');
  const shopDoor = await a.page.evaluate(() => window.PlazaDebug().doors.accessories);
  const atShop = await post(request, '/api/plaza/state', a.token, { x: shopDoor.x, z: shopDoor.z, yaw: 0, moving: false });
  expect(atShop.status).toBe(200);
  await a.page.evaluate(p => window.PlazaWarp(p.x, p.z), atShop.data);
  // (CI 2차: the hat bought by the API off the island -- with my place on it the server wants the 백화점's 소품 sector, so
  // whether this passed hung on whether the page had reported its place yet; the page puts it back with its next one)
  expect((await post(request, '/api/plaza/leave', a.token, {})).status).toBe(200);
  expect((await post(request, '/api/skins/buy', a.token, { skinId: 'avatar_hat_1' })).status).toBe(200);
  const seat = await a.page.evaluate(() => { const d = window.PlazaDebug(); const taken = d.takenSeats(); return d.seats.find((s) => !s.room && !taken[s.id]); }); // a free plaza bench (another test's sitter may still hold one; the 민원실's seats are far off the island)
  await a.page.evaluate(([x, z, yaw]) => window.PlazaWarp(x + Math.sin(yaw) * 1.2, z + Math.cos(yaw) * 1.2), [seat.x, seat.z, seat.yaw]);
  await expect(a.page.locator('#plazaHint')).toHaveText('SPACE · 앉기', { timeout: 10000 });
  await expect.poll(async () => { // (CI 2차: SPACE when the bench is what it reaches and no motion holds -- again until seated)
    const d = await a.page.evaluate(() => ({ sitting: window.PlazaDebug().act().sitting, near: window.PlazaDebug().near, locked: window.PlazaDebug().actLocked }));
    if (d.sitting) return true; if (d.locked || !d.near?.startsWith('seat:')) return false;
    await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('Space'); await a.page.waitForTimeout(800);
    return a.page.evaluate(() => window.PlazaDebug().act().sitting);
  }, { timeout: 30000, intervals: [500] }).toBe(true);
  const aId = await a.page.evaluate(() => window.PlazaDebug().playerId?.() ?? null);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().othersActs().find((o) => o.act === 'sit')?.seat), { timeout: 15000 }).toBe(seat.id);
  expect(await b.page.evaluate(() => window.PlazaDebug().takenSeats())).toEqual(expect.objectContaining({ [seat.id]: expect.any(String) }));
  // v1.10.45: on the bench's seat, not in it -- lifted on both screens
  await expect.poll(async () => (await a.page.evaluate(() => window.PlazaDebug().act())).lift).toBeCloseTo(0.28, 1); // (CI 2차: settled onto the seat by the sit-down motion)
  expect((await a.page.evaluate(() => window.PlazaDebug().act())).tail).toBe(true); // v1.10.46: a tail tucked while seated
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().othersActs().find((o) => o.act === 'sit')?.lift), { timeout: 10000 }).toBeCloseTo(0.28, 1);
  // Updating the appearance while seated keeps the local pose flag and remote seat claim.
  const equipped = await post(request, '/api/skins/equip', a.token, { skinId: 'avatar_hat_1' });
  expect(equipped.status).toBe(200);
  // The API helper does not run app.js's response handler; forward its actual result through that renderer entry point.
  await a.page.evaluate(avatar => window.PlazaDebug().setAvatar(avatar), equipped.data.avatar);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().look.hat)).toBe('avatar_hat_1');
  expect(await a.page.evaluate(() => window.PlazaDebug().act())).toMatchObject({ sitting: true, tail: true });
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().othersActs().find(o => o.act === 'sit')?.seat)).toBe(seat.id);
  // an arrow stands me up and frees the seat on both screens
  await a.page.keyboard.down('ArrowUp'); await a.page.waitForTimeout(300); await a.page.keyboard.up('ArrowUp');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(false);
  await expect.poll(() => b.page.evaluate(() => Object.keys(window.PlazaDebug().takenSeats()).length), { timeout: 15000 }).toBe(0);
  // beside the other player: 인사
  const bp = await b.page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z }));
  // (CI 2차: an islander walking by comes first for SPACE -- their talk is closed and SPACE pressed again by the player;
  // nor during a motion's hold, when a SPACE goes nowhere)
  const playerMenu = () => expect.poll(async () => {
    if (await a.page.getByRole('button', { name: '인사', exact: true }).isVisible()) return true;
    if (await a.page.locator('#plazaDialog').isVisible()) { await a.page.keyboard.press('Escape'); await a.page.waitForTimeout(300); }
    const d = await a.page.evaluate(() => ({ near: window.PlazaDebug().near, locked: window.PlazaDebug().actLocked }));
    if (d.locked) return false;
    if (!d.near?.startsWith('player:')) { await standAt(request, a, bp.x + 1.3, bp.z); return false; }
    await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('Space'); await a.page.waitForTimeout(500);
    return a.page.getByRole('button', { name: '인사', exact: true }).isVisible();
  }, { timeout: 45000, intervals: [500] }).toBe(true);
  const { standAt } = require('./skin-support');
  await standAt(request, b, bp.x, bp.z); await standAt(request, a, bp.x + 1.3, bp.z); // (CI 2차: the invite is checked on the server's places -- page and server agreeing)
  await playerMenu();
  await a.page.getByRole('button', { name: '인사', exact: true }).click();
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().othersActs().some((o) => o.act === 'bow')), { timeout: 15000 }).toBe(true);
  // 게임 초대: the game hall (v1.10.73 its own screen), a game's sheet, a room, and the invite (CI 2차: once the bow is over and the prompt is back -- a SPACE during it went nowhere)
  await playerMenu();
  await a.page.getByRole('button', { name: '게임 초대' }).click();
  await expect(a.page.locator('#gamehallView')).toBeVisible({ timeout: 10000 });
  await a.page.locator('.gameCard[data-game="omok"]').click();
  await a.page.getByRole('button', { name: '방 만들기' }).click();
  await a.page.locator('#gameSheet #createRoomBtn').click();
  await expect(a.page.locator('.toast')).toContainText('초대', { timeout: 15000 });
  await expect.poll(async () => (await get(request, '/api/invitations', b.token)).data.items?.length || 0, { timeout: 15000 }).toBe(1);
  void aId;
  await expectNoScriptError(a.page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});


async function appearanceShop(browser, request, label, door, name, outfit = false) {
  const a = await shopper(browser, request, label, 1_000_000);
  if (outfit) await buyAndEquip(request, a, ['avatar_outfit_6']);
  const { page } = a;
  await islandPage(page);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); // (CI 2차: up to 60 s on the runner)
  await require('./skin-support').intoMall(page, door); // (v1.10.92: in the 백화점)
  await expect(page.locator('#plazaHint')).toHaveText(`SPACE · ${name}`);
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toBeVisible();
  return a;
}
test('성형 썸네일: 근접 입장과 30개 실제 이미지 로딩', async ({ browser, request }) => {
  const a = await appearanceShop(browser, request, '성형이미지', 'faces', '성형외과');
  const thumbs = a.page.locator('.lookFaceThumb'); await expect(thumbs).toHaveCount(30);
  await thumbs.last().scrollIntoViewIfNeeded();
  await expect.poll(() => thumbs.evaluateAll(images => images.filter(img => img.complete && img.naturalWidth === 128 && img.naturalHeight === 128).length)).toBe(30);
  await expectNoScriptError(a.page); await a.context.close();
});
test('의상 주색: 근접 염색 결제와 무료 원색 복구', async ({ browser, request }) => {
  test.setTimeout(90000); // v1.10.60: 23-29 s on the CI runner, over the default 30 s now and then (main run 38025855881 too)
  const a = await appearanceShop(browser, request, '의상주색', 'dye', '염색사', true);
  const { page, token } = a;
  // Native keyboard activation exercises the same UI handler without waiting for two
  // stable pointer frames on the software-rendered 3D scene (main trace: ~4s/click).
  const outfit = page.locator('[data-item="avatar_outfit_6"]');
  await expect(outfit).toBeVisible(); await expect(outfit).toBeEnabled(); await outfit.press('Enter');
  const before = (await get(request, '/api/donation', token)).data.balance;
  const dye = page.locator('.lookShop [data-color="c12"]');
  await expect(dye).toBeVisible(); await expect(dye).toBeEnabled(); await dye.press('Enter'); await dye.press('Enter');
  await expect.poll(async () => (await get(request, '/api/skins', token)).data.avatar.look.dye?.avatar_outfit_6).toBe('#eda3b8');
  expect((await get(request, '/api/donation', token)).data.balance).toBe(before - 5000);
  const back = page.locator('.lookShop [data-color=""]'); await expect(back).toBeEnabled(); await expect(back).toBeVisible(); await back.press('Enter'); await back.press('Enter');
  await expect.poll(async () => (await get(request, '/api/skins', token)).data.avatar.look.dye?.avatar_outfit_6 || null).toBe(null);
  expect((await get(request, '/api/donation', token)).data.balance).toBe(before - 5000);
  await expectNoScriptError(page); await a.context.close();
});


test('사진가 이야기: 실제 근접 대화·서버 진행·다음 목적지와 중복 없는 주민',async({browser,request})=>{
  test.setTimeout(90000); // a 3D island page: slower on CI
  const a=await intoPlaza(browser,request,'사진가첫이야기'),{page}=a;
  const PG = T.dalmaru ? T.dalmaru.PLACES.quests.photographer : { x: 12, z: 28 }; await page.evaluate((p)=>window.PlazaWarp(p.x + 0.8, p.z), PG);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기');
  await page.locator('#plazaStage').focus();await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialogTitle')).toHaveText('첫 섬 나들이');
  await expect(page.locator('#plazaDialog')).toContainText('사진 부탁');
  await page.locator('#plazaDialog button').filter({hasText:'할게요'}).click();
  await expect.poll(()=>page.evaluate((pg)=>{const d=window.PlazaDebug();return {mark:d.quests().find(q=>q.id==='questphotomemory')?.mark,position:d.markers.some(m=>Math.abs(m.x-pg.x)<.01&&Math.abs(m.z-pg.z)<.01)};},PG)).toEqual({mark:null,position:true});
  expect((await post(request,'/api/test/quest/note',a.token,{what:'photo',qty:3,scope:'fixed'})).status).toBe(200);
  await expect.poll(()=>page.evaluate(()=>window.PlazaDebug().quests().find(q=>q.id==='questphotomemory')?.mark)).toBe('ready');
  await page.locator('#plazaStage').focus();await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText(DAL ? '윤슬다리' : '개울 다리');
  const state=await page.evaluate(()=>{const d=window.PlazaDebug();return {walkers:d.wanderers.length,photoActors:d.quests().filter(q=>['questphotomemory','questphotographer'].includes(q.id)).length};});
  expect(state).toEqual({walkers:10,photoActors:1});
  await expectNoScriptError(page);await a.context.close();
});


test('사진가 기념품: 고정 완료 기록을 별도 사진 탭에서 보고 가방은 비워 둔다',async({browser,request})=>{test.setTimeout(process.env.CI?120000:30000); // (CI: the photo tab's image takes longer on the runner)
  const a=await intoPlaza(browser,request,'첫나들이기록'),{page}=a;
  const Q=require('../../lib/island-quests'),story=Q.STORIES.photomemory;
  const stand=async(p)=>{await page.evaluate(([x,z])=>window.PlazaWarp(x,z),[p.x,p.z]);await post(request,'/api/plaza/state',a.token,{x:p.x,z:p.z,yaw:0});};
  const talk=()=>post(request,'/api/island/event',a.token,{id:'questphotomemory'});
  await stand({x:story.at.x+.8,z:story.at.z});expect((await talk()).status).toBe(200);
  await post(request,'/api/test/quest/note',a.token,{what:'photo',qty:3,scope:'fixed'});
  expect((await talk()).data.reward).toBe(2000);
  for(const [i,step] of story.steps.entries()) if(i>0) {
    await stand(step.spot);
    await expect.poll(async()=>{
      const result=await post(request,'/api/plaza/state',a.token,{x:step.spot.x,z:step.spot.z,yaw:0});
      return result.data.quests?.find(t=>t.story==='photomemory')?.ready;
    }).toBe(true);
    await stand({x:story.at.x+.8,z:story.at.z});expect((await talk()).data.reward).toBe(i===1?3000:17000);
  }
  expect((await get(request,'/api/island/bag',a.token)).data.items).toHaveLength(0);
  await page.locator('#islandBagTab').click();await page.locator('#islandPhotoBtn').click();
  const cell=page.locator('.islandPhotoCell').filter({hasText:'첫 섬 나들이'});
  await expect(cell).toHaveCount(1);await expect(cell.locator('small')).not.toHaveText('');
  await expect(page.locator('#islandBagCount')).toHaveText('0/7'); // v1.10.60: the keepsake shows but the count is of the seven photo spots
  await expect.poll(()=>cell.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expectNoScriptError(page);await a.context.close();
});
