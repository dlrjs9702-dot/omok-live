const { test, expect } = require('@playwright/test');
const { post, shopper, buyAndEquip, expectNoScriptError } = require('./skin-support');

// v1.7.39 그림 맞히기 · 스무고개 스킨. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = (family) => ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1', 'l2'].map(i => `${family}_${i}`);

const contrastOf = (page, fg, bg) => page.evaluate(([f, b]) => {
  const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0b1324'; c.fillRect(0, 0, 1, 1); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, bl]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(bl);
  const [l1, l2] = [lum(parse(f)), lum(parse(b))].sort((x, y) => y - x);
  return (l1 + .05) / (l2 + .05);
}, [fg, bg]);

// Pixels around (px, py) of a canvas by id: a key to compare across pages and the count of coloured pixels.
const cropOfCanvas = (page, id, px, py) => page.evaluate(([cid, x, y]) => {
  const d = document.getElementById(cid).getContext('2d').getImageData(Math.round(x) - 22, Math.round(y) - 22, 44, 44).data;
  let chroma = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) chroma += 1;
  return { key: Array.from(d).join(','), chroma };
}, [id, px, py]);

test('그림 맞히기 스킨: 방장 테마와 출제자의 도구가 모든 화면에 같다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 0);
  await buyAndEquip(request, a, ['pictionary_t2', 'pictionary_l1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '그림 맞히기' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(25); /* v1.10.90 스킨 2배 +10 */
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'pictionary' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/start-pictionary', {})).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#pictionaryPanel')).toBeVisible({ timeout: 20000 }); }
  expect((await call(a, '/api/room/pictionary-stroke', { stroke: { points: [[0.2, 0.5], [0.4, 0.55], [0.6, 0.5], [0.8, 0.45]], color: '#e11d48', width: 10, tool: 'pen' } })).status).toBe(200);

  const wrapImage = (who) => who.page.locator('.pictionaryCanvasWrap').evaluate(el => el.style.backgroundImage);
  await expect.poll(async () => (await wrapImage(a)).startsWith('url("data:image/png'), { timeout: 8000 }).toBe(true);
  expect(await wrapImage(a)).toBe(await wrapImage(b));
  await expect.poll(async () => {
    const crops = [await cropOfCanvas(a.page, 'pictionaryCanvas', 720 * .4, 480 * .55), await cropOfCanvas(b.page, 'pictionaryCanvas', 720 * .4, 480 * .55)];
    return crops[0].key === crops[1].key && crops[0].chroma > 20;
  }, { timeout: 9000 }).toBe(true);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

test('스무고개 스킨: 방장 테마가 모든 화면에 같고, 각 질문 줄은 질문한 사람의 스킨으로 그려진다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['twentyquestions_t1']);
  await buyAndEquip(request, b, ['twentyquestions_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '스무고개' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(22); /* v1.10.90 스킨 2배 +10 */
  await dialog.getByRole('button', { name: '닫기' }).click();

  const created = await call(a, '/api/rooms', { gameType: 'twentyquestions' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/twenty-start', { mode: 'individual', totalRounds: 2 })).status).toBe(200);
  expect((await call(a, '/api/room/twenty-secret', { secret: '비행기' })).status).toBe(200);
  expect((await call(b, '/api/room/twenty-question', { question: '날아요?' })).status).toBe(200);
  expect((await call(a, '/api/room/twenty-answer', { reply: '예' })).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#twentyQuestionLog .twentyPair')).toHaveCount(1, { timeout: 20000 }); }

  for (const who of [a, b]) await expect.poll(() => who.page.locator('#twentyQuestionLog .twentyPair').evaluate(el => getComputedStyle(el).backgroundColor), { timeout: 8000 }).toBe('rgb(255, 246, 184)');
  const panelImage = (who) => who.page.locator('#twentyPanel').evaluate(el => el.style.backgroundImage);
  expect((await panelImage(a)).startsWith('url("data:image/png')).toBe(true);
  expect(await panelImage(a)).toBe(await panelImage(b));
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
