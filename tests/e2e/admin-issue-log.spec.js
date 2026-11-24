const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// 관리자 「문제 기록」 (사용자 2026-10-18, docs/admin-issue-log-20261018.md): from the menu over whatever is on screen, the
// words and a kind with the screen, place, device, frame rate, recent errors and a picture; the 관리자 창's card lists,
// changes state and removes them. Not for other accounts. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('문제 기록: 관리자 메뉴에서 적으면 화면 정보·사진과 저장, 관리자 창에서 상태 바꾸기·지우기, 다른 계정은 없음', async ({ browser, request }) => {
  test.setTimeout(150000);
  const guest = await shopper(browser, request, '일반계정', 0, 'male');
  expect((await get(request, '/api/admin/issues', guest.token)).status).toBe(403); expect((await get(request, '/api/admin/storage', guest.token)).status).toBe(403); // (v1.10.256 저장 공간: the administrator's only)
  await guest.page.keyboard.press('Escape'); await expect(guest.page.locator('#gameMenuDialog')).toBeVisible();
  await expect(guest.page.locator('#issueLogBtn')).toBeHidden();
  await guest.context.close();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await context.newPage();
  await page.goto('/'); await page.locator('#adminPassword').fill(adminPassword);
  const [login] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/admin/login')), page.getByRole('button', { name: '관리자로 입장' }).click()]);
  const admin = (await login.json()).sessionToken;
  await post(request, '/api/avatar/gender', admin, { gender: 'female' }); await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload(); // (the island, its first-visit choice made)
  if (!(await page.locator('#lobbyView').isVisible().catch(() => false))) { await page.locator('#adminPassword').fill(adminPassword).catch(() => {}); await page.getByRole('button', { name: '관리자로 입장' }).click().catch(() => {}); }
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  // written over the island: Ctrl+Enter saves
  await page.keyboard.press('Escape'); await page.locator('#issueLogBtn').click();
  await expect(page.locator('#issueDialog')).toBeVisible(); await expect(page.locator('#issueShot')).toBeVisible();
  await page.locator('#issueText').fill('광장 벤치가 공중에 떠 있음'); await page.locator('#issueKind').selectOption('odd');
  await page.locator('#issueText').press('Control+Enter');
  await expect(page.locator('#issueDialog')).toBeHidden();
  const all = (await get(request, '/api/admin/issues', admin)).data.issues; const mine = all.find((i) => i.text === '광장 벤치가 공중에 떠 있음');
  expect(mine).toMatchObject({ kind: 'odd', status: 'open', hasShot: true, version: expect.stringMatching(/^1\.10\./), ctx: { screen: 'island', island: { space: 'island' }, device: { touch: false }, perf: { px: expect.stringMatching(/^\d+x\d+$/), pixelRatio: expect.any(Number), jsMs: expect.any(Number) } } }); /* (313 ㅁ: the screen's weight) */
  expect(mine.shot).toBeUndefined(); // (저장 정리 2026-10-21: the list has no pictures, each one is fetched on its own)
  const shot = (await get(request, `/api/admin/issues/${mine.id}/shot`, admin)).data.shot;
  expect(shot).toMatch(/^data:image\/jpeg;base64,/); expect(shot.length).toBeLessThanOrEqual(60000);
  expect((await get(request, `/api/admin/issues/${mine.id}/shot`, guest.token)).status).toBe(403);
  // the card: listed, its state changed, removed
  await page.keyboard.press('Escape'); await page.locator('#adminWindowBtn').click();
  // (v1.10.256) the 저장 공간 line: how full against its 1 GB, the biggest opened below
  await expect(page.locator('#adminStorageLine')).toHaveText(/^\d+(\.\d)?% · [\d.]+ [MG]B \/ 1 GB/, { timeout: 15000 });
  await page.locator('#adminTabs [data-tab="status"]').click(); /* (293: its 현황 tab) */
  await page.locator('#adminStorage summary').click(); await expect(page.locator('#adminStorageTables li').first()).toBeVisible();
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-admin-storage.png` });
  await page.locator('#adminStorage summary').click();
  await page.locator('#issueCard summary').first().click();
  const row = page.locator('.issueItem', { hasText: '광장 벤치가 공중에 떠 있음' });
  await expect(row).toBeVisible(); await row.locator('summary').click();
  await expect(row.locator('img.issueShot')).toBeVisible();
  await row.locator('select').selectOption('doing');
  await expect.poll(async () => (await get(request, '/api/admin/issues', admin)).data.issues.find((i) => i.id === mine.id)?.status).toBe('doing');
  await page.locator('#issueFilter').selectOption('doing');
  page.once('dialog', (d) => d.accept());
  await page.locator('.issueItem', { hasText: '광장 벤치가 공중에 떠 있음' }).locator('summary').click();
  await page.locator('.issueItem', { hasText: '광장 벤치가 공중에 떠 있음' }).getByRole('button', { name: '지우기' }).click();
  await expect.poll(async () => (await get(request, '/api/admin/issues', admin)).data.issues.some((i) => i.id === mine.id)).toBe(false);
  expect((await get(request, `/api/admin/issues/${mine.id}/shot`, admin)).status).toBe(404); // (its picture went with it)
  /* (1.10.431 사용자 「이것도 고친거 아냐?」 · 계정 자세히 사진: every inner part of the admin window on the island's paper -- each tab with its groups
     open, the account's panel (and as a phone's bottom sheet), the point grant: each word against what is really behind it >= 4.5, no navy face, the
     account's close the head's ✕) */
  const paperCheck = (sel) => page.evaluate((sel) => {
    const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const root = document.querySelector(sel); const opaque = (c) => !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent';
    const bgOf = (e) => { for (let n = e; n && n !== document; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (opaque(c)) return c; } return 'rgb(255, 255, 255)'; };
    const words = [...root.querySelectorAll('h2,h3,h4,p,label,span,strong,small,b,button,summary,td,th,li,legend')].filter((e) => e.offsetParent && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && !e.closest('.presenceBadge,.badge,input,select,textarea'));
    const low = words.map((e) => ({ t: e.textContent.trim().slice(0, 16), r: +ratio(getComputedStyle(e).color, bgOf(e)).toFixed(2) })).filter((w) => w.r < 4.5);
    const NAVY = ['rgb(15, 23, 42)', 'rgb(17, 24, 39)', 'rgb(30, 41, 59)', 'rgb(51, 65, 85)', 'rgb(17, 26, 46)', 'rgb(11, 19, 36)'];
    const navy = [...root.querySelectorAll('*:not(input[type="checkbox"]):not(input[type="radio"])')].filter( /* (a checkbox the browser draws -- its accent, as island-paper-windows) */(e) => e.offsetParent && NAVY.includes(getComputedStyle(e).backgroundColor)).map((e) => e.id || e.className || e.tagName);
    return { low: low.slice(0, 6), navy: navy.slice(0, 6) };
  }, sel);
  const openAll = () => page.evaluate(() => { for (const d of document.querySelectorAll('#plazaDialog .adminTab:not([hidden]) details, #plazaDialog #adminPresencePanel:not(.tabOff) details')) d.open = true; });
  for (const tabName of ['status', 'accounts', 'island', 'economy']) {
    await page.locator(`#adminTabs [data-tab="${tabName}"]`).click(); await openAll(); await page.waitForTimeout(800);
    expect(await paperCheck('#plazaDialog'), tabName).toEqual({ low: [], navy: [] });
  }
  /* (the 섬 운영 groups fold as the others, and stay as they were left: 섬 환경 shut, opened again after the window is shut and opened) */
  await page.locator('#adminTabs [data-tab="island"]').click();
  for (const id of ['islandEnvBox', 'contestBox', 'opsSwitchBox']) await expect(page.locator(`#${id} > summary`)).toBeVisible();
  await page.locator('#islandEnvBox > summary').click(); await expect(page.locator('#islandEnvBox')).not.toHaveAttribute('open', '');
  await page.locator('#plazaCloseBtn').click(); await page.keyboard.press('Escape'); await page.locator('#adminWindowBtn').click(); await page.locator('#adminTabs [data-tab="island"]').click();
  await expect(page.locator('#islandEnvBox')).not.toHaveAttribute('open', ''); await expect(page.locator('#contestBox')).toHaveAttribute('open', '');
  // 계정 자세히: on the paper, its close the head's ✕ (no 「닫기」 word); as a phone's bottom sheet too
  await page.locator('#adminTabs [data-tab="accounts"]').click(); await page.locator('.accountRow').first().click(); await expect(page.locator('#accountDetail')).toBeVisible();
  const closeMark = () => page.evaluate(() => { const b = document.querySelector('#accountDetail .accountDetailHead > button:last-child'); return b ? [b.textContent.trim(), getComputedStyle(b, '::after').content, getComputedStyle(b).fontSize] : null; });
  expect(await closeMark()).toEqual(['닫기', '"✕"', '0px']); expect(await paperCheck('#accountDetail')).toEqual({ low: [], navy: [] });
  await page.setViewportSize({ width: 700, height: 900 }); await page.waitForTimeout(500);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('accountDetail')).position)).toBe('fixed'); expect(await paperCheck('#accountDetail')).toEqual({ low: [], navy: [] });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#accountDetail button', { hasText: '포인트 지급' }).click(); await expect(page.locator('#pointGrantDialog')).toBeVisible();
  expect(await paperCheck('#pointGrantDialog')).toEqual({ low: [], navy: [] });
  await expectNoScriptError(page);
  await context.close();
});
