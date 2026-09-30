const { expect } = require('@playwright/test');

// Shared helpers of the skin e2e specs (v1.7.35+): real browsers for the people being looked at, API for the rest.
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let ipCounter = 0;
const uniqueIp = () => `100.72.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function post(request, route, token, data) {
  const response = await request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) }, data: data ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function get(request, route, token) {
  const response = await request.get(route, { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function adminToken(request) {
  return (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
}

// A guest with an account in a real browser page (lobby), and the points to shop with.
async function shopper(browser, request, label, points = 0) {
  const admin = await adminToken(request);
  const issued = (await post(request, '/api/admin/keys', admin, { label })).data;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  const person = { context, page, token, id: issued.key.id, admin };
  if (points) await grant(request, person, points);
  return person;
}

async function grant(request, person, amount) {
  for (let left = amount; left > 0; left -= 10_000_000) {
    const step = Math.min(left, 10_000_000);
    const res = await post(request, `/api/admin/keys/${person.id}/points`, person.admin, { requestId: crypto.randomUUID(), category: 'event', amount: step });
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
