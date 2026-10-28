const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// v1.10.91 주민 대화·심부름 (사용자 2026-10-18): any walking islander talks (name, their own words); the day's errands
// show a star over the asker, the tracker says where to go, and the one at the end pays once. PC and phone.
// A-6 (docs/residents-talk-hills-20261018.md 1·2): walking or not; held on every screen while the window is open (also past
// the old 3-9 s stop), the choices after their words, let go on closing; someone else's talk says with whom.
test('주민 대화: 걷는 주민 붙잡기·선택지·두 화면 멈춤, 심부름 받고 끝내면 사례', async ({ browser, request }) => {
  test.setTimeout(process.env.CI ? 600000 : 300000);
  const who = await shopper(browser, request, '심부름꾼', 500000, 'male');
  const other = await shopper(browser, request, '구경꾼', 0, 'female');
  const { page, token } = who;
  for (const p of [page, other.page]) { await p.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }); await p.reload(); } // (the stand-ins: the talk needs no models -- two islands with them overran CI's phone run)
  for (const p of [page, other.page]) await expect.poll(() => p.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const dialog = page.locator('#plazaDialog');
  const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  // (the debug helper stands me by them and talks at once -- CI's slow frames; the server still checks the distance, a
  // walk-off between is retried; an island event may take the islander meanwhile -- events first: let it go for the test)
  const talkTo = async (n) => {
    await expect.poll(async () => {
      // (CI 3차, run 39704740141: 120 s of 「가까이 가서 다시 시도해 주세요」 -- talkResident puts me by them without leaving, so
      // the server took it as a walk from my last place and stopped me at the other player standing on that line
      // (plazaSeparate); a warp first (leave, enter fresh), then the talk from a step away)
      if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, n); await page.waitForTimeout(1500); }
      return talking();
    }, { timeout: 120000, intervals: [300] }).toBe(true).catch(async (error) => { error.message += `\ntoast: ${await page.locator('#toast').textContent().catch(() => '?')} n: ${n}`; throw error; }); // (CI 3차: once 120 s with no talk on CI -- the server's answer, to find why)
    if (!process.env.CI) expect(await page.evaluate(() => window.PlazaDebug().talkView?.id)).toBe(`resident:${n}`); // the talk camera (사용자 2026-10-18: every talk) -- (CI: a slow screen draws the walker behind, too far for the camera)
  };
  // (대화창 새 단장: the words typed out -- Space shows a line at once, then the next)
  const lines = async () => { for (let k = 0; k < 8 && await page.locator('.lostRequestLine.talkPending, .lostRequestLine.typing').count(); k += 1) await page.keyboard.press('Space'); };
  const choose = async (key, all = true) => { await Promise.all([page.waitForResponse((r) => r.url().includes('/api/island/resident/talk')), page.keyboard.press(key)]); if (all) await lines(); };
  // (a talk asked twice on a slow runner may answer after the first Escape and open again: Escape until it stays shut)
  const close = async () => { await expect.poll(async () => { if (await talking()) await page.keyboard.press('Escape'); await page.waitForTimeout(400); return talking(); }, { timeout: 20000 }).toBe(false); };
  const holdOn = (p, n) => p.evaluate((n) => window.PlazaDebug().residentReservations[n]?.hold?.eventId || null, n);
  await post(request, '/api/test/island/free-residents', token, {}); // (CI: no resident still held by an earlier test's event)
  const view = (await get(request, '/api/island/errands', token)).data;
  expect(view.total).toBe(3);
  // someone with nothing for me: held for the talk on both screens, the choices, still held past the old stop, let go on closing
  const idle = [...Array(10).keys()].find((n) => !(n in view.marks));
  await talkTo(idle);
  await lines();
  const choices = page.locator('#plazaDialog .talkChoices button');
  // (대화창 새 단장) four at most and only what can be done today -- nothing to ask of them: no 「부탁」
  const TOP = ['이야기해요', '선물해요', '잘 가요']; const TOPICS = ['요즘 어때요?', '섬 소문 있어요?', '이야기 나눠요', '← 돌아가기'];
  await expect(choices).toHaveText(TOP);
  // the words' bubble and the choices' bubble: on the screen, apart
  const box = async (sel) => page.locator(sel).boundingBox(); const vp = page.viewportSize();
  const words = await box('#plazaDialog'); const menu = await box('#plazaDialog .talkChoices');
  for (const b of [words, menu]) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(vp.width); expect(b.y + b.height).toBeLessThanOrEqual(vp.height); }
  expect(menu.y + menu.height).toBeLessThanOrEqual(words.y);
  await page.keyboard.press('1'); await expect(choices).toHaveText(TOPICS); await page.keyboard.press('4'); await expect(choices).toHaveText(TOP); // 이야기해요 → 돌아가기
  await page.keyboard.press('1'); await expect(choices).toHaveText(TOPICS);
  await expect.poll(async () => (await holdOn(other.page, idle)) || '', { timeout: 30000 }).toMatch(/^talk:/); // (the other screen hears it from the server: past 15 s on a slow runner; '' while not yet -- toMatch on null stops the poll)
  // (a slow screen eases the islander into the place it is held at: measured once it stands there)
  let at = await other.page.evaluate((n) => window.PlazaDebug().wanderers[n], idle);
  await expect.poll(async () => { const now = await other.page.evaluate((n) => window.PlazaDebug().wanderers[n], idle); const d = Math.hypot(now.x - at.x, now.z - at.z); at = now; return d; }, { timeout: 20000, intervals: [1000] }).toBeLessThan(0.05);
  await page.waitForTimeout(13000); // past the server's lease: the window renews it
  expect((await holdOn(other.page, idle)) || '').toMatch(/^talk:/);
  const still = await other.page.evaluate((n) => window.PlazaDebug().wanderers[n], idle);
  expect(Math.hypot(still.x - at.x, still.z - at.z)).toBeLessThan(0.6);
  const busy = await post(request, '/api/island/resident/talk', other.token, { n: idle });
  expect(busy.status).toBe(409); expect(busy.data.message).toContain('심부름꾼님과 이야기 중');
  await choose('2', false); // 섬 소문: typed out (no choices meanwhile), Space shows it all
  // (one moment: while a line is typing, no choices -- read together, a slow runner may finish the line between two checks)
  const typingNow = () => page.evaluate(() => ({ typing: Boolean(document.querySelector('.lostRequestLine.typing')), choices: getComputedStyle(document.querySelector('#plazaDialog .talkChoices')).display }));
  const seen = await typingNow(); if (seen.typing) expect(seen.choices).toBe('none');
  await page.keyboard.press('Space'); await expect(page.locator('.lostRequestLine.typing')).toHaveCount(0);
  await expect(page.locator('.lostRequestLine').first()).not.toHaveText(/^「[\s\S]*」$/); // (v1.10.194 대화창 2차: no 「 」 round it -- a 「낚시 대회」 inside it stays)
  await lines(); await expect(choices).toHaveText(TOP);
  // (R2 ④) their question of the day: three answers in place of the choices; one answered, the choices back -- and that
  // one gone from the topics for today
  await page.keyboard.press('1'); await choose('3'); await expect(choices).toHaveCount(3); await expect(choices.first()).toHaveAttribute('data-topic', 'answer');
  await choose('1'); await expect(choices).toHaveText(TOP);
  await page.keyboard.press('1'); await expect(choices).toHaveText(['요즘 어때요?', '섬 소문 있어요?', '← 돌아가기']); await page.keyboard.press('3');
  // (R3 ⑥) a gift: what my bag holds that they could take -- one given, the choices back without 「선물해요」
  await post(request, '/api/test/island/give', token, { itemId: 'berry', qty: 1 });
  await choose('2'); await expect(choices.first()).toHaveAttribute('data-topic', 'gift'); await expect(choices.first()).toHaveText('나무 열매');
  await choose('1'); await expect(choices).toHaveText(['이야기해요', '잘 가요']);
  await page.keyboard.press('2'); await expect(dialog).not.toHaveClass(/talkMode/); // 잘 가요
  await expect.poll(() => holdOn(other.page, idle), { timeout: 15000 }).toBe(null);
  // the asker: the request (their name on the window) before the choices, then the tracker
  const askers = Object.entries(view.marks).filter(([, m]) => m === 'new').map(([n]) => Number(n));
  expect(askers.length).toBeGreaterThan(0);
  const before = (await get(request, '/api/points', token)).data.balance;
  await talkTo(askers[0]);
  await expect(page.locator('#plazaDialogTitle')).not.toHaveText('');
  // (asked -- or, a slow runner having talked twice, reminded; T: in any walker's register; T2: their own word first, the ask
  // typed out after it)
  await lines(); await expect(page.locator('.lostRequestLine').filter({ hasText: /전해 줄래|전해 주겠|전해 주게|못 봤|사다 줄래|사다 주겠|사다 주게|필요한데|아직 못/ }).first()).toBeVisible();
  await expect(page.locator('#plazaDialogTitle')).toHaveAttribute('data-hearts', '♥'); // 호감도 (the first talk of the day +1; v1.10.193 2차: the hearts by the name)
  // (Q 부탁 받기: the ask's note -- what, what it pays, today -- and 「할게요!」 / 「다음에요」; nothing started by talking)
  await expect(page.locator('#plazaDialog .questNote')).toContainText('오늘 안에');
  expect((await get(request, '/api/island/errands', token)).data.track).toHaveLength(0);
  await expect(choices).toHaveText(['할게요!', '다음에요']);
  await choose('1');
  await expect(page.locator('#questTracker .questLine')).toHaveCount(1);
  await close();
  const track = (await get(request, '/api/island/errands', token)).data.track;
  expect(track).toHaveLength(1);
  await expect(page.locator('#questTracker')).toContainText('심부름');
  if (track[0].to === askers[0]) { await expectNoScriptError(page); return; } // (a store errand: the good is general-store's test)
  // the one it is for (and, for someone to find, back to the asker): paid once -- 「부탁 완료!」 with its stamp
  await page.evaluate(() => { window.__doneSeen = false; new MutationObserver(() => { if (document.querySelector('.questDone .questStamp')) window.__doneSeen = true; }).observe(document.body, { childList: true, subtree: true }); });
  await talkTo(track[0].to); await close();
  let now = (await get(request, '/api/island/errands', token)).data;
  if (now.done === 0) { await talkTo(now.track[0].to); await close(); now = (await get(request, '/api/island/errands', token)).data; }
  expect(now.done).toBe(1);
  expect(await page.evaluate(() => window.__doneSeen)).toBe(true);
  // (2026-10-28: the day's errand took its asker to 아는 사이 -- that level's own pay came with it; a fresh account: each level once)
  const def = (key) => require('../../lib/economy').DEFS.find((d) => d.key === key).def;
  const levelPay = (await get(request, '/api/island/affinity', token)).data.residents.reduce((sum, r) => sum + (r.level >= 1 ? def('affinity:known') : 0) + (r.level >= 2 ? def('affinity:close') : 0), 0);
  expect((await get(request, '/api/points', token)).data.balance - before).toBe(track[0].reward + levelPay); // (the errand's own pay: its kind and how far apart -- 묶음 1 errand:far)
  await expectNoScriptError(page);
  await who.context.close(); await other.context.close();
});
