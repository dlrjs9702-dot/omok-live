const { test, expect } = require('@playwright/test');
const { shopper, standAt, post } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js'); require('../../public/plaza/island-train.js');
const P = require('../../public/plaza/isle2-props.js');

// 1.10.376 N2a-2 별마루섬 호랑이 (lib/island-tigers.js, public/plaza/tigers-view.js): on 별마루섬 우레 comes -- his model and pictures load then,
// his warning (the screen's red edges, 「어흥!」) -- he catches one standing still: two random things off the bag (never the rod), and the
// caught one is in front of 마루 시장님 at the 관공서 with his 「큰일 날 뻔했어요!」 and what was lost
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test('별마루섬 호랑이: 경고, 잡히면 물건 2개를 잃고 시장님 앞으로', async ({ browser, request }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '호랑이', 0, 'male'); const { page } = who;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  for (const [itemId, qty] of [['fishing_rod', 1], ['weed', 5], ['branch', 2]]) expect((await post(request, '/api/test/island/give', who.token, { itemId, qty })).status).toBe(200);
  const s = P.SWAMPS[1]; const spot = { x: s[0] + 18, z: s[1] };
  // the tigers' clock at 9시 (both awake, whenever the test runs); 우레 10 m off, 안개 far away
  const kst = new Date(Date.now() + 9 * 3600000); const shift = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 0, 0, 0) - Date.now();
  try {
    // (1.10.377) at 별마루다리's gate its leaf opens; the two signs' words
    const gate = P.FENCE.find((f) => P.FENCE_KINDS[f[3]] === 'fence_gate');
    await standAt(request, who, gate[0] + Math.sin(gate[2]) * 1.5, gate[1] + Math.cos(gate[2]) * 1.5);
    await expect.poll(() => page.evaluate(() => window.PlazaTigers()?.gateOpen ?? 0), { timeout: 10000 }).toBeGreaterThan(0.8);
    expect(await page.evaluate(() => window.PlazaTigers()?.signs)).toEqual(['별마루섬 자연 구역', P.SIGN_TRAIL[3].join(' / ')]);
    await standAt(request, who, spot.x, spot.z);
    const on = await post(request, '/api/test/tigers', who.token, { on: true, clockShift: shift, place: { id: 'angae', x: T.dalmaru.NEW_ISLE.x + 60, z: T.dalmaru.NEW_ISLE.z - 60 } });
    expect(on.data.on).toBe(true);
    // first out of his sight (45 m) till his file is in, then 10 m off: he comes -- the warning on
    await post(request, '/api/test/tigers', who.token, { place: { id: 'ure', x: spot.x - 45, z: spot.z } });
    await expect.poll(() => page.evaluate(() => window.PlazaTigers()?.shown?.find((t) => t.id === 'ure')?.loaded), { timeout: 60000 }).toBe(true);
    await page.evaluate(() => { window.__zzClips = []; window.__zzClipWatch = setInterval(() => { const c = window.PlazaTigers()?.list?.find((t) => t.id === 'ure')?.clip; if (c && window.__zzClips[window.__zzClips.length - 1] !== c) window.__zzClips.push(c); }, 80); }); /* (382: the clips he plays on the way) */
    await post(request, '/api/test/tigers', who.token, { place: { id: 'ure', x: spot.x - 18, z: spot.z } });
    const caught = page.waitForFunction(() => /잡혔어요/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 60000 });
    await expect.poll(() => page.evaluate(() => window.PlazaTigers()?.warn?.id || null), { timeout: 20000 }).toBe('ure');
    expect(await page.evaluate(() => document.getElementById('tigerWarn')?.classList.contains('on'))).toBe(true);
    // (377) caught: five seconds covered, 「이송 중」 -- then his words
    await expect.poll(() => page.evaluate(() => document.getElementById('tigerTransfer')?.classList.contains('on') ?? false), { timeout: 60000 }).toBe(true);
    expect(await page.evaluate(() => document.querySelector('#tigerTransfer .tigerTransferGo')?.textContent)).toBe('이송 중');
    await caught;
    /* (382 사용자 결정 12, assets 159: one standing still -- caught by one of the attacks the server picks) */
    const clips = await page.evaluate(() => { clearInterval(window.__zzClipWatch); return window.__zzClips; });
    /* (a run's pounce from 4.5 m is one of the patterns too; the Growl after it is not seen here -- caught, I am at the mayor, out of the tigers' frames
       (383 Codex #15); which near attack comes when: test/island-tigers.test.js 「382 공격 고르기」) */
    expect(clips.some((c) => ['Pounce', 'Swipe', 'TurnSwipe', 'TurnSwipeL', 'Lunge'].includes(c)), clips.join(',')).toBe(true);
    expect(await page.evaluate(() => document.getElementById('tigerTransfer').classList.contains('on'))).toBe(false);
    const toast = await page.evaluate(() => document.getElementById('toast').textContent);
    expect(toast).toContain('우레에게 잡혔어요'); expect(toast).toContain('큰일 날 뻔했어요'); expect(toast).toContain('잡초'); expect(toast).toContain('나뭇가지'); expect(toast).not.toContain('낚싯대');
    // in front of the mayor, on my screen and the server's
    const TH = T.TOWNHALL; const m = T.townhallWorld(0, TH.yard.z1 + 3.2);
    await expect.poll(() => page.evaluate(() => { const d = window.PlazaDebug(); return [d.x, d.z]; }).then(([x, z]) => Math.hypot(x - m.x, z - m.z)), { timeout: 10000 }).toBeLessThan(1.5);
    const bag = (await post(request, '/api/test/island/give', who.token, { itemId: 'stone', qty: 1 })).data.bag.items;
    expect(bag.find((e) => e.itemId === 'weed')?.qty).toBe(4); expect(bag.find((e) => e.itemId === 'branch')?.qty).toBe(1); expect(bag.some((e) => e.itemId === 'fishing_rod')).toBe(true);
    // the warning is gone there
    await expect.poll(() => page.evaluate(() => document.getElementById('tigerWarn')?.classList.contains('on') ?? false), { timeout: 10000 }).toBe(false);
    expect(errors).toEqual([]);
  } finally { await post(request, '/api/test/tigers', who.token, { on: false, clockShift: 0 }); await who.context.close(); }
});
