const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError, spaceOn } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// 문제 기록 3회차 22 「낚싯대·잠자리채를 들면 손에 장착, 상호작용 키로 휘두르기 — 앞에 곤충이 있으면 잡히고, 주민이 있으면 맞고
// 화내게」: the net taken from the bag is in hand; SPACE (the phone: the hint) swings it -- a bug in front is caught into
// the bag, an islander in front is struck (HitReact, then cross words over the head). PC and phone.
test('도구 휘두르기: 가방에서 잠자리채 들기, 앞의 곤충은 잡히고 앞의 주민은 맞고 화냄', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, isMobile ? '채휘두름m' : '채휘두름', 0, 'male'); const { page } = a;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running).catch(() => false), { timeout: 90000 }).toBe(true);
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
  // from the bag: 들기
  await page.keyboard.press('KeyI');
  await page.locator('#islandBagGrid button', { hasText: '들기' }).first().click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe('bugnet');
  // (사용자 2026-10-26 「채 머리가 얼굴을 파고들고 휘두르기가 작아」) carried low and ahead -- the hoop well off the head, ahead,
  // not out to the side (6회차 9) -- standing and walking; swung with the clip's own angle: a wide arc again
  await page.evaluate(() => window.PlazaWarp(30, 0));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().toolTip()), { timeout: 20000 }).not.toBeNull();
  const carried = async (how) => { const t = await page.evaluate(() => window.PlazaDebug().toolTip()); const d = t.hoop.map((v, k) => v - t.hand[k]); const n = Math.hypot(...d);
    expect(Math.hypot(...t.hoop.map((v, k) => v - t.head[k])), `${how}: 고리와 머리`).toBeGreaterThan(0.75); expect(Math.abs(d[0] / n), `${how}: 옆`).toBeLessThan(0.6); expect(d[2] / n, `${how}: 앞`).toBeGreaterThan(0.6); };
  await page.waitForTimeout(500); await carried('서기');
  if (!isMobile) { await page.locator('#plazaStage').focus(); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(600); await carried('걷기'); await page.keyboard.up('ArrowUp'); }
  // (CI #306: the hoop's sweep counted frame by frame missed its ends on a slow runner -- the hand's angle instead: turned to
  // NetSwing's own while it swings, back to carrying after)
  const turned = await page.evaluate(() => new Promise((done) => { const d = window.PlazaDebug(); let most = 0; d.swingNow(); const t0 = performance.now(); const tick = () => { most = Math.max(most, d.toolTip().turn); if (performance.now() - t0 < 800) requestAnimationFrame(tick); else done(most); }; requestAnimationFrame(tick); }));
  expect(turned, '휘두를 때 손 안 각도(들 때와의 차)').toBeGreaterThan(1.2);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().toolTip().turn), { timeout: 5000 }).toBeLessThan(0.05);
  // an insect (where it is drawn now -- flying, crawling or on a trunk): stepped up to under a metre off, facing it, SPACE
  // -- caught (the server's answer 200); it may have moved off in the swing: again
  const by = (x0, z0, r) => { for (let k = 0; k < 12; k += 1) { const x = x0 + Math.cos(k / 2) * r; const z = z0 + Math.sin(k / 2) * r; if (T.walkable(x, z) && T.walkDist(x, z) > 0.5 && !T.natureSolids().some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.3)) return { x, z }; } return null; };
  let last = null; let tries = 0; const answers = [];
  page.on('response', async (r) => { if (r.url().includes('/api/island/insect/catch')) answers.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 60)}`); });
  await expect.poll(async () => {
    const slow = (b) => (/^dragonfly/.test(b.species) ? 2 : /^butterfly|firefly/.test(b.species) ? 1 : 0); // (the crawlers and those on a trunk first)
    const list = ((await get(request, '/api/island/insects', a.token)).data.list || []).filter((b) => by(b.x, b.z, 1.8)).sort((p, q) => slow(p) - slow(q)); if (!list.length) return (last = 'no insect');
    const t = list[tries++ % Math.min(4, list.length)]; // (each try the next one: one out of sight or flown off is not tried for ever)
    const near = by(t.x, t.z, 1.8); await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [near.x, near.z]); await page.waitForTimeout(500);
    const drawnAt = () => page.evaluate((id) => window.PlazaDebug().insectsDrawn().find((b) => b.id === id), t.id);
    let drawn = await drawnAt(); if (!drawn) return (last = 'not drawn');
    const at = by(drawn.x, drawn.z, 0.8) || near; await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [at.x, at.z]);
    drawn = await drawnAt(); if (!drawn) return (last = 'flown off');
    await page.evaluate(([bx, bz]) => window.PlazaDebug().faceTo(bx, bz), [drawn.x, drawn.z]); // (where it is now, just before the swing)
    const answer = page.waitForResponse((r) => r.url().includes('/api/island/insect/catch'), { timeout: 5000 }).catch(() => null);
    if (!(await spaceOn(page, 'tool:swing', isMobile))) return (last = await page.locator('#plazaHint').textContent());
    const r = await answer; last = r ? `${r.status()} ${await r.text().catch(() => '')}` : `no answer ${JSON.stringify(await page.evaluate(() => window.PlazaDebug().lastSwing()))}`; await page.waitForTimeout(900); return r?.status() ?? 'no answer';
  }, { timeout: 60000, intervals: [500] }).toBe(200).catch((error) => { error.message += `\nlast: ${last}\nanswers: ${answers.join(' | ')}`; throw error; });
  await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [T.SPAWN.x, T.SPAWN.z]); await page.waitForTimeout(1000); // (back among the islanders)
  // an islander right in front: struck -- HitReact, then cross words over the head
  const swingTries = [];
  await expect.poll(async () => {
    const all = await page.evaluate(() => window.PlazaDebug().wanderersAt());
    if (!all.length) { await page.evaluate(async () => { const w = window.PlazaDebug().wanderersAt(true)[0]; if (w) await window.PlazaWarp(w.x, w.z + 3); }); return 'no islander'; } // (R3: in the evening and at night they gather elsewhere -- go to them)
    // (CI #307: one walking off during the 0.45 s swing is a miss, as it should be -- one standing still is struck)
    const still = all.filter((w) => !w.moving); if (!still.length) return 'all walking';
    const m = still[tries++ % still.length]; // (by a door, the door comes first: the next one)
    for (let k = 0; k < 12; k += 1) {
      const x = m.x + Math.cos(k / 2) * 0.9; const z = m.z + Math.sin(k / 2) * 0.9; if (!T.walkable(x, z)) continue;
      await page.evaluate(async ([x, z, mx, mz]) => { await window.PlazaWarp(x, z); window.PlazaDebug().faceTo(mx, mz); }, [x, z, m.x, m.z]); break;
    }
    // (CI, #305: a walking islander was a step off by the swing on a slow runner -- 'missed' for a minute, twice; as with the
    // insects: where it is now, just before the swing)
    const now = await page.evaluate((n) => { const d = window.PlazaDebug(); const w = d.wanderersAt(true).find((o) => o.n === n); return w && { ...w, d: Math.hypot(w.x - d.x, w.z - d.z) }; }, m.n);
    if (!now || now.d > 1.3) return 'moved off'; // (out of reach: the next try)
    await page.evaluate(([x, z]) => window.PlazaDebug().faceTo(x, z), [now.x, now.z]);
    // (CI #315: a slow runner's 0.45 s swing ended after a fixed 0.7 s wait -- the swing itself is waited for (its own
    // start time), then the cross word of the one it met; what it met is told when it misses)
    const before = await page.evaluate(() => window.PlazaDebug().lastSwing()?.t ?? null);
    if (!(await spaceOn(page, 'tool:swing', isMobile))) { const near = await page.evaluate(() => window.PlazaDebug().near); swingTries.push(`no swing (near ${near}, n${m.n} ${now.d.toFixed(2)} m)`); return 'no swing'; } // (CI #318: twice 60 s of this -- what took the SPACE is kept)
    let swing = null; await expect.poll(async () => { swing = await page.evaluate(() => window.PlazaDebug().lastSwing()); return swing?.t ?? null; }, { timeout: 10000 }).not.toBe(before);
    if (swing.hit?.resident == null) return `missed ${JSON.stringify(swing)}`;
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().struck())).some((s) => s.n === swing.hit.resident && s.bubble), { timeout: 5000 }).toBe(true);
    return 'struck';
  }, { timeout: 60000, intervals: [1000] }).toBe('struck').catch((error) => { error.message += `\ntries: ${swingTries.slice(-8).join(' | ')}`; throw error; });
  // put away: no swing
  await page.keyboard.press('KeyI'); await page.locator('#islandBagGrid button', { hasText: '넣기' }).first().click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe(null);
  await expectNoScriptError(page); await a.context.close();
});
