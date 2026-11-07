const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.264 주민 표정 (gamecenter-notes docs/emotes-20261107.md 5~6절, assets 102): an islander standing in front of me (within
// 4 m) answers my 「엄지」 -- it turns to me, plays ThumbsUp, its own happy eyes and grinning mouth on its Head bone with its
// own eyes and mouth hidden, the sparkle over it, a line of its own; then its own face again. The same islander, now and then
// alone: a feeling of its own. Its talk face for a moment. PC (photos: the reaction, 하트 -> 부끄러움, 춤 -> 춤, a talk face, a
// blink).
test('주민 표정: 내 엄지에 앞의 주민이 돌아보고 ThumbsUp + 표정 조각·기호·말, 끝나면 원래 얼굴 / 혼자 감정 / 말할 때 표정', async ({ browser, request, isMobile }) => {
  test.skip(isMobile); test.setTimeout(240000);
  const who = await shopper(browser, request, '주민표정', 0, 'male'); const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const face = (n) => page.evaluate((x) => window.PlazaDebug().residentFace(x), n);
  const shot = async (name) => { if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-${name}.png` }); };
  const tried = new Set();
  // an islander standing (freed from the island's events), me 2 m from it, facing it; my feeling -> its answer
  const answer = async (feel, photo = null) => {
    let got = null;
    await expect.poll(async () => {
      await post(request, '/api/test/island/free-residents', token, {});
      const list = await page.evaluate(() => window.PlazaDebug().wanderers.filter((w) => w.visible && !w.held && w.speed < 0.2));
      const w = list.find((x) => !tried.has(x.n)); if (!w) { tried.clear(); return null; }
      tried.add(w.n); if (!(await face(w.n))?.person) return null; // (its model in)
      await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 2, z); window.PlazaDebug().faceTo(x, z); }, [w.x, w.z]); await page.waitForTimeout(700);
      /* (what it shows, sampled in the page every 20 ms for 3 s: the clips, its pieces with its own eyes and mouth hidden, the marks, the line) */
      const watch = page.evaluate((n) => new Promise((ok) => { const D = window.PlazaDebug(); const got = { clips: [], faces: [], marks: [], lines: [] }; const add = (k, v) => { if (v && !got[k].includes(v)) got[k].push(v); }; const t0 = Date.now(); const id = setInterval(() => { const f = D.residentFace(n); if (f) { add('clips', f.clip); if (f.parts.length && f.eyesBase === false) add('faces', f.parts.slice().sort().join()); for (const m of f.marks) add('marks', m); add('lines', f.bubble); } if (Date.now() - t0 > 3000) { clearInterval(id); ok(got); } }, 20); }), w.n);
      await page.evaluate(() => window.PlazaDebug().camNear(null)); const r = await page.evaluate((f) => window.PlazaDebug().feel(f), feel); await page.waitForTimeout(250);
      const react = await page.evaluate(() => window.PlazaDebug().lastReact());
      if (r !== true || !react?.move) { await watch; return null; }
      if (photo) { await page.evaluate(() => window.PlazaDebug().camNear([1.0, 1.7, -0.5], [0, 1.45, -2.0])); await page.waitForTimeout(700); await photo(); await page.evaluate(() => window.PlazaDebug().camNear(null)); }
      got = { n: w.n, react, seen: await watch }; return got.n;
    }, { timeout: 90000, intervals: [1200] }).not.toBe(null);
    return got;
  };
  // 엄지 -> ThumbsUp, its happy eyes and grin on its head (its own hidden), the sparkle, its line
  const thumbs = await answer('thumbsup');
  expect(thumbs.react).toMatchObject({ move: 'thumbsup' });
  expect(thumbs.seen.clips).toContain('ThumbsUp'); expect(thumbs.seen.faces).toContain('eyes_x_happy,mouth_x_grin'); expect(thumbs.seen.marks).toContain('sparkle');
  expect(thumbs.seen.lines.some((l) => /최고|너도/.test(l))).toBe(true);
  await expect.poll(async () => { const f = await face(thumbs.n); return [f.run, f.parts, f.eyesBase, f.mouthBase]; }, { timeout: 6000 }).toEqual([null, [], true, true]); // (its own face again)
  // the same one again at once: it only turns its head
  let k = 0; /* (it may have walked on meanwhile: in front of it again, a feeling each try -- two kinds, not the same within 1 s) */
  await expect.poll(async () => { await post(request, '/api/test/island/free-residents', token, {}); const w = (await page.evaluate(() => window.PlazaDebug().wanderers)).find((x) => x.n === thumbs.n); await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 2, z); window.PlazaDebug().faceTo(x, z); }, [w.x, w.z]); await page.waitForTimeout(600); k += 1; await page.evaluate((f) => window.PlazaDebug().feel(f), k % 2 ? 'wave' : 'bow'); return page.evaluate(() => window.PlazaDebug().lastReact()); }, { timeout: 15000, intervals: [1200] }).toEqual({ head: true });
  // alone: a feeling of its own now and then (here at once)
  await expect.poll(async () => { /* (once it stands, its line's bubble gone, within 30 m of the camera -- me by it each try) */
    const w = (await page.evaluate(() => window.PlazaDebug().wanderers)).find((x) => x.n === thumbs.n); await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 3, z); window.PlazaDebug().faceTo(x, z); }, [w.x, w.z]);
    await page.evaluate((n) => window.PlazaDebug().idleNow(n), thumbs.n); await page.waitForTimeout(300); return (await face(thumbs.n)).idle || '';
  }, { timeout: 60000, intervals: [1000] }).toMatch(/^(laugh|wave|yawn|shrug)$/);
  // what it says: its face a moment (a greeting -- happy and laughing), then its own; and a blink (photo)
  await expect.poll(() => page.evaluate((n) => window.PlazaDebug().talkFace(n, { eyes: 'happy', mouth: 'laugh' }, 2500), thumbs.n), { timeout: 10000, intervals: [300] }).toBe(true); /* (once its own feeling is over) */
  await expect.poll(async () => (await face(thumbs.n)).parts.slice().sort(), { timeout: 3000 }).toEqual(['eyes_x_happy', 'mouth_x_laugh']);
  const front = async () => { const f = await face(thumbs.n); await page.evaluate(([x, z, yaw]) => { const D = window.PlazaDebug(); D.teleport(x + Math.sin(yaw) * 2.2, z + Math.cos(yaw) * 2.2); D.faceTo(x, z); D.camNear([0.35, 1.65, -0.8], [0, 1.45, -2.2]); }, [f.at.x, f.at.z, f.yaw]); await page.waitForTimeout(250); }; /* (photos: before its face, along the way it looks) */
  if (process.env.SHOT_DIR) { await front(); await shot('resident-talk-face'); }
  await expect.poll(async () => (await face(thumbs.n)).parts, { timeout: 5000 }).toEqual([]);
  if (process.env.SHOT_DIR) { await page.evaluate((n) => window.PlazaDebug().talkFace(n, { eyes: 'blink' }, 2500), thumbs.n); await front(); await shot('resident-blink'); }
  await page.evaluate(() => window.PlazaDebug().camNear(null));
  // photos: 하트 -> 부끄러움 (not yet close) and 춤 -> 춤, each on another islander
  if (process.env.SHOT_DIR) for (const [feel, name] of [['heart', 'resident-heart'], ['dance', 'resident-dance']]) {
    await page.waitForTimeout(1100);
    const r = await answer(feel, () => shot(name)); expect(feel === 'heart' ? ['shy'] : ['dance', 'clap']).toContain(r.react.move); /* (a rainy or night island claps along) */
  }
  await expectNoScriptError(page); await who.context.close();
});
