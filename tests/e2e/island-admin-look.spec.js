const { test, expect } = require('@playwright/test');
const { shopper, adminToken, get, expectNoScriptError } = require('./skin-support');

// A5 관리자 창 나머지 (IDEAS #future-admin-console): 계절 회전 (hold today's arrangement or let it turn), 이벤트 장식 by hand
// (on / off / by the date), and 공지 예약 (a notice posted at its time; a queued one can be cancelled). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('관리자: 계절 고정·이벤트 장식 수동·공지 예약', async ({ browser, request }) => {
  test.setTimeout(150000);
  const who = await shopper(browser, request, '섬모습', 100000, 'female');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const admin = await adminToken(request);
  const as = (path, data, method = 'post') => request[method](path, { headers: { 'X-Session-Token': admin }, ...(data ? { data } : {}) });
  const look = () => page.evaluate(() => window.PlazaDebug().islandLook());
  try {
    expect((await request.post('/api/admin/island/season', { data: { mode: 'hold' } })).status()).toBe(401); // the administrator only
    expect((await as('/api/admin/island/season', { mode: 'hold' })).status()).toBe(200);
    const held = (await get(request, '/api/island/time', token)).data.seasonHold;
    expect(Number.isInteger(held)).toBe(true);
    await expect.poll(async () => (await look()).seasonHold, { timeout: 15000 }).toBe(held);
    expect((await as('/api/admin/island/decor', { mode: 'off' })).status()).toBe(200);
    await expect.poll(async () => (await look()).decorMode, { timeout: 15000 }).toBe('off');
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.decor().shown), { timeout: 15000 }).toBe(false);
    expect((await as('/api/admin/island/decor', { mode: 'on' })).status()).toBe(200);
    await expect.poll(async () => (await look()).decorMode, { timeout: 15000 }).toBe('on');
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.decor().shown), { timeout: 15000 }).toBe(true);
  } finally { await as('/api/admin/island/season', { mode: 'auto' }); await as('/api/admin/island/decor', { mode: 'auto' }); }
  await expect.poll(async () => (await look()).seasonHold, { timeout: 15000 }).toBe(null);
  // 공지 예약: one far ahead is cancelled; one 35 s ahead shows up by itself
  await as('/api/announcements', { title: '취소할 예약', body: '보이면 안 돼요', publishAt: new Date(Date.now() + 3600000).toISOString() });
  const later = await (await as('/api/announcements', { title: '취소할 예약2', body: '-', publishAt: new Date(Date.now() + 3600000).toISOString() })).json();
  let queue = (await (await as('/api/admin/notice-queue', null, 'get')).json()).queue;
  expect(queue.map((e) => e.title)).toEqual(expect.arrayContaining(['취소할 예약', '취소할 예약2']));
  for (const e of queue) expect((await as(`/api/admin/notice-queue/${e.id}`, null, 'delete')).status()).toBe(200);
  expect((await (await as('/api/admin/notice-queue', null, 'get')).json()).queue).toEqual([]);
  expect(later.scheduled.title).toBe('취소할 예약2');
  await as('/api/announcements', { title: '예약 공지 시험', body: '정해진 시각에 올라와요', publishAt: new Date(Date.now() + 35000).toISOString() });
  expect((await get(request, '/api/announcements', token)).data.items.some((a) => a.title === '예약 공지 시험')).toBe(false);
  await page.waitForTimeout(36000); await as('/api/test/notices/due', {});
  expect((await get(request, '/api/announcements', token)).data.items.some((a) => a.title === '예약 공지 시험')).toBe(true);
  expect((await get(request, '/api/announcements', token)).data.items.some((a) => a.title.startsWith('취소할 예약'))).toBe(false);
  await expectNoScriptError(page);
  await who.context.close();
});
