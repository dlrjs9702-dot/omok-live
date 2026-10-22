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
  await expect.poll(async () => {
    const all = await page.evaluate(() => window.PlazaDebug().wanderersAt()); if (!all.length) return 'no islander';
    const m = all[tries++ % all.length]; // (by a door, the door comes first: the next one)
    for (let k = 0; k < 12; k += 1) {
      const x = m.x + Math.cos(k / 2) * 0.9; const z = m.z + Math.sin(k / 2) * 0.9; if (!T.walkable(x, z)) continue;
      await page.evaluate(async ([x, z, mx, mz]) => { await window.PlazaWarp(x, z); window.PlazaDebug().faceTo(mx, mz); }, [x, z, m.x, m.z]); break;
    }
    await page.waitForTimeout(200);
    if (!(await spaceOn(page, 'tool:swing', isMobile))) return 'no swing';
    await page.waitForTimeout(700);
    return (await page.evaluate(() => window.PlazaDebug().struck()))[0]?.bubble ? 'struck' : 'missed';
  }, { timeout: 60000, intervals: [1000] }).toBe('struck');
  // put away: no swing
  await page.keyboard.press('KeyI'); await page.locator('#islandBagGrid button', { hasText: '넣기' }).first().click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe(null);
  await expectNoScriptError(page); await a.context.close();
});
