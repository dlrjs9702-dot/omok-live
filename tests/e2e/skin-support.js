const { expect } = require('@playwright/test');

// Shared helpers of the skin e2e specs (v1.7.35+): real browsers for the people being looked at, API for the rest.
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let ipCounter = 0;
const uniqueIp = () => `100.72.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

// CI 3차 (my-home mobile 「socket hang up」): the server closes a connection idle 5 s (Node's keepAliveTimeout) and a request
// sent on it at that moment is reset unread -- sent again once on a new one, as a browser does (maxRetries: ECONNRESET only)
async function post(request, route, token, data) {
  const response = await request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) }, data: data ?? {}, maxRetries: 1 });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function get(request, route, token) {
  const response = await request.get(route, { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) }, maxRetries: 1 });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

let cachedAdmin = null; // one operator login per worker: many specs create throwaway accounts and must not exhaust the login rate limit
async function adminToken(request) {
  if (!cachedAdmin) cachedAdmin = (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  return cachedAdmin;
}

// A guest with an account in a real browser page (lobby), and the points to shop with.
async function shopper(browser, request, label, points = 0, gender = 'male', prepareContext = null) {
  const admin = await adminToken(request);
  let issued = (await post(request, '/api/admin/keys', admin, { label })).data;
  // a long run (a 40-minute shard) outlives the cached admin session (30 minutes without input): log in again
  if (!issued.html) { cachedAdmin = null; issued = (await post(request, '/api/admin/keys', await adminToken(request), { label })).data; }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (prepareContext) await prepareContext(context);
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  const person = { context, page, token, id: issued.key.id, admin };
  if (points) await grant(request, person, points);
  // v1.10.3: test accounts have already chosen their character, so the island opens without the first-visit choice
  if (gender) await post(request, '/api/avatar/gender', token, { gender });
  // v1.10.14: the game starts after the resource pack is ready; scripted clicks before that would race the lobby opening
  await page.locator('#lobbyView').waitFor({ state: 'visible' });
  return person;
}

async function grant(request, person, amount) {
  for (let left = amount; left > 0; left -= 10_000_000) {
    const step = Math.min(left, 10_000_000);
    const res = await post(request, '/api/test/points-credit', person.token, { amount: step });
    expect(res.status).toBe(200);
  }
}

async function buyAndEquip(request, person, skinIds) {
  for (const skinId of skinIds) {
    const bought = await post(request, '/api/skins/buy', person.token, { skinId });
    expect(bought.status, JSON.stringify(bought.data)).toBe(200);
    expect((await post(request, '/api/skins/equip', person.token, { skinId })).status).toBe(200);
  }
}

// Mean luminance contrast of a skin's two identities drawn by SkinLooks.paintStone on a transparent canvas:
// light side vs dark side, (Lw + .05) / (Lb + .05). The catalog promises at least 4:1.
async function stoneContrast(page, skinId, dark = 'black', light = 'white') {
  return page.evaluate(([id, darkSide, lightSide]) => {
    const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    const mean = (side) => {
      const c = document.createElement('canvas'); c.width = 120; c.height = 120;
      const x = c.getContext('2d'); x.translate(60, 60); window.SkinLooks.paintStone(x, 40, id, side);
      const d = x.getImageData(0, 0, 120, 120).data; let sum = 0; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { sum += .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); n += 1; }
      return n ? sum / n : 0;
    };
    const lw = mean(lightSide); const lb = mean(darkSide);
    return (lw + .05) / (lb + .05);
  }, [skinId, dark, light]);
}

module.exports = { post, get, adminToken, shopper, grant, buyAndEquip, stoneContrast, uniqueIp };

// Two shoppers in one room (a = first/black seat, b = second/white seat), both pages reloaded into the room.
async function twoPlayerRoom(request, a, b, gameType) {
  const created = await post(request, '/api/rooms', a.token, { gameType });
  expect(created.status).toBe(201);
  expect((await post(request, '/api/rooms/join', b.token, { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await post(request, '/api/room/choose-role', a.token, { choice: 'black' })).status).toBe(200);
  expect((await post(request, '/api/room/choose-role', b.token, { choice: 'white' })).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#roomView')).toBeVisible({ timeout: 20000 }); }
}

// Pixels of a square around (px, py) of the #board canvas: a key to compare across pages, and how many pixels carry colour.
const cropOf = (page, px, py, half = 20) => page.evaluate(([x, y, hf]) => {
  const d = document.getElementById('board').getContext('2d').getImageData(Math.round(x) - hf, Math.round(y) - hf, hf * 2, hf * 2).data;
  let chroma = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) chroma += 1;
  return { key: Array.from(d).join(','), chroma };
}, [px, py, half]);

const pixelOf = (page, px, py) => page.evaluate(([x, y]) => {
  const d = document.getElementById('board').getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]];
}, [px, py]);

// Poll until both pages draw the same thing around (px, py) and it carries colour (i.e. it is not the classic piece).
async function expectSameCrop(pages, px, py, minChroma = 20) {
  await expect.poll(async () => {
    const crops = [];
    for (const page of pages) crops.push(await cropOf(page, px, py));
    return crops.every(c => c.key === crops[0].key) && crops[0].chroma > minChroma;
  }, { timeout: 9000 }).toBe(true);
}

module.exports = { ...module.exports, twoPlayerRoom, cropOf, pixelOf, expectSameCrop };

// A script error inside a render shows up as a toast ("... is not a function"); a room screen must never show one.
async function expectNoScriptError(page) {
  await expect(page.locator('#toast')).not.toContainText(/is not a function|is not defined|undefined|Cannot read/);
}
module.exports.expectNoScriptError = expectNoScriptError;
// CI 3차: SPACE (a phone: a tap on the hint) on the island when what it reaches (PlazaDebug().near) starts with `prefix` --
// read and pressed in one call. Read, then pressed by the keyboard, there were frames between (a second or more on the CI
// runner): an islander walking by took the SPACE (운반·전달 「줍기」 at plaza.spec 1179, 앉기·인사 「인사」), a pet walked off
// out of reach, a sector's spot gave way to the next. false: something else is nearest.
// (3회차 4) the bite's arrows, pressed in order: the arrow keys (a PC) or the four buttons (a phone)
async function pressFishArrows(page, isMobile = false) {
  const box = page.locator('#fishArrows'); await box.waitFor({ state: 'visible', timeout: 15000 });
  const dirs = await box.locator('.fishArrowSeq span').evaluateAll((spans) => spans.map((s) => s.dataset.dir));
  const KEY = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
  // (pressed in the page at once -- CI #278: a phone's clicks waited for the box coming in to stand still, a PC's key presses
  // a round trip each on the slow runner, and the bite's time ran out between them -- the server's, which a test that
  // turns the bite into another fish times by that fish, not the count shown. The buttons answer a click, the keys a keydown)
  if (isMobile) await box.evaluate((el, dirs) => { for (const dir of dirs) el.querySelector(`.fishArrowPad button[data-dir=${dir}]`).click(); }, dirs);
  else await page.evaluate(([dirs, KEY]) => { for (const dir of dirs) window.dispatchEvent(new KeyboardEvent('keydown', { code: KEY[dir], key: KEY[dir], bubbles: true })); }, [dirs, KEY]);
  return dirs.length;
}
async function spaceOn(page, prefix, isMobile = false) {
  return page.evaluate(([prefix, isMobile]) => {
    if (!window.PlazaDebug()?.near?.startsWith(prefix)) return false;
    if (isMobile) { document.getElementById('plazaHint').click(); return true; }
    const stage = document.getElementById('plazaStage'); stage.focus();
    for (const type of ['keydown', 'keyup']) stage.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    return true;
  }, [prefix, isMobile]);
}
module.exports.spaceOn = spaceOn;
module.exports.pressFishArrows = pressFishArrows;
// v1.10.93: stand at a spot of the 백화점's room (local lx, lz) until its prompt shows -- on a slow runner the walk-in can
// still put me at the door after a first teleport
async function standInMall(page, lx, lz, text) {
  await expect.poll(async () => { await page.evaluate(([lx, lz]) => { const w = window.IslandStore.world(lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [lx, lz]); await page.waitForTimeout(600); return page.locator('#plazaHint').textContent(); }, { timeout: 30000, intervals: [200] }).toContain(text);
}
module.exports.standInMall = standInMall;
// v1.10.92 백화점: the shop street's shops are its sectors -- in through its door (SPACE, or a tap on the hint on a
// phone), then standing at the sector's spot (`place`: the shop's facility id) with its prompt showing
async function intoMall(page, place = null, isMobile = false) {
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  // (on a busy runner the server may set me back from a first teleport, or not have my place yet when I press: to the
  // door and in again until I am inside)
  for (let tries = 0; tries < 4 && await page.evaluate(() => window.PlazaDebug().space) !== 'store'; tries += 1) {
    // (a slow entry from the last try may land me inside meanwhile: then no more door -- placed at it from inside, I would
    // stand at the room's wall with no prompt)
    const inside = () => page.evaluate(() => window.PlazaDebug().space === 'store');
    await expect.poll(async () => { if (await inside()) return '백화점 들어가기'; await page.evaluate(() => window.PlazaDebug().place('store')); await page.waitForTimeout(600); return (await inside()) ? '백화점 들어가기' : page.locator('#plazaHint').textContent(); }, { timeout: 30000 }).toContain('백화점 들어가기');
    if (await inside()) break;
    await spaceOn(page, 'store', isMobile); // (CI 3차: the door read and pressed at once)
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe('store').catch(() => {});
  }
  expect(await page.evaluate(() => window.PlazaDebug().space)).toBe('store');
  if (place) {
    // (the walk-in may still place me at the door after a first teleport on a slow runner: again until the prompt is the sector's)
    const name = await page.evaluate((place) => window.PlazaDebug().doors[place].name, place);
    await expect.poll(async () => { await page.evaluate((place) => { const d = window.PlazaDebug(); const door = d.doors[place]; d.teleport(door.x, door.z); }, place); await page.waitForTimeout(600); return page.locator('#plazaHint').textContent(); }, { timeout: 30000, intervals: [200] }).toContain(name);
  }
  return press;
}
module.exports.intoMall = intoMall;
// v1.10.92: out of the 백화점 again (its door, SPACE), back on the island at its door
async function outOfMall(page) {
  await page.evaluate(() => { const d = window.PlazaDebug(); const door = d.doors['store:exit'] || null; const w = door || window.IslandStore.world(0, -9.1); d.teleport(w.x, w.z); });
  await expect(page.locator('#plazaHint')).toContainText('나가기', { timeout: 10000 });
  // (CI 3차: the exit read and pressed at once, again until out)
  await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().space) === 'island') return 'island'; await spaceOn(page, 'store:exit'); await page.waitForTimeout(1000); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 15000 }).toBe('island');
}
module.exports.outOfMall = outOfMall;

// B 47 시험: put a player at (x, z) on the island and keep them there until both the page and the server say so -- a page
// may send its own older place a moment later (a slow runner), which would undo a single post
async function standAt(request, who, x, z) {
  const near = (p) => p && Math.hypot(p.x - x, p.z - z) < 0.6;
  let last = null;
  for (let i = 0; i < 12; i += 1) {
    await who.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [x, z]);
    let r = await post(request, '/api/plaza/state', who.token, { x, z, yaw: 0, moving: false });
    if (!near(r.data) && r.data) { // (the server never lets one walk through another player: round them, 4 m to the side)
      const side = r.data.z + (i % 2 ? -4 : 4);
      for (const [px, pz] of [[r.data.x, side], [x, side], [x, z]]) { await who.page.evaluate(([px, pz]) => window.PlazaDebug().teleport(px, pz), [px, pz]); r = await post(request, '/api/plaza/state', who.token, { x: px, z: pz, yaw: 0, moving: false }); }
    }
    await who.page.waitForTimeout(600);
    const page = await who.page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
    const again = await post(request, '/api/plaza/state', who.token, { x, z, yaw: 0, moving: false });
    last = { first: r.data && [r.data.x, r.data.z, r.data.corrected], page: [page.x, page.z], again: again.data && [again.data.x, again.data.z, again.data.corrected] };
    if (near(r.data) && near(page) && near(again.data)) return;
  }
  throw new Error(`could not stand at ${x}, ${z}: ${JSON.stringify(last)}`);
}
module.exports.standAt = standAt;
