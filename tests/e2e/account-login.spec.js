const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.10.63 아이디·비밀번호 로그인 (IDEAS 2026-10-11): the first screen signs up (the administrator approves) and logs in;
// 내 계정 → 게임 접속 enters the island; an entry-file account without an id sets one before entering. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let n = 0;
const ip = () => `100.74.${process.pid % 250}.${(++n + Math.floor(Math.random() * 200)) % 250 + 1}`;
async function api(request, route, token, body) {
  const options = { headers: { 'X-Forwarded-For': ip(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const res = body === undefined ? await request.get(route, options) : await request.post(route, { ...options, data: body });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

test('회원가입 신청 → 승인 대기 안내 → 관리자 승인 → 로그인 → 내 계정 → 게임 접속', async ({ page, request }) => {
  const id = `e2e_${Date.now().toString(36)}`;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': ip() });
  await page.goto('/');
  await expect(page.locator('[data-account-tab="login"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#adminLoginForm')).toBeVisible(); // the small 관리자 line stays

  await page.locator('[data-account-tab="signup"]').click();
  await page.locator('#signupNameInput').fill('테스트');
  await page.locator('#signupIdInput').fill(id);
  await page.locator('#signupPasswordInput').fill('secret123');
  await page.locator('#signupPasswordConfirm').fill('secret123');
  await page.locator('#signupNicknameInput').fill(`가입${Date.now() % 100000}`);
  await page.getByRole('button', { name: '가입 신청' }).click();
  await expect(page.locator('#accountMessage')).toHaveText('아이디 중복 확인을 먼저 해 주세요.');
  await page.locator('#signupCheckBtn').click();
  await expect(page.locator('#accountMessage')).toContainText('사용할 수 있는 아이디');
  await page.getByRole('button', { name: '가입 신청' }).click();
  await expect(page.locator('#accountMessage')).toContainText('관리자 승인 후');
  await expect(page.locator('#accountLoginForm')).toBeVisible();

  await page.locator('#loginIdInput').fill(id);
  await page.locator('#loginPasswordInput').fill('secret123');
  await page.locator('#accountLoginForm').getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('#accountMessage')).toContainText('승인 대기 중');

  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const signup = (await api(request, '/api/admin/signups', admin)).data.signups.find((s) => s.loginId === id);
  expect((await api(request, `/api/admin/signups/${signup.id}/approve`, admin, {})).status).toBe(200);

  await page.locator('#loginPasswordInput').fill('secret123');
  await page.locator('#accountLoginForm').getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('#accountPanel')).toBeVisible();
  await expect(page.locator('#accountSub')).toHaveText(`아이디 ${id}`);
  await page.reload(); // the login stays in this tab
  await expect(page.locator('#accountPanel')).toBeVisible();
  await page.getByRole('button', { name: '게임 접속' }).click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expect(page.locator('#gateView')).toBeHidden();
});

test('아이디 없는 입장 파일 계정: 아이디·비밀번호 설정 뒤에만 입장', async ({ browser, request }) => {
  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const issued = (await api(request, '/api/admin/keys', admin, { label: '설정손님' })).data;
  await api(request, '/api/test/account-setup', null, { keyId: issued.key.id });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': ip() });
  await page.setContent(issued.html);
  await expect(page.locator('#accountSetupForm')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#lobbyView')).toBeHidden();
  await expect(page.locator('#accountSetupLead')).toContainText('설정손님님');
  const id = `file_${Date.now().toString(36)}`;
  await page.locator('#setupIdInput').fill(id);
  await page.locator('#setupCheckBtn').click();
  await expect(page.locator('#accountMessage')).toContainText('사용할 수 있는 아이디');
  await page.locator('#setupPasswordInput').fill('filepass1');
  await page.locator('#setupPasswordConfirm').fill('filepass2');
  await page.getByRole('button', { name: '설정하고 로그인' }).click();
  await expect(page.locator('#accountMessage')).toHaveText('비밀번호 확인이 일치하지 않습니다.');
  await page.locator('#setupPasswordConfirm').fill('filepass1');
  await page.getByRole('button', { name: '설정하고 로그인' }).click();
  await expect(page.locator('#accountPanel')).toBeVisible(); // v1.10.190: 내 계정 first, the island by 「게임 접속」
  await expect(page.locator('#accountSub')).toHaveText(`아이디 ${id}`);
  await page.getByRole('button', { name: '게임 접속' }).click();
  await expect(page.locator('#lobbyView')).toBeVisible({ timeout: 15000 });
  const keys = (await api(request, '/api/admin/keys', admin)).data.keys;
  expect(keys.find((k) => k.id === issued.key.id).loginId).toBe(id);
  // v1.10.190: the same file again elsewhere, while that one plays -- 내 계정 (no 「이미 사용 중」 yet); 「게임 접속」 is where it is checked
  const other = await browser.newContext(); const page2 = await other.newPage();
  await page2.setExtraHTTPHeaders({ 'X-Forwarded-For': ip() });
  await page2.setContent(issued.html);
  await expect(page2.locator('#accountPanel')).toBeVisible({ timeout: 15000 });
  await expect(page2.locator('#accountSub')).toHaveText(`아이디 ${id}`);
  await expect(page2.locator('#lobbyView')).toBeHidden();
  expect(new URL(page2.url()).pathname).toBe('/');
  await page2.getByRole('button', { name: '게임 접속' }).click();
  await expect(page2.locator('body')).toContainText('이미 사용 중');
  await context.close();
  await other.close();
});
