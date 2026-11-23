const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// B 47 반려동물: one bought at the 잡화점 walks behind me with its name (Walk while it catches up, Sit when I sit), the
// others see it too; put away, it is gone everywhere. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

// (CI 2차 단축: the second half on its own -- the whole was over three minutes on the CI runner) the server keeps the
// pet: a page coming onto the island has it with me from the start, others see it, and put away it is gone everywhere
test('반려동물: 서버가 기억해 섬에 들어오면 처음부터 같이 있고, 집에 두면 모든 화면에서 사라짐', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '고양이주인', 0, 'female');
  const b = await shopper(browser, request, '이웃', 0, 'male');
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'pet_kitten', qty: 1 })).status).toBe(200);
  expect((await post(request, '/api/island/pet', a.token, { kind: 'kitten', name: '나비' })).status).toBe(200); // (what the bag's button sends)
  for (const w of [a, b]) {
    await w.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await w.page.reload();
    await expect.poll(() => w.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  }
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')?.kind), { timeout: 30000 }).toBe('kitten');
  const aId = await a.page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().find((p) => p.key === id)?.name, aId), { timeout: 30000 }).toBe('나비');
  // 1.10.387 펫 태우기 (사용자 결정 26·34, assets 161): on the bike the kitten in its front crate -- its BasketSit -- on both screens; off, it walks again
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bike_red', qty: 1 })).status).toBe(200);
  await a.page.reload(); /* (the bag's bikes as the page starts) */ await expect.poll(() => a.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('KeyB'); await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().cycling), { timeout: 15000 }).toBe('red');
  await expect.poll(() => a.page.evaluate(() => { const p = window.PlazaDebug().pets().find((x) => x.key === 'me'); return p && `${p.role} ${p.clip}`; }), { timeout: 20000 }).toBe('basket BasketSit');
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().find((p) => p.key === id)?.role, aId), { timeout: 30000 }).toBe('basket');
  { const [me, pet] = await a.page.evaluate(() => { const d = window.PlazaDebug(); return [{ x: d.x, z: d.z }, d.pets().find((x) => x.key === 'me')]; }); expect(Math.hypot(pet.x - me.x, pet.z - me.z)).toBeLessThan(1.2); } /* (in the crate before the rider) */
  /* (assets 181, 사용자 「다리, 팔에서 불꽃 효과를 넣고 날아오게 해」: Iron Man by a stopped bike hovers with his four jets lit; riding on, he flies
     (FlyRepulsor), tipped by the pace -- upright slow, lying flatter fast) */
  expect((await post(request, '/api/test/pet', a.token, { kind: 'tf_ironman', name: '' })).status).toBe(200);
  await expect.poll(() => a.page.evaluate(() => { const p = window.PlazaDebug().pets().find((x) => x.key === 'me'); return p && `${p.role} ${p.clip} ${p.jets}`; }), { timeout: 30000 }).toBe('flyR Hover true');
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.down('KeyW');
  /* (its clip by its pace as measured -- CI's slow frames ride the bike at under 1.5 m/s, where it rightly hovers: moving, jets lit, and FlyRepulsor
     at 2 m/s and over, Hover under 1.5) */
  await expect.poll(() => a.page.evaluate(() => { const p = window.PlazaDebug().pets().find((x) => x.key === 'me'); return p && `${p.speed > 0.3} ${p.jets} ${p.clip === (p.speed >= 2 ? 'FlyRepulsor' : p.speed < 1.5 ? 'Hover' : p.clip)}`; }), { timeout: 15000 }).toBe('true true true');
  await a.page.keyboard.up('KeyW');
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('KeyB'); await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().cycling), { timeout: 15000 }).toBe(null);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().pets().find((x) => x.key === 'me')?.role), { timeout: 20000 }).toBe('follow');
  /* (1.10.396, 검토 notes pet-unnamed-invisible-20261121 · Codex 381~390 #15: a pet with no name -- '' from the server, null kept -- was made again
     every frame and never drawn; now it settles and stands, Idle, on the other screen too) */
  expect((await post(request, '/api/test/pet', a.token, { kind: 'kitten', name: '' })).status).toBe(200);
  await expect.poll(() => a.page.evaluate(() => { const p = window.PlazaDebug().pets().find((x) => x.key === 'me'); return p ? `${p.name || ''}|${p.clip}` : null; }), { timeout: 20000 }).toBe('|Idle');
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().find((p) => p.key === id)?.clip, aId), { timeout: 30000 }).toBe('Idle');
  expect((await post(request, '/api/island/pet', a.token, { kind: null })).status).toBe(200);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().pets().some((p) => p.key === id), aId), { timeout: 30000 }).toBe(false);
  for (const w of [a, b]) await expectNoScriptError(w.page);
  for (const w of [a, b]) await w.context.close();
});
