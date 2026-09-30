'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { JsonPointStore, PostgresPointStore, entryPayout, creditAfterBurn } = require('../lib/point-store');

// v1.7.3 common game points: entry fee, 80/20 payout, refund, admin grant, 10% settlement burn.
const A = 'guest:00000000-0000-4000-8000-00000000000a';
const B = 'guest:00000000-0000-4000-8000-00000000000b';
const C = 'guest:00000000-0000-4000-8000-00000000000c';
const D = 'guest:00000000-0000-4000-8000-00000000000d';

test('분배 계산: 20% 소각·80% 승자 균등, 1P 잔여는 소각, 포인트는 새로 생기지 않는다', () => {
  const entry = (n) => ({ participants: [A, B, C, D].slice(0, n), pool: 1_000 * n });
  assert.deepEqual(entryPayout(entry(2), [A]), { winners: [A], reward: 1_600, each: 1_600, paid: 1_600, burned: 400 });
  assert.deepEqual(entryPayout(entry(4), [A]), { winners: [A], reward: 3_200, each: 3_200, paid: 3_200, burned: 800 });
  assert.deepEqual(entryPayout(entry(4), [A, C]), { winners: [A, C], reward: 3_200, each: 1_600, paid: 3_200, burned: 800 }, '팀전 2명');
  assert.deepEqual(entryPayout(entry(3), [A, B]), { winners: [A, B], reward: 2_400, each: 1_200, paid: 2_400, burned: 600 }, '공동승리');
  const odd = entryPayout(entry(4), [A, B, C]);
  assert.deepEqual([odd.each, odd.paid, odd.burned], [1_066, 3_198, 802], '3,200P를 3명이 나누면 2P 추가 소각');
  assert.deepEqual(entryPayout(entry(2), [A, 'guest:00000000-0000-4000-8000-0000000000ff']).winners, [A], '참가비를 내지 않은 계정은 받지 않는다');
  for (let n = 2; n <= 4; n += 1) for (let w = 0; w <= n; w += 1) {
    const split = entryPayout(entry(n), [A, B, C, D].slice(0, w));
    assert.equal(split.paid + split.burned, 1_000 * n, `${n}인 ${w}승자 보존`);
  }
  assert.deepEqual([creditAfterBurn(10_000, 10), creditAfterBurn(4_000, 10), creditAfterBurn(1_234, 10), creditAfterBurn(5, 10)], [9_000, 3_600, 1_110, 4]);
});

async function exercise(t, makeStore) {
  const store = await makeStore();
  const balance = async id => (await store.getAccount(id)).balance;

  await t.test('참가비: 전원 1,000P 동시 차감, 같은 판 id는 동시 요청에도 1회', async () => {
    const plan = { entryId: 'game-entry:r1:1', gameType: 'othello', matchId: 'r1:1', participants: [A, B], fee: 1_000 };
    const outcomes = await Promise.all([store.chargeEntry(plan), store.chargeEntry(plan), store.chargeEntry(plan)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1);
    assert.deepEqual([await balance(A), await balance(B)], [99_000, 99_000]);
    assert.equal(outcomes.find(item => item.applied).pool, 2_000);
  });

  await t.test('승자 지급: 80%(1,600P)·20% 소각, 중복 종료 요청에도 1회, 이후 환불 불가', async () => {
    const plan = { resultId: 'game-result:r1:1', entryId: 'game-entry:r1:1', winners: [A] };
    const outcomes = await Promise.all([store.settleEntry(plan), store.settleEntry(plan)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1);
    assert.deepEqual([await balance(A), await balance(B)], [100_600, 99_000]);
    const refund = await store.refundEntry({ refundId: 'game-refund:r1:1', entryId: 'game-entry:r1:1' });
    assert.equal(refund.applied, false, '지급된 판은 환불되지 않음');
    assert.deepEqual([await balance(A), await balance(B)], [100_600, 99_000]);
  });

  await t.test('참가비 부족: 한 명이라도 1,000P 미만이면 아무도 차감되지 않고, 부족 계정만 알려 준다', async () => {
    await store.testSpendTo(C, 999);
    const before = [await balance(A), await balance(C)];
    const outcome = await store.chargeEntry({ entryId: 'game-entry:r2:1', gameType: 'davinci', participants: [A, C], fee: 1_000 });
    assert.equal(outcome.applied, false);
    assert.deepEqual(outcome.insufficient, [C]);
    assert.deepEqual([await balance(A), await balance(C)], before);
    assert.deepEqual(await store.openEntries(), [], '거부된 차감은 흔적을 남기지 않음');
    // 부족이 해결되면 같은 판 id로 다시 시도할 수 있다.
    await store.testSpendTo(C, 999);
  });

  await t.test('시스템 무효: 전액 1회 환불, 이후 지급 불가, 미정산 목록에서 빠진다', async () => {
    await store.chargeEntry({ entryId: 'game-entry:r3:1', gameType: 'bingo', participants: [A, B, D], fee: 1_000 });
    assert.deepEqual(await store.openEntries(), ['game-entry:r3:1']);
    const before = [await balance(A), await balance(B), await balance(D)];
    const refunds = await Promise.all([1, 2].map(() => store.refundEntry({ refundId: 'game-refund:r3:1', entryId: 'game-entry:r3:1', reason: 'server-restart' })));
    assert.equal(refunds.filter(item => item.applied).length, 1);
    assert.deepEqual([await balance(A), await balance(B), await balance(D)], before.map(value => value + 1_000));
    assert.equal((await store.settleEntry({ resultId: 'game-result:r3:1', entryId: 'game-entry:r3:1', winners: [A] })).applied, false);
    assert.deepEqual(await store.openEntries(), []);
  });

  await t.test('동시 지급·환불 경합: 정확히 하나만 적용된다', async () => {
    await store.chargeEntry({ entryId: 'game-entry:r4:1', gameType: 'yut', participants: [A, B], fee: 1_000 });
    const total = async () => (await balance(A)) + (await balance(B));
    const before = await total();
    const [paid, refunded] = await Promise.all([
      store.settleEntry({ resultId: 'game-result:r4:1', entryId: 'game-entry:r4:1', winners: [B] }),
      store.refundEntry({ refundId: 'game-refund:r4:1', entryId: 'game-entry:r4:1' }),
    ]);
    assert.equal(Number(paid.applied) + Number(refunded.applied), 1);
    assert.equal(await total(), before + (paid.applied ? 1_600 : 2_000));
  });

  await t.test('고스톱 10% 소각: 패자 실제 손실 100%, 승자 90%(내림), 잔액 한도 적용분 기준', async () => {
    await store.testSpendTo(D, 4_000);
    const beforeA = await balance(A);
    const outcome = await store.settle({ settlementId: 'gostop:burn:1', gameType: 'gostop', burnPercent: 10,
      transfers: [{ from: D, to: A, amount: 10_000, key: '2>1' }] });
    const [item] = outcome.transfers;
    assert.deepEqual([item.requested, item.paid, item.capped, item.credited, item.burned], [10_000, 4_000, true, 3_600, 400]);
    assert.equal(outcome.burned, 400);
    assert.deepEqual([await balance(D), await balance(A)], [0, beforeA + 3_600]);
    assert.equal((await store.settle({ settlementId: 'gostop:burn:1', gameType: 'gostop', burnPercent: 10, transfers: [{ from: D, to: A, amount: 10_000 }] })).applied, false);
    const three = await store.settle({ settlementId: 'gostop:burn:2', gameType: 'gostop', burnPercent: 10,
      transfers: [{ from: B, to: A, amount: 1_235, key: '2>1' }, { from: C, to: A, amount: 999, key: '3>1' }] });
    assert.deepEqual(three.transfers.map(entry => [entry.paid, entry.credited, entry.burned]), [[1_235, 1_111, 124], [999, 899, 100]], '3인 복수 패자 각각 적용');
  });

  await t.test('관리자 지급: 10,000P 단위 전액(소각 없음), 사유 기록, 같은 요청 id는 1회', async () => {
    const before = await balance(B);
    const grant = { grantId: 'admin-grant:11111111-1111-4111-8111-111111111111', userId: B, amount: 50_000, category: 'correction', memo: '' };
    const outcomes = await Promise.all([store.adminGrant(grant), store.adminGrant(grant)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1);
    const applied = outcomes.find(item => item.applied);
    assert.deepEqual([applied.balanceBefore, applied.balanceAfter, applied.summary.category], [before, before + 50_000, 'correction']);
    assert.equal(await balance(B), before + 50_000);
    for (const amount of [15_000, 0, -10_000, 1.5, 20_000_000]) {
      await assert.rejects(store.adminGrant({ ...grant, grantId: `admin-grant:${crypto.randomUUID()}`, amount }), RangeError, String(amount));
    }
    await assert.rejects(store.adminGrant({ ...grant, grantId: `admin-grant:${crypto.randomUUID()}`, category: 'gift' }), RangeError);
    const other = await store.adminGrant({ ...grant, grantId: `admin-grant:${crypto.randomUUID()}`, amount: 10_000, category: 'other', memo: '  서버\n점검 <보상>  ' });
    assert.equal(other.summary.memo, '서버 점검 <보상>');
    const history = await store.history(B, { limit: 5 });
    assert.deepEqual([history.items[0].reason, history.items[0].detail, history.items[0].memo, history.items[0].delta], ['admin_grant', 'other', '서버 점검 <보상>', 10_000]);
    assert.deepEqual([history.items[1].reason, history.items[1].detail, history.items[1].balanceAfter], ['admin_grant', 'correction', before + 50_000]);
  });

  await t.test('원장: 참가·보상·환불이 각자 사유로 남고 내역에는 게임 종류가 보인다', async () => {
    const reasons = (await store.history(A, { limit: 50 })).items.map(item => [item.reason, item.gameType]);
    for (const expected of [['game_entry', 'othello'], ['game_reward', 'othello'], ['game_refund', 'bingo'], ['game_win', 'gostop']]) {
      assert.ok(reasons.some(([reason, game]) => reason === expected[0] && game === expected[1]), JSON.stringify(expected));
    }
  });
  await t.test('이벤트 보상(v1.7.15): 계정·이벤트당 1회(동시 요청 포함), 전액 지급, 원장·내역에 이벤트 이름', async () => {
    const eventId = 'test_event_2026';
    const claim = { eventId, userId: C, amount: 100_000, title: '  테스트\n이벤트  ' };
    const before = await balance(C);
    const outcomes = await Promise.all([store.claimEvent(claim), store.claimEvent(claim), store.claimEvent(claim)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1, '동시 3건 중 1건만 지급');
    const applied = outcomes.find(item => item.applied);
    assert.deepEqual([applied.balanceBefore, applied.balanceAfter, applied.eventId, applied.amount], [before, before + 100_000, eventId, 100_000]);
    assert.equal(await balance(C), before + 100_000);
    assert.equal((await store.claimEvent(claim)).applied, false, '재요청은 추가 지급 없음');
    assert.equal(await balance(C), before + 100_000);
    assert.deepEqual(await store.claimedEvents(C, [eventId, 'other_event']), [eventId]);
    assert.deepEqual(await store.claimedEvents(D, [eventId]), [], '다른 계정은 아직 미수령');
    const otherBefore = await balance(D);
    assert.equal((await store.claimEvent({ ...claim, userId: D })).applied, true, '같은 이벤트도 다른 계정은 각자 1회');
    assert.equal(await balance(D), otherBefore + 100_000);
    assert.equal((await store.claimEvent({ ...claim, eventId: 'second_event_2026' })).applied, true, '같은 계정도 다른 이벤트는 별도');
    for (const bad of [{ amount: 0 }, { amount: -1 }, { amount: 1.5 }, { amount: 20_000_000 }, { eventId: 'Bad Id' }, { eventId: 'x' }, { userId: 'guest:nope' }]) {
      await assert.rejects(store.claimEvent({ ...claim, eventId: 'never_paid_event', ...bad }), e => e instanceof RangeError || e instanceof TypeError, JSON.stringify(bad));
    }
    const rows = (await store.ledger(C, 50)).filter(row => row.reason === 'event_reward');
    assert.equal(rows.length, 2, '원장에는 이벤트 지급 행이 이벤트마다 1개');
    assert.ok(rows.every(row => row.delta === 100_000 && row.idempotencyKey.includes(C)));
    assert.ok(rows.some(row => row.idempotencyKey.includes(eventId)));
    const history = await store.history(C, { limit: 5 });
    const item = history.items.find(entry => entry.reason === 'event_reward' && entry.balanceAfter === before + 100_000);
    assert.deepEqual([item.delta, item.memo, item.balanceBefore, item.detail], [100_000, '테스트 이벤트', before, 'event']);
  });
  return store;
}

test('JSON 포인트 저장소: 참가 포인트·정산 소각·관리자 지급', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await exercise(t, async () => { const store = new JsonPointStore(path.join(dir, 'points.json')); await store.init(); return store; });
  // Persisted: a restarted process sees the same open entries and balances.
  const reloaded = new JsonPointStore(path.join(dir, 'points.json'));
  await reloaded.init();
  assert.deepEqual(await reloaded.openEntries(), []);
});

test('PostgreSQL 포인트 저장소: 참가 포인트·정산 소각·관리자 지급', { skip: !process.env.POINTS_TEST_DATABASE_URL && 'POINTS_TEST_DATABASE_URL 미설정' }, async (t) => {
  const url = process.env.POINTS_TEST_DATABASE_URL;
  const { Pool } = require('pg');
  const admin = new Pool({ connectionString: url });
  await admin.query('DROP TABLE IF EXISTS point_ledger, point_settlements, point_accounts');
  await admin.end();
  const store = await exercise(t, async () => { const s = new PostgresPointStore(url); await s.init(); return s; });
  const sum = await store.pool.query('SELECT sum(delta) AS total, count(*) AS rows FROM point_ledger');
  const balances = await store.pool.query('SELECT sum(balance) AS total FROM point_accounts');
  assert.equal(Number(sum.rows[0].total), Number(balances.rows[0].total), '원장 합계 = 잔액 합계');
  await store.pool.end();
});
