const { test, expect } = require('@playwright/test');
const { shopper, post, get, adminToken, intoMall, outOfMall, expectNoScriptError, spaceOn, standAt } = require('./skin-support');
const Y = require('../../public/plaza/island-yard.js');

// v1.10.225 마당 꾸미기 (gamecenter-notes docs/yard-20261102.md): the 3층's 「마당」 shelf (bought into the 가구 창고's 「마당」
// tab), a house from the 민원 창구, then in my yard 「마당 꾸미기」 -- three fences end to end, a bench sat on, an arch walked
// through (its posts only block), lamps lit at night; another player sees it all but has no 「마당 꾸미기」; 「마당 넓히기」
// at the 민원 창구 (the room and count before → after), a piece then out at the side; the yard filled to 60 and the frame
// time on 툇마루섬 against the empty yard (one line); the 2층 큰 집 blocks as the 큰 집. PC and phone; SHOT_DIR photos.
test('마당 꾸미기: 3층 마당 진열대 → 내 마당(울타리 잇기·벤치·아치·석등) → 남은 구경만 → 넓히기 → 밤 불빛 · 프레임 비교', async ({ browser, request, isMobile }) => {
  test.setTimeout(1500000);
  const tag = isMobile ? 'm' : 'p';
  const a = await shopper(browser, request, `마당주인${tag}`, 3000000, 'female'); const { page } = a;
  const b = await shopper(browser, request, `구경꾼${tag}`, 0, 'male');
  const again = async (fn) => { for (let k = 0; ; k += 1) { try { return await fn(); } catch (error) { if (k >= 2 || !/ECONNRESET|socket hang up/.test(String(error?.message))) throw error; } } };
  const admin = await again(() => adminToken(request)); const time = (mode) => again(() => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } }));
  for (const who of [a, b]) { await who.page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); }); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); }
  const press = async (p = page) => { if (isMobile) await p.locator('#plazaHint').tap(); else { await p.locator('#plazaStage').focus(); await p.keyboard.press('Space'); } };
  const shot = async (name, p = page, wait = 1500) => { if (!process.env.SHOT_DIR) return; await p.waitForTimeout(wait); await p.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const goTo = async (p, door, text) => expect.poll(async () => { await p.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); }, door); await p.waitForTimeout(500); return p.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain(text);
  const through = async (p, door, text, space) => {
    for (let tries = 0; tries < 4 && await p.evaluate(() => window.PlazaDebug().space) !== space; tries += 1) {
      if (await p.locator('#plazaDialog').isVisible()) await p.locator('#plazaCloseBtn').click();
      await goTo(p, door, text); if (await p.evaluate(() => window.PlazaDebug().space) === space) break;
      await press(p); await expect.poll(() => p.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe(space).catch(() => {});
    }
    expect(await p.evaluate(() => window.PlazaDebug().space)).toBe(space);
  };
  const toDesk = async () => {
    await through(page, 'townhall', '관공서 들어가기', 'townhall');
    await expect.poll(async () => { await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil'); window.PlazaDebug().teleport(c.x, c.z + 1.1); }); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 15000 }).toContain('앉아서 민원 창구 업무');
    await press();
  };
  const frames = (p) => p.evaluate(() => new Promise((resolve) => { const times = []; let last = performance.now(); const end = last + 4000; const step = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else { const avg = times.reduce((n, v) => n + v, 0) / times.length; const d = window.PlazaDebug(); resolve({ avgMs: +avg.toFixed(1), fps: +(1000 / avg).toFixed(1), calls: d.render?.calls, triangles: d.render?.triangles }); } }; requestAnimationFrame(step); }));
  let lot = null;
  try {
    await time('day'); { const th = await b.page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, b, th.x, th.z + 3); } /* (not at the spawn with me: the server never lets one through another -- both stuck there) */
    // 3층 「마당」 진열대: the arch, at its price, into the 가구 창고's 「마당」 tab
    await intoMall(page, null, isMobile);
    await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('승강기');
    await press(); await page.locator('#liftCard button[data-floor="3"]').click();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('furniture');
    await expect.poll(() => page.evaluate(() => Object.keys(window.PlazaDebug().furniture() || {}).length), { timeout: 15000 }).toBe(32); // (16 + 4 + the yard's 12)
    const W = await page.evaluate(() => { const F = window.IslandFurniture; const s = F.YARD_SLOTS.find((x) => x.good === 'yard_arch__plain'); const w = F.world(s.lx, s.lz); return F.clamp(w.x, w.z); });
    await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [W.x, W.z]); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('꽃 아치');
    await page.evaluate(() => window.PlazaDebug().setCamYaw(-Math.PI / 2)); await shot('shop-shelf-view', page, 2500); await press(); await expect(page.locator('#furnitureCard')).toContainText('20,000P'); await expect(page.locator('#furnitureCard')).toContainText('마당 물건이에요');
    await shot('shop-shelf', page, 800);
    await page.locator('#furnitureCard button', { hasText: '사기' }).click(); await expect(page.locator('#furnitureCard')).toBeHidden({ timeout: 15000 });
    if (isMobile) await page.locator('#gameMenuBtn').tap(); else await page.locator('#gameMenuBtn').click();
    await page.locator('#furnitureStorageBtn').click(); await page.locator('#furnitureStorage .storageTabs button[data-tab="yard"]').click();
    await expect(page.locator('#furnitureStorage .furniturePiece')).toHaveText(['꽃 아치']); await page.locator('#plazaCloseBtn').click();
    await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:3']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('승강기');
    await press(); await page.locator('#liftCard button[data-floor="1"]').click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('store');
    await outOfMall(page);
    // a house from the 민원 창구 (a free lot); 「마당 넓히기」 shows once there is one
    await toDesk(); await expect(page.locator('#yardGrowBtn')).toBeHidden();
    await page.locator('#homeApplyBtn').click(); const open = page.locator(`#homeCard .homeLots button[data-lot="${isMobile ? 'lot8' : 'lot7'}"]:not([disabled])`); /* (총괄 225 검토: an open lot for the photos, not lot 1 under the station) */ const free = (await open.count()) ? open : page.locator('#homeCard .homeLots button:not([disabled])').first(); lot = await free.getAttribute('data-lot'); await free.click();
    await page.locator('#homeCard button', { hasText: '신청하기' }).click(); await expect(page.locator('#homeCard')).toBeHidden({ timeout: 15000 });
    await through(page, 'room:exit', '나가기', 'island');
    const L = Y.lotById(lot); const pieces = (await post(request, '/api/test/home/furniture', a.token, { ids: ['fence_wood', 'fence_wood', 'fence_wood', 'bench', 'lantern_stone', 'garden_light', 'flowerbed', 'fence_stone'].map(Y.goodId) })).data.pieces;
    // the empty yard's frames (the line's first half)
    const stand = (lx, lz) => page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [Y.world(L, lx, lz).x, Y.world(L, lx, lz).z]);
    await stand(0, -7); await page.evaluate((yaw) => window.PlazaDebug().setCamYaw(yaw), L.yaw + Math.PI); await page.waitForTimeout(6000); const empty = await frames(page);
    // in my yard: 「마당 꾸미기」 (the button; on a PC Y too)
    await stand(-4.25, -2.25); await expect(page.locator('#yardEditBtn')).toBeVisible({ timeout: 10000 });
    if (isMobile) await page.locator('#yardEditBtn').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyY'); }
    const edit = page.locator('#yardEdit'); const status = edit.locator('[role="status"]'); await expect(edit).toBeVisible();
    await expect(edit.locator('.furniturePiece')).toHaveCount(9); // (the arch bought and the eight)
    const at = async () => (await status.getAttribute('data-at')).split(',').map(Number);
    const tap = (label) => edit.getByRole('button', { name: label, exact: true }).click();
    // which way each arrow goes on the yard's grid (the camera held while decorating)
    const ARROWS = ['왼쪽으로', '오른쪽으로', '안쪽으로', '앞쪽으로']; let way = null;
    const placeAt = async (uid, lx, lz, rot = 0) => {
      await edit.locator(`.furniturePiece[data-uid="${uid}"]`).click();
      if (!way) { way = {}; for (const k of ARROWS) { const [x0, z0] = await at(); await tap(k); const [x1, z1] = await at(); way[k] = [x1 - x0, z1 - z0]; } }
      for (let n = 0; n < 200; n += 1) { const [x, z] = await at(); if (Math.abs(x - lx) < 1e-6 && Math.abs(z - lz) < 1e-6) break; const k = ARROWS.find((k) => (way[k][0] && Math.sign(way[k][0]) === Math.sign(lx - x) && Math.abs(lx - x) > 1e-6) || (way[k][1] && Math.sign(way[k][1]) === Math.sign(lz - z) && Math.abs(lz - z) > 1e-6)); await tap(k); }
      for (let r = (await at())[2]; r !== rot; r = (r + 1) % 4) await tap('돌리기');
      await expect(status).not.toContainText('밖이에요'); await edit.getByRole('button', { name: '놓기', exact: true }).click();
      await expect.poll(async () => ((await get(request, '/api/home', a.token)).data.lots.find((l) => l.id === lot).yard || []).some((p) => p.uid === uid && p.x === lx && p.z === lz), { timeout: 15000 }).toBe(true);
      await expect(edit).toBeVisible();
    };
    const by = (shape) => pieces.filter((p) => p.id === Y.goodId(shape));
    const fences = by('fence_wood'); for (const [k, f] of fences.entries()) await placeAt(f.uid, -4.25, -0.5 + k, 1); // (end to end along the side: their posts shared)
    await placeAt(by('bench')[0].uid, -3, -3.75, 0); /* (in the front yard, facing the walk) */ await placeAt(by('lantern_stone')[0].uid, 1.5, 4); await placeAt(by('garden_light')[0].uid, -2.5, 4.25);
    const arch = (await get(request, '/api/island/furniture/mine', a.token)).data.pieces.find((p) => p.id === Y.goodId('arch')); await placeAt(arch.uid, 4.25, 0, 1);
    await page.locator('#plazaCloseBtn').click();
    // seen in 3D: the batches, what blocks (the arch's middle free, its posts not), the bench's seats
    await expect.poll(() => page.evaluate((id) => window.PlazaDebug().yards().lots.find((l) => l.id === id)?.n, lot), { timeout: 15000 }).toBe(7);
    const mid = Y.world(L, 4.25, 0); const archPost = Y.solidsOf(L, { id: Y.goodId('arch'), x: 4.25, z: 0, rot: 1 })[0];
    expect(await page.evaluate(([x, z]) => window.PlazaDebug().solidAt(x, z, 0.25), [mid.x, mid.z])).toBe(false);
    expect(await page.evaluate(([x, z]) => window.PlazaDebug().solidAt(x, z, 0), [archPost.x, archPost.z])).toBe(true);
    const fenceMid = Y.world(L, -4.25, 0); expect(await page.evaluate(([x, z]) => window.PlazaDebug().solidAt(x, z, 0), [fenceMid.x, fenceMid.z])).toBe(true);
    await stand(0.75, -8.5); await page.evaluate((yaw) => { const d = window.PlazaDebug(); d.setCamYaw(yaw); d.setCamPitch?.(0.35); }, L.yaw + Math.PI); await shot('yard-day');
    const seat = (await page.evaluate(() => window.PlazaDebug().yards().seats))[0]; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [seat.x, seat.z]);
    await expect.poll(() => spaceOn(page, `seat:${seat.id}`, isMobile), { timeout: 10000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting), { timeout: 10000 }).toBeTruthy(); await page.evaluate((yaw) => { const d = window.PlazaDebug(); d.setCamYaw(yaw); d.setCamPitch?.(0.2); }, L.yaw + Math.PI * 1.1); await shot('yard-bench');
    await page.evaluate(() => window.PlazaDebug().standUpNow()); await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting)).toBeFalsy();
    // another player: the same yard, no 「마당 꾸미기」
    await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().yards().lots.find((l) => l.id === id)?.n, lot), { timeout: 20000 }).toBe(7);
    await b.page.evaluate(([x, z, yaw]) => { const d = window.PlazaDebug(); d.teleport(x, z); d.setCamYaw(yaw); }, [Y.world(L, -4.25, -2.25).x, Y.world(L, -4.25, -2.25).z, L.yaw + Math.PI * 1.2]);
    await b.page.waitForTimeout(1500); await expect(b.page.locator('#yardEditBtn')).toBeHidden(); await shot('yard-visitor', b.page);
    // 「마당 넓히기」: room and count before → after; then a piece out at the side
    await toDesk(); await page.locator('#yardGrowBtn').click(); const card = page.locator('#homeCard');
    const a0 = Y.areaOf(L, 1, 1); const a1 = Y.areaOf(L, 1, 2);
    await expect(card).toContainText(`지금 마당 ${a0} m² → 넓히면 ${a1} m²`); await expect(card).toContainText('놓을 수 있는 물건 24 → 40개'); await shot('yard-grow', page, 600);
    const before = (await get(request, '/api/points', a.token)).data.balance; await card.locator('button', { hasText: '넓히기 · 100,000P' }).click();
    await expect(card).toBeHidden({ timeout: 15000 }); expect((await get(request, '/api/points', a.token)).data.balance).toBe(before - 100000);
    await through(page, 'room:exit', '나가기', 'island');
    const side = (() => { for (let lz = 0; lz < 3; lz += 0.25) for (const lx of [-6.25, -6.5, 6.5, 6.75]) { const p = { uid: 'x', id: Y.goodId('fence_stone'), x: lx, z: lz, rot: 1 }; if (Y.placeError(p, [], L, 1, 1) && !Y.placeError(p, [], L, 1, 2)) return [lx, lz]; } return null; })();
    expect(side, '넓히기 1로 생긴 옆 칸').not.toBe(null);
    await stand(side[0] > 0 ? 4.75 : -4.75, -2.25); await expect(page.locator('#yardEditBtn')).toBeVisible({ timeout: 10000 }); await page.locator('#yardEditBtn').click(); await expect(edit).toBeVisible();
    way = null; await placeAt(by('fence_stone')[0].uid, side[0], side[1], 1); await page.locator('#plazaCloseBtn').click();
    // night: the stone lantern and the garden light lit (the loader's glow, as the windows)
    expect(await page.evaluate(() => window.IslandAssets.REGISTRY['yard.lantern_stone'].nightGlow)).toBe(true);
    // filled to 60 (level 3): the frame line against the empty yard
    await post(request, '/api/test/yard', a.token, { level: 3 });
    const more = (await post(request, '/api/test/home/furniture', a.token, { ids: [...Array(52)].map((_, i) => Y.goodId(Y.SHAPES[i % Y.SHAPES.length])) })).data.pieces;
    let yard = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.id === lot).yard; const box = Y.boxOf(L, 1, 3);
    await stand(-4.75, -2.25); await page.waitForTimeout(800);
    for (const p of more) {
      let done = false;
      for (let lz = box[2]; lz < box[3] && !done; lz += 0.5) for (let lx = box[0]; lx < box[1] && !done; lx += 0.5) {
        const q = { uid: p.uid, id: p.id, x: Y.snap(lx), z: Y.snap(lz), rot: 0 }; if (Y.placeError(q, yard, L, 1, 3)) continue;
        const r = await post(request, '/api/home/yard', a.token, q); if (r.status === 200) { yard = r.data.yard; done = true; }
      }
    }
    expect(yard.length).toBe(60);
    await expect(page.locator('#yardEditBtn')).toBeVisible(); // (60 placed: the count the server lets)
    await expect.poll(() => page.evaluate((id) => window.PlazaDebug().yards().lots.find((l) => l.id === id)?.n, lot), { timeout: 20000 }).toBe(60);
    await stand(0, -7); await page.evaluate((yaw) => window.PlazaDebug().setCamYaw(yaw), L.yaw + Math.PI); await page.waitForTimeout(6000); const full = await frames(page);
    await shot('yard-full');
    await time('night'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().projects().night), { timeout: 30000 }).toBe(true);
    await stand(0, -7); await page.evaluate((yaw) => window.PlazaDebug().setCamYaw(yaw), L.yaw + Math.PI); await shot('yard-night', page, 2500);
    await time('day');
    console.log(`YARD-FPS ${test.info().project.name} 빈 마당 ${empty.avgMs} ms (${empty.fps} fps, draw ${empty.calls}) → 60개 ${full.avgMs} ms (${full.fps} fps, draw ${full.calls})`);
    test.info().annotations.push({ type: 'yard-fps', description: `${empty.avgMs} → ${full.avgMs} ms` });
    expect(full.avgMs, '마당 60개로 프레임이 눈에 띄게 떨어지지 않음').toBeLessThan(empty.avgMs * 1.5 + 8);
    // the 2층 큰 집 (R8 4) blocks as the 큰 집 did -- three growths, each the next day
    await toDesk();
    for (let n = 0; n < 3; n += 1) { expect((await post(request, '/api/home/upgrade', a.token, {})).status).toBe(200); await post(request, '/api/test/home/next-day', a.token, {}); }
    expect((await get(request, '/api/home', a.token)).data.mine.stage).toBe(4);
    await page.locator('#islandPlaceCloseBtn').click(); await through(page, 'room:exit', '나가기', 'island');
    await expect.poll(() => page.evaluate((id) => window.PlazaDebug().homes()[id], lot), { timeout: 15000 }).toMatch(/:4:false$/);
    expect(await page.evaluate(([x, z]) => window.PlazaDebug().solidAt(x, z, 0), [L.x + Math.sin(L.yaw) * 2, L.z + Math.cos(L.yaw) * 2])).toBe(true);
    const mail = (await get(request, '/api/island/mail', a.token)).data; expect(mail.letters.some((l) => l.from === 'office' && /마당 물건 \d+개를 창고에/.test(l.text))).toBe(true); // (the bigger house stood on some)
  } finally {
    await time('auto'); await post(request, '/api/test/home/release', a.token, {}).catch(() => {}); await post(request, '/api/test/yard', a.token, { level: 1 }).catch(() => {});
  }
  await expectNoScriptError(page); await a.context.close(); await b.context.close();
});
