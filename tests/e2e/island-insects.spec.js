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
  // (CI #324: in October a 사탕 주머니 on the grass by the spot took SPACE -- 「사탕 주머니 · 줍기」, never the swing, every try:
  // the island's events, read fresh each try, kept out of the server's reach (lib/island-events REACH 3) of the spot too)
  let events = [];
  const eventsNow = async () => (await get(request, '/api/test/island/events', a.token)).data.events || [];
  const by = (list, t, rs = [1.2, 1.5, 1.8]) => { for (const r of rs) for (let k = 0; k < 12; k += 1) { const x = t.x + Math.cos(k / 2) * r; const z = t.z + Math.sin(k / 2) * r; if (T.walkable(x, z) && T.walkDist(x, z) > 0.5 && !T.natureSolids().some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.5) && list.every((o) => o.id === t.id || Math.hypot(o.x - x, o.z - z) > r + 0.5) && events.every((e) => Math.hypot(e.x - x, e.z - z) > 3.2)) return { x, z }; } return null; };
  const pick = (list, not = null) => { const t = list.find((o) => o.id !== not && by(list, o)); return t && { ...t, spot: by(list, t) }; };
  // the same insects on both screens (the server's layout, as it is now)
  expect((await insectsNow()).length).toBeGreaterThan(3); expect((await get(request, '/api/island/insects', a.token)).data.next).toBeGreaterThan(0);
  await expect.poll(async () => { const ids = (await insectsNow()).map((o) => o.id).sort().join(); return (await b.page.evaluate(() => window.PlazaDebug().insectList())).sort().join() === ids; }, { timeout: 20000 }).toBe(true);
  // no net: it says so (and the prompt is a plain line)
  expect((await post(request, '/api/island/insect/catch', a.token, { id: pick(await insectsNow()).id })).data.error).toBe('NO_BUGNET');
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
  await page.keyboard.press('KeyI'); await page.locator('.islandBagSlot[data-item="bugnet"]').click(); await page.locator('#islandBagGrid button', { hasText: '들기' }).first().click(); /* (v1.10.195: the slot picked, its bubble) */ // (3회차 22: the net in hand -- SPACE swings it)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe('bugnet');
  // too far: no
  let target = pick(await insectsNow());
  expect((await post(request, '/api/island/insect/catch', a.token, { id: target.id })).data.error).toBe('TOO_FAR');
  // walked up to: SPACE catches it -- the bag, the 도감, gone on the other screen
  await standAt(request, a, target.spot.x, target.spot.z);
  // (CI: the insect flew or crawled out of reach between the hint read here and the tap; stood by the page's drawn places
  // the server then said TOO_FAR (run 39702592847). Each try: the server's places now -- another insect when that one is
  // gone (a new layout) -- its spot, SPACE (the phone: the hint) only when that insect is what it reaches -- in one call --
  // and the server's answer; again until it is 200)
  let last = null; let caught = null; let missed = false;
  // (CI #278: a flyer went out of the swing's fan in the 450 ms before the net comes down on the slow runner, every try --
  // the crawlers and those on a trunk first, as island-tool-swing, and another one after a miss)
  const slow = (b) => (/^dragonfly/.test(b.species) ? 2 : /^butterfly|firefly/.test(b.species) ? 1 : 0);
  // (CI #325: the page's frames seconds long -- the catch's answer (200) came after a try's 5 s wait, the next try then went
  // for another insect, every try: an answer from the page is kept whenever it comes)
  const answers = []; page.on('response', (r) => { if (r.url().includes('/api/island/insect/catch')) answers.push(r); });
  await expect.poll(async () => {
    const late = answers.find((r) => r.status() === 200);
    if (late) { caught = JSON.parse(await late.text()); target = { ...target, id: late.request().postDataJSON()?.id || caught.id }; return 200; }
    events = await eventsNow();
    const now = await insectsNow(); const t = now.find((o) => o.id === target.id);
    if (missed || slow(target) > 0) { const next = pick([...now].sort((p, q) => slow(p) - slow(q)), missed ? target.id : null); if (next) target = next; missed = false; }
    else if (!t || !by(now, t)) { const next = pick(now); if (!next) return (last = 'no insect with a spot'); last = `${target.id} ${t ? 'no spot' : 'gone'} -> ${next.id}`; target = next; }
    const at = by(now, target); if (!at) return (last = `${target.id} no spot`);
    await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [at.x, at.z]); await page.waitForTimeout(400);
    // (3회차 22: the net swung -- a 1.5 m fan before me, round where the insect is drawn: under a metre from that, facing it)
    const drawn = await page.evaluate((id) => window.PlazaDebug().insectsDrawn().find((b) => b.id === id), target.id); if (!drawn) return (last = 'not drawn');
    const here = { ...target, x: drawn.x, z: drawn.z };
    const close = by(now.map((o) => (o.id === target.id ? here : o)), here, [0.8]) || by([here], here, [0.6, 0.8, 1.0]); // (another insect near: the swing takes the nearest in its fan -- the answer says which)
    if (!close) { missed = true; return (last = `${target.id} no spot near the drawn insect`); } // (CI #298: that one, every try for 40 s -- another one next)
    await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [close.x, close.z]);
    const answer = page.waitForResponse((r) => r.url().includes('/api/island/insect/catch'), { timeout: 10000 }) /* (CI #362: a slow runner's page took ~4.5 s from SPACE to the catch) */.catch(() => null);
    await page.evaluate((id) => { const d = window.PlazaDebug(); const b = d.insectsDrawn().find((q) => q.id === id); if (b) d.faceTo(b.x, b.z); }, target.id);
    if (!(await spaceOn(page, 'tool:swing', isMobile))) { last = await page.locator('#plazaHint').textContent(); return last; }
    const r = await answer; const text = r ? await r.text().catch(() => '') : ''; last = r ? `${r.status()} ${text}` : `no answer ${target.species} ${JSON.stringify(await page.evaluate(() => window.PlazaDebug().lastSwing()))}`; missed = !r;
    if (r?.status() === 200) { caught = JSON.parse(text); const id = r.request().postDataJSON()?.id; if (id) target = { ...target, id }; } // (the one the swing took)
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
