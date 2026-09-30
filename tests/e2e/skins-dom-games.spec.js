const { test, expect } = require('@playwright/test');
const { post, get, shopper, buyAndEquip } = require('./skin-support');
const { expectNoScriptError } = require('./skin-support');

// v1.7.38~ 카드·숫자·말하기 계열(DOM 화면) 게임의 스킨: 글자 판독 대비, 방장 테마가 모든 화면에 같고, 각자의 스킨이
// 자기 행·자기 판에 그려지는지. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = (family, list) => list.map(i => `${family}_${i}`);
const PIECES = ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1'];

// WCAG contrast ratio of two CSS colours (hex or rgba(); a translucent background is blended on a dark page).
const contrastOf = (page, fg, bg) => page.evaluate(([f, b]) => {
  const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0b1324'; c.fillRect(0, 0, 1, 1); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, bl]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(bl);
  const [l1, l2] = [lum(parse(f)), lum(parse(b))].sort((x, y) => y - x);
  return (l1 + .05) / (l2 + .05);
}, [fg, bg]);

test('숫자야구 스킨: 모든 행 스킨에서 추측 숫자와 S/B/O 램프가 행 배경 위에서 또렷하다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('baseball', PIECES)) {
    const def = await a.page.evaluate((skinId) => { const d = window.SkinLooks.def(skinId); return { bg: d.row.backgroundColor, digit: d.digit.color, lamps: [d.lamp.strike, d.lamp.ball, d.lamp.out], off: d.lamp.off }; }, id);
    expect(await contrastOf(a.page, def.digit, def.bg), `${id} 숫자`).toBeGreaterThanOrEqual(4.5);
    for (const lamp of def.lamps) expect(await contrastOf(a.page, lamp, def.bg), `${id} 램프`).toBeGreaterThanOrEqual(3);
    expect(await contrastOf(a.page, def.lamps[0], def.off), `${id} 켜짐과 꺼짐`).toBeGreaterThanOrEqual(3);
  }
  await a.context.close();
});

test('빙고 스킨: 모든 표식 스킨에서 칸의 숫자가 표식 위에서도 읽힌다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('bingo', PIECES)) {
    const ratio = await a.page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); const s = 96; const c = document.createElement('canvas'); c.width = s; c.height = s; const x = c.getContext('2d');
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, s, s); x.save(); x.translate(s * .06, s * .06); x.scale(.88, .88); d.mark(x, s); x.restore();
      const data = x.getImageData(s * .3, s * .3, s * .4, s * .4).data; // where the number sits
      const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      let l = 0; for (let i = 0; i < data.length; i += 4) l += .2126 * lin(data[i]) + .7152 * lin(data[i + 1]) + .0722 * lin(data[i + 2]);
      l /= data.length / 4;
      const tc = document.createElement('canvas').getContext('2d'); tc.fillStyle = d.text.color; tc.fillRect(0, 0, 1, 1); const t = tc.getImageData(0, 0, 1, 1).data;
      const tl = .2126 * lin(t[0]) + .7152 * lin(t[1]) + .0722 * lin(t[2]);
      const [hi, lo] = [Math.max(l, tl), Math.min(l, tl)]; return (hi + .05) / (lo + .05);
    }, id);
    expect(ratio, id).toBeGreaterThanOrEqual(3);
  }
  await a.context.close();
});

test('빙고 스킨: 방장 테마가 모든 화면에 같고, 각자의 표식이 자기 판에 그려진다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['bingo_t2', 'bingo_l1']);
  await buyAndEquip(request, b, ['bingo_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '빙고' }).click();
  await expect(dialog.locator('.skinFamily h3')).toHaveText(['일반', '고급', '방 테마', '전설']);
  await expect(dialog.locator('.skinCard')).toHaveCount(11);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'bingo' });
  expect(created.status).toBe(201);
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/start-bingo', {})).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#roomView')).toBeVisible(); }

  // 첫 차례 사람이 자기 판의 숫자 하나를 고른다.
  const s0 = (await get(request, '/api/room', a.token)).data.state;
  const mover = s0.game.turn === '1' ? a : b; const other = mover === a ? b : a;
  const board = (await get(request, '/api/room', mover.token)).data.state.me.myBingoBoard;
  const otherBoard = (await get(request, '/api/room', other.token)).data.state.me.myBingoBoard;
  const common = board.find(n => otherBoard.includes(n)); // 두 판에 모두 있는 숫자: 두 사람 판에 모두 표식이 생긴다
  expect(common).toBeDefined();
  expect((await call(mover, '/api/room/select-bingo', { number: common, expectedMoveCount: 0 })).status).toBe(200);

  const themeImage = (who) => who.page.locator('#bingoPanel').evaluate(el => el.style.backgroundImage);
  await expect.poll(async () => (await themeImage(a)).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  expect(await themeImage(a)).toBe(await themeImage(b)); // 같은 방 테마
  // 고른 숫자는 각자의 판에서 각자의 스킨 표식으로 그려진다(둘 다 표식 그림이 있고, 서로 다르다).
  const markOf = async (who) => who.page.locator('#bingoBoard .bingoCell.selected').first().evaluate(el => ({ image: el.style.backgroundImage, color: getComputedStyle(el).color }));
  await expect.poll(async () => (await markOf(a)).image.startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  await expect.poll(async () => (await markOf(b)).image.startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  expect((await markOf(a)).image).not.toBe((await markOf(b)).image);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

test('숫자야구 스킨: 방장 테마가 모든 화면에 같고, 각 행은 추측한 사람의 스킨으로 그려진다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['baseball_t2', 'baseball_l1']);
  await buyAndEquip(request, b, ['baseball_c2']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '숫자야구' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(11);
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'baseball' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: 'black' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: 'white' })).status).toBe(200);
  expect((await call(a, '/api/room/set-secret', { secret: '123' })).status).toBe(200);
  expect((await call(b, '/api/room/set-secret', { secret: '456' })).status).toBe(200);
  expect((await call(a, '/api/room/guess', { guess: '457' })).status).toBe(200); // 선공: 상대 비밀 456과 2S
  expect((await call(b, '/api/room/guess', { guess: '781' })).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#baseballHistory .baseballHistoryRow')).toHaveCount(2); }

  const rowBg = (who, index) => who.page.locator('#baseballHistory .baseballHistoryRow').nth(index).evaluate(el => getComputedStyle(el).backgroundColor);
  // 최신순: 0 = 손님(노트 스킨), 1 = 방장(마스터 코드 스킨)
  for (const who of [a, b]) {
    await expect.poll(() => rowBg(who, 0), { timeout: 8000 }).toBe('rgb(251, 244, 220)');
    await expect.poll(() => rowBg(who, 1), { timeout: 8000 }).toBe('rgb(17, 24, 39)');
  }
  const themeImage = (who) => who.page.locator('#baseballHistory').evaluate(el => el.style.backgroundImage);
  expect((await themeImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await themeImage(a)).toBe(await themeImage(b));
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
