const { test, expect } = require('@playwright/test');
const { get, shopper, expectNoScriptError } = require('./skin-support');

// v1.10.68 순발력 게임 (한판마당 자료): 싱글게임 → 「순발력 게임」 → 다섯 게임 목록 → 반응속도 다섯 라운드를 실제로 하고
// 결과·포인트, 판 중간에 그만두면 보고하지 않음, 나가면 아일랜드로. PC(마우스·Esc)와 휴대폰(터치) 모두.
test('순발력 게임: 목록 → 반응속도 완주 → 결과·+1,500P → 나가기', async ({ browser, request, isMobile }) => {
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
  if (isMobile) await page.locator('.reflexHead button', { hasText: '나가기' }).click();
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
  await expect(page.locator('.reflexPaid')).toHaveText(/이번 기록은 포인트가 없어요/);
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
