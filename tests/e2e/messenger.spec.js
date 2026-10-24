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
  // 1:1: named after the other; 나가기 only with the warning
  if (await d.locator('#messengerBackBtn').isVisible()) await d.locator('#messengerBackBtn').click(); // a phone shows one side
  await d.locator('#messengerDmBtn').click();
  await d.locator('#messengerPeople label', { hasText: mom.nickname }).locator('input').check();
  await d.locator('#messengerPick').getByRole('button', { name: '확인' }).click();
  await expect(d.locator('#messengerRoomName')).toHaveText(mom.nickname);
  await expect(d.locator('#messengerInviteBtn')).toBeHidden();
  let warned = '';
  d.once('dialog', (x) => { warned = x.message(); x.dismiss(); });
  await d.locator('#messengerLeaveBtn').click();
  expect(warned).toContain('나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다');
  await expect(d.locator('#messengerRoomName')).toHaveText(mom.nickname); // dismissed: still in
  for (const page of [m, d]) { const box = await page.locator('#mApp').boundingBox(); const vw = page.viewportSize().width; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(vw); } // fits a phone too
  // logged out on the page: the device's login ends with it
  await m.locator('#mLogoutBtn').click(); await expect(m.locator('#mLogin')).toBeVisible();
  await m.reload(); await expect(m.locator('#mLogin')).toBeVisible();
  for (const p of [mom, dad, kid]) await p.context.close();
});
