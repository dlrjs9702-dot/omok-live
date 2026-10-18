const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// A4 주말 섬 대회 (IDEAS #future-weekend-contest): at the set time the week's event runs for everyone; the bar over the island
// shows the time left and the live top 3, the server judges the records it made itself (here 두더지 잡기 rounds), and at the
// end 1st~3rd and every entrant are paid once and the winner stands on the plaza. The test moves the contest's clock and
// holds the event at 두더지 잡기 (/api/test/contest/clock). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('주말 섬 대회: 진행 중 막대·실시간 순위, 서버 판정 기록, 끝나면 시상 1회와 우승자 동상', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '대회일등', 100000, 'female');
  const b = await shopper(browser, request, '대회이등', 100000, 'male');
  const round = async (who, score) => {
    const id = (await post(request, '/api/solo/reflex/start', who.token, { game: 'whack', level: 'easy' })).data.id;
    await post(request, '/api/test/reflex/age', who.token, { id, ageMs: 31000 });
    return (await post(request, '/api/solo/reflex/finish', who.token, { id, score })).data;
  };
  try {
    expect((await post(request, '/api/test/contest/clock', a.token, { to: 'live', kind: 'whack' })).data.phase).toBe('live');
    const { page } = a;
    await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
    await expect(page.locator('#contestBar')).toContainText('두더지 잡기 대회', { timeout: 15000 });
    await round(a, 260); await round(b, 220); await round(a, 240); // a's best is kept
    const view = (await get(request, '/api/island/contest', a.token)).data;
    expect(view.top.map((r) => [r.name, r.score])).toEqual([['대회일등', 260], ['대회이등', 220]]);
    expect(view.mine).toEqual({ score: 260, rank: 1 });
    await expect(page.locator('#contestBar')).toContainText('1위 대회일등', { timeout: 20000 });
    const before = [(await get(request, '/api/points', a.token)).data.balance, (await get(request, '/api/points', b.token)).data.balance];
    expect((await post(request, '/api/test/contest/clock', a.token, { to: 'end' })).data.phase).toBe('done');
    const after = [(await get(request, '/api/points', a.token)).data.balance, (await get(request, '/api/points', b.token)).data.balance];
    expect([after[0] - before[0], after[1] - before[1]]).toEqual([31000, 16000]); // 1st 30,000 + entry 1,000; 2nd 15,000 + 1,000
    const last = (await get(request, '/api/island/contest', b.token)).data.last;
    expect(last).toMatchObject({ rewarded: true, entrants: 2, top: [{ rank: 1, name: '대회일등', score: 260 }, { rank: 2, name: '대회이등', score: 220 }] });
    await post(request, '/api/test/contest/clock', a.token, { to: 'end' }); // settled once
    expect((await get(request, '/api/points', a.token)).data.balance).toBe(after[0]);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().statues.some((s) => s.name === '대회일등')), { timeout: 20000 }).toBe(true);
    await expect(page.locator('#contestBar')).toContainText('우승 대회일등', { timeout: 20000 });
    await expectNoScriptError(page);
  } finally { await post(request, '/api/test/contest/clock', a.token, { to: 'reset' }); }
  await a.context.close(); await b.context.close();
});
