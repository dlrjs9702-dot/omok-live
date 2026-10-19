const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// B 47 처음 온 사람 안내 (IDEAS #future-onboarding; 사용자 2026-10-18: 첫 접속이면 무조건, 끝난 뒤에도 광장 한쪽 안내 주민이
// 말 걸면 가르쳐 줌): the steps one by one with a big line and an arrow, done where they happen, the welcome paid once;
// her talk teaches again or starts it over. (Tests start it themselves -- a test account is new.) PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('안내 주민: 단계마다 큰 안내·화살표, 걷기·화면 돌리기·말 걸기로 진행, 끝나면 환영 선물 한 번, 말 걸면 다시 배우기', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '새내기', 0, 'female');
  const { page } = a;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  expect((await get(request, '/api/island/guide', a.token)).data.active).toBe(false); // (not started by itself in tests)
  await expect(page.locator('#guidePanel')).toBeHidden();
  expect((await page.evaluate(() => window.PlazaDebug().guide())).door).toBeTruthy(); // she stands there anyway
  // talking to her: the topics and 「처음부터 다시 배우기」
  const G = T.VILLAGE.guide; const door = { x: G.x - Math.sin(G.yaw) * 1.2, z: G.z - Math.cos(G.yaw) * 1.2 };
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [door.x, door.z]); await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: '처음부터 다시 배우기' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '걸어 보기' }).click(); await expect(page.locator('.lostRequestLine')).toContainText('방향키');
  await page.getByRole('button', { name: '처음부터 다시 배우기' }).click();
  await expect(page.locator('#guidePanel')).toContainText('안내 1/7'); await expect(page.locator('#guidePanel')).toContainText('걸어 보기');
  // 1 걷기, 2 화면 돌리기: watched on the page
  await page.evaluate(() => window.PlazaDebug().teleport(0, 0));
  await expect(page.locator('#guidePanel')).toContainText('화면 돌려 보기', { timeout: 10000 });
  await page.evaluate(() => window.PlazaDebug().setCamYaw(1.5));
  await expect(page.locator('#guidePanel')).toContainText('주민에게 말 걸기', { timeout: 10000 });
  // 3 말 걸기: the arrow toward her while far, gone by her; talking to her marks it
  await page.evaluate(() => window.PlazaDebug().teleport(-20, -20)); await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.PlazaDebug().guide())).toMatchObject({ arrow: true, target: { x: G.x, z: G.z } });
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [door.x, door.z]); await page.waitForTimeout(600);
  expect((await page.evaluate(() => window.PlazaDebug().guide())).arrow).toBe(false);
  await page.keyboard.press('Space'); await expect(page.locator('#guidePanel')).toContainText('잡초 하나 뽑기', { timeout: 10000 });
  await page.locator('.lostRequest').getByRole('button', { name: '닫기' }).click();
  // a step out of order counts for nothing; the rest in order, the welcome once
  expect((await post(request, '/api/island/guide', a.token, { done: 'menu' })).data.step).toBe(3);
  let last = null; for (const kind of ['weed', 'deliver', 'games', 'menu']) last = (await post(request, '/api/island/guide', a.token, { done: kind })).data;
  expect([last.done, last.active, last.gift]).toEqual([true, false, 2000]);
  await post(request, '/api/island/guide', a.token, { restart: true });
  for (const kind of ['move', 'camera', 'talk', 'weed', 'deliver', 'games', 'menu']) last = (await post(request, '/api/island/guide', a.token, { done: kind })).data;
  expect([last.done, last.gift]).toEqual([true, 0]); // (the welcome was paid)
  await expectNoScriptError(page);
  await a.context.close();
});
