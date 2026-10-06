'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, kstDate, capTransfers, HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT, DAILY_ATTENDANCE } = require('../lib/point-store');
const INITIAL_GRANT = 100_000; // v1.10.35: production starts at 0P; these stores are given the old opening balance
const { testDatabase } = require('../test-support/pg-database');

const A = 'guest:11111111-1111-4111-8111-111111111111';
const B = 'guest:22222222-2222-4222-8222-222222222222';
const C = 'guest:33333333-3333-4333-8333-333333333333';
// 2026-09-27 00:30 KST == 2026-09-26 15:30 UTC
const KST_EARLY = Date.parse('2026-09-26T15:30:00Z');
const KST_LATE = Date.parse('2026-09-27T14:59:59Z'); // 23:59:59 KST same day
const KST_NEXT = Date.parse('2026-09-27T15:00:00Z'); // 00:00 KST next day

test('KST 날짜 경계는 한국시간 자정이다', () => {
  assert.equal(kstDate(Date.parse('2026-09-26T14:59:59Z')), '2026-09-26');
  assert.equal(kstDate(KST_EARLY), '2026-09-27');
  assert.equal(kstDate(KST_LATE), '2026-09-27');
  assert.equal(kstDate(KST_NEXT), '2026-09-28');
});

test('잔액 한도: 패자는 보유분까지만 내고 승자는 실제 지불분만 받는다', () => {
  const [first, second] = capTransfers([
    { from: A, to: B, amount: 80_000 },
    { from: C, to: B, amount: 10_000 },
  ], { [A]: 30_000, [B]: 0, [C]: 50_000 });
  assert.deepEqual([first.paid, first.capped, second.paid, second.capped], [30_000, true, 10_000, false]);
});

async function exercise(t, makeStore) {
  const store = await makeStore();
  await t.test('신규 계정은 100,000P를 한 번만 받는다', async () => {
    const first = await store.ensureAccount(A);
    const again = await store.ensureAccount(A);
    assert.deepEqual([first.balance, first.created, again.balance, again.created], [INITIAL_GRANT, true, INITIAL_GRANT, false]);
    const rows = await store.ledger(A);
    assert.equal(rows.filter(row => row.reason === 'initial_grant').length, 1);
  });

  await t.test('출석은 KST 날짜당 한 번, 동시 요청에도 정확히 한 번 +50,000P', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => store.claimAttendance(A, KST_EARLY)));
    assert.equal(results.filter(result => result.granted).length, 1);
    assert.equal((await store.claimAttendance(A, KST_LATE)).granted, false);
    const account = await store.getAccount(A, KST_LATE);
    assert.deepEqual(account, { balance: INITIAL_GRANT + DAILY_ATTENDANCE, attendance: { date: '2026-09-27', claimed: true } });
    const next = await store.claimAttendance(A, KST_NEXT);
    assert.equal(next.granted, true);
    assert.equal(next.balance, INITIAL_GRANT + 2 * DAILY_ATTENDANCE);
  });

  await t.test('정산은 원자적·1회만, 잔액은 0 미만이 되지 않고 원장과 일치한다', async () => {
    await store.ensureAccount(B); await store.ensureAccount(C);
    const plan = { settlementId: 'room1:1', matchId: 'room1:1', gameType: 'gostop', transfers: [
      { from: B, to: A, amount: 150_000 }, // B holds 100,000 → capped
      { from: C, to: A, amount: 20_000 },
    ] };
    const outcomes = await Promise.all([store.settle(plan), store.settle(plan), store.settle(plan)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1);
    const applied = outcomes.find(item => item.applied);
    assert.deepEqual(applied.transfers.map(item => [item.requested, item.paid, item.capped]), [[150_000, 100_000, true], [20_000, 20_000, false]]);
    assert.deepEqual(applied.balancesBefore, { [B]: 100_000, [A]: INITIAL_GRANT + 2 * DAILY_ATTENDANCE, [C]: 100_000 });
    assert.deepEqual(applied.balances, { [B]: 0, [A]: INITIAL_GRANT + 2 * DAILY_ATTENDANCE + 120_000, [C]: 80_000 });
    const duplicate = await store.settle(plan);
    assert.equal(duplicate.applied, false);
    assert.deepEqual(duplicate.balancesBefore, applied.balancesBefore);
    assert.deepEqual(duplicate.balances, applied.balances);
    const balances = await Promise.all([A, B, C].map(id => store.getAccount(id, KST_NEXT)));
    assert.deepEqual(balances.map(item => item.balance), [INITIAL_GRANT + 2 * DAILY_ATTENDANCE + 120_000, 0, 80_000]);
    for (const id of [A, B, C]) {
      const rows = await store.ledger(id, 100);
      const sum = rows.reduce((total, row) => total + row.delta, 0);
      assert.equal(sum, (await store.getAccount(id, KST_NEXT)).balance, `${id} 원장 합계`);
      for (const row of rows) {
        assert.equal(row.balanceAfter, row.balanceBefore + row.delta);
        assert.ok(row.balanceAfter >= 0);
      }
    }
    // A player with 0P can lose nothing further.
    const again = await store.settle({ settlementId: 'room1:2', matchId: 'room1:2', gameType: 'gostop', transfers: [{ from: B, to: C, amount: 5_000 }] });
    assert.equal(again.transfers[0].paid, 0);
    assert.equal((await store.getAccount(B, KST_NEXT)).balance, 0);
  });

  await t.test('정산 기록에 엔진 결과 요약이 함께 남고, 재처리는 같은 기록을 돌려준다', async () => {
    const summary = { kind: 'win', mode: 'matgo', winner: '1', score: 10, losers: [{ seat: '2', baks: ['pibak'], multiplier: 8, amount: 8_000 }] };
    const plan = { settlementId: 'room-s:1', matchId: 'room-s:1', gameType: 'gostop', summary, transfers: [{ from: C, to: A, amount: 8_000, key: '2>1' }] };
    const first = await store.settle(plan);
    const again = await store.settle(plan);
    assert.deepEqual([first.applied, again.applied], [true, false]);
    assert.deepEqual(first.summary, summary);
    assert.deepEqual(again.summary, summary);
    assert.deepEqual(again.transfers.map(item => item.paid), first.transfers.map(item => item.paid));
    const recentA = await store.recentSettlements(A, 'gostop', 10);
    const recentC = await store.recentSettlements(C, 'gostop', 10);
    const own = recentA.find(item => item.settlementId === 'room-s:1');
    assert.deepEqual([own.mode, own.delta, own.balanceAfter], ['matgo', 8_000, first.balances[A]]);
    assert.equal(recentC.find(item => item.settlementId === 'room-s:1').delta, -8_000);
    assert.equal((await store.recentSettlements(B, 'gostop', 10)).some(item => item.settlementId === 'room-s:1'), false);
    const aggregated = recentA.find(item => item.settlementId === 'room1:1');
    assert.equal(aggregated.delta, 120_000, '3인 승자의 여러 지급 원장도 한 판으로 합친다');
    await assert.rejects(() => store.settle({ ...plan, settlementId: 'room-s:2', summary: 'text' }));
    await assert.rejects(() => store.settle({ ...plan, settlementId: 'room-s:3', matchId: 'other', match: { id: 'room-s:3', gameType: 'gostop', outcomes: [{ id: 'x', result: 'win' }, { id: 'y', result: 'loss' }] } }));
  });

  await t.test('잘못된 계정·금액·자기 송금은 거부한다', async () => {
    await assert.rejects(() => store.ensureAccount('admin:session-token'));
    await assert.rejects(() => store.settle({ settlementId: 'x', gameType: 'gostop', transfers: [{ from: A, to: A, amount: 1 }] }));
    await assert.rejects(() => store.settle({ settlementId: 'y', gameType: 'gostop', transfers: [{ from: A, to: B, amount: -5 }] }));
  });
  await t.test('포인트 내역: 최신순·페이지 이어보기·본인 것만·조회는 읽기 전용', async () => {
    const before = JSON.stringify(await store.ledger(A, 1000));
    const balance = (await store.getAccount(A, KST_NEXT)).balance;
    const all = [];
    let cursor;
    let pages = 0;
    do {
      const page = await store.history(A, { limit: 2, before: cursor });
      assert.ok(page.items.length <= 2);
      all.push(...page.items);
      cursor = page.hasMore ? page.nextBefore : undefined;
      pages += 1;
    } while (cursor && pages < 50);
    const ledger = await store.ledger(A, 1000);
    assert.equal(all.length, ledger.length, '모든 원장 행을 빠짐없이 한 번씩');
    assert.deepEqual(all.map(item => item.delta), ledger.map(row => row.delta), '최신순');
    for (let i = 0; i < all.length - 1; i += 1) {
      assert.ok(all[i].seq > all[i + 1].seq);
      assert.equal(all[i].balanceBefore, all[i + 1].balanceAfter, '전후 잔액이 이어진다');
    }
    assert.equal(all[0].balanceAfter, balance, '최신 balanceAfter는 현재 잔액');
    assert.equal(all.at(-1).reason, 'initial_grant');
    assert.ok(all.some(item => item.reason === 'daily_attendance') && all.some(item => item.reason === 'game_win'));
    const gostop = all.find(item => item.reason === 'game_win' && item.mode === 'matgo');
    assert.equal(gostop.gameType, 'gostop');
    assert.deepEqual(Object.keys(all[0]).sort(), ['at', 'balanceAfter', 'balanceBefore', 'delta', 'detail', 'gameType', 'mode', 'reason', 'seq']);
    assert.equal(JSON.stringify(all).includes(B), false, '다른 사용자 식별자 미포함');
    assert.equal((await store.history(A)).items.length, Math.min(ledger.length, HISTORY_DEFAULT_LIMIT));
    assert.equal((await store.history(A, { limit: 100000 })).items.length, Math.min(ledger.length, HISTORY_MAX_LIMIT));
    await assert.rejects(() => store.history(A, { before: 'abc' }), TypeError);
    await assert.rejects(() => store.history('guest:not-real'), TypeError);
    assert.equal(JSON.stringify(await store.ledger(A, 1000)), before, '조회로 원장이 바뀌지 않는다');
    assert.equal((await store.getAccount(A, KST_NEXT)).balance, balance);
    const bOnly = await store.history(B, { limit: 50 });
    assert.equal(bOnly.items.every(item => item.reason !== 'daily_attendance'), true, 'B는 A의 출석 내역을 보지 못한다');
  });

  await t.test('스킨: 잔액 부족은 아무것도 남기지 않고, 구매는 1회만 결제되며, 미보유 장착은 거절된다 (v1.7.30)', async () => {
    const D = 'guest:44444444-4444-4444-8444-444444444444';
    const buy = (skinId = 'omok_common_jade', price = 500_000) => store.buySkin({ userId: D, skinId, price, title: '비취와 백옥 · 일반' });
    await store.ensureAccount(D);
    const start = (await store.getAccount(D)).balance;
    const ledgerBefore = (await store.ledger(D, 1000)).length;
    const poor = await buy();
    assert.deepEqual([poor.applied, poor.reason], [false, 'insufficient']);
    assert.equal((await store.getAccount(D)).balance, start, '부족하면 차감 없음');
    assert.deepEqual((await store.skinState(D)).owned, [], '부족하면 소유 없음');
    assert.equal((await store.ledger(D, 1000)).length, ledgerBefore, '부족하면 원장 없음');
    assert.deepEqual(await store.equipSkin({ userId: D, game: 'omok', slot: 'piece', skinId: 'omok_common_jade' }), { ok: false, reason: 'not-owned' });
    await assert.rejects(() => buy('BAD ID'), RangeError);
    await assert.rejects(() => buy('omok_common_jade', 0), RangeError);

    await store.adminGrant({ grantId: 'admin-grant:skin-test-1', userId: D, amount: 500_000, category: 'event', memo: '' });
    const funded = (await store.getAccount(D)).balance;
    const results = await Promise.all([buy(), buy(), buy()]);
    assert.equal(results.filter(r => r.applied).length, 1, '동시에 눌러도 1회만 결제');
    assert.equal((await store.getAccount(D)).balance, funded - 500_000);
    assert.deepEqual((await store.skinState(D)).owned, ['omok_common_jade']);
    const rows = (await store.ledger(D, 1000)).filter(row => row.reason === 'skin_purchase');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].delta, -500_000);
    assert.equal((await store.history(D)).items.find(item => item.reason === 'skin_purchase').memo, '비취와 백옥 · 일반');

    const equipped = await store.equipSkin({ userId: D, game: 'omok', slot: 'piece', skinId: 'omok_common_jade' });
    assert.deepEqual(equipped, { ok: true, equipped: { omok: { piece: 'omok_common_jade' } } });
    assert.deepEqual((await store.skinState(D)).equipped, { omok: { piece: 'omok_common_jade' } });
    assert.deepEqual((await store.equipSkin({ userId: D, game: 'omok', slot: 'piece', skinId: null })).equipped.omok ?? {}, {});
    assert.deepEqual((await store.skinState(A)).owned, [], '다른 계정에는 보이지 않는다');

    // v1.10.3 첫 접속 성별: set once; a later different choice leaves the first one
    const first = await store.setAvatarGender({ userId: D, gender: 'female' });
    assert.equal(first.chosen, true); assert.equal(first.gender, 'female');
    const again = await store.setAvatarGender({ userId: D, gender: 'male' });
    assert.equal(again.chosen, false); assert.equal(again.gender, 'female');
    assert.equal((await store.skinState(D)).equipped.avatar.gender, 'female');
    const [x, y] = await Promise.all([store.setAvatarGender({ userId: A, gender: 'male' }), store.setAvatarGender({ userId: A, gender: 'female' })]);
    assert.equal([x, y].filter((r) => r.chosen).length, 1, '동시에 골라도 하나만 저장'); assert.equal(x.gender, y.gender);
    await assert.rejects(store.setAvatarGender({ userId: D, gender: 'other' }), RangeError);
  });

  await t.test('v1.10.10 이벤트 인벤토리: 받기 한 번·스택·가득 참·장소별 정산·일일 한도·같은 요청 한 번', async () => {
    const I = 'guest:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const Items = require('../lib/island-items');
    const give = (claimId, itemId, qty = 1, meta = null) => store.islandGive({ userId: I, claimId, itemId, qty, meta });
    assert.deepEqual((await store.islandBag(I)).items, []);
    assert.equal((await give('give-trash-01', 'trash', 3)).applied, true);
    assert.equal((await give('give-trash-01', 'trash', 3)).applied, false, '같은 받기는 한 번');
    await Promise.all([give('give-trash-02', 'trash'), give('give-trash-03', 'trash')]);
    const bag = await store.islandBag(I);
    assert.deepEqual(bag.items.map((e) => [e.itemId, e.qty]), [['trash', 5]], '같은 아이템은 한 칸에 쌓인다');
    assert.equal(bag.slots, Items.BAG_SLOTS);
    await give('give-herb-01', 'herb', 2); await give('give-wallet-1', 'wallet'); await give('give-wallet-2', 'wallet');
    assert.equal((await store.islandBag(I)).items.filter((e) => e.itemId === 'wallet').length, 2, '고유 아이템은 각각 한 칸');
    for (let i = 0; i < Items.BAG_SLOTS - 4; i += 1) await give(`give-lost-${String(i).padStart(3, '0')}`, 'lost', 1, { owner: 'npc-1' });
    const full = await give('give-berry-01', 'berry');
    assert.deepEqual([full.applied, full.reason], [false, 'full']);
    assert.equal((await give('give-trash-04', 'trash')).applied, true, '가득 차도 있는 칸에는 쌓인다');
    await assert.rejects(give('give-bad-0001', 'gold'), RangeError);

    const before = (await store.getAccount(I)).balance;
    const now = Date.parse('2026-10-04T15:00:00+09:00');
    const office = await store.islandSell({ userId: I, requestId: 'sell-office-01', place: 'office' }, now);
    assert.equal(office.applied, true);
    assert.equal(office.paid, 6 * Items.ITEMS.trash.price + 2 * Items.ITEMS.wallet.price);
    assert.equal((await store.islandSell({ userId: I, requestId: 'sell-office-01', place: 'office' }, now)).applied, false, '같은 정산은 한 번');
    assert.equal((await store.getAccount(I)).balance, before + office.paid);
    assert.deepEqual((await store.islandBag(I)).items.filter((e) => e.at === 'office'), [], '관공서 물건만 나간다');
    assert.ok((await store.islandBag(I)).items.some((e) => e.itemId === 'herb'));
    const nothing = await store.islandSell({ userId: I, requestId: 'sell-office-02', place: 'office' }, now);
    assert.deepEqual([nothing.applied, nothing.reason], [false, 'nothing']);
    assert.equal((await store.history(I)).items[0].memo, '관공서 정산');

    // v1.10.35 경제 기준(통합): no daily limit -- everything handed in is paid
    await give('give-herb-02', 'herb', 60);
    const merchant = await store.islandSell({ userId: I, requestId: 'sell-merch-01', place: 'merchant' }, now);
    assert.equal(merchant.capped, false);
    assert.equal(merchant.paid, 62 * Items.ITEMS.herb.price);
    assert.equal((await store.islandBag(I)).items.some((e) => e.itemId === 'herb'), false, '모두 팔린다');
  });

  await t.test('v1.10.11 공용 이벤트 보상: 이벤트당 한 번·일일 한도·분실물 반환·주인이 떠난 분실물은 관공서', async () => {
    const R = 'guest:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const Items = require('../lib/island-items');
    const now = Date.parse('2026-10-04T16:00:00+09:00');
    const before = (await store.getAccount(R)).balance;
    const coin = await store.islandReward({ userId: R, claimId: 'event:coin0001', amount: 30, title: '떨어진 동전' }, now);
    assert.equal(coin.applied, true);
    assert.equal((await store.islandReward({ userId: R, claimId: 'event:coin0001', amount: 30, title: '떨어진 동전' }, now)).applied, false, '이벤트당 한 번');
    assert.equal((await store.getAccount(R)).balance, before + 30);
    assert.equal((await store.history(R)).items[0].memo, '떨어진 동전');
    // returning a lost thing: only with it in the bag, and it leaves the bag
    const missing = await store.islandReward({ userId: R, claimId: 'event-return:lost0001', amount: 150, title: '분실물 찾아주기', takeEventId: 'lost0001' }, now);
    assert.deepEqual([missing.applied, missing.reason], [false, 'missing']);
    await store.islandGive({ userId: R, claimId: 'event:lost0001', itemId: 'lost', meta: { eventId: 'lost0001' } });
    await store.islandGive({ userId: R, claimId: 'event:lost0002', itemId: 'lost', meta: { eventId: 'lost0002' } });
    const back = await store.islandReward({ userId: R, claimId: 'event-return:lost0001', amount: 150, title: '분실물 찾아주기', takeEventId: 'lost0001' }, now);
    assert.equal(back.applied, true);
    assert.deepEqual((await store.islandBag(R)).items.map((e) => e.meta?.eventId), ['lost0002']);
    // a lost thing whose owner is still waiting stays out of the town hall; once the owner is gone, the hall takes it
    const waiting = await store.islandSell({ userId: R, requestId: 'sell-lost-01', place: 'office', activeLost: ['lost0002'] }, now);
    assert.deepEqual([waiting.applied, waiting.reason], [false, 'nothing']);
    const found = await store.islandSell({ userId: R, requestId: 'sell-lost-02', place: 'office', activeLost: [] }, now);
    assert.equal(found.paid, Items.ITEMS.lost.price);
    // v1.10.35 경제 기준(통합): no daily limit
    assert.equal((await store.islandReward({ userId: R, claimId: 'event:big00001', amount: 60_000, title: '큰 보상' }, now)).applied, true);
    assert.equal((await store.islandReward({ userId: R, claimId: 'event:big00002', amount: 60_000, title: '또 큰 보상' }, now)).applied, true);
  });

  await t.test('v1.10.9 작명소: 30,000P(v1.10.35) 한 번 차감·같은 요청은 한 번만·24시간 대기·잔액 부족·환불', async () => {
    const N = 'guest:99999999-9999-4999-8999-999999999999'; const O = 'guest:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // fresh accounts (100,000P)
    const t0 = Date.parse('2026-10-04T12:00:00+09:00');
    const first = await store.chargeNickname({ userId: N, requestId: 'nick-0001', name: '새 이름' }, t0);
    assert.equal(first.applied, true); assert.equal(first.balanceAfter, 70_000);
    const again = await store.chargeNickname({ userId: N, requestId: 'nick-0001', name: '새 이름' }, t0);
    assert.equal(again.applied, false); assert.equal(again.name, '새 이름'); // the same request: already done
    assert.equal((await store.getAccount(N)).balance, 70_000, '한 번만 차감');
    assert.equal((await store.nicknameRequest('nick-0001')).name, '새 이름');
    assert.equal((await store.nicknameState(N)).until, new Date(t0 + 86400000).toISOString());
    await store.adminGrant({ grantId: 'admin-grant:nick-1', userId: N, amount: 500_000, category: 'event', memo: '' });
    const wait = await store.chargeNickname({ userId: N, requestId: 'nick-0002', name: '또 이름' }, t0 + 86400000 - 1);
    assert.deepEqual([wait.applied, wait.reason], [false, 'cooldown']);
    assert.equal((await store.getAccount(N)).balance, 570_000, '대기 중에는 차감 없음');
    const later = await store.chargeNickname({ userId: N, requestId: 'nick-0002', name: '또 이름' }, t0 + 86400000);
    assert.equal(later.applied, true, '거절된 요청은 다시 보낼 수 있다');
    assert.equal(await store.refundNickname({ userId: N, requestId: 'nick-0002', name: '또 이름' }), true);
    assert.equal(await store.refundNickname({ userId: N, requestId: 'nick-0002', name: '또 이름' }), false, '환불은 한 번');
    assert.equal((await store.getAccount(N)).balance, 570_000);
    assert.equal((await store.nicknameState(N)).changedAt, new Date(t0).toISOString(), '환불하면 이전 대기로');
    assert.equal(await store.nicknameRequest('nick-0002'), null);
    await store.ensureAccount(O);
    await store.chargeLook({ userId: O, requestId: 'look-o-0001', kind: 'surgery', slot: 'face_eyes', value: 'eyes_heart', price: 60_000, title: '눈' });
    await store.chargeNickname({ userId: O, requestId: 'nick-o-01', name: '가' }, t0); // 100,000 → 40,000 → 10,000
    const poor = await store.chargeNickname({ userId: O, requestId: 'nick-o-02', name: '나' }, t0 + 2 * 86400000);
    assert.deepEqual([poor.applied, poor.reason], [false, 'insufficient']);
    assert.ok((await store.history(N)).items.some((item) => item.reason === 'nickname' && item.memo === '새 이름'));
    await assert.rejects(store.chargeNickname({ userId: N, requestId: 'nick-0003', name: '  ' }, t0), RangeError);
  });

  await t.test('v1.10.30 성형외과·염색사: 요청당 한 번 차감·외형 슬롯 저장·잔액 부족은 그대로·기본색 복원도 같은 비용', async () => {
    const L = 'guest:0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c'; // a fresh account (100,000P)
    const poor = await store.chargeLook({ userId: L, requestId: 'look-0001', kind: 'surgery', slot: 'face_eyes', value: 'eyes_heart', price: 300_000, title: '눈 · 하트눈' });
    assert.deepEqual([poor.applied, poor.reason], [false, 'insufficient']);
    assert.equal((await store.getAccount(L)).balance, 100_000);
    await store.adminGrant({ grantId: 'admin-grant:look-1', userId: L, amount: 400_000, category: 'event', memo: '' });
    const done = await store.chargeLook({ userId: L, requestId: 'look-0001', kind: 'surgery', slot: 'face_eyes', value: 'eyes_heart', price: 300_000, title: '눈 · 하트눈' });
    assert.equal(done.applied, true, '거절된 요청은 다시 보낼 수 있다'); assert.equal(done.balance, 200_000);
    assert.equal(done.equipped.avatar.face_eyes, 'eyes_heart');
    const again = await store.chargeLook({ userId: L, requestId: 'look-0001', kind: 'surgery', slot: 'face_eyes', value: 'eyes_heart', price: 300_000, title: '눈 · 하트눈' });
    assert.equal(again.applied, false); assert.equal(again.slot, 'face_eyes');
    assert.equal((await store.getAccount(L)).balance, 200_000, '한 번만 차감');
    await store.chargeLook({ userId: L, requestId: 'look-0002', kind: 'dye', slot: 'dye_avatar_hair_1', value: 'c12', price: 50_000, title: '양갈래 머리 · 분홍' });
    assert.equal((await store.skinState(L)).equipped.avatar.dye_avatar_hair_1, 'c12');
    const back = await store.chargeLook({ userId: L, requestId: 'look-0003', kind: 'dye', slot: 'dye_avatar_hair_1', value: null, price: 50_000, title: '양갈래 머리 · 기본색' });
    assert.equal(back.applied, true); assert.equal(back.balance, 100_000);
    assert.equal((await store.skinState(L)).equipped.avatar.dye_avatar_hair_1, undefined);
    assert.ok((await store.history(L)).items.some((item) => item.reason === 'dye' && item.memo === '양갈래 머리 · 기본색'));
    await assert.rejects(store.chargeLook({ userId: L, requestId: 'look-0004', kind: 'surgery', slot: 'dye_avatar_hair_1', value: 'eyes_dot', price: 300_000 }), RangeError);
    await assert.rejects(store.chargeLook({ userId: L, requestId: 'look-0005', kind: 'surgery', slot: 'face_eyes', value: null, price: 300_000 }), RangeError);
  });

  await t.test('v1.10.31 잡초·주간 생활활동: 한 포기는 한 번만(동시·재요청), 999개 한 칸, 자정 보충은 하루 한 번, 10회째 50,000P 한 번', async () => {
    const W = 'guest:0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'; const V = 'guest:0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e';
    const now = Date.parse('2026-10-06T10:00:00+09:00');
    await store.islandWeedRoll({ day: '2026-10-06', grown: [] });
    const start = (await store.getAccount(W)).balance;
    // the same weed pulled by two people at once: one gets it
    const both = await Promise.all([store.islandPullWeed({ userId: W, requestId: 'weed-a-0001', weedId: 'w5' }, now), store.islandPullWeed({ userId: V, requestId: 'weed-b-0001', weedId: 'w5' }, now)]);
    assert.equal(both.filter((r) => r.applied).length, 1);
    assert.deepEqual(both.filter((r) => !r.applied).map((r) => r.reason), ['gone']);
    const winner = both[0].applied ? W : V;
    const again = await store.islandPullWeed({ userId: winner, requestId: winner === W ? 'weed-a-0001' : 'weed-b-0001', weedId: 'w5' }, now);
    assert.equal(again.applied, false, '같은 요청은 한 번만');
    assert.equal((await store.islandBag(winner)).items.find((e) => e.itemId === 'weed').qty, 1);
    // nine more for W: the 10th activity of the week pays the bonus once
    for (let i = 0; i < 12; i += 1) await store.islandPullWeed({ userId: W, requestId: `weed-w-${String(i).padStart(4, '0')}`, weedId: `w${100 + i}` }, now);
    const week = await store.islandWeek(W, now);
    assert.equal(week.paid, true); assert.ok(week.count >= 12);
    assert.equal((await store.getAccount(W)).balance, start + 50_000, '주간 보너스 한 번');
    const weeds = (await store.islandBag(W)).items.find((e) => e.itemId === 'weed');
    assert.ok(weeds.qty >= 12 && weeds.qty <= 999);
    // the town hall takes every weed at 300P, outside the daily limit of the other life rewards
    const sold = await store.islandSell({ userId: W, requestId: 'sell-weed-01', place: 'office', activeLost: [] }, now);
    assert.equal(sold.paid, weeds.qty * require('../lib/island-items').priceOf('weed', now)); // 300P (900P on a 제초 요청 day)
    assert.equal((await store.islandReward({ userId: W, claimId: 'event:weedcap1', amount: 30_000, title: '한도 그대로' }, now)).applied, true, '잡초 정산은 일일 한도에 들지 않는다');
    // a new day: the weeds pulled since the last one grow back once
    const state = await store.islandWeeds();
    assert.equal(state.pulled, 13);
    const grown = Array.from({ length: state.pulled }, (_, i) => ({ id: `g20737-${i}`, x: i, z: 10 }));
    const rolled = await store.islandWeedRoll({ day: '2026-10-07', grown });
    assert.equal(rolled.added.length, 13); assert.equal(rolled.pulled, 0);
    assert.equal((await store.islandWeedRoll({ day: '2026-10-07', grown })).added.length, 13, '하루 한 번');
    assert.equal((await store.islandPullWeed({ userId: V, requestId: 'weed-b-0002', weedId: 'g20737-3' }, now)).applied, true);
    assert.equal((await store.islandPullWeed({ userId: V, requestId: 'weed-b-0003', weedId: 'g20737-3' }, now)).reason, 'gone');
    await assert.rejects(store.islandPullWeed({ userId: V, requestId: 'weed-b-0004', weedId: 'x1' }, now), RangeError);
  });

  await t.test('v1.10.7 당일 위치: 계정당 마지막 위치와 날짜를 한 번에 저장·조회', async () => {
    const G = 'guest:77777777-7777-4777-8777-777777777777'; const H = 'guest:88888888-8888-4888-8888-888888888888';
    assert.equal(await store.plazaSpot(G), null);
    assert.equal(await store.savePlazaSpots([]), 0);
    await store.savePlazaSpots([{ userId: G, day: '2026-10-04', x: 12.345, z: -40.5 }, { userId: H, day: '2026-10-04', x: 1, z: 2 }]);
    assert.deepEqual(await store.plazaSpot(G), { day: '2026-10-04', x: 12.35, z: -40.5 });
    await store.savePlazaSpots([{ userId: G, day: '2026-10-05', x: 3, z: 4 }]);
    assert.deepEqual(await store.plazaSpot(G), { day: '2026-10-05', x: 3, z: 4 }, '계정당 한 줄(덮어쓰기)');
    assert.deepEqual(await store.plazaSpot(H), { day: '2026-10-04', x: 1, z: 2 });
    await assert.rejects(store.savePlazaSpots([{ userId: G, day: '어제', x: 1, z: 1 }]), TypeError);
    await assert.rejects(store.savePlazaSpots([{ userId: G, day: '2026-10-05', x: NaN, z: 1 }]), RangeError);
  });

  await t.test('v1.10.5 기부: 즉시 소각·요청당 한 번·잔액 부족 거절·주간 순위(같은 금액은 먼저 도달한 사람)·한 번만 결산', async () => {
    const E = 'guest:55555555-5555-4555-8555-555555555555'; const F = 'guest:66666666-6666-4666-8666-666666666666'; // fresh accounts (100,000P each)
    const week = '2026-09-28'; const inWeek = (h) => Date.parse(`2026-09-29T0${h}:00:00+09:00`);
    const startA = (await store.getAccount(E)).balance; const startB = (await store.getAccount(F)).balance;
    const first = await store.donate({ userId: E, requestId: 'don-a-0001', amount: 30_000, name: '에이' }, inWeek(1));
    assert.equal(first.applied, true); assert.equal(first.total, 30_000); assert.equal(first.balance, startA - 30_000);
    assert.equal((await store.donate({ userId: E, requestId: 'don-a-0001', amount: 30_000, name: '에이' }, inWeek(1))).applied, false, '같은 요청은 한 번만');
    assert.equal((await store.getAccount(E)).balance, startA - 30_000, '소각: 다른 계정으로 가지 않는다');
    const tooMuch = await store.donate({ userId: F, requestId: 'don-b-big1', amount: startB + 1, name: '비' }, inWeek(2));
    assert.deepEqual([tooMuch.applied, tooMuch.reason], [false, 'insufficient']);
    assert.equal((await store.getAccount(F)).balance, startB);
    await new Promise((r) => setTimeout(r, 15));
    assert.equal((await store.donate({ userId: F, requestId: 'don-b-0001', amount: 10_000, name: '비' }, inWeek(2))).applied, true);
    await new Promise((r) => setTimeout(r, 15));
    assert.equal((await store.donate({ userId: F, requestId: 'don-b-0002', amount: 20_000, name: '비' }, inWeek(3))).total, 30_000); // same total, reached later
    await assert.rejects(store.donate({ userId: E, requestId: 'don-a-0002', amount: 0 }, inWeek(1)), RangeError);
    const rows = await store.donationWeekRows(week);
    assert.equal(rows.length, 2);
    assert.deepEqual(await store.donationUnsettledWeeks('2026-10-05'), [week]);
    const statues = [{ rank: 1, name: '에이', look: {} }, { rank: 2, name: '비', look: {} }];
    const settled = await store.settleDonationWeek(week, statues);
    assert.equal(settled.applied, true);
    assert.equal(settled.hoguking, E, '같은 30,000P면 먼저 도달한 사람이 1위');
    assert.deepEqual(settled.ranking.map((r) => [r.name, r.total, r.rank]), [['에이', 30_000, 1], ['비', 30_000, 2]]);
    assert.equal((await store.settleDonationWeek(week, [])).applied, false, '한 번만');
    assert.deepEqual((await store.donationWeekResult(week)).statues, statues);
    assert.deepEqual(await store.donationUnsettledWeeks('2026-10-05'), []);
    assert.equal((await store.history(E)).items.find((item) => item.reason === 'donation').memo, `${week} 주`);
  });

  return store;
}

test('JSON 포인트 저장소', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'points-'));
  const file = path.join(dir, 'points.json');
  await exercise(t, async () => { const store = new JsonPointStore(file, { initialGrant: INITIAL_GRANT }); await store.init(); return store; });
  // Reload from disk: balances survive a restart.
  const reloaded = new JsonPointStore(file, { initialGrant: INITIAL_GRANT });
  await reloaded.init();
  assert.equal((await reloaded.getAccount(B)).balance, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test('PostgreSQL 포인트 저장소', async (t) => {
  const database = await testDatabase(); // POINTS_TEST_DATABASE_URL이 없으면 PGlite를 자동으로 띄운다
  t.after(() => database.stop());
  const url = database.url;
  const { Pool } = require('pg');
  const admin = new Pool({ connectionString: url });
  await admin.query('DROP TABLE IF EXISTS point_ledger, point_settlements, point_accounts, mission_days, skin_owned, skin_equipped');
  await admin.end();
  const { PostgresMatchStore } = require('../lib/match-records');
  const matches = new PostgresMatchStore(url);
  await matches.pool.query('DROP TABLE IF EXISTS game_match_history');
  await matches.init();
  const store = await exercise(t, async () => { const s = new PostgresPointStore(url, { initialGrant: INITIAL_GRANT }); await s.init(); await s.init(); return s; });

  const match = id => ({ id, gameType: 'gostop', at: new Date().toISOString(), outcomes: [{ id: 'p-a', result: 'win' }, { id: 'p-c', result: 'loss' }] });
  const snapshot = async () => ({
    balances: (await store.pool.query('SELECT user_id, balance FROM point_accounts ORDER BY user_id')).rows.map(row => [row.user_id, Number(row.balance)]),
    ledger: Number((await store.pool.query('SELECT count(*) FROM point_ledger')).rows[0].count),
    settlements: Number((await store.pool.query('SELECT count(*) FROM point_settlements')).rows[0].count),
    matches: Number((await store.pool.query('SELECT count(*) FROM game_match_history')).rows[0].count),
  });

  await t.test('PostgreSQL: 원장·정산·전적이 한 트랜잭션에서 함께 커밋된다', async () => {
    const before = await snapshot();
    const plan = { settlementId: 'room-m:1', matchId: 'room-m:1', gameType: 'gostop', match: match('room-m:1'), transfers: [{ from: C, to: A, amount: 1_000, key: '2>1' }] };
    const outcomes = await Promise.all([store.settle(plan), store.settle(plan)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1);
    const after = await snapshot();
    assert.deepEqual([after.ledger - before.ledger, after.settlements - before.settlements, after.matches - before.matches], [2, 1, 1]);
    assert.equal((await matches.recordMatch(match('room-m:1'))), false, '전적 저장소 재기록은 중복 없음');
  });

  await t.test('PostgreSQL: 전적 기록이 실패하면 원장·정산·잔액이 모두 롤백되고, 재시도는 1회만 반영된다', async () => {
    const before = await snapshot();
    const connect = store.pool.connect.bind(store.pool);
    store.pool.connect = async () => {
      const client = await connect();
      const query = client.query.bind(client);
      client.query = (text, ...rest) => (typeof text === 'string' && text.includes('INSERT INTO game_match_history')
        ? Promise.reject(new Error('injected failure')) : query(text, ...rest));
      const release = client.release.bind(client);
      client.release = (...args) => { client.query = query; return release(...args); };
      return client;
    };
    const plan = { settlementId: 'room-f:1', matchId: 'room-f:1', gameType: 'gostop', match: match('room-f:1'), transfers: [{ from: C, to: A, amount: 2_000, key: '2>1' }] };
    await assert.rejects(() => store.settle(plan), /injected failure/);
    store.pool.connect = connect;
    assert.deepEqual(await snapshot(), before, '부분 반영 없음');
    const retried = await store.settle(plan);
    assert.equal(retried.applied, true);
    assert.equal((await store.settle(plan)).applied, false);
    const after = await snapshot();
    assert.deepEqual([after.ledger - before.ledger, after.settlements - before.settlements, after.matches - before.matches], [2, 1, 1]);
  });
  await matches.pool.end();
  await store.pool.end();
});
