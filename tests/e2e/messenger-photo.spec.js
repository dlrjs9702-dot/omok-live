const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let n = 0;
const ip = () => `100.79.${process.pid % 250}.${(++n + Math.floor(Math.random() * 200)) % 250 + 1}`;
async function api(request, route, { token, account, body } = {}) {
  const options = { headers: { 'X-Forwarded-For': ip(), ...(token ? { 'X-Session-Token': token } : {}), ...(account ? { 'X-Account-Token': account } : {}) } };
  const res = body === undefined ? await request.get(route, options) : await request.post(route, { ...options, data: body });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

// v1.10.233 메신저 보내기 빠르게 + 사진 (notes docs/messenger-speed-photo-20261103.md): Enter -- the box empty and my line
// at once (the answer held back 2.5 s: it is there before it), confirmed by the answer; refused -- the words back in the box,
// 「다시 보내기」 sends it; photos from the 📷 button (three, one taken out), a grid on both screens, the big view; dropped and
// pasted on a PC; seven days on, each says it is gone. PC and phone; SHOT_DIR photos.
test('메신저: 엔터 즉시 말풍선·실패 되돌림·다시 보내기, 사진 여러 장·빼기·격자·크게 보기, 끌어 놓기·붙여넣기(PC), 7일 지난 사진', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(240000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag) => {
    const loginId = `p${tag}_${stamp}`.slice(0, 20); const nickname = `${{ a: '찍는이', b: '받는이' }[tag]}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
    const page = await context.newPage(); await page.goto('/messenger');
    await page.locator('#mLoginId').fill(loginId); await page.locator('#mLoginPw').fill('secret123'); await page.locator('#mLogin').getByRole('button', { name: '로그인' }).click();
    await expect(page.locator('#mApp')).toBeVisible(); return { context, page, nickname };
  };
  const a = await make('a'); const b = await make('b'); const { page } = a;
  await page.reload(); await expect(page.locator('#mApp')).toBeVisible(); // (the people list as it is now: b let in after a looked)
  const send = async () => { if (isMobile) await page.locator('#messengerForm').getByRole('button', { name: '보내기' }).click(); else await page.locator('#messengerInput').press('Enter'); }; // (B3: a phone's Enter is a new line)
  const shot = async (p, name) => { if (process.env.SHOT_DIR) { await p.waitForTimeout(800); await p.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  try {
    await page.locator('#messengerNewBtn').click(); await page.locator('#messengerPickName').fill('사진방');
    await page.locator('#messengerPeople button', { hasText: b.nickname }).click(); await page.locator('#messengerPick').getByRole('button', { name: /대화 시작/ }).click();
    await expect(page.locator('#messengerRoomName')).toHaveText('사진방');
    const input = page.locator('#messengerInput'); const mine = page.locator('#messengerMessages .chatMessage.mine');
    // Enter: at once, before the (held back) answer
    await api(request, '/api/test/messenger/slow', { body: { ms: 2500 } });
    await input.fill('바로 떠요?'); const t0 = Date.now(); await send();
    await expect(page.locator('#messengerMessages .chatMessage.pending')).toHaveText(/바로 떠요\?/, { timeout: 800 }); expect(Date.now() - t0).toBeLessThan(2000); await expect(input).toHaveValue('');
    await shot(page, 'msg-sending');
    await expect(page.locator('#messengerMessages .chatMessage.pending')).toHaveCount(0, { timeout: 10000 }); await expect(mine.filter({ hasText: '바로 떠요?' })).toHaveCount(1);
    // refused: back in the box, 다시 보내기
    await api(request, '/api/test/messenger/slow', { body: { ms: 0, fail: true } });
    await input.fill('한 번 실패'); await send();
    await expect(page.locator('#messengerMessages .chatMessage.failed')).toContainText('한 번 실패', { timeout: 10000 }); await expect(input).toHaveValue('한 번 실패');
    await shot(page, 'msg-failed');
    await page.locator('#messengerMessages .chatMessage.failed').getByRole('button', { name: '다시 보내기' }).click();
    await expect(page.locator('#messengerMessages .chatMessage.failed')).toHaveCount(0, { timeout: 10000 }); await expect(mine.filter({ hasText: '한 번 실패' })).toHaveCount(1); await expect(input).toHaveValue('');
    // photos: three from the button, one taken out, sent with no words
    const png = async (color) => Buffer.from(await page.evaluate((c) => { const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 1200; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 1600, 1200); g.fillStyle = '#fff'; g.font = 'bold 200px sans-serif'; g.fillText(c, 200, 700); return cv.toDataURL('image/png').split(',')[1]; }, color), 'base64');
    await page.locator('#messengerPhotoPick').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: await png('#d9534f') }, { name: 'b.png', mimeType: 'image/png', buffer: await png('#5b8def') }, { name: 'c.png', mimeType: 'image/png', buffer: await png('#4caf7d') }]);
    await expect(page.locator('#messengerShots .messengerShot')).toHaveCount(3, { timeout: 15000 }); await shot(page, 'photo-tray');
    await page.locator('#messengerShots .messengerShotDrop').nth(1).click(); await expect(page.locator('#messengerShots .messengerShot')).toHaveCount(2);
    await page.locator('#messengerForm').getByRole('button', { name: '보내기' }).click(); await expect(page.locator('#messengerShots')).toBeHidden();
    const lastMine = mine.last(); await expect(lastMine.locator('.messengerPhoto')).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('#messengerMessages .chatMessage.pending')).toHaveCount(0, { timeout: 15000 });
    // the other side: the grid, loaded; the big view
    await b.page.locator('#messengerRoomList button', { hasText: '사진방' }).click();
    const theirs = b.page.locator('#messengerMessages .chatMessage').last(); await expect(theirs.locator('.messengerPhoto img')).toHaveCount(2, { timeout: 15000 });
    await expect.poll(() => theirs.locator('.messengerPhoto img').first().evaluate((im) => im.naturalWidth), { timeout: 15000 }).toBe(1280); // (shrunk: the long side 1280)
    await shot(b.page, 'photo-received');
    await theirs.locator('.messengerPhoto').first().click(); await expect(b.page.locator('#messengerViewer')).toBeVisible(); await expect(b.page.locator('#messengerViewerCount')).toHaveText('1 / 2');
    await b.page.locator('#messengerViewerNext').click(); await expect(b.page.locator('#messengerViewerCount')).toHaveText('2 / 2'); await shot(b.page, 'photo-viewer');
    await b.page.keyboard.press('Escape'); await expect(b.page.locator('#messengerViewer')).toBeHidden();
    if (!isMobile) { // a PC: dropped on the chat, pasted in the box
      await page.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; cv.getContext('2d').fillRect(0, 0, 300, 200); const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); const file = new File([blob], 'drop.png', { type: 'image/png' });
        const dt = new DataTransfer(); dt.items.add(file); const room = document.getElementById('messengerRoom'); for (const type of ['dragenter', 'dragover']) room.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true })); room.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
      await expect(page.locator('#messengerShots .messengerShot')).toHaveCount(1, { timeout: 15000 });
      await page.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 300; cv.getContext('2d').fillRect(0, 0, 200, 300); const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([blob], 'paste.png', { type: 'image/png' })); document.getElementById('messengerInput').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
      await expect(page.locator('#messengerShots .messengerShot')).toHaveCount(2, { timeout: 15000 });
      await input.fill('끌어 놓고 붙여 넣기'); await send(); await expect(mine.last().locator('.messengerPhoto')).toHaveCount(2, { timeout: 15000 }); await expect(mine.last()).toContainText('끌어 놓고 붙여 넣기');
    }
    // seven days on: each one says it is gone (the other side, opened again)
    await api(request, '/api/test/messenger/purge', { body: { days: 8 } });
    await b.page.reload(); await expect(b.page.locator('#mApp')).toBeVisible(); await b.page.locator('#messengerRoomList button', { hasText: '사진방' }).click();
    await expect(b.page.locator('#messengerMessages .messengerPhoto.gone').first()).toContainText('7일이 지나 사라진 사진', { timeout: 15000 }); await shot(b.page, 'photo-gone');
  } finally { await api(request, '/api/test/messenger/slow', { body: { ms: 0 } }); await a.context.close(); await b.context.close(); }
});

// 메신저 다듬기 A1 (사진 있는 방에서 보내거나 받으면 가끔 사진 근처가 보이던 것): a room with many photos (each held back on
// the way in, as a slow network), at its end -- a line sent, a line come in, a read count gone: still at the end, after
// every photo is in too; only the changed lines drawn again (the photos' own tiles kept)
test('메신저 A1: 사진 여러 장 있는 방에서 보내고 받아도 맨 아래 유지', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(180000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, nick) => {
    const loginId = `s${tag}_${stamp}`.slice(0, 20); const nickname = `${nick}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    return { id, loginId, nickname, account };
  };
  const me = await make('a', '보는이'); const them = await make('b', '찍는이');
  const context = await browser.newContext({ ...(info.project.use || {}), extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
  const page = await context.newPage();
  await page.route('**/api/messenger/photos/*', async (route) => { if (route.request().method() !== 'GET') return route.continue(); await new Promise((r) => setTimeout(r, 400 + Math.random() * 900)); await route.continue(); });
  await page.goto('/messenger');
  // the photos: JPEGs made on the page, sent by the other side in four lines (one, two, three, one)
  const jpeg = async (w, h, c) => Buffer.from(await page.evaluate(([w, h, c]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h); return cv.toDataURL('image/jpeg', 0.8).split(',')[1]; }, [w, h, c]), 'base64');
  const room = (await api(request, '/api/messenger/rooms', { account: them.account, body: { name: '사진많은방', members: [me.id] } })).data.room;
  const again = async (call) => { for (let k = 0; ; k += 1) { const r = await call(); if (r.status !== 429 || k > 4) { expect(r.status, JSON.stringify(r.data)).toBeLessThan(300); return r.data; } await new Promise((done) => setTimeout(done, 2500)); } }; // (the server's pace: 6 lines in 5 s)
  const say = (text, photos = []) => again(() => api(request, `/api/messenger/rooms/${room.id}/messages`, { account: them.account, body: { text, photos } }));
  const upload = async (w, h, c) => { const data = await jpeg(w, h, c); return again(async () => { const res = await request.post(`/api/messenger/rooms/${room.id}/photos`, { headers: { 'X-Forwarded-For': ip(), 'X-Account-Token': them.account, 'Content-Type': 'image/jpeg', 'X-Photo-W': String(w), 'X-Photo-H': String(h) }, data }); return { status: res.status(), data: await res.json().catch(() => ({})) }; }); };
  const sizes = [[[900, 1200]], [[1280, 720], [800, 800]], [[1280, 960], [600, 900], [1000, 1000]], [[720, 1280]]];
  for (const [k, set] of sizes.entries()) {
    const ids = []; for (const [w, h] of set) ids.push((await upload(w, h, ['#d9534f', '#5b8def', '#4caf7d', '#e0a43a'][k])).id);
    await say(k % 2 ? `사진 ${k + 1}번` : '', ids); await say(`글 ${k + 1}`);
  }
  await page.locator('#mLoginId').fill(me.loginId); await page.locator('#mLoginPw').fill('secret123');
  await page.locator('#mLogin').getByRole('button', { name: '로그인' }).click(); await expect(page.locator('#mApp')).toBeVisible();
  await page.locator('#messengerRoomList button', { hasText: '사진많은방' }).click();
  const box = page.locator('#messengerMessages');
  const gap = () => box.evaluate((b) => Math.round(b.scrollHeight - b.scrollTop - b.clientHeight));
  const allIn = () => box.evaluate((b) => [...b.querySelectorAll('.messengerPhoto img')].every((im) => im.complete && im.naturalWidth > 0));
  await expect(box.locator('.messengerPhoto img')).toHaveCount(7, { timeout: 15000 });
  await expect.poll(allIn, { timeout: 15000 }).toBe(true); await expect.poll(gap).toBeLessThan(4);
  // the tiles had their size before the photos came in
  const tiles = await box.evaluate((b) => [...b.querySelectorAll('.messengerPhoto img')].map((im) => im.style.aspectRatio));
  expect(tiles.every(Boolean)).toBe(true);
  const kept = await box.locator('.messengerPhoto img').first().evaluateHandle((im) => im);
  // a line sent (Enter on a PC, the button on a phone), its answer, the read count: at the end each time and once the photos are in
  const input = page.locator('#messengerInput');
  for (const k of [1, 2, 3]) {
    await input.fill(`보낸 글 ${k}`);
    if (isMobile) await page.locator('#messengerForm').getByRole('button', { name: '보내기' }).click(); else await input.press('Enter');
    await expect(box.locator('.chatMessage.mine').last()).toContainText(`보낸 글 ${k}`); await expect(box.locator('.chatMessage.pending')).toHaveCount(0, { timeout: 10000 });
    await page.waitForTimeout(1500); await expect.poll(allIn, { timeout: 15000 }).toBe(true); expect(await gap()).toBeLessThan(4);
  }
  // a line come in -- the other side read mine with it (the 「1」s gone)
  await expect(box.locator('.chatMessage.mine .messengerReadCount')).toHaveCount(3);
  await say('받은 글'); await expect(box).toContainText('받은 글', { timeout: 10000 });
  await expect(box.locator('.chatMessage.mine .messengerReadCount')).toHaveCount(0, { timeout: 10000 });
  await page.waitForTimeout(1500); expect(await gap()).toBeLessThan(4);
  // the first photo's tile was never drawn again
  expect(await kept.evaluate((im) => im.isConnected)).toBe(true);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-photo-room.png` });
  await context.close();
});
