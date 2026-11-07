const { test, expect } = require('@playwright/test');

// v1.8.5 고스톱·맞고 대형 테이블: 진행 영역 전체가 하나의 테이블(#gostopFelt)이다. 맞고는 상대 위·바닥/덱 가운데·
// 내 획득패와 큰 손패 아래, 3인 고스톱은 두 상대가 좌상·우상. 1920×1080 PC에서 판이 시작되면 테이블 전체가
// 화면 안에 들어온다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let ip = 0;
const uip = () => `100.72.${process.pid % 250}.${(++ip + Math.floor(Math.random() * 200)) % 250 + 1}`;
async function api(request, route, token, body) {
  const response = await request.post(route, { headers: { 'X-Forwarded-For': uip(), ...(token ? { 'X-Session-Token': token } : {}) }, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}
async function guest(browser, request, admin, label, viewport = { width: 1920, height: 1080 }) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uip() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, token: await page.evaluate(() => document.body.dataset.session) };
}
const box = (page, selector) => page.locator(selector).first().boundingBox();

// (v1.10.269 시험 정리: 2인/3인 「한 화면」은 gostop-late-layout·room-play-layout이 봐요)
// G-고스톱ⓒ 검토: 바닥 8묶음(4묶음은 2장)이어도 묶음끼리, 묶음과 산(「산 N장」 포함)이 겹치지 않는다 -- 폰 393과 PC
for (const viewport of [{ width: 393, height: 851 }, { width: 1920, height: 1080 }]) {
  test(`맞고 ${viewport.width}: 바닥 8묶음도 묶음끼리·산과 겹치지 않는다`, async ({ browser, request }) => {
    const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    const people = [await guest(browser, request, admin, '나', viewport), await guest(browser, request, admin, '상대')];
    const code = (await api(request, '/api/rooms', people[0].token, { gameType: 'gostop' })).data.state.me.roomCode;
    await api(request, '/api/rooms/join', people[1].token, { code });
    for (let i = 0; i < 2; i += 1) await api(request, '/api/room/choose-role', people[i].token, { choice: String(i + 1) });
    const page = people[0].page;
    await page.reload();
    expect((await api(request, '/api/room/start-gostop', people[0].token, {})).status).toBe(200);
    await expect(page.locator('#gostopHand .hwatu').first()).toBeVisible();
    expect((await api(request, '/api/test/gostop-fixture', people[0].token, { fixture: 'wide-floor' })).status).toBe(200);
    await expect(page.locator('#gostopFloor .gostopFloorGroup')).toHaveCount(8);
    // (C4 P3-5: and the phone turned -- across 640 the floor is laid again at once, no move needed)
    for (const size of viewport.width < 640 ? [null, { width: viewport.height, height: viewport.width }] : [null]) {
      if (size) await page.setViewportSize(size);
      await page.waitForTimeout(1500);
      const boxes = await page.evaluate(() => {
        const rect = (els) => { const rs = els.map(el => el.getBoundingClientRect()); return { left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)) }; };
        return { groups: [...document.querySelectorAll('#gostopFloor .gostopFloorGroup')].map(g => rect([...g.querySelectorAll('.hwatu')])), deck: rect([...document.querySelectorAll('#gostopDeck > *')]) };
      });
      const hit = (a, b) => a.left < b.right - 3 && a.right > b.left + 3 && a.top < b.bottom - 3 && a.bottom > b.top + 3; // (3px: the months' slight tilt)
      const clashes = [];
      boxes.groups.forEach((g, i) => { if (hit(g, boxes.deck)) clashes.push(`${i}↔산`); boxes.groups.forEach((o, j) => { if (j > i && hit(g, o)) clashes.push(`${i}↔${j}`); }); });
      expect(clashes, JSON.stringify(size)).toEqual([]);
    }
    for (const p of people) await p.context.close();
  });
}
