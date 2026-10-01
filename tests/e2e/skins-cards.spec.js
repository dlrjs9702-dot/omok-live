const { test, expect } = require('@playwright/test');
const { post, get, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// v1.7.41 도둑잡기 · 할리갈리 스킨(카드 게임: 앞면은 그대로, 뒷면·프레임·받침·효과만). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = (family) => ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1'].map(i => `${family}_${i}`);

const contrastOf = (page, fg, bg) => page.evaluate(([f, b]) => {
  const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0b1324'; c.fillRect(0, 0, 1, 1); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, bl]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(bl);
  const [l1, l2] = [lum(parse(f)), lum(parse(b))].sort((x, y) => y - x);
  return (l1 + .05) / (l2 + .05);
}, [fg, bg]);

test('도둑잡기 스킨: 모든 카드 뒷면이 밝은 카드 앞면과 헷갈리지 않는 어두운 뒷면이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('oldmaid')) {
    const lum = await a.page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); const c = document.createElement('canvas'); c.width = 57; c.height = 77; const x = c.getContext('2d'); d.art(x, 57, 77);
      const px = x.getImageData(0, 0, 57, 77).data; const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      let l = 0; let n = 0; for (let i = 0; i < px.length; i += 4) { l += .2126 * lin(px[i]) + .7152 * lin(px[i + 1]) + .0722 * lin(px[i + 2]); n += 1; }
      return l / n;
    }, id);
    expect(lum, `${id} 뒷면 평균 밝기`).toBeLessThan(.2); // 앞면(#f8fafc)은 약 .95
  }
  await a.context.close();
});

test('할리갈리 스킨: 모든 카드 프레임에서 이름과 장수가 프레임 위에서 또렷하다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('halligalli')) {
    const d = await a.page.evaluate((skinId) => { const s = window.SkinLooks.def(skinId); return { bg: s.text.bg, text: s.text.color }; }, id);
    expect(await contrastOf(a.page, d.text, d.bg), `${id} 글자`).toBeGreaterThanOrEqual(4.5);
  }
  await a.context.close();
});

test('도둑잡기 스킨: 방장 테마가 모든 화면에 같고, 각 자리의 카드 뒷면은 그 사람의 스킨이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '둘째', 600_000);
  const c = await shopper(browser, request, '셋째', 600_000);
  await buyAndEquip(request, a, ['oldmaid_t1', 'oldmaid_l1']);
  await buyAndEquip(request, b, ['oldmaid_c1']);
  await buyAndEquip(request, c, ['oldmaid_c2']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b, c]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '도둑잡기' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(11);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'oldmaid' });
  for (const who of [b, c]) expect((await call(who, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(c, '/api/room/choose-role', { choice: '3' })).status).toBe(200);
  expect((await call(a, '/api/room/start-oldmaid', {})).status).toBe(200);
  for (const who of [a, b, c]) { await who.page.reload(); await expect(who.page.locator('#oldmaidSeats .oldmaidSeat').first()).toBeVisible({ timeout: 20000 }); }

  const backOf = (who, seat) => who.page.locator(`#oldmaidSeats .oldmaidSeat[data-seat="${seat}"] .oldmaidBack`).first().evaluate(el => el.style.backgroundImage);
  // 셋째(자리 3)의 뒷면을 방장과 둘째가 같은 그림으로 본다. 방장(자리 1)의 뒷면을 둘째와 셋째가 같은 그림으로 본다.
  for (const who of [a, b]) await expect.poll(async () => (await backOf(who, '3')).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  for (const who of [b, c]) await expect.poll(async () => (await backOf(who, '1')).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  expect(await backOf(a, '3')).toBe(await backOf(b, '3'));
  expect(await backOf(b, '1')).toBe(await backOf(c, '1'));
  expect(await backOf(a, '3')).not.toBe(await backOf(b, '1')); // 스킨이 다르면 뒷면도 다르다
  const panelImage = (who) => who.page.locator('#oldmaidPanel').evaluate(el => el.style.backgroundImage);
  expect((await panelImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await panelImage(a)).toBe(await panelImage(b));
  expect(await panelImage(a)).toBe(await panelImage(c));
  for (const who of [a, b, c]) await expectNoScriptError(who.page);
  for (const who of [a, b, c]) await who.context.close();
});

test('할리갈리 스킨: 방장 테마가 모든 화면에 같고, 각 카드 프레임은 그 사람의 스킨이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['halligalli_t2', 'halligalli_l1']);
  await buyAndEquip(request, b, ['halligalli_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '할리갈리' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(11);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'halligalli' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/start-halligalli', {})).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#halliCards .halliCard')).toHaveCount(2, { timeout: 20000 }); }

  // 자리 1 = 방장(황금 종 축제: 어두운 갈색 금빛), 자리 2 = 손님(만화책 카드: 노란 종이). 두 화면 모두 같다.
  for (const who of [a, b]) {
    await expect.poll(() => who.page.locator('#halliCards .halliCard').nth(0).evaluate(el => getComputedStyle(el).backgroundColor), { timeout: 8000 }).toBe('rgb(58, 38, 8)');
    await expect.poll(() => who.page.locator('#halliCards .halliCard').nth(1).evaluate(el => getComputedStyle(el).backgroundColor), { timeout: 8000 }).toBe('rgb(255, 242, 168)');
  }
  const panelImage = (who) => who.page.locator('#halliPanel').evaluate(el => el.style.backgroundImage);
  expect((await panelImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await panelImage(a)).toBe(await panelImage(b));
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
