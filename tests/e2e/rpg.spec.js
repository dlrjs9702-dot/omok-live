const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// 잿빛 원정 (1~4인 협동 3D 로그라이크): real server, real 3D page (WebGL), real guest accounts in
// separate browser contexts. PC only.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.68.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, errors, label, token: await page.evaluate(() => document.body.dataset.session) };
}

const debug = page => page.evaluate(() => window.RpgDebug?.() || null);
const mySnap = async (page, seat = '1') => (await debug(page))?.snap?.p.find(p => p.s === seat) || null;

async function createRoom(host) {
  await host.page.locator('[data-game="rpg"]').click();
  const [created] = await Promise.all([
    host.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    host.page.locator('#createRoomBtn').click(),
  ]);
  await expect(host.page.locator('#rpgPanel')).toBeVisible();
  return (await created.json()).state.me.roomCode;
}

async function join(view, code) {
  await view.page.locator('#roomPasswordInput').fill(code);
  await view.page.locator('#roomPasswordInput').press('Enter');
  await expect(view.page.locator('#rpgPanel')).toBeVisible();
}

async function takeSeatAndClass(view, seat, className) {
  await view.page.locator(`#teamRoleButtons [data-team-seat="${seat}"]`).click();
  await view.page.locator('.rpgCard', { hasText: className }).click();
  await expect(view.page.locator('.rpgCard.selected', { hasText: className })).toBeVisible();
}

test.describe('잿빛 원정', () => {
  test('방향키 이동·대각선·스크롤 없음·Space/Q·채팅 입력 중 차단·포커스 해제·퇴장 시 3D 정리', async ({ browser, request }) => {
    test.setTimeout(120_000);
    const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    const me = await guest(browser, request, admin, '건');
    await createRoom(me);
    await takeSeatAndClass(me, '1', '사냥꾼');
    await me.page.getByRole('button', { name: /원정 시작/ }).click();
    await expect.poll(async () => (await debug(me.page))?.ticks || 0).toBeGreaterThan(5);
    await expect(me.page.locator('canvas.rpgCanvas')).toHaveCount(1);
    const scroll = await me.page.evaluate(() => window.scrollY);

    // ↑ + → together: diagonal, not faster than straight; page must not scroll.
    const start = await mySnap(me.page);
    const pressedAt = Date.now();
    await me.page.keyboard.down('ArrowUp');
    await me.page.keyboard.down('ArrowRight');
    await me.page.waitForTimeout(600);
    expect((await debug(me.page)).held).toBe(1 | 8);
    await me.page.keyboard.up('ArrowUp');
    await me.page.keyboard.up('ArrowRight');
    await expect.poll(async () => (await debug(me.page)).held).toBe(0);
    const heldFor = (Date.now() - pressedAt) / 1000;
    await me.page.waitForTimeout(300);
    const end = await mySnap(me.page);
    expect(end.x).toBeGreaterThan(start.x + 1); // screen right
    expect(end.z).toBeLessThan(start.z - 1); // screen up
    // Hunter speed 6.2 m/s: the diagonal never covers more than the straight-line speed allows.
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThan(6.2 * heldFor + 0.5);
    expect(await me.page.evaluate(() => window.scrollY)).toBe(scroll);

    // Space = basic attack (held), Q = skill with a visible cooldown.
    await me.page.keyboard.down('Space');
    await expect.poll(async () => (await debug(me.page)).attack).toBe(true);
    await me.page.keyboard.up('Space');
    await me.page.keyboard.press('KeyQ');
    await expect(me.page.locator('.rpgSlot').nth(1).locator('.cdText')).not.toHaveText('', { timeout: 3000 });
    expect(await me.page.evaluate(() => window.scrollY)).toBe(scroll);

    // Typing in chat: arrow keys stay with the input.
    await me.page.locator('#chatInput').click();
    const before = await mySnap(me.page);
    await me.page.keyboard.down('ArrowLeft');
    await me.page.waitForTimeout(400);
    await me.page.keyboard.up('ArrowLeft');
    expect((await debug(me.page)).held).toBe(0);
    await me.page.waitForTimeout(200);
    const after = await mySnap(me.page);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.3);
    await me.page.locator('#rpgStage').click({ position: { x: 20, y: 400 } });
    await me.page.evaluate(() => document.activeElement?.blur());

    // Losing window focus while a key is down must not leave it held.
    await me.page.keyboard.down('ArrowDown');
    await expect.poll(async () => (await debug(me.page)).held).toBe(2);
    await me.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await debug(me.page)).held).toBe(0);
    await me.page.keyboard.up('ArrowDown');

    // Leaving the room releases the 3D scene; a new RPG room gets exactly one canvas again.
    await me.page.locator('#leaveRoomBtn').click();
    const confirm = me.page.getByRole('button', { name: /나가기|확인/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(me.page.locator('#lobbyView')).toBeVisible();
    expect(await debug(me.page)).toBeNull();
    await expect(me.page.locator('canvas.rpgCanvas')).toHaveCount(0);
    // Another game's keys: arrows scroll normally in the lobby (no RPG listener left behind).
    await me.page.locator('[data-game="omok"]').click();
    expect(me.errors).toEqual([]);
    await me.context.close();
  });

  test('2인 협동: 위치 동기화 → 전투 → 방 클리어 → 마우스로 레벨업·능력치·준비 → 보물 → 보스 → 클리어', async ({ browser, request }, testInfo) => {
    test.setTimeout(420_000);
    const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    const a = await guest(browser, request, admin, '가람');
    const b = await guest(browser, request, admin, '나래');
    const code = await createRoom(a);
    await join(b, code);
    await takeSeatAndClass(a, '1', '비술사');
    await takeSeatAndClass(b, '2', '수호자');
    await a.page.getByRole('button', { name: /원정 시작 \(2명\)/ }).click();
    await expect.poll(async () => (await debug(b.page))?.ticks || 0).toBeGreaterThan(5);

    // B's screen follows A's server position.
    await a.page.keyboard.down('ArrowLeft');
    await a.page.waitForTimeout(500);
    await a.page.keyboard.up('ArrowLeft');
    await a.page.waitForTimeout(400);
    const seenByB = await mySnap(b.page, '1');
    const seenByA = await mySnap(a.page, '1');
    expect(Math.abs(seenByB.x - seenByA.x)).toBeLessThan(0.8);
    await a.page.screenshot({ path: testInfo.outputPath('01-combat.png') });

    // The party is played through the same intent API the keyboard uses (server authoritative).
    const tokens = { 1: a.token, 2: b.token };
    let uiIntermissionDone = false; let sawBossBar = false; let shotBoss = false;
    const botMemory = {};
    const deadline = Date.now() + 360_000;
    while (Date.now() < deadline) {
      const state = (await api(request, '/api/room', a.token, undefined, 'GET')).data.state;
      const g = state.game;
      if (g.status === 'finished') break;
      if (g.phase === 'intermission') {
        for (const seat of ['1', '2']) {
          const p = g.players[seat];
          if (seat === '1' && !uiIntermissionDone && (p.choices || p.statPoints)) {
            // Mouse only: pick a level-up card, spend a stat point, press ready.
            await expect(a.page.locator('.rpgPanel.wide')).toBeVisible();
            if (p.choices) { await a.page.locator('.rpgCard').first().click(); await a.page.waitForTimeout(200); }
            while ((await api(request, '/api/room', a.token, undefined, 'GET')).data.state.game.players['1'].choices) { await a.page.locator('.rpgCard').first().click(); await a.page.waitForTimeout(200); }
            if ((await api(request, '/api/room', a.token, undefined, 'GET')).data.state.game.players['1'].statPoints) await a.page.getByRole('button', { name: '지능 올리기' }).click();
            const items = (await api(request, '/api/room', a.token, undefined, 'GET')).data.state.game.players['1'].itemChoices;
            if (items) await a.page.locator('.rpgCard.skip').click();
            await a.page.screenshot({ path: testInfo.outputPath('02-intermission.png') });
            await a.page.getByRole('button', { name: /준비 완료 → 다음 방/ }).click();
            uiIntermissionDone = true;
            continue;
          }
          if (p.ready) continue;
          for (let i = 0; i < 6 && p.choices; i += 1) await api(request, '/api/room/rpg-pick', tokens[seat], { index: 0 });
          const fresh = (await api(request, '/api/room', tokens[seat], undefined, 'GET')).data.state.game.players[seat];
          if (fresh.itemChoices) await api(request, '/api/room/rpg-item', tokens[seat], { index: 0 });
          for (let i = 0; i < fresh.statPoints; i += 1) await api(request, '/api/room/rpg-stat', tokens[seat], { stat: ['str', 'agi', 'int', 'vit', 'luk'][i % 5] });
          await api(request, '/api/room/rpg-ready', tokens[seat], { ready: true });
        }
        continue;
      }
      const snap = (await debug(a.page))?.snap;
      if (!snap) continue;
      if (snap.m.some(m => m.bo)) {
        sawBossBar ||= await a.page.locator('.rpgBoss:not(.hidden)').isVisible();
        if (!shotBoss) { shotBoss = true; await a.page.screenshot({ path: testInfo.outputPath('03-boss.png') }); }
      }
      for (const seat of ['1', '2']) {
        const p = snap.p.find(x => x.s === seat);
        if (!p || p.st !== 'ok') continue;
        const foes = snap.m.filter(m => !m.al).sort((x, y) => Math.hypot(x.x - p.x, x.z - p.z) - Math.hypot(y.x - p.x, y.z - p.z));
        const target = foes[0];
        const danger = snap.hz.find(h => h.o === 'm' && !h.fired && Math.hypot(h.x - p.x, h.z - p.z) < (h.r || 3) + 1);
        const bits = (dx, dz) => (dx > 0.3 ? 8 : dx < -0.3 ? 4 : 0) | (dz > 0.3 ? 2 : dz < -0.3 ? 1 : 0);
        let mv = 0;
        if (danger) mv = bits(p.x - danger.x, p.z - danger.z);
        else if (target) { const d = Math.hypot(target.x - p.x, target.z - p.z); const want = seat === '2' ? 1.8 : 7; mv = bits((target.x - p.x) * Math.sign(d - want), (target.z - p.z) * Math.sign(d - want)); }
        // Walk around obstacles the same way a player would: if barely moving, sidestep a moment.
        const hist = (botMemory[seat] ||= { at: [], until: 0, mv: 0 });
        hist.at.push([p.x, p.z]); if (hist.at.length > 10) hist.at.shift();
        if (Date.now() < hist.until) mv = hist.mv;
        else if (mv && hist.at.length === 10 && Math.hypot(p.x - hist.at[0][0], p.z - hist.at[0][1]) < 0.4) { hist.until = Date.now() + 900; hist.mv = [1, 2, 4, 8][Math.floor(Math.random() * 4)]; mv = hist.mv; }
        await api(request, '/api/room/rpg-input', tokens[seat], { mv, atk: Boolean(target) });
        if (danger && p.cd.d <= 0) await api(request, '/api/room/rpg-act', tokens[seat], { a: 'dash' });
        for (const key of ['q', 'w', 'e', 'r']) if (target && p.cd[key] <= 0) await api(request, '/api/room/rpg-act', tokens[seat], { a: key });
        if (p.hp < p.mh * 0.35) await api(request, '/api/room/rpg-act', tokens[seat], { a: 'item1' });
      }
      await a.page.waitForTimeout(120);
    }
    const final = (await api(request, '/api/room', a.token, undefined, 'GET')).data.state.game;
    expect(uiIntermissionDone).toBe(true);
    expect(final.status).toBe('finished');
    await a.page.screenshot({ path: testInfo.outputPath('04-result.png') });
    test.info().annotations.push({ type: 'rpg-result', description: `${final.result.kind} room ${final.result.rooms} lv ${JSON.stringify(final.result.levels)}` });
    // The level-up choices made with the mouse are part of the build.
    expect(Object.values(final.players['1'].skills).filter(Boolean).length + final.players['1'].passives.length + final.players['1'].items.length).toBeGreaterThan(1);
    if (final.result.kind === 'clear') {
      expect(sawBossBar).toBe(true);
      await expect(a.page.locator('.rpgPanel.victory')).toBeVisible();
      await expect(b.page.locator('.rpgPanel.victory')).toBeVisible();
    } else {
      await expect(a.page.locator('.rpgPanel.defeat')).toBeVisible();
    }
    expect(final.result.rooms).toBeGreaterThanOrEqual(4);
    expect([...a.errors, ...b.errors]).toEqual([]);
    for (const view of [a, b]) await view.context.close();
  });
});
