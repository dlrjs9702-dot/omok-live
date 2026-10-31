const { test, expect } = require('@playwright/test');
const { shopper } = require('./skin-support');

// v1.10.213 주민 27명 모습 (총괄: 고유 모델 10 → 27, High 3만 삼각형씩 -- 폰 성능을 전·후로): on the plaza where the
// islanders are seen, the real models, then a few seconds of frames -- frame time, draw calls, triangles, memory, how
// many islanders are near and how many of their models show the High. Only when PERF=1 (a measurement, not a check):
//   PERF=1 npx playwright test tests/e2e/resident-perf.spec.js --workers=1
// (v1.10.216 근무표 C2: ROSTER=1 -- the table on, that day's walkers out (about 15 of the 27); without it the ten)
test('주민 성능 측정: 광장 프레임·draw call·메모리·High/Low', async ({ browser, request, isMobile }) => {
  test.skip(!process.env.PERF, 'PERF=1 only');
  test.setTimeout(240000);
  if (process.env.ROSTER) { await request.post('/api/test/roster', { data: { on: true } }); test.info().annotations.push({ type: 'roster', description: 'on' }); }
  const who = await shopper(browser, request, isMobile ? '측정m' : '측정', 0, 'female'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const spots = [['plaza', 0, 6, 0], ['plaza-wide', 0, 18, 0]];
  const out = {};
  for (const [name, x, z, yaw] of spots) {
    await page.evaluate(([x, z, yaw]) => { const d = window.PlazaDebug(); d.teleport(x, z); d.setCamYaw(yaw); }, [x, z, yaw]);
    await page.waitForTimeout(12000); // (the models in, the islanders walking)
    out[name] = await page.evaluate(() => new Promise((resolve) => {
      const times = []; let last = performance.now(); const end = last + 5000;
      const step = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else done(); };
      const done = () => {
        const d = window.PlazaDebug(); const sorted = [...times].sort((a, b) => a - b); const avg = times.reduce((n, v) => n + v, 0) / times.length;
        const near = (d.wanderers || []).filter((w) => w.visible !== false && Math.hypot(w.x - d.x, w.z - d.z) < 40).length;
        resolve({ frames: times.length, avgMs: +avg.toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), fps: +(1000 / avg).toFixed(1),
          calls: d.render?.calls, triangles: d.render?.triangles, geometries: d.render?.geometries, textures: d.render?.textures,
          heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, islandersNear: near, wearLod: d.wearLod?.() || null });
      };
      requestAnimationFrame(step);
    }));
  }
  // far ones Low, near one High: by a walking islander, then 60 m off
  const lod = async (near) => { await page.evaluate((near) => { const d = window.PlazaDebug(); const w = d.wanderers[0]; d.teleport(w.x + (near ? 1.5 : 60), w.z); }, near); await page.waitForTimeout(1500); return page.evaluate(() => window.PlazaDebug().wearLod()); };
  out.lod = { near: await lod(true), far: await lod(false) };
  expect(out.lod.near.high).toBeGreaterThan(out.lod.far.high); // (the one beside me High, gone Low again away)
  console.log(`PERF ${test.info().project.name} ${process.env.PERF_TAG || ''} ${JSON.stringify(out)}`);
  await who.context.close();
  if (process.env.ROSTER) await request.post('/api/test/roster', { data: { on: false } });
});
