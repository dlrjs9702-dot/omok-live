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

test('그림 맞히기 스킨: 모든 도구 스킨이 출제자가 고른 색(검정·빨강·파랑)을 그대로 지킨다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '색');
  for (const id of ids('pictionary')) {
    const result = await a.page.evaluate((skinId) => {
      const def = window.SkinLooks.def(skinId); const out = {};
      for (const [name, color] of [['black', '#111111'], ['red', '#e11d48'], ['blue', '#1d4ed8']]) {
        const c = document.createElement('canvas'); c.width = 300; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 300, 120);
        let px = 20; let py = 60;
        for (let i = 1; i <= 40; i += 1) { const nx = 20 + i * 6.5; const ny = 60 + Math.sin(i / 5) * 18; def.seg(x, px, py, nx, ny, color, 8); px = nx; py = ny; }
        const d = x.getImageData(0, 0, 300, 120).data; let r = 0; let g = 0; let b = 0; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 255) + Math.abs(d[i + 1] - 253) + Math.abs(d[i + 2] - 246) > 90) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1; }
        out[name] = n ? [r / n, g / n, b / n] : null;
      }
      return out;
    }, id);
    expect(result.black, id).not.toBeNull();
    if (process.env.SKIN_LOG) console.log(id, Math.round(result.black[0] + result.black[1] + result.black[2]));
    expect(result.black[0] + result.black[1] + result.black[2], `${id} 검정은 어둡다`).toBeLessThan(300);
    expect(result.red[0], `${id} 빨강은 빨강 계열`).toBeGreaterThan(result.red[2] + 40);
    expect(result.red[0], id).toBeGreaterThan(result.red[1] + 50);
    expect(result.blue[2], `${id} 파랑은 파랑 계열`).toBeGreaterThan(result.blue[0] + 40);
  }
  await a.context.close();
});

test('스무고개 스킨: 모든 질문 줄 스킨에서 글자와 Q/A 표시가 배경 위에서 또렷하다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '대비');
  for (const id of ids('twentyquestions')) {
    const d = await a.page.evaluate((skinId) => { const s = window.SkinLooks.def(skinId); return { bg: s.text.bg, text: s.text.color, q: [s.tagQ.color, s.tagQ.backgroundColor], a: [s.tagA.color, s.tagA.backgroundColor] }; }, id);
    expect(await contrastOf(a.page, d.text, d.bg), `${id} 글자`).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(a.page, d.q[0], d.q[1]), `${id} Q`).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(a.page, d.a[0], d.a[1]), `${id} A`).toBeGreaterThanOrEqual(4.5);
  }
  await a.context.close();
});

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
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
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
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
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
