const { test, expect } = require('@playwright/test');
const { shopper, get, post, standAt, expectNoScriptError, spaceOn } = require('./skin-support');
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
  // CI 3차 후속: the layout is the server's 10 minutes' (lib/island-insects EPOCH_MS) -- and again when the day's seasons,
  // the night or the rain change -- so an insect picked at the start was gone by the catch when a new layout came in
  // between (KST midnight: main and locally, 'last: gone'), and one picked by a free spot ignoring the other insects had
  // none once they were counted ('no spot'). Each pick is from the server's list now, by the spot the catch stands on.
  const insectsNow = async () => (await get(request, '/api/island/insects', a.token)).data.list || [];
  // a free spot by an insect (on the ground, off the trees) with every other insect half a metre farther than it -- so
  // SPACE reaches that one (CI 3차: a snail crawling by the 매미 took it for 40 s, run 39699233302)
  const by = (list, t) => { for (const r of [1.2, 1.5, 1.8]) for (let k = 0; k < 12; k += 1) { const x = t.x + Math.cos(k / 2) * r; const z = t.z + Math.sin(k / 2) * r; if (T.walkable(x, z) && T.walkDist(x, z) > 0.5 && !T.natureSolids().some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.5) && list.every((o) => o.id === t.id || Math.hypot(o.x - x, o.z - z) > r + 0.5)) return { x, z }; } return null; };
  const pick = (list, not = null) => { const t = list.find((o) => o.id !== not && by(list, o)); return t && { ...t, spot: by(list, t) }; };
  // the same insects on both screens (the server's layout, as it is now)
  expect((await insectsNow()).length).toBeGreaterThan(3); expect((await get(request, '/api/island/insects', a.token)).data.next).toBeGreaterThan(0);
  await expect.poll(async () => { const ids = (await insectsNow()).map((o) => o.id).sort().join(); return (await b.page.evaluate(() => window.PlazaDebug().insectList())).sort().join() === ids; }, { timeout: 20000 }).toBe(true);
  // no net: it says so (and the prompt is a plain line)
  expect((await post(request, '/api/island/insect/catch', a.token, { id: pick(await insectsNow()).id })).data.error).toBe('NO_BUGNET');
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
  await page.keyboard.press('KeyI'); await page.keyboard.press('Escape'); // (the bag looked at: the page knows the net)
  // too far: no
  let target = pick(await insectsNow());
  expect((await post(request, '/api/island/insect/catch', a.token, { id: target.id })).data.error).toBe('TOO_FAR');
  // walked up to: SPACE catches it -- the bag, the 도감, gone on the other screen
  await standAt(request, a, target.spot.x, target.spot.z);
  // (CI: the insect flew or crawled out of reach between the hint read here and the tap; stood by the page's drawn places
  // the server then said TOO_FAR (run 39702592847). Each try: the server's places now -- another insect when that one is
  // gone (a new layout) -- its spot, SPACE (the phone: the hint) only when that insect is what it reaches -- in one call --
  // and the server's answer; again until it is 200)
  let last = null; let caught = null;
  await expect.poll(async () => {
    const now = await insectsNow(); const t = now.find((o) => o.id === target.id);
    if (!t || !by(now, t)) { const next = pick(now); if (!next) return (last = 'no insect with a spot'); last = `${target.id} ${t ? 'no spot' : 'gone'} -> ${next.id}`; target = next; }
    const at = by(now, target);
    await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [at.x, at.z]); await page.waitForTimeout(400);
    const answer = page.waitForResponse((r) => r.url().includes('/api/island/insect/catch'), { timeout: 10000 }).catch(() => null);
    if (!(await spaceOn(page, `insect:${target.id}`, isMobile))) { last = await page.locator('#plazaHint').textContent(); return last; }
    const r = await answer; const text = r ? await r.text().catch(() => '') : ''; last = r ? `${r.status()} ${text}` : 'no answer';
    if (r?.status() === 200) caught = JSON.parse(text);
    return r?.status() ?? 'no answer';
  }, { timeout: 40000, intervals: [300] }).toBe(200).catch((error) => { error.message += `\nlast: ${last}`; throw error; });
  expect((await post(request, '/api/island/insect/catch', a.token, { id: target.id })).data).toEqual(caught); // (the same catch again: the same answer)
  const itemId = `insect_${caught.species}`; // (the species the server gave: a layout redone for the day's seasons keeps the places, not always the kinds)
  await expect.poll(async () => (await get(request, '/api/island/bag', a.token)).data.items.some((e) => e.itemId === itemId), { timeout: 10000 }).toBe(true);
  expect((await get(request, '/api/island/dex', a.token)).data.entries.find((e) => e.id === itemId).count).toBeGreaterThan(0);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().insectList().includes(id), target.id), { timeout: 15000 }).toBe(false);
  // run at (the server is told by the page): off it goes, for everyone
  const other = pick(await insectsNow(), target.id); await standAt(request, a, other.spot.x, other.spot.z);
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
