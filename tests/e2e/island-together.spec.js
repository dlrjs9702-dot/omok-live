const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// B 47 함께하는 섬 ① 생일 (IDEAS #future-birthday): a birthday set for today puts up the plaza's corner with the name,
// pays its gift once, wears 「생일 주인공」 for the day, and others nearby cheer once a day each; ② 우체통 (#future-mailbox):
// a letter (and a parcel, the gift wrap's rule) to anyone, sent at the 우체통, waiting in their box. PC 전용 (the same
// windows on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('생일·우체통: 오늘 생일이면 광장 장식·선물 한 번·칭호, 옆 사람 축하 하루 한 번, 우체통 편지와 소포', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '생일손님', 100000, 'female');
  const b = await shopper(browser, request, '편지손님', 100000, 'male');
  for (const w of [a, b]) {
    await w.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await w.page.reload();
    await expect.poll(() => w.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  }
  const today = new Date(Date.now() + 9 * 3600000); const month = today.getUTCMonth() + 1; const day = today.getUTCDate();
  expect((await post(request, '/api/island/birthday', a.token, { month: 13, day: 1 })).status).toBe(400);
  expect((await post(request, '/api/island/birthday', a.token, { month, day })).status).toBe(200);
  const first = (await get(request, '/api/island/birthday', a.token)).data; const again = (await get(request, '/api/island/birthday', a.token)).data;
  expect([first.gift, again.gift, first.mine.month]).toEqual([1000, 0, month]);
  for (const w of [a, b]) await expect.poll(() => w.page.evaluate(() => window.PlazaDebug().together()), { timeout: 20000 }).toMatchObject({ birthday: true, names: expect.arrayContaining(['생일손님']), mailbox: true });
  // 축하하기: by her side, once a day
  const at = (w) => w.page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  const stand = async (w, x, z) => { await w.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [x, z]); for (let i = 0; i < 10; i += 1) { const r = await post(request, '/api/plaza/state', w.token, { x, z, yaw: 0, moving: false }); if (Math.hypot(r.data.x - x, r.data.z - z) < 0.6) break; await new Promise((ok) => setTimeout(ok, 300)); } }; // (until the server has me there)
  const aId = await a.page.evaluate(() => window.PlazaDebug().myId); const spot = await at(a); await stand(b, spot.x + 1, spot.z);
  const cheer = await post(request, '/api/island/birthday/cheer', b.token, { plazaId: aId }); expect(cheer.status).toBe(200);
  expect(cheer.data.count).toBe(1);
  expect((await post(request, '/api/island/birthday/cheer', b.token, { plazaId: aId })).status).toBe(409);
  expect((await get(request, '/api/island/birthday', a.token)).data.mine.cheers).toBe(1);
  // 우체통: not away from it; a letter with a parcel (a wrap used), waiting unread in her box, the thing in her bag
  for (const [itemId, qty] of [['gift_wrap', 1], ['bait', 1]]) expect((await post(request, '/api/test/island/give', b.token, { itemId, qty })).status).toBe(200);
  const letter = (extra = {}) => ({ to: a.id, text: '생일 축하해요!', requestId: crypto.randomUUID(), ...extra });
  expect((await post(request, '/api/island/mail/send', b.token, letter())).status).toBe(409);
  await b.page.bringToFront(); // (a background page sends its old place late)
  const M = T.VILLAGE.mailbox; await stand(b, M.x - Math.sin(M.yaw) * 1.1, M.z - Math.cos(M.yaw) * 1.1);
  const empty = await post(request, '/api/island/mail/send', b.token, letter({ text: '' })); expect(empty.status, JSON.stringify(empty.data)).toBe(400);
  expect((await post(request, '/api/island/mail/send', b.token, letter({ itemId: 'bait' }))).status).toBe(200);
  const box = (await get(request, '/api/island/mail', a.token)).data;
  expect([box.unread, box.letters[0].fromName, box.letters[0].text, box.letters[0].itemName]).toEqual([1, '편지손님', '생일 축하해요!', expect.any(String)]);
  expect((await get(request, '/api/island/bag', a.token)).data.items.some((e) => e.itemId === 'bait')).toBe(true);
  expect((await get(request, '/api/island/bag', b.token)).data.items.some((e) => e.itemId === 'gift_wrap')).toBe(false);
  expect((await post(request, '/api/island/mail/read', a.token, { id: box.letters[0].id })).status).toBe(200);
  expect((await get(request, '/api/island/mail', a.token)).data.unread).toBe(0);
  // her window: the letter in the box
  await a.page.evaluate(() => window.PlazaDebug().teleport(0, 0));
  for (const w of [a, b]) await expectNoScriptError(w.page);
  await post(request, '/api/island/birthday', a.token, { clear: true });
  for (const w of [a, b]) await w.context.close();
});
