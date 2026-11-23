const { test, expect } = require('@playwright/test');
const { shopper, get, post, twoPlayerRoom, expectNoScriptError } = require('./skin-support');

// 달무리 사목 (notes docs/orbit-4-plan-20261122.md §3-5, 사용자 결정 57 · 59): two screens, one board -- a bead placed by a click and both rings
// turned one step on the server; a push (the other's bead, then the empty cell beside it) and a bead; the game played out to its end, the
// result on both screens. With SHOT_DIR: the board's photos.
test('달무리 사목: 클릭으로 놓으면 두 고리가 돌고, 밀기 → 놓기, 두 화면 같은 판, 끝까지 두면 결과', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '달구슬'); const b = await shopper(browser, request, '별구슬');
  await twoPlayerRoom(request, a, b, 'orbit4');
  const game = async (who = a) => { const r = await get(request, '/api/room', who.token); return r.data.state?.game || r.data.game; };
  const cell = async (who, x, y) => { const box = await who.page.locator('#board').boundingBox(); const k = box.width / 720; await who.page.mouse.click(box.x + (80 + (x + 0.5) * 140) * k, box.y + (96 + (y + 0.5) * 140) * k); }; /* (app.js orbit4Layout: 140 px cells, left 80, top 96 on the 720 canvas) */
  const shot = async (who, name) => { if (process.env.SHOT_DIR) { await who.page.waitForTimeout(900); await who.page.locator('#board').screenshot({ path: `${process.env.SHOT_DIR}/orbit4-${name}.png` }); } };
  await expect.poll(async () => (await game()).status, { timeout: 15000 }).toBe('playing');
  await shot(a, 'start');
  // 달 구슬 at the corner (0, 0): the outer ring turns one step counter-clockwise -- it is at (0, 1) now
  await cell(a, 0, 0);
  await expect.poll(async () => (await game()).moveCount, { timeout: 10000 }).toBe(1);
  let g = await game(); expect(g.board[1][0]).toBe('black'); expect(g.board[0][0]).toBe(null); expect(g.left).toEqual({ black: 7, white: 8 }); expect(g.turn).toBe('white');
  await shot(a, 'first');
  // 별: the moon bead pushed from (0, 1) to (1, 1), then a star on (3, 3) -- after the turn the pushed bead (inner ring) at (1, 2), the star at (3, 2)
  await expect.poll(async () => (await game(b)).moveCount, { timeout: 10000 }).toBe(1);
  await cell(b, 0, 1); await b.page.waitForTimeout(250); await cell(b, 1, 1); await b.page.waitForTimeout(250); await cell(b, 3, 3);
  await expect.poll(async () => (await game()).moveCount, { timeout: 10000 }).toBe(2);
  g = await game(); expect(g.lastMove.push).toEqual({ from: [0, 1], to: [1, 1] }); expect(g.board[2][1]).toBe('black'); expect(g.board[2][3]).toBe('white');
  expect(g.board.flat().filter(Boolean).length).toBe(2);
  await shot(b, 'pushed');
  // a push of my own bead is refused, the board as it was
  const refused = await post(request, '/api/room/move', a.token, { x: 0, y: 0, push: { from: [1, 2], to: [0, 2] } }); expect(refused.status).toBe(409);
  // played out (each the first free cell) -- by 16 beads at the latest it ends; both screens show the result
  for (let k = 0; k < 20; k += 1) { g = await game(); if (g.status !== 'playing') break; const who = g.turn === 'black' ? a : b; const [x, y] = g.legalMoves[0]; expect((await post(request, '/api/room/move', who.token, { x, y })).status).toBe(200); }
  g = await game(); expect(['finished', 'draw']).toContain(g.status); expect(g.moveCount).toBeLessThanOrEqual(16);
  for (const who of [a, b]) await expect(who.page.locator('#boardOverlay')).toBeVisible({ timeout: 10000 });
  await shot(a, 'end');
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
