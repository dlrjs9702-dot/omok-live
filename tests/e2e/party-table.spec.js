const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');

// v1.10.197 파티 공통 틀 (gamecenter-notes docs/gamehall-audit-20261025.md 「다른 게임」, 총괄 검토): while a hand of 그림 맞히기·
// 라이어·스무고개 is played the seat cards are off the table and the scores are one row of name plates with the island face;
// 그림판 within one screen; a right picture guess heard; 라이어's vote picked then confirmed; 스무고개's 예/아니오 at the thumb
// (under the board). Three people. PC and phone.
async function room(browser, request, isMobile, game, tag) {
  const people = [];
  for (const [k, label] of ['가', '나', '다'].entries()) { const p = await shopper(browser, request, `${tag}${label}`); p.seat = String(k + 1); people.push(p); }
  if (isMobile) for (const p of people) await p.page.setViewportSize({ width: 393, height: 851 });
  const call = (who, route, data) => post(request, route, who.token, data);
  const created = await call(people[0], '/api/rooms', { gameType: game }); const code = created.data.state.me.roomCode;
  for (const p of people.slice(1)) expect((await call(p, '/api/rooms/join', { code })).status).toBe(200);
  for (const p of people) expect((await call(p, '/api/room/choose-role', { choice: p.seat })).status).toBe(200);
  const st = async (who = people[0]) => (await get(request, '/api/room', who.token)).data.state;
  return { people, call, st, bySeat: (s) => people.find((p) => p.seat === String(s)) };
}
const plates = async (page, board) => {
  await expect(page.locator('#teamPlayers')).toBeHidden();
  await expect(page.locator(`${board} .seatFace`)).toHaveCount(3);
  expect(await page.locator(board).evaluate((el) => getComputedStyle(el).display)).toBe('flex');
};

test('그림 맞히기 판: 자리 카드 비킴·얼굴 이름표 한 줄·그림판 한 화면·정답 소리', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const { people, call, st, bySeat } = await room(browser, request, isMobile, 'pictionary', isMobile ? '그판m' : '그판');
  expect((await call(people[0], '/api/room/start-pictionary', {})).status).toBe(200);
  for (const p of people) { await p.page.reload(); await expect(p.page.locator('#pictionaryCanvas')).toBeVisible({ timeout: 20000 }); }
  const g = (await st()).game; const drawer = bySeat(g.drawerSeat); const guesser = people.find((p) => p !== drawer);
  for (const p of [drawer, guesser]) {
    await plates(p.page, '#pictionaryScoreboard');
    const box = await p.page.locator('.pictionaryCanvasWrap').boundingBox(); const view = p.page.viewportSize();
    expect(box.y + box.height).toBeLessThanOrEqual(view.height); // (one screen, no scroll)
    expect(Math.abs(box.width / box.height - 1.5)).toBeLessThan(0.02); // (3:2 kept: the strokes' share unchanged)
  }
  const guessBox = await guesser.page.locator('#pictionaryGuessInput').boundingBox(); expect(guessBox.y + guessBox.height).toBeLessThanOrEqual(guesser.page.viewportSize().height); // (the guess within the screen)
  const word = (await st(drawer)).me.myWord; await call(guesser, '/api/room/pictionary-guess', { guess: word });
  await expect.poll(() => guesser.page.evaluate(() => window.RoomSound.played().includes('right')), { timeout: 15000 }).toBe(true);
  await expectNoScriptError(guesser.page);
  for (const p of people) await p.context.close();
});

test('라이어 판: 얼굴 이름표 한 줄, 판 수 고르기 숨김, 투표는 고른 뒤 「○○님 지목」으로', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const { people, call, st, bySeat } = await room(browser, request, isMobile, 'liar', isMobile ? '라판m' : '라판');
  expect((await call(people[0], '/api/room/start-liar', {})).status).toBe(200);
  for (let k = 0; k < 10; k += 1) { const g = (await st()).game; if (!/hint/i.test(g.phase)) break; await call(bySeat(g.currentSpeaker), '/api/room/liar-hint', { hint: `힌트${k}`, expectedPhaseId: g.phaseId }); }
  const p = people[0]; await p.page.reload(); await expect(p.page.locator('#liarVoteBox')).toBeVisible({ timeout: 20000 });
  await plates(p.page, '#liarScoreboard'); await expect(p.page.locator('#liarSetupRow')).toBeHidden();
  const first = p.page.locator('#liarVoteBox .liarVoteBtn').first(); const target = await first.getAttribute('data-target');
  await first.click(); // picked: not voted yet
  await expect(first).toHaveClass(/selected/); expect((await st(p)).game.myVoted).toBe(false);
  const name = (await first.textContent()).trim(); await expect(p.page.locator('.liarVoteConfirm')).toHaveText(`${name}님 지목`);
  await p.page.locator('.liarVoteConfirm').click();
  await expect.poll(async () => (await st(p)).game.myVoted, { timeout: 15000 }).toBe(true);
  expect(target).toBeTruthy();
  await expectNoScriptError(p.page);
  for (const q of people) await q.context.close();
});

test('스무고개 판: 얼굴 이름표 한 줄, 출제자의 예/아니오/정답은 판 아래 엄지 자리', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const { people, call, st, bySeat } = await room(browser, request, isMobile, 'twentyquestions', isMobile ? '스판m' : '스판');
  expect((await call(people[0], '/api/room/twenty-start', { mode: 'individual', totalRounds: 1 })).status).toBe(200);
  const g = (await st()).game; const drawer = bySeat(g.drawerSeat);
  expect((await call(drawer, '/api/room/twenty-secret', { secret: '사과' })).status).toBe(200);
  const asker = bySeat((await st()).game.turnSeat); expect((await call(asker, '/api/room/twenty-question', { question: '먹을 수 있나요?' })).status).toBe(200);
  await drawer.page.reload(); await expect(drawer.page.locator('#twentyAnswerBox')).toBeVisible({ timeout: 20000 });
  await plates(drawer.page, '#twentyScoreboard');
  expect(await drawer.page.locator('#twentyAnswerBox').evaluate((el) => el.parentElement.id)).toBe('twentyActionPanel'); // (under the board, with the inputs)
  const box = await drawer.page.locator('#twentyAnswerBox').boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(drawer.page.viewportSize().height + 1); // (in sight at the screen's foot)
  await drawer.page.locator('#twentyAnswerBox button', { hasText: '예' }).first().click();
  await expect.poll(async () => ((await st()).game.questions || []).length, { timeout: 15000 }).toBe(1);
  await expectNoScriptError(drawer.page);
  for (const q of people) await q.context.close();
});
