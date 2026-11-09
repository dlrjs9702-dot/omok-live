const { test, expect } = require('@playwright/test');
const { shopper, adminToken, intoMall, liftTo, post, get, holdTool, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// v1.10.277 시험 정리 2차 (notes docs/test-audit-20261107.md §6): the first person in one file -- controls-fp and fp-polish
// one flow (one login, one reload), fp-hands its own test (its players and setup).

// v1.10.217 조작·1인칭 개편 (gamecenter-notes docs/controls-fp-revamp-20261030.md A·B1~3): W/A/S/D walk, the arrows turn the
// view and walk nowhere; the mouse looks (a locked pointer -- headless has none, so PlazaDebug().lookBy plays its movement) at
// the ☰ 감도; a window open lets the lock go; the first person at 70°, the eyes by the head (not the hat), up 75° · down 70°.
// With SHOT_DIR: the first person at the plaza, the 백화점 1층 counter and the 3층 tables (BEFORE=1 against an older server:
// the photos only).
// v1.10.218 1인칭 다듬기 (gamecenter-notes docs/controls-fp-revamp-20261030.md B4~6): the first person's walk rises and falls a
// little (none standing, off in ☰), the tool in hand is drawn at the screen's lower right (it swings with the net), and the
// SPACE target is marked. With SHOT_DIR: the photos.
test('조작·1인칭: W/A/S/D 걷기·방향키 시점·마우스 보기·감도·창 열면 풀림, 1인칭 70°·눈높이; 다듬기: 걸음 흔들림·☰ 끄기, 든 도구, SPACE 대상', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.SHOT_DIR ? 480000 : 330000);
  const who = await shopper(browser, request, isMobile ? '조작구경m' : '조작구경', 0, 'female'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'first'); localStorage.setItem('gc.view.in', 'first'); localStorage.setItem('gc.testControlsNotice', '1'); localStorage.setItem('gc.testHalloween', 'off'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  // (총괄 검토) the keys swapped: told once on a PC -- not on a phone, not again after
  const notice = page.locator('#plazaDialog .controlsNotice');
  if (isMobile) { await page.waitForTimeout(1500); await expect(notice).toHaveCount(0); }
  else {
    await expect(notice).toBeVisible({ timeout: 20000 }); await expect(notice).toContainText('W·A·S·D'); await expect(page.locator('#plazaDialogTitle')).toHaveText('조작이 바뀌었어요');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-controls-notice.png` });
    await notice.getByRole('button', { name: '알겠어요' }).click(); await expect(notice).toBeHidden();
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); await page.waitForTimeout(1500); await expect(notice).toHaveCount(0);
  }
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${process.env.BEFORE ? 'before' : 'after'}-${name}.png` }); };
  const view = () => page.evaluate(() => window.PlazaDebug().view());
  const at = () => page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]);
  try {
    if (process.env.SHOT_DIR) { await set('time', 'day'); await set('weather', 'clear'); }
    await expect.poll(async () => (await view()).mode, { timeout: 20000 }).toBe('first');
    const v = await view();
    if (!process.env.BEFORE) {
      expect(v.fov).toBe(70); expect(v.eye).toBeGreaterThan(0.6); expect(v.eye).toBeLessThan(1.6); // (the eyes by the head: a person's about 1.0~1.3 m)
      if (!isMobile) {
        const hold = async (key, ms = 700) => { await page.locator('#plazaStage').focus(); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(300); };
        // W walks where I look; the arrows turn the look and walk nowhere
        let a = await at(); await hold('KeyW'); let b = await at(); expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThan(0.3);
        a = b; const yaw = (await view()).yaw; await hold('ArrowLeft'); b = await at();
        expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(0.05); expect(Math.abs((await view()).yaw - yaw)).toBeGreaterThan(0.3);
        // the mouse looks (as locked): right turns right, up looks up; the ☰ 감도 doubles it
        const y0 = (await view()).yaw; await page.evaluate(() => window.PlazaDebug().lookBy(100, 0)); await page.waitForTimeout(500); const turned = y0 - (await view()).yaw; expect(turned).toBeGreaterThan(0.15);
        const p0 = (await view()).pitch; await page.evaluate(() => window.PlazaDebug().lookBy(0, -400)); await page.waitForTimeout(500); expect((await view()).pitch).toBeLessThan(p0 - 0.5);
        await page.evaluate(() => window.PlazaDebug().lookBy(0, -4000)); await page.waitForTimeout(600); expect((await view()).pitch).toBeGreaterThan(-1.32); // (up 75° at most)
        await page.evaluate(() => window.PlazaDebug().lookBy(0, 8000)); await page.waitForTimeout(600); expect((await view()).pitch).toBeLessThan(1.23); // (down 70°)
        await page.evaluate(() => window.PlazaDebug().lookBy(0, -2700)); await page.waitForTimeout(300); // (back near level)
        await page.keyboard.press('Escape'); await expect(page.locator('#gameMenu, #menuDialog').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
        const sens = page.locator('#mouseSensInput'); await expect(sens).toBeAttached();
        await sens.evaluate((el) => { el.value = '2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        expect((await page.evaluate(() => window.PlazaDebug().pointerLock())).sens).toBe(2);
        expect((await page.evaluate(() => window.PlazaDebug().pointerLock())).ok).toBe(false); // (a window open: no lock)
        await page.keyboard.press('Escape'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().pointerLock().ok), { timeout: 10000 }).toBe(true);
        // (v1.10.281 문제 기록 1) the lock wanted (my click took it): a window opened and closed by a key -- taken again then;
        // let go by me (the browser's Esc: a pointerlockchange the game did not ask for) -- not wanted any more
        const pl = () => page.evaluate(() => window.PlazaDebug().pointerLock());
        await page.evaluate(() => window.PlazaDebug().lockWant(true)); const r0 = (await pl()).relocks;
        await page.keyboard.press('Escape'); await expect.poll(async () => (await pl()).ok, { timeout: 10000 }).toBe(false); expect((await pl()).relocks).toBe(r0); /* (open: not while it is) */
        await page.keyboard.press('Escape'); await expect.poll(async () => (await pl()).relocks, { timeout: 10000 }).toBe(r0 + 1); expect((await pl()).want).toBe(true);
        await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); else document.dispatchEvent(new Event('pointerlockchange')); }); /* (taken for real or not -- let go not by the game) */
        await expect.poll(async () => (await pl()).want, { timeout: 5000 }).toBe(false);
        await page.keyboard.press('Shift'); await page.waitForTimeout(200); expect((await pl()).relocks).toBe(r0 + 1); /* (mine let go: a key takes nothing) */
        const y1 = (await view()).yaw; await page.evaluate(() => window.PlazaDebug().lookBy(100, 0)); await page.waitForTimeout(500); expect(y1 - (await view()).yaw).toBeGreaterThan(turned * 1.6);
      }
    }
    await page.evaluate(() => { const p = window.PlazaDebug(); p.place('board'); p.setCamPitch?.(0); }); await shot('plaza');
    // (fp-polish, v1.10.218) the walk bob, the tool in hand, the SPACE target
    const pshot = async (name, wait = 1200) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); }; /* (fp-polish's photos, as they were named) */
    const d = (fn, arg) => page.evaluate(([f, a]) => window.PlazaDebug()[f](a), [fn, arg]);
    // B4: standing still -- no bob; walking -- some; ☰ off -- none
    expect((await d('bob')).amp).toBe(0);
    if (!isMobile) {
      const walkAmp = async () => { await page.locator('#plazaStage').focus(); await page.keyboard.down('KeyW'); let most = 0; for (let k = 0; k < 12; k += 1) { await page.waitForTimeout(100); most = Math.max(most, (await d('bob')).amp); } await page.keyboard.up('KeyW'); return most; }; /* (the most in 1.2 s walking) */
      expect(await walkAmp()).toBeGreaterThan(0.01);
      await page.waitForTimeout(800); expect((await d('bob')).amp).toBe(0);
      await page.keyboard.press('Escape'); const box = page.locator('#walkBobToggle'); await expect(box).toBeChecked(); await box.uncheck(); await page.keyboard.press('Escape');
      expect((await d('bob')).on).toBe(false); expect(await walkAmp()).toBe(0);
      expect(await page.evaluate(() => localStorage.getItem('gc.walkBob'))).toBe('off');
    }
    // B5: the net in hand -- drawn in the first; out of the bag -- gone
    expect((await d('fpHand')).shown).toBe(false);
    expect((await post(request, '/api/test/island/give', who.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
    await page.keyboard.press('KeyI');
    await page.locator('.islandBagSlot[data-item="bugnet"]').first().click(); await page.locator('#islandBagGrid button', { hasText: '들기' }).first().click();
    await expect.poll(() => d('heldTool')).toBe('bugnet');
    await page.evaluate(() => window.PlazaWarp(30, 0)); await page.evaluate(() => window.PlazaDebug().setCamPitch?.(0));
    await expect.poll(async () => (await d('fpHand')).tool, { timeout: 20000 }).toBe(true); console.log(JSON.stringify(await page.evaluate(() => new Promise((done) => { const out = []; const t0 = performance.now(); const tick = () => { out.push(window.PlazaDebug().fpHand().fist); if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else done(out); }; tick(); }))));
    await pshot('fp-net'); console.log(JSON.stringify(await d('fpHand')));
    await page.evaluate(() => window.PlazaDebug().swingNow()); await pshot('fp-net-swing', 300);
    // B6: the board 1.4 m before me -- a ring under it; standing on it -- none
    await page.evaluate(() => window.PlazaDebug().place('board')); await page.waitForTimeout(500);
    const b = await page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]);
    await page.evaluate(([x, z]) => { const p = window.PlazaDebug(); p.teleport(x + 1.4, z); p.setCamYaw(Math.PI / 2); p.setCamPitch?.(0.35); }, b);
    await expect.poll(() => d('targetRing'), { timeout: 10000 }).toMatchObject({ id: 'board' });
    await pshot('fp-target');
    await page.evaluate(() => window.PlazaDebug().place('board')); await expect.poll(() => d('targetRing'), { timeout: 10000 }).toBeNull();
    // B5 again: the rod in hand; then nothing held -- nothing drawn
    expect((await post(request, '/api/test/island/give', who.token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
    const hold = async (item) => { await page.keyboard.press('KeyI'); await page.locator(`.islandBagSlot[data-item="${item}"]`).first().click(); await page.locator('#islandBagGrid button', { hasText: /들기|넣기/ }).first().click(); };
    await hold('fishing_rod'); await expect.poll(() => d('heldTool')).toBe('fishing_rod');
    await page.evaluate(() => window.PlazaWarp(30, 0)); await page.evaluate(() => { window.PlazaDebug().setCamPitch?.(0); });
    await expect.poll(async () => (await d('fpHand')).tool, { timeout: 20000 }).toBe(true); await pshot('fp-rod');
    await hold('fishing_rod'); await expect.poll(() => d('heldTool')).toBeNull(); expect((await d('fpHand')).shown).toBe(false);
    await intoMall(page, null, isMobile);
    await page.evaluate(() => { const S = window.IslandStore; const s = S.SECTORS.find((x) => x.keeper); const c = S.world(s.interact[0], s.interact[1]); const k = S.world(s.keeper[0], s.keeper[1]); const p = window.PlazaDebug(); const w = { x: c.x + (c.x - k.x) * 0.6, z: c.z + (c.z - k.z) * 0.6 }; p.teleport(w.x, w.z); p.faceTo?.(k.x, k.z); p.setCamYaw(Math.atan2(-(k.x - w.x), -(k.z - w.z))); p.setCamPitch?.(0); }); await shot('mall1'); // (the customer's side, the counter and its keeper ahead)
    await liftTo(page, 3, isMobile);
    await page.evaluate(() => { const F = window.IslandFurniture; const s = F.SLOTS.find((x) => x.kind === 'floor') || F.SLOTS[0]; const w = F.world(s.lx, s.lz - 2.6); const p = window.PlazaDebug(); p.teleport(w.x, w.z); const t = F.world(s.lx, s.lz); p.faceTo?.(t.x, t.z); p.setCamYaw(Math.atan2(-(t.x - w.x), -(t.z - w.z))); p.setCamPitch?.(0); }); await shot('mall3');
    await expectNoScriptError(page); await who.context.close();
  } finally {
    if (process.env.SHOT_DIR) { await set('time', 'auto'); await set('weather', 'auto'); }
  }
});


// v1.10.228 1인칭 손 (gamecenter-notes docs/fp-hands-20261102.md, 사용자 「잡초 제거할 때 라거나 상호작용 할 때 손이 뭔가 하는게
// 보이게하려는거야」): in the first person an empty hand shows only while it does something -- a weed pulled (up, the weed in it
// from the lift at 0.62 s, down when done), a berry picked, a door's SPACE (a short reach); the rod's grip is the same hand; my
// own skin on it. The third person: nothing. PC and phone; SHOT_DIR the photos (the real models only then).
// every frame of the hand from now till it has come up and gone down again (at most ms: a slow runner's server answers late)
const recordHand = (page, ms) => page.evaluate((ms) => new Promise((done) => { const seen = []; const t0 = performance.now(); const tick = () => { const h = window.PlazaDebug().fpHand(); seen.push({ t: Math.round(performance.now() - t0), shown: h.shown, up: h.up, held: h.held, pulse: h.pulse, fist: h.fist, g: window.PlazaDebug().gather?.t ?? null }); if (performance.now() - t0 < ms && !(seen.some((x) => x.shown) && !h.shown)) requestAnimationFrame(tick); else done(seen); }; tick(); }), ms);
// a photo of the island's canvas on the frame `when` (h: fpHand, g: gather) first holds, read right after it is drawn -- a page's
// screenshot comes some hundred ms late, past a 0.8 s pull (the 3D view alone, no HUD)
const grab = (p, name, when) => (process.env.SHOT_DIR ? p.evaluate((src) => new Promise((done) => { const ok = new Function('h', 'g', `return (${src})`); const t0 = performance.now(); const tick = () => { const d = window.PlazaDebug(); if (ok(d.fpHand(), d.gather)) { done(document.querySelector('canvas.plazaCanvas').toDataURL('image/png')); return; } if (performance.now() - t0 < 15000) requestAnimationFrame(tick); else done(null); }; requestAnimationFrame(tick); }), when).then((url) => { if (url) require('fs').writeFileSync(`${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png`, Buffer.from(url.split(',')[1], 'base64')); }) : Promise.resolve());
async function firstPerson(who, view = 'first') {
  const real = Boolean(process.env.SHOT_DIR);
  await who.page.evaluate(([real, view]) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', view); localStorage.setItem('gc.view.in', view); if (!real) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, [real, view]);
  await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await expect.poll(() => who.page.evaluate(() => window.PlazaDebug().view().mode), { timeout: 20000 }).toBe(view);
}
const freeWeed = async (request, token, skip = []) => {
  const weeds = (await get(request, '/api/island/weeds', token)).data.weeds || [];
  const bugs = (await get(request, '/api/island/insects', token)).data.list || [];
  return weeds.map(([id, x, z]) => ({ id, x, z })).find((w) => !skip.includes(w.id) && Math.hypot(w.x, w.z) > 30 && T.walkDist(w.x, w.z) > 1.5 && !bugs.some((b) => Math.hypot(b.x - w.x, b.z - w.z) < 4));
};

test('1인칭 손: 잡초 뽑기·열매 따기·문 SPACE 동안만 손, 잡초가 손에, 낚싯대 쥔 손, 내 피부색, 3인칭은 그대로', async ({ browser, request, isMobile }) => {
  test.setTimeout(420000);
  const who = await shopper(browser, request, isMobile ? '손m' : '손p', 50000, 'female'); const { page, token } = who;
  await firstPerson(who);
  const shot = async (p, name, wait = 0) => { if (!process.env.SHOT_DIR) return; if (wait) await p.waitForTimeout(wait); await p.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png`, scale: 'css' }); /* (css scale: quick enough for a hand's moment on a phone) */ };
  const hint = page.locator('#plazaHint');
  const press = async (p = page) => { if (isMobile) await p.locator('#plazaHint').tap(); else { await p.locator('#plazaStage').focus(); await p.keyboard.press('Space'); } };
  const d = (fn) => page.evaluate((f) => window.PlazaDebug()[f](), fn);
  expect((await d('fpHand')).shown).toBe(false); // (an empty hand standing: none)
  // a weed: up, the weed in it after the lift, down when done
  const used = [];
  const pull = async (p, w, photos = null) => { // photos: 'full' (reach, pull) or one name (the reach)
    await p.evaluate((w) => { window.PlazaWarp(w.x, w.z); window.PlazaDebug().setCamPitch?.(0.35); }, w);
    await expect(p.locator('#plazaHint')).toHaveText(/잡초/, { timeout: 10000 });
    const shots = photos === 'full' ? [grab(p, 'weed-reach', "h.up === 1 && !h.held && g && g.kind === 'weed'"), grab(p, 'weed-pull', "h.held === 'weed' && g && g.t >= 0.85")] : photos ? [grab(p, photos, "h.up === 1 && g && g.kind === 'weed'")] : [];
    const rec = recordHand(p, 15000); await press(p);
    await Promise.all(shots); return rec;
  };
  let w = await freeWeed(request, token); used.push(w.id);
  const weedSeen = await pull(page, w, 'full');
  const up = weedSeen.find((s) => s.shown); expect(up, 'a hand when the pull began').toBeTruthy(); // (the pull begins once the server said so)
  const withWeed = weedSeen.find((s) => s.held === 'weed'); expect(withWeed, 'the weed in the hand').toBeTruthy(); if (!process.env.SHOT_DIR) expect(withWeed.t - up.t).toBeGreaterThanOrEqual(520); // (from the lift, 0.62 s in; not timed with SHOT_DIR: the photo's canvas grab stalls frames -- 470~478 ms on main too, v1.10.241)
  expect(weedSeen.some((s) => s.shown && !s.held), 'the empty hand reaching first').toBe(true);
  const pulling = weedSeen.filter((s) => s.g !== null && s.g >= 0.66 && s.g <= 1.3); expect(pulling.length, 'frames of the pull').toBeGreaterThan(0); expect(pulling.filter((s) => !(s.shown && s.up === 1 && s.held === 'weed')), 'up with the weed, 0.62 ~ 1.4 s').toHaveLength(0);
  const offScreen = weedSeen.filter((s) => s.up === 1 && (Math.abs(s.fist[0]) > 0.95 || Math.abs(s.fist[1]) > 0.95)); expect(offScreen, JSON.stringify(offScreen.slice(0, 3))).toHaveLength(0); // (up: on the screen)
  await expect.poll(() => d('fpHand'), { timeout: 10000 }).toMatchObject({ shown: false });
  await shot(page, 'weed-done');
  // a berry on a fruit tree
  const berry = ((await get(request, '/api/test/island/events', token)).data.events || []).find((e) => e.type === 'berry' && e.state === 'open'); // (every berry on a fruit tree, v1.10.77)
  if (berry) {
    await page.evaluate((p) => { window.PlazaWarp(p.x, p.z); window.PlazaDebug().setCamPitch?.(-0.1); }, berry);
    await expect(hint).toContainText('열매', { timeout: 10000 });
    const photo = grab(page, 'fruit', "h.held === 'item' && g && g.t >= 1.1"); const rec = recordHand(page, 15000); await press(); await photo; // (the fruit in the hand from 0.98 s in)
    const seen = await rec; expect(seen.some((s) => s.shown), 'a hand at the berry').toBe(true); expect(seen.some((s) => s.held === 'item'), 'the fruit in it').toBe(true);
    await expect.poll(() => d('fpHand'), { timeout: 10000 }).toMatchObject({ shown: false });
  }
  // a door's SPACE: a short reach out and back
  await page.evaluate(() => { window.PlazaDebug().place('store'); window.PlazaDebug().setCamPitch?.(0); }); // (the 백화점's door: in, still the first person -- the reach seen over its 1층)
  await expect(hint).toContainText('백화점', { timeout: 10000 });
  { if (process.env.SHOT_DIR) await page.evaluate(() => window.PlazaDebug().fpTap(1600)); // (the photo: the 0.38 s reach held longer -- a phone's screenshot is slower than it)
    const rec = recordHand(page, 8000); await press();
    if (process.env.SHOT_DIR) { await expect.poll(() => page.evaluate(() => window.PlazaDebug().fpHand().up), { timeout: 3000, intervals: [16] }).toBe(1); await shot(page, 'door-tap'); await page.evaluate(() => window.PlazaDebug().fpTap(null)); }
    const seen = await rec; expect(seen.some((s) => s.pulse === 'tap' && s.shown), JSON.stringify(seen.slice(0, 8))).toBe(true); }
  await expect.poll(() => d('fpHand'), { timeout: 10000 }).toMatchObject({ shown: false });
  await expect.poll(async () => { const sp = await page.evaluate(() => window.PlazaDebug().space); if (sp === 'island') return true; await page.evaluate(() => { const d = window.PlazaDebug(); const x = d.doors['store:exit']; if (x) d.teleport(x.x, x.z); }); await page.waitForTimeout(500); await press(); await page.waitForTimeout(800); return false; }, { timeout: 30000 }).toBe(true); // (out again)
  if (process.env.SHOT_DIR) { // the rod: the same hand at its grip (the rod's model: real models only -- fp-polish keeps the tool's hand)
    expect((await post(request, '/api/test/island/give', token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
    await page.evaluate(() => { window.PlazaWarp(30, 0); window.PlazaDebug().setCamPitch?.(0); });
    await holdTool(page, 'fishing_rod'); await expect.poll(async () => (await d('fpHand')).tool, { timeout: 20000 }).toBe(true);
    await shot(page, 'rod', 800);
    for (const good of ['firework', 'bubbles']) { // (v1.10.241 Codex 10판 P2: a thing to use in the hand too, not only the net and the rod)
      expect((await post(request, '/api/test/island/give', token, { itemId: good, qty: 1 })).status).toBe(200);
      await holdTool(page, good); await expect.poll(async () => (await d('fpHand')).tool, { timeout: 20000 }).toBe(true); await shot(page, good, 800);
    }
  }
  // my own skin: a dyed skin on the hand (the default first)
  expect((await d('fpHand')).skin).toBe('#ffe0c4');
  await expectNoScriptError(page); await who.context.close();

  const dark = await shopper(browser, request, isMobile ? '손어둠m' : '손어둠p', 50000, 'male');
  const dyed = await post(request, '/api/avatar/dye', dark.token, { itemId: 'skin', color: 's11', requestId: `dye-${Date.now()}` }); expect(dyed.status, JSON.stringify(dyed.data)).toBe(200);
  await firstPerson(dark);
  w = await freeWeed(request, dark.token, used); used.push(w.id);
  await pull(dark.page, w, 'skin-dark');
  expect((await dark.page.evaluate(() => window.PlazaDebug().fpHand())).skin).toBe('#764c30');
  await expect.poll(() => dark.page.evaluate(() => window.PlazaDebug().fpHand()), { timeout: 10000 }).toMatchObject({ shown: false });
  // the third person: nothing drawn for the hand
  await firstPerson(dark, 'third');
  w = await freeWeed(request, dark.token, used);
  expect((await pull(dark.page, w)).some((s) => s.shown)).toBe(false);
  await expectNoScriptError(dark.page); await dark.context.close();
});

// v1.10.284 그래픽 G1 (gamecenter-notes docs/graphics-island-wide-20261108.md 4절): with the pilot asked for (gc.testPilot), the
// wind grass over the whole island in 16 m cells round me -- made as I come and gone behind me; none on a walk, by a tree or on
// the plaza, some on a lawn. PC (a phone's 25 m the same code).
test('그래픽 G1: 섬 전체 풀 칸이 나를 따라 바뀌고, 길·나무·광장에는 풀 없음', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 한 번 (같은 코드)'); test.setTimeout(180000);
  const who = await shopper(browser, request, '풀칸손님', 0, 'female'); const { page } = who;
  await page.evaluate(() => { localStorage.setItem('gc.testPilot', '1'); localStorage.removeItem('gc.testClassic'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().holdQuality(2));
  const pilot = () => page.evaluate(() => window.PlazaDebug().pilot());
  await page.evaluate(() => window.PlazaWarp(-15, -40)); await expect.poll(async () => (await pilot()).cells, { timeout: 60000 }).toBeGreaterThan(8);
  const here = (await pilot()).cellKeys; expect(here).toContain('-1,-3'); /* (the cell I stand in: x -16..0, z -48..-32) */
  await page.evaluate(() => window.PlazaWarp(60, -110)); await expect.poll(async () => (await pilot()).cellKeys.includes('3,-7'), { timeout: 60000 }).toBe(true);
  await expect.poll(async () => (await pilot()).cellKeys.includes('-1,-3'), { timeout: 30000 }).toBe(false); /* (well behind me -- past the reach and a cell: gone) */
  const at = await page.evaluate(() => { const T = window.IslandTerrain; const D = window.PlazaDebug(); const tree = T.natureSolids()[0]; let walk = null;
    for (let x = -40; x < 40 && !walk; x += 0.5) for (let z = -60; z < 0 && !walk; z += 0.5) if (T.walkDist(x, z) < -0.5 && !T.inPlaza(x, z)) walk = [x, z];
    return { walk: D.pilotGrassAt(walk[0], walk[1]), tree: D.pilotGrassAt(tree.x, tree.z), plaza: D.pilotGrassAt(T.PLAZA_C.x, T.PLAZA_C.z), lawn: D.pilotGrassAt(-15, -40) }; });
  expect(at).toMatchObject({ walk: 0, tree: 0, plaza: 0 }); expect(at.lawn).toBeGreaterThan(0.5);
  await page.evaluate(() => window.PlazaDebug().holdQuality(1)); await expect.poll(async () => (await pilot()).grow.some((h) => h > 0 && h < 1), { timeout: 5000 }).toBe(true); /* (v1.10.290 6: 「중간」 -- the blades laid down over 1.5 s, not gone at once) */
  await page.evaluate(() => window.PlazaDebug().holdQuality(0)); await expect.poll(async () => (await pilot()).cells, { timeout: 15000 }).toBe(0); /* (「낮음」: none -- once laid down) */
  await expectNoScriptError(page); await who.context.close();
});