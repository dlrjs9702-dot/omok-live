const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.192 U2 메뉴 안 창도 종이 (gamecenter-notes docs/island-hud-paper-20261026.md, 사용자 「내 정보·문제 기록·가구 창고 등 UI
// 통일」): on the island the ☰'s windows, the bag's pets, the name asked and the 접속 종료 question are one paper sheet --
// its paper, its head's ✕ (named 「닫기」), its words >= 4.5:1 on it; the theme 「게임관 화면:」 밝게 / 어둡게; the pets
// each with a face, the one walking 「함께 다니는 중」. PC and phone.
test('섬 창 종이: ☰ 창·반려동물·이름 짓기·접속 종료가 종이색, 글자 대비 4.5 이상, 머리 ✕', async ({ browser, request }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '종이창', 50000, 'female'); const { page, token } = who;
  await post(request, `/api/admin/keys/${who.id}/issues`, who.admin, { allowed: true });
  await post(request, '/api/test/island/give', token, { itemId: 'pet_puppy', qty: 1 });
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  // the sheet's colours and the worst contrast of its words on it (each text's own colour against the paper)
  const look = (sel) => page.evaluate((sel) => {
    const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const d = document.querySelector(sel); const bg = getComputedStyle(d).backgroundColor;
    const words = [...d.querySelectorAll('h2,h3,p,label,span,strong,small')].filter((e) => e.offsetParent && e.textContent.trim() && !e.closest('button,.skinTryOn') && getComputedStyle(e).backgroundColor === 'rgba(0, 0, 0, 0)');
    const close = d.querySelector('.recordsDialogHead>button:last-child');
    return { bg, worst: Math.min(...words.map((e) => ratio(getComputedStyle(e).color, bg))), close: close ? { name: close.textContent.trim(), mark: getComputedStyle(close, '::after').content } : null };
  }, sel);
  const paper = 'rgb(255, 246, 227)';
  const closeAll = () => page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  const menu = async () => { await closeAll(); await page.locator('#gameMenuBtn').click(); await expect(page.locator('#gameMenuDialog')).toBeVisible(); };
  await menu();
  await expect(page.locator('#gameMenuThemesLabel')).toHaveText('게임관 화면:');
  await expect(page.locator('.gameMenuThemes label')).toHaveText(['밝게', '어둡게', '기기 설정']);
  for (const [button, sel] of [[null, '#gameMenuDialog'], ['#myInfoBtn', '#myInfoDialog'], ['#issueLogBtn', '#issueDialog'], ['#furnitureStorageBtn', '#plazaDialog'], ['#myHomeBtn', '#plazaDialog'], ['#logoutBtn', '#logoutDialog']]) {
    if (button) { await menu(); await page.locator(button).click(); }
    await expect(page.locator(sel)).toBeVisible();
    const l = await look(sel);
    expect(l.bg, sel).toBe(paper); expect(l.worst, sel).toBeGreaterThanOrEqual(4.5);
    if (sel !== '#logoutDialog') expect(l.close, sel).toEqual({ name: '닫기', mark: '"✕"' });
  }
  await closeAll();
  // the pets: a face each; taken along from the bag with a name asked on paper -- 「함께 다니는 중」
  await page.locator('#islandBagTab').click(); await page.locator('.islandBagSlot[data-item="pet_puppy"]').click(); await page.locator('.islandBagSlot[data-item="pet_puppy"] button').click();
  await expect(page.locator('#nameAskDialog')).toBeVisible();
  expect((await look('#nameAskDialog')).bg).toBe(paper);
  await page.locator('#nameAskInput').fill('누렁'); await page.locator('#nameAskOk').click(); await expect(page.locator('#nameAskDialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')?.name), { timeout: 15000 }).toBe('누렁');
  await closeAll(); await page.locator('#islandBagTab').click(); await page.locator('#myPetsBtn').click();
  await expect(page.locator('#myPets .myPetRow .petFace').first()).toHaveText('🐶');
  await expect(page.locator('#myPets .myPetRow.walking .walkingTag')).toHaveText('함께 다니는 중');
  const l = await look('#plazaDialog'); expect(l.bg).toBe(paper); expect(l.worst).toBeGreaterThanOrEqual(4.5);
  // a name asked and let go: nothing changes
  await page.locator('#myPets .myPetRow.walking button', { hasText: '이름 바꾸기' }).click();
  await page.locator('#nameAskCancel').click(); await expect(page.locator('#nameAskDialog')).toBeHidden();
  expect(await page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')?.name)).toBe('누렁');
  await expectNoScriptError(page);
  await who.context.close();
});
