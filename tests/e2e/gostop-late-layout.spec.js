const { test, expect } = require('@playwright/test');

// A3 G2 맞고 한 화면 테이블 (gamecenter-notes docs/gamehall-fix-spec-20261018.md): from the first card to the late hand
// (captures piled up) the opponent, the floor with the deck, my captures and my hand stay on one screen with no scroll,
// on PC (1920×1080, 1366×768) and phone sizes (393×851, 375×667); a go/stop choice sits in a window over the table.
test.skip(({ isMobile }) => isMobile, '창 크기를 직접 바꿔 PC·휴대폰 크기를 모두 본다');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let ipN = 0;
const uip = () => `100.73.${(process.pid + 3) % 250}.${(++ipN + Math.floor(Math.random() * 200)) % 250 + 1}`;
async function call(request, route, token, body, method = 'post') {
  const r = method === 'get'
    ? await request.get(route, { headers: { 'X-Forwarded-For': uip(), ...(token ? { 'X-Session-Token': token } : {}) } })
    : await request.post(route, { headers: { 'X-Forwarded-For': uip(), ...(token ? { 'X-Session-Token': token } : {}) }, data: body ?? {} });
  return { status: r.status(), data: await r.json().catch(() => ({})) };
}
async function guest(browser, request, admin, label, viewport) {
  const { data } = await call(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 640 });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uip() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, token: await page.evaluate(() => document.body.dataset.session) };
}
// one step of whoever's turn it is (both seats over the API); false once the hand is over
async function step(request, tokens, { go = false } = {}) {
  const g = (await call(request, '/api/room', tokens[0], null, 'get')).data.state.game;
  if (g.status !== 'playing') return false;
  const tok = tokens[Number(g.turn) - 1]; const mine = (await call(request, '/api/room', tok, null, 'get')).data.state;
  const phase = mine.game.phase;
  if (phase === 'play') { const card = (mine.me.myGostopHand || []).find((c) => c.legal !== false); await (card ? call(request, '/api/room/gostop-play', tok, { cardId: card.id }) : call(request, '/api/room/gostop-flip', tok, {})); }
  else if (phase === 'choose-floor' || phase === 'choose-flip') await call(request, '/api/room/gostop-choose', tok, { cardId: mine.game.choice.options[0] });
  else if (phase === 'go-stop') { if (!go) return 'go-stop'; await call(request, '/api/room/gostop-decide', tok, { choice: 'stop' }); }
  else if (phase === 'gukjin') await call(request, '/api/room/gostop-gukjin', tok, { asPi: false });
  return true;
}
// a hand that is under way: a deal can end the hand at once (총통 -- four of a month dealt), then the next hand, seats again
async function dealPlaying(request, tokens) {
  for (let tries = 0; tries < 5; tries += 1) {
    expect((await call(request, '/api/room/start-gostop', tokens[0], {})).status).toBe(200);
    if ((await call(request, '/api/room', tokens[0], null, 'get')).data.state.game.status === 'playing') return;
    await expect.poll(async () => (await call(request, '/api/room/next-round', tokens[0], {})).status).toBe(200); // (once the hand is recorded)
    for (let i = 0; i < tokens.length; i += 1) await call(request, '/api/room/choose-role', tokens[i], { choice: String(i + 1) });
  }
  throw new Error('다섯 번 나눠도 판이 시작되지 않음');
}
const bottom = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return b ? b.y + b.height : null; };

for (const [w, h] of [[1920, 1080], [1366, 768], [393, 851], [375, 667]]) {
  test(`맞고 ${w}×${h}: 판 후반까지 손패·내 영역이 한 화면`, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const admin = (await call(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    const me = await guest(browser, request, admin, '나', { width: w, height: h });
    const other = await guest(browser, request, admin, '상대', { width: 800, height: 600 });
    const tokens = [me.token, other.token];
    const code = (await call(request, '/api/rooms', tokens[0], { gameType: 'gostop' })).data.state.me.roomCode;
    await call(request, '/api/rooms/join', tokens[1], { code });
    for (let i = 0; i < 2; i += 1) await call(request, '/api/room/choose-role', tokens[i], { choice: String(i + 1) });
    const { page } = me; await page.reload();
    await dealPlaying(request, tokens);
    await expect(page.locator('#gostopHand .hwatu').first()).toBeVisible();
    const check = async (when) => {
      await page.waitForTimeout(900); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
      for (const sel of ['#gostopOpponents', '#gostopFloor', '#gostopMine', '#gostopHand']) {
        const b = await bottom(page, sel); expect(b, `${when} ${sel}`).not.toBeNull(); expect(b, `${when} ${sel} 화면 안`).toBeLessThanOrEqual(h + 1);
      }
      if (process.env.GOSTOP_SHOTS) await page.screenshot({ path: `${process.env.GOSTOP_SHOTS}/gostop-${w}-${when}.png` });
    };
    await check('start');
    // G2-3: a pointed hand card lights its month on the floor; on a touch phone the first tap only points
    const g0 = (await call(request, '/api/room', tokens[0], null, 'get')).data.state.game;
    if (g0.turn === '1' && g0.phase === 'play') {
      // (a month held once: three of a month offer 흔들기 first, and the second tap would open that choice, not play)
      const single = await page.locator('#gostopHand .hwatu').evaluateAll((els) => { const m = (el) => el.className.match(/month-(\d+)/)?.[1]; const n = {}; els.forEach((el) => { n[m(el)] = (n[m(el)] || 0) + 1; }); return els.findIndex((el) => el.matches('.actionableTarget:not(.gostopToFloor)') && n[m(el)] === 1); });
      const card = page.locator('#gostopHand .hwatu').nth(Math.max(single, 0));
      if (single >= 0) {
        const month = (await card.getAttribute('class')).match(/month-(\d+)/)[1];
        const matches = page.locator(`#gostopFloor .hwatu.month-${month}:not(.bonus)`);
        if (w < 640) {
          const before = await page.locator('#gostopHand .hwatu').count();
          await card.tap(); await expect(card).toHaveClass(/gostopArmed/); await expect(page.locator('#gostopFloor .gostopMatch')).toHaveCount(await matches.count());
          await page.waitForTimeout(500); expect(await page.locator('#gostopHand .hwatu').count()).toBe(before);
          await page.locator('#gostopHand .hwatu.gostopArmed').tap(); await expect(page.locator('#gostopHand .hwatu')).toHaveCount(before - 1); // (CI 2차: the armed card itself -- a re-render can make another one "first")
        } else { await card.hover(); await expect(page.locator('#gostopFloor .gostopMatch')).toHaveCount(await matches.count()); }
      }
    }
    let n = 0; let state = true;
    while (n < 26 && state === true) { state = await step(request, tokens); n += 1; }
    if (state !== false) await check('late'); // (CI: a deal can end the game before then -- the result board is laid out apart)
    // G2-5: played to the end (a go/stop choice stops), the result is a window on screen with the way on
    for (let k = 0; k < 80 && (await step(request, tokens, { go: true })); k += 1);
    const actions = page.locator('#gostopResult .gostopResultActions');
    await expect(actions).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 0)); const rb = await page.locator('#gostopResult').boundingBox();
    expect(rb.y + rb.height).toBeLessThanOrEqual(h + 1);
    if (process.env.GOSTOP_SHOTS) { await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.GOSTOP_SHOTS}/gostop-${w}-result.png` }); }
    await actions.getByRole('button', { name: '판 보기' }).click(); await expect(page.locator('#gostopResult')).toBeHidden();
    for (const c of [me.context, other.context]) await c.close();
  });
}
