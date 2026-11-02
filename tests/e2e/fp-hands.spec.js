const { test, expect } = require('@playwright/test');
const { shopper, post, get, holdTool, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// v1.10.228 1인칭 손 (gamecenter-notes docs/fp-hands-20261102.md, 사용자 「잡초 제거할 때 라거나 상호작용 할 때 손이 뭔가 하는게
// 보이게하려는거야」): in the first person an empty hand shows only while it does something -- a weed pulled (up, the weed in it
// from the lift at 0.62 s, down when done), a berry picked, a door's SPACE (a short reach); the rod's grip is the same hand; my
// own skin on it. The third person: nothing. PC and phone; SHOT_DIR the photos (the real models only then).
// every frame of the hand from now till it has come up and gone down again (at most ms: a slow runner's server answers late)
const recordHand = (page, ms) => page.evaluate((ms) => new Promise((done) => { const seen = []; const t0 = performance.now(); const tick = () => { const h = window.PlazaDebug().fpHand(); seen.push({ t: Math.round(performance.now() - t0), shown: h.shown, up: h.up, held: h.held, pulse: h.pulse, fist: h.fist }); if (performance.now() - t0 < ms && !(seen.some((x) => x.shown) && !h.shown)) requestAnimationFrame(tick); else done(seen); }; tick(); }), ms);
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
    const rec = recordHand(p, 15000); await press(p);
    const raised = () => expect.poll(() => p.evaluate(() => window.PlazaDebug().fpHand().up), { timeout: 5000, intervals: [16] }).toBe(1); // (the pull begins once the server said so)
    if (photos && photos !== 'full') { await raised(); await shot(p, photos, 100); }
    if (photos === 'full') { await raised(); await shot(p, 'weed-reach', 100); await expect.poll(() => p.evaluate(() => window.PlazaDebug().fpHand().held), { timeout: 5000 }).toBe('weed'); await shot(p, 'weed-pull', 150); }
    return rec;
  };
  let w = await freeWeed(request, token); used.push(w.id);
  const weedSeen = await pull(page, w, 'full');
  const up = weedSeen.find((s) => s.shown); expect(up, 'a hand when the pull began').toBeTruthy(); // (the pull begins once the server said so)
  const withWeed = weedSeen.find((s) => s.held === 'weed'); expect(withWeed, 'the weed in the hand').toBeTruthy(); expect(withWeed.t - up.t).toBeGreaterThanOrEqual(520); // (from the lift, 0.62 s in)
  expect(weedSeen.some((s) => s.shown && !s.held), 'the empty hand reaching first').toBe(true);
  const offScreen = weedSeen.filter((s) => s.up === 1 && (Math.abs(s.fist[0]) > 0.95 || Math.abs(s.fist[1]) > 0.95)); expect(offScreen, JSON.stringify(offScreen.slice(0, 3))).toHaveLength(0); // (up: on the screen)
  await expect.poll(() => d('fpHand'), { timeout: 10000 }).toMatchObject({ shown: false });
  await shot(page, 'weed-done');
  // a berry on a fruit tree
  const berry = ((await get(request, '/api/test/island/events', token)).data.events || []).find((e) => e.type === 'berry' && e.state === 'open'); // (every berry on a fruit tree, v1.10.77)
  if (berry) {
    await page.evaluate((p) => { window.PlazaWarp(p.x, p.z); window.PlazaDebug().setCamPitch?.(-0.1); }, berry);
    await expect(hint).toContainText('열매', { timeout: 10000 });
    const rec = recordHand(page, 15000); await press();
    if (process.env.SHOT_DIR) { await expect.poll(() => page.evaluate(() => window.PlazaDebug().fpHand().held), { timeout: 5000, intervals: [16] }).toBe('item').then(() => shot(page, 'fruit'), () => {}); } // (the photo only: the record below is the check) // (the fruit in the hand from 0.98 s in)
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
