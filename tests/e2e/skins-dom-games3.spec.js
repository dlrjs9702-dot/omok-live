const { test, expect } = require('@playwright/test');
const { post, get, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// v1.7.40 라이어게임 · 다빈치 코드 스킨. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = (family) => ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1', 'l2'].map(i => `${family}_${i}`);

const contrastOf = (page, fg, bg) => page.evaluate(([f, b]) => {
  const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0b1324'; c.fillRect(0, 0, 1, 1); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, bl]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(bl);
  const [l1, l2] = [lum(parse(f)), lum(parse(b))].sort((x, y) => y - x);
  return (l1 + .05) / (l2 + .05);
}, [fg, bg]);

test('라이어게임 스킨: 모든 힌트 말풍선에서 글자와 이름표가 배경 위에서 또렷하다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('liar')) {
    const d = await a.page.evaluate((skinId) => { const s = window.SkinLooks.def(skinId); return { bg: s.text.bg, text: s.text.color, who: s.text.who }; }, id);
    expect(await contrastOf(a.page, d.text, d.bg), `${id} 글자`).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(a.page, d.who, d.bg), `${id} 이름표`).toBeGreaterThanOrEqual(4.5);
  }
  await a.context.close();
});

test('다빈치 코드 스킨: 모든 타일 스킨이 타일 가운데(숫자 자리)를 비워 두고 색·공개 상태를 해치지 않는다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('davinci')) {
    const worst = await a.page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); let max = 0;
      for (const color of ['black', 'white']) for (const revealed of [true, false]) {
        const c = document.createElement('canvas'); c.width = 88; c.height = 120; const x = c.getContext('2d'); d.deco(x, color, revealed);
        const px = x.getImageData(26, 36, 36, 48).data; // the middle of the tile, where the digit sits
        for (let i = 3; i < px.length; i += 4) max = Math.max(max, px[i] / 255);
      }
      return max;
    }, id);
    expect(worst, `${id} 가운데 장식 투명도`).toBeLessThanOrEqual(.2);
  }
  await a.context.close();
});

test('라이어게임 스킨: 방장 테마가 모든 화면에 같고, 각 힌트는 말한 사람의 스킨으로 그려진다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  const c = await shopper(browser, request, '셋째', 0);
  await buyAndEquip(request, a, ['liar_t1', 'liar_l1']);
  await buyAndEquip(request, b, ['liar_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b, c]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '라이어게임' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'liar' });
  const code = created.data.state.me.roomCode;
  for (const who of [b, c]) expect((await call(who, '/api/rooms/join', { code })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(c, '/api/room/choose-role', { choice: '3' })).status).toBe(200);
  expect((await call(a, '/api/room/start-liar', {})).status).toBe(200);
  const tokens = { 1: a, 2: b, 3: c };
  const game = (await get(request, '/api/room', a.token)).data.state.game;
  const speaker = tokens[game.currentSpeaker];
  expect((await call(speaker, '/api/room/liar-hint', { hint: '둥글어요', expectedPhaseId: game.phaseId })).status).toBe(200);
  for (const who of [a, b, c]) { await who.page.reload(); await expect(who.page.locator('#liarHintLog .liarHintRow')).toHaveCount(1, { timeout: 20000 }); }

  // 말한 사람이 방장이면 전설(금빛 어두운 말풍선), 손님이면 탐정 배지(연한 종이), 셋째면 기본.
  const expected = { 1: 'rgb(33, 23, 10)', 2: 'rgb(246, 240, 220)', 3: 'rgb(248, 250, 252)' }[game.currentSpeaker];
  for (const who of [a, b, c]) await expect.poll(() => who.page.locator('#liarHintLog .liarHintRow').evaluate(el => getComputedStyle(el).backgroundColor), { timeout: 8000 }).toBe(expected);
  const panelImage = (who) => who.page.locator('#liarPanel').evaluate(el => el.style.backgroundImage);
  expect((await panelImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await panelImage(a)).toBe(await panelImage(b));
  expect(await panelImage(a)).toBe(await panelImage(c));
  for (const who of [a, b, c]) await expectNoScriptError(who.page);
  for (const who of [a, b, c]) await who.context.close();
});

test('다빈치 코드 스킨: 방장 테마가 모든 화면에 같고, 각 랙의 타일은 주인의 스킨으로 꾸며진다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['davinci_t2', 'davinci_l1']);
  await buyAndEquip(request, b, ['davinci_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '다빈치 코드' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'davinci' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/start-davinci', {})).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('.davinciHand .davinciTile').first()).toBeVisible({ timeout: 20000 }); }

  const rackImage = (who, owner) => who.page.locator(`.davinciHand[data-owner="${owner}"] .davinciTile`).first().evaluate(el => el.style.backgroundImage);
  for (const who of [a, b]) {
    await expect.poll(async () => (await rackImage(who, '1')).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
    await expect.poll(async () => (await rackImage(who, '2')).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  }
  expect(await rackImage(a, '1')).not.toBe(await rackImage(a, '2')); // 주인마다 스킨이 다르다
  expect(await rackImage(a, '1')).toBe(await rackImage(b, '1')); // 같은 타일은 모든 화면에 같다
  expect(await rackImage(a, '2')).toBe(await rackImage(b, '2'));
  const panelImage = (who) => who.page.locator('#davinciPanel').evaluate(el => el.style.backgroundImage);
  expect((await panelImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await panelImage(a)).toBe(await panelImage(b));
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

test('다빈치 코드 스킨: 모든 타일 색에서 어두운 타일과 밝은 타일이 확실히 갈리고 숫자가 또렷하다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('davinci')) {
    const pal = await a.page.evaluate((skinId) => window.SkinLooks.def(skinId).pal, id);
    const [dark1, dark2, darkText] = pal.black; const [light1, light2, lightText] = pal.white;
    // 어두운 타일의 가장 밝은 쪽과 밝은 타일의 가장 어두운 쪽을 비교해도 7:1 이상
    const lums = await a.page.evaluate(([d1, d2, l1, l2]) => {
      const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      const lum = (css) => { const [r, g, b] = parse(css); return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b); };
      return { dark: Math.max(lum(d1), lum(d2)), light: Math.min(lum(l1), lum(l2)) };
    }, [dark1, dark2, light1, light2]);
    expect((lums.light + .05) / (lums.dark + .05), `${id} 어두운/밝은 타일`).toBeGreaterThanOrEqual(7);
    for (const [text, body, name] of [[darkText, dark1, '어두운 위쪽'], [darkText, dark2, '어두운 아래쪽'], [lightText, light1, '밝은 위쪽'], [lightText, light2, '밝은 아래쪽']]) {
      expect(await contrastOf(a.page, text, body), `${id} ${name} 숫자`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await a.context.close();
});
