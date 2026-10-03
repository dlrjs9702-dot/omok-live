const { test, expect } = require('@playwright/test');
const { post, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// v1.7.42 고스톱·맞고 스킨: 48장 앞면은 공용(다시 그리지 않음), 뒷면·프레임·받침·획득패 영역·효과·방 테마만. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1'].map(i => `gostop_${i}`);

test('고스톱 스킨: 모든 카드 뒷면이 밝은 카드 앞면과 헷갈리지 않는 어두운 뒷면이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids) {
    const lum = await a.page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); const c = document.createElement('canvas'); c.width = 46; c.height = 68; const x = c.getContext('2d'); d.art(x, 46, 68);
      const px = x.getImageData(0, 0, 46, 68).data; const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      let l = 0; let n = 0; for (let i = 0; i < px.length; i += 4) { l += .2126 * lin(px[i]) + .7152 * lin(px[i + 1]) + .0722 * lin(px[i + 2]); n += 1; }
      return l / n;
    }, id);
    expect(lum, `${id} 뒷면 평균 밝기`).toBeLessThan(.2);
  }
  await a.context.close();
});

test('고스톱 스킨: 방장 테마가 모든 화면에 같고, 상대 손패 뒷면은 그 사람의 스킨이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['gostop_t2', 'gostop_l1']);
  await buyAndEquip(request, b, ['gostop_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '고스톱·맞고' }).click();
  await expect(dialog.locator('.skinFamily h3')).toHaveText(['일반', '고급', '방 테마', '전설']);
  await expect(dialog.locator('.skinCard')).toHaveCount(11);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'gostop' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/start-gostop', {})).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#gostopHand .hwatu').first()).toBeVisible({ timeout: 20000 }); }

  const oppBack = (who) => who.page.locator('#gostopOpponents .hwatuBack').first().evaluate(el => el.style.backgroundImage);
  for (const who of [a, b]) await expect.poll(async () => (await oppBack(who)).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  expect(await oppBack(a)).not.toBe(await oppBack(b)); // 방장이 보는 손님 뒷면(노란 도깨비)과 손님이 보는 방장 뒷면(왕실)은 다르다
  const deckBack = (who) => who.page.locator('#gostopDeck .hwatuBack').first().evaluate(el => el.style.backgroundImage);
  expect(await deckBack(a)).toBe(await deckBack(b)); // 산(덱)은 모두에게 같다
  // v1.8.5: the room theme dresses the large table (the felt), the main stage of the screen.
  const panelImage = (who) => who.page.locator('#gostopFelt').evaluate(el => el.style.backgroundImage);
  expect((await panelImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await panelImage(a)).toBe(await panelImage(b));
  // 내 손패 받침은 내 스킨(방장=왕실 금빛 테두리). 손패 카드의 앞면은 그대로 48장 공용 그림이다.
  await expect.poll(() => a.page.locator('#gostopHand').evaluate(el => getComputedStyle(el).borderColor), { timeout: 8000 }).toContain('255, 216, 107');
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
