const { test, expect } = require('@playwright/test');
const { post, get, shopper, buyAndEquip, twoPlayerRoom, expectSameCrop, cropOf, pixelOf } = require('./skin-support');
const { expectNoScriptError } = require('./skin-support');

// v1.7.37 윷놀이·점과 상자 스킨: 모든 스킨에서 두 팀의 색(파랑=선공, 빨강=후공)이 그림을 지배하는지, 상점 탭·구역,
// 방장 테마와 각자 말/선 스킨이 같은 방의 모든 화면에 같은지. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = (family, list) => list.map(i => `${family}_${i}`);
const YUT_PIECES = ids('yut', ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1']);
const DOTS_LINES = ids('dots', ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1']);

// Mean colour of what a skin draws for each side: blue must lead for `black`, red for `white`.
const tint = (page, id, kind) => page.evaluate(([skinId, what]) => {
  const out = {};
  for (const side of ['black', 'white']) {
    const out2 = []; // piece labels 1..4 so every guardian of the legend is covered
    for (const label of what === 'piece' ? ['1', '2', '3', '4'] : ['']) {
      const c = document.createElement('canvas'); c.width = 240; c.height = 120; const x = c.getContext('2d');
      if (what === 'piece') { x.translate(120, 60); window.SkinLooks.paintStone(x, 40, skinId, side, label); }
      else window.SkinLooks.def(skinId).line(x, 20, 60, 220, 60, side);
      const d = x.getImageData(0, 0, 240, 120).data; let r = 0; let g = 0; let b = 0; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1; }
      out2.push(n ? [r / n, g / n, b / n] : null);
    }
    out[side] = out2;
  }
  return out;
}, [id, kind]);

test('윷놀이·점과 상자 스킨: 모든 말/선 스킨이 두 팀 색(파랑·빨강)을 지킨다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '색');
  for (const [list, kind] of [[YUT_PIECES, 'piece'], [DOTS_LINES, 'line']]) {
    for (const id of list) {
      const t = await tint(a.page, id, kind);
      for (const rgb of t.black) { expect(rgb, `${id} 선공`).not.toBeNull(); expect(rgb[2], `${id} 선공은 파랑 계열`).toBeGreaterThan(rgb[0]); }
      for (const rgb of t.white) { expect(rgb, `${id} 후공`).not.toBeNull(); expect(rgb[0], `${id} 후공은 빨강 계열`).toBeGreaterThan(rgb[2]); }
    }
  }
  await a.context.close();
});

// Node pixel positions of the yut board (same table as the client) for the first lap.
const YUT_XY = { 0: [630, 630], 1: [630, 518], 2: [630, 406], 3: [630, 294], 4: [630, 182], 5: [630, 70], 6: [518, 70], 7: [406, 70], 8: [294, 70], 9: [182, 70], 10: [70, 70] };

test('윷놀이 스킨: 상점 탭·구역, 방장 테마와 각자 말이 모든 화면에 같다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['yut_t2', 'yut_l1']);
  await buyAndEquip(request, b, ['yut_c1']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '윷놀이' }).click();
  await expect(dialog.locator('.skinFamily h3')).toHaveText(['일반', '고급', '방 테마', '전설']);
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
  await dialog.getByRole('button', { name: '닫기' }).click();

  await twoPlayerRoom(request, a, b, 'yut');
  // 방 테마(달나라: 푸른 회색 바탕)가 두 화면에서 같다. 기본 멍석은 붉은 갈색이다.
  for (const who of [a, b]) await expect.poll(async () => { const [r, , bl] = await pixelOf(who.page, 4, 4); return bl > r; }, { timeout: 8000 }).toBe(true);

  // 선공(파랑)이 던져 말 하나를 판에 올린다.
  let position = null;
  for (let i = 0; i < 60 && position === null; i += 1) {
    const s = (await get(request, '/api/room', a.token)).data.state.game;
    const on = (s.pieces?.black || []).find(p => p.status === 'board' && YUT_XY[p.position] && p.position > 0);
    if (on && s.phase !== 'move') { position = on.position; break; }
    const who = s.turn === 'white' ? b : a; // 차례인 사람이 던지고 움직인다(빽도 등으로 차례가 넘어갈 수 있다)
    if (s.phase === 'throw') await call(who, '/api/room/throw-yut', {});
    else if (s.phase === 'move' && s.legalMoves?.length) await call(who, '/api/room/move-yut', { pieceId: s.legalMoves[0].pieceId });
    else await a.page.waitForTimeout(300);
  }
  expect(position, '말이 판 위에 올라야 한다').not.toBeNull();
  await a.page.waitForTimeout(2500); // 이동 애니메이션
  const [px, py] = YUT_XY[position];
  await expectSameCrop([a.page, b.page], px, py, 15);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

test('점과 상자 스킨: 상점 탭·구역, 방장 테마와 각자 선이 모든 화면에 같고, 전설은 완성한 상자를 에너지 셀로 바꾼다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '방장', 6_000_000);
  const b = await shopper(browser, request, '손님', 600_000);
  await buyAndEquip(request, a, ['dots_t2', 'dots_l1']);
  await buyAndEquip(request, b, ['dots_c2']);
  const call = (who, route, data) => post(request, route, who.token, data);
  for (const who of [a, b]) who.page.on('pageerror', (error) => { throw error; });

  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await dialog.getByRole('tab', { name: '점과 상자' }).click();
  await expect(dialog.locator('.skinCard')).toHaveCount(12);
  await dialog.getByRole('button', { name: '닫기' }).click();

  await twoPlayerRoom(request, a, b, 'dots');
  // 선: a=0(상자 위), b=10, a=20(왼쪽), b=11, a=21(오른쪽), b=12, a=4(아래) -> a가 첫 상자를 완성한다.
  for (const [who, edge] of [[a, 0], [b, 10], [a, 20], [b, 11], [a, 21], [b, 12], [a, 4]]) expect((await call(who, '/api/room/move', { x: edge, y: 0 })).status).toBe(200);
  for (const who of [a, b]) await expect.poll(async () => (await pixelOf(who.page, 4, 4)).reduce((s, v) => s + v, 0), { timeout: 8000 }).toBeLessThan(150); // 회로판 바탕
  await a.page.waitForTimeout(1500);
  await expectSameCrop([a.page, b.page], 82 + 139 * 2.5, 82 + 139 * 2, 15); // b의 선(밧줄): 가로선 id 10 (2행 2열)
  await expectSameCrop([a.page, b.page], 82 + 139 * 3.5, 82 + 139 * 2, 15); // b의 선(밧줄): 가로선 id 11
  // 완성한 상자: 에너지 셀 그림이 두 화면에서 같은 색(시안)으로 그려진다.
  for (const who of [a, b]) await expect.poll(async () => (await cropOf(who.page, 82 + 139 / 2, 82 + 139 / 2, 40)).chroma, { timeout: 8000 }).toBeGreaterThan(60);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.9.0 전설 2차: 한 선으로 상자 두 개를 닫으면 전설의 특수 연출이 나온다(낙서 마법사, 낙서 공책 짝).
test('점과 상자 전설: 한 선으로 상자 두 개를 닫으면 특수 연출, 낙서 마법사는 낙서 공책과 짝이다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '마법사', 6_000_000);
  const b = await shopper(browser, request, '손님');
  await buyAndEquip(request, a, ['dots_t1', 'dots_l2']);
  const call = (who, route, data) => post(request, route, who.token, data);
  await twoPlayerRoom(request, a, b, 'dots');
  await a.page.evaluate(() => { const def = window.SkinLooks.def('dots_l2'); const special = def.special; window.__special = 0; def.special = (...args) => { window.__special += 1; return special(...args); }; });
  // 상자 (0,0)·(0,1)의 다른 변을 모두 그은 뒤 a가 둘 사이 세로선(21)을 그으면 두 상자가 한꺼번에 닫힌다.
  for (const [who, edge] of [[a, 0], [b, 4], [a, 20], [b, 1], [a, 5], [b, 22]]) expect((await call(who, '/api/room/move', { x: edge, y: 0 })).status).toBe(200);
  await a.page.waitForTimeout(800);
  expect(await a.page.evaluate(() => window.__special)).toBe(0);
  expect((await call(a, '/api/room/move', { x: 21, y: 0 })).status).toBe(200);
  await expect.poll(() => a.page.evaluate(() => window.__special), { timeout: 5000 }).toBeGreaterThan(0);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// v1.9.0: 새 전설과 보강한 전설의 모든 연출(놓기·특수·승리)이 오류 없이 그림을 그린다(실제 판은 위 시나리오·사목 spec).
test('전설 2차(사목·오델로·윷놀이·점과 상자): 모든 전설 연출이 오류 없이 그림을 남긴다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '연출');
  const drawn = await a.page.evaluate(() => {
    const out = {};
    const ink = (fn) => { const c = document.createElement('canvas'); c.width = 720; c.height = 720; const x = c.getContext('2d'); fn(x); const d = x.getImageData(0, 0, 720, 720).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i] > 0 ? 1 : 0; return n; };
    const pts = [{ x: 200, y: 360 }, { x: 300, y: 360 }, { x: 400, y: 360 }, { x: 500, y: 360 }];
    const boxes = [{ x: 100, y: 100, size: 110 }, { x: 230, y: 100, size: 110 }];
    for (const family of ['connect4', 'othello', 'yut', 'dots']) for (const id of [`${family}_l1`, `${family}_l2`]) {
      const d = window.SkinLooks.def(id);
      out[id] = { legend: d.legend === true, pair: null,
        special: ink((x) => (family === 'dots' ? d.special(x, boxes, .4, 'black') : family === 'yut' ? d.special(x, [pts[0]], 28, .4, 'black', '1') : d.special(x, pts.slice(0, family === 'connect4' ? 3 : 4), 40, .4, 'black'))),
        win: ink((x) => (family === 'dots' ? d.win(x, boxes, .7, 'black', { w: 720, h: 720 }) : family === 'yut' ? d.win(x, [pts[0]], 28, .7, 'black', { w: 720, h: 720 }) : family === 'othello' ? d.win(x, pts, 40, .7, { w: 720, h: 720 }) : d.win(x, pts, 40, .7, 'black'))) };
    }
    return out;
  });
  for (const [id, r] of Object.entries(drawn)) { expect(r.legend, id).toBe(true); expect(r.special, `${id} 특수`).toBeGreaterThan(50); expect(r.win, `${id} 승리`).toBeGreaterThan(50); }
  await expectNoScriptError(a.page);
  await a.context.close();
});
