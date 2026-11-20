const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError, spaceOn, holdTool } = require('./skin-support');

// 1.10.355 캐기 미니게임 다듬기 (gamecenter-notes docs/island-expansion-20261115.md 「캐기 미니게임 다듬기」), the phone's part -- the
// quarry's PC flow is plaza.spec's (PC only): on a phone the big 「⛏ 캐기」 presses the crack that is lit, the three pips over the
// rock, the other prompts away while it runs; two hits and the ore at once (the server's own timed hits), the stick back after
test('채석장 폰: 큰 「캐기」 단추로 빛나는 금을 눌러 두 번 맞히면 바로 광석, 바위 위 세 칸', async ({ browser, request, isMobile }) => {
  test.skip(!isMobile, '폰 전용 (PC는 plaza.spec 채석장)'); test.setTimeout(150000);
  const Q = require('../../public/plaza/island-quarry.js'); const Items = require('../../lib/island-items');
  const { page, token } = await shopper(browser, request, '채석장폰광부', 0, 'female');
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const rock = Q.ROCKS[3 + test.info().retry]; const s = Q.standOf(rock, 'full', 0); /* (a retry: its own full rock) */
  await post(request, '/api/test/island/give', token, { itemId: 'pickaxe', qty: 1 });
  /* (385 총괄 #536: CI's phone at a few frames a second could let a whole 1.3 s light pass between two looks -- a test's light of 1.8 s from 0.1 s) */
  await post(request, '/api/test/quarry/plan', token, { plan: [{ spot: 1, at: 100, light: 1800 }, { spot: 3, at: 100, light: 1800 }, { spot: 2, at: 100, light: 1800 }], draw: 0.1 });
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [s.x, s.z]);
  await holdTool(page, 'pickaxe');
  // the button at the first chance while each light is on (by the game's own clock, as the scene judges it -- not a slow frame's drawing). (384
  // 총괄 #534: one timer at the light's middle fired 1~2 s late on CI's phone at a few frames a second -- past the light; looked at every 25 ms instead.
  // 385 총괄 #536: set before the game comes up -- set after the checks below, round 0's light was mostly gone (1.4 s in here, all of it on CI))
  await page.evaluate(() => { const Q = window.IslandQuarry; window.__qp = { looks: [], pressed: [] }; let g = null; let done = null; let last = performance.now();
    const tick = setInterval(() => { const now = performance.now(); window.__qp.looks.push(Math.round(now - last)); last = now;
      if (!g) { g = window.PlazaDebug().mine(); if (!g) return; done = g.plan.map(() => false); window.__qp.lateStart = Math.round(now - g.t0);
        const shows = (sel) => { const e = document.querySelector(sel); if (!e) return false; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
        window.__qp.atStart = { pad: g.pad, pips: g.pips, dig: shows('.mineDig'), stick: shows('#islandStick'), hint: shows('#plazaHint') }; /* (the game as it came up -- before any press) */ }
      const pad = document.querySelector('.mineDig'); const ms = now - g.t0; const k = Math.floor(ms / Q.ROUND_MS); const r = g.plan[k]; if (!r || !pad) { clearInterval(tick); return; } const local = ms - k * Q.ROUND_MS;
      if (!done[k] && local >= r.at + 40 && local <= r.at + r.light + Q.GRACE_MS - 60) { done[k] = true; window.__qp.pressed.push([k, Math.round(local - r.at)]); pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch' })); } }, 25); });
  await expect.poll(() => spaceOn(page, `quarry:${rock.id}:0`, true), { timeout: 20000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.__qp.atStart)), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => window.__qp.atStart)).toEqual({ pad: true, pips: '○○○', dig: true, stick: false, hint: false }); /* (the big 「캐기」, three pips, the stick and other prompts away) */
  const name = Items.ITEMS[`ore_${rock.ore}`].name; await expect(page.locator('#toast')).toContainText('+1', { timeout: 30000 });
  { /* (385 총괄 #536: what each side saw, printed every run -- the page's looks (ms apart) and presses [round, ms after the light], its own judging, and the server's) */
    const seen = await page.evaluate(() => { const g = window.PlazaDebug().mine(); const looks = window.__qp?.looks || []; return { pressed: window.__qp?.pressed, looksMax: Math.max(0, ...looks), looksN: looks.length, words: window.IslandFeel.shown().map((w) => w.text), taps: g?.taps || null, toast: document.querySelector('#toast')?.textContent }; });
    const server = (await get(request, '/api/test/quarry/last', token)).data; console.log(`[quarry-phone] page ${JSON.stringify(seen)} server ${JSON.stringify(server && { shownAfter: server.shownAt && server.shownAt - server.at, presses: (server.presses || []).map((p) => p && { ms: p.ms, arrive: p.arrive - server.at }), taps: server.taps, judged: server.judged, plan: server.plan })}`); }
  await expect(page.locator('#toast')).toContainText(`${name} +1`, { timeout: 5000 }); /* (379: no day's count in it; the piece drawn from every grade now. 384: the ore's name -- 「작은 돌 +1」 of a missed set is not it) */
  expect(await page.evaluate(() => window.IslandFeel.shown().filter((w) => w.text === '쨍!' || w.text === '완벽!').length)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.mineDig')).toHaveCount(0); await expect(page.locator('#islandStick')).toBeVisible(); /* (the game gone, the stick back) */
  const bag = (await get(request, '/api/island/bag', token)).data; expect((bag.items || []).filter((e) => e.itemId === `ore_${rock.ore}`).reduce((n, e) => n + e.qty, 0)).toBe(1);
  await expectNoScriptError(page);
});
