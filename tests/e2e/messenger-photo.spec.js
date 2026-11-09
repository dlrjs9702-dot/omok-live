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
    { // (v1.10.291 확대·축소: a PC's wheel, a phone's double tap -- 2.5x; the next photo back at 1x)
      const im = b.page.locator('#messengerViewerImg'); await expect.poll(() => im.evaluate((e) => e.naturalWidth), { timeout: 15000 }).toBeGreaterThan(0); const box = await im.boundingBox(); const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
      if (isMobile) { await b.page.touchscreen.tap(cx, cy); await b.page.touchscreen.tap(cx, cy); await expect(b.page.locator('#messengerViewer')).toHaveAttribute('data-zoom', '2.5'); }
      else { await b.page.mouse.move(cx, cy); await b.page.mouse.wheel(0, -600); await expect.poll(async () => Number(await b.page.locator('#messengerViewer').getAttribute('data-zoom'))).toBeGreaterThan(1); await expect(b.page.locator('#messengerZoomPct')).not.toHaveText('100%'); }
      await expect.poll(() => im.evaluate((e) => getComputedStyle(e).transform)).not.toBe('none'); await shot(b.page, 'photo-zoom');
      await b.page.locator('#messengerViewerPrev').click(); await expect(b.page.locator('#messengerViewerCount')).toHaveText('1 / 2'); await expect(b.page.locator('#messengerViewer')).toHaveAttribute('data-zoom', '1');
    }
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

// v1.10.279 이모티콘 (notes docs/messenger-emoticons-20261108.md 5절): 😊 -- 「이모티콘」, pressed: large, pressed again: sent
// (no bubble, its picture); the other side sees the picture and the room list 「(이모티콘) …」; 「그림 글자」 goes in the box at
// the cursor; the last used on top. PC (a phone: SHOT_DIR photos only -- the panel's fit)
test('메신저 이모티콘: 😊 판·미리 보기 뒤 보내기·상대 화면 그림·방 목록 줄·그림 글자 커서 자리·최근', async ({ browser, request, isMobile }, info) => {
  test.setTimeout(150000);
  const admin = (await api(request, '/api/admin/login', { body: { password: adminPassword } })).data.sessionToken;
  const stamp = `${Date.now().toString(36)}${info.project.name.length}`;
  const make = async (tag, nick) => {
    const loginId = `e${tag}_${stamp}`.slice(0, 20); const nickname = `${nick}${(Date.now() + info.project.name.length) % 100000}`;
    await api(request, '/api/account/signup', { body: { realName: tag, loginId, password: 'secret123', nickname } });
    const signup = (await api(request, '/api/admin/signups', { token: admin })).data.signups.find((s) => s.loginId === loginId);
    await api(request, `/api/admin/signups/${signup.id}/approve`, { token: admin, body: {} });
    const id = (await api(request, '/api/admin/keys', { token: admin })).data.keys.find((k) => k.loginId === loginId).id;
    await api(request, `/api/admin/keys/${id}/messenger`, { token: admin, body: { allowed: true } });
    const account = (await api(request, '/api/account/login', { body: { loginId, password: 'secret123' } })).data.accountToken;
    const video = process.env.SHOT_DIR && tag === 'a' ? { recordVideo: { dir: process.env.SHOT_DIR, size: info.project.use?.viewport || { width: 1280, height: 720 } } } : {}; /* (v1.10.281: the moving stickers, as a clip) */
    const context = await browser.newContext({ ...(info.project.use || {}), ...video, extraHTTPHeaders: { 'X-Forwarded-For': ip() } });
    const page = await context.newPage(); await page.goto('/messenger');
    await page.locator('#mLoginId').fill(loginId); await page.locator('#mLoginPw').fill('secret123'); await page.locator('#mLogin').getByRole('button', { name: '로그인' }).click();
    await expect(page.locator('#mApp')).toBeVisible(); return { id, account, context, page, nickname };
  };
  const a = await make('a', '보내는이'); const b = await make('b', '받는이'); const { page } = a;
  const shot = async (p, name) => { if (process.env.SHOT_DIR) { await p.waitForTimeout(600); await p.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  try {
    const room = (await api(request, '/api/messenger/rooms', { account: a.account, body: { name: '이모티콘방', members: [b.id] } })).data.room;
    await api(request, `/api/messenger/rooms/${room.id}/messages`, { account: a.account, body: { text: '안녕하세요' } });
    if (isMobile) for (let k = 0; k < 29; k += 1) await api(request, `/api/messenger/rooms/${room.id}/messages`, { account: k % 2 ? a.account : b.account, body: { text: `줄 ${k + 1}` } }); /* (v1.10.289: a room the list overflows) */
    await page.reload(); await page.locator('#messengerRoomList button', { hasText: '이모티콘방' }).click();
    expect(await page.evaluate(() => document.activeElement?.id === 'messengerInput')).toBe(!isMobile);
    if (isMobile) { /* (v1.10.289 사용자 「핸드폰에서 스크롤이 생겨서 불편해」: 30 lines -- the page no taller than the screen (only the list scrolls), the box on it, the settings card away) */
      await expect.poll(() => page.locator('#messengerMessages').evaluate((b) => b.scrollHeight > b.clientHeight + 40)).toBe(true); /* (the list overflows -- its first page in) */
      await expect(page.locator('.mTop')).toBeHidden();
      expect(await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
      const box = await page.locator('#messengerForm').boundingBox(); expect(box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1, JSON.stringify(box)).toBe(true);
    } /* (v1.10.286 사용자: a phone's keypad not up on entering; a PC types at once) */
    const panel = page.locator('#messengerEmoji'); const cells = panel.locator('.messengerStickerCell');
    await page.locator('#messengerEmojiBtn').click(); await expect(panel).toBeVisible(); await expect(cells).toHaveCount(24);
    if (isMobile) { /* (v1.10.286 사용자 「보낸 후 닫을 수가 없어」: sent, then closed by its ✕, the 😊, the box (keypad up), the list, the phone's back -- the phone's whole part) */
      const btn = page.locator('#messengerEmojiBtn'); await cells.nth(3).tap(); await cells.nth(3).tap(); await expect(page.locator('#messengerMessages .messengerSticker img')).toHaveCount(1); await shot(page, 'emoji-sent-open');
      await page.locator('#messengerEmojiClose').tap(); await expect(panel).toBeHidden(); await expect(btn).toHaveAttribute('aria-expanded', 'false'); await shot(page, 'emoji-sent-closed');
      await btn.tap(); await expect(panel).toBeVisible(); await btn.tap(); await expect(panel).toBeHidden();
      await btn.tap(); await page.locator('#messengerInput').tap(); await expect(panel).toBeHidden(); await expect(page.locator('#messengerInput')).toBeFocused();
      await btn.tap(); await expect(panel).toBeVisible(); await page.locator('#messengerMessages').tap({ position: { x: 12, y: 12 } }); await expect(panel).toBeHidden();
      await btn.tap(); await expect(panel).toBeVisible(); await page.goBack(); await expect(panel).toBeHidden(); await expect(page.locator('#messengerInput')).toBeVisible(); /* (still in the room) */
      return;
    }
    if (!isMobile) { /* (v1.10.280 폴드 펼침 제보: the room's column squeezed the panel flat -- an unfolded phone (two columns) and a low PC: 200 px at least, the first sticker whole inside it) */
      const size = page.viewportSize();
      for (const [w, h] of [[820, 900], [1280, 600]]) {
        await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
        const [p, c, c2] = await Promise.all([panel.boundingBox(), cells.first().boundingBox(), cells.nth(4).boundingBox()]); /* (the first, and the second row's first) */
        expect(p.height, `${w}x${h}`).toBeGreaterThanOrEqual(200); expect(c.y >= p.y && c.y + c.height <= p.y + p.height && c.height > 40, `${w}x${h} ${JSON.stringify([p, c])}`).toBe(true);
        expect(c2.y > c.y && c2.y + c2.height <= p.y + p.height + 1, `${w}x${h} two rows ${JSON.stringify([p, c2])}`).toBe(true);
        await shot(page, `emoji-panel-${w}x${h}`);
      }
      await page.setViewportSize(size);
    }
    // pressed once: large, nothing sent; pressed again: sent, a picture with no bubble
    await cells.nth(16).click(); await expect(page.locator('#messengerEmojiPreview')).toBeVisible(); await shot(page, 'emoji-sticker');
    await expect(page.locator('#messengerMessages .chatMessage.mine')).toHaveCount(1);
    await cells.nth(16).click(); await expect(page.locator('#messengerEmojiPreview')).toBeHidden();
    const sent = page.locator('#messengerMessages .chatMessage.mine .messengerSticker img'); await expect(sent).toHaveCount(1);
    await expect(page.locator('#messengerMessages .chatMessage.pending')).toHaveCount(0, { timeout: 10000 });
    await expect.poll(() => sent.evaluate((im) => im.complete && im.naturalWidth > 0)).toBe(true);
    expect(await sent.evaluate((im) => Math.round(im.getBoundingClientRect().width))).toBe(isMobile ? 110 : 120);
    expect(await page.locator('#messengerMessages .chatMessage.mine .messengerSticker').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    // the last used on top: 최근 one, then the 24
    await expect(panel.locator('.messengerEmojiHead').first()).toHaveText('최근'); await expect(cells).toHaveCount(25);
    // the other side: the picture, and the list's line in words
    const them = b.page; await them.reload(); await expect(them.locator('#messengerRoomList button', { hasText: '이모티콘방' })).toContainText('(이모티콘) 고마워요'); await shot(them, 'emoji-room-list');
    await them.locator('#messengerRoomList button', { hasText: '이모티콘방' }).click();
    await expect(them.locator('#messengerMessages .messengerSticker img')).toHaveAttribute('alt', '고마워요');
    await api(request, `/api/messenger/rooms/${room.id}/messages`, { account: b.account, body: { sticker: 'islanders1/laugh_duri' } });
    await expect(page.locator('#messengerMessages .chatMessage:not(.mine) .messengerSticker img')).toHaveCount(1, { timeout: 10000 });
    // (v1.10.282 움직이는 이모티콘) in the room its moving picture, mine and theirs; the panel all still
    await expect(page.locator('#messengerMessages .chatMessage:not(.mine) .messengerSticker img')).toHaveAttribute('src', /\/islanders1\/anim\/laugh_duri\.webp$/);
    await expect(sent).toHaveAttribute('src', /\/islanders1\/anim\/thanks_handeul\.webp$/); /* (107b: all 24 move) */
    expect(await panel.locator('img').evaluateAll((ims) => ims.filter((im) => im.getAttribute('src')?.includes('/anim/')).length)).toBe(0);
    // 그림 글자: at the cursor, the panel kept
    await page.locator('#messengerEmojiTabGlyph').click(); await expect(panel.locator('.messengerGlyphGrid').first()).toBeVisible(); await shot(page, 'emoji-glyph');
    const input = page.locator('#messengerInput'); await input.fill('좋아요 고마워요'); await input.evaluate((el) => el.setSelectionRange(4, 4));
    await panel.getByRole('button', { name: '👍', exact: true }).click(); await expect(input).toHaveValue('좋아요 👍고마워요');
    await input.fill('가'.repeat(500)); await input.evaluate((el) => el.setSelectionRange(0, 500)); await panel.getByRole('button', { name: '👍', exact: true }).click(); await expect(input).toHaveValue('👍'); /* (v1.10.283 Codex #10: a full box, all chosen -- replaced) */
    await input.fill('좋아요 👍고마워요');
    await page.locator('#messengerEmojiBtn').click(); await expect(panel).toBeHidden(); // (the grid not moved under the finger: 최근 when opened again)
    await page.locator('#messengerEmojiBtn').click(); await expect(panel.locator('.messengerEmojiHead').first()).toHaveText('최근'); await expect(panel.locator('.messengerGlyphGrid').first().getByRole('button')).toHaveText(['👍']);
    await page.locator('#messengerEmojiBtn').click(); await expect(panel).toBeHidden();
    await shot(page, 'emoji-room'); await shot(them, 'emoji-room-them');
    // (총괄 #429) the time beside the art: its clear edge taken in on the time's side, the picture still whole
    const near = async (sel) => page.locator(sel).evaluate((el) => { const im = el.querySelector('.messengerStickerImg').getBoundingClientRect(); const t = el.querySelector('.messengerMeta').getBoundingClientRect(); return Math.round(Math.max(im.left - t.right, t.left - im.right)); });
    expect(await near('#messengerMessages .chatMessage.mine:has(.messengerSticker)')).toBeLessThan(0); expect(await near('#messengerMessages .chatMessage:not(.mine):has(.messengerSticker)')).toBeLessThan(0);
    expect(await page.evaluate(() => { const b = document.querySelector('#messengerMessages'); return b.scrollWidth <= b.clientWidth; })).toBe(true);
    if (process.env.SHOT_DIR) { // (어두운 화면: the art's edge on the panel's #352c25 and in the room)
      await page.waitForTimeout(3000); /* (the clip: ㅋㅋㅋ moving a few seconds in the room) */
      await page.evaluate(() => { document.documentElement.dataset.mtheme = 'dark'; }); await shot(page, 'emoji-dark-room');
      await page.locator('#messengerEmojiBtn').click(); await page.locator('#messengerEmojiTabSticker').click(); await shot(page, 'emoji-dark-panel');
    }
  } finally {
    const clip = page.video(); await a.context.close(); await b.context.close();
    if (clip) { await clip.saveAs(`${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-emoji-room.webm`); await clip.delete(); }
  }
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
  await api(request, `/api/messenger/rooms/${room.id}/messages?after=0`, { account: me.account }); // (read before: opened at the end -- B2)
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
  // (총괄 #393: a photo bubble beside its time never pushes the page wider than the screen -- phone and PC)
  // (a phone's innerWidth grows with the page -- the screen is the root's clientWidth; and the room within its card)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.querySelector('#messengerRoom').getBoundingClientRect().right <= document.querySelector('#mApp').getBoundingClientRect().right + 1)).toBe(true);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-photo-room.png` });
  await context.close();
});
