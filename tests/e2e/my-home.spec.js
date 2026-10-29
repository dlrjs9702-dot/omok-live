const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, uniqueIp, standAt, expectNoScriptError, spaceOn } = require('./skin-support');

// 묶음 4 내 집 + 친구 (gamecenter-notes docs/my-home-20261020.md, docs/friends-20261020.md): a house from the 관공서's
// 민원 창구 on 툇마루섬, in by its door, 꾸미기 (placed, turned, moved, put back -- green or red before it goes), a tank's
// fish and the insect case, the same after going out and in and on another screen; 방문 허용 아무나 / 친구만 / 안 받음
// with a friend made from the player menu and accepted in 내 정보. PC and phone.
const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const makeLogin = async (request, keyId, tag) => expect((await post(request, '/api/test/login-id', null, { keyId, loginId: `${tag}_${stamp()}`.slice(0, 20) })).status).toBe(200);
async function apiPlayer(request, label, login) { // a player without a browser, on the island
  const issued = (await post(request, '/api/admin/keys', await adminToken(request), { label })).data;
  if (login) await makeLogin(request, issued.key.id, 'fr');
  const key = issued.html.match(/name="token" value="([^"]+)"/)[1];
  const res = await request.post('/guest-entry', { headers: { 'X-Forwarded-For': uniqueIp(), 'Content-Type': 'application/x-www-form-urlencoded' }, data: `token=${encodeURIComponent(key)}` });
  const token = (await res.text()).match(/data-session="([^"]+)"/)[1];
  const st = await post(request, '/api/plaza/state', token, { x: 0, z: 0, yaw: 0, moving: false });
  return { token, id: st.data.id };
}

// two players in their pages (logged-in accounts), on the island; the door and menu helpers
async function twoPlayers(browser, request, isMobile, tag) {
  const a = await shopper(browser, request, `집주인${tag}`, 3000000, 'female'); const { page } = a;
  const b = await shopper(browser, request, `손님${tag}`, 0, 'male');
  await makeLogin(request, a.id, `home${tag}`); await makeLogin(request, b.id, `visit${tag}`);
  // (no 3D models: the checks are on the layout, not the look -- the slow runner draws the island in boxes far quicker)
  for (const who of [a, b]) { await who.page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); }
  const press = async (p = page) => { if (isMobile) await p.locator('#plazaHint').tap(); else { await p.locator('#plazaStage').focus(); await p.keyboard.press('Space'); } };
  const openMenu = async () => { if (isMobile) await page.locator('#gameMenuBtn').tap(); else await page.locator('#gameMenuBtn').click(); await expect(page.locator('#gameMenuDialog')).toBeVisible(); };
  const goTo = async (p, door, text) => expect.poll(async () => { await p.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); /* (the 민원실's doors: not in the list) */ }, door); await p.waitForTimeout(500); return p.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain(text);
  // in or out by a door: on a slow runner the server may not have my place yet when I press -- to the door and again
  const through = async (p, door, text, space) => {
    for (let tries = 0; tries < 4 && await p.evaluate(() => window.PlazaDebug().space) !== space; tries += 1) {
      if (await p.locator('#plazaDialog').isVisible()) await p.locator('#plazaCloseBtn').click(); // (someone at the same door: their menu instead)
      await goTo(p, door, text); if (await p.evaluate(() => window.PlazaDebug().space) === space) break;
      await press(p); await expect.poll(() => p.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe(space).catch(() => {});
    }
    expect(await p.evaluate(() => window.PlazaDebug().space)).toBe(space);
  };
  return { a, b, page, press, openMenu, goTo, through };
}

test('내 집: 민원 창구에서 신청 → 섬에 집 → 꾸미기(놓기·돌리기·옮기기·넣기) → 수조·곤충 상자 → 다시 들어와도·다른 화면에서도 같음', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  const { a, b, page, press, through } = await twoPlayers(browser, request, isMobile, isMobile ? 'm' : 'p');
  const pieces = (await post(request, '/api/test/home/furniture', a.token, { ids: ['sofa__mint', 'fish_tank__oak', 'insect_case__oak', 'wall_clock__oak'] })).data.pieces;
  for (const [itemId, qty] of [['fish_goby', 2], ['fish_giant_tuna', 1], ['insect_ladybird', 1]]) expect((await post(request, '/api/test/island/give', a.token, { itemId, qty })).status).toBe(200);

  // 관공서 민원 창구 → 「내 집 신청」: a free lot, the blue roof, paid at once
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); } // (both start at the same spot: the server never lets one pass through the other -- round them first)
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  await expect.poll(async () => { await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil'); window.PlazaDebug().teleport(c.x, c.z + 1.1); }); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 15000 }).toContain('앉아서 민원 창구 업무');
  await press();
  await page.locator('#homeApplyBtn').click();
  await expect(page.locator('#homeCard')).toBeVisible();
  const free = page.locator('#homeCard .homeLots button:not([disabled])').first(); const lot = await free.getAttribute('data-lot'); await free.click();
  await page.locator('#homeCard button[data-roof="blue"]').click();
  const before = (await get(request, '/api/points', a.token)).data.balance;
  await page.locator('#homeCard button', { hasText: '신청하기' }).click();
  await expect(page.locator('#homeCard')).toBeHidden({ timeout: 15000 });
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before - 20000); // (묶음 4-2: an 오두막 first)
  expect((await get(request, '/api/home', a.token)).data.mine).toMatchObject({ lot, roof: 'blue', visit: 'anyone', stage: 1 });
  expect((await post(request, '/api/home/apply', a.token, { lot: 'lot1', roof: 'red' })).data.error).toBe('HAS_HOME'); // (one a person)
  await through(page, 'room:exit', '나가기', 'island');
  // on 툇마루섬: the house (blue), seen from the other screen too; in by its door
  await expect.poll(() => page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:blue:true:/);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/^집주인.*:blue:false:anyone:1:false$/);
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  await expect(page.locator('#homeEditBtn')).toBeVisible();

  // 꾸미기: the sofa in, turned, placed; moved; the tank red where it meets the sofa, green further on; the clock on the back
  // wall, then put back (a piece starts a step in front of me; the pad's taps after the first are sent at once)
  const edit = page.locator('#homeEdit'); const status = edit.locator('[role="status"]');
  const standIn = async (lx, lz) => { if (await edit.isVisible()) await page.locator('#plazaCloseBtn').click(); await page.evaluate(([lot, lx, lz]) => { const w = window.IslandHome.world(window.IslandHome.lotById(lot), lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [lot, lx, lz]); };
  const choose = async (uid) => { if (!await edit.isVisible()) await page.locator('#homeEditBtn').click(); await expect(edit).toBeVisible(); await edit.locator(`.furniturePiece[data-uid="${uid}"]`).click(); };
  // (the pad moves the piece on the page at once -- the repeats in one call, not one round trip each: on the slow phone
  // runner those trips took minutes)
  const tap = async (label, n = 1) => { const b = edit.getByRole('button', { name: label, exact: true }); await b.click(); if (n > 1) await b.evaluate((el, n) => { for (let i = 1; i < n; i += 1) el.click(); }, n); };
  const tapUntil = async (label, text) => { const b = edit.getByRole('button', { name: label, exact: true }); await b.evaluate((el, text) => { const st = el.closest('#homeEdit').querySelector('[role="status"]'); for (let i = 0; i < 40 && !st.textContent.includes(text); i += 1) el.click(); }, text); await expect(status).toContainText(text); };
  const mine = async () => (await get(request, '/api/home', a.token)).data.mine.pieces;
  const [sofa, tank, insectCase, clock] = pieces.map((p) => p.uid);
  await standIn(0, -1.75); // (the piece starts a step in front of me: clear of the doorway in the 오두막 too)
  await choose(sofa); // (묶음 4-2: in the 오두막 the doorway is nearer the middle -- a piece starts in it, red, until moved in)
  await tap('안쪽으로', 4); await tap('돌리기'); await expect(status).toContainText('여기에 놓을 수 있어요');
  await tap('놓기');
  await expect.poll(async () => (await mine()).find((p) => p.uid === sofa) || null, { timeout: 10000 }).toMatchObject({ rot: 1 });
  const sofaAt = (await mine()).find((p) => p.uid === sofa);
  await choose(sofa); await tap('오른쪽으로', 2); await tap('놓기');
  await expect.poll(async () => (await mine()).find((p) => p.uid === sofa).x, { timeout: 10000 }).toBe(sofaAt.x - 0.5);
  await choose(tank); await tap('안쪽으로', 4); await tap('오른쪽으로', 2); await expect(status).toContainText('겹쳐요'); await expect(edit.getByRole('button', { name: '놓기', exact: true })).toBeDisabled();
  await tap('왼쪽으로', 4); await tapUntil('왼쪽으로', '여기에 놓을 수 있어요'); await tap('놓기');
  await expect.poll(async () => (await mine()).some((p) => p.uid === tank), { timeout: 10000 }).toBe(true);
  await choose(insectCase); await tap('오른쪽으로', 6); await tapUntil('오른쪽으로', '여기에 놓을 수 있어요'); await tap('놓기');
  await expect.poll(async () => (await mine()).length, { timeout: 10000 }).toBe(3);
  await choose(clock); await expect(status).toContainText('벽에 거는 가구');
  await tapUntil('안쪽으로', '여기에 놓을 수 있어요'); await tap('놓기'); // (on to the back wall)
  await expect.poll(async () => (await mine()).length, { timeout: 10000 }).toBe(4);
  await choose(clock); await tap('창고로 넣기');
  await expect.poll(async () => (await mine()).length, { timeout: 10000 }).toBe(3);
  if (await edit.isVisible()) await page.locator('#plazaCloseBtn').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().home()?.pieces.length), { timeout: 10000 }).toBe(3);
  expect(await page.evaluate(() => window.PlazaDebug().home().seats)).toBe(2); // (the sofa's two)

  // the tank: SPACE by it -- only what fits (the goby, not the tuna, not the insect); in, it swims; out, back to the bag
  const placed = await mine(); const t = placed.find((p) => p.uid === tank);
  await expect.poll(async () => { await page.evaluate(([lot, x, z]) => { const w = window.IslandHome.world(window.IslandHome.lotById(lot), x, z); window.PlazaDebug().teleport(w.x, w.z); }, [lot, t.x, t.z + 0.75]); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 15000 }).toContain('수조');
  await press();
  const tankBox = page.locator('#homeTank');
  await expect(tankBox.locator('button', { hasText: '넣기' })).toHaveCount(1);
  await tankBox.locator('button', { hasText: '넣기' }).click();
  await expect(tankBox).toContainText('1/3마리', { timeout: 10000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().home().fish), { timeout: 10000 }).toBe(1);
  const bagQty = async (id) => ((await get(request, '/api/island/bag', a.token)).data.items.filter((e) => e.itemId === id).reduce((n, e) => n + e.qty, 0));
  expect(await bagQty('fish_goby')).toBe(1);
  expect((await post(request, '/api/home/tank', a.token, { tank, put: 'fish_giant_tuna', requestId: crypto.randomUUID() })).data.error).toBe('TOO_BIG');
  await tankBox.locator('button', { hasText: '꺼내기' }).click();
  await expect(tankBox).toContainText('0/3마리', { timeout: 10000 });
  expect(await bagQty('fish_goby')).toBe(2);
  await tankBox.locator('button', { hasText: '넣기' }).click(); await expect(tankBox).toContainText('1/3마리', { timeout: 10000 });
  await page.locator('#plazaCloseBtn').click();
  expect((await post(request, '/api/home/tank', a.token, { tank: insectCase, put: 'fish_goby', requestId: crypto.randomUUID() })).data.error).toBe('TOO_BIG'); // (the insect case: insects only)
  expect((await post(request, '/api/home/tank', a.token, { tank: insectCase, put: 'insect_ladybird', requestId: crypto.randomUUID() })).status).toBe(200);

  // out and in again: the same room
  const layout = (await mine()).map((p) => `${p.uid}:${p.x}:${p.z}:${p.rot}`).sort();
  await through(page, 'home:exit', '나가기', 'island');
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().home()?.pieces.length), { timeout: 15000 }).toBe(3);
  expect(await page.evaluate(() => window.PlazaDebug().home().fish)).toBe(1);
  expect((await mine()).map((p) => `${p.uid}:${p.x}:${p.z}:${p.rot}`).sort()).toEqual(layout);

  // a visitor (아무나): in, the same pieces; no 꾸미기, and the server will not let them move one
  await through(b.page, `home:${lot}`, '집 구경하기', 'home');
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().home()?.pieces.slice().sort()), { timeout: 15000 }).toEqual(placed.map((p) => p.uid).sort());
  await expect(b.page.locator('#homeEditBtn')).toBeHidden();
  expect((await post(request, '/api/home/place', b.token, { uid: sofa, x: 0, z: 0, rot: 0 })).data.error).toBe('NOT_INSIDE');
  await expectNoScriptError(page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});

test('내 집 방문 허용: 안 받음·친구만은 문이 닫히고, 플레이어 메뉴로 친구 신청 → 내 정보에서 수락하면 들어가고, 끊으면 다시 닫힘', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  const { a, b, page, press, openMenu, goTo, through } = await twoPlayers(browser, request, isMobile, isMobile ? 'n' : 'q');
  // the house (the 민원실, as the other test does by its window)
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); } // (both start at the same spot: the server never lets one pass through the other -- round them first)
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'green' })).status).toBe(200);
  // 묶음 4-2 「집 넓히기」: paid now, a 공사 중 sign that day, a 작은 집 the next (the test moves the day on)
  expect((await post(request, '/api/home/upgrade', a.token, {})).status).toBe(200);
  expect((await post(request, '/api/home/upgrade', a.token, {})).data.error).toBe('BUILDING');
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:1:true$/);
  await post(request, '/api/test/home/next-day', a.token, {});
  expect((await get(request, '/api/home', a.token)).data.mine).toMatchObject({ stage: 2, upgradeDay: null });
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:2:false$/);
  // (3단계 큰 집, 2026-10-21: once more -- 16 x 13 m, its own price; and no further)
  const grow3 = (await get(request, '/api/home', a.token)).data.grow; expect(grow3).toBeGreaterThan(50000);
  expect((await post(request, '/api/home/upgrade', a.token, {})).status).toBe(200);
  await post(request, '/api/test/home/next-day', a.token, {});
  expect((await get(request, '/api/home', a.token)).data.mine).toMatchObject({ stage: 3, upgradeDay: null });
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:3:false$/);
  // (R8 4단계 2층 큰 집: once more; and no further)
  expect((await post(request, '/api/home/upgrade', a.token, {})).status).toBe(200); await post(request, '/api/test/home/next-day', a.token, {});
  expect((await get(request, '/api/home', a.token)).data.mine).toMatchObject({ stage: 4, upgradeDay: null });
  expect((await post(request, '/api/home/upgrade', a.token, {})).data.error).toBe('TOP_STAGE');
  await through(page, 'room:exit', '나가기', 'island');
  // 방문 허용 (내 집 in the menu): 안 받음 -- the door says so and stays shut; 친구만 -- shut until they are friends
  const bAtDoor = async () => { const d = await b.page.evaluate((id) => window.PlazaDebug().doors[id], `home:${lot}`); await standAt(request, b, d.x, d.z); }; // (the page and the server both: the checks below ask the server)
  const visit = async (label) => { await openMenu(); await page.locator('#myHomeBtn').click(); await page.locator('#homeCard button[data-visit]', { hasText: label }).click(); await expect(page.locator('#homeCard button[data-visit][aria-pressed="true"]')).toHaveText(label, { timeout: 10000 }); await page.locator('#plazaCloseBtn').click(); };
  await visit('안 받음');
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:none:/);
  await goTo(b.page, `home:${lot}`, '손님을 받지 않아요'); await bAtDoor();
  expect((await post(request, '/api/home/enter', b.token, { lot })).data.error).toBe('NOT_WELCOME');
  await visit('친구만');
  await goTo(b.page, `home:${lot}`, '집 구경하기'); await bAtDoor();
  expect((await post(request, '/api/home/enter', b.token, { lot })).data.error).toBe('NOT_WELCOME');
  // 친구: the owner is asked from the player menu (SPACE by them); 수락 in 내 정보 -- then the visitor comes in
  const spot = await page.evaluate(() => { const s = window.IslandTerrain.dalmaru.PLACES.spawn; return { x: s.x + 8, z: s.z }; }); // (8 m from the first spot: a test beside this one starts its people there -- SPACE greeted one of them)
  await standAt(request, a, spot.x, spot.z); await standAt(request, b, spot.x + 1.5, spot.z);
  await expect(b.page.locator('#plazaHint')).toContainText('인사', { timeout: 15000 });
  await press(b.page);
  await b.page.locator('#plazaDialog button', { hasText: '친구 신청' }).click();
  await expect.poll(async () => (await get(request, '/api/friends', a.token)).data.incoming.length, { timeout: 10000 }).toBe(1);
  await openMenu(); await page.locator('#myInfoBtn').click();
  await page.locator('#myFriends .friendAsk button', { hasText: '수락' }).click();
  await expect(page.locator('#myFriends .friendRow')).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator('#myFriends .friendRow')).toContainText('섬');
  await page.locator('#myInfoCloseBtn').click();
  expect((await get(request, '/api/friends', b.token)).data.friends).toHaveLength(1);
  await through(b.page, `home:${lot}`, '집 구경하기', 'home'); // (a friend: in)
  await through(b.page, 'home:exit', '나가기', 'island');
  // friends no more (끊기 in 내 정보): shut again
  await openMenu(); await page.locator('#myInfoBtn').click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#myFriends .friendRow button', { hasText: '끊기' }).click();
  await expect(page.locator('#myFriends .friendRow')).toHaveCount(0, { timeout: 10000 });
  await page.locator('#myInfoCloseBtn').click();
  expect((await get(request, '/api/friends', b.token)).data.friends).toHaveLength(0);
  await goTo(b.page, `home:${lot}`, '집 구경하기'); await bAtDoor();
  expect((await post(request, '/api/home/enter', b.token, { lot })).data.error).toBe('NOT_WELCOME');
  await expectNoScriptError(page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});

// R8 4단계 큰 집 2층 (gamecenter-notes docs/backlog-dispatch-20261022.md R8, assets 58 2026-10-25): a 2층 큰 집 -- up the
// stairs by their foot on the 1층 (SPACE), a room of its own up there (its own pieces: one placed there is not on the 1층),
// out only from the 1층; a guest goes up too and sees the owner there, not below. PC and phone.
test('2층 큰 집(R8): 계단으로 2층, 층마다 가구, 1층에서만 나감, 손님도 같은 층끼리 보임', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  const { a, b, page, press, goTo, through } = await twoPlayers(browser, request, isMobile, isMobile ? 'u' : 'v');
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'blue' })).status).toBe(200);
  for (const to of [2, 3, 4]) { expect((await post(request, '/api/home/upgrade', a.token, {})).status).toBe(200); await post(request, '/api/test/home/next-day', a.token, {}); expect((await get(request, '/api/home', a.token)).data.mine.stage).toBe(to); }
  await through(page, 'room:exit', '나가기', 'island');
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  const floorOn = (p) => p.evaluate(() => window.PlazaDebug().home()?.floor);
  const stairs = async (p, door, text, floor) => { // (as the doors: on a slow runner the server may not have my place yet)
    for (let k = 0; k < 4 && await floorOn(p) !== floor; k += 1) { await goTo(p, door, text); await press(p); await expect.poll(() => floorOn(p), { timeout: 10000 }).toBe(floor).catch(() => {}); }
    expect(await floorOn(p)).toBe(floor);
  };
  expect(await floorOn(page)).toBe(1);
  await stairs(page, 'home:stairs_up', '2층으로', 2);
  expect(await page.evaluate(() => window.PlazaDebug().doors['home:exit'])).toBeFalsy();
  expect((await post(request, '/api/home/leave', a.token, {})).data.error).toBe('UPSTAIRS');
  // a piece up here: on the 2층 only
  const [chair] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['sofa__mint'] })).data.pieces;
  expect((await post(request, '/api/home/place', a.token, { uid: chair.uid, x: 0, z: 0, rot: 0 })).status).toBe(200);
  expect((await post(request, '/api/home/place', a.token, { uid: chair.uid, x: -7, z: -4, rot: 0 })).data.error).toBe('BAD_PLACE'); // (the stair hole)
  expect((await get(request, '/api/home/inside', a.token)).data).toMatchObject({ floor: 2, home: { stage: 'upper', pieces: [{ uid: chair.uid, floor: 2 }] } });
  if (isMobile) await page.screenshot({ path: test.info().outputPath('home-upper-phone.png') }); else await page.screenshot({ path: test.info().outputPath('home-upper-pc.png') });
  // a guest: in by the door (the 1층 -- the owner not seen there), up the stairs (seen)
  await through(b.page, `home:${lot}`, '집 구경하기', 'home');
  const aId = await page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().home()?.floor), { timeout: 10000 }).toBe(1);
  await b.page.waitForTimeout(1500); expect(await b.page.evaluate((id) => window.PlazaDebug().othersShown().includes(id), aId)).toBe(false);
  expect((await get(request, '/api/home/inside', b.token)).data.home.pieces.some((p) => p.uid === chair.uid)).toBe(false);
  await stairs(b.page, 'home:stairs_up', '2층으로', 2);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().othersShown().includes(id), aId), { timeout: 15000 }).toBe(true);
  // down and out
  await stairs(page, 'home:stairs_down', '1층으로', 1);
  await through(page, 'home:exit', '나가기', 'island');
  await expectNoScriptError(page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});

test('친구: 거절은 알리지 않음, 끊으면 양쪽에서, 50명까지, 로그인 안 한 손님은 못 함, 신청 횟수 제한', async ({ request }, info) => {
  test.skip(info.project.name !== 'chromium', 'API만 쓰는 검사(한 번)');
  test.setTimeout(120000);
  const [l1, l2, l3] = await Promise.all([1, 2, 3].map((i) => apiPlayer(request, `친구${i}`, true)));
  const guest = await apiPlayer(request, '친구손님', false);
  const ask = (from, to) => post(request, '/api/friends/request', from.token, { to: to.id });
  const list = async (who) => (await get(request, '/api/friends', who.token)).data;
  // a guest (no login id) can neither ask nor be asked
  expect((await list(guest)).allowed).toBe(false);
  expect((await ask(guest, l1)).data.error).toBe('FRIENDS_LOGIN');
  expect((await ask(l1, guest)).data.error).toBe('FRIENDS_LOGIN');
  // asked, refused: gone from the asked one's list, the asker hears nothing (still no friend, nothing waiting)
  expect((await ask(l1, l2)).data.asked).toBe(true);
  const waiting = (await list(l2)).incoming; expect(waiting).toHaveLength(1);
  expect((await post(request, '/api/friends/answer', l2.token, { id: waiting[0].id, accept: false })).data.friends).toBe(false);
  expect((await list(l2)).incoming).toHaveLength(0);
  expect(await list(l1)).toMatchObject({ friends: [], incoming: [] });
  // asked again, accepted: on both lists (where each is); removed by one: gone from both
  await ask(l1, l2); const again = (await list(l2)).incoming[0];
  expect((await post(request, '/api/friends/answer', l2.token, { id: again.id, accept: true })).data.friends).toBe(true);
  const [f1, f2] = [(await list(l1)).friends, (await list(l2)).friends];
  expect(f1).toHaveLength(1); expect(f2).toHaveLength(1); expect(f1[0].where).toBe('섬');
  expect((await post(request, '/api/friends/remove', l1.token, { id: f1[0].id })).status).toBe(200);
  expect((await list(l1)).friends).toHaveLength(0); expect((await list(l2)).friends).toHaveLength(0);
  // 50 at most: one with 50 cannot be asked
  expect((await post(request, '/api/test/friends/fill', l3.token, { n: 50 })).data.n).toBe(50);
  expect((await ask(l1, l3)).data.error).toBe('FRIENDS_FULL');
  // and a few asks an hour
  let limited = false; for (let i = 0; i < 12 && !limited; i += 1) limited = (await ask(l1, l2)).status === 429;
  expect(limited).toBe(true);
});

// 문제 기록 2회차 11 (사용자 「꾸미기가 너무 어려워. 캐릭터로 직접 밀고 당기기, 돌리기」): before a piece of my house, held SPACE
// (the phone: the 상호작용 button held) grabs it; forward pushes it on in 0.5 m steps, R (돌리기) turns it, SPACE lets go -- each step
// the server's (the same checks as placing it)
test('내 집 가구 직접 옮기기: 길게 눌러 잡고 부드럽게 밀기, 돌리거나 놓을 때 칸·벽에 맞춰 서버에', async ({ browser, request, isMobile }) => {
  test.setTimeout(400000);
  const { a, b, page, through } = await twoPlayers(browser, request, isMobile, isMobile ? 'g' : 'h');
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'red' })).status).toBe(200);
  const [sofa] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['sofa__mint'] })).data.pieces;
  await through(page, 'room:exit', '나가기', 'island');
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  expect((await post(request, '/api/home/place', a.token, { uid: sofa.uid, x: 0, z: 0, rot: 0 })).status).toBe(200);
  await through(page, 'home:exit', '나가기', 'island'); await through(page, `home:${lot}`, '내 집 들어가기', 'home'); // (in again: the room as the server has it)
  const hold = async (ms) => { if (isMobile) { const b = page.locator('#islandActBtn'); await b.dispatchEvent('pointerdown', { pointerId: 1 }); await page.waitForTimeout(ms); await b.dispatchEvent('pointerup', { pointerId: 1 }); } else { await page.locator('#plazaStage').focus(); await page.keyboard.down('Space'); await page.waitForTimeout(ms); await page.keyboard.up('Space'); } };
  // before it (its near side, 1 m off), facing it, the camera behind me (the arrows as I face)
  const yaw = await page.evaluate((uid) => { const H = window.IslandHome; const d = window.PlazaDebug(); const inside = d.home(); const lotO = H.lotById(inside.lot); const w = H.world(lotO, 0, -1.6); const c = H.world(lotO, 0, 0); d.teleport(w.x, w.z); const y = Math.atan2(c.x - w.x, c.z - w.z); d.faceYaw(y); d.setCamYaw(y + Math.PI); return y; }, sofa.uid);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().grabCandidate())).toBe(sofa.uid);
  await hold(700);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().grab()?.uid)).toBe(sofa.uid); await expect(page.locator('#plazaHint')).toContainText('가구 놓기');
  const at = async () => (await get(request, '/api/home', a.token)).data.mine.pieces.find((p) => p.uid === sofa.uid);
  // (3회차 7: held, it slides with me -- between the steps too -- and the server is told only when it settles)
  await page.keyboard.down('ArrowUp'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().grab()?.off ?? 0), { timeout: 15000 }).toBeGreaterThanOrEqual(0.6);
  const offs = []; for (let k = 0; k < 6; k += 1) { offs.push(await page.evaluate(() => window.PlazaDebug().grab()?.off ?? 0)); await page.waitForTimeout(60); }
  await page.keyboard.up('ArrowUp');
  expect(offs.some((v) => Math.abs(v * 4 - Math.round(v * 4)) > 0.05)).toBe(true); // (not in jumps: some place between the steps)
  expect(await at()).toMatchObject({ x: 0, z: 0 });
  if (isMobile) await page.locator('#islandTurnBtn').tap(); else await page.keyboard.press('KeyR'); // (turned: settled first, then turned)
  await expect.poll(async () => (await at()).rot, { timeout: 15000 }).toBe(1);
  const moved = await at(); expect(Math.abs(moved.x) + Math.abs(moved.z)).toBeGreaterThanOrEqual(0.5); expect(moved.x === 0 || moved.z === 0).toBe(true);
  expect([moved.x, moved.z].every((v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6 || Math.abs(Math.abs(v) + 0.42 - 5.85) < 1e-6 || Math.abs(Math.abs(v) + 0.95 - 5.85) < 1e-6)).toBe(true); // (on a step or flush with a wall)
  await hold(100); await expect.poll(() => page.evaluate(() => window.PlazaDebug().grab())).toBe(null);
  void yaw; await expectNoScriptError(page);
  // (CI #330: both pages were left open -- two islands drawing for the rest of the worker's run, slowing the next specs, and
  // a later failure's screenshot and snapshot were this house, not that spec's own page)
  await a.context.close(); await b.context.close();
});

// v1.10.189 등받이 없는 자리: a stool is sat on facing the way I faced (45° steps) -- from two sides, two ways; ← / → (the
// phone's ↺ ↻) turn me 45° still seated, and the visitor's screen turns me too; ↑ stands me up
test('스툴: 바라보던 방향으로 앉고, ←/→(폰 ↺↻)로 45° 돌며 다른 화면도 같은 방향, ↑로 일어남', async ({ browser, request, isMobile }) => {
  test.setTimeout(400000);
  const { a, b, page, through } = await twoPlayers(browser, request, isMobile, isMobile ? 's' : 't');
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'red' })).status).toBe(200);
  const [stool] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['stool__oak'] })).data.pieces;
  await through(page, 'room:exit', '나가기', 'island');
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  expect((await post(request, '/api/home/place', a.token, { uid: stool.uid, x: 0, z: 0, rot: 0 })).status).toBe(200);
  await through(page, 'home:exit', '나가기', 'island'); await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  await through(b.page, `home:${lot}`, '집 구경하기', 'home');
  const same = (p, q) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q))) < 0.03;
  const act = () => page.evaluate(() => window.PlazaDebug().act());
  const seen = () => b.page.evaluate(() => window.PlazaDebug().othersActs().find((o) => o.act === 'sit') || null);
  const sitFrom = async (lx, lz) => { // from (lx, lz) in the room, facing the stool
    const face = () => page.evaluate(([lx, lz]) => { const H = window.IslandHome; const d = window.PlazaDebug(); const lotO = H.lotById(d.home().lot); const w = H.world(lotO, lx, lz); const c = H.world(lotO, 0, 0); d.teleport(w.x, w.z); const y = Math.atan2(c.x - w.x, c.z - w.z); d.faceYaw(y); return y; }, [lx, lz]);
    let yaw = 0;
    await expect.poll(async () => {
      if ((await act()).sitting) return true; yaw = await face(); await page.waitForTimeout(300);
      if (!(await spaceOn(page, 'seat:', isMobile))) return false;
      await page.waitForTimeout(800); return (await act()).sitting;
    }, { timeout: 30000, intervals: [500] }).toBe(true);
    return yaw;
  };
  const front = await sitFrom(0, -1);
  const first = (await act()).seatYaw; expect(same(first, front)).toBe(true); // (the way I faced -- not the stool's own front)
  await expect.poll(async () => { const o = await seen(); return Boolean(o && same(o.yaw, first)); }, { timeout: 15000 }).toBe(true);
  if (isMobile) { await expect(page.locator('#seatLeftBtn')).toBeVisible(); await page.locator('#seatLeftBtn').tap(); }
  else { await page.locator('#plazaStage').focus(); await page.keyboard.press('ArrowLeft'); }
  const turned = (await act()); expect(turned.sitting).toBe(true); expect(same(turned.seatYaw, first + Math.PI / 4)).toBe(true);
  await expect.poll(async () => same((await act()).yaw, first + Math.PI / 4), { timeout: 5000 }).toBe(true); // (turned round on it)
  await expect.poll(async () => { const o = await seen(); return Boolean(o && same(o.yaw, first + Math.PI / 4)); }, { timeout: 15000 }).toBe(true);
  if (isMobile) await page.locator('#seatRightBtn').tap(); else await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300); expect((await act()).sitting).toBe(true); expect(same((await act()).seatYaw, first)).toBe(true);
  // ↑ stands me up (the turn buttons go)
  await page.locator('#plazaStage').focus(); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await act()).sitting, { timeout: 10000 }).toBe(false);
  if (isMobile) await expect(page.locator('#seatLeftBtn')).toBeHidden();
  await page.waitForTimeout(1500); // (the stand-up motion's hold)
  // from the side: sat on facing that way, a quarter round from the first
  const side = await sitFrom(-1, 0);
  const second = (await act()).seatYaw; expect(same(second, side)).toBe(true); expect(same(second, first)).toBe(false);
  await expect.poll(async () => { const o = await seen(); return Boolean(o && same(o.yaw, second)); }, { timeout: 15000 }).toBe(true);
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});

// v1.10.193 (사용자 「2층 큰 집을 사려는데 살 곳이 없어」): the 민원 창구's button grew a house only from the 오두막 -- from
// the 작은 집 it said 「내 집」, off; now 「집 넓히기」 up to the 2층 큰 집 (IslandHome.TOP_STAGE), 「내 집」 and off only there
test('민원 창구 집 넓히기: 작은 집·큰 집에서도 「집 넓히기」가 켜지고 공사가 시작되며, 2층 큰 집에서만 꺼진다', async ({ browser, request, isMobile }) => {
  test.setTimeout(400000);
  const { a, b, page, press, through } = await twoPlayers(browser, request, isMobile, isMobile ? 'um' : 'up');
  await b.context.close();
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => !l.owner).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'blue' })).status).toBe(200);
  expect((await post(request, '/api/home/upgrade', a.token, {})).status).toBe(200); await post(request, '/api/test/home/next-day', a.token, {}); // (the 오두막 a 작은 집)
  const stage = async () => (await get(request, '/api/home', a.token)).data.mine.stage;
  expect(await stage()).toBe(2);
  const counter = async () => { // the 민원 창구, afresh
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await expect.poll(async () => { await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil'); window.PlazaDebug().teleport(c.x, c.z + 1.1); }); await page.waitForTimeout(400); if (!await page.locator('#homeApplyBtn').isVisible()) await press(); return page.locator('#homeApplyBtn').isVisible(); }, { timeout: 30000, intervals: [600] }).toBe(true);
  };
  for (const from of [2, 3]) { // the 작은 집 and the 큰 집: 「집 넓히기」, on, and the work begun
    await counter();
    await expect(page.locator('#homeApplyBtn')).toHaveText('집 넓히기'); await expect(page.locator('#homeApplyBtn')).toBeEnabled();
    await page.locator('#homeApplyBtn').click();
    await page.locator('#homeCard button', { hasText: '넓히기' }).click();
    await expect.poll(async () => (await get(request, '/api/home', a.token)).data.mine.upgradeDay, { timeout: 15000 }).toBeTruthy();
    await post(request, '/api/test/home/next-day', a.token, {});
    expect(await stage()).toBe(from + 1);
  }
  await counter(); // the 2층 큰 집: as big as it gets
  await expect(page.locator('#homeApplyBtn')).toHaveText('내 집'); await expect(page.locator('#homeApplyBtn')).toBeDisabled();
  await expectNoScriptError(page);
  await a.context.close();
});

// 207 집 꾸미기 (gamecenter-notes docs/home-tabletop-20261029.md, 사용자 「곤충상자 같은 작은 건 책상 위에 올릴 수 있게 해」):
// the insect case and the snow globe on a desk (drawn at its top), the radio on the coffee table; the two not on each
// other; the desk with things on it not moved or put away (the window says so) -- once they are off it moves. The window
// on the island's paper, 「↻ 돌리기」 on one line. PC and phone.
test('집 꾸미기: 작은 물건은 책상·탁자 위에, 위에 있으면 책상 못 옮김, 꾸미기 창 종이', async ({ browser, request, isMobile }) => {
  test.setTimeout(400000);
  const { a, page, through } = await twoPlayers(browser, request, isMobile, isMobile ? 'k' : 'l');
  if (process.env.SHOT_DIR) { await page.evaluate(() => localStorage.removeItem('gc.testIslandAssets')); await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); } // (the photos: the real models)
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through(page, 'townhall', '관공서 들어가기', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'green' })).status).toBe(200);
  try { // (the lot given back at the end, passed or not: twelve for every test of a run)
  const [desk, box, globe, table, radio] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['desk__oak', 'insect_case__oak', 'xmas_snow_globe__plain', 'coffee_table__oak', 'radio__red'] })).data.pieces.map((p) => p.uid);
  await through(page, 'room:exit', '나가기', 'island');
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  const place = (uid, x, z, rot = 0) => post(request, '/api/home/place', a.token, { uid, x, z, rot });
  expect((await place(desk, 0, 2)).status).toBe(200); expect((await place(table, -2.5, 2)).status).toBe(200);
  // on the desk: the case (turned), the globe beside it -- not on it; the radio on the table
  expect((await place(box, -0.3, 2, 1)).status).toBe(200);
  const over = await place(globe, -0.25, 2); expect(over.data.error).toBe('BAD_PLACE'); expect(over.data.message).toContain('위에 놓인 다른 물건과 겹쳐요');
  expect((await place(globe, 0.3, 2.05)).status).toBe(200); expect((await place(radio, -2.5, 2)).status).toBe(200);
  // the desk with things on it: not moved, turned or put away
  for (const body of [{ uid: desk, x: 0.5, z: 2, rot: 0 }, { uid: desk, x: 0, z: 2, rot: 1 }, { uid: desk, remove: true }]) { const r = await post(request, '/api/home/place', a.token, body); expect(r.data.error).toBe('HOLDS_THINGS'); expect(r.data.message).toBe('위에 놓인 물건을 먼저 치워 주세요.'); }
  await through(page, 'home:exit', '나가기', 'island'); await through(page, `home:${lot}`, '내 집 들어가기', 'home'); // (in again: the room as the server has it)
  const H = require('../../public/plaza/island-home.js');
  await expect.poll(() => page.evaluate((uid) => window.PlazaDebug().pieceY(uid), box), { timeout: 15000 }).toBeCloseTo(0.04 + H.TOPS.desk, 3);
  expect(await page.evaluate((uid) => window.PlazaDebug().pieceY(uid), globe)).toBeCloseTo(0.04 + H.TOPS.desk, 3);
  expect(await page.evaluate((uid) => window.PlazaDebug().pieceY(uid), radio)).toBeCloseTo(0.04 + H.TOPS.coffee_table, 3);
  if (process.env.SHOT_DIR) { // (from the room's front, the desk and the table ahead -- the real models for the photo)
    await page.evaluate((lot) => { const Hm = window.IslandHome; const d = window.PlazaDebug(); const o = Hm.lotById(lot); const w = Hm.world(o, -1.2, 0.2); const c = Hm.world(o, -1.2, 2); d.teleport(w.x, w.z); const y = Math.atan2(c.x - w.x, c.z - w.z); d.faceYaw(y); d.setCamYaw(y + Math.PI); }, lot);
    await page.waitForTimeout(6000); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-home-tabletop.png` });
  }
  // the window: the desk chosen -- 「위에 물건이 있어요」, not to the 창고; moved a step -- 「먼저 치워 주세요」, not placed
  const edit = page.locator('#homeEdit'); const status = edit.locator('[role="status"]');
  await page.locator('#homeEditBtn').click(); await expect(edit).toBeVisible();
  await edit.locator(`.furniturePiece[data-uid="${desk}"]`).click(); await expect(status).toContainText('위에 물건이 있어요');
  await expect(edit.getByRole('button', { name: '창고로 넣기' })).toBeDisabled();
  const turn = edit.getByRole('button', { name: '돌리기', exact: true }); await expect(turn).toHaveText('↻ 돌리기');
  const { height, line } = await turn.evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) || 20 })); expect(height).toBeLessThan(line * 2 + 24); // (one line)
  const paper = await edit.evaluate((el) => getComputedStyle(el.closest('dialog')).backgroundColor); expect(paper).not.toBe('rgb(15, 23, 42)'); // (not the old navy)
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-home-edit-paper.png` });
  await edit.getByRole('button', { name: '오른쪽으로' }).click(); await expect(status).toContainText('위에 놓인 물건을 먼저 치워 주세요');
  await expect(edit.getByRole('button', { name: '놓기', exact: true })).toBeDisabled();
  // the case, chosen: moved on the desk by 0.05 m
  await edit.locator(`.furniturePiece[data-uid="${box}"]`).click(); await expect(status).toContainText('위에 올려 놓을 수 있어요');
  await edit.getByRole('button', { name: '오른쪽으로' }).click(); await expect(status).toContainText('위에 올려 놓을 수 있어요'); // (along the desk: the room's -x)
  await edit.getByRole('button', { name: '놓기', exact: true }).click(); await expect(edit).toBeVisible();
  await expect.poll(async () => (await get(request, '/api/home', a.token)).data.mine.pieces.find((p) => p.uid === box)?.x).toBeCloseTo(-0.35, 3);
  await page.locator('#plazaCloseBtn').click();
  // both off the desk (to the 창고): now it moves
  for (const uid of [box, globe]) expect((await post(request, '/api/home/place', a.token, { uid, remove: true })).status).toBe(200);
  expect((await place(desk, 0.5, 2)).status).toBe(200);
  await expectNoScriptError(page);
  } finally { await post(request, '/api/test/home/release', a.token, {}); }
  await a.context.close();
});
