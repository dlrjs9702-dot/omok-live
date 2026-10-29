const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.10.78 메신저 (IDEAS #future-messenger) → 메신저 단독 창 (docs/messenger-standalone-20261025.md B안): the messenger is
// its own page, /messenger -- logged in there and kept on this device (a reload keeps it), or opened from 내 계정 (its
// window gets the login, and the button opens the same window again); a room, a line, the other side gets it at once.
// Only the accounts the administrator let in. PC and phone alike.
let n = 0;
const ip = () => `100.78.${process.pid % 250}.${(++n + Math.floor(Math.random() * 200)) % 250 + 1}`;
async function api(request, route, { token, account, body } = {}) {
  const options = { headers: { 'X-Forwarded-For': ip(), ...(token ? { 'X-Session-Token': token } : {}), ...(account ? { 'X-Account-Token': account } : {}) } };
  const res = body === undefined ? await request.get(route, options) : await request.post(route, { ...options, data: body });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

test('메신저 단독 창: 로그인 유지(새로고침해도), 내 계정에서 같은 창으로 열기·안 읽은 수, 방 만들기 → 메시지 → 상대가 바로 받음', async ({ browser, request }, info) => {
  test.setTimeout(120000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, allowed) => {
    const loginId = `m${tag}_${stamp}`.slice(0, 20); const nickname = `${{ a: '엄마', b: '아빠', c: '아이' }[tag]}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    if (allowed) await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
    return { context, nickname, loginId };
  };
  const mom = await make('a', true); const dad = await make('b', true); const kid = await make('c', false);
  // 내 계정 (the start page): no button for one not let in
  const onAccount = async (p) => { const r = await api(request, '/api/account/login', { body: { loginId: p.loginId, password: 'secret123' } }); const account = r.data.accountToken; expect(account, JSON.stringify(r)).toBeTruthy(); await p.context.addInitScript((t) => sessionStorage.setItem('gc.account', t), account); const page = await p.context.newPage(); await page.goto('/'); await expect(page.locator('#accountPanel')).toBeVisible({ timeout: 30000 }); return page; }; // (a fresh context fetches the game's resource pack first)
  const kidPage = await onAccount(kid); await expect(kidPage.locator('#accountMessengerBtn')).toBeHidden();
  // mom: the messenger page alone, logged in there and kept on this device
  const m = await mom.context.newPage(); await m.goto('/messenger');
  await m.locator('#mLoginId').fill(mom.loginId); await m.locator('#mLoginPw').fill('secret123'); await expect(m.locator('#mKeep')).toBeChecked();
  await m.locator('#mLogin').getByRole('button', { name: '로그인' }).click();
  await expect(m.locator('#mApp')).toBeVisible();
  await m.reload(); await expect(m.locator('#mApp')).toBeVisible(); await expect(m.locator('#mLogin')).toBeHidden(); // (the device's login, not the tab's)
  await m.locator('#messengerNewBtn').click();
  await m.locator('#messengerPickName').fill('우리집');
  await m.locator('#messengerPeople label', { hasText: dad.nickname }).locator('input').check();
  await m.locator('#messengerPick').getByRole('button', { name: '확인' }).click();
  await expect(m.locator('#messengerRoomName')).toHaveText('우리집');
  await m.locator('#messengerInput').fill('저녁 뭐 먹어?');
  await m.locator('#messengerForm').getByRole('button', { name: '보내기' }).click();
  await expect(m.locator('#messengerMessages .chatMessage.mine')).toHaveText(/저녁 뭐 먹어\?/);
  await expect(m.locator('#messengerMessages .messengerSystem')).toHaveText(/님을 초대했습니다/);
  await expect(m.locator('#messengerMessages .chatMessage.mine .messengerReadCount')).toHaveText('1'); // dad has not read it
  // dad: 내 계정's button tells what is unread and opens the messenger window with his login
  const home = await onAccount(dad);
  await expect(home.locator('#accountMessengerBtn')).toContainText('새 메시지 2'); // the invite line + the message (server count)
  const [d] = await Promise.all([home.waitForEvent('popup'), home.locator('#accountMessengerBtn').click()]);
  await expect(d.locator('#mApp')).toBeVisible(); await expect(d.locator('#mLogin')).toBeHidden();
  await expect(d.locator('#messengerRoomList button', { hasText: '우리집' })).toContainText('저녁 뭐 먹어?');
  await d.locator('#messengerRoomList button', { hasText: '우리집' }).click();
  await expect(d.locator('#messengerMessages .chatMessage')).toHaveText(/저녁 뭐 먹어\?/);
  // the button again: the same window (no second one)
  let second = null; home.once('popup', (p) => { second = p; }); await home.locator('#accountMessengerBtn').click(); await home.waitForTimeout(1500);
  expect(second).toBeNull(); expect(home.context().pages().filter((p) => p.url().includes('/messenger'))).toHaveLength(1);
  await d.locator('#messengerInput').fill('김치찌개');
  await d.locator('#messengerInput').press('Enter');
  await expect(m.locator('#messengerMessages .chatMessage:not(.mine)')).toHaveText(/김치찌개/, { timeout: 2500 }); // at once by the stream
  await expect(m.locator('#messengerMessages .messengerReadCount')).toHaveCount(0); // dad read it: the 「1」 is gone
  // (Codex 검토 2차 #6) a line unsent after the other side got it shows as deleted there too
  await m.locator('#messengerInput').fill('잘못 보냄'); await m.locator('#messengerInput').press('Enter');
  await expect(d.locator('#messengerMessages .chatMessage', { hasText: '잘못 보냄' })).toHaveCount(1);
  // v1.10.190 말풍선 메뉴: no 「삭제」 word; PC a right click, a phone a 0.5 s press -- Esc or outside closes it, 삭제 asks once
  const wrong = m.locator('#messengerMessages .chatMessage.mine .chatMessageText', { hasText: '잘못 보냄' });
  await expect(m.locator('#messengerMessages .chatMessage.mine', { hasText: '잘못 보냄' })).not.toContainText('삭제');
  const openMenu = async () => { if (info.project.name.includes('mobile')) { await wrong.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true }); await m.waitForTimeout(700); await wrong.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true }); } else await wrong.click({ button: 'right' }); await expect(m.locator('.messengerBubbleMenu')).toBeVisible(); };
  await openMenu(); await m.keyboard.press('Escape'); await expect(m.locator('.messengerBubbleMenu')).toHaveCount(0);
  await openMenu(); await m.locator('#messengerRoomName').click(); await expect(m.locator('.messengerBubbleMenu')).toHaveCount(0);
  await openMenu(); m.once('dialog', (x) => x.accept()); await m.locator('.messengerBubbleMenu').getByRole('menuitem', { name: '삭제' }).click();
  await expect(d.locator('#messengerMessages .chatMessageText.deleted')).toHaveText('삭제된 메시지입니다', { timeout: 8000 });
  // 1:1: named after the other; 나가기 only with the warning
  if (await d.locator('#messengerBackBtn').isVisible()) await d.locator('#messengerBackBtn').click(); // a phone shows one side
  await d.locator('#messengerDmBtn').click();
  await d.locator('#messengerPeople label', { hasText: mom.nickname }).locator('input').check();
  await d.locator('#messengerPick').getByRole('button', { name: '확인' }).click();
  await expect(d.locator('#messengerRoomName')).toHaveText(mom.nickname);
  await expect(d.locator('#messengerInviteBtn')).toBeHidden();
  let warned = '';
  d.once('dialog', (x) => { warned = x.message(); x.dismiss(); });
  // I8-3: the head is 「‹ 목록 · 방 이름 · ⋯」 -- 방 나가기 (red) only in the ⋯ menu, which a click outside closes
  await expect(d.locator('#messengerLeaveBtn')).toBeHidden();
  await d.locator('#messengerMoreBtn').click(); await expect(d.locator('#messengerMoreMenu')).toBeVisible();
  await d.locator('#messengerRoomName').click(); await expect(d.locator('#messengerMoreMenu')).toBeHidden();
  await d.locator('#messengerMoreBtn').click();
  await expect(d.locator('#messengerLeaveBtn')).toHaveText('방 나가기');
  await d.locator('#messengerLeaveBtn').click();
  expect(warned).toContain('나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다');
  await expect(d.locator('#messengerRoomName')).toHaveText(mom.nickname); // dismissed: still in
  for (const page of [m, d]) { const box = await page.locator('#mApp').boundingBox(); const vw = page.viewportSize().width; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(vw); } // fits a phone too
  // (Codex 검토 2차 #5) a pin answered late, after I went to another room: the room I am in stays
  const toList = async () => { if (await m.locator('#messengerBackBtn').isVisible()) await m.locator('#messengerBackBtn').click(); };
  await m.route('**/pin', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  await m.locator('#messengerMoreBtn').click(); await m.locator('#messengerPinBtn').click(); await toList();
  await m.locator('#messengerRoomList button', { hasText: dad.nickname }).click(); await expect(m.locator('#messengerRoomName')).toHaveText(dad.nickname);
  await m.waitForTimeout(2500); await expect(m.locator('#messengerRoomName')).toHaveText(dad.nickname);
  await expect(m.locator('#messengerRoomList button', { hasText: '우리집' })).toContainText('📌'); // (the list has it)
  await m.unroute('**/pin');
  // (Q2 사용자 사진 「Illegal invocation」: a new line while this window is not looked at -- the title blinks 「● 새 메시지」, no
  // error note; the blink's default timers were called as an object's methods, which Chrome refuses)
  await toList(); await m.locator('#messengerRoomList button', { hasText: '우리집' }).click(); await expect(m.locator('#messengerRoomName')).toHaveText('우리집'); // (another room: dad's line unread)
  await m.evaluate(() => { document.hasFocus = () => false; });
  await d.locator('#messengerInput').fill('자?'); await d.locator('#messengerInput').press('Enter');
  await expect(m).toHaveTitle(/● 새 메시지/, { timeout: 10000 });
  await expect(m.locator('#mToast, .toast').filter({ hasText: 'Illegal' })).toHaveCount(0);
  await m.evaluate(() => { delete document.hasFocus; window.dispatchEvent(new Event('focus')); });
  // logged out on the page: the device's login ends with it (Codex 검토 2차 #4: and nothing of it stays on the page)
  await m.locator('#mLogoutBtn').click(); await expect(m.locator('#mLogin')).toBeVisible();
  await expect(m.locator('#messengerRoomList li')).toHaveCount(0); await expect(m.locator('#messengerMessages > *')).toHaveCount(0); await expect(m).toHaveTitle('아일랜드 메신저');
  await m.reload(); await expect(m.locator('#mLogin')).toBeVisible();
  // (사용자 「섬 앱에서 누르면 크롬으로 열려」) in the installed app (display-mode standalone): no blank window -- the messenger
  // itself in a small window, once; pressed again, the same one brought forward
  await dad.context.addInitScript(() => {
    const real = window.matchMedia.bind(window); window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
    window.__opens = []; const open = window.open.bind(window); window.open = (...args) => { window.__opens.push(args); return open(...args); };
  });
  const appHome = await dad.context.newPage(); await appHome.goto('/'); await expect(appHome.locator('#accountMessengerBtn')).toBeVisible({ timeout: 30000 });
  await appHome.locator('#accountMessengerBtn').click(); await appHome.waitForTimeout(800); await appHome.locator('#accountMessengerBtn').click(); await appHome.waitForTimeout(800);
  expect(await appHome.evaluate(() => window.__opens)).toEqual([['/messenger', 'gc-messenger', 'popup,width=440,height=780']]);
  for (const p of [mom, dad, kid]) await p.context.close();
});

// (사용자 2026-10-25 「메신저도 어두운 색으로 고를 수 있게」) 화면: 밝게 (first) / 어둡게 / 기기 설정 따르기 -- kept on the device,
// the installed window's bar too, body text 4.5:1 or more on both
test('메신저 어두운 화면: 처음 밝게, 어둡게 고르면 새로고침해도 유지, 기기 설정 따르기, 명암비', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/messenger'); await expect(page.locator('#mLogin')).toBeVisible({ timeout: 30000 });
  const theme = () => page.evaluate(() => [document.documentElement.dataset.mtheme, document.querySelector('meta[name="theme-color"]').content]);
  // the worst contrast of the page's body text: the login's labels and title, a line of mine and of another's
  const worst = () => page.evaluate(() => {
    const box = document.getElementById('messengerMessages'); document.getElementById('mApp').classList.remove('hidden');
    box.innerHTML = '<div class="chatMessage"><div class="chatMessageBody"><div class="chatMessageText">가나다</div></div></div><div class="chatMessage mine"><div class="chatMessageBody"><div class="chatMessageText">라마바</div></div></div>';
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number); const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > 0) return c.slice(0, 3); } return [255, 255, 255]; };
    const ratio = (el) => { const a = lum(rgb(getComputedStyle(el).color)); const b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const out = Math.min(...[...document.querySelectorAll('#mLogin label, .mTitle, .chatMessageText')].map(ratio));
    box.replaceChildren(); document.getElementById('mApp').classList.add('hidden'); return out;
  });
  expect(await theme()).toEqual(['light', '#fff6e3']); expect(await page.locator('#mTheme').inputValue()).toBe('light');
  expect(await worst()).toBeGreaterThanOrEqual(4.5);
  await page.locator('#mTheme').selectOption('dark');
  expect(await theme()).toEqual(['dark', '#2a231e']); expect(await worst()).toBeGreaterThanOrEqual(4.5);
  await page.reload(); await expect(page.locator('#mLogin')).toBeVisible();
  expect(await theme()).toEqual(['dark', '#2a231e']); expect(await page.locator('#mTheme').inputValue()).toBe('dark');
  await page.locator('#mTheme').selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' }); await expect.poll(theme).toEqual(['dark', '#2a231e']);
  await page.emulateMedia({ colorScheme: 'light' }); await expect.poll(theme).toEqual(['light', '#fff6e3']);
});
