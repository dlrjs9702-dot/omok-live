const { test, expect } = require('@playwright/test');
const { shopper, get, post, standAt, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');
const Together = require('../../lib/island-together');

// 묶음 5 보이는 곤충 (gamecenter-notes docs/insects-visible-20261020.md): the insects are out on the island where they live,
// the same ones for everyone; walked up to with a 잠자리채, SPACE (the phone: the hint) catches one into the bag and the
// 도감 and it is gone on every screen; run at, it flies off for everyone; at the museum's door a kind is given once for
// the whole island with my name. PC and phone.
test('보이는 곤충: 모두에게 같은 곤충, 걸어서 다가가 잡으면 가방·도감·다른 화면에서도 사라짐, 달아남, 박물관 기증', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const a = await shopper(browser, request, isMobile ? '곤충박사m' : '곤충박사', 0, 'male');
  const b = await shopper(browser, request, isMobile ? '곤충구경m' : '곤충구경', 0, 'female');
  for (const who of [a, b]) { await who.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); }
  const { page } = a;
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  // the same insects on both screens (the server's layout)
  const list = (await get(request, '/api/island/insects', a.token)).data;
  expect(list.list.length).toBeGreaterThan(3); expect(list.next).toBeGreaterThan(0);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().insectList().length), { timeout: 20000 }).toBe(list.list.length);
  // a free spot to stand by each (on the ground, off the trees)
  const besides = (bug) => { for (const r of [1.4, 1.8]) for (let k = 0; k < 12; k += 1) { const x = bug.x + Math.cos(k / 2) * r; const z = bug.z + Math.sin(k / 2) * r; if (T.walkable(x, z) && T.walkDist(x, z) > 0.5 && !T.natureSolids().some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.5)) return { x, z }; } return null; };
  const [target, other] = list.list.filter((x) => besides(x)).slice(0, 2);
  // no net: it says so (and the prompt is a plain line)
  expect((await post(request, '/api/island/insect/catch', a.token, { id: target.id })).data.error).toBe('NO_BUGNET');
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
  await page.keyboard.press('KeyI'); await page.keyboard.press('Escape'); // (the bag looked at: the page knows the net)
  // too far: no
  expect((await post(request, '/api/island/insect/catch', a.token, { id: target.id })).data.error).toBe('TOO_FAR');
  // walked up to: SPACE catches it -- the bag, the 도감, gone on the other screen
  const spot = besides(target); await standAt(request, a, spot.x, spot.z);
  await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [spot.x, spot.z]); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 40000, intervals: [300] }).toContain(`잡기 · ${target.name}`);
  const caught = page.waitForResponse((r) => r.url().includes('/api/island/insect/catch')); await press();
  expect((await caught).status()).toBe(200);
  const itemId = `insect_${target.species}`;
  await expect.poll(async () => (await get(request, '/api/island/bag', a.token)).data.items.some((e) => e.itemId === itemId), { timeout: 10000 }).toBe(true);
  expect((await get(request, '/api/island/dex', a.token)).data.entries.find((e) => e.id === itemId).count).toBeGreaterThan(0);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().insectList().includes(id), target.id), { timeout: 15000 }).toBe(false);
  expect((await post(request, '/api/island/insect/catch', a.token, { id: target.id })).status).toBe(200); // (the same catch again: the same answer)
  // run at (the server is told by the page): off it goes, for everyone
  const near = besides(other); await standAt(request, a, near.x, near.z);
  expect((await post(request, '/api/island/insect/scare', a.token, { id: other.id })).status).toBe(200);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().insectList().includes(id), other.id), { timeout: 15000 }).toBe(false);
  expect((await post(request, '/api/island/insect/catch', a.token, { id: other.id })).data.error).toBe('BUG_GONE');
  // 박물관: not away from its door; once per kind, with my name
  expect((await post(request, '/api/island/museum/donate', a.token, { itemId })).status).toBe(409);
  const door = Together.museumDoor(T.MUSEUM); await standAt(request, a, door.x, door.z);
  expect((await post(request, '/api/island/museum/donate', a.token, { itemId: 'bugnet' })).status).toBe(400);
  const before = (await get(request, '/api/island/museum', a.token)).data.exhibits.find((x) => x.id === itemId).by; // (the island's museum: an earlier run may have given this kind)
  const given = await post(request, '/api/island/museum/donate', a.token, { itemId });
  if (before) expect(given.data.error).toBe('ALREADY_SHOWN');
  else { expect(given.status).toBe(200); expect((await get(request, '/api/island/museum', a.token)).data.exhibits.find((x) => x.id === itemId).by).toBe(isMobile ? '곤충박사m' : '곤충박사'); }
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});
