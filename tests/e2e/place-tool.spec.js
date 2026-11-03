const { test, expect } = require('@playwright/test');
const { shopper, post, get, standAt, expectNoScriptError } = require('./skin-support');
const H = require('../../public/plaza/island-home.js');
const Y = require('../../public/plaza/island-yard.js');

// v1.10.232 배치 도구 (gamecenter-notes docs/place-tool-20261103.md): from 꾸미기, 「🖐 배치 도구」 -- a piece from the strip
// follows the pointed floor on its grid and is placed (a PC: the click; a phone: a tap moves it, ✓ places); a placed one
// pressed is picked up again; turned (R / ↻); a wall clock red in the middle of the room, green and flush by the back wall;
// a radio on a desk's top; let go (Esc / ✕); then the yard's 「마당 꾸미기」 the same tool, the same moves. PC and phone;
// SHOT_DIR photos: the tool open, a piece on its way (green), a red place, on the desk, the yard.
test('배치 도구: 집에서 가리켜 놓기·다시 들기·돌리기·빨간 자리·탁자 위·내려놓기, 마당도 같은 도구', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  const tag = isMobile ? 'm' : 'p';
  const a = await shopper(browser, request, `배치${tag}`, 3000000, 'female'); const { page } = a;
  if (process.env.SHOT_DIR && isMobile) await page.setViewportSize({ width: 393, height: 851 }); // (총괄 232 검토: the photos on a phone held upright -- the bar's narrow layout)
  await page.evaluate((real) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); if (real) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name, wait = 1200) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  const goTo = async (door, text) => expect.poll(async () => { await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); }, door); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain(text);
  const through = async (door, text, space) => {
    for (let tries = 0; tries < 4 && await page.evaluate(() => window.PlazaDebug().space) !== space; tries += 1) {
      if (await page.locator('#plazaDialog').isVisible()) await page.locator('#plazaCloseBtn').click();
      await goTo(door, text); if (await page.evaluate(() => window.PlazaDebug().space) === space) break;
      await press(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe(space).catch(() => {});
    }
    expect(await page.evaluate(() => window.PlazaDebug().space)).toBe(space);
  };
  const pieces = (await post(request, '/api/test/home/furniture', a.token, { ids: ['sofa__mint', 'desk__oak', 'radio__oak', 'wall_clock__oak', 'yard_bench__plain'] })).data.pieces;
  const uid = (id) => pieces.find((p) => p.id === id).uid;
  let lot = null;
  try {
    // a house from the 민원 창구 (as my-home.spec)
    { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
    await through('townhall', '관공서 들어가기', 'townhall');
    await expect.poll(async () => { await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil'); window.PlazaDebug().teleport(c.x, c.z + 1.1); }); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 15000 }).toContain('앉아서 민원 창');
    await press(); await page.locator('#homeApplyBtn').click();
    const free = page.locator('#homeCard .homeLots button:not([disabled])').first(); lot = await free.getAttribute('data-lot'); await free.click();
    await page.locator('#homeCard button', { hasText: '신청하기' }).click(); await expect(page.locator('#homeCard')).toBeHidden({ timeout: 15000 });
    await through('room:exit', '나가기', 'island');
    await expect.poll(() => page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toBeTruthy();
    await through(`home:${lot}`, '내 집 들어가기', 'home');

    // the tool, from 꾸미기
    await page.locator('#homeEditBtn').click(); await page.locator('#homeEdit .placeToolBtn').click();
    await expect(page.locator('#placeBar')).toBeVisible(); await expect(page.locator('#plazaDialog')).toBeHidden();
    const state = () => page.evaluate(() => window.PlaceTool.state());
    const screen = (lx, lz, top = 0) => page.evaluate(([x, z, t]) => window.PlaceTool.screen(x, z, t), [lx, lz, top]);
    const aim = async (lx, lz, top = 0) => { // (a PC: the mouse moved there; a phone: a tap there)
      await expect.poll(async () => { const s = await screen(lx, lz, top); if (isMobile) await page.touchscreen.tap(s.x, s.y); else await page.mouse.move(s.x, s.y, { steps: 3 }); await page.waitForTimeout(250); const h = (await state()).held; return h && Math.hypot(h.x - lx, h.z - lz) < 0.3; }, { timeout: 15000 }).toBe(true);
    };
    const put = async () => { await expect(page.locator('#placeBar .placePut')).toBeEnabled(); await page.locator('#placeBar .placePut').click(); await expect.poll(async () => (await state()).held, { timeout: 15000 }).toBe(null); };
    const inside = async () => (await get(request, '/api/home/inside', a.token)).data.home.pieces;
    const strip = (id) => page.locator(`#placeBar .placePiece[data-uid="${uid(id)}"]`);
    await shot('place-open', 1500);
    // the sofa: from the strip, pointed, placed on its grid
    await strip('sofa__mint').click(); await aim(1.5, 1.5); const want = H.aimAt({ uid: uid('sofa__mint'), id: 'sofa__mint', rot: 0 }, 1.5, 1.5, 1, []);
    expect((await state()).held).toMatchObject({ x: want.x, z: want.z }); await shot('place-drag', 600);
    if (isMobile) await put(); else { const s = await screen(1.5, 1.5); await page.mouse.click(s.x, s.y); await expect.poll(async () => (await state()).held, { timeout: 15000 }).toBe(null); }
    await expect.poll(async () => (await inside()).find((p) => p.uid === uid('sofa__mint')), { timeout: 15000 }).toMatchObject({ x: want.x, z: want.z, rot: 0 });
    // pressed in the room: picked up again; turned; placed
    await expect.poll(async () => { const s = await screen(want.x, want.z); if (isMobile) await page.touchscreen.tap(s.x, s.y); else await page.mouse.click(s.x, s.y); await page.waitForTimeout(300); return (await state()).held?.uid; }, { timeout: 15000 }).toBe(uid('sofa__mint'));
    if (isMobile) await page.locator('#placeBar button[aria-label="돌리기 (R)"]').click(); else await page.keyboard.press('KeyR');
    expect((await state()).held.rot).toBe(1); await put();
    await expect.poll(async () => (await inside()).find((p) => p.uid === uid('sofa__mint'))?.rot, { timeout: 15000 }).toBe(1);
    // a wall clock: red in the middle (no ✓), green and flush by the back wall
    await strip('wall_clock__oak').click(); await aim(0, 0); expect((await state()).why).toBeTruthy(); await expect(page.locator('#placeBar .placePut')).toBeDisabled(); await shot('place-red', 600);
    const hz = H.stageOf(1).hz; await aim(-1, hz - 0.3); expect((await state()).why).toBe(null); expect((await state()).held.rot).toBe(0); await put();
    await expect.poll(async () => (await inside()).find((p) => p.uid === uid('wall_clock__oak'))?.z, { timeout: 15000 }).toBeCloseTo(hz - H.SIZE.wall_clock[1] / 2, 5);
    // a desk, then a radio on its top (the top pointed at)
    await strip('desk__oak').click(); await aim(-1.5, 1.0); await put();
    const desk = (await inside()).find((p) => p.uid === uid('desk__oak')); expect(desk).toBeTruthy();
    await strip('radio__oak').click(); await aim(desk.x + 0.2, desk.z, H.TOPS.desk); expect((await state()).why).toBe(null); await shot('place-top', 600); await put();
    await expect.poll(async () => { const all = await inside(); const r = all.find((p) => p.uid === uid('radio__oak')); return Boolean(r && H.supportOf(r, all)?.uid === desk.uid); }, { timeout: 15000 }).toBe(true);
    // let go: Esc / ✕ -- nothing held; then 끝내기: the window as it was
    await strip('sofa__mint').click(); expect((await state()).held?.uid).toBe(uid('sofa__mint'));
    if (isMobile) await page.locator('#placeBar button[aria-label="내려놓기 (Esc)"]').click(); else await page.keyboard.press('Escape');
    expect((await state()).held).toBe(null);
    // (총괄 232 검토 1) a window opened over it: the tool ends, I walk again
    await page.locator('#gameMenuBtn').click(); await expect(page.locator('#gameMenuDialog')).toBeVisible(); await expect(page.locator('#placeBar')).toBeHidden({ timeout: 5000 }); expect(await state()).toBe(null); // (the ☰ menu: top left, above the bar on a phone held upright too)
    await page.keyboard.press('Escape'); await expect(page.locator('#gameMenuDialog')).toBeHidden();
    const at0 = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z })); await page.locator('#plazaStage').focus();
    await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
    const at1 = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z })); expect(Math.hypot(at1.x - at0.x, at1.z - at0.z), '도구가 닫히면 다시 걸음').toBeGreaterThan(0.3);

    // my yard: 「마당 꾸미기」 → the same tool
    await through('home:exit', '나가기', 'island');
    await expect.poll(async () => { if (await page.locator('#yardEditBtn').isVisible()) return true; const L = Y.lotById(lot); const w = Y.world(L, 0, Y.fenceOf(1)[2] + 2); await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [w.x, w.z]); await page.waitForTimeout(800); return page.locator('#yardEditBtn').isVisible(); }, { timeout: 30000 }).toBe(true);
    await page.locator('#yardEditBtn').click(); await page.locator('#yardEdit .placeToolBtn').click(); await expect(page.locator('#placeBar')).toBeVisible();
    const L = Y.lotById(lot); const stage = (await get(request, '/api/home', a.token)).data.mine.stage || 1;
    const ok = []; for (let lz = -8; lz <= 6; lz += 0.5) for (let lx = -7; lx <= 7; lx += 0.5) { const p = Y.aimAt({ uid: 'b', id: 'yard_bench__plain', rot: 0 }, lx, lz); if (!Y.placeError(p, [], L, stage, 1)) ok.push(p); }
    const spot = await page.evaluate((list) => { const bar = document.getElementById('placeBar').getBoundingClientRect().top - 90; const w = window.innerWidth; return list.find((p) => { const s = window.PlaceTool.screen(p.x, p.z); return s && s.y > 120 && s.y < bar && s.x > 40 && s.x < w - 40; }) || null; }, ok); // (one seen above the bar)
    expect(spot).toBeTruthy();
    await page.locator(`#placeBar .placePiece[data-uid="${uid('yard_bench__plain')}"]`).click(); await aim(spot.x, spot.z); expect((await state()).why).toBe(null); await shot('place-yard', 800);
    if (isMobile) await put(); else { const s = await screen(spot.x, spot.z); await page.mouse.click(s.x, s.y); await expect.poll(async () => (await state()).held, { timeout: 15000 }).toBe(null); }
    await expect.poll(async () => ((await get(request, '/api/home', a.token)).data.lots.find((l) => l.id === lot)?.yard || []).find((p) => p.uid === uid('yard_bench__plain')), { timeout: 15000 }).toMatchObject({ x: spot.x, z: spot.z });
    await page.locator('#placeBar .placeEnd').click(); await expect(page.locator('#yardEdit')).toBeVisible();
    // (총괄 232 검토 1) the server moves me while the tool is on: it ends with the move
    await page.locator('#yardEdit .placeToolBtn').click(); await expect(page.locator('#placeBar')).toBeVisible();
    await page.evaluate(() => window.PlaceTool.spaceTo('island')); await expect(page.locator('#placeBar')).toBeHidden({ timeout: 5000 }); expect(await state()).toBe(null);
    expect(await page.evaluate(() => document.body.classList.contains('placing'))).toBe(false);
    await expectNoScriptError(page);
  } finally { await post(request, '/api/test/home/release', a.token, {}).catch(() => {}); await a.context.close(); }
});
