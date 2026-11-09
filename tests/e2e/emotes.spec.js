const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');

// v1.10.263 감정 표현 (gamecenter-notes docs/emotes-20261107.md 8절): T held -> the wheel -> 웃음 where the mouse points, let go ->
// my act emote:laugh, the happy eyes and laughing mouth over mine, the note over my head, my own face again after; on
// another's screen the same feeling with its face and mark; T tapped stays open for a click -- a dance, ended by walking; my
// everyday blink. PC (the phone's 😊 grid: mobile-island.spec; none while fishing: river-fishing.spec).
test('감정 표현: T 바퀴 → 웃음 → 몸짓·표정·기호, 끝나면 원래 얼굴, 다른 사람 화면에도 / 톡 → 클릭으로 춤, 걸으면 끝 / 깜박임', async ({ browser, request, isMobile }) => {
  test.skip(isMobile); test.setTimeout(180000);
  const a = await shopper(browser, request, '웃는이', 0, 'male'); const b = await shopper(browser, request, '보는이', 0, 'female');
  for (const who of [a, b]) { await who.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); }
  const { page } = a; const feeling = (p, who = null) => p.evaluate((w) => window.PlazaDebug().feeling(w), who);
  await expect.poll(async () => (await feeling(page))?.shown.length || 0, { timeout: 60000 }).toBeGreaterThan(0); // (my model and face in)
  let own = null; /* (taken when not mid-blink -- in the same read) */
  await expect.poll(async () => { const s = (await feeling(page)).shown.sort(); if (!s.some((x) => x.includes('_x_'))) own = s; return own !== null; }, { timeout: 10000, intervals: [30] }).toBe(true);
  await expect.poll(() => page.evaluate(() => Object.entries(window.PlazaDebug().assets?.files || {}).filter(([u, s]) => /wear\/(eyes|mouth)_x_[a-z]+\.glb$/.test(u) && s === 'loaded').length), { timeout: 30000 }).toBe(12); // (the 12 expression parts fetched early)
  const at = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z }));
  await b.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 2.5, z + 1.5), [at.x, at.z]);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().others.length), { timeout: 20000 }).toBeGreaterThan(0);
  await expect.poll(() => b.page.evaluate(() => { const D = window.PlazaDebug(); const o = D.others[0]; return Boolean(o && D.feeling(o.id)?.clip && Math.hypot(o.x - D.x, o.z - D.z) < 6); }), { timeout: 60000 }).toBe(true); /* (v1.10.288 CI: on a slow page my model and place there before the feeling -- else it ran there with no move, face or mark) */
  // T held, the mouse on 웃음, let go
  await page.locator('#plazaStage').focus(); await page.keyboard.down('t'); await expect(page.locator('#emoteWheel')).toBeVisible(); await expect(page.locator('#emoteWheel')).not.toHaveClass(/grid/);
  const laugh = page.locator('.emoteCell[data-emote="laugh"]'); const cell = await laugh.boundingBox(); await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
  await expect(laugh).toHaveClass(/hot/); await page.waitForTimeout(250);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-wheel.png` });
  /* (watched in the page from before the key comes up: the face is on 1.4 s only -- a slow test's polls can miss it) */
  const mine = page.evaluate(() => new Promise((ok) => { const D = window.PlazaDebug(); const got = {}; const t0 = Date.now(); const id = setInterval(() => { const f = D.feeling(); if (f.id === 'laugh') got.run = [f.act, f.clip]; if (f.shown.slice().sort().join() === 'wear.eyes_x_happy,wear.mouth_x_laugh') got.face = true; if (f.marks.includes('note')) got.mark = true; if ((got.face && got.mark && got.run) || Date.now() - t0 > 6000) { clearInterval(id); ok(got); } }, 20); }));
  await page.keyboard.up('t'); await expect(page.locator('#emoteWheel')).toBeHidden();
  expect(await mine).toEqual({ run: ['emote:laugh', 'Laugh'], face: true, mark: true }); // (my act and move; the happy eyes and laughing mouth with mine hidden; the note)
  /* (another's screen: the move, the face and the mark -- what the feeling showed there, read after it: v1.10.288 CI, a slow page sampled it too late) */
  await expect.poll(() => b.page.evaluate(() => { const D = window.PlazaDebug(); for (const o of D.others) { const f = D.feeling(o.id)?.felt; if (f?.id === 'laugh' && f.face?.includes('wear.eyes_x_happy') && f.marks.includes('note')) return f; } return null; }), { timeout: 30000 }).toMatchObject({ id: 'laugh', clip: 'Laugh' });
  await expect.poll(async () => { const f = await feeling(page); return [f.id, f.act, f.face, f.shown.sort()]; }, { timeout: 5000 }).toEqual([null, null, null, own]); // (mine again)
  if (process.env.SHOT_DIR) await b.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 9, z + 6), [at.x, at.z]); /* (out of the close-ups) */
  if (process.env.SHOT_DIR) for (const id of ['laugh', 'cry', 'surprise', 'heart']) { /* (photos: the face and its mark close, held) */
    await page.evaluate((x) => window.PlazaDebug().facePose(x), id); await expect.poll(async () => (await feeling(page)).shown.some((s) => s.includes('_x_')), { timeout: 5000 }).toBe(true);
    await page.evaluate(() => window.PlazaDebug().camNear([0.6, 2.5, -4.4], [0, 2.35, 0])); await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-face-${id}.png` });
    await page.evaluate(() => { window.PlazaDebug().facePose(null); window.PlazaDebug().camNear(null); });
  }
  // T tapped: open for a click -- 춤, until I walk
  await page.waitForTimeout(1100); expect(await feeling(page)).toMatchObject({ blocked: false }); await page.locator('#plazaStage').focus(); await page.keyboard.press('t'); await expect(page.locator('#emoteWheel')).toBeVisible(); await page.waitForTimeout(300); await expect(page.locator('#emoteWheel')).toBeVisible();
  // (v1.10.270, CI 266·270: the dance's clip not there in 3 s -- given longer; a miss says what was there and which
  // character models were not in)
  await page.locator('.emoteCell[data-emote="dance"]').click(); await expect(page.locator('#emoteWheel')).toBeHidden();
  await expect.poll(() => feeling(page), { timeout: 10000 }).toMatchObject({ id: 'dance', act: 'emote:dance', clip: 'Dance' })
    .catch(async (error) => { error.message += `\n그때 감정: ${JSON.stringify(await feeling(page))} · 안 들어온 모델: ${JSON.stringify(await page.evaluate(() => Object.entries(window.PlazaDebug().assets?.shown || {}).filter(([k, v]) => /^character\./.test(k) && v !== 'model').map(([k, v]) => `${k}=${v}`)))}`; throw error; });
  await page.waitForTimeout(4500); expect(await feeling(page)).toMatchObject({ id: 'dance' }); // (round and round)
  await page.locator('#plazaStage').focus(); await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w'); /* (W walks; the arrows turn the view) */
  await expect.poll(async () => (await feeling(page)).id, { timeout: 3000 }).toBe(null);
  // Esc closes the wheel; and my blink comes now and then
  await page.keyboard.press('t'); await expect(page.locator('#emoteWheel')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('#emoteWheel')).toBeHidden();
  await expect.poll(async () => (await feeling(page)).blinks, { timeout: 15000 }).toBeGreaterThan(0);
  await expectNoScriptError(page); await expectNoScriptError(b.page);
  await a.context.close(); await b.context.close();
});
