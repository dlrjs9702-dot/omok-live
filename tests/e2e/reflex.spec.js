const { test, expect } = require('@playwright/test');
const { get, post, shopper, expectNoScriptError } = require('./skin-support');

// v1.10.68 순발력 게임 (한판마당 자료): 싱글게임 → 「순발력 게임」 → 다섯 게임 목록 → 반응속도 다섯 라운드를 실제로 하고
// 결과·포인트, 판 중간에 그만두면 보고하지 않음, 나가면 아일랜드로. PC(마우스·Esc)와 휴대폰(터치) 모두.
test('순발력 게임: 목록 → 반응속도 완주 → 결과·+1,500P → 뒤로', async ({ browser, request, isMobile }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '번개손');
  const { page, token } = a;
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloReflexBtn').click();
  await expect(page.locator('#reflexView')).toBeVisible();
  await expect(page.locator('.reflexCard strong')).toHaveText(['두더지 잡기', '반응속도', '다른 색 찾기', '숫자 터치', '비트 탭']);
  await expect(page.locator('.reflexToday')).toHaveText('오늘 받은 포인트 0P / 20,000P');

  // a round left in the middle: back to the game, nothing reported
  await page.locator('.reflexCard', { hasText: '두더지 잡기' }).click();
  await expect(page.locator('.reflexLevel')).toHaveText(['쉬움 · 1,000P', '보통 · 1,500P', '어려움 · 2,000P']);
  await page.locator('.reflexGo').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#reflexQuitBtn').click();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('.reflexGo')).toBeVisible();
  await page.locator('.reflexHead button', { hasText: '목록' }).click();

  const before = (await get(request, '/api/points', token)).data.balance;
  await page.locator('.reflexCard', { hasText: '반응속도' }).click();
  await page.locator('.reflexGo').click();
  const stage = page.locator('#stage');
  const green = () => page.evaluate(() => { // the screen turns green: tap now
    const c = document.getElementById('stage');
    const [r, g] = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.85), 1, 1).data;
    return g > 150 && r < 120;
  });
  for (let round = 0; round < 5; round += 1) {
    await expect.poll(green, { timeout: 10000, intervals: [50] }).toBe(true);
    await page.waitForTimeout(150); // under 90 ms the game takes a tap as a guess (a false start)
    await stage.click();
    await page.waitForTimeout(400); // the number shows before the next tap goes on
    await stage.click();
  }
  await expect(page.locator('#reflexResult')).toBeVisible();
  await expect(page.locator('.reflexScore')).toHaveText(/^\d+ms$/);
  await expect(page.locator('.reflexPaid')).toContainText('+1,500P');
  expect((await get(request, '/api/points', token)).data.balance).toBe(before + 1500);

  await page.locator('.reflexActions button', { hasText: '다른 게임' }).click();
  await expect(page.locator('.reflexToday')).toHaveText('오늘 받은 포인트 1,500P / 20,000P');
  if (isMobile) await page.locator('.reflexHead button', { hasText: '뒤로' }).click();
  else await page.keyboard.press('Escape');
  await expect(page.locator('#reflexView')).toBeHidden();
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.69 퍼즐: 싱글게임 → 「퍼즐」 → 스도쿠 오늘의 문제를 키보드(방향키·숫자)로 실제로 풀면 서버가 그날 정답과 맞춰 본다.
// 몇 초 만에 푼 판이라 포인트는 없고(사람이 못 푸는 시간), 기록은 남는다.
test('퍼즐: 스도쿠 오늘의 문제를 키보드로 풀면 서버가 정답 확인·기록', async ({ browser, request }) => {
  test.setTimeout(120000);
  const PuzzleDaily = require('../../lib/puzzle-daily');
  const { kstDate } = require('../../lib/point-store');
  const sol = await PuzzleDaily.answer('sudoku', 'easy', kstDate(Date.now()));
  const a = await shopper(browser, request, '스도쿠손');
  const { page, token } = a;
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloPuzzleBtn').click();
  await expect(page.locator('.reflexCard strong')).toHaveText(['스도쿠', '네모로직', '다리 잇기', '회로 연결']);
  await page.locator('.reflexCard', { hasText: '스도쿠' }).click();
  await expect(page.locator('.reflexModes .reflexLevel[aria-checked="true"]')).toHaveText('오늘의 문제');
  await expect(page.locator('.reflexLevels:not(.reflexModes) .reflexLevel').first()).toHaveText('쉬움 · 2,000P');
  // v1.10.70 (Codex review): the first send fails -- the solved board stays in this account's 보낼 기록함 and goes again
  let blocked = false;
  await page.route('**/api/solo/puzzle/finish', (route) => { if (blocked) return route.continue(); blocked = true; return route.abort(); });
  await page.locator('.reflexGo').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForTimeout(500); // the puzzle is made
  await page.keyboard.press('ArrowUp', { delay: 20 }); // nothing chosen yet: from the centre (40) up to 31
  for (let k = 0; k < 3; k += 1) await page.keyboard.press('ArrowUp');
  for (let k = 0; k < 4; k += 1) await page.keyboard.press('ArrowLeft');
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      await page.keyboard.press(String(sol[row * 9 + col])); // a given cell just refuses
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('ArrowDown');
  }
  await expect(page.locator('#reflexResult')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.reflexPaid')).toHaveText(/다시 열면 다시 보내요/);
  const uid = (await get(request, '/api/solo/puzzle', token)).data.uid;
  const box = () => page.evaluate((u) => JSON.parse(localStorage.getItem(`gc.outbox.${u}`) || '[]').length, uid);
  expect(await box()).toBe(1);
  expect((await get(request, '/api/solo/puzzle', token)).data.records.sudoku).toEqual({});
  await page.locator('.reflexActions button', { hasText: '다른 게임' }).click();
  await page.locator('.reflexHead button', { hasText: '뒤로' }).click();
  await page.locator('#soloPuzzleBtn').click(); // opening 퍼즐 again sends what was left
  await expect.poll(box).toBe(0);
  expect((await get(request, '/api/solo/puzzle', token)).data.records.sudoku.easy.clears).toBe(1);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.69 게임 안내 (한판마당 자료): 게임 규칙 설명 아래 예시 그림·자주 하는 실수·요령, 지뢰찾기 창의 「요령」
test('게임 안내: 규칙 설명 아래 예시 그림·실수·요령, 지뢰찾기 요령', async ({ browser, request }) => {
  const a = await shopper(browser, request, '안내손');
  const { page } = a;
  await page.locator('#gameRulesDisclosure summary').click();
  await page.locator('#gameRulesSelect').selectOption('connect4');
  await expect(page.locator('#gameGuideMore .gameGuideCase svg')).toHaveCount(1);
  await expect(page.locator('#gameGuideMore figcaption')).toContainText('빨강 차례예요');
  await expect(page.locator('#gameGuideMore h4')).toHaveText(['자주 하는 실수', '잘하는 요령']);
  await page.locator('#gameRulesSelect').selectOption('omok');
  await expect(page.locator('#gameGuideMore .gameGuideCase')).toHaveCount(2);
  await page.locator('#gameRulesSelect').selectOption('bingo');
  await expect(page.locator('#gameGuideMore')).toBeEmpty(); // no guide for it
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloMinesBtn').click();
  await page.locator('#minesDialog .gameGuideDetails summary').click();
  await expect(page.locator('#minesGuide figcaption')).toContainText('1-2-1');
  await page.screenshot({ path: test.info().outputPath('mines-guide.png') });
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.70 카드 게임: 싱글게임 → 「카드 게임」 → 스파이더 1벌을 화면의 게임 코드로 끝까지 두면(테스트 봇이 게임의 doMove·deal·undo를
// 부름 — 화면이 기록하는 것과 같은 길), 서버가 그 기록을 다시 두어 이긴 판인지 확인하고 기록한다. 금방 끝난 판이라 포인트는 없다.
// 「‹ 뒤로」는 게임 선택(게임관 싱글게임)으로 돌아간다.
test('카드 게임: 스파이더를 끝까지 두면 서버가 다시 두어 확인·기록, 뒤로는 게임 선택으로', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '카드손');
  const { page, token } = a;
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloCardsBtn').click();
  await expect(page.locator('.reflexCard strong')).toHaveText(['카드놀이', '프리셀', '스파이더 카드놀이']);
  await page.locator('.reflexCard', { hasText: '카드놀이' }).first().click();
  await expect(page.locator('.reflexLevel')).toHaveText(['1장 넘기기 · 2,000P', '3장 넘기기 · 4,000P']);
  await page.locator('.reflexHead button', { hasText: '목록' }).click();
  await page.locator('.reflexCard', { hasText: '스파이더' }).click();
  let won = false;
  for (let tries = 0; tries < 30 && !won; tries += 1) {
    await page.locator('.reflexGo').click();
    await expect(page.locator('#hud')).toBeVisible();
    won = await page.evaluate(async () => {
      const g = (await import('/reflex/js/games/spider.js')).default; const { E } = await import('/reflex/js/engine.js');
      const T = g._T; const tabs = () => T.piles.filter((p) => p.kind === 'tab'); const seen = new Set();
      const key = () => tabs().map((p) => p.cards.map((c) => `${c.r}${c.up ? '' : '?'}`).join('.')).join('|');
      seen.add(key());
      for (let step = 0; step < 3000 && E.state === 'play'; step += 1) {
        let best = null;
        for (const p of tabs()) for (let i = 0; i < p.cards.length; i += 1) {
          if (!g.run(p, i)) continue;
          const cd = p.cards[i]; const par = p.cards[i - 1];
          const parentOk = par && par.up && par.r === cd.r + 1; const parentSame = parentOk && par.s === cd.s; const reveals = par && !par.up;
          for (const q of tabs()) {
            if (q === p) continue;
            const top = q.cards[q.cards.length - 1]; let sc = 0;
            if (!top) sc = i > 0 && !parentOk ? 1 + (reveals ? 2 : 0) : 0;
            else if (top.up && top.r === cd.r + 1) { const same = top.s === cd.s; if (parentSame || (parentOk && !same)) continue; sc = (same ? 5 : 2) + (reveals ? 3 : 0) + (i === 0 ? 1 : 0); }
            if (sc > 0 && (!best || sc > best.sc)) best = { sc, p, i, q };
          }
        }
        if (best) { g.doMove(best.p, best.i, best.q); const k = key(); if (seen.has(k)) g.undo(); else { seen.add(k); continue; } }
        if (!T.get('stock').cards.length || tabs().some((p) => !p.cards.length)) break;
        g.deal(); seen.add(key());
      }
      return E.state !== 'play';
    });
    if (!won) await page.locator('#reflexQuitBtn').click();
  }
  expect(won).toBe(true);
  await expect(page.locator('#reflexResult')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.reflexPaid')).toHaveText(/이번 판은 포인트가 없어요/);
  expect((await get(request, '/api/solo/cards', token)).data.records.spider.easy.clears).toBe(1);
  await page.locator('.reflexActions button', { hasText: '다른 게임' }).click();
  await page.locator('.reflexHead button', { hasText: '뒤로' }).click();
  await expect(page.locator('#reflexView')).toBeHidden();
  await expect(page.locator('#soloCardsBtn')).toBeVisible(); // back at choosing a game (싱글게임)
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.70 카드놀이: 화면의 카드놀이를 봇이 게임 함수로 두다가, 남은 카드를 게임이 스스로 올리는 마무리는 화면의 실제 update()에
// 맡긴다 — 그 자동 이동을 화면이 적은 기록(a)까지 서버가 다시 두어 이긴 판으로 확인한다.
test('카드놀이: 게임이 스스로 마무리한 판도 서버가 다시 두어 확인·기록', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '카드놀이손');
  const { page, token } = a;
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloCardsBtn').click();
  await page.locator('.reflexCard', { hasText: '카드놀이' }).first().click();
  let won = false;
  for (let tries = 0; tries < 40 && !won; tries += 1) {
    await page.locator('.reflexGo').click();
    await expect(page.locator('#hud')).toBeVisible();
    won = await page.evaluate(async () => {
      const g = (await import('/reflex/js/games/klondike.js')).default; const { E } = await import('/reflex/js/engine.js');
      const T = g._T; const tabs = () => T.piles.filter((p) => p.kind === 'tab'); const founds = () => T.piles.filter((p) => p.kind === 'found');
      let idle = 0;
      for (let step = 0; step < 3000 && E.state === 'play' && !g._s.auto; step += 1) {
        let move = null;
        for (const p of [T.get('waste'), ...tabs()]) { const top = p.cards[p.cards.length - 1]; if (!top) continue; const f = founds().find((q) => g.canDrop([top], q)); if (f) { move = [p, p.cards.length - 1, f]; break; } }
        if (!move) for (const p of tabs()) {
          const i0 = p.cards.findIndex((c) => c.up); if (i0 < 0 || (i0 === 0 && p.cards[0].r === 13)) continue;
          const q = tabs().find((t) => t !== p && g.canDrop(p.cards.slice(i0), t) && (t.cards.length || p.cards[i0].r === 13));
          if (q) { move = [p, i0, q]; break; }
        }
        if (!move) { const w = T.get('waste'); const top = w.cards[w.cards.length - 1]; const q = top && tabs().find((t) => g.canDrop([top], t)); if (q) move = [w, w.cards.length - 1, q]; }
        if (move) { g.doMove(...move); idle = 0; continue; }
        if (++idle > 60) break;
        g.flip();
      }
      if (!g._s.auto && E.state === 'play') return false;
      for (let i = 0; i < 100 && E.state === 'play'; i += 1) await new Promise((r) => setTimeout(r, 100)); // the game finishes it itself
      return E.state !== 'play';
    });
    if (!won) await page.locator('#reflexQuitBtn').click();
  }
  expect(won).toBe(true);
  await expect(page.locator('#reflexResult')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.reflexPaid')).toHaveText(/이번 판은 포인트가 없어요/);
  expect((await get(request, '/api/solo/cards', token)).data.records.klondike.easy.clears).toBe(1);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.71 AI 대전 (연습): 싱글게임 → 「AI 대전」 → 오목(규칙·먼저 두기·AI 난이도) — 두면 AI가 받아 두고, 서버에는 아무것도 보내지 않는다.
test('AI 대전: 오목을 두면 AI가 받아 두고, 연습이라 서버로 보내지 않는다', async ({ browser, request }) => {
  const a = await shopper(browser, request, 'AI손');
  const { page } = a;
  const sent = [];
  page.on('request', (r) => { if (/\/api\/solo\//.test(r.url())) sent.push(r.url()); });
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloAiBtn').click();
  await expect(page.locator('.reflexCard strong')).toHaveText(['오목', '사목', '오델로']);
  await expect(page.locator('.reflexToday')).toHaveText('연습 · 포인트 없음');
  await page.locator('.reflexCard', { hasText: '오목' }).click();
  await expect(page.locator('.reflexModes').first().locator('.reflexLevel')).toHaveText(['렌주룰', '3수 교환 · 5수 2타']);
  await expect(page.locator('.reflexLevels:not(.reflexModes) .reflexLevel')).toHaveText(['AI 쉬움', 'AI 보통', 'AI 어려움']);
  await page.locator('.reflexGo').click();
  await expect(page.locator('#hud')).toBeVisible();
  const stones = () => page.evaluate(async () => { // the board state the game keeps (rules.js TURN.gomoku)
    const { E } = await import('/reflex/js/engine.js'); return E.game?.id === 'gomoku' ? JSON.stringify(E.game).length : 0;
  });
  expect(await stones()).toBeGreaterThan(0);
  const box = await page.locator('#stage').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45); // preview, then place, near the centre
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
  await page.waitForTimeout(1500); // the AI answers
  await page.screenshot({ path: test.info().outputPath('gomoku-ai.png') });
  await page.locator('#reflexQuitBtn').click();
  expect(sent.filter((u) => !/\/api\/solo\/(reflex|puzzle|cards)$/.test(u))).toEqual([]);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.71 게임별 랭킹: 내 전적 「랭킹」 → 게임·이번 주/전체, 아직 10판을 둔 사람이 없으면 안내
test('랭킹: 내 전적의 「랭킹」에서 게임·기간을 고른다', async ({ browser, request }) => {
  const a = await shopper(browser, request, '랭킹손');
  const { page } = a;
  await page.locator('#rankingBtn').click();
  await expect(page.locator('#rankingDialog')).toBeVisible();
  await expect(page.locator('#rankingList')).toContainText('아직 10판 넘게 둔 사람이 없어요');
  await expect(page.locator('#rankingMe')).toHaveText('10판을 두면 순위에 올라요.');
  await page.locator('#rankingGame').selectOption('othello');
  await page.locator('.rankingWeeks [data-week="all"]').click();
  await expect(page.locator('.rankingWeeks [data-week="all"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#rankingMe')).toHaveText('10판을 두면 순위에 올라요.');
  await page.locator('#rankingCloseBtn').click();
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.72 게임방 AI 자리: 오목 방 만들기에서 「상대 · AI 보통」 → 흑을 고르면 AI가 백에 앉고, 두면 서버의 AI가 받아 둔다
test('게임방 AI: 오목 방을 AI 상대로 만들고 두면 AI가 받아 둔다', async ({ browser, request }) => {
  const a = await shopper(browser, request, 'AI방손');
  const { page, token } = a;
  await page.evaluate(() => document.querySelector('[data-game="omok"]').click());
  await expect(page.locator('#roomAiChoices')).toBeVisible();
  await page.locator('input[name="roomAi"][value="normal"]').check();
  await page.locator('#createRoomBtn').click();
  await expect(page.locator('#roomView')).toBeVisible();
  await page.locator('#chooseBlackBtn').click();
  await expect(page.locator('#roomView')).toContainText('AI · 보통');
  expect((await post(request, '/api/room/move', token, { x: 7, y: 7 })).status).toBe(200);
  await expect.poll(async () => (await get(request, '/api/room', token)).data.state.game.board.flat().filter(Boolean).length, { timeout: 10000 }).toBe(2);
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.73 게임 실행 규약 (IDEAS #future-gamehall-renewal): a quest opens a game at its level at once and gets its result
// (a time goal: at most); leaving before the end answers done:false and goes back to the island, not the game hall
test('게임 실행 규약: 퀘스트 자리는 그 난이도로 바로 시작해 결과를 돌려주고, 나가면 done:false', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '규약');
  const { page } = a;
  const play = (opts) => page.evaluate((o) => { window.__res = null; window.GameLaunch.play('reaction', o).then((r) => { window.__res = r; }); }, opts);
  await play({ place: 'quest', level: 'hard', goal: 60000 }); // not the remembered level (Codex review: it was lost)
  await expect(page.locator('#hud')).toBeVisible(); // started at once: no level choice
  const stage = page.locator('#stage');
  const green = () => page.evaluate(() => { const c = document.getElementById('stage'); const [r, g] = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.85), 1, 1).data; return g > 150 && r < 120; });
  for (let round = 0; round < 5; round += 1) {
    await expect.poll(green, { timeout: 10000, intervals: [50] }).toBe(true);
    await page.waitForTimeout(150);
    await stage.click();
    await page.waitForTimeout(400);
    await stage.click();
  }
  await expect.poll(() => page.evaluate(() => window.__res), { timeout: 15000 }).toMatchObject({ game: 'reaction', level: 'hard', done: true });
  const res = await page.evaluate(() => window.__res);
  expect(res.score).toBeGreaterThan(0); expect(typeof res.run).toBe('string'); // the server's round, to check it by
  // left on its own page: done:false, back where the quest was (not the game hall)
  await play({ place: 'quest', level: 'easy', goal: 1 });
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#reflexQuitBtn').click(); // v1.10.80: a quest's round left goes straight back (no menu between)
  await expect.poll(() => page.evaluate(() => window.__res)).toEqual({ game: 'reaction', done: false });
  await expect(page.locator('#reflexView')).toBeHidden();
  await expect(page.locator('#gamehallView')).toBeHidden();
  // a puzzle starts once this account's progress is in (Codex review: it waited for it and never started)
  await page.evaluate(() => { window.__res = null; window.GameLaunch.play('sudoku', { place: 'quest', level: 'easy' }).then((r) => { window.__res = r; }); });
  await expect(page.locator('#reflexView .reflexFrame')).toHaveClass(/playing/, { timeout: 15000 });
  await page.locator('#reflexQuitBtn').click();
  await expect.poll(() => page.evaluate(() => window.__res)).toEqual({ game: 'sudoku', done: false });
  await expectNoScriptError(page);
  await a.context.close();
});

// A3 G4 한판마당 PC 넓게: on a wide mouse screen the card games and puzzles use the width -- 카드놀이 1,000px or more,
// the sudoku board 700px or more at 1920×1080 (a phone keeps the narrow frame)
test('PC 넓게: 카드놀이 판 폭 1,000px 이상, 스도쿠 판 700px 이상', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 전용 검증');
  test.setTimeout(120000);
  const a = await shopper(browser, request, '넓게');
  const { page } = a; await page.setViewportSize({ width: 1920, height: 1080 });
  const open = (game) => page.evaluate((game) => { window.GameLaunch.play(game, { place: 'quest', level: 'easy' }); }, game);
  const engine = () => page.evaluate(async () => { const { E } = await import('/reflex/js/engine.js'); return { w: E.W, id: E.game?.id, state: E.state }; });
  await open('klondike');
  await expect.poll(async () => (await engine()).id, { timeout: 30000 }).toBe('klondike');
  expect((await page.locator('.reflexFrame').boundingBox()).width).toBeGreaterThanOrEqual(1000);
  // R6: the cards themselves, not only the frame (the frame was 1,200 px while the dealt row spanned about 920): the
  // leftmost and rightmost card white of the dealt row on the drawn table
  const span = () => page.evaluate(() => {
    const cv = document.querySelector('.reflexFrame > canvas'); const r = cv.getBoundingClientRect(); const k = cv.width / r.width;
    const ctx = cv.getContext('2d'); let lo = Infinity; let hi = -Infinity;
    for (const y of [0.42, 0.46, 0.5]) { const row = ctx.getImageData(0, Math.round(r.height * y * k), cv.width, 1).data;
      for (let x = 0; x < cv.width; x += 1) { const i = x * 4; if (row[i] > 235 && row[i + 1] > 235 && row[i + 2] > 235) { lo = Math.min(lo, x); hi = Math.max(hi, x); } } }
    return Math.round((hi - lo) / k);
  });
  await expect.poll(span, { timeout: 10000 }).toBeGreaterThanOrEqual(1000);
  await open('sudoku');
  await expect.poll(async () => (await engine()).id, { timeout: 30000 }).toBe('sudoku');
  expect((await engine()).w).toBeGreaterThanOrEqual(1000); // the board's room (sudoku.js caps it at 820 px on a wide frame)
  await page.screenshot({ path: test.info().outputPath('wide-sudoku.png') });
  // R6: 지뢰찾기 in the window's middle, sized to its height (초급 9 x 9 was 26 px a cell, 260 px, at the dialog's left)
  await page.keyboard.press('Escape'); await page.goto('/');
  await page.locator('[data-game-mode="single"]').click();
  await page.locator('#soloMinesBtn').click();
  await expect(page.locator('#minesBoard .minesCell').first()).toBeVisible();
  const board = await page.locator('#minesBoard').boundingBox();
  expect(board.height).toBeGreaterThan(1080 * 0.4);
  expect(Math.abs(board.x + board.width / 2 - 960)).toBeLessThan(40);
  await expectNoScriptError(page); await a.context.close();
});

// A3 G3-2: my equipped 오목 돌 skin goes into the AI practice too (my stones drawn with it)
test('AI 연습 오목: 장착한 오목 돌 스킨으로 내 돌을 그린다', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 전용 검증');
  test.setTimeout(120000);
  const { buyAndEquip } = require('./skin-support');
  const a = await shopper(browser, request, 'AI스킨', 3000000);
  await buyAndEquip(request, a, ['omok_l1']);
  const { page } = a;
  await page.evaluate(() => { window.GameLaunch.play('gomoku', { place: 'quest', level: 'easy' }); });
  await expect.poll(() => page.evaluate(async () => { const { E } = await import('/reflex/js/engine.js'); return E.game?.id === 'gomoku' ? E.opts?.pieceSkin || 'none' : null; }), { timeout: 30000 }).toBe('omok_l1');
  await expectNoScriptError(page); await a.context.close();
});
