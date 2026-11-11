const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.264 주민 표정 (gamecenter-notes docs/emotes-20261107.md 5~6절, assets 102): an islander standing in front of me (within
// 4 m) answers my 「엄지」 -- it turns to me, plays ThumbsUp, its own happy eyes and grinning mouth on its Head bone with its
// own eyes and mouth hidden, the sparkle over it, a line of its own; then its own face again. The same islander, now and then
// alone: a feeling of its own. Its talk face for a moment. PC (photos: the reaction, 하트 -> 부끄러움, 춤 -> 춤, a talk face, a
// blink). v1.10.287 얼굴이 살아 있게 (docs/face-life-20261108.md): my sleepy eyes blink, a line said moves the mouth, the head turns
// to the one by it.
test('주민 표정: 내 엄지에 앞의 주민이 돌아보고 ThumbsUp + 표정 조각·기호·말, 끝나면 원래 얼굴 / 혼자 감정 / 말할 때 표정', async ({ browser, request, isMobile }) => {
  test.skip(isMobile); test.setTimeout(240000);
  const who = await shopper(browser, request, '주민표정', 40000, 'male'); const { page, token } = who;
  expect((await post(request, '/api/avatar/surgery', token, { part: 'eyes', design: 'sleepy', requestId: require('node:crypto').randomUUID() })).status).toBe(200); /* (v1.10.287: 졸린 반달눈) */
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const life = (n = null) => page.evaluate((x) => window.PlazaDebug().faceLife(x), n);
  // (v1.10.287 1절) sleepy eyes blink too -- they were left out
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wardrobe), { timeout: 60000 }).toContain('wear.eyes_sleepy');
  { const b0 = (await life()).blinks; await expect.poll(async () => (await life()).blinks, { timeout: 15000 }).toBeGreaterThan(b0); }
  if (process.env.THROTTLE) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) }); /* (265 흔들림: CI's slow frames, here) */
  const face = (n) => page.evaluate((x) => window.PlazaDebug().residentFace(x), n);
  const shot = async (name) => { if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-${name}.png` }); };
  const tried = new Set();
  // an islander standing (freed from the island's events), me 2 m from it, facing it; my feeling -> its answer
  const answer = async (feel, photo = null, cam = [1.0, 1.7, -0.5]) => {
    let got = null;
    await expect.poll(async () => {
      await post(request, '/api/test/island/free-residents', token, {});
      const list = await page.evaluate(() => window.PlazaDebug().wanderers.filter((w) => w.visible && !w.held && w.speed < 0.2));
      const w = list.find((x) => !tried.has(x.n)); if (!w) { tried.clear(); return null; }
      tried.add(w.n); if (!(await face(w.n))?.person) return null; // (its model in)
      await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 2, z); window.PlazaDebug().faceTo(x, z); }, [w.x, w.z]); await page.waitForTimeout(700);
      /* (what it shows, sampled in the page every 20 ms for 6 s -- CI's slow frames put the mark past 3 s: the clips, its pieces with its own eyes and mouth hidden, the marks, the line) */
      const watch = page.evaluate((n) => new Promise((ok) => { const D = window.PlazaDebug(); const got = { clips: [], faces: [], marks: [], lines: [], props: [], body: [] }; const add = (k, v) => { if (v != null && v !== '' && !got[k].includes(v)) got[k].push(v); }; const t0 = Date.now(); const id = setInterval(() => { const f = D.residentFace(n); if (f) { add('clips', f.clip); add('props', f.props); add('body', f.body); if (f.parts.length && f.eyesBase === false) add('faces', f.parts.slice().sort().join()); for (const m of f.marks) add('marks', m); add('lines', f.bubble); } if (Date.now() - t0 > 6000) { clearInterval(id); ok(got); } }, 20); }), w.n);
      await page.evaluate(() => window.PlazaDebug().camNear(null)); const r = await page.evaluate((f) => window.PlazaDebug().feel(f), feel); await page.waitForTimeout(250);
      const react = await page.evaluate(() => window.PlazaDebug().lastReact());
      if (r !== true || !react?.move || react.n !== w.n) { await watch; return null; } /* (another islander answered -- the one picked walked on: CI 8.6 s from the list to the thumb) */
      if (photo) { await page.evaluate((c) => window.PlazaDebug().camNear(c ? c : null, [0, 1.45, -2.0]), cam); await page.waitForTimeout(700); await photo(); await page.evaluate(() => window.PlazaDebug().camNear(null)); }
      got = { n: w.n, react, seen: await watch }; return got.n;
    }, { timeout: 90000, intervals: [1200] }).not.toBe(null);
    return got;
  };
  // 엄지 -> ThumbsUp, its happy eyes and grin on its head (its own hidden), the sparkle, its line
  const thumbs = await answer('thumbsup');
  expect(thumbs.react).toMatchObject({ move: 'thumbsup' });
  expect(thumbs.seen.clips).toContain('ThumbsUp'); expect(thumbs.seen.faces).toContain('eyes_x_happy,mouth_x_grin'); expect(thumbs.seen.marks).toContain('sparkle');
  expect(thumbs.seen.lines.some((l) => /최고|너도/.test(l))).toBe(true);
  // (v1.10.280, asset 108) what is in its hand put away during it, its hat, neck, flowers (the `equipment` meshes) never
  expect(thumbs.seen.body).not.toContain(false); if (thumbs.seen.props.length) expect(thumbs.seen.props).toContain(false);
  // the same one again within its 20 s: it only turns its head -- tried in the page at once (265 흔들림: CI's slow tries from here
  // ran past the 20 s, and then it answered again): its own move over, me before it, a feeling each try (인사, 절 by turns)
  expect(await page.evaluate((n) => new Promise((ok) => { const D = window.PlazaDebug(); const t0 = Date.now(); let k = 0;
    const tryOnce = () => { if (Date.now() - t0 > 12000) { ok(D.lastReact()); return; } const f = D.residentFace(n); if (!f || f.run) { setTimeout(tryOnce, 200); return; }
      D.teleport(f.at.x + 2, f.at.z); D.faceTo(f.at.x, f.at.z); setTimeout(() => { k += 1; D.feel(k % 2 ? 'wave' : 'bow'); const r = D.lastReact(); if (r?.head) ok(r); else setTimeout(tryOnce, 300); }, 400); };
    tryOnce(); }), thumbs.n)).toEqual({ head: true });
  await expect.poll(async () => { const f = await face(thumbs.n); return [f.run, f.parts, f.eyesBase, f.mouthBase]; }, { timeout: 6000 }).toEqual([null, [], true, true]); // (its own face again)
  // alone: a feeling of its own now and then (here at once)
  await expect.poll(async () => { /* (once it stands, its line's bubble gone, within 30 m of the camera -- me by it each try) */
    const w = (await page.evaluate(() => window.PlazaDebug().wanderers)).find((x) => x.n === thumbs.n); await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 3, z); window.PlazaDebug().faceTo(x, z); }, [w.x, w.z]);
    await page.evaluate((n) => window.PlazaDebug().idleNow(n), thumbs.n); await page.waitForTimeout(300); return (await face(thumbs.n)).idle || '';
  }, { timeout: 60000, intervals: [1000] }).toMatch(/^(laugh|wave|yawn|shrug)$/);
  // what it says: its face a moment (a greeting -- happy and laughing), then its own; and a blink (photo)
  await expect.poll(() => page.evaluate((n) => window.PlazaDebug().talkFace(n, { eyes: 'happy', mouth: 'laugh' }, 2500), thumbs.n), { timeout: 10000, intervals: [300] }).toBe(true); /* (once its own feeling is over) */
  await expect.poll(async () => (await face(thumbs.n)).parts.slice().sort(), { timeout: 3000 }).toEqual(['eyes_x_happy', 'mouth_x_laugh']);
  await expect.poll(async () => (await face(thumbs.n)).parts, { timeout: 5000 }).toEqual([]);
  // (v1.10.287 2절) a line said: its mouth to 「o」 and back for the line's length, then its own; (3절) me 3 m by it -- its head turned to me
  { const w = (await page.evaluate(() => window.PlazaDebug().wanderers)).find((x) => x.n === thumbs.n); await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 3, z); }, [w.x, w.z]); await page.waitForTimeout(500); }
  await expect.poll(() => page.evaluate((n) => new Promise((ok) => { const D = window.PlazaDebug(); const f0 = D.faceLife(n).flaps; const t0 = Date.now(); D.sayAs(n, '오늘 바람이 참 시원하네요!'); const id = setInterval(() => { const f = D.faceLife(n); const on = f.talking && f.flaps > f0; if (on || Date.now() - t0 > 3000) { clearInterval(id); ok(on); } }, 20); }), thumbs.n), { timeout: 15000, intervals: [300] }).toBe(true); /* (CI: a page round trip ~1 s, the line's mouth 0.9 s -- seen in the page; 검토 docs/resident-faces-46-20261111.md) */
  await expect.poll(async () => (await life(thumbs.n)).talking, { timeout: 6000 }).toBe(false); await expect.poll(async () => (await face(thumbs.n)).parts, { timeout: 3000 }).toEqual([]);
  await expect.poll(async () => { /* (v1.10.289 CI: each try me 2.5 m from where it stands now -- it walks on, or has a feeling of its own) */
    await post(request, '/api/test/island/free-residents', token, {}); const at = (await face(thumbs.n)).at; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 2.5, z), [at.x, at.z]); await page.waitForTimeout(900);
    const f = await life(thumbs.n); return Boolean(f.want) && Math.abs(f.look?.yaw || 0) + Math.abs(f.look?.pitch || 0) > 0.05; }, { timeout: 40000, intervals: [500] }).toBe(true);
  // photos (총괄 #414: the pieces over a muzzle, a beak and a face -- at the play camera's distance, where depth is coarser):
  // 봄이·하람·콩이 laughing, me 2.8 m before each along the way it looks, the camera as in play
  if (process.env.SHOT_DIR) for (const person of ['bomi', 'haram', 'kongi', 'bitna', 'garam']) { /* (빛나·가람, v1.10.280: neck, hat and bag kept) */
    const n = await page.evaluate((p) => { const D = window.PlazaDebug(); for (let k = 0; k < window.IslandCast.RESIDENTS.length; k += 1) if (D.residentFace(k)?.person === p) return k; return null; }, person);
    if (n == null) { console.log(`PHOTO_SKIP ${person}: no model`); continue; }
    { const at = (await face(n)).at; await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 3, z); }, [at.x, at.z]); await page.waitForTimeout(800); } /* (drawn only within 85 m of me) */
    if (!(await face(n)).visible) { console.log(`PHOTO_SKIP ${person}: not out on the island now`); continue; }
    /* (my 웃음: it turns to me and laughs -- its own happy eyes and laughing mouth; the camera 1.2 m behind me, ~3.7 m from its face) */
    await page.waitForTimeout(1100); const f = await face(n);
    await page.evaluate(([x, z, yaw]) => { const D = window.PlazaDebug(); D.teleport(x + Math.sin(yaw) * 2.5, z + Math.cos(yaw) * 2.5); D.faceTo(x, z); }, [f.at.x, f.at.z, f.yaw]); await page.waitForTimeout(500);
    await page.evaluate(() => window.PlazaDebug().feel('laugh')); const r = await page.evaluate(() => window.PlazaDebug().lastReact());
    if (r?.n !== n) { console.log(`PHOTO_SKIP ${person}: did not answer (${JSON.stringify(r)})`); continue; }
    await page.evaluate(() => window.PlazaDebug().camNear([2.3, 1.9, -0.2], [0, 1.5, -2.5])); await page.waitForTimeout(800); /* (beside me, out of my head's way, ~3.3 m from its face) */ await shot(`resident-laugh-${person}`); await page.evaluate(() => window.PlazaDebug().camNear(null));
  }
  // photos: 하트 -> 부끄러움 (not yet close) close by, 춤 -> 춤 at the play camera (3~4 m), each on another islander
  if (process.env.SHOT_DIR) for (const [feel, name, cam] of [['heart', 'resident-heart', [1.0, 1.7, -0.5]], ['dance', 'resident-dance', null]]) {
    await page.waitForTimeout(1100);
    const r = await answer(feel, () => shot(name), cam); expect(feel === 'heart' ? ['shy'] : ['dance', 'clap']).toContain(r.react.move); /* (a rainy or night island claps along) */
  }
  await expectNoScriptError(page); await who.context.close();
});
