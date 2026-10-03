const { test, expect } = require('@playwright/test');
const { post, shopper, buyAndEquip, stoneContrast } = require('./skin-support');
const { expectNoScriptError, twoPlayerRoom } = require('./skin-support');

// v1.7.35 오목 스킨 11종: 모든 스킨의 흑·백 판독 대비, 상점 탭·등급 구역, 방 테마(방장 것)·돌 스킨이 같은 방의 모든
// 화면에 똑같이 보이는지, 전설의 승리 연출, 프로필 배지. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const OMOK_PIECES = ['omok_c1', 'omok_c2', 'omok_c3', 'omok_c4', 'omok_c5', 'omok_p1', 'omok_p2', 'omok_p3', 'omok_l1', 'omok_l2',
  'omok_common_obsidian', 'omok_common_jade', 'omok_common_amber', 'omok_common_porcelain', 'omok_common_bronze'];

test('오목 스킨: 모든 돌 스킨에서 흑·백 명도 대비가 4:1 이상이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of OMOK_PIECES) { const ratio = await stoneContrast(a.page, id); if (process.env.SKIN_LOG) console.log(id, ratio.toFixed(2)); expect(ratio, id).toBeGreaterThanOrEqual(4); }
  await a.context.close();
});

// The pixels of one stone's cell (40x40 around the intersection) of the board canvas.
const cell = (page, gx, gy) => page.evaluate(([x, y]) => {
  const c = document.getElementById('board'); const grid = (c.width - 96) / 14;
  const d = c.getContext('2d').getImageData(Math.round(48 + x * grid) - 20, Math.round(48 + y * grid) - 20, 40, 40).data;
  let chroma = 0; let dark = 0;
  for (let i = 0; i < d.length; i += 4) { chroma += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40 ? 1 : 0; dark += (d[i] + d[i + 1] + d[i + 2]) / 3 < 90 ? 1 : 0; }
  return { key: Array.from(d).join(','), chroma, dark };
}, [gx, gy]);

const pixel = (page, px, py) => page.evaluate(([x, y]) => {
  const d = document.getElementById('board').getContext('2d').getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]];
}, [px, py]);

test('오목 스킨: 상점 탭·등급 구역, 방장 테마와 각자 돌 스킨이 모든 화면에 같고, 전설은 승리 연출·프로필 배지를 갖는다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['omok_t2', 'omok_l1']);
  await buyAndEquip(request, b, ['omok_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);

  // 상점: 탭과 등급 구역(일반·고급·방 테마·전설), 17장.
  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await expect(dialog.getByRole('tab', { name: '오목' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('.skinFamily h3')).toHaveText(['일반', '고급', '방 테마', '전설']);
  await expect(dialog.locator('.skinCard')).toHaveCount(17);
  await expect(dialog.locator('.skinCard.equipped')).toHaveCount(2); // 방 테마 + 전설(칸이 다르다)
  await dialog.getByRole('button', { name: '닫기' }).click();

  // 프로필 배지: 전설을 가진 사람만.
  await a.page.reload();
  await expect(a.page.locator('#myRecordsBadges')).toContainText('천상 바둑');
  await b.page.reload();
  await expect(b.page.locator('#myRecordsBadges')).toBeHidden();

  // 방: 방장 a(흑, 전설 돌 + 별빛 천문대), 손님 b(백, 냥발석).
  const created = await call(a, '/api/rooms', { gameType: 'omok' });
  expect(created.status).toBe(201);
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: 'black' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: 'white' })).status).toBe(200);
  const seen = (await call(b, '/api/room')).data;
  void seen;
  await a.page.reload(); await b.page.reload();
  for (const who of [a, b]) await expect(who.page.locator('#roomView')).toBeVisible({ timeout: 20000 });

  const moves = [[a, 3, 7], [b, 3, 8], [a, 4, 7], [b, 4, 8], [a, 5, 7], [b, 5, 8], [a, 6, 7], [b, 6, 8]];
  for (const [who, x, y] of moves) expect((await call(who, '/api/room/move', { x, y })).status).toBe(200);

  // 같은 화면: 방 테마(어두운 밤하늘)와 두 돌의 모습이 a·b 화면에서 픽셀까지 같다. 기본 돌이 아니다(색이 있는 픽셀이 있다).
  for (const who of [a, b]) await expect.poll(async () => (await pixel(who.page, 12, 12)).reduce((s, v) => s + v, 0), { timeout: 8000 }).toBeLessThan(200);
  await expect.poll(async () => {
    const [ca, cb] = [await cell(a.page, 4, 7), await cell(b.page, 4, 7)];
    return ca.key === cb.key && ca.chroma > 20;
  }, { timeout: 8000 }).toBe(true);
  await expect.poll(async () => {
    const [ca, cb] = [await cell(a.page, 4, 8), await cell(b.page, 4, 8)];
    return ca.key === cb.key && ca.chroma > 20;
  }, { timeout: 8000 }).toBe(true);
  expect((await cell(a.page, 4, 7)).key).not.toBe((await cell(a.page, 4, 8)).key);

  // 전설 승리 연출: 다섯 줄이 완성되면 돌 사이로 금빛 선이 이어진다.
  expect((await call(a, '/api/room/move', { x: 7, y: 7 })).status).toBe(200);
  for (const who of [a, b]) {
    await expect.poll(async () => {
      const grid = (720 - 96) / 14;
      const [r, g, bl] = await pixel(who.page, Math.round(48 + 5.5 * grid), Math.round(48 + 7 * grid));
      return r > 200 && g > 170 && bl < 190;
    }, { timeout: 10000 }).toBe(true);
  }
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.8.7 별빛 천문대 판독성: 기본 돌(흑·백)의 가장자리가 밤하늘 판과 4.5:1 이상 대비된다(기본 나무판의 백돌은 약 4.1:1).
test('오목 스킨: 별빛 천문대 위의 기본 흑·백돌 가장자리가 판과 4.5:1 이상 대비된다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '천문', 2_000_000);
  const b = await shopper(browser, request, '손님');
  await buyAndEquip(request, a, ['omok_t2']);
  await twoPlayerRoom(request, a, b, 'omok');
  expect((await post(request, '/api/room/move', a.token, { x: 7, y: 7 })).status).toBe(200);
  expect((await post(request, '/api/room/move', b.token, { x: 9, y: 7 })).status).toBe(200);
  await expect.poll(async () => (await pixel(a.page, 12, 12)).reduce((s, v) => s + v, 0), { timeout: 8000 }).toBeLessThan(200);
  await a.page.waitForTimeout(800); // 놓는 움직임이 끝난 뒤
  const edges = await a.page.evaluate(() => {
    const c = document.getElementById('board'); const x = c.getContext('2d'); const grid = (c.width - 96) / 14;
    const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    const L = (px, py) => { const d = x.getImageData(Math.round(px), Math.round(py), 1, 1).data; return .2126 * lin(d[0]) + .7152 * lin(d[1]) + .0722 * lin(d[2]); };
    const ratio = (p, q) => (Math.max(p, q) + .05) / (Math.min(p, q) + .05);
    return [7, 9].map((gx) => {
      const cx = 48 + gx * grid; const cy = 48 + 7 * grid; const bg = L(cx + grid * .5, cy - grid * .5);
      let best = 0; for (let t = 0; t < 6.28; t += .05) for (const k of [.36, .4, .44, .46]) best = Math.max(best, ratio(L(cx + Math.cos(t) * grid * k, cy + Math.sin(t) * grid * k), bg));
      return best;
    });
  });
  for (const edge of edges) expect(edge).toBeGreaterThanOrEqual(4.5);
  for (const who of [a, b]) await who.context.close();
});

// v1.8.7 전설 2차: 짝 테마(조선 기원 ↔ 왕실 기보), 정확히 네 줄이 되는 순간의 특수 연출, 승리 연출을 가리지 않는 결과 띠.
test('오목 전설: 네 줄 특수 연출은 4목에서만, 전설 승리는 결과를 아래 띠·위 배너로 미룬다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '왕실', 6_000_000);
  const b = await shopper(browser, request, '손님');
  await buyAndEquip(request, a, ['omok_t1', 'omok_l2']);
  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '오목' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(17);
  await dialog.getByRole('button', { name: '닫기' }).click();
  await twoPlayerRoom(request, a, b, 'omok');
  await a.page.evaluate(() => { // 전설 정의의 특수 연출 호출을 센다(그리기는 그대로)
    const def = window.SkinLooks.def('omok_l2'); const special = def.special; window.__special = 0;
    def.special = (...args) => { window.__special += 1; return special(...args); };
  });
  const moves = [[a, 3, 7], [b, 3, 9], [a, 4, 7], [b, 4, 9], [a, 5, 7], [b, 9, 9]];
  for (const [who, x, y] of moves) expect((await post(request, '/api/room/move', who.token, { x, y })).status).toBe(200);
  await a.page.waitForTimeout(1500);
  expect(await a.page.evaluate(() => window.__special)).toBe(0); // 세 줄에서는 없다
  expect((await post(request, '/api/room/move', a.token, { x: 6, y: 7 })).status).toBe(200);
  await expect.poll(() => a.page.evaluate(() => window.__special), { timeout: 5000 }).toBeGreaterThan(0);
  expect((await post(request, '/api/room/move', b.token, { x: 10, y: 10 })).status).toBe(200);
  expect((await post(request, '/api/room/move', a.token, { x: 7, y: 7 })).status).toBe(200);
  await expect(a.page.locator('#boardOverlay')).toHaveClass(/legendResult/);
  await expect(a.page.locator('#resultEffect')).toHaveClass(/banner/, { timeout: 5000 });
  await expect(b.page.locator('#boardOverlay')).toHaveClass(/legendResult/); // 상대 화면도 같은 연출
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
