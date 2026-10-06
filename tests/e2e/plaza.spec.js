const { test, expect } = require('@playwright/test');
const { post, get, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// 게임 아일랜드: 방향키 이동, 시설 근처 안내, Space·클릭이 같은 시설 창을 열고, 창이 열린 동안 이동이 멈춘다.
// v1.9.7부터 일반 사용자에게 기존 로비 전환 UI는 없고, 계정 메뉴는 관리자 창(관리자만)·내 정보·접속 종료만 둔다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
// The plaza is one shared square and each page renders 3D: these run one after another (users of another test would
// walk into this one, and several software-rendered pages at once are slow).
test.describe.configure({ mode: 'default' });

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

async function intoPlaza(browser, request, label, points = 0) {
  const who = await shopper(browser, request, label, points);
  await expect(who.page.locator('#lobbyView')).toBeVisible();
  await islandPage(who.page);
  await expect(who.page.locator('#lobbyView')).toBeVisible();
  await expect(who.page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => state(who.page).then((s) => s?.running), { timeout: 10000 }).toBe(true);
  return who;
}

test('광장: 방향키로 걷고, 시설 앞 안내, Space와 클릭이 같은 창을 열며 창이 열린 동안 멈춘다', async ({ browser, request }) => {
  test.setTimeout(60000); // a software-rendered 3D page walking to two facilities: about 21-29 s on a CI runner already
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

test('게임 아일랜드: 게임관에서 방을 만들고 돌아와도 아일랜드 유지, 기존 로비 전환 UI 없음', async ({ browser, request }) => {
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

  await expect(page.locator('#lobbyModeBtn')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#lobbyModeBtn')).toHaveCount(0);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.9.2 광장 V2: 상점의 광장 아바타 탭(헤어·의상·모자, 칭호)과 광장 캐릭터가 같은 모습이고, 장착하면 바로 바뀐다.
test('광장 아바타: 상점에서 산 헤어·의상·모자와 전설 칭호가 광장 캐릭터와 이름표에 바로 나온다', async ({ browser, request }) => {
  test.setTimeout(60000); // a software-rendered 3D page through the shop: 18-29 s on a CI runner, at the default 30 s on a slow one
  const a = await intoPlaza(browser, request, '아바타', 7_000_000);
  const { page } = a;
  await buyAndEquip(request, a, ['avatar_hair_6', 'avatar_outfit_5', 'omok_l1']);
  expect((await post(request, '/api/skins/buy', a.token, { skinId: 'avatar_hat_4' })).status).toBe(200); // owned, not worn yet
  expect((await post(request, '/api/skins/title', a.token, { skinId: 'omok_l1' })).status).toBe(200);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look), { timeout: 8000 }).toEqual({ hair: 'avatar_hair_6', outfit: 'avatar_outfit_5', gender: 'male' }); // v1.10.3: the look carries the chosen body
  expect(await page.evaluate(() => window.PlazaDebug().title)).toBe('천상 바둑');
  expect(await page.evaluate(() => window.PlazaDebug().tag)).toBe(true);

  // v1.10.30 상점가 꾸미기 점포 세분화: 옷가게는 의상과 칭호, 미용실은 헤어, 잡화점은 모자·장식만 판다; 장착하면 바로 바뀐다.
  const dialog = page.locator('#skinShopDialog');
  const visit = async (id, name, count) => {
    await page.evaluate((door) => window.PlazaDebug().place(door), id);
    await expect(page.locator('#plazaHint')).toHaveText(`SPACE · ${name}`);
    await page.keyboard.press('Space');
    await expect(dialog.locator('#skinShopTitle')).toHaveText(name);
    await expect(dialog.getByRole('tab').first()).toHaveText('광장 아바타'); // game skins are sold next door
    await expect(dialog.locator('.skinCard')).toHaveCount(count);
  };
  await visit('hair', '미용실', 12); // v1.10.32: + the six new hair styles
  await expect(dialog.locator('.skinCard')).toContainText(['양갈래 머리']);
  await dialog.locator('#skinShopCloseBtn').click();
  await visit('accessories', '잡화점', 12);
  // v1.10.32: the five accessory slots, a tab each (the hats first)
  await expect(dialog.locator('.skinSlotTabs [role=tab]')).toHaveText(['모자·장식', '망토', '꼬리', '신발', '목걸이']);
  await expect(dialog.locator('.skinCard').filter({ hasText: '왕관' })).toContainText('고급 · 모자·장식');
  await dialog.locator('.skinSlotTabs [role=tab]').filter({ hasText: '망토' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(10);
  await expect(dialog.locator('.skinCard').filter({ hasText: '작은 날개 망토' })).toContainText('전설 · 망토');
  await expect(dialog.locator('.skinCard').filter({ hasText: '작은 날개 망토' })).toContainText('1,500,000P');
  await dialog.locator('.skinSlotTabs [role=tab]').filter({ hasText: '모자·장식' }).click();
  await expect(dialog.locator('.skinTitle')).toHaveCount(0); // the title is the clothes shop's
  await dialog.locator('.skinCard').filter({ hasText: '왕관' }).getByRole('button', { name: '장착' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look.hat), { timeout: 8000 }).toBe('avatar_hat_4');
  await dialog.locator('#skinShopCloseBtn').click();
  await visit('avatar', '옷가게', 15);
  await expect(dialog.locator('.skinTitle.selected')).toHaveText('천상 바둑');
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
  const idOf = (who) => expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 10000 }).toBeTruthy().then(() => who.page.evaluate(() => window.PlazaDebug().myId));
  const aId = await idOf(a); const bId = await idOf(b);
  const seen = (who, id) => who.page.evaluate((other) => (window.PlazaDebug()?.others || []).find((o) => o.id === other) || null, id);
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).not.toBeNull();
  await expect.poll(() => seen(a, bId), { timeout: 10000 }).not.toBeNull();
  expect((await seen(b, aId)).tag).toBe(true);
  expect(await seen(a, aId)).toBeNull(); // never myself

  // a walks to the shop door: b sees a's character arrive there.
  // a warp, not place(): a walk-check from the spawn would stop at b when b happens to stand on the straight line (v1.9.6 collision)
  const door = await a.page.evaluate(async () => { const d = window.PlazaDebug().doors.shop; await window.PlazaWarp(d.x, d.z); return { x: window.PlazaDebug().x, z: window.PlazaDebug().z }; });
  await expect.poll(async () => { const o = await seen(b, aId); return o ? Math.hypot(o.x - door.x, o.z - door.z) : 99; }, { timeout: 10000 }).toBeLessThan(0.5);

  // v1.10.8: a walks down the harbour walk; on b's screen a moves on evenly -- never backward, never faster than a
  // run in a frame (no surge after a late update), and arrives where a stopped
  await a.page.evaluate(() => window.PlazaWarp(-1, 22));
  await expect.poll(async () => { const o = await seen(b, aId); return o ? Math.hypot(o.x + 1, o.z - 22) : 99; }, { timeout: 10000 }).toBeLessThan(0.5);
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
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().z), { timeout: 15000 }).toBeGreaterThan(24);
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
  await a.page.locator('#plazaDialog #createRoomBtn').click();
  await expect(a.page.locator('#roomView')).toBeVisible();
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).toBeNull();
  await a.page.locator('#leaveRoomBtn').click();
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).not.toBeNull();

  // b reloads (a reconnect): a is still there.
  await b.page.reload();
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 15000 }).toBe(true);
  await expect.poll(() => seen(b, aId), { timeout: 10000 }).not.toBeNull();
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.9.5 주간 챔피언: 지난주 공동 1위 두 사람 모두 광장 이름표에 「챔피언」이 붙고, 다른 사람에게도 같게 보이며, 다시 접속해도 그대로다.
test('광장 챔피언: 공동 1위 둘 다 챔피언 이름표, 다른 사람에게도 보이고 재접속 후에도 유지', async ({ browser, request }) => {
  test.setTimeout(150000); // three 3D pages on a software renderer: 52-96 s on a CI runner already
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
    await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true); // three 3D pages on a software renderer
  }
  const idOf = async (who) => { await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.myId), { timeout: 10000 }).toBeTruthy(); return who.page.evaluate(() => window.PlazaDebug().myId); };
  const [idA, idB, idC] = [await idOf(champs[0]), await idOf(champs[1]), await idOf(plain)];
  const seen = (who, id) => who.page.evaluate((other) => (window.PlazaDebug()?.others || []).find((o) => o.id === other) || null, id);
  // everyone sees the two champions marked, and the third not
  for (const [viewer, others] of [[plain, [idA, idB]], [champs[0], [idB]], [champs[1], [idA]]]) {
    for (const id of others) await expect.poll(() => seen(viewer, id).then((o) => o?.champion), { timeout: 10000 }).toBe(true);
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

  // 1) head-on: A walks straight at B and stops at the contact, never inside
  await teleport(b, 0, 10); await teleport(a, 0, 8.2);
  await settle(a, bId, 0, 10);
  await a.page.keyboard.down('ArrowDown'); await a.page.waitForTimeout(1200); await a.page.keyboard.up('ArrowDown');
  let pa = await me(a);
  expect(Math.hypot(pa.x, pa.z - 10)).toBeGreaterThan(0.86);
  expect(pa.z).toBeLessThan(10);

  // 2) at an angle: A slides along B and gets past, never closer than the contact
  await teleport(a, -0.35, 8.4);
  let closest = 99;
  await a.page.keyboard.down('ArrowDown'); await a.page.keyboard.down('ArrowRight');
  for (let i = 0; i < 16; i += 1) { await a.page.waitForTimeout(60); pa = await me(a); closest = Math.min(closest, Math.hypot(pa.x, pa.z - 10)); }
  await a.page.keyboard.up('ArrowDown'); await a.page.keyboard.up('ArrowRight');
  expect(closest).toBeGreaterThan(0.86);
  expect(pa.z).toBeGreaterThan(10.2); // got past B's side
  expect(pa.x).toBeGreaterThan(0.6);

  // 3) both at once, toward each other: no passing through, no jumps
  await teleport(a, 0, 8.4); await teleport(b, 0, 10.8);
  await settle(a, bId, 0, 10.8); await settle(b, aId, 0, 8.4);
  await a.page.keyboard.down('ArrowDown'); await b.page.keyboard.down('ArrowUp');
  // what each player sees: my character against the other one as drawn on my screen
  const onScreen = async (who, id) => { const [m, o] = [await me(who), await seen(who, id)]; return o ? Math.hypot(m.x - o.x, m.z - o.z) : 99; };
  let prevA = await me(a); let prevB = await me(b); let biggestStep = 0; let nearestSeen = 99;
  for (let i = 0; i < 15; i += 1) {
    await a.page.waitForTimeout(100);
    const [na, nb] = [await me(a), await me(b)];
    biggestStep = Math.max(biggestStep, Math.hypot(na.x - prevA.x, na.z - prevA.z), Math.hypot(nb.x - prevB.x, nb.z - prevB.z));
    nearestSeen = Math.min(nearestSeen, await onScreen(a, bId), await onScreen(b, aId));
    prevA = na; prevB = nb;
  }
  await a.page.keyboard.up('ArrowDown'); await b.page.keyboard.up('ArrowUp');
  expect(prevA.z).toBeLessThan(prevB.z); // nobody passed through
  expect(nearestSeen).toBeGreaterThan(0.45); // never drawn inside each other (a glide may briefly close the gap while the server settles)
  expect(biggestStep).toBeLessThan(1.2); // no teleporting back and forth
  // at rest: comes still (a server correction may still be gliding for a moment on a slow runner), and apart
  let ra = await me(a);
  await expect.poll(async () => { const now = await me(a); const moved = Math.hypot(now.x - ra.x, now.z - ra.z); ra = now; return moved; }, { timeout: 5000, intervals: [400] }).toBeLessThan(0.05);
  const rb = await me(b);
  expect(Math.hypot(ra.x - rb.x, ra.z - rb.z)).toBeGreaterThan(0.5);

  // 4) B stands right in the shop's door: A still reaches the shop and opens it
  const shopDoor = await b.page.evaluate(() => window.PlazaDebug().doors.shop);
  await teleport(b, shopDoor.x, shopDoor.z);
  const door = await me(b);
  await settle(a, bId, door.x, door.z);
  await teleport(a, shopDoor.x + 1.5, shopDoor.z + 1.5); // then walk into the doorway B is standing in
  await a.page.evaluate(() => window.PlazaDebug().place('shop'));
  await expect(a.page.locator('#plazaHint')).toHaveText('SPACE · 게임 스킨 상점');
  await a.page.keyboard.press('Space');
  await expect(a.page.locator('#skinShopDialog')).toBeVisible();
  await a.page.keyboard.press('Escape');
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.0 게임 아일랜드 지형: start in the raised central plaza; the sea, streams and pond stop you while bridges and
// the pier carry you; every facility's entrance stands on walkable ground; the map board opens the island map.
test('게임 아일랜드 지형: 중앙광장 시작, 바다·물길은 막고 다리·선착장은 건넌다, 모든 시설 입구에 닿고 안내 지도가 열린다', async ({ browser, request }) => {
  test.setTimeout(90000);
  const a = await intoPlaza(browser, request, '섬탐험');
  const { page } = a;
  const d = () => page.evaluate(() => window.PlazaDebug());
  const start = await d();
  expect(Math.hypot(start.x, start.z)).toBeLessThan(12); // the plaza (radius 16) around the fountain
  const plazaH = await page.evaluate(() => window.PlazaDebug().heightAt(0, 8));
  expect(plazaH).toBeGreaterThan(await page.evaluate(() => window.PlazaDebug().heightAt(0, 30)) + 0.4); // a little higher than around it
  // about 40 s across: land reaches far out on both sides, the sea beyond
  const reach = await page.evaluate(() => { const w = window.PlazaDebug().walkable; let east = 0; let west = 0; for (let x = 0; x < 140; x += 1) { if (w(x, 0)) east = x; if (w(-x, 0)) west = x; } return east + west; });
  expect(reach / 5.2).toBeGreaterThan(30); expect(reach / 5.2).toBeLessThan(48);
  // streams block, their bridges do not
  const bridges = start.bridges; expect(bridges.length).toBeGreaterThanOrEqual(4);
  for (const b of bridges) {
    expect(await page.evaluate(([x, z]) => window.PlazaDebug().walkable(x, z), [b.x, b.z])).toBe(true);
    expect(await page.evaluate(([x, z]) => window.PlazaDebug().walkable(x, z), [b.x - b.uz * (b.w / 2 + 0.5), b.z + b.ux * (b.w / 2 + 0.5)])).toBe(false); // just past its rail: water
  }
  // every facility's entrance is reachable ground
  for (const [id, door] of Object.entries(start.doors)) expect(await page.evaluate(([x, z]) => window.PlazaDebug().walkable(x, z), [door.x, door.z]), id).toBe(true);
  // walking south down the pier stops at its end, over the sea
  const pier = start.pier;
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [pier.x, pier.z + pier.half - 3]);
  await page.keyboard.down('ArrowDown'); // held until it reaches the end (a slow runner draws few frames), then a little more
  await expect.poll(async () => (await d()).z, { timeout: 15000 }).toBeGreaterThan(pier.z + pier.half - 1.5);
  await page.waitForTimeout(800); await page.keyboard.up('ArrowDown');
  const end = await d();
  expect(end.z).toBeLessThan(pier.z + pier.half + 0.5); // stopped at the end, over the sea
  // the map board opens the island map in a window
  await page.evaluate(() => window.PlazaDebug().place('map'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 안내 지도');
  await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog #islandMapCanvas')).toBeVisible();
  const painted = await page.evaluate(() => { const c = document.getElementById('islandMapCanvas'); const px = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return px[3] > 0; });
  expect(painted).toBe(true);
  await page.locator('#plazaCloseBtn').click();
  await expectNoScriptError(page);
  await a.context.close();
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
// dragging up/down tilt it within ±15° of the default quarter view; a held key turns smoothly and stops on release;
// no turning while typing or while a window is open; the camera stays above the ground and out of buildings; the
// arrow keys still walk.
test('게임 아일랜드 카메라: WASD·마우스가 같은 시점을 돌리고, 상하 ±15° 안, 입력창·창이 열린 동안은 무시, 지면·건물 밖', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await intoPlaza(browser, request, '카메라');
  const { page } = a;
  const cam = () => page.evaluate(() => { const d = window.PlazaDebug(); return { yaw: d.camYaw, pitch: d.camPitch, max: d.pitchMax, camera: d.camera }; });
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  await page.locator('#plazaStage').focus();
  const start = await cam();
  expect(start.pitch).toBe(0); expect(start.yaw).toBe(0);
  const max = start.max; expect(max).toBeCloseTo((15 * Math.PI) / 180, 5);

  // A turns like dragging left (yaw up), D the other way; on release it stops
  await hold('a', 600);
  await page.waitForTimeout(300);
  const afterA = await cam(); expect(afterA.yaw).toBeGreaterThan(0.3);
  await page.waitForTimeout(400);
  expect(Math.abs((await cam()).yaw - afterA.yaw)).toBeLessThan(0.02); // released: no more turning
  await hold('d', 600); await page.waitForTimeout(300);
  expect((await cam()).yaw).toBeLessThan(afterA.yaw - 0.3);

  // W / S tilt, never past ±15°
  await hold('w', 2500); await page.waitForTimeout(300);
  const up = await cam(); expect(up.pitch).toBeGreaterThan(max - 0.01); expect(up.pitch).toBeLessThanOrEqual(max + 1e-9);
  await hold('s', 3500); await page.waitForTimeout(300);
  const down = await cam(); expect(down.pitch).toBeLessThan(-max + 0.01); expect(down.pitch).toBeGreaterThanOrEqual(-max - 1e-9);
  expect(down.camera.clear).toBeGreaterThan(0.9); // the lowest view is still above the ground

  // the mouse moves the same view: dragging up tilts up from where the keys left it, with no jump
  const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
  const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
  const before = await cam();
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let k = 1; k <= 8; k += 1) await page.mouse.move(cx - k * 10, cy - k * 10);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const dragged = await cam();
  expect(dragged.pitch).toBeGreaterThan(before.pitch + 0.15); // 80 px up
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
  await page.evaluate(() => window.PlazaDebug().place('shop'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임 스킨 상점');
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#skinShopDialog')).toBeVisible();
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

  // all round the island at the lowest tilt: above the ground and outside buildings (behind the game hall, by houses, on the hill)
  await page.evaluate((m) => window.PlazaDebug().setCamPitch(-m), max);
  const spots = await page.evaluate(() => { const d = window.PlazaDebug(); return Object.values(d.doors).map((o) => [o.x, o.z]); });
  for (const [x, z] of spots) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await page.evaluate(([x, z, yaw]) => { const d = window.PlazaDebug(); d.setCamYaw(yaw); d.teleport(x, z); }, [x, z, yaw]);
      const c = (await cam()).camera;
      expect(c.clear, `${x.toFixed(1)},${z.toFixed(1)} @${yaw}`).toBeGreaterThan(0.9);
      expect(c.inBuilding, `${x.toFixed(1)},${z.toFixed(1)} @${yaw}`).toBe(false);
    }
  }

  // looking back at the game hall from its door: the hall between the camera and me is see-through
  await page.evaluate(() => { const d = window.PlazaDebug(); d.setCamYaw(Math.PI); d.teleport(d.doors.games.x, d.doors.games.z); });
  expect((await cam()).camera.faded).toBeGreaterThan(0);
  await page.evaluate(() => { const d = window.PlazaDebug(); d.setCamYaw(0); d.teleport(d.doors.games.x, d.doors.games.z); });
  expect((await cam()).camera.faded).toBe(0);

  // a resized window keeps the tilt in range
  await page.setViewportSize({ width: 820, height: 600 }); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(300);
  const after = await cam(); expect(Math.abs(after.pitch)).toBeLessThanOrEqual(max + 1e-9);
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
  for (const who of [a, b]) await expect.poll(() => who.page.evaluate(() => window.PlazaDebug().statues), { timeout: 10000 }).toEqual([{ rank: 1, name: '기부왕' }, { rank: 2, name: '기부둘' }]);
  expect(await a.page.evaluate(() => window.PlazaDebug().statueSizes)).toEqual([2.6, 1.82]); // v1.10.30: a landmark, the 2nd 70% of the 1st
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().hoguking), { timeout: 10000 }).toBe(true);
  expect(await b.page.evaluate(() => window.PlazaDebug().hoguking)).toBe(false);
  await expect.poll(() => b.page.evaluate((id) => (window.PlazaDebug().others || []).find((o) => o.id === id)?.hoguking, aId), { timeout: 10000 }).toBe(true);

  // the donation box: amount, a second press naming it, then the points are gone (burned) and this week's total shows
  const page = b.page;
  const before = (await get(request, '/api/points', b.token)).data.balance;
  await page.evaluate(() => window.PlazaDebug().place('donate'));
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
  test.setTimeout(60000);
  const a = await shopper(browser, request, '입구');
  const { page } = a;
  await islandPage(page);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 15000 }).toBe(true);
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
  await page.evaluate(() => window.PlazaWarp(25, 4)); // the shop street walk
  await expect.poll(async () => (await get(request, '/api/plaza/spot', a.token)).data.spot, { timeout: 10000 }).toEqual({ x: 25, z: 4 });
  await page.reload();
  await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => state(page).then((s) => s?.running), { timeout: 10000 }).toBe(true);
  const at = await state(page);
  expect(Math.hypot(at.x - 25, at.z - 4)).toBeLessThan(0.6);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.9 작명소: the desk on the shop street opens the window; a new name costs 100,000P on a second press, shows at
// once, and the next change waits 24 hours.
test('작명소: 상점가 책상에서 이름을 바꾸면 100,000P 차감, 바로 반영, 24시간 대기', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '작명손님', 200_000);
  const { page } = a;
  const before = (await get(request, '/api/points', a.token)).data.balance;
  await page.evaluate(() => window.PlazaDebug().place('naming'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 작명소');
  await page.keyboard.press('Space');
  await expect(page.locator('#namingDialog')).toBeVisible();
  await expect(page.locator('#namingCurrent')).toContainText('작명손님');
  await page.locator('#namingInput').fill('abc');
  await page.locator('#namingSubmit').click();
  await expect(page.locator('#namingStatus')).toContainText('한글·숫자·공백');
  await page.locator('#namingInput').fill('새 손님 7');
  await page.locator('#namingSubmit').click();
  await expect(page.locator('#namingSubmit')).toHaveText('100,000P 변경 확인'); // nothing is taken by the first press
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before);
  await page.locator('#namingSubmit').click();
  await expect(page.locator('#namingStatus')).toContainText('새 손님 7');
  await expect(page.locator('#namingCurrent')).toContainText('새 손님 7');
  await expect(page.locator('#namingWait')).toContainText('다시 바꿀 수 있습니다');
  await expect(page.locator('#namingSubmit')).toBeDisabled();
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before - 100_000);
  await expect(page.locator('#identityLabel')).toContainText('새 손님 7');
  await page.locator('#namingCloseBtn').click();
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
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 관공서');
  await page.keyboard.press('Space');
  await expect(page.locator('#islandPlaceSubmit')).toHaveText('정산 +7,000P');
  await page.locator('#islandPlaceSubmit').click();
  await expect(page.locator('#islandPlaceStatus')).toContainText('+7,000P');
  await expect(page.locator('#islandPlaceSubmit')).toBeDisabled();
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before + 7000); // v1.10.31 단가: 쓰레기 500 × 4 + 지갑 5,000
  await page.locator('#islandPlaceCloseBtn').click();
  await page.evaluate(() => window.PlazaDebug().place('trader'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 상인');
  await page.keyboard.press('Space');
  await expect(page.locator('#islandPlaceSubmit')).toHaveText('판매 +4,000P');
  await page.locator('#islandPlaceSubmit').click();
  await expect(page.locator('#islandPlaceStatus')).toContainText('+4,000P');
  await page.locator('#islandPlaceCloseBtn').click();
  await page.locator('#islandBagTab').click();
  await expect(page.locator('#islandBagCount')).toHaveText('0/16');
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before + 11000); // + 약재 2,000 × 2
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.11 서버 공용 랜덤 이벤트: the minimap shows 「!」 only for events inside its round view; standing at one shows
// 「SPACE · 줍기」 (or 채집); solving it takes it off every screen at once.
test('공용 이벤트: 미니맵 범위 안에서만 !, SPACE로 해결, 다른 사람 화면에서도 바로 사라진다', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D island pages
  const a = await intoPlaza(browser, request, '이벤트손님');
  const b = await intoPlaza(browser, request, '이벤트구경');
  const target = (await get(request, '/api/test/island/events', a.token)).data.events.find((e) => !e.npc);
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
  expect(await a.page.evaluate((t) => window.PlazaDebug().markers.some((m) => Math.hypot(m.x - t.x, m.z - t.z) < 0.01), target)).toBe(true);

  // b watches from nearby; a walks up to it: the 「!」 is on a's minimap and Space solves it
  const watch = await spotNear(b.page, target, 12, 20);
  await b.page.evaluate(({ x, z }) => window.PlazaWarp(x, z), watch);
  await expect.poll(() => b.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 10000 }).toBe(true);
  const close = await spotNear(a.page, target, 0.9, 1.6);
  await a.page.evaluate(({ x, z }) => window.PlazaWarp(x, z), close);
  await expect(a.page.locator('#plazaHint')).toHaveText(/SPACE · (줍기|채집)/, { timeout: 10000 });
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().minimap.markers), { timeout: 5000 }).toBeGreaterThan(0);
  expect(await shownMatchesRange(a.page)).toBe(true);
  await a.page.keyboard.press('Space');
  await expect(a.page.locator('#toast, .toast').first()).toBeVisible({ timeout: 5000 });
  await expect.poll(() => b.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 5000 }).toBe(false);
  await expect.poll(() => a.page.evaluate((k) => window.PlazaDebug().events.includes(k), key), { timeout: 5000 }).toBe(false);
  expect((await get(request, '/api/test/island/events', a.token)).data.events.length).toBe(15);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.12 배회 NPC: about ten islanders stroll on every screen, in the same places at the same moment (no packets:
// each screen works out their rounds from the server clock), and they walk.
test('배회 NPC: 10명이 걸어 다니고, 두 화면에서 같은 자리에 보인다', async ({ browser, request }) => {
  test.setTimeout(180000); // two 3D island pages
  const a = await intoPlaza(browser, request, '구경꾼하나');
  const b = await intoPlaza(browser, request, '구경꾼둘');
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
  // standing right where an islander is: it steps out of my way instead of walking through me
  const target = (await islanders(a.page))[0];
  await a.page.evaluate(({ x, z }) => window.PlazaDebug().teleport(x, z), target);
  await a.page.waitForTimeout(400);
  const gap = await a.page.evaluate(() => { const d = window.PlazaDebug(); const w = d.wanderers[0]; return { d: Math.hypot(w.x - d.x, w.z - d.z), min: d.wandererR + d.radiusAt(d.x, d.z) }; });
  expect(gap.d).toBeGreaterThan(gap.min - 0.05);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.10.32 운반·전달: a lost thing picked up stays in my hands (in front of the chest, the arms holding it) while I stand
// and walk, the other players see it in mine; given back, the owner takes it hand to hand and only then goes
test('운반·전달: 주운 분실물을 들고 걷고, 다른 사람에게도 보이며, 주인이 받아 든 뒤 떠난다', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await intoPlaza(browser, request, '운반꾼');
  const b = await intoPlaza(browser, request, '구경꾼');
  const { page } = a;
  const lost = (await post(request, '/api/test/island/lost', a.token, {})).data.event;
  expect(lost?.npc).toBeTruthy();
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
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});

// v1.10.31 잡초 채집: only the nearest weed is offered; Space pulls it in about a second (GatherWeed) and the bag gets
// one; walking away in that second calls it off (nothing taken); the pulled weed is gone from the island's list
test('잡초 채집: 가장 가까운 한 포기만, Space 약 1초 뒤 가방 +1, 이동하면 취소, 섬에서 사라짐', async ({ browser, request }) => {
  test.setTimeout(90000);
  const a = await intoPlaza(browser, request, '잡초꾼');
  const { page } = a;
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().weeds.count), { timeout: 15000 }).toBe(1400);
  const list = (await get(request, '/api/island/weeds', a.token)).data.weeds;
  const [id, x, z] = list.find(([, wx, wz]) => Math.hypot(wx, wz) > 30 && Math.hypot(wx - 20, wz - 20) > 5);
  await page.evaluate(([px, pz]) => window.PlazaWarp(px + 0.8, pz), [x, z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 잡초 뽑기');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().weeds.near)).toMatch(/^weed:/);
  const target = await page.evaluate(() => window.PlazaDebug().weeds.near);
  // called off: walk away during the pull
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().weeds.gathering), { timeout: 5000 }).toBe(target.slice(5));
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().weeds.gathering)).toBe(null);
  const bagCount = async () => ((await get(request, '/api/island/bag', a.token)).data.items || []).find((e) => e.itemId === 'weed')?.qty || 0;
  expect(await bagCount()).toBe(0);
  // pulled: a second of standing still
  await page.evaluate(([px, pz]) => window.PlazaWarp(px + 0.8, pz), [x, z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 잡초 뽑기');
  const pulledId = (await page.evaluate(() => window.PlazaDebug().weeds.near)).slice(5);
  await page.keyboard.press('Space');
  await expect.poll(bagCount, { timeout: 10000 }).toBe(1);
  await expect.poll(() => page.evaluate((w) => window.PlazaDebug().weeds.at(w), pulledId)).toBe(null);
  expect((await get(request, '/api/island/weeds', a.token)).data.weeds.some(([w]) => w === pulledId)).toBe(false);
  void id;
  await expectNoScriptError(page);
  await a.context.close();
});
