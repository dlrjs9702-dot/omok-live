const { test, expect } = require('@playwright/test');
const { post, shopper, expectNoScriptError } = require('./skin-support');

// v1.10.80 농부 × 두더지 잡기 (IDEAS #future-island-minigames): the farmer (his own model, the mallet in hand) by the
// field; a word with him asks for 두더지 잡기, 「도와줄게요」 opens the round right there; the field shows the week's
// shared stage and the helpers on its sign. PC 전용 (the same talk and game on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('농부: 말 걸기 → 도와줄게요 → 두더지 잡기, 밭·팻말·농부 모델', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '농부손님');
  const { page, token } = a;
  await page.setViewportSize({ width: 960, height: 680 });
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
  const at = require('../../lib/island-quests').STORIES.farmer.at;
  const placed = await page.evaluate(async ({ x, z, token }) => {
    await window.PlazaWarp(x, z);
    const r = await fetch('/api/plaza/state', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': token }, body: JSON.stringify({ x, z, yaw: 0, moving: false }) });
    const d = await r.json(); if (r.ok) window.PlazaDebug().teleport(d.x, d.z); return r.status;
  }, { x: at.x - 1.2, z: at.z, token });
  expect(placed).toBe(200);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().find((q) => q.id === 'questfarmer')), { timeout: 20000 }).toMatchObject({ mark: 'new', worn: true });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().farm()), { timeout: 20000 }).toEqual({ stage: 0, names: '' });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().near), { timeout: 10000 }).toBe('ev:quest_npc:questfarmer');
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('두더지', { timeout: 15000 }); // the talk's answer (a busy runner)
  // (Q 부탁 받기: the ask's note -- what, what it pays -- and 「할게요!」 / 「다음에요」; it starts with 할게요)
  await expect(page.locator('#plazaDialog .questNote')).toContainText('받는 것');
  await page.locator('#plazaDialog').getByRole('button', { name: '할게요!' }).click();
  await expect(page.locator('#questTracker .questLine')).toHaveCount(1);
  await page.locator('#plazaDialog').getByRole('button', { name: '도와줄게요' }).click();
  await expect(page.locator('#reflexView')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#plazaDialog')).toBeHidden();
  await expect(page.locator('#reflexView')).toContainText('‹ 섬으로');
  await page.keyboard.press('Escape'); // left: straight back to the island
  await expect(page.locator('#reflexView')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().running), { timeout: 15000 }).toBe(true);

  // another helper hands the game step in: the field grows on this screen too, the name on the sign
  const other = await shopper(browser, request, '먼저도움');
  await post(request, '/api/plaza/state', other.token, { x: at.x + 1, z: at.z, yaw: 0 });
  await post(request, '/api/island/event', other.token, { id: 'questfarmer', accept: true });
  await post(request, '/api/test/quest/note', other.token, { what: 'minigame:whack', qty: 250 });
  expect((await post(request, '/api/island/event', other.token, { id: 'questfarmer' })).data.reward).toBe(3000);
  await expect.poll(async () => (await request.get('/api/island/farm', { headers: { 'X-Session-Token': token } })).json(), { timeout: 10000 }).toMatchObject({ stage: 1, names: ['먼저도움'] });
  await expectNoScriptError(page);
  await other.context.close(); await a.context.close();
});
