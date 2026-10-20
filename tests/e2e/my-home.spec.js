const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, uniqueIp, standAt, expectNoScriptError } = require('./skin-support');

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
  expect((await get(request, '/api/points', a.token)).data.balance).toBe(before - 50000);
  expect((await get(request, '/api/home', a.token)).data.mine).toMatchObject({ lot, roof: 'blue', visit: 'anyone' });
  expect((await post(request, '/api/home/apply', a.token, { lot: 'lot1', roof: 'red' })).data.error).toBe('HAS_HOME'); // (one a person)
  await through(page, 'room:exit', '나가기', 'island');
  // on 툇마루섬: the house (blue), seen from the other screen too; in by its door
  await expect.poll(() => page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:blue:true:/);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/^집주인.*:blue:false:anyone$/);
  await through(page, `home:${lot}`, '내 집 들어가기', 'home');
  await expect(page.locator('#homeEditBtn')).toBeVisible();

  // 꾸미기: the sofa in, turned, placed; moved; the tank red where it meets the sofa, green further on; the clock on the back
  // wall, then put back (a piece starts a step in front of me; the pad's taps after the first are sent at once)
  const edit = page.locator('#homeEdit'); const status = edit.locator('[role="status"]');
  const standIn = async (lx, lz) => { if (await edit.isVisible()) await page.locator('#plazaCloseBtn').click(); await page.evaluate(([lot, lx, lz]) => { const w = window.IslandHome.world(window.IslandHome.lotById(lot), lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [lot, lx, lz]); };
  const choose = async (uid) => { if (!await edit.isVisible()) await page.locator('#homeEditBtn').click(); await expect(edit).toBeVisible(); await edit.locator(`.furniturePiece[data-uid="${uid}"]`).click(); };
  const tap = async (label, n = 1) => { const b = edit.getByRole('button', { name: label, exact: true }); await b.click(); for (let i = 1; i < n; i += 1) await b.evaluate((el) => el.click()); };
  const tapUntil = async (label, text) => { const b = edit.getByRole('button', { name: label, exact: true }); for (let i = 0; i < 40 && !(await status.textContent()).includes(text); i += 1) await b.evaluate((el) => el.click()); await expect(status).toContainText(text); };
  const mine = async () => (await get(request, '/api/home', a.token)).data.mine.pieces;
  const [sofa, tank, insectCase, clock] = pieces.map((p) => p.uid);
  await standIn(0, -3); // (the piece at local 0, -2)
  await choose(sofa); await expect(status).toContainText('여기에 놓을 수 있어요');
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
  await through(page, 'room:exit', '나가기', 'island');
  // 방문 허용 (내 집 in the menu): 안 받음 -- the door says so and stays shut; 친구만 -- shut until they are friends
  const bAtDoor = async () => { const d = await b.page.evaluate((id) => window.PlazaDebug().doors[id], `home:${lot}`); await standAt(request, b, d.x, d.z); }; // (the page and the server both: the checks below ask the server)
  const visit = async (label) => { await openMenu(); await page.locator('#myHomeBtn').click(); await page.locator('#homeCard button[data-visit]', { hasText: label }).click(); await expect(page.locator('#homeCard button[data-visit][aria-pressed="true"]')).toHaveText(label, { timeout: 10000 }); await page.locator('#plazaCloseBtn').click(); };
  await visit('안 받음');
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:none$/);
  await goTo(b.page, `home:${lot}`, '손님을 받지 않아요'); await bAtDoor();
  expect((await post(request, '/api/home/enter', b.token, { lot })).data.error).toBe('NOT_WELCOME');
  await visit('친구만');
  await goTo(b.page, `home:${lot}`, '집 구경하기'); await bAtDoor();
  expect((await post(request, '/api/home/enter', b.token, { lot })).data.error).toBe('NOT_WELCOME');
  // 친구: the owner is asked from the player menu (SPACE by them); 수락 in 내 정보 -- then the visitor comes in
  const spot = await page.evaluate(() => window.IslandTerrain.dalmaru.PLACES.spawn);
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
