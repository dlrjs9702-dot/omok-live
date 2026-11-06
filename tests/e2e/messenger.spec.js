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
  // (B3: a PC sends with Enter; a phone's Enter is a new line -- 보내기 sends)
  const send = async (p) => { if (info.project.name.includes('mobile')) await p.locator('#messengerForm').getByRole('button', { name: '보내기' }).click(); else await p.locator('#messengerInput').press('Enter'); };
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
  await m.locator('#messengerPeople button', { hasText: dad.nickname }).click();
  await m.locator('#messengerPick').getByRole('button', { name: /대화 시작/ }).click();
  await expect(m.locator('#messengerRoomName')).toHaveText('우리집');
  await m.locator('#messengerInput').fill('저녁 뭐 먹어?');
  const sendBtn = m.locator('#messengerForm').getByRole('button', { name: '보내기' }); if (info.project.name.includes('mobile')) await sendBtn.tap(); else await sendBtn.click();
  await expect(m.locator('#messengerMessages .chatMessage.mine')).toHaveText(/저녁 뭐 먹어\?/);
  // (v1.10.247 G2: a phone's 보내기 keeps the box focused -- the keypad stays -- and empties it)
  if (info.project.name.includes('mobile')) expect(await m.evaluate(() => [document.activeElement?.id, document.getElementById('messengerInput').value])).toEqual(['messengerInput', '']);
  await expect(m.locator('#messengerMessages .messengerSystem')).toHaveText(/님을 초대했습니다/);
  await expect(m.locator('#messengerMessages .chatMessage.mine .messengerReadCount')).toHaveText('1'); // dad has not read it
  // dad: 내 계정's button tells what is unread and opens the 메신저 서랍 (메신저 정리 12절) -- no new window: the same page inside
  // with his login, its head only ✕ and 「메신저 앱으로 열기 ↗」; PC the right 380 px, a phone a sheet 85 % high
  const home = await onAccount(dad);
  await expect(home.locator('#accountMessengerBtn')).toContainText('새 메시지 2'); // the invite line + the message (server count)
  const pagesBefore = home.context().pages().length;
  await home.locator('#accountMessengerBtn').click();
  await expect(home.locator('#messengerDrawer')).toBeVisible(); expect(home.context().pages()).toHaveLength(pagesBefore);
  const d = home.frameLocator('#messengerDrawer iframe');
  await expect(d.locator('#mApp')).toBeVisible(); await expect(d.locator('#mLogin')).toBeHidden();
  for (const id of ['#mCloseEmbed', '#mOpenApp']) await expect(d.locator(id)).toBeVisible();
  for (const id of ['#mAlertPick', '#mLogoutBtn', '#mTheme', '#mInstallBtn']) await expect(d.locator(id)).toBeHidden();
  { const box = await home.locator('#messengerDrawer').boundingBox(); const vp = home.viewportSize(); if (vp.width > 640) { expect(Math.round(box.width)).toBe(380); expect(Math.round(box.x + box.width)).toBe(vp.width); } else { expect(box.height).toBeGreaterThan(vp.height * 0.8); expect(Math.round(box.y + box.height)).toBe(vp.height); } }
  await expect(d.locator('#messengerRoomList button', { hasText: '우리집' })).toContainText('저녁 뭐 먹어?');
  await d.locator('#messengerRoomList button', { hasText: '우리집' }).click();
  await expect(d.locator('#messengerMessages .chatMessage')).toHaveText(/저녁 뭐 먹어\?/);
  await expect(home.locator('#accountMessengerBtn')).toHaveText('메신저', { timeout: 5000 }); // (read in the 서랍: the button's number at once, 총괄 #402)
  // ✕ closes it; the button again: the same 서랍, the room still open (no window)
  await d.locator('#mCloseEmbed').click(); await expect(home.locator('#messengerDrawer')).toBeHidden();
  await home.locator('#accountMessengerBtn').click(); await expect(home.locator('#messengerDrawer')).toBeVisible();
  expect(home.context().pages()).toHaveLength(pagesBefore); await expect(d.locator('#messengerRoomName')).toHaveText('우리집');
  await d.locator('#messengerInput').fill('김치찌개');
  await send(d);
  await expect(m.locator('#messengerMessages .chatMessage:not(.mine)')).toHaveText(/김치찌개/, { timeout: 2500 }); // at once by the stream
  await expect(m.locator('#messengerMessages .messengerReadCount')).toHaveCount(0); // dad read it: the 「1」 is gone
  // (Codex 검토 2차 #6) a line unsent after the other side got it shows as deleted there too
  await m.locator('#messengerInput').fill('잘못 보냄'); await send(m);
  await expect(d.locator('#messengerMessages .chatMessage', { hasText: '잘못 보냄' })).toHaveCount(1);
  // v1.10.190 말풍선 메뉴: no 「삭제」 word; PC a right click, a phone a 0.5 s press -- Esc or outside closes it, 삭제 asks once
  const wrong = m.locator('#messengerMessages .chatMessage.mine .chatMessageText', { hasText: '잘못 보냄' });
  await expect(m.locator('#messengerMessages .chatMessage.mine', { hasText: '잘못 보냄' })).not.toContainText('삭제');
  const openMenu = async () => { if (info.project.name.includes('mobile')) { await wrong.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true }); await m.waitForTimeout(700); await wrong.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true }); } else await wrong.click({ button: 'right' }); await expect(m.locator('.messengerBubbleMenu')).toBeVisible(); };
  await openMenu(); await m.keyboard.press('Escape'); await expect(m.locator('.messengerBubbleMenu')).toHaveCount(0);
  await openMenu(); await m.locator('#messengerRoomName').click(); await expect(m.locator('.messengerBubbleMenu')).toHaveCount(0);
  await openMenu(); await m.locator('.messengerBubbleMenu').getByRole('menuitem', { name: '삭제' }).click();
  await expect(m.locator('#mAskText')).toHaveText('이 메시지를 모두에게서 삭제할까요?'); await m.locator('#mAsk').getByRole('button', { name: '삭제' }).click(); // (B6: the page's own small window)
  await expect(d.locator('#messengerMessages .chatMessageText.deleted')).toHaveText('삭제된 메시지입니다', { timeout: 8000 });
  // 1:1: named after the other; 나가기 only with the warning
  if (await d.locator('#messengerBackBtn').isVisible()) await d.locator('#messengerBackBtn').click(); // a phone shows one side
  await d.locator('#messengerDmBtn').click();
  await d.locator('#messengerPeople button', { hasText: mom.nickname }).click();
  await d.locator('#messengerPick').getByRole('button', { name: /대화 시작/ }).click();
  await expect(d.locator('#messengerRoomName')).toHaveText(mom.nickname);
  await expect(d.locator('#messengerInviteBtn')).toBeHidden();
  // I8-3: the head is 「‹ 목록 · 방 이름 · ⋯」 -- 방 나가기 (red) only in the ⋯ menu, which a click outside closes
  await expect(d.locator('#messengerLeaveBtn')).toBeHidden();
  await d.locator('#messengerMoreBtn').click(); await expect(d.locator('#messengerMoreMenu')).toBeVisible();
  await d.locator('#messengerRoomName').click(); await expect(d.locator('#messengerMoreMenu')).toBeHidden();
  await d.locator('#messengerMoreBtn').click();
  await expect(d.locator('#messengerLeaveBtn')).toHaveText('방 나가기');
  await d.locator('#messengerLeaveBtn').click();
  await expect(d.locator('#mAskText')).toContainText('나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다'); await d.locator('#mAsk').getByRole('button', { name: '취소' }).click(); await expect(d.locator('#mAsk')).toBeHidden();
  await expect(d.locator('#messengerRoomName')).toHaveText(mom.nickname); // dismissed: still in
  { const box = await m.locator('#mApp').boundingBox(); const vw = m.viewportSize().width; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(vw); } // fits a phone too
  { const box = await d.locator('#mApp').boundingBox(); const out = await home.locator('#messengerDrawer').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(out.x - 1); expect(box.x + box.width).toBeLessThanOrEqual(out.x + out.width + 1); } // (the 서랍's page inside the 서랍)
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
  await d.locator('#messengerInput').fill('자?'); await send(d);
  await expect(m).toHaveTitle(/● 새 메시지/, { timeout: 10000 });
  await expect(m.locator('#mToast, .toast').filter({ hasText: 'Illegal' })).toHaveCount(0);
  await m.evaluate(() => { delete document.hasFocus; window.dispatchEvent(new Event('focus')); });
  // (v1.10.253) the app opened by web+gcmessenger:<room> (its protocol_handlers' url ?open=%s): that room
  { const id = await m.evaluate(() => fetch('/api/messenger', { headers: { 'X-Messenger-Device': localStorage.getItem('gc.messengerDevice') } }).then((r) => r.json()).then((d) => d.rooms.find((x) => x.name === '우리집').id));
    await m.goto(`/messenger.html?open=${encodeURIComponent(`web+gcmessenger:${id}`)}`); await expect(m.locator('#messengerRoomName')).toHaveText('우리집'); }
  // logged out on the page: the device's login ends with it (Codex 검토 2차 #4: and nothing of it stays on the page)
  await m.locator('#mLogoutBtn').click(); await expect(m.locator('#mLogin')).toBeVisible();
  await expect(m.locator('#messengerRoomList li')).toHaveCount(0); await expect(m.locator('#messengerMessages > *')).toHaveCount(0); await expect(m).toHaveTitle('아일랜드 메신저');
  await m.reload(); await expect(m.locator('#mLogin')).toBeVisible();
  // (사용자 「섬 앱에서 누르면 크롬으로 열려」 → 12절) the installed app (display-mode standalone) too: the 서랍, no window; Esc in it
  // closes it (not the game's menu); its 「메신저 앱으로 열기 ↗」 opens the messenger app's page
  await dad.context.addInitScript(() => {
    const real = window.matchMedia.bind(window); window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
    window.__opens = []; window.__realOpen = window.open.bind(window); window.open = (...args) => { window.__opens.push(args); return null; };
  });
  const appHome = await dad.context.newPage(); await appHome.goto('/'); await expect(appHome.locator('#accountMessengerBtn')).toBeVisible({ timeout: 30000 });
  await appHome.locator('#accountMessengerBtn').click(); await expect(appHome.locator('#messengerDrawer')).toBeVisible();
  const f = appHome.frameLocator('#messengerDrawer iframe'); await expect(f.locator('#mApp')).toBeVisible();
  await f.locator('#mOpenApp').click();
  expect(await appHome.evaluate(() => window.__opens)).toEqual([]);
  // (v1.10.253: first the messenger app's own link, web+gcmessenger: -- none installed here, so 1.5 s later a blank window, a
  // Chrome tab outside the island app's scope, then sent to the messenger)
  await expect.poll(() => appHome.frames().find((x) => x.url().includes('embed=1')).evaluate(() => window.__opens), { timeout: 5000 }).toEqual([['', '_blank']]);
  { // (in a plain page, the blank window is sent on to the messenger -- the room of the 서랍, none here)
    const [tab] = await Promise.all([appHome.context().waitForEvent('page'), appHome.frames().find((x) => x.url().includes('embed=1')).evaluate(() => { window.open = window.__realOpen; document.getElementById('mOpenApp').click(); })]);
    await expect.poll(() => tab.url(), { timeout: 5000 }).toContain('/messenger.html'); await tab.close();
  }
  await f.locator('#mOpenApp').press('Escape'); await expect(appHome.locator('#messengerDrawer')).toBeHidden(); await expect(appHome.locator('#gameMenu, .gameMenu').first()).toBeHidden();
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

// v1.10.210 메신저 3절 3 (gamecenter-notes docs/messenger-app-push-20261030.md): the messenger window open but not looked at
// (minimised, another window in front) shows the notice the push would be -- one a room (its tag), never a muted room's or
// my own line, nothing while I look at it. The page's own: the server pushes this device no more while it is open (3절 4).
// 다음 메신저 묶음 10절 알림 방식, 기기마다: a PC is on 「열어 둘 때만」 -- no push subscription, the server pushes it nothing,
// the page's own notice still comes; a phone is on 「닫아도 받기」 (subscribed). Each can be changed. SHOT_DIR photos (밝게·어둡게)
test('메신저 창을 안 보고 있으면 새 메시지 팝업: 방마다 하나, 보고 있으면·꺼 둔 방·내 글은 없음 / 알림 방식: PC 열어 둘 때만(구독 없음·푸시 0), 폰 닫아도 받기', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(120000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, nick) => {
    const loginId = `p${tag}_${stamp}`.slice(0, 20); const nickname = `${nick}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    return { id, loginId, nickname, account };
  };
  const mom = await make('a', '엄마'); const dad = await make('b', '아빠');
  const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  const fakeSub = { endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${stamp}`, p256dh: Buffer.concat([Buffer.from([4]), require('node:crypto').randomBytes(64)]).toString('base64url'), auth: require('node:crypto').randomBytes(16).toString('base64url') };
  await context.addInitScript((fake) => { /* (the notices it shows, kept to read; "not looked at" at the test's word; the push service stood in for) */
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); window.__shown = []; ServiceWorkerRegistration.prototype.showNotification = function (title, options) { window.__shown.push({ title, ...options }); return Promise.resolve(); };
    window.__sub = null; const mk = () => ({ endpoint: fake.endpoint, toJSON: () => ({ endpoint: fake.endpoint, keys: { p256dh: fake.p256dh, auth: fake.auth } }), unsubscribe: () => { window.__sub = null; return Promise.resolve(true); } });
    PushManager.prototype.getSubscription = function () { return Promise.resolve(window.__sub); }; PushManager.prototype.subscribe = function () { window.__sub = mk(); return Promise.resolve(window.__sub); };
    const hasFocus = Document.prototype.hasFocus; Document.prototype.hasFocus = function () { return window.__away ? false : hasFocus.call(this); };
  }, fakeSub);
  await context.route('**/api/messenger/push', async (route) => { if (route.request().method() !== 'GET') return route.continue(); const real = await (await route.fetch()).json(); return route.fulfill({ json: { ...real, key: 'BKey' } }); }); // (a server key: the push service itself is not reached under tests)
  const m = await context.newPage(); await m.goto('/messenger');
  await m.locator('#mLoginId').fill(mom.loginId); await m.locator('#mLoginPw').fill('secret123');
  await m.locator('#mLogin').getByRole('button', { name: '로그인' }).click();
  await expect(m.locator('#mApp')).toBeVisible(); await expect(m.locator('#mAlertPick')).toBeVisible();
  const sel = m.locator('#mAlert'); const device = async () => { const tok = await m.evaluate(() => localStorage.getItem('gc.messengerDevice')); const res = await request.get('/api/messenger/push', { headers: { 'X-Forwarded-For': ip(), 'X-Messenger-Device': tok } }); return res.json(); };
  const shot = async (name) => { if (process.env.SHOT_DIR) { await m.waitForTimeout(300); await m.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  // the device's way by its kind: a PC 열어 둘 때만 (no subscription anywhere), a phone 닫아도 받기 (subscribed, the server told)
  if (isMobile) { await expect(sel).toHaveValue('push'); await expect.poll(() => m.evaluate(() => Boolean(window.__sub))).toBe(true); await expect.poll(async () => (await device()).on).toBe(true); expect((await device()).mode).toBe('push'); }
  else { await expect(sel).toHaveValue('open'); expect(await m.evaluate(() => window.__sub)).toBeNull(); expect(await device()).toMatchObject({ mode: 'open', on: false }); }
  await expect(m.locator('#mPushBtn')).toBeHidden(); // (allowed already)
  expect(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot('alert-light'); await m.locator('#mTheme').selectOption('dark'); await shot('alert-dark'); await m.locator('#mTheme').selectOption('light');
  const room = (await api(request, '/api/messenger/rooms', { account: dad.account, body: { name: '우리집', members: [mom.id] } })).data.room;
  const other = (await api(request, '/api/messenger/rooms', { account: dad.account, body: { name: '조용방', members: [mom.id] } })).data.room;
  await expect(m.locator('#messengerRoomList li')).toHaveCount(2);
  const say = (who, r, text) => api(request, `/api/messenger/rooms/${r.id}/messages`, { account: who.account, body: { text } });
  const shown = () => m.evaluate(() => window.__shown.map(({ title, body, tag, data }) => ({ title, body, tag, room: data?.room })));
  const pushed = async () => (await api(request, '/api/test/messenger/pushes')).data.pushes.filter((x) => x.to === mom.id);
  // looking at it: nothing
  await say(dad, room, '보고 있지?'); await expect(m.locator('#messengerRoomList')).toContainText('보고 있지?'); await m.waitForTimeout(500);
  expect(await shown()).toEqual([]);
  // not looked at: the notice, as the push's -- and no push from the server (a PC: no subscription; a phone: this window open)
  await m.evaluate(() => { window.__away = true; });
  await say(dad, room, '저녁 먹자');
  await expect.poll(shown, { timeout: 15000 }).toEqual([{ title: '우리집', body: `${dad.nickname}: 저녁 먹자`, tag: room.id, room: room.id }]);
  expect(await pushed()).toEqual([]);
  // a muted room, and my own line: nothing
  await api(request, `/api/messenger/rooms/${other.id}/mute`, { account: mom.account, body: { on: true } });
  await say(dad, other, '조용히'); await say(mom, room, '응 갈게');
  await expect(m.locator('#messengerRoomList')).toContainText('응 갈게'); await m.waitForTimeout(800);
  expect((await shown()).length).toBe(1);
  // (Codex 검토 5차 P2-1) a room first seen with its first line in it -- a new room's invitation, a new 1:1: its notice too
  // (the list held back while the room and its line are made, so they come in one list)
  let hold = true; await m.route(/\/api\/messenger(\?.*)?$/, async (route) => { while (hold) await new Promise((r) => setTimeout(r, 100)); await route.continue(); });
  const fresh = (await api(request, '/api/messenger/rooms', { account: dad.account, body: { name: '새방', members: [mom.id] } })).data.room;
  await say(dad, fresh, '첫 인사'); hold = false;
  await expect.poll(async () => (await shown()).filter((s) => s.tag === fresh.id), { timeout: 15000 }).toEqual([{ title: '새방', body: `${dad.nickname}: 첫 인사`, tag: fresh.id, room: fresh.id }]);
  // the way changed: a PC to 닫아도 받기 -- subscribed, the server told; back to 열어 둘 때만 -- the subscription gone on both sides
  // (a phone the other way round)
  await m.evaluate(() => { window.__away = false; });
  await sel.selectOption(isMobile ? 'open' : 'push'); await expect(m.locator('#toast')).toHaveText(isMobile ? '창을 열어 둔 동안만 새 메시지를 알려 드려요.' : '창을 닫아도 새 메시지를 알려 드려요.');
  await expect.poll(async () => (await device()).mode).toBe(isMobile ? 'open' : 'push'); expect((await device()).on).toBe(!isMobile); expect(await m.evaluate(() => Boolean(window.__sub))).toBe(!isMobile);
  await sel.selectOption(isMobile ? 'push' : 'open');
  await expect.poll(async () => (await device()).mode).toBe(isMobile ? 'push' : 'open'); expect((await device()).on).toBe(isMobile); expect(await m.evaluate(() => Boolean(window.__sub))).toBe(isMobile);
  // 안 받기: nothing shown while away either
  await sel.selectOption('off'); await expect.poll(async () => (await device()).mode).toBe('off'); expect((await device()).on).toBe(false);
  await m.evaluate(() => { window.__away = true; }); await say(dad, room, '안 받는다며'); await expect(m.locator('#messengerRoomList')).toContainText('안 받는다며'); await m.waitForTimeout(800);
  expect((await shown()).filter((s) => s.body?.includes('안 받는다며'))).toEqual([]);
  await context.close();
});

// (Codex 검토 5차 P2-2) the old /messenger worker's subscription moves to the app's: let go only once the new one stands --
// a failed move keeps the old (tried again next time). 10절: that holds for a device on 닫아도 받기 (a phone); a PC on 열어 둘
// 때만 wants no subscription -- the old one just goes; choosing 닫아도 받기 that fails leaves it on 열어 둘 때만
test('메신저 알림 옮기기: 폰은 새 구독이 실패하면 옛 구독 그대로, 성공하면 옛 것 해지; PC(열어 둘 때만)는 옛 구독 해지, 닫아도 받기 실패하면 그대로', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(120000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const loginId = `q_${stamp}`.slice(0, 20);
  await api(request, '/api/account/signup', { body: { realName: 'q', loginId, password: 'secret123', nickname: `옮김${(Date.now() + info.project.name.length) % 100000}` } });
  const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
  await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
  const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
  await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
  const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  const fakeSub = { endpoint: `https://fcm.googleapis.com/fcm/send/move-${stamp}`, p256dh: Buffer.concat([Buffer.from([4]), require('node:crypto').randomBytes(64)]).toString('base64url'), auth: require('node:crypto').randomBytes(16).toString('base64url') };
  await context.addInitScript((fake) => { /* (an old /messenger worker with a subscription; this device's new one fails until the test says) */
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    const ok = () => sessionStorage.getItem('subOk') === '1'; let sub = null;
    PushManager.prototype.getSubscription = function () { return Promise.resolve(sub); };
    PushManager.prototype.subscribe = function () { sessionStorage.setItem('subTried', '1'); if (!ok()) return Promise.reject(new Error('no push service')); sub = { endpoint: fake.endpoint, toJSON: () => ({ endpoint: fake.endpoint, keys: { p256dh: fake.p256dh, auth: fake.auth } }), unsubscribe: () => { sub = null; return Promise.resolve(true); } }; return Promise.resolve(sub); };
    const real = navigator.serviceWorker.getRegistrations.bind(navigator.serviceWorker);
    const old = { scope: `${location.origin}/messenger`, pushManager: { getSubscription: () => Promise.resolve({ unsubscribe: () => { sessionStorage.setItem('oldGone', '1'); return Promise.resolve(true); } }) }, unregister: () => { sessionStorage.setItem('oldUnreg', '1'); return Promise.resolve(true); } };
    navigator.serviceWorker.getRegistrations = async () => (sessionStorage.getItem('oldUnreg') ? real() : [...await real(), old]);
  }, fakeSub);
  await context.route('**/api/messenger/push', async (route) => { if (route.request().method() !== 'GET') return route.continue(); const real = await (await route.fetch()).json(); return route.fulfill({ json: { ...real, key: 'BKey' } }); });
  const m = await context.newPage(); await m.goto('/messenger');
  await m.locator('#mLoginId').fill(loginId); await m.locator('#mLoginPw').fill('secret123');
  await m.locator('#mLogin').getByRole('button', { name: '로그인' }).click(); await expect(m.locator('#mApp')).toBeVisible();
  const gone = () => m.evaluate(() => [sessionStorage.getItem('oldGone'), sessionStorage.getItem('oldUnreg'), sessionStorage.getItem('subTried')]);
  const sel = m.locator('#mAlert'); const device = async () => { const tok = await m.evaluate(() => localStorage.getItem('gc.messengerDevice')); return (await request.get('/api/messenger/push', { headers: { 'X-Forwarded-For': ip(), 'X-Messenger-Device': tok } })).json(); };
  if (isMobile) {
    // the new one fails: the old kept, 닫아도 받기 still the way (nothing on the server yet)
    await expect(sel).toHaveValue('push'); await expect.poll(gone).toEqual([null, null, '1']); expect(await device()).toMatchObject({ mode: 'push', on: false });
    // next time it works: the new one first, then the old let go
    await m.evaluate(() => sessionStorage.setItem('subOk', '1')); await m.reload(); await expect(sel).toHaveValue('push');
    await expect.poll(gone).toEqual(['1', '1', '1']); await expect.poll(async () => (await device()).on).toBe(true);
  } else {
    // a PC on 열어 둘 때만: the old subscription just goes, no new one asked for
    await expect(sel).toHaveValue('open'); await expect.poll(gone).toEqual(['1', '1', null]); expect(await device()).toMatchObject({ mode: 'open', on: false });
    // 닫아도 받기 that fails: back on 열어 둘 때만, said so
    await sel.selectOption('push'); await expect(m.locator('#toast')).toHaveText('no push service'); await expect(sel).toHaveValue('open'); expect(await device()).toMatchObject({ mode: 'open', on: false });
    await m.evaluate(() => sessionStorage.setItem('subOk', '1')); await sel.selectOption('push'); await expect(m.locator('#toast')).toHaveText('창을 닫아도 새 메시지를 알려 드려요.');
    await expect(sel).toHaveValue('push'); await expect.poll(async () => (await device()).on).toBe(true);
  }
  await context.close();
});

// 다음 메신저 묶음 10절 ①: 메신저만 따로 설치 -- its own manifest (id, start /messenger.html, scope /messenger, its icons), linked
// from the messenger page only (the island's stays as it is); the browser's install prompt as an 「앱으로 설치」 button when
// it comes, not inside an installed window. Nothing sideways. SHOT_DIR photos (밝게·어둡게)
test('메신저 앱 따로 설치: 메신저 manifest·아이콘·/messenger.html, 「앱으로 설치」 단추, 설치된 창에서는 숨김', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(60000);
  const manifest = await request.get('/messenger.webmanifest'); expect(manifest.status()).toBe(200); expect(manifest.headers()['content-type']).toContain('manifest+json');
  const mf = await manifest.json(); expect(mf).toMatchObject({ id: '/messenger', name: '아일랜드 메신저', start_url: '/messenger', scope: '/messenger', display: 'standalone' });
  expect(mf.protocol_handlers).toEqual([{ protocol: 'web+gcmessenger', url: '/messenger.html?open=%s' }]); // (v1.10.253: the 서랍's 「메신저 앱으로 열기」 reaches the installed app)
  for (const icon of mf.icons) { const res = await request.get(icon.src); expect(res.status(), icon.src).toBe(200); expect(res.headers()['content-type']).toBe('image/png'); }
  expect(mf.icons.map((i) => i.purpose).sort()).toEqual(['any', 'any', 'maskable']);
  // (v1.10.256 주소 15절) the island app under /island/ -- the messenger outside its scope, installed apart; the old ways in go there
  expect((await (await request.get('/manifest.webmanifest')).json())).toMatchObject({ id: '/island/', name: '아일랜드', start_url: '/island/', scope: '/island/' });
  const chrome = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36', 'Sec-CH-UA': '"Google Chrome";v="140"' };
  for (const [from, to] of [['/?room=x', '/island/?room=x'], ['/herosurv/', '/island/herosurv/']]) { const r = await request.get(from, { maxRedirects: 0, headers: chrome }); expect(r.headers().location, from).toBe(to); }
  expect((await request.get('/island/herosurv/', { headers: chrome })).status()).toBe(200);
  const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  const page = await context.newPage(); await page.goto('/messenger.html'); await expect(page.locator('#mLogin')).toBeVisible({ timeout: 30000 });
  expect(await page.locator('link[rel="manifest"]').getAttribute('href')).toBe('/messenger.webmanifest');
  await expect(page.locator('#mInstallBtn')).toBeHidden();
  const offer = (p) => p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await offer(page)).toBe(true); await expect(page.locator('#mInstallBtn')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(300); await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  await shot('install-light'); await page.locator('#mTheme').selectOption('dark'); await shot('install-dark'); await page.locator('#mTheme').selectOption('light');
  await page.locator('#mInstallBtn').click(); expect(await page.evaluate(() => window.__prompted)).toBe(1); await expect(page.locator('#mInstallBtn')).toBeHidden();
  // inside the installed window (display-mode: standalone): no button even when the browser offers
  await context.addInitScript(() => { const real = window.matchMedia.bind(window); window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q)); });
  const app = await context.newPage(); await app.goto('/messenger.html'); await expect(app.locator('#mLogin')).toBeVisible();
  expect(await offer(app)).toBe(true); await app.waitForTimeout(300); await expect(app.locator('#mInstallBtn')).toBeHidden();
  await context.close();
});

// v1.10.212 메신저 6절 (사용자 「메신저를 최소화 해 놓아도 알림은 오는데 읽은걸로 처리되고 있는데」): the room open but the window
// not looked at (minimised, behind another) -- the new line shows, but is not read: the sender's 「1」 stays, my unread
// count 1; back at the window, read then.
test('메신저 창을 안 보고 있으면 읽음 처리 안 함: 보낸 쪽 「1」 그대로, 창으로 돌아오면 읽음', async ({ browser, request }, info) => {
  test.setTimeout(120000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, nick) => {
    const loginId = `k${tag}_${stamp}`.slice(0, 20); const nickname = `${nick}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    return { id, loginId, nickname, account };
  };
  const mom = await make('a', '엄마'); const dad = await make('b', '아빠');
  const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  await context.addInitScript(() => { const hasFocus = Document.prototype.hasFocus; Document.prototype.hasFocus = function () { return window.__away ? false : hasFocus.call(this); }; }); // ("not looked at" at the test's word)
  const m = await context.newPage(); await m.goto('/messenger');
  await m.locator('#mLoginId').fill(mom.loginId); await m.locator('#mLoginPw').fill('secret123');
  await m.locator('#mLogin').getByRole('button', { name: '로그인' }).click(); await expect(m.locator('#mApp')).toBeVisible();
  const room = (await api(request, '/api/messenger/rooms', { account: dad.account, body: { name: '우리집', members: [mom.id] } })).data.room;
  await m.locator('#messengerRoomList button', { hasText: '우리집' }).click(); await expect(m.locator('#messengerRoomName')).toHaveText('우리집');
  const dadRoom = async () => (await api(request, '/api/messenger', { account: dad.account })).data.rooms.find((r) => r.id === room.id);
  const momUnread = async () => (await api(request, '/api/messenger', { account: mom.account })).data.rooms.find((r) => r.id === room.id).unread;
  // not looked at: the line shows in the open room, not read
  await m.evaluate(() => { window.__away = true; });
  const sent = (await api(request, `/api/messenger/rooms/${room.id}/messages`, { account: dad.account, body: { text: '창 숨겼지?' } })).data.message;
  await expect(m.locator('#messengerMessages')).toContainText('창 숨겼지?');
  await m.waitForTimeout(800);
  expect((await dadRoom()).reads[mom.id]).toBeLessThan(sent.seq); // (the sender's 「1」 stays)
  expect(await momUnread()).toBe(1);
  // back at the window: read
  await m.evaluate(() => { window.__away = false; window.dispatchEvent(new Event('focus')); });
  await expect.poll(async () => (await dadRoom()).reads[mom.id], { timeout: 10000 }).toBe(sent.seq);
  expect(await momUnread()).toBe(0);
  // (Codex 검토 5차 P3-2) a busy room's two pages: the window turned away between them -- the second asked as not looked at
  // (the first page answered full -- 100 lines -- as a busy room's; the server lets 6 lines in 5 s, too slow to fill one)
  const asked = []; let turned = false;
  await m.route(/\/api\/messenger\/rooms\/[^/]+\/messages\?/, async (route) => {
    asked.push(route.request().url());
    if (turned) return route.continue();
    turned = true; const real = await (await route.fetch()).json();
    await m.evaluate(() => { window.__away = true; }); // (the first page's request out, then the window turned away)
    return route.fulfill({ json: { ...real, messages: Array.from({ length: 100 }, () => real.messages[0]) } });
  });
  await api(request, `/api/messenger/rooms/${room.id}/messages`, { account: dad.account, body: { text: '마지막 줄' } });
  await expect.poll(() => asked.length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  expect(asked[0]).not.toContain('peek=1'); expect(asked[1]).toContain('peek=1');
  await context.close();
});

// 메신저 다듬기 A2 사람 고르기 (새 대화방·초대·1:1 같은 화면): 이름 찾기 (치는 대로, 부분 일치), 고른 사람 알약 (✕로 빼기),
// 최근 대화한 사람 먼저, 「N명과 대화 시작」 (아무도 안 고르면 누를 수 없음), 방 이름 비우면 이름들로, 1:1은 한 명만, 초대는
// 「N명 초대」; 한 줄 44px 이상, 목록만 스크롤. 밝게·어둡게 (SHOT_DIR 사진)
test('메신저 A2 사람 고르기: 이름 찾기·알약·최근 먼저·빈 방 이름·1:1 한 명만·N명 초대', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(120000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, nick) => {
    const loginId = `g${tag}_${stamp}`.slice(0, 20); const nickname = `${nick}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    return { id, loginId, nickname, account };
  };
  const me = await make('a', '나'); const jiu = await make('b', '지우'); const star = await make('c', '한별'); const sol = await make('d', '솔');
  await api(request, '/api/messenger/dm', { account: sol.account, body: { with: me.id } }).then(({ data }) => api(request, `/api/messenger/rooms/${data.room.id}/messages`, { account: sol.account, body: { text: '안녕' } })); // (솔: talked with lately)
  const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  const m = await context.newPage(); await m.goto('/messenger');
  await m.locator('#mLoginId').fill(me.loginId); await m.locator('#mLoginPw').fill('secret123');
  await m.locator('#mLogin').getByRole('button', { name: '로그인' }).click(); await expect(m.locator('#mApp')).toBeVisible();
  const shot = async (name) => { if (process.env.SHOT_DIR) { await m.waitForTimeout(300); await m.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  const rows = m.locator('#messengerPeople li:not([hidden]) .messengerPerson'); const go = m.locator('#messengerPickGo'); const find = m.locator('#messengerPickFind');
  const row = (p) => m.locator('#messengerPeople .messengerPerson', { hasText: p.nickname });
  await m.locator('#messengerNewBtn').click(); await expect(m.locator('#messengerPick')).toBeVisible();
  // talked with lately first; nobody chosen -- the button can't be pressed
  await expect(rows.first()).toContainText(sol.nickname); await expect(rows.first().locator('.messengerAvatar')).toHaveText('솔');
  await expect(go).toBeDisabled(); await expect(go).toHaveText('대화 시작'); await expect(m.locator('#messengerPicked')).toBeHidden();
  // a row 44 px or more; only the list scrolls (the page does not)
  expect((await rows.first().boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await m.locator('#messengerPeople').evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  expect(await m.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1)).toBe(true);
  // the find box: as typed, a part of the name
  await find.fill(star.nickname.slice(1)); await expect(rows).toHaveCount(1); await expect(rows.first()).toContainText(star.nickname);
  await rows.first().click(); await expect(row(star)).toHaveAttribute('aria-pressed', 'true');
  await expect(m.locator('#messengerPicked .messengerChip')).toHaveText([`${star.nickname}✕`]); await expect(go).toHaveText('1명과 대화 시작'); await expect(go).toBeEnabled();
  await find.fill('없는이름zz'); await expect(rows).toHaveCount(0); await expect(m.locator('#messengerPeople')).toContainText('이름이 없어요');
  await find.fill(jiu.nickname); await rows.first().click(); await expect(go).toHaveText('2명과 대화 시작');
  await find.fill(''); await shot('pick-light');
  // ✕ on a pill takes one out; none left -- can't be pressed
  await m.locator('#messengerPicked').getByRole('button', { name: `${star.nickname} 빼기` }).click(); await expect(go).toHaveText('1명과 대화 시작'); await expect(row(star)).toHaveAttribute('aria-pressed', 'false');
  await row(jiu).click(); await expect(go).toBeDisabled(); await expect(m.locator('#messengerPicked')).toBeHidden();
  // dark too
  await m.locator('#mTheme').selectOption('dark'); await row(jiu).click(); await row(star).click(); await shot('pick-dark');
  expect(await row(jiu).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 250, 240)');
  await m.locator('#mTheme').selectOption('light');
  // the room name left empty: the names
  await go.click(); await expect(m.locator('#messengerRoomName')).toHaveText(`${jiu.nickname}, ${star.nickname}`);
  // 초대: 「N명 초대」 (the ones in the room not in the list)
  await m.locator('#messengerMoreBtn').click(); await m.locator('#messengerInviteBtn').click();
  await expect(m.locator('#messengerPickTitle')).toContainText('에 초대'); await expect(row(jiu)).toHaveCount(0); await expect(m.locator('#messengerPickName')).toBeHidden();
  await row(sol).click(); await expect(go).toHaveText('1명 초대'); await m.locator('#messengerPickCancel').click();
  // 1:1: one only
  if (await m.locator('#messengerBackBtn').isVisible()) await m.locator('#messengerBackBtn').click();
  await m.locator('#messengerDmBtn').click(); await expect(m.locator('#messengerPickTitle')).toHaveText('1:1 대화');
  await row(jiu).click(); await row(star).click();
  await expect(m.locator('#messengerPeople .messengerPerson[aria-pressed="true"]')).toHaveCount(1); await expect(row(star)).toHaveAttribute('aria-pressed', 'true');
  await expect(go).toHaveText('대화 시작'); await expect(m.locator('#messengerPicked')).toBeHidden();
  await go.click(); await expect(m.locator('#messengerRoomName')).toHaveText(star.nickname);
  await context.close();
});

// 메신저 다듬기 B: 안 읽은 곳 줄 「여기까지 읽었어요」 (B2) · 위로 올려 보는 중 새 글 「새 메시지 ↓」 (B1) · 여러 줄 입력 (B3:
// PC Shift+Enter 줄 바꿈·Enter 보내기, 폰 Enter 줄 바꿈·보내기 단추) · 주소는 <a> (B4) · 말풍선 메뉴 「복사」 (B5) · 이름 바꾸기·
// 나가기를 화면 안 작은 창으로 (B6: Esc·취소, 포커스 가둠). PC and phone; SHOT_DIR photos
test('메신저 B: 안 읽은 곳 줄·새 메시지 ↓·Shift+Enter 줄 바꿈·주소 링크·메뉴 복사·작은 창', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(180000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, nick) => {
    const loginId = `b${tag}_${stamp}`.slice(0, 20); const nickname = `${nick}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    return { id, loginId, nickname, account };
  };
  const me = await make('a', '읽는이'); const them = await make('b', '쓰는이');
  const room = (await api(request, '/api/messenger/rooms', { account: them.account, body: { name: '긴대화방', members: [me.id] } })).data.room;
  const say = async (text, who = them) => { for (let k = 0; ; k += 1) { const r = await api(request, `/api/messenger/rooms/${room.id}/messages`, { account: who.account, body: { text } }); if (r.status !== 429 || k > 5) { expect(r.status, JSON.stringify(r.data)).toBeLessThan(300); return r.data.message; } await new Promise((done) => setTimeout(done, 2500)); } }; // (6 lines in 5 s)
  const tall = (k) => `읽은 글 ${k}\n둘째 줄\n셋째 줄\n넷째 줄`;
  for (let k = 1; k <= 6; k += 1) await say(tall(k));
  await api(request, `/api/messenger/rooms/${room.id}/messages?after=0`, { account: me.account }); // (read up to here)
  for (let k = 1; k <= 8; k += 1) await say(k === 1 ? '여기부터 새 글' : `새 글 ${k}\n둘째 줄\n셋째 줄`);
  const context = await browser.newContext({ ...(info.project.use || {}), permissions: ['clipboard-read', 'clipboard-write'], extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  const m = await context.newPage(); await m.goto('/messenger');
  await m.locator('#mLoginId').fill(me.loginId); await m.locator('#mLoginPw').fill('secret123');
  await m.locator('#mLogin').getByRole('button', { name: '로그인' }).click(); await expect(m.locator('#mApp')).toBeVisible();
  const shot = async (name) => { if (process.env.SHOT_DIR) { await m.waitForTimeout(400); await m.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  const box = m.locator('#messengerMessages'); const input = m.locator('#messengerInput'); const below = m.locator('#messengerNewBelow');
  const gap = () => box.evaluate((b) => Math.round(b.scrollHeight - b.scrollTop - b.clientHeight));
  const send = async () => { if (isMobile) await m.locator('#messengerForm').getByRole('button', { name: '보내기' }).click(); else await input.press('Enter'); };
  // B2: opened -- the first unread line in view, 「여기까지 읽었어요」 over it
  await m.locator('#messengerRoomList button', { hasText: '긴대화방' }).click();
  const mark = box.locator('.messengerUnreadLine'); await expect(mark).toHaveText('여기까지 읽었어요');
  await expect(mark.locator('xpath=following-sibling::*[1]')).toContainText('여기부터 새 글');
  await expect.poll(() => mark.evaluate((el) => Math.round(el.getBoundingClientRect().top - el.parentElement.getBoundingClientRect().top))).toBeLessThan(30);
  expect(await gap()).toBeGreaterThan(40); await shot('unread-line');
  // B1: further up, a new line -- 「새 메시지 ↓」, the view stays; pressed: the end, gone
  await box.evaluate((b) => { b.scrollTop = 0; }); await m.waitForTimeout(200); await expect(below).toBeHidden();
  await say('위에 있을 때 온 글'); await expect(box).toContainText('위에 있을 때 온 글', { timeout: 10000 });
  await expect(below).toBeVisible(); await expect(below).toHaveText('새 메시지 ↓'); expect(await box.evaluate((b) => b.scrollTop)).toBeLessThan(5); await shot('new-below');
  await below.click(); await expect(below).toBeHidden(); await expect.poll(gap).toBeLessThan(4);
  // at the end, a new line: no button, still at the end; up again, a new line, then scrolled down by hand -- gone
  await say('맨 아래에서 받은 글'); await expect(box).toContainText('맨 아래에서 받은 글', { timeout: 10000 }); await expect(below).toBeHidden(); await expect.poll(gap).toBeLessThan(4);
  await box.evaluate((b) => { b.scrollTop = 0; }); await m.waitForTimeout(200); await say('또 온 글'); await expect(below).toBeVisible({ timeout: 10000 });
  await box.evaluate((b) => { b.scrollTop = b.scrollHeight; }); await expect(below).toBeHidden();
  // B2: opened again, nothing unread -- no line, the end
  if (await m.locator('#messengerBackBtn').isVisible()) await m.locator('#messengerBackBtn').click(); else await m.locator('#messengerRoomName').click();
  await m.locator('#messengerRoomList button', { hasText: '긴대화방' }).click(); await expect(box).toContainText('또 온 글');
  await expect(mark).toHaveCount(0); await expect.poll(gap).toBeLessThan(4);
  // a room never read: from the top, no line over nothing read
  const fresh = (await api(request, '/api/messenger/rooms', { account: them.account, body: { name: '처음방', members: [me.id] } })).data.room;
  await expect(m.locator('#messengerRoomList button', { hasText: '처음방' })).toHaveCount(1, { timeout: 35000 });
  if (await m.locator('#messengerBackBtn').isVisible()) await m.locator('#messengerBackBtn').click();
  await m.locator('#messengerRoomList button', { hasText: '처음방' }).click(); await expect(box.locator('.messengerSystem')).toHaveCount(1); await expect(mark).toHaveCount(0);
  if (await m.locator('#messengerBackBtn').isVisible()) await m.locator('#messengerBackBtn').click();
  await m.locator('#messengerRoomList button', { hasText: '긴대화방' }).click(); await expect(box).toContainText('또 온 글'); expect(fresh.id).toBeTruthy();
  // B3: several lines -- a PC: Shift+Enter a new line, Enter sends; a phone: Enter a new line, 보내기 sends
  expect(await input.evaluate((el) => [el.tagName, el.maxLength])).toEqual(['TEXTAREA', 500]);
  const h1 = await input.evaluate((el) => el.offsetHeight);
  await input.fill('첫 줄'); await input.press(isMobile ? 'Enter' : 'Shift+Enter'); await input.pressSequentially('둘째 줄');
  await expect(input).toHaveValue('첫 줄\n둘째 줄'); expect(await input.evaluate((el) => el.offsetHeight)).toBeGreaterThan(h1);
  await send(); await expect(input).toHaveValue('');
  const two = box.locator('.chatMessage.mine .chatMessageText').last(); await expect(two).toHaveText('첫 줄\n둘째 줄');
  expect(await two.evaluate((el) => [getComputedStyle(el).whiteSpace, el.getBoundingClientRect().height > 30])).toEqual(['pre-wrap', true]);
  expect(await input.evaluate((el) => el.offsetHeight)).toBe(h1); // (back to one line)
  await input.fill(Array.from({ length: 10 }, (_, k) => `줄 ${k}`).join('\n')); await input.dispatchEvent('input');
  expect(await input.evaluate((el, h) => el.offsetHeight < h * 5 && el.scrollHeight > el.clientHeight, h1)).toBe(true); await input.fill(''); await input.dispatchEvent('input'); // (about 5 lines, then it scrolls)
  // B4: an address opens -- <a> made of text, never the line as HTML
  await input.fill('여기 https://example.com/a?b=1 보세요, <b>굵게</b> (http://x.test/y).'); await send();
  const linkLine = box.locator('.chatMessage.mine .chatMessageText').last(); await expect(linkLine.locator('a')).toHaveCount(2);
  const first = linkLine.locator('a').first();
  await expect(first).toHaveAttribute('href', 'https://example.com/a?b=1'); await expect(first).toHaveAttribute('target', '_blank'); await expect(first).toHaveAttribute('rel', 'noopener noreferrer'); await expect(first).toHaveText('https://example.com/a?b=1');
  await expect(linkLine.locator('a').nth(1)).toHaveAttribute('href', 'http://x.test/y'); await expect(linkLine.locator('b')).toHaveCount(0); await expect(linkLine).toContainText('<b>굵게</b>');
  // B5: the bubble menu -- 복사 on another's line (no 삭제), 복사 and 삭제 on mine
  const openMenu = async (bubble) => { if (isMobile) { await bubble.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true }); await m.waitForTimeout(700); await bubble.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true }); } else await bubble.click({ button: 'right' }); await expect(m.locator('.messengerBubbleMenu')).toBeVisible(); };
  const theirs = box.locator('.chatMessage:not(.mine) .chatMessageText', { hasText: '또 온 글' });
  await openMenu(theirs); await expect(m.locator('.messengerBubbleMenu [role="menuitem"]')).toHaveText(['복사']);
  await m.locator('.messengerBubbleMenu').getByRole('menuitem', { name: '복사' }).click(); await expect(m.locator('#toast')).toHaveText('복사했어요.');
  expect(await m.evaluate(() => navigator.clipboard.readText())).toBe('또 온 글');
  await openMenu(two); await expect(m.locator('.messengerBubbleMenu [role="menuitem"]')).toHaveText(['복사', '삭제']); await m.keyboard.press('Escape');
  // B6: 이름 바꾸기 in the page's small window (focus kept in it, Enter takes it); 나가기 -- Esc closes it, still in the room
  await m.locator('#messengerMoreBtn').click(); await m.locator('#messengerRenameBtn').click();
  const dialog = m.locator('#mAsk'); await expect(dialog).toBeVisible(); await expect(m.locator('#mAskInput')).toHaveValue('긴대화방'); await expect(m.locator('#mAskInput')).toBeFocused();
  for (let k = 0; k < 4; k += 1) await m.keyboard.press('Tab');
  expect(await m.evaluate(() => document.getElementById('mAsk').contains(document.activeElement))).toBe(true);
  await m.locator('#mAskInput').fill('새이름방'); await m.locator('#mAskInput').press('Enter'); await expect(dialog).toBeHidden();
  await expect(m.locator('#messengerRoomName')).toHaveText('새이름방', { timeout: 10000 });
  await m.locator('#messengerMoreBtn').click(); await m.locator('#messengerLeaveBtn').click(); await expect(dialog).toBeVisible();
  await expect(m.locator('#mAskOk')).toHaveText('나가기'); await shot('ask-leave');
  await m.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(m.locator('#messengerRoomName')).toHaveText('새이름방');
  await context.close();
});
