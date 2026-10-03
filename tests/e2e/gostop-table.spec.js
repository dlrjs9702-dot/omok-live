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
async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uip() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, token: await page.evaluate(() => document.body.dataset.session) };
}
const box = (page, selector) => page.locator(selector).first().boundingBox();

for (const count of [2, 3]) {
  test(`${count === 2 ? '맞고' : '3인 고스톱'}: 하나의 큰 테이블에 상대·바닥·덱·내 영역·큰 손패가 배치되고 한 화면에 들어온다`, async ({ browser, request }) => {
    const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    const people = [];
    for (let i = 0; i < count; i += 1) people.push(await guest(browser, request, admin, ['나', '상대', '셋째'][i]));
    const code = (await api(request, '/api/rooms', people[0].token, { gameType: 'gostop' })).data.state.me.roomCode;
    for (let i = 1; i < count; i += 1) await api(request, '/api/rooms/join', people[i].token, { code });
    for (let i = 0; i < count; i += 1) await api(request, '/api/room/choose-role', people[i].token, { choice: String(i + 1) });
    const page = people[0].page;
    await page.reload();
    expect((await api(request, '/api/room/start-gostop', people[0].token, {})).status).toBe(200);
    await expect(page.locator('#gostopHand .hwatu').first()).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/tableGamePlaying/);
    await expect(page.locator('#teamPlayers')).toBeHidden(); // 테이블이 자리를 보여 주므로 일반 자리 목록은 비킨다
    await page.waitForTimeout(1200); // 판 시작 시 한 번 테이블로 스크롤

    const felt = await box(page, '#gostopFelt');
    for (const sel of ['#gostopOpponents', '#gostopFloor', '#gostopDeck', '#gostopMine', '#gostopHand']) {
      const b = await box(page, sel);
      expect(b.x >= felt.x - 1 && b.x + b.width <= felt.x + felt.width + 1 && b.y >= felt.y - 1 && b.y + b.height <= felt.y + felt.height + 1, `${sel} 테이블 안`).toBe(true);
    }
    const [opp, floor, mine, hand] = await Promise.all(['#gostopOpponents', '#gostopFloor', '#gostopMine', '#gostopHand'].map(s => box(page, s)));
    expect(opp.y + opp.height).toBeLessThanOrEqual(floor.y); // 상대 → 바닥 → 내 영역 → 손패 순서로 위에서 아래
    expect(floor.y + floor.height).toBeLessThanOrEqual(mine.y);
    expect(mine.y + mine.height).toBeLessThanOrEqual(hand.y);
    if (count === 3) {
      const seats = await page.locator('#gostopOpponents .gostopSeat').evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ x: r.x, y: r.y })));
      expect(seats).toHaveLength(2);
      expect(Math.abs(seats[0].y - seats[1].y)).toBeLessThan(2); // 같은 높이
      expect(seats[1].x).toBeGreaterThan(seats[0].x + 200); // 좌상·우상
    }
    const handCard = await box(page, '#gostopHand .hwatu');
    expect(handCard.width).toBeGreaterThanOrEqual(80); // 손패는 클릭하기 편할 만큼 크다(기존 58px)
    const floorCard = await box(page, '#gostopFloor .hwatu');
    expect(floorCard.width).toBeGreaterThanOrEqual(70); // 바닥패도 테이블에 맞게 크다(기존 46px)
    expect(felt.width).toBeGreaterThan(1000); // 넓은 PC 화면에서는 테이블이 주인공
    const handBottom = (await box(page, '#gostopHand')).y + (await box(page, '#gostopHand')).height;
    expect(handBottom).toBeLessThanOrEqual(1080); // 손패까지 한 화면
    for (const p of people) await p.context.close();
  });
}
