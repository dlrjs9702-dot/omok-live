const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, spaceOn, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// v1.10.277 시험 정리 2차 (docs/test-audit-20261107.md §6): the talk camera in one file -- the first person's framing, the
// talking spot (PC), the photos of who we talk to (SHOT_DIR).

// V1 총괄 검토 (gamecenter-notes docs/view-modes-20261029.md 「1인칭 대화 = 마주 보기」): a talk in the first framed by who
// they are -- at their eyes' height, far enough that head to shoulders is about half the screen (1.2 m at the least),
// their face in the upper third over the talk window, the whole head on screen; a soft light on them while we talk.
// 해송 (a big head), 가람 (small) -- and 바위 when the builder stands in the village. PC and phone.
test('1인칭 대화 구도: 눈높이·머리부터 어깨·얼굴은 위쪽 1/3, 대화 중 보조광', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 200000);
  const who = await shopper(browser, request, isMobile ? '마주봄m' : '마주봄', 0, 'female'); const { page } = who;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'first'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  expect((await page.evaluate(() => window.PlazaDebug().view())).mode).toBe('first');
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  const framed = async (name) => {
    // (CI #380·#383: the distance read while the step back was still under way (0.87) -- waited for with the framing)
    await expect.poll(async () => { const a = await page.evaluate(() => window.PlazaDebug().talkAim()); return a && a.eyeY > 0.12 && a.eyeY < 0.6 && a.topY < 0.98 && Math.abs(a.x) < 0.2 && a.fill > 0 && a.dist > 1.1; }, { timeout: 15000 }).toBe(true);
    const a = await page.evaluate(() => window.PlazaDebug().talkAim()); expect(a.fill).toBeGreaterThan(0); expect(a.dist).toBeGreaterThan(1.1);
    if (process.env.SHOT_DIR) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-talk-${name}.png` }); }
    // (CI #380·#382·#383: shut, and a late talk's answer (the asks above repeat every 1.2 s) opened it again between the check and the
    // aim's read -- shut until the aim is gone and the window stays shut)
    await expect.poll(async () => { if (await talking()) await page.evaluate(() => document.getElementById('plazaDialog').close()); await page.waitForTimeout(400); return await talking() ? 'talking' : await page.evaluate(() => window.PlazaDebug().talkAim()); }, { timeout: 30000 }).toBe(null); /* (CI: a late talk request opened it again -- closed again) */
    expect((await page.evaluate(() => window.PlazaDebug().talkAim()))).toBe(null); await expect.poll(() => page.evaluate(() => window.PlazaDebug().view().fov)).toBe(70);
  };
  for (const [n, name] of [[1, 'haesong'], [9, 'garam']]) {
    await expect.poll(async () => {
      if (!await talking()) { await post(request, '/api/test/island/free-residents', who.token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) { await window.PlazaWarp(w.x + 1.0, w.z); window.PlazaDebug().talkResident(n); } }, n); await page.waitForTimeout(900); }
      return talking();
    }, { timeout: 120000, intervals: [300] }).toBe(true);
    await framed(name);
  }
  // (#355 CI: 가람 caught walking settled on the server's spot after the talk began -- the step back stopped short at 1.0 m)
  // one caught walking: stepped back from where they end up standing, to the framing's distance
  await expect.poll(async () => {
    if (!await talking()) { await post(request, '/api/test/island/free-residents', who.token, {}); await page.evaluate(async () => { const w = window.PlazaDebug().wanderers.find((o) => o.speed > 0 && !o.held); if (w) { await window.PlazaWarp(w.x + 1.0, w.z); window.PlazaDebug().talkResident(w.n); } }); await page.waitForTimeout(900); }
    return talking();
  }, { timeout: 120000, intervals: [300] }).toBe(true);
  await expect.poll(async () => { const a = await page.evaluate(() => window.PlazaDebug().talkAim()); return a && a.dist >= a.gap - 0.05; }, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => { if (await talking()) await page.evaluate(() => document.getElementById('plazaDialog').close()); return talking(); }, { timeout: 15000 }).toBe(false);
  // 바위 (the builder, a quest islander in the village) when he stands there this week
  const builder = await page.evaluate(() => Boolean(window.PlazaDebug().doors?.['ev:quest_npc:questbuilder'] || null));
  if (builder) {
    await expect.poll(async () => { if (!await talking()) { await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questbuilder')); await page.waitForTimeout(500); if (isMobile) await page.locator('#plazaHint').click().catch(() => {}); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } await page.waitForTimeout(900); } return talking(); }, { timeout: 60000 }).toBe(true);
    await framed('bawi');
  }
  await expectNoScriptError(page); await who.context.close();
});

// v1.10.219 대화 자리 잡기 (총괄 218 검토): a tree on the talk camera's line -- the camera goes to the other side; an islander
// caught further off -- I walk up to the talking distance; the station's keeper (철이) faces the path where people come by.
// With SHOT_DIR: 물결·콩이 talked to (talk-facing-photo.spec.js has them too).
test('대화 자리 잡기: 나무 피하는 대화 카메라, 먼 주민에게 걸어가 서기, 역 철이 길 쪽', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');
  test.setTimeout(240000);
  await request.post('/api/test/roster', { data: { on: true, day: '2026-11-13' } });
  const who = await shopper(browser, request, isMobile ? '자리잡기m' : '자리잡기', 0, 'female'); const { page } = who;
  try {
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const d = (fn, ...a) => page.evaluate(([f, args]) => window.PlazaDebug()[f](...args), [fn, a]);
    // the camera: a tree halfway along its line from my right -- not that side
    const S = T.natureSolids(); const tree = S.find((o) => o.r > 0.6 && Math.hypot(o.x, o.z) > 30 && T.walkable(o.x - 2.1, o.z - 0.05) && T.walkable(o.x - 2.1, o.z + 1.55));
    const side = await d('talkSideAt', tree.x - 2.1, tree.z - 0.05, tree.x - 2.1, tree.z + 1.55);
    expect(side, `나무 ${JSON.stringify(tree)}`).not.toEqual([1, 1]);
    // the station's keeper or its story 철이: facing the way beside it
    await expect.poll(async () => (await d('residentPosts')).some((p) => p.id === 'station:keeper' || p.id === 'ev:quest_npc:queststationmaster'), { timeout: 30000 }).toBe(true);
    const st = (await d('residentPosts')).find((p) => p.id === 'station:keeper' || p.id === 'ev:quest_npc:queststationmaster');
    expect(T.walkDist(st.x + Math.sin(st.yaw) * 2, st.z + Math.cos(st.yaw) * 2), `철이 ${JSON.stringify(st)}`).toBeLessThan(0.5);
    if (process.env.SHOT_DIR) { /* (from the path, 3 m before it) */
      await page.evaluate((s) => { const g = window.PlazaDebug(); const px = Math.cos(s.yaw); const pz = -Math.sin(s.yaw); g.teleport(s.x + Math.sin(s.yaw) * 2.2 + px * 1.6, s.z + Math.cos(s.yaw) * 2.2 + pz * 1.6); g.setCamYaw(s.yaw - 0.35); /* (me a step aside, 총괄 219 검토) */ g.setCamPitch?.(0.05); }, st); await page.locator('#plazaStage').focus(); for (let k = 0; k < 4; k += 1) await page.keyboard.press('KeyQ');
      await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-station.png` });
    }
    // a walker talked to from further off: I end at about the talking distance (1.6 m)
    const talking = () => page.evaluate(() => /talkMode/.test(document.getElementById('plazaDialog').className));
    let gaps = [];
    for (const n of [11, 14]) {
      await expect.poll(async () => { if (await talking()) return true; await post(request, '/api/test/island/free-residents', who.token, {}); /* (v1.10.231, 230 CI: an island NPC event held 11 -- RESIDENT_BUSY) */ await d('talkResident', n); await page.waitForTimeout(1500); return talking(); }, { timeout: 30000 }).toBe(true);
      await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().talkView))?.gap ?? 9, { timeout: 8000 }).toBeLessThan(2.0);
      await page.waitForTimeout(1500); gaps.push((await page.evaluate(() => window.PlazaDebug().talkView)).gap); /* (settled) */ const fr = await page.evaluate(() => window.PlazaDebug().talkFrame3()); if (n === 14) { expect(fr.head.y, '콩이 머리 화면 위쪽').toBeGreaterThan(0.35); expect(Math.abs(fr.waist.x)).toBeLessThan(0.6); }
      if (process.env.SHOT_DIR) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-talk-${n}.png` }); }
      await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    }
    expect(Math.min(...gaps)).toBeGreaterThan(1.0);
    await expectNoScriptError(page);
  } finally { await request.post('/api/test/roster', { data: { on: false } }); }
  await who.context.close();
});

// v1.10.218 사진 (SHOT_DIR only; 총괄 「대화 때 주민이 등을 보여요」 -- 가람·꽃님·물결·콩이·고은 walking on 2026-11-13, then 한들·
// 꽃님·물결·고은 at their quest spots): each talked to, seen by the talk's own camera (3인칭: beside me) and face to face (1인칭), with how much of the face
// the camera sees (FACE lines); BEFORE=1 against an older server
const tag = () => `${test.info().project.name}-${process.env.BEFORE ? 'before' : 'after'}`;

test('사진: 대화 중 주민 앞·옆 모습', async ({ browser, request, isMobile }) => {
  test.skip(!process.env.SHOT_DIR, 'SHOT_DIR only');
  test.setTimeout(600000);
  await request.post('/api/test/roster', { data: { on: true, day: '2026-11-13' } });
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  const who = await shopper(browser, request, isMobile ? '대화얼굴m' : '대화얼굴', 0, 'female'); const { page } = who;
  const talking = () => page.evaluate(() => /talkMode/.test(document.getElementById('plazaDialog').className));
  try {
    await set('time', 'day'); await set('weather', 'clear');
    for (const view of ['third', 'first']) {
      await page.evaluate((v) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', v); }, view);
      await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); await page.waitForTimeout(3000);
      for (const n of [9, 10, 11, 14, 15, 'handeul', 'kkotnim', 'mulgyeol', 'goeun']) {
        const tryTalk = typeof n === 'string' /* (at their quest spots) */
          ? async () => { const p = (await page.evaluate(() => window.PlazaDebug().residentPosts())).find((x) => x.resident === n); if (!p) return; await page.evaluate((d) => { const g = window.PlazaDebug(); g.teleport(d.x + 0.9, d.z + 0.9); g.setCamYaw(Math.atan2(0.9, 0.9)); }, p); await page.waitForTimeout(600); await spaceOn(page, '', isMobile); }
          : () => page.evaluate((k) => window.PlazaDebug().talkResident(k), n);
        await expect.poll(async () => { if (await talking()) return true; await tryTalk(); await page.waitForTimeout(1500); return talking(); }, { timeout: 30000 }).toBe(true).catch(async () => console.log(`NOTALK ${tag()} ${view} ${n} ${JSON.stringify(await page.evaluate(() => window.PlazaDebug().residentPosts()))}`));
        await page.waitForTimeout(1500);
        console.log(`FACE ${tag()} ${view} ${n} ${JSON.stringify(await page.evaluate(() => window.PlazaDebug().faceSeen?.() ?? null))}`);
        await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag()}-${view}-${n}.png` });
        await page.keyboard.press('Escape'); await page.waitForTimeout(800);
      }
    }
  } finally { await set('time', 'auto'); await set('weather', 'auto'); await request.post('/api/test/roster', { data: { on: false } }); }
  await who.context.close();
});

