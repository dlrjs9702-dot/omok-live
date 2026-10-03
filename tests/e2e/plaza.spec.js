const { test, expect } = require('@playwright/test');
const { post, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// 게임 아일랜드: 방향키 이동, 시설 근처 안내, Space·클릭이 같은 시설 창을 열고, 창이 열린 동안 이동이 멈춘다.
// v1.9.7부터 일반 사용자에게 기존 로비 전환 UI는 없고, 계정 메뉴는 관리자 창(관리자만)·내 정보·접속 종료만 둔다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
// The plaza is one shared square and each page renders 3D: these run one after another (users of another test would
// walk into this one, and several software-rendered pages at once are slow).
test.describe.configure({ mode: 'default' });

const state = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { x: d.x, z: d.z, near: d.near, running: d.running }; });

async function intoPlaza(browser, request, label, points = 0) {
  const who = await shopper(browser, request, label, points);
  await expect(who.page.locator('#lobbyView')).toBeVisible();
  await who.page.evaluate(() => localStorage.removeItem('gc.testClassic'));
  await who.page.reload();
  await expect(who.page.locator('#lobbyView')).toBeVisible();
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
  await expect(page.locator('#plazaStage canvas')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#lobbyModeBtn')).toHaveCount(0);
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

  // v1.10.1 캐릭터 스킨 상점(상점가): 아바타 품목만, 칸 표시, 칭호 구역; 장착하면 캐릭터가 바로 바뀐다.
  await page.evaluate(() => window.PlazaDebug().place('avatar'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 캐릭터 스킨 상점');
  await page.keyboard.press('Space');
  const dialog = page.locator('#skinShopDialog');
  await expect(dialog.locator('#skinShopTitle')).toHaveText('캐릭터 스킨 상점');
  await expect(dialog.getByRole('tab')).toHaveText(['광장 아바타']); // game skins are sold next door
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

// v1.9.3 광장 V3: 다른 접속자의 위치·방향·이름표가 보이고, 방에 들어가면 사라졌다가 돌아오면 다시 보이며, 새로고침해도 다시 보인다.
test('멀티유저 광장: 서로의 캐릭터와 이동이 보이고 입장·퇴장·새로고침이 반영된다', async ({ browser, request }) => {
  test.setTimeout(60000); // two 3D pages at once
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

  // a goes into a room: gone from b's plaza; back in the lobby: there again.
  await a.page.evaluate(async () => { const d = window.PlazaDebug().doors.games; await window.PlazaWarp(d.x, d.z); });
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
  test.setTimeout(90000);
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
    await who.page.evaluate(() => localStorage.removeItem('gc.testClassic'));
    await who.page.reload();
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
  await a.page.waitForTimeout(800);
  const [ra, rb] = [await me(a), await me(b)];
  expect(Math.hypot(ra.x - rb.x, ra.z - rb.z)).toBeGreaterThan(0.5); // at rest: apart, and still
  expect(Math.hypot((await me(a)).x - ra.x, (await me(a)).z - ra.z)).toBeLessThan(0.05);

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
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowDown');
  const end = await d();
  expect(end.z).toBeLessThan(pier.z + pier.half + 0.5); expect(end.z).toBeGreaterThan(pier.z + pier.half - 1.5);
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

// v1.9.4 등반 입구 (kept with the other plaza tests: the plaza is one shared square, so its tests run one after another)
test('광장 등반 입구: Space와 클릭이 등반 창을 열고, 창이 열린 동안 멈췄다가 닫으면 다시 걷는다', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await shopper(browser, request, '입구');
  const { page } = a;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic'));
  await page.reload();
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
