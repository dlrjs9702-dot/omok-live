const { test, expect } = require('@playwright/test');
const path = require('node:path');
const gostop = require(path.join(__dirname, '..', '..', 'lib', 'games', 'gostop'));

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.88 고스톱·맞고 화투판 시각화. Special situations are built with the real engine (explicit
// hands/floor/deck) and fed to the real UI module inside a real game room page; the ordinary flow,
// spectator privacy and reconnect run against the real server. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.67.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function guest(browser, request, admin, label, contextOptions = {}) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...contextOptions });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, token: await page.evaluate(() => document.body.dataset.session), label, keyId: data.key.id, admin, request };
}

async function adminToken(request) {
  const { data } = await api(request, '/api/admin/login', null, { password: adminPassword });
  return data.sessionToken;
}

const roomState = async (request, token) => (await api(request, '/api/room', token, undefined, 'GET')).data.state;

// ---- engine-built scenarios ----------------------------------------------------------------

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let roundCounter = 100;
function position({ seats = ['1', '2'], hands, floor = [], deck = [], captured = {}, turn = '1', setupFn }) {
  const game = gostop.create();
  gostop.start(game, seats, { random: seeded(3) });
  Object.assign(game, { hands: Object.fromEntries(seats.map(s => [s, [...(hands[s] || [])]])), floor: [...floor], deck: [...deck],
    captured: Object.fromEntries(seats.map(s => [s, [...(captured[s] || [])]])), turn, phase: 'play', status: 'playing', winner: null, result: null, ctx: null,
    floorBonus: {}, ppeokOwner: {}, nagariStreak: 0, round: ++roundCounter, lastEvent: null });
  for (const key of ['goCount', 'lastGoScore', 'shakes', 'bombs', 'bombFlips', 'ppeok']) game[key] = Object.fromEntries(seats.map(s => [s, 0]));
  game.gukjin = Object.fromEntries(seats.map(s => [s, null]));
  setupFn?.(game);
  return game;
}
const view = (game, seat) => ({ game: gostop.publicState(game), hand: gostop.handFor(game, seat) });
function scenario(game, viewer, act) {
  const before = view(game, viewer);
  act(game);
  return { viewer, before, after: view(game, viewer) };
}

const P = m => `m${String(m).padStart(2, '0')}-pi1`;
const P2 = m => `m${String(m).padStart(2, '0')}-pi2`;
const SCENARIOS = {
  normal: () => scenario(position({ hands: { 1: ['m01-pi1', P(5)], 2: [P(6)] }, floor: ['m01-gwang', 'm11-gwang'], deck: ['m12-animal'] }), '1',
    g => gostop.play(g, '1', 'm01-pi1')),
  choose: () => scenario(position({ hands: { 1: ['m01-pi1', P(5)], 2: [P(6)] }, floor: ['m01-gwang', 'm01-ribbon'], deck: [P(4)] }), '1',
    g => gostop.play(g, '1', 'm01-pi1')),
  ppeok: () => scenario(position({ hands: { 1: [P(6)], 2: ['m05-pi1', P(7)] }, floor: ['m05-animal', 'm11-gwang'], deck: ['m05-pi2'], turn: '2' }), '1',
    g => gostop.play(g, '2', 'm05-pi1')),
  ppeokEat: () => scenario(position({ hands: { 1: [P(6), P(8)], 2: ['m05-ribbon', P(7)] }, floor: ['m05-animal', 'm05-pi1', 'm05-pi2', 'm11-gwang'], deck: [P(9)], turn: '2',
    captured: { 1: [P(3), P2(3)] }, setupFn: g => { g.ppeokOwner = { 5: '1' }; } }), '1', g => gostop.play(g, '2', 'm05-ribbon')),
  jjok: () => scenario(position({ hands: { 1: [P(3), P(5)], 2: [P(6)] }, floor: ['m11-gwang'], deck: [P2(3)], captured: { 2: [P(4), 'm10-animal'] } }), '1',
    g => gostop.play(g, '1', P(3))),
  ttadak: () => {
    const g = position({ hands: { 1: ['m06-pi1', P(5)], 2: [P(7)] }, floor: ['m06-animal', 'm06-ribbon', 'm11-gwang'], deck: ['m06-pi2'], captured: { 2: [P(4)] } });
    gostop.play(g, '1', 'm06-pi1');
    return scenario(g, '1', x => gostop.chooseFloor(x, '1', 'm06-animal'));
  },
  sweep: () => scenario(position({ hands: { 1: ['m01-pi1', P(5)], 2: [P(6)] }, floor: ['m01-gwang', 'm02-animal'], deck: ['m02-pi1'], captured: { 2: [P(3)] } }), '1',
    g => gostop.play(g, '1', 'm01-pi1')),
  shake: () => scenario(position({ hands: { 1: [P(6)], 2: ['m07-animal', 'm07-ribbon', 'm07-pi1', 'm02-ribbon', 'm03-pi1'] }, floor: ['m11-gwang'], deck: [P(4)], turn: '2' }), '1',
    g => gostop.play(g, '2', 'm07-pi1', { shake: true })),
  bomb: () => scenario(position({ hands: { 1: ['m07-animal', 'm07-ribbon', 'm07-pi1', P(5)], 2: [P(6)] }, floor: ['m07-pi2', 'm11-gwang'], deck: [P(4)], captured: { 2: [P(10)] } }), '1',
    g => gostop.play(g, '1', 'm07-animal', { bomb: true })),
  kong: () => scenario(position({ hands: { 1: ['m03-ribbon', 'm03-pi1', P(5)], 2: [P(6)] }, floor: ['m03-gwang', 'm03-pi2', 'm11-gwang'], deck: [P(4)] }), '1',
    g => gostop.play(g, '1', 'm03-ribbon', { kong: true })),
  goStop: () => scenario(position({ hands: { 1: ['m03-gwang', P(5), P(6)], 2: [P(7), P(8)] }, floor: ['m03-pi1'], deck: [P(4), P2(4), P2(5), P2(6)],
    captured: { 1: ['m01-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang', P(1)] } }), '1', g => gostop.play(g, '1', 'm03-gwang')),
  hongdan: () => scenario(position({ hands: { 1: ['m03-ribbon', P(5)], 2: [P(6)] }, floor: ['m03-pi1', 'm11-gwang'], deck: [P(4)], captured: { 1: ['m01-ribbon', 'm02-ribbon'] } }), '1',
    g => gostop.play(g, '1', 'm03-ribbon')),
};

async function openHarness(page, token) {
  // Keep the real room page (layout, CSS, UI module) but stop the app from re-rendering the table
  // with the live room state while engine-built states are shown.
  await expect(page.locator('#gostopPanel')).toBeVisible();
  await page.evaluate(() => { window.__gostopRender = window.GostopUI.render; window.GostopUI.render = () => {}; });
  return page.evaluate(async (sessionToken) => (await (await fetch('/api/room', { headers: { 'X-Session-Token': sessionToken } })).json()).state, token);
}

async function show(page, room, sc, { animate = true } = {}) {
  return page.evaluate(({ room: base, sc: s, animate: run }) => {
    const wrap = (v) => ({ ...base, gameType: 'gostop', game: v.game, players: { 1: { label: '나' }, 2: { label: '상대' }, 3: { label: '셋' } },
      me: { ...base.me, seat: s.viewer, myGostopHand: v.hand } });
    window.__gostopRender(wrap(s.before));
    window.__gostopRender(wrap(s.before)); // baseline: the first sight of an event never animates
    const from = window.GostopUI.fxLog.length;
    if (run) window.__gostopRender(wrap(s.after));
    return from;
  }, { room, sc, animate });
}

const entries = (page, from) => page.evaluate(start => window.GostopUI.fxLog.slice(start), from);
const settle = page => expect.poll(() => page.evaluate(() => window.GostopUI.fxBusy()), { timeout: 10_000 }).toBe(false);
const box = (page, selector) => page.locator(selector).boundingBox();
const inside = (pt, r, pad = 30) => pt && r && pt.x >= r.x - pad && pt.x <= r.x + r.width + pad && pt.y >= r.y - pad && pt.y <= r.y + r.height + pad;

test.describe('고스톱·맞고 화투판 시각화 (v1.6.88)', () => {
  test('카드 이동·특수상황·점수/배수·정산 화면 (엔진 상태 재생)', async ({ browser, request }, testInfo) => {
    test.setTimeout(180_000);
    const admin = await adminToken(request);
    const me = await guest(browser, request, admin, '나');
    await me.page.locator('[data-game="gostop"]').click();
    await me.page.locator('#createRoomBtn').click();
    const room = await openHarness(me.page, me.token);
    const page = me.page;
    const shot = async name => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });

    // 1~5) 손패 클릭 결과 재생: 손 → 바닥(짝 옆) → 산패 등장 → 바닥 → 먹은 패는 내 획득패 영역으로.
    let from = await show(page, room, SCENARIOS.normal());
    await page.waitForTimeout(250); await shot('01-play-moving');
    await settle(page);
    let log = await entries(page, from);
    const floor = await box(page, '#gostopFloor');
    const mine = await box(page, '#gostopMine');
    const deck = await box(page, '#gostopDeck');
    const play = log.find(e => e.k === 'play');
    expect(play.card).toBe('m01-pi1');
    expect(play.from.y).toBeGreaterThan(floor.y + floor.height - 10); // from my hand, below the table
    expect(inside(play.to, floor)).toBe(true);
    const flip = log.find(e => e.k === 'flip');
    expect(flip.card).toBe('m12-animal');
    expect(inside(flip.from, deck)).toBe(true);
    expect(log.findIndex(e => e.k === 'flip')).toBeGreaterThan(log.findIndex(e => e.k === 'play'));
    const captures = log.filter(e => e.k === 'capture');
    expect(captures.map(e => e.card).sort()).toEqual(['m01-gwang', 'm01-pi1']);
    for (const e of captures) { expect(e.seat).toBe('1'); expect(inside(e.to, mine)).toBe(true); }
    await expect(page.locator('#gostopMine .pile-gwang .hwatu')).toHaveCount(1);
    await expect(page.locator('.gostopFxHidden')).toHaveCount(0);
    await expect(page.locator('#gostopFxLayer .gostopSprite')).toHaveCount(0);
    await shot('02-play-done');

    // 6) 같은 월 선택: 먹을 수 있는 바닥 카드만 강조, 낸 패는 바닥 옆에 대기.
    from = await show(page, room, SCENARIOS.choose());
    await settle(page);
    await expect(page.locator('#gostopFloor .hwatu.actionableTarget')).toHaveCount(2);
    await expect(page.locator('#gostopFloor .waitingCard .hwatu')).toHaveCount(1);
    expect((await entries(page, from)).some(e => e.k === 'play' && e.card === 'm01-pi1')).toBe(true);
    await shot('03-choose');

    // 7) 뻑: 상대 패가 뒷면에서 앞면으로 나와 같은 월 3장이 한 더미로 남는다.
    from = await show(page, room, SCENARIOS.ppeok());
    await page.waitForTimeout(200); await shot('04-ppeok-moving');
    await settle(page);
    log = await entries(page, from);
    const opp = await box(page, '#gostopOpponents');
    expect(inside(log.find(e => e.k === 'play').from, opp, 60)).toBe(true);
    expect(log.filter(e => e.k === 'stack')).toHaveLength(3);
    await expect(page.locator('#gostopFloor .ppeokStack .hwatu')).toHaveCount(3);
    await expect(page.locator('#gostopFloor .ppeokStack')).toContainText('뻑');
    await shot('05-ppeok');

    // 8) 뻑 먹기: 뻑 더미 전체가 먹은 사람(상대) 영역으로, 이어서 내 피가 상대에게.
    from = await show(page, room, SCENARIOS.ppeokEat());
    await settle(page);
    log = await entries(page, from);
    const eaten = log.filter(e => e.k === 'capture');
    expect(eaten.map(e => e.card).sort()).toEqual(['m05-animal', 'm05-pi1', 'm05-pi2', 'm05-ribbon']);
    for (const e of eaten) expect(inside(e.to, await box(page, '#gostopOpponents'))).toBe(true);
    const steal = log.find(e => e.k === 'steal');
    expect(inside(steal.from, await box(page, '#gostopMine'))).toBe(true);
    expect(inside(steal.to, await box(page, '#gostopOpponents'))).toBe(true);
    expect(log.indexOf(steal)).toBeGreaterThan(log.indexOf(eaten[0]));

    // 9) 쪽: 낸 패가 바닥에 놓이고 → 산패가 그 옆으로 → 둘 다 내 영역 → 상대 피가 내 피로.
    from = await show(page, room, SCENARIOS.jjok());
    await page.waitForTimeout(700); await shot('06-jjok-moving');
    await settle(page);
    log = await entries(page, from);
    expect(log.map(e => e.k)).toEqual(expect.arrayContaining(['play', 'place', 'flip', 'match', 'capture', 'steal']));
    const jjokSteal = log.find(e => e.k === 'steal');
    expect(jjokSteal.card).toBe(P(4));
    expect(inside(jjokSteal.to, await box(page, '#gostopMine .pile-pi'))).toBe(true);

    // 10) 따닥: 처음 묶음(낸 패+고른 패) → 산패 → 나머지까지 → 피 이동 순서.
    from = await show(page, room, SCENARIOS.ttadak());
    await settle(page);
    log = await entries(page, from);
    const kinds = log.map(e => e.k);
    expect(kinds.indexOf('match')).toBeLessThan(kinds.indexOf('flip'));
    expect(kinds.lastIndexOf('match')).toBeGreaterThan(kinds.indexOf('flip'));
    expect(log.filter(e => e.k === 'capture')).toHaveLength(4);
    expect(kinds.indexOf('steal')).toBeGreaterThan(kinds.lastIndexOf('capture') - 4);

    // 11) 판쓸이: 바닥 카드가 모두 내 쪽으로 이동하고 바닥이 빈다.
    from = await show(page, room, SCENARIOS.sweep());
    await settle(page);
    log = await entries(page, from);
    expect(log.filter(e => e.k === 'capture')).toHaveLength(4);
    await expect(page.locator('#gostopFloor .hwatu')).toHaveCount(0);
    expect(log.some(e => e.k === 'steal')).toBe(true);

    // 12) 흔들기: 상대의 같은 월 3장만 잠깐 앞면으로, 나머지 손패는 끝까지 뒷면(값 미전달).
    const shakeSc = SCENARIOS.shake();
    expect(JSON.stringify(shakeSc.after.game)).not.toContain('m02-ribbon');
    from = await show(page, room, shakeSc);
    await page.waitForTimeout(350); await shot('07-shake');
    const reveal = (await entries(page, from)).filter(e => e.k === 'reveal');
    expect(reveal.map(e => e.card).sort()).toEqual(['m07-animal', 'm07-pi1', 'm07-ribbon']);
    await settle(page);
    const html = await page.content();
    expect(html).not.toContain('m02-ribbon');
    expect(html).not.toContain('m03-pi1');
    await expect(page.locator('#gostopOpponents .gostopBacks .hwatuBack')).toHaveCount(4);

    // 13) 폭탄: 손 3장이 함께 바닥 짝으로 → 4장 한 묶음으로 내 영역.
    from = await show(page, room, SCENARIOS.bomb());
    await page.waitForTimeout(200); await shot('08-bomb-moving');
    await settle(page);
    log = await entries(page, from);
    const bombPlays = log.filter(e => e.k === 'play');
    expect(bombPlays).toHaveLength(3);
    expect(new Set(bombPlays.map(e => e.run)).size).toBe(1);
    expect(log.filter(e => e.k === 'capture' && e.card.startsWith('m07'))).toHaveLength(4);
    // 콩알탄: 2장이 함께.
    from = await show(page, room, SCENARIOS.kong());
    await settle(page);
    expect((await entries(page, from)).filter(e => e.k === 'play')).toHaveLength(2);

    // 14~15) 고/스톱 버튼은 행동 영역에, 점수·고·배수·예상 한 줄.
    const goSc = SCENARIOS.goStop();
    from = await show(page, room, goSc);
    await settle(page);
    await expect(page.getByRole('button', { name: '고 (1고)' })).toBeVisible();
    await expect(page.getByRole('button', { name: '스톱' })).toBeVisible();
    await expect(page.getByRole('button', { name: '스톱' })).toHaveClass(/actionable/);
    const goGame = position({ hands: { 1: [P(5), P(6)], 2: [P(7), P(8)] }, floor: [], deck: [P(4)], captured: { 1: ['m01-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang', 'm03-gwang', P(1), 'm03-pi1'] } });
    goGame.phase = 'go-stop';
    const goScenario = scenario(goGame, '1', g => gostop.decide(g, '1', 'go'));
    from = await show(page, room, goScenario);
    await settle(page);
    await expect(page.locator('#gostopMine .gostopStats')).toContainText('1고');
    await expect(page.locator('#gostopMine .gostopEstimate')).toHaveText(/^\d+점 · 1고 · ×2 · 예상 [\d,]+P$/);

    // 44) 점수 성립: 홍단 완성 시 띠 묶음을 짧게 강조.
    from = await show(page, room, SCENARIOS.hongdan());
    await expect(page.locator('#gostopMine .pile-ribbon .fxScoreTag')).toContainText('홍단', { timeout: 5000 });
    await settle(page);

    // 16) 최종 정산 화면: 기본·고·점당 칩, 패자별 계산과 잔액 한도 실제 지급액.
    const endGame = position({ seats: ['1', '2', '3'], hands: { 1: [], 2: [], 3: [] }, captured: { 1: ['m01-gwang', 'm03-gwang', 'm08-gwang', ...[1, 2, 4, 5, 6, 7, 8].flatMap(m => [P(m), P2(m)])], 2: [P(10)], 3: [P2(10), P(11), P2(11), 'm11-ssangpi', 'm12-ssangpi', 'm09-pi1', 'm11-gwang'] } });
    endGame.goCount['1'] = 2;
    gostop.finish(endGame, '1', 'stop');
    const endView = view(endGame, '1');
    const [l2, l3] = endGame.result.losers;
    endView.game.settlement = { status: 'done', kind: 'win', transfers: [
      { fromSeat: '2', toSeat: '1', requested: l2.amount, paid: 6200, capped: true },
      { fromSeat: '3', toSeat: '1', requested: l3.amount, paid: l3.amount, capped: false }] };
    await show(page, room, { viewer: '1', before: endView, after: endView }, { animate: false });
    const result = page.locator('#gostopResult');
    await expect(result.locator('.gostopChip').first()).toHaveText(`기본 ${endGame.result.base}점`);
    await expect(result).toContainText('2고 +2점');
    await expect(result).toContainText('점당 100P');
    await expect(result.locator('.gostopLoserLine')).toHaveCount(2);
    await expect(result.locator('.gostopLoserLine').nth(0)).toContainText('피박 ×2');
    await expect(result.locator('.gostopLoserLine').nth(0)).toContainText(`계산 ${l2.amount.toLocaleString('ko-KR')}P → 실제 6,200P`);
    await expect(result.locator('.gostopLoserLine').nth(1)).not.toContainText('피박');
    await expect(result.locator('.gostopWinLine')).toHaveText(`나 → +${(6200 + l3.amount).toLocaleString('ko-KR')}P`);
    await result.screenshot({ path: testInfo.outputPath('09-result.png') });
    await me.context.close();
  });

  test('reduced-motion: 이동 없이 즉시 최종 상태, 진행 기능은 동일', async ({ browser, request }) => {
    test.setTimeout(60_000);
    const admin = await adminToken(request);
    const me = await guest(browser, request, admin, '나', { reducedMotion: 'reduce' });
    await me.page.locator('[data-game="gostop"]').click();
    await me.page.locator('#createRoomBtn').click();
    const room = await openHarness(me.page, me.token);
    const from = await show(me.page, room, SCENARIOS.jjok());
    expect(await me.page.evaluate(() => window.GostopUI.fxBusy())).toBe(false);
    expect(await entries(me.page, from)).toEqual([]);
    await expect(me.page.locator('#gostopMine .pile-pi .hwatu')).toHaveCount(3);
    await expect(me.page.locator('#gostopMine .pile-pi .hwatu').first()).toBeVisible();
    await expect(me.page.locator('#gostopHand .hwatu.actionableTarget')).toHaveCount(0); // 상대 차례
    await me.context.close();
  });

  test('실제 대국: 손패 클릭 → 이동 재생·입력 잠금, 관전자 비공개, 재접속 후 재생 없이 복원', async ({ browser, request }) => {
    test.setTimeout(120_000);
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '가');
    const b = await guest(browser, request, admin, '나');
    const w = await guest(browser, request, admin, '관');
    await a.page.locator('[data-game="gostop"]').click();
    const [created] = await Promise.all([
      a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
      a.page.locator('#createRoomBtn').click(),
    ]);
    const code = (await created.json()).state.me.roomCode;
    for (const v of [b, w]) { await v.page.locator('#roomPasswordInput').fill(code); await v.page.locator('#roomPasswordInput').press('Enter'); await expect(v.page.locator('#gostopPanel')).toBeVisible(); }
    for (const [v, choice] of [[a, '1'], [b, '2'], [w, 'spectator']]) expect((await api(request, '/api/room/choose-role', v.token, { choice })).status).toBe(200);
    await a.page.locator('#gostopStartBtn').click();
    await expect.poll(async () => (await roomState(request, a.token)).game.status).not.toBe('selecting');
    let state = await roomState(request, a.token);
    test.skip(state.game.status !== 'playing', '총통으로 즉시 종료된 분배');
    const actor = state.game.turn === '1' ? a : b;
    const other = actor === a ? b : a;
    const fromActor = await actor.page.evaluate(() => window.GostopUI.fxLog.length);
    const fromWatcher = await w.page.evaluate(() => window.GostopUI.fxLog.length);
    await actor.page.locator('#gostopHand .hwatu.actionableTarget').first().click();
    const special = actor.page.getByRole('button', { name: '그냥 내기' });
    if (await special.isVisible().catch(() => false)) await special.click();
    // 이동이 재생되는 동안 손패 입력은 잠긴다.
    await expect.poll(() => actor.page.evaluate(() => window.GostopUI.fxLog.length)).toBeGreaterThan(fromActor);
    if (await actor.page.evaluate(() => window.GostopUI.fxBusy())) {
      await expect(actor.page.locator('#gostopHand button.hwatu:not([disabled])')).toHaveCount(0);
    }
    await expect.poll(() => actor.page.evaluate(() => window.GostopUI.fxBusy()), { timeout: 10_000 }).toBe(false);
    const actorLog = await actor.page.evaluate(start => window.GostopUI.fxLog.slice(start), fromActor);
    expect(actorLog.some(e => e.k === 'play')).toBe(true);
    // 관전자도 같은 공개 이동을 보되, 손패 값은 DOM·이동 기록 어디에도 없다.
    await expect.poll(() => w.page.evaluate(() => window.GostopUI.fxLog.length)).toBeGreaterThan(fromWatcher);
    const watcherLog = await w.page.evaluate(start => window.GostopUI.fxLog.slice(start), fromWatcher);
    state = await roomState(request, a.token);
    const hands = [...((await roomState(request, a.token)).me.myGostopHand || []), ...((await roomState(request, b.token)).me.myGostopHand || [])].map(c => c.id);
    const watcherHtml = await w.page.content();
    for (const id of hands) {
      expect(watcherHtml).not.toContain(id);
      expect(watcherLog.some(e => e.card === id)).toBe(false);
    }
    // 재접속: 입장 파일을 다시 열면 같은 자리·손패로 복원되고, 지난 이동은 다시 재생하지 않는다.
    const { data } = await api(request, `/api/admin/keys/${other.keyId}/reissue`, admin, {});
    await other.page.goto('about:blank');
    await Promise.all([other.page.waitForURL(/\/guest-entry$/), other.page.setContent(data.html)]);
    other.token = await other.page.evaluate(() => document.body.dataset.session);
    await expect(other.page.locator('#gostopPanel')).toBeVisible();
    const mineNow = (await roomState(request, other.token)).me.myGostopHand;
    await expect(other.page.locator('#gostopHand .hwatu')).toHaveCount(mineNow.length);
    await other.page.waitForTimeout(600);
    expect(await other.page.evaluate(() => window.GostopUI.fxLog.length)).toBe(0);
    await expect(other.page.locator('.gostopFxHidden')).toHaveCount(0);
    for (const v of [a, b, w]) await v.context.close();
  });
});
