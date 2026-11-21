// 1.10.340 택시 비켜 가기 (notes taxi-yield 133A; review-plan §4 「반투명 통과 때 탄 사람과 밖 사람 화면이 같은지 e2e 하나」): someone
// standing on the road at a crossing -- after 1 s 「빵!」 and 「비켜 주세요~」 over the car, after 3 s no room aside there, so it
// goes by see-through, slowly; the rider's screen and theirs have it in the same place, see-through on both; solid again once past.
// PC only (the cars are the same on a phone -- island-taxi-server.test.js has the rules).
const { test, expect } = require('@playwright/test');
const { shopper, grant, post } = require('./skin-support');

test('섬 택시 비켜 가기: 건널목에 선 사람 → 빵·비켜 주세요 → 반투명으로 천천히 통과(두 화면 같은 자리) → 지나가면 불투명', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 전용 검증'); test.setTimeout(240000);
  const a = await shopper(browser, request, '비켜탄이', 0, 'female'); const b = await shopper(browser, request, '건널목선이', 0, 'male');
  await grant(request, a, 100000); expect((await post(request, '/api/test/taxi-run', a.token, { ms: 0 })).status).toBe(200); /* (the real road) */
  try {
    for (const who of [a, b]) { await who.page.evaluate(() => { localStorage.removeItem('gc.testClassic'); }); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); await who.page.evaluate(() => window.PlazaDebug().holdQuality(0)); /* (검토 notes taxi-yield-flake-20261121: the automatic quality tier stepping down on a slow screen rebuilt 23~25 shaders and froze it 3~5 s just as the car came by -- held, as island-assets.spec does) */ }
    const X = require('../../public/plaza/island-taxi.js'); const s = X.stopOf('plaza'); const spot = X.CROSSINGS[1]; /* (the road at the crossing by the hall's walk -- T1: by 배 타는 곳, the road moved off (0.3, -6.7)) */
    await b.page.evaluate(([x, z]) => window.PlazaWarp(x, z), [spot.x, spot.z]);
    const { page } = a;
    await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [s.out.x, s.out.z]); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 30000 }).toContain(X.STOPS.plaza.sign);
    await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
    await page.locator('#plazaDialog #taxiRideBtn').click();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().train().taxi.ride?.from)).toBe('plaza');
    const car = (p) => p.evaluate(() => (window.PlazaDebug().taxiCars() || [])[0] || null); /* (1.10.391 N4-a: the cars out, by car id -- one ride, the one car out) */
    // 빵 and 비켜 주세요, on the one in its way's screen
    await expect.poll(async () => { const c = await car(b.page); return Boolean(c?.horn && c?.ask); }, { timeout: 40000, intervals: [100] }).toBe(true); /* (b warped once and left still: a warp is a new place on the server -- the wait starts over) */
    // see-through on both screens, in the same place
    /* (one look at both screens: see-through on both, creeping, in the same place -- 1.10.392: in its right-hand lane it is by them sooner, so the three are
       read together, not one after another) */
    await expect.poll(async () => { const [ca, cb] = await Promise.all([car(page), car(b.page)]); return Boolean(ca?.ghost && cb?.ghost && ca.rate < 0.3 && Math.hypot(ca.x - cb.x, ca.z - cb.z) < 1.5); }, { timeout: 45000, intervals: [100] }) /* (a car seeing them far off stands short first, then creeps up: the 3 s from its last stop) */.toBe(true);
    // past them: solid again, and on at its pace
    await expect.poll(async () => { const c = await car(page); return c ? !c.ghost && c.rate > 0.9 : true; }, { timeout: 30000 }).toBe(true);
  } finally { await post(request, '/api/test/taxi-run', a.token, { ms: 3000 }); await b.context.close(); await a.context.close(); }
});
