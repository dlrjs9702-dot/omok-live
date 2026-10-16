const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.10.78 메신저 (IDEAS #future-messenger): 내 계정 shows 메신저 only for the accounts the administrator let in; one
// makes a room with another, writes, and the other sees it (asked again every 3 s). PC and phone alike.
let n = 0;
const ip = () => `100.78.${process.pid % 250}.${(++n + Math.floor(Math.random() * 200)) % 250 + 1}`;
async function api(request, route, { token, account, body } = {}) {
  const options = { headers: { 'X-Forwarded-For': ip(), ...(token ? { 'X-Session-Token': token } : {}), ...(account ? { 'X-Account-Token': account } : {}) } };
  const res = body === undefined ? await request.get(route, options) : await request.post(route, { ...options, data: body });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

test('메신저: 허용 계정만 버튼, 방 만들기 → 메시지 → 상대가 받음', async ({ browser, request }, info) => {
  test.setTimeout(90000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, allowed) => {
    const loginId = `m${tag}_${stamp}`.slice(0, 20); const nickname = `${{ a: '엄마', b: '아빠', c: '아이' }[tag]}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    if (allowed) await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
    await context.addInitScript((t) => sessionStorage.setItem('gc.account', t), account);
    const page = await context.newPage(); await page.goto('/');
    await expect(page.locator('#accountPanel')).toBeVisible();
    return { page, context, nickname };
  };
  const mom = await make('a', true); const dad = await make('b', true); const kid = await make('c', false);
  await expect(kid.page.locator('#accountMessengerBtn')).toBeHidden();

  await mom.page.locator('#accountMessengerBtn').click();
  await mom.page.locator('#messengerNewBtn').click();
  await mom.page.locator('#messengerPickName').fill('우리집');
  await mom.page.locator('#messengerPeople label', { hasText: dad.nickname }).locator('input').check();
  await mom.page.locator('#messengerPick').getByRole('button', { name: '확인' }).click();
  await expect(mom.page.locator('#messengerRoomName')).toHaveText('우리집');
  await mom.page.locator('#messengerInput').fill('저녁 뭐 먹어?');
  await mom.page.locator('#messengerForm').getByRole('button', { name: '보내기' }).click();
  await expect(mom.page.locator('#messengerMessages .chatMessage.mine')).toHaveText(/저녁 뭐 먹어\?/);

  await dad.page.locator('#accountMessengerBtn').click();
  await dad.page.locator('#messengerRoomList button', { hasText: '우리집' }).click();
  await expect(dad.page.locator('#messengerMessages .chatMessage')).toHaveText(/저녁 뭐 먹어\?/);
  await dad.page.locator('#messengerInput').fill('김치찌개');
  await dad.page.locator('#messengerInput').press('Enter');
  await expect(mom.page.locator('#messengerMessages .chatMessage:not(.mine)')).toHaveText(/김치찌개/, { timeout: 10000 }); // the 3 s ask
  const box = await mom.page.locator('#messengerDialog').boundingBox(); const vw = mom.page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(vw); // fits a phone too
  for (const p of [mom, dad, kid]) await p.context.close();
});
