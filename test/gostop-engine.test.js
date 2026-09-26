'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const gostop = require('../lib/games/gostop');
const scoring = require('../lib/games/gostop/scoring');
const { CARDS } = require('../lib/games/gostop/cards');

function seeded(seed = 42) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Build a mid-game position directly: every hand, the floor and the deck order are explicit.
function setup({ seats = ['1', '2'], hands, floor = [], deck = [], captured = {}, turn = '1', stake = 100, nagari = 0 }) {
  const game = gostop.create();
  game.pointsPerScore = stake;
  assert.equal(gostop.start(game, seats, { random: seeded(7) }).legal, true);
  game.hands = Object.fromEntries(seats.map(seat => [seat, [...(hands[seat] || [])]]));
  game.floor = [...floor];
  game.deck = [...deck];
  game.captured = Object.fromEntries(seats.map(seat => [seat, [...(captured[seat] || [])]]));
  game.turn = turn; game.phase = 'play'; game.status = 'playing'; game.winner = null; game.result = null; game.ctx = null;
  game.nagariStreak = nagari; game.floorBonus = {}; game.ppeokOwner = {};
  return game;
}

const PI = month => `m${String(month).padStart(2, '0')}-pi1`;
const PI2 = month => `m${String(month).padStart(2, '0')}-pi2`;

test('덱은 48장 + 보너스피 2장(쌍피·쓰리피)이고 분배 장수는 맞고 10/8, 고스톱 7/6이다', () => {
  assert.equal(CARDS.length, 50);
  assert.deepEqual(CARDS.filter(card => card.bonus).map(card => card.piValue).sort(), [2, 3]);
  for (const [seats, hand, floor] of [[['1', '2'], 10, 8], [['1', '2', '3'], 7, 6]]) {
    for (let i = 0; i < 20; i += 1) {
      const game = gostop.create();
      assert.equal(gostop.start(game, seats).legal, true);
      if (game.status !== 'playing') continue; // 총통 즉시 종료
      for (const seat of seats) assert.equal(game.hands[seat].length, hand);
      assert.equal(game.floor.length, floor);
      const all = [...game.deck, ...game.floor, ...Object.values(game.hands).flat(), ...Object.values(game.captured).flat()];
      assert.equal(new Set(all).size, 50);
      assert.ok(game.floor.every(id => !id.startsWith('bonus')), '바닥 보너스피는 선에게 가고 채워진다');
    }
  }
});

test('공개 상태에는 손패·산 순서가 없고, 손패는 본인에게만 제공된다', () => {
  const game = gostop.create();
  gostop.start(game, ['1', '2', '3']);
  const view = gostop.publicState(game);
  const text = JSON.stringify(view);
  for (const seat of ['1', '2', '3']) for (const id of game.hands[seat]) assert.equal(text.includes(id), false, `${id} 노출`);
  for (const id of game.deck) assert.equal(text.includes(id), false);
  assert.equal(view.seats['2'].handCount, game.hands['2'].length);
  assert.deepEqual(gostop.handFor(game, '2').map(item => item.id), game.hands['2']);
  assert.equal(gostop.handFor(game, null), null);
});

test('정상 매칭·2장 중 선택·3장 스택·산패 뒤집기', () => {
  // 같은 월 1장: 먹고, 산패는 바닥 빈 곳으로.
  let game = setup({ hands: { 1: ['m01-gwang', PI(5)], 2: [PI(6), PI(7)] }, floor: ['m01-pi1', 'm03-gwang'], deck: [PI(4), PI2(4)] });
  assert.equal(gostop.play(game, '1', 'm01-gwang').legal, true);
  assert.deepEqual(game.captured['1'].sort(), ['m01-gwang', 'm01-pi1'].sort());
  assert.ok(game.floor.includes(PI(4)));
  assert.equal(game.turn, '2');
  // 같은 월 2장(서로 다른 종류): 어떤 패를 먹을지 선택.
  game = setup({ hands: { 1: ['m01-pi1', PI(5)], 2: [PI(6)] }, floor: ['m01-gwang', 'm01-ribbon'], deck: [PI(4)] });
  const verdict = gostop.play(game, '1', 'm01-pi1');
  assert.equal(verdict.choice, 'floor');
  assert.equal(game.phase, 'choose-floor');
  assert.equal(gostop.chooseFloor(game, '2', 'm01-gwang').legal, false);
  assert.equal(gostop.chooseFloor(game, '1', 'm01-gwang').legal, true);
  assert.ok(game.captured['1'].includes('m01-gwang'));
  assert.ok(game.floor.includes('m01-ribbon'));
  // 같은 월 3장(개막 3장): 4장 모두 먹는다.
  game = setup({ hands: { 1: ['m02-pi1', PI(5)], 2: [PI(6)] }, floor: ['m02-animal', 'm02-ribbon', 'm02-pi2'], deck: [PI(4)] });
  gostop.play(game, '1', 'm02-pi1');
  assert.equal(game.captured['1'].filter(id => id.startsWith('m02')).length, 4);
  // 산패 2장 선택.
  game = setup({ hands: { 1: [PI(5), PI(6)], 2: [PI(7)] }, floor: ['m08-gwang', 'm08-animal'], deck: ['m08-pi1'] });
  assert.equal(gostop.play(game, '1', PI(5)).choice, 'flip');
  assert.equal(gostop.chooseFlip(game, '1', 'm08-gwang').legal, true);
  assert.ok(game.captured['1'].includes('m08-gwang'));
});

test('점수: 삼광·비삼광·사광·오광·열끗·고도리·홍단/청단/초단·띠·피·쌍피', () => {
  const s = ids => scoring.scoreBreakdown(ids).total;
  assert.equal(s(['m01-gwang', 'm03-gwang', 'm08-gwang']), 3);
  assert.equal(s(['m01-gwang', 'm03-gwang', 'm12-gwang']), 2);
  assert.equal(s(['m01-gwang', 'm03-gwang', 'm08-gwang', 'm12-gwang']), 4);
  assert.equal(s(['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang']), 15);
  assert.equal(s(['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm12-animal']), 1);
  assert.equal(s(['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm12-animal', 'm09-animal']), 2);
  assert.equal(s(['m02-animal', 'm04-animal', 'm08-animal']), 5);
  assert.equal(s(['m01-ribbon', 'm02-ribbon', 'm03-ribbon']), 3);
  assert.equal(s(['m06-ribbon', 'm09-ribbon', 'm10-ribbon']), 3);
  assert.equal(s(['m04-ribbon', 'm05-ribbon', 'm07-ribbon']), 3);
  assert.equal(s(['m04-ribbon', 'm05-ribbon', 'm07-ribbon', 'm12-ribbon', 'm06-ribbon']), 1 + 3);
  const tenPi = [1, 2, 3, 4, 5].flatMap(m => [PI(m), PI2(m)]);
  assert.equal(s(tenPi), 1);
  assert.equal(s([...tenPi, 'm11-ssangpi']), 3);
  assert.equal(s([...tenPi.slice(0, 7), 'bonus-3']), 1); // 7 + 3 = 10피
});

test('국진은 열끗/쌍피 중 하나로만 계산하고, 먹은 순간 선택 단계가 열린다', () => {
  const animals = ['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm09-animal'];
  assert.equal(scoring.scoreBreakdown(animals, false).total, 1);
  assert.equal(scoring.scoreBreakdown(animals, true).total, 0);
  assert.equal(scoring.scoreBreakdown(animals, true).counts.pi, 2);
  const game = setup({ hands: { 1: ['m09-pi1', PI(5)], 2: [PI(6)] }, floor: ['m09-animal'], deck: [PI(4)] });
  gostop.play(game, '1', 'm09-pi1');
  assert.equal(game.phase, 'gukjin');
  assert.equal(gostop.chooseGukjin(game, '2', true).legal, false);
  assert.equal(gostop.chooseGukjin(game, '1', true).legal, true);
  assert.equal(game.gukjin['1'], 'pi');
  assert.equal(game.turn, '2');
});

test('쪽·따닥·판쓸이는 상대 피를 1장씩 가져온다(3인은 두 상대 모두)', () => {
  // 쪽
  let game = setup({ seats: ['1', '2', '3'], hands: { 1: [PI(3), PI(5)], 2: [PI(6)], 3: [PI(7)] }, floor: ['m11-gwang'], deck: [PI2(3)],
    captured: { 2: ['m04-pi1'], 3: ['m04-pi2'] } });
  gostop.play(game, '1', PI(3));
  assert.ok(game.lastEvent.tags.includes('jjok'));
  assert.ok(game.captured['1'].includes('m04-pi1') && game.captured['1'].includes('m04-pi2'));
  // 따닥
  game = setup({ hands: { 1: ['m06-pi1', PI(5)], 2: [PI(7)] }, floor: ['m06-animal', 'm06-ribbon', 'm01-gwang'], deck: ['m06-pi2'], captured: { 2: [PI(4)] } });
  gostop.play(game, '1', 'm06-pi1');
  gostop.chooseFloor(game, '1', 'm06-animal');
  assert.ok(game.lastEvent.tags.includes('ttadak'));
  assert.equal(game.captured['1'].filter(id => id.startsWith('m06')).length, 4);
  assert.ok(game.captured['1'].includes(PI(4)));
  // 판쓸이
  game = setup({ hands: { 1: [PI(1), PI(5)], 2: [PI(7)] }, floor: [PI2(1)], deck: [PI(4)], captured: { 2: ['m02-pi1'] } });
  game.floor.push('m04-pi2');
  gostop.play(game, '1', PI(1));
  assert.ok(game.lastEvent.tags.includes('sweep'));
  assert.ok(game.captured['1'].includes('m02-pi1'));
});

test('뻑·자뻑·뻑 먹기·3뻑', () => {
  // 뻑: 낸 패, 먹을 패, 뒤집은 패가 모두 바닥에 남는다.
  let game = setup({ hands: { 1: ['m05-pi1', PI(6)], 2: ['m05-ribbon', PI(7)] }, floor: ['m05-animal'], deck: ['m05-pi2', PI(8)], captured: { 1: [PI(9)], 2: [PI(10)] } });
  gostop.play(game, '1', 'm05-pi1');
  assert.ok(game.lastEvent.tags.includes('ppeok'));
  assert.equal(game.floor.filter(id => id.startsWith('m05')).length, 3);
  assert.equal(game.ppeok['1'], 1);
  // 상대가 뻑 먹기: 4장 + 피 1장.
  gostop.play(game, '2', 'm05-ribbon');
  assert.ok(game.lastEvent.tags.includes('ppeokEat'));
  assert.equal(game.captured['2'].filter(id => id.startsWith('m05')).length, 4);
  assert.ok(game.captured['2'].includes(PI(9)));
  // 자뻑: 피 2장.
  game = setup({ hands: { 1: ['m05-ribbon', PI(6)], 2: [PI(7)] }, floor: ['m05-animal', 'm05-pi1', 'm05-pi2'], deck: [PI(8)], captured: { 2: [PI(10), PI2(10)] } });
  game.ppeokOwner = { 5: '1' };
  gostop.play(game, '1', 'm05-ribbon');
  assert.ok(game.lastEvent.tags.includes('jappeok'));
  assert.ok(game.captured['1'].includes(PI(10)) && game.captured['1'].includes(PI2(10)));
  // 3뻑: 즉시 10점 승리.
  game = setup({ hands: { 1: ['m05-pi1', PI(6)], 2: [PI(7)] }, floor: ['m05-animal'], deck: ['m05-pi2'] });
  game.ppeok['1'] = 2;
  gostop.play(game, '1', 'm05-pi1');
  assert.equal(game.status, 'finished');
  assert.equal(game.result.reason, 'samppeok');
  assert.equal(game.result.base, 10);
});

test('흔들기(공개·×2)·폭탄(×2·피·뒤집기 2회)·콩알탄(배수 없음·뒤집기 1회)', () => {
  let game = setup({ hands: { 1: ['m07-animal', 'm07-ribbon', 'm07-pi1', PI(5)], 2: [PI(6)] }, floor: ['m01-gwang'], deck: [PI(4)] });
  assert.deepEqual(gostop.playOptions(game, '1', 'm07-animal'), { shake: true, bomb: false, kong: false });
  assert.equal(gostop.play(game, '1', 'm07-animal', { shake: true }).legal, true);
  assert.equal(game.shakes['1'], 1);
  assert.deepEqual(game.lastEvent.revealed.sort(), ['m07-animal', 'm07-pi1', 'm07-ribbon'].sort());
  // 폭탄
  game = setup({ hands: { 1: ['m07-animal', 'm07-ribbon', 'm07-pi1', PI(5)], 2: [PI(6)] }, floor: ['m07-pi2'], deck: [PI(4)], captured: { 2: [PI(10)] } });
  assert.equal(gostop.play(game, '1', 'm07-animal', { shake: true }).legal, false);
  assert.equal(gostop.play(game, '1', 'm07-animal', { bomb: true }).legal, true);
  assert.equal(game.bombs['1'], 1);
  assert.equal(game.bombFlips['1'], 2);
  assert.equal(game.captured['1'].filter(id => id.startsWith('m07')).length, 4);
  assert.ok(game.captured['1'].includes(PI(10)));
  // 폭탄 뒤집기: 패를 내지 않고 산패만 뒤집는다.
  gostop.play(game, '2', PI(6));
  assert.equal(gostop.flipOnly(game, '1').legal, true);
  assert.equal(game.bombFlips['1'], 1);
  // 콩알탄
  game = setup({ hands: { 1: ['m03-ribbon', 'm03-pi1', PI(5)], 2: [PI(6)] }, floor: ['m03-gwang', 'm03-pi2'], deck: [PI(4)] });
  assert.equal(gostop.play(game, '1', 'm03-ribbon', { kong: true }).legal, true);
  assert.equal(game.bombs['1'], 0);
  assert.equal(game.bombFlips['1'], 1);
  assert.ok(game.lastEvent.tags.includes('kong'));
  const pay = scoring.payment({ score: 7, goCount: 0, shakes: 1, bombs: 1, nagari: 0, bakList: [], pointsPerScore: 100 });
  assert.equal(pay.multiplier, 4);
});

test('총통: 같은 월 4장을 받으면 즉시 10점 승리(분배 직후 서버 판정)', () => {
  // Find a seed whose deal hands one player all four cards of a month.
  let found = null;
  for (let seed = 1; seed < 5000 && !found; seed += 1) {
    const game = gostop.create();
    gostop.start(game, ['1', '2'], { random: seeded(seed) });
    if (game.status === 'finished' && game.result.reason === 'chongtong') found = game;
  }
  assert.ok(found, '총통 분배를 찾지 못함');
  assert.equal(found.result.base, 10);
  assert.equal(found.result.losers[0].amount, 10 * found.pointsPerScore);
  assert.ok(found.lastEvent.tags.includes('chongtong'));
  assert.equal(found.lastEvent.revealed.length, 4);
});

test('박: 피박(1~7장·0장 제외)·광박·멍박·고박, 패자별 개별 적용', () => {
  const winner = scoring.scoreBreakdown([...[1, 2, 3, 4, 5].flatMap(m => [PI(m), PI2(m)]), 'm01-gwang', 'm03-gwang', 'm08-gwang',
    'm05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm12-animal', 'm02-animal', 'm04-animal']);
  const weak = scoring.scoreBreakdown([PI(9), PI2(9)]);
  const none = scoring.scoreBreakdown([]);
  assert.deepEqual(scoring.baks({ mode: 'matgo', winner, loser: weak, loserWent: false }), ['pibak', 'gwangbak', 'meongbak']);
  assert.deepEqual(scoring.baks({ mode: 'matgo', winner, loser: none, loserWent: true }), ['gwangbak', 'meongbak', 'gobak']);
  const eightPi = scoring.scoreBreakdown([6, 7, 8, 10].flatMap(m => [PI(m), PI2(m)]));
  assert.equal(scoring.baks({ mode: 'matgo', winner, loser: eightPi, loserWent: false }).includes('pibak'), false);
  const sixPi = scoring.scoreBreakdown([6, 7, 8].flatMap(m => [PI(m), PI2(m)]));
  assert.equal(scoring.baks({ mode: 'gostop', winner, loser: sixPi, loserWent: false }).includes('pibak'), false);
  assert.equal(scoring.baks({ mode: 'matgo', winner, loser: sixPi, loserWent: false }).includes('pibak'), true);
});

test('고 배수: 1고 +1점 ×2, 2고 +2점 ×4, 3고 ×8 … 7고 이상 ×128', () => {
  assert.deepEqual([0, 1, 2, 3, 7, 9].map(scoring.goMultiplier), [1, 2, 4, 8, 128, 128]);
  const game = setup({ hands: { 1: ['m03-gwang', PI(5), PI(6)], 2: [PI(7), PI(8)] }, floor: ['m03-pi1'], deck: [PI(4), PI2(4), PI2(5), PI2(6)],
    captured: { 1: ['m01-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang', PI(1)] } });
  gostop.play(game, '1', 'm03-gwang'); // 오광 15점 → 고/스톱
  assert.equal(game.phase, 'go-stop');
  assert.equal(gostop.decide(game, '2', 'go').legal, false);
  assert.equal(gostop.decide(game, '1', 'go').legal, true);
  assert.equal(game.goCount['1'], 1);
  gostop.play(game, '2', PI(7));
  // 점수가 오르지 않으면 다시 고/스톱을 묻지 않는다.
  gostop.play(game, '1', PI(5));
  assert.notEqual(game.phase, 'go-stop');
});

test('맞고 7점·고스톱 3점부터 고/스톱, 마지막 패면 자동 스톱', () => {
  const three = ['m01-ribbon', 'm02-ribbon'];
  let game = setup({ seats: ['1', '2', '3'], hands: { 1: ['m03-ribbon', PI(5)], 2: [PI(6)], 3: [PI(7)] }, floor: ['m03-pi1'], deck: [PI(4)], captured: { 1: three } });
  gostop.play(game, '1', 'm03-ribbon');
  assert.equal(game.phase, 'go-stop');
  game = setup({ hands: { 1: ['m03-ribbon', PI(5)], 2: [PI(6)] }, floor: ['m03-pi1'], deck: [PI(4)], captured: { 1: three } });
  gostop.play(game, '1', 'm03-ribbon');
  assert.notEqual(game.phase, 'go-stop');
  game = setup({ hands: { 1: ['m03-ribbon'], 2: [] }, floor: ['m03-pi1'], deck: [PI(4)],
    captured: { 1: [...three, 'm01-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang'] } });
  gostop.play(game, '1', 'm03-ribbon');
  assert.equal(game.status, 'finished');
  assert.equal(game.result.reason, 'stop');
});

test('나가리: 포인트 이동 없이 다음 판 ×2 누적, 다른 구성이면 초기화', () => {
  const game = setup({ hands: { 1: [PI(5)], 2: [PI(6)] }, floor: ['m01-gwang'], deck: [PI(7), PI(8)] });
  gostop.play(game, '1', PI(5));
  gostop.play(game, '2', PI(6));
  assert.equal(game.status, 'draw');
  assert.equal(game.result.kind, 'nagari');
  assert.equal(game.nagariStreak, 1);
  gostop.reset(game);
  assert.equal(game.nagariStreak, 1);
  gostop.start(game, ['1', '2'], { signature: game.nagariSignature });
  assert.equal(game.nagariStreak, 1);
  gostop.reset(game);
  gostop.start(game, ['1', '2'], { signature: 'someone-else' });
  assert.equal(game.nagariStreak, 0);
  const pay = scoring.payment({ score: 7, goCount: 0, shakes: 0, bombs: 0, nagari: 2, bakList: [], pointsPerScore: 100 });
  assert.equal(pay.amount, 7 * 4 * 100);
});

test('보너스피: 손에서 내면 바로 먹고 한 장 받아 계속, 산에서 나오면 먹고 한 장 더 뒤집는다', () => {
  let game = setup({ hands: { 1: ['bonus-3', PI(5)], 2: [PI(6)] }, floor: [], deck: [PI(4), PI(7)] });
  assert.equal(gostop.play(game, '1', 'bonus-3').legal, true);
  assert.ok(game.captured['1'].includes('bonus-3'));
  assert.equal(game.turn, '1');
  assert.ok(game.hands['1'].includes(PI(4)));
  game = setup({ hands: { 1: [PI(5), PI(6)], 2: [PI(7)] }, floor: [PI2(5)], deck: ['bonus-2', PI(4)] });
  gostop.play(game, '1', PI(5));
  assert.ok(game.captured['1'].includes('bonus-2'));
  assert.ok(game.floor.includes(PI(4)));
  // 뒤집은 보너스피 뒤 뻑이면 보너스피도 뻑 패와 함께 묻힌다.
  game = setup({ hands: { 1: [PI(5), PI(6)], 2: [PI(7)] }, floor: [PI2(5)], deck: ['bonus-2', 'm05-animal'] });
  gostop.play(game, '1', PI(5));
  assert.ok(game.lastEvent.tags.includes('ppeok'));
  assert.deepEqual(game.floorBonus[5], ['bonus-2']);
  assert.equal(game.captured['1'].includes('bonus-2'), false);
});

test('정산: 2인 계산과 3인 패자별 박 분리', () => {
  const game = setup({ seats: ['1', '2', '3'], hands: { 1: [], 2: [], 3: [] }, stake: 100,
    captured: { 1: [...[1, 2, 3, 4, 5].flatMap(m => [PI(m), PI2(m)]), 'm08-ssangpi'].filter(Boolean), 2: [PI(6)], 3: [6, 7, 8, 10].flatMap(m => [PI(m), PI2(m)]) } });
  game.captured['1'] = [...[1, 2, 3, 4, 5].flatMap(m => [PI(m), PI2(m)]), 'm11-ssangpi', 'm12-ssangpi', PI(9), PI2(9)]; // 16피 → 7점
  game.goCount['1'] = 1;
  game.mode = 'gostop';
  gostop.finish(game, '1', 'stop');
  const [a, b] = game.result.losers;
  assert.equal(game.result.score, 8); // 7점 + 1고
  assert.deepEqual(a.baks, ['pibak']);
  assert.equal(a.amount, 8 * 2 * 2 * 100);
  assert.deepEqual(b.baks, []);
  assert.equal(b.amount, 8 * 2 * 100);
});

test('무작위 전체 판 시뮬레이션: 50장 보존·항상 종료·잔여 선택 없음', () => {
  const random = seeded(2026);
  let finished = 0; let draws = 0;
  for (let round = 0; round < 400; round += 1) {
    const seats = round % 2 ? ['1', '2', '3'] : ['1', '2'];
    const game = gostop.create();
    gostop.start(game, seats, { random });
    for (let step = 0; step < 400 && game.status === 'playing'; step += 1) {
      const seat = game.turn;
      let verdict;
      if (game.phase === 'play') {
        const hand = gostop.handFor(game, seat);
        if (!hand.length || (game.bombFlips[seat] > 0 && random() < 0.5)) verdict = gostop.flipOnly(game, seat);
        else {
          const pick = hand[Math.floor(random() * hand.length)];
          verdict = gostop.play(game, seat, pick.id, { shake: pick.shake && random() < 0.5, bomb: pick.bomb && random() < 0.7, kong: pick.kong && random() < 0.7 });
        }
      } else if (game.phase === 'choose-floor') verdict = gostop.chooseFloor(game, seat, game.ctx.options[0]);
      else if (game.phase === 'choose-flip') verdict = gostop.chooseFlip(game, seat, game.ctx.flipOptions[0]);
      else if (game.phase === 'gukjin') verdict = gostop.chooseGukjin(game, seat, random() < 0.5);
      else if (game.phase === 'go-stop') verdict = gostop.decide(game, seat, random() < 0.3 ? 'go' : 'stop');
      assert.equal(verdict.legal, true, `${game.phase} ${verdict.reason}`);
      const all = [...game.deck, ...game.floor, ...Object.values(game.hands).flat(), ...Object.values(game.captured).flat(), ...Object.values(game.floorBonus).flat()];
      if (game.phase === 'choose-floor') all.push(...game.ctx.played);
      if (game.phase === 'choose-flip') all.push(...game.ctx.captured, ...game.ctx.bonusFlipped, game.ctx.flipped);
      if (game.phase === 'choose-flip' && game.ctx.held.length) all.push(...game.ctx.held);
      assert.equal(new Set(all).size, 50, `카드 보존 실패 (${game.phase})`);
      assert.equal(all.length, 50);
    }
    assert.notEqual(game.status, 'playing', '판이 끝나지 않음');
    if (game.status === 'finished') finished += 1; else draws += 1;
    if (game.status === 'finished') for (const loser of game.result.losers) assert.ok(Number.isSafeInteger(loser.amount) && loser.amount > 0);
  }
  assert.ok(finished > 0 && draws >= 0);
});
