'use strict';

// v1.6.87: table-driven rule checks for 고스톱·맞고 -- deck, scoring, matching, every special play,
// 박, multipliers and 나가리. Positions are built explicitly (hands, floor and deck order).
const test = require('node:test');
const assert = require('node:assert/strict');
const gostop = require('../lib/games/gostop');
const scoring = require('../lib/games/gostop/scoring');
const { CARDS, getCard } = require('../lib/games/gostop/cards');

function seeded(seed = 42) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

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
  for (const key of ['goCount', 'lastGoScore', 'shakes', 'bombs', 'bombFlips', 'ppeok']) game[key] = Object.fromEntries(seats.map(seat => [seat, 0]));
  game.gukjin = Object.fromEntries(seats.map(seat => [seat, null]));
  const all = [...Object.values(game.hands).flat(), ...game.floor, ...game.deck, ...Object.values(game.captured).flat()];
  assert.equal(new Set(all).size, all.length, '테스트 배치에 같은 카드가 두 번 들어갔다');
  all.forEach(getCard);
  return game;
}

const m = month => `m${String(month).padStart(2, '0')}`;
const PI = month => `${m(month)}-pi1`;
const PI2 = month => `${m(month)}-pi2`;
const sorted = list => [...list].sort();
const has = (list, ids) => ids.every(id => list.includes(id));

// ---- 3. 패 구성 ----------------------------------------------------------------------------

test('기본 48장 + 보너스 2장: 월별 광·열끗·띠·피·쌍피·국진·고도리·단 분류', () => {
  const label = (card) => {
    if (card.kind === 'gwang') return card.rain ? 'gwang:rain' : 'gwang';
    if (card.kind === 'animal') return card.godori ? 'animal:godori' : card.gukjin ? 'animal:gukjin' : 'animal';
    if (card.kind === 'ribbon') return card.dan ? `ribbon:${card.dan}` : 'ribbon';
    return card.piValue === 2 ? 'pi2' : 'pi';
  };
  const expected = {
    1: ['gwang', 'ribbon:hong', 'pi', 'pi'], 2: ['animal:godori', 'ribbon:hong', 'pi', 'pi'], 3: ['gwang', 'ribbon:hong', 'pi', 'pi'],
    4: ['animal:godori', 'ribbon:cho', 'pi', 'pi'], 5: ['animal', 'ribbon:cho', 'pi', 'pi'], 6: ['animal', 'ribbon:cheong', 'pi', 'pi'],
    7: ['animal', 'ribbon:cho', 'pi', 'pi'], 8: ['gwang', 'animal:godori', 'pi', 'pi'], 9: ['animal:gukjin', 'ribbon:cheong', 'pi', 'pi'],
    10: ['animal', 'ribbon:cheong', 'pi', 'pi'], 11: ['gwang', 'pi2', 'pi', 'pi'], 12: ['gwang:rain', 'animal', 'ribbon', 'pi2'],
  };
  const base = CARDS.filter(card => !card.bonus);
  assert.equal(base.length, 48);
  for (const [month, labels] of Object.entries(expected)) {
    assert.deepEqual(sorted(base.filter(card => card.month === Number(month)).map(label)), sorted(labels), `${month}월`);
  }
  const bonus = CARDS.filter(card => card.bonus);
  assert.deepEqual(bonus.map(card => [card.kind, card.piValue, card.month]), [['pi', 2, 0], ['pi', 3, 0]]);
  assert.equal(base.filter(card => card.kind === 'gwang').length, 5);
  assert.equal(base.filter(card => card.kind === 'animal').length, 9);
  assert.equal(base.filter(card => card.kind === 'ribbon').length, 10);
  assert.equal(base.filter(card => card.kind === 'pi').reduce((sum, card) => sum + card.piValue, 0), 24 + 2);
  assert.deepEqual(base.filter(card => card.godori).map(card => card.month), [2, 4, 8]);
});

// ---- 4. 기본 점수 --------------------------------------------------------------------------

const RIBBONS = { hong: ['m01-ribbon', 'm02-ribbon', 'm03-ribbon'], cheong: ['m06-ribbon', 'm09-ribbon', 'm10-ribbon'], cho: ['m04-ribbon', 'm05-ribbon', 'm07-ribbon'] };
const pis = count => [1, 2, 3, 4, 5, 6, 7, 8, 10, 11].flatMap(month => [PI(month), PI2(month)]).slice(0, count);

const SCORE_CASES = [
  ['광 2장', ['m01-gwang', 'm03-gwang'], 0],
  ['삼광', ['m01-gwang', 'm03-gwang', 'm08-gwang'], 3, 'samgwang'],
  ['비광 포함 삼광', ['m01-gwang', 'm03-gwang', 'm12-gwang'], 2, 'bisamgwang'],
  ['사광(비광 포함)', ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm12-gwang'], 4, 'sagwang'],
  ['사광(비광 제외)', ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang'], 4, 'sagwang'],
  ['오광', ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang'], 15, 'ogwang'],
  ['열끗 4장', ['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal'], 0],
  ['열끗 5장', ['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm12-animal'], 1, 'animal'],
  ['열끗 6장', ['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm12-animal', 'm09-animal'], 2, 'animal'],
  ['고도리', ['m02-animal', 'm04-animal', 'm08-animal'], 5, 'godori'],
  ['고도리 + 열끗 5장', ['m02-animal', 'm04-animal', 'm08-animal', 'm05-animal', 'm06-animal'], 6, 'godori'],
  ['고도리 2장뿐', ['m02-animal', 'm04-animal', 'm05-animal'], 0],
  ['홍단', RIBBONS.hong, 3, 'hongdan'],
  ['청단', RIBBONS.cheong, 3, 'cheongdan'],
  ['초단', RIBBONS.cho, 3, 'chodan'],
  ['띠 5장(단 없음)', ['m01-ribbon', 'm02-ribbon', 'm04-ribbon', 'm06-ribbon', 'm12-ribbon'], 1, 'ribbon'],
  ['홍단 + 청단(띠 6장)', [...RIBBONS.hong, ...RIBBONS.cheong], 3 + 3 + 2],
  ['비 띠는 단이 아니다', ['m01-ribbon', 'm02-ribbon', 'm12-ribbon'], 0],
  ['피 9장', pis(9), 0],
  ['피 10장', pis(10), 1, 'pi'],
  ['피 12장', pis(12), 3, 'pi'],
  ['쌍피 + 피 8장 = 10', ['m11-ssangpi', ...pis(8)], 1, 'pi'],
  ['12월 쌍피 + 11월 쌍피 + 피 6장 = 10', ['m12-ssangpi', 'm11-ssangpi', ...pis(6)], 1, 'pi'],
  ['쓰리피 + 피 7장 = 10', ['bonus-3', ...pis(7)], 1, 'pi'],
  ['쌍피 보너스 + 쓰리피 + 피 5장 = 10', ['bonus-2', 'bonus-3', ...pis(5)], 1, 'pi'],
];

test('기본 점수표', () => {
  for (const [name, ids, total, key] of SCORE_CASES) {
    const result = scoring.scoreBreakdown(ids);
    assert.equal(result.total, total, name);
    if (key) assert.ok(result.items.some(item => item.key === key), `${name}: ${key}`);
  }
});

// ---- 5. 국진 --------------------------------------------------------------------------------

test('국진: 열끗 또는 쌍피 한쪽으로만 계산된다', () => {
  const four = ['m05-animal', 'm06-animal', 'm07-animal', 'm10-animal'];
  const asAnimal = scoring.scoreBreakdown([...four, 'm09-animal', ...pis(8)], false);
  const asPi = scoring.scoreBreakdown([...four, 'm09-animal', ...pis(8)], true);
  assert.deepEqual([asAnimal.counts.animal, asAnimal.counts.pi, asAnimal.total], [5, 8, 1]);
  assert.deepEqual([asPi.counts.animal, asPi.counts.pi, asPi.total], [4, 10, 1]);
  assert.equal(asAnimal.items.some(item => item.key === 'pi'), false);
  assert.equal(asPi.items.some(item => item.key === 'animal'), false);
});

test('국진: 먹은 순간 한 번 선택하고, 이후 변경·타인 선택은 불가하며 공개 상태에 선택이 남는다', () => {
  const game = setup({ hands: { 1: ['m09-pi1', PI(5)], 2: [PI(6)] }, floor: ['m09-animal'], deck: [PI(4)] });
  gostop.play(game, '1', 'm09-pi1');
  assert.equal(game.phase, 'gukjin');
  assert.equal(game.turn, '1', '선택이 끝날 때까지 차례가 넘어가지 않는다');
  assert.equal(gostop.play(game, '1', PI(5)).reason, 'wrong-phase');
  assert.equal(gostop.chooseGukjin(game, '2', false).reason, 'not-your-turn');
  assert.equal(gostop.chooseGukjin(game, '1', false).legal, true);
  assert.equal(gostop.chooseGukjin(game, '1', true).legal, false, '고른 뒤에는 바꿀 수 없다');
  assert.equal(game.gukjin['1'], 'animal');
  assert.equal(gostop.publicState(game).seats['1'].gukjin, 'animal');
  // 재접속: 상태는 서버에 남아 있으므로 같은 공개 상태가 다시 만들어진다.
  assert.deepEqual(gostop.publicState(game).seats['1'], gostop.publicState(structuredClone(game)).seats['1']);
});

test('국진: 쌍피로 쓴 국진은 피로 뺏길 수 있고, 열끗으로 쓴 국진은 뺏기지 않는다', () => {
  for (const [choice, expectStolen] of [['pi', 'm09-animal'], ['animal', null]]) {
    const game = setup({ hands: { 1: [PI(3), PI(5)], 2: [PI(6)] }, floor: [], deck: [PI2(3)], captured: { 2: ['m09-animal'] } });
    game.gukjin['2'] = choice;
    gostop.play(game, '1', PI(3)); // 쪽
    assert.deepEqual(game.lastEvent.stolen.map(item => item.id), expectStolen ? [expectStolen] : [], choice);
    if (expectStolen) assert.equal(game.gukjin['1'], 'pi');
  }
});

// ---- 6. 일반 매칭 ---------------------------------------------------------------------------

test('손패 매칭: 바닥 같은 월 0·1·2·3장', () => {
  const cases = [
    { name: '0장 → 바닥에 놓는다', floor: ['m11-gwang'], play: 'm01-pi1', floorAfter: ['m11-gwang', 'm01-pi1'], captured: [] },
    { name: '1장 → 2장 먹는다', floor: ['m01-gwang', 'm11-gwang'], play: 'm01-pi1', floorAfter: ['m11-gwang'], captured: ['m01-pi1', 'm01-gwang'] },
    { name: '2장(같은 종류) → 선택 없이 1장', floor: ['m01-pi1', 'm01-pi2', 'm11-gwang'], play: 'm01-ribbon', floorAfter: ['m01-pi2', 'm11-gwang'], captured: ['m01-ribbon', 'm01-pi1'] },
    { name: '2장(다른 종류) → 선택', floor: ['m01-gwang', 'm01-ribbon', 'm11-gwang'], play: 'm01-pi1', choice: ['m01-gwang', 'm01-ribbon'] },
    { name: '3장 → 4장 모두', floor: ['m01-gwang', 'm01-ribbon', 'm01-pi2', 'm11-gwang'], play: 'm01-pi1', floorAfter: ['m11-gwang'], captured: ['m01-pi1', 'm01-gwang', 'm01-ribbon', 'm01-pi2'] },
  ];
  for (const item of cases) {
    const game = setup({ hands: { 1: [item.play, PI(5)], 2: [PI(6)] }, floor: item.floor, deck: ['m12-animal'] });
    const verdict = gostop.play(game, '1', item.play);
    assert.equal(verdict.legal, true, item.name);
    if (item.choice) {
      assert.equal(game.phase, 'choose-floor', item.name);
      assert.deepEqual(sorted(gostop.publicState(game).choice.options), sorted(item.choice));
      assert.equal(gostop.chooseFloor(game, '1', 'm11-gwang').reason, 'bad-choice', '다른 월 카드는 고를 수 없다');
      assert.equal(gostop.chooseFloor(game, '1', 'm01-pi2').reason, 'bad-choice', '바닥에 없는 카드는 고를 수 없다');
      continue;
    }
    assert.deepEqual(sorted(game.floor), sorted([...item.floorAfter, 'm12-animal']), item.name);
    assert.deepEqual(sorted(game.captured['1']), sorted(item.captured), item.name);
  }
});

test('산패 매칭: 바닥 같은 월 0·1·2·3장', () => {
  // 손패 m01-pi1은 바닥 m01-gwang을 먹고, 산에서 12월 카드가 나온다.
  const cases = [
    { name: '0장', floor: [], flip: 'm12-animal', floorAfter: ['m12-animal'], extra: [] },
    { name: '1장', floor: ['m12-gwang'], flip: 'm12-animal', floorAfter: [], extra: ['m12-animal', 'm12-gwang'] },
    { name: '2장(다른 종류) → 선택', floor: ['m12-gwang', 'm12-ribbon'], flip: 'm12-animal', choice: ['m12-gwang', 'm12-ribbon'] },
    { name: '3장', floor: ['m12-gwang', 'm12-ribbon', 'm12-ssangpi'], flip: 'm12-animal', floorAfter: [], extra: ['m12-animal', 'm12-gwang', 'm12-ribbon', 'm12-ssangpi'] },
  ];
  for (const item of cases) {
    const game = setup({ hands: { 1: ['m01-pi1', PI(5)], 2: [PI(6)] }, floor: ['m01-gwang', 'm11-gwang', ...item.floor], deck: [item.flip] });
    gostop.play(game, '1', 'm01-pi1');
    if (item.choice) {
      assert.equal(game.phase, 'choose-flip', item.name);
      assert.deepEqual(sorted(gostop.publicState(game).choice.options), sorted(item.choice));
      assert.equal(gostop.chooseFlip(game, '1', 'm11-gwang').reason, 'bad-choice');
      assert.equal(gostop.chooseFlip(game, '2', 'm12-gwang').reason, 'not-your-turn');
      assert.equal(gostop.chooseFlip(game, '1', 'm12-gwang').legal, true);
      assert.ok(game.floor.includes('m12-ribbon'));
      continue;
    }
    assert.deepEqual(sorted(game.floor), sorted(['m11-gwang', ...item.floorAfter]), item.name);
    assert.deepEqual(sorted(game.captured['1']), sorted(['m01-pi1', 'm01-gwang', ...item.extra]), item.name);
  }
});

// ---- 7~9. 쪽·따닥·판쓸이 -------------------------------------------------------------------

test('쪽: 피 가져오기(2인·3인·피 없음·쌍피만·가장 낮은 피 우선)', () => {
  const cases = [
    { name: '2인', seats: ['1', '2'], captured: { 2: [PI(4)] }, stolen: [PI(4)] },
    { name: '3인 두 상대 모두', seats: ['1', '2', '3'], captured: { 2: [PI(4)], 3: [PI2(4)] }, stolen: [PI(4), PI2(4)] },
    { name: '상대 피 없음', seats: ['1', '2'], captured: { 2: ['m01-gwang'] }, stolen: [] },
    { name: '쌍피만', seats: ['1', '2'], captured: { 2: ['m11-ssangpi'] }, stolen: ['m11-ssangpi'] },
    { name: '피와 쌍피가 있으면 피', seats: ['1', '2'], captured: { 2: ['m11-ssangpi', PI(4)] }, stolen: [PI(4)] },
    { name: '쓰리피보다 쌍피', seats: ['1', '2'], captured: { 2: ['bonus-3', 'm12-ssangpi'] }, stolen: ['m12-ssangpi'] },
  ];
  for (const item of cases) {
    const hands = { 1: [PI(3), PI(5)], 2: [PI(6)] }; if (item.seats.includes('3')) hands[3] = [PI(7)];
    const game = setup({ seats: item.seats, hands, floor: ['m11-gwang'], deck: [PI2(3)], captured: item.captured });
    gostop.play(game, '1', PI(3));
    assert.ok(game.lastEvent.tags.includes('jjok'), item.name);
    assert.ok(has(game.captured['1'], [PI(3), PI2(3)]), item.name);
    assert.deepEqual(sorted(game.lastEvent.stolen.map(entry => entry.id)), sorted(item.stolen), item.name);
  }
});

test('따닥은 바닥 2장 + 낸 패 + 뒤집은 넷째 패일 때만 성립한다', () => {
  const ttadak = setup({ seats: ['1', '2', '3'], hands: { 1: ['m06-pi1', PI(5)], 2: [PI(7)], 3: [PI(8)] }, floor: ['m06-animal', 'm06-ribbon', 'm01-gwang'],
    deck: ['m06-pi2'], captured: { 2: [PI(4)], 3: [PI2(4)] } });
  gostop.play(ttadak, '1', 'm06-pi1');
  gostop.chooseFloor(ttadak, '1', 'm06-ribbon');
  assert.ok(ttadak.lastEvent.tags.includes('ttadak'));
  assert.equal(ttadak.captured['1'].filter(id => id.startsWith('m06')).length, 4);
  assert.deepEqual(sorted(ttadak.lastEvent.stolen.map(entry => entry.id)), sorted([PI(4), PI2(4)]));
  // 바닥 1장 + 뒤집은 같은 월 → 뻑이지 따닥이 아니다.
  const ppeok = setup({ hands: { 1: ['m06-pi1', PI(5)], 2: [PI(7)] }, floor: ['m06-animal'], deck: ['m06-pi2'] });
  gostop.play(ppeok, '1', 'm06-pi1');
  assert.deepEqual(ppeok.lastEvent.tags, ['ppeok']);
  // 서로 다른 월을 연달아 먹은 것은 따닥이 아니다.
  const normal = setup({ hands: { 1: ['m06-pi1', PI(5)], 2: [PI(8)] }, floor: ['m06-animal', 'm07-animal', 'm11-gwang'], deck: ['m07-pi1'], captured: { 2: [PI(4)] } });
  gostop.play(normal, '1', 'm06-pi1');
  assert.equal(normal.lastEvent.tags.includes('ttadak'), false);
  assert.deepEqual(normal.lastEvent.stolen, [], '바닥이 남아 있으면 판쓸이도 아니다');
});

test('판쓸이: 바닥이 비면 상대별 피 1장, 자기 마지막 패로 쓸면 인정하지 않는다, 다른 특수와 중첩', () => {
  const cases = [
    { name: '2인 판쓸이', floor: ['m01-gwang', 'm02-animal'], hand: ['m01-pi1', PI(5)], deck: ['m02-pi1'], tags: ['sweep'], steals: 1 },
    { name: '자기 마지막 패', floor: ['m01-gwang', 'm02-animal'], hand: ['m01-pi1'], deck: ['m02-pi1'], tags: [], notTags: ['sweep'], steals: 0 },
    { name: '쪽 + 판쓸이', floor: [], hand: ['m01-pi1', PI(5)], deck: ['m01-pi2'], tags: ['jjok', 'sweep'], steals: 2 },
    { name: '따닥 + 판쓸이', floor: ['m01-gwang', 'm01-ribbon'], hand: ['m01-pi1', PI(5)], deck: ['m01-pi2'], choose: 'm01-gwang', tags: ['ttadak', 'sweep'], steals: 2 },
    { name: '폭탄 + 판쓸이', floor: ['m07-pi2', 'm02-animal'], hand: ['m07-animal', 'm07-ribbon', 'm07-pi1', PI(5)], bomb: 'm07-animal', deck: ['m02-pi1'], tags: ['bomb', 'sweep'], steals: 2 },
  ];
  for (const item of cases) {
    const game = setup({ hands: { 1: item.hand, 2: [PI(6)] }, floor: item.floor, deck: item.deck, captured: { 2: [PI(3), PI2(3), PI(4)] } });
    gostop.play(game, '1', item.bomb || item.hand[0], item.bomb ? { bomb: true } : {});
    if (item.choose) gostop.chooseFloor(game, '1', item.choose);
    for (const tag of item.tags) assert.ok(game.lastEvent.tags.includes(tag), `${item.name}: ${tag}`);
    for (const tag of item.notTags || []) assert.equal(game.lastEvent.tags.includes(tag), false, `${item.name}: no ${tag}`);
    assert.equal(game.lastEvent.stolen.length, item.steals, item.name);
    assert.equal(game.floor.length, 0, item.name);
  }
  // 3인: 두 상대에게서 각각.
  const three = setup({ seats: ['1', '2', '3'], hands: { 1: ['m01-pi1', PI(5)], 2: [PI(6)], 3: [PI(7)] }, floor: ['m01-gwang', 'm02-animal'], deck: ['m02-pi1'],
    captured: { 2: [PI(3)], 3: [PI2(3)] } });
  gostop.play(three, '1', 'm01-pi1');
  assert.deepEqual(sorted(three.lastEvent.stolen.map(entry => entry.from)), ['2', '3']);
});

// ---- 10~11. 뻑·3뻑 -------------------------------------------------------------------------

test('뻑: 여러 뻑 더미가 따로 보존되고, 남의 뻑 먹기 1장·자뻑 2장', () => {
  const game = setup({ hands: { 1: ['m05-pi1', 'm06-pi1', PI(8)], 2: ['m05-ribbon', PI(9)] },
    floor: ['m05-animal', 'm06-animal'], deck: ['m05-pi2', PI(10), 'm06-pi2', PI(11)], captured: { 1: [PI(3), PI2(3)], 2: [PI(4)] } });
  gostop.play(game, '1', 'm05-pi1'); // 첫 뻑
  assert.equal(game.ppeok['1'], 1);
  gostop.play(game, '2', PI(9));
  gostop.play(game, '1', 'm06-pi1'); // 둘째 뻑
  assert.equal(game.ppeok['1'], 2);
  assert.deepEqual(gostop.publicState(game).ppeokOwner, { 5: '1', 6: '1' });
  assert.equal(game.floor.filter(id => id.startsWith('m05')).length, 3);
  assert.equal(game.floor.filter(id => id.startsWith('m06')).length, 3);
  // 상대가 5월 뻑을 먹는다: 4장 + 피 1장, 6월 더미는 그대로.
  gostop.play(game, '2', 'm05-ribbon');
  assert.ok(game.lastEvent.tags.includes('ppeokEat'));
  assert.equal(game.lastEvent.stolen.length, 1);
  assert.deepEqual(gostop.publicState(game).ppeokOwner, { 6: '1' });
  assert.equal(game.floor.filter(id => id.startsWith('m06')).length, 3);
});

test('뻑 먹기는 산패로도 되고, 뻑에 묻힌 보너스피는 먹는 사람에게 간다', () => {
  const game = setup({ hands: { 1: [PI(8), PI(9)], 2: [PI(10)] }, floor: ['m05-animal', 'm05-pi1', 'm05-pi2'], deck: ['m05-ribbon'], captured: { 2: [PI(3), PI2(3), PI(4)] } });
  game.ppeokOwner = { 5: '2' }; game.floorBonus = { 5: ['bonus-2'] };
  gostop.play(game, '1', PI(8));
  assert.ok(game.lastEvent.tags.includes('ppeokEat'));
  assert.ok(has(game.captured['1'], ['m05-animal', 'm05-pi1', 'm05-pi2', 'm05-ribbon', 'bonus-2']));
  assert.equal(game.lastEvent.stolen.length, 2, '뻑 먹기 1장 + 보너스피 1장');
});

test('3뻑: 본인 뻑 3회째 즉시 10점 승리, 고·흔들기·박 없이 나가리 배수만', () => {
  const game = setup({ hands: { 1: ['m05-pi1', PI(6)], 2: [PI(7)] }, floor: ['m05-animal'], deck: ['m05-pi2'], nagari: 1,
    captured: { 1: ['m01-gwang', 'm03-gwang', 'm08-gwang'], 2: [PI(4)] } });
  game.ppeok = { 1: 2, 2: 2 }; game.goCount['1'] = 2; game.shakes['1'] = 1;
  gostop.play(game, '1', 'm05-pi1');
  assert.equal(game.status, 'finished');
  assert.equal(game.phase, 'done', '고/스톱 단계 없이 끝난다');
  assert.deepEqual([game.result.reason, game.result.base, game.result.score, game.result.goCount], ['samppeok', 10, 10, 0]);
  assert.deepEqual(game.result.losers[0].baks, []);
  assert.equal(game.result.losers[0].amount, 10 * 2 * 100);
  // 상대 뻑은 내 횟수가 아니다.
  const other = setup({ hands: { 1: ['m05-pi1', PI(6)], 2: [PI(7)] }, floor: ['m05-animal'], deck: ['m05-pi2'] });
  other.ppeok = { 1: 0, 2: 2 };
  gostop.play(other, '1', 'm05-pi1');
  assert.equal(other.status, 'playing');
  assert.deepEqual(other.ppeok, { 1: 1, 2: 2 });
});

// ---- 12~15. 흔들기·폭탄·콩알탄·총통 -------------------------------------------------------

test('흔들기: 같은 월 3장·바닥 0장일 때만 선언, 선언 없이도 낼 수 있고, 공개는 그 3장뿐', () => {
  const hand = ['m07-animal', 'm07-ribbon', 'm07-pi1', 'm02-ribbon', 'm03-pi1'];
  const game = setup({ hands: { 1: hand, 2: [PI(6)] }, floor: ['m11-gwang'], deck: [PI(4)] });
  assert.deepEqual(gostop.playOptions(game, '1', 'm02-ribbon'), { shake: false, bomb: false, kong: false });
  assert.equal(gostop.play(game, '1', 'm02-ribbon', { shake: true }).reason, 'bad-special');
  assert.equal(gostop.play(game, '1', 'm07-pi1', { shake: true }).legal, true);
  const text = JSON.stringify(gostop.publicState(game));
  for (const id of ['m02-ribbon', 'm03-pi1']) assert.equal(text.includes(id), false, `${id} 비공개`);
  assert.deepEqual(sorted(gostop.publicState(game).lastEvent.revealed), sorted(['m07-animal', 'm07-ribbon', 'm07-pi1']));
  // 선언하지 않고 내기
  const plain = setup({ hands: { 1: hand, 2: [PI(6)] }, floor: ['m11-gwang'], deck: [PI(4)] });
  assert.equal(gostop.play(plain, '1', 'm07-pi1').legal, true);
  assert.equal(plain.shakes['1'], 0);
  assert.deepEqual(plain.lastEvent.revealed, []);
});

test('흔들기·폭탄 배수는 승자 것만 중첩된다(흔들기 2회 ×4, 폭탄 ×2)', () => {
  const game = setup({ hands: { 1: [], 2: [] }, captured: { 1: ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang'], 2: ['m12-gwang'] } });
  game.shakes = { 1: 2, 2: 1 }; game.bombs = { 1: 1, 2: 1 };
  gostop.finish(game, '1', 'stop');
  const [loser] = game.result.losers;
  assert.equal(loser.multiplier, 8);
  assert.deepEqual(loser.factors.map(item => [item.key, item.multiplier]), [['shake', 4], ['bomb', 2]]);
  assert.equal(loser.amount, 4 * 8 * 100);
});

test('폭탄: 손 3장 + 바닥 1장, 4장 획득·피 1장·빈 차례 2회(뒤집기만)', () => {
  const game = setup({ hands: { 1: ['m07-animal', 'm07-ribbon', 'm07-pi1'], 2: [PI(6), PI(8), PI(9)] }, floor: ['m07-pi2'],
    deck: [PI(4), PI(10), PI(11), 'm12-ssangpi', PI2(4)], captured: { 2: [PI(3)] } });
  assert.equal(gostop.play(game, '1', 'm07-animal', { kong: true }).reason, 'bad-special');
  assert.equal(gostop.play(game, '1', 'm07-animal', { bomb: true }).legal, true);
  assert.equal(game.captured['1'].filter(id => id.startsWith('m07')).length, 4);
  assert.equal(game.lastEvent.stolen.length, 1);
  assert.deepEqual([game.hands['1'].length, game.bombFlips['1'], gostop.publicState(game).seats['1'].bombFlips], [0, 2, 2]);
  // 손패가 없어도 뒤집기 차례가 돌아온다.
  gostop.play(game, '2', PI(6));
  assert.equal(game.turn, '1');
  assert.equal(gostop.play(game, '1', PI(6)).reason, 'not-in-hand');
  assert.equal(gostop.flipOnly(game, '1').legal, true);
  gostop.play(game, '2', PI(8));
  assert.equal(gostop.flipOnly(game, '1').legal, true);
  assert.equal(game.bombFlips['1'], 0);
  assert.equal(gostop.flipOnly(game, '1').reason, 'not-your-turn');
});

test('콩알탄: 손 2장 + 바닥 2장, 4장 획득·피 1장·빈 차례 1회, 배수 없음', () => {
  const game = setup({ hands: { 1: ['m03-ribbon', 'm03-pi1', PI(5)], 2: [PI(6)] }, floor: ['m03-gwang', 'm03-pi2'], deck: [PI(4)], captured: { 2: [PI(8)] } });
  assert.deepEqual(gostop.playOptions(game, '1', 'm03-ribbon'), { shake: false, bomb: false, kong: true });
  gostop.play(game, '1', 'm03-ribbon', { kong: true });
  assert.equal(game.captured['1'].filter(id => id.startsWith('m03')).length, 4);
  assert.deepEqual([game.bombs['1'], game.bombFlips['1'], game.lastEvent.stolen.length], [0, 1, 1]);
});

test('총통: 시작 손패 기준 즉시 10점(고·박 없음), 진행 중 4장은 총통이 아니다', () => {
  let found = null;
  for (let seed = 1; seed < 5000 && !found; seed += 1) {
    const game = gostop.create();
    game.nagariStreak = 1; game.nagariSignature = 'same';
    gostop.start(game, ['1', '2', '3'], { random: seeded(seed), signature: 'same' });
    if (game.result?.reason === 'chongtong') found = game;
  }
  assert.ok(found);
  assert.equal(found.result.instant, true);
  for (const loser of found.result.losers) {
    assert.deepEqual(loser.baks, []);
    assert.equal(loser.amount, 10 * 2 * 100, '나가리 ×2만 적용');
  }
  // 진행 중 보너스피 교체로 같은 월 4장이 모여도 게임은 계속된다.
  const game = setup({ hands: { 1: ['bonus-2', 'm04-animal', 'm04-ribbon', 'm04-pi1'], 2: [PI(6)] }, floor: [], deck: ['m04-pi2', PI(7)] });
  gostop.play(game, '1', 'bonus-2');
  assert.equal(game.hands['1'].filter(id => id.startsWith('m04')).length, 4);
  assert.equal(game.status, 'playing');
});

// ---- 16~17. 고/스톱·고 배수 -----------------------------------------------------------------

test('고/스톱 기준점: 맞고 7점·고스톱 3점', () => {
  const cases = [
    [['1', '2'], pis(15), false], // 피 15장 6점
    [['1', '2'], pis(16), true], // 피 16장 7점
    [['1', '2', '3'], ['m01-ribbon', 'm02-ribbon'], true, 'm03-ribbon', 'm03-pi1'], // 홍단 3점
    [['1', '2', '3'], pis(11), false], // 2점
    [['1', '2', '3'], pis(12), true], // 3점
  ];
  for (const [seats, captured, expectDecision, play = 'm12-animal', floor = 'm12-ribbon'] of cases) {
    const hands = { 1: [play, 'm11-gwang'], 2: ['m10-animal'] }; if (seats.includes('3')) hands[3] = ['m07-animal'];
    const game = setup({ seats, hands, floor: [floor], deck: ['m09-pi1'], captured: { 1: captured } });
    gostop.play(game, '1', play);
    const score = scoring.scoreBreakdown(game.captured['1']).total;
    assert.equal(game.phase === 'go-stop', expectDecision, `${seats.length}인 ${score}점`);
    assert.equal(score >= scoring.STOP_THRESHOLD[game.mode], expectDecision);
  }
});

test('고 이후에는 점수가 고한 시점보다 올라야 다시 묻고, 피를 뺏겨 내려갔다 회복해도 묻지 않는다', () => {
  const game = setup({ hands: { 1: ['m09-pi1', 'm12-animal', 'm05-ribbon'], 2: ['m11-pi1', 'm11-pi2'] }, floor: ['m09-pi2', 'm10-ribbon', 'm01-gwang'],
    deck: ['m12-ribbon', 'm11-gwang', 'm10-pi1', 'm04-ribbon', 'm11-ssangpi'], captured: { 1: pis(15) } });
  const score = () => scoring.scoreBreakdown(game.captured['1']).total;
  gostop.play(game, '1', 'm09-pi1'); // 피 17장 = 8점
  assert.deepEqual([game.phase, score()], ['go-stop', 8]);
  assert.equal(gostop.decide(game, '2', 'go').reason, 'not-your-turn');
  gostop.decide(game, '1', 'go');
  assert.deepEqual([game.goCount['1'], game.lastGoScore['1'], game.turn], [1, 8, '2']);
  assert.equal(gostop.decide(game, '1', 'stop').reason, 'not-your-turn');
  gostop.play(game, '2', 'm11-pi1'); // 쪽: 1번의 피 1장을 가져가 7점
  assert.equal(score(), 7);
  gostop.play(game, '1', 'm12-animal'); // 피 1장 회복 → 8점, 고한 점수와 같음
  assert.equal(score(), 8);
  assert.deepEqual([game.phase, game.turn], ['play', '2']);
  gostop.play(game, '2', 'm11-pi2');
  gostop.play(game, '1', 'm05-ribbon'); // 11점, 남은 패가 없으니 자동 스톱
  assert.deepEqual([game.status, game.result.reason, game.result.goCount, game.result.score], ['finished', 'stop', 1, score() + 1]);
  assert.equal(gostop.decide(game, '1', 'stop').reason, 'not-playing', '연속 스톱 요청은 무시된다');
});

test('고 배수와 점수 순서: (기본 + 고) × 2^고, 7고 이상 ×128', () => {
  const cases = [[0, 8, 8, 1], [1, 8, 9, 2], [2, 8, 10, 4], [3, 8, 11, 8], [7, 8, 15, 128], [9, 8, 17, 128]];
  for (const [go, base, score, multiplier] of cases) {
    const game = setup({ hands: { 1: [], 2: [] }, captured: { 1: pis(17) } }); // 17피 = 8점
    assert.equal(scoring.scoreBreakdown(game.captured['1']).total, base);
    game.goCount['1'] = go;
    gostop.finish(game, '1', 'stop');
    const [loser] = game.result.losers;
    assert.deepEqual([game.result.score, loser.multiplier, loser.amount], [score, multiplier * (loser.baks.includes('pibak') ? 2 : 1), loser.amount]);
    assert.equal(loser.amount, score * loser.multiplier * 100);
  }
});

// ---- 18~22. 박 ------------------------------------------------------------------------------

test('박은 패자별로 판정된다(3인: A 피박·B 없음, 고박은 고한 패자만)', () => {
  const game = setup({ seats: ['1', '2', '3'], hands: { 1: [], 2: [], 3: [] },
    captured: { 1: [...pis(12), 'm01-gwang', 'm03-gwang', 'm08-gwang'], 2: [PI(9), 'm12-gwang'], 3: [...pis(20).slice(12), 'm11-gwang', 'm12-ssangpi', 'm09-pi2'] } });
  game.goCount = { 1: 0, 2: 1, 3: 0 };
  gostop.finish(game, '1', 'stop');
  const byseat = Object.fromEntries(game.result.losers.map(item => [item.seat, item]));
  assert.deepEqual(byseat['2'].baks, ['pibak', 'gobak']);
  assert.deepEqual(byseat['3'].baks, []);
  assert.equal(byseat['2'].amount, 6 * 4 * 100);
  assert.equal(byseat['3'].amount, 6 * 100);
});

test('박 판정표', () => {
  const winner = (ids) => scoring.scoreBreakdown(ids);
  const loser = (ids) => scoring.scoreBreakdown(ids);
  const withPi = [...pis(10)];
  const cases = [
    ['피박: 패자 피 7장(맞고)', 'matgo', withPi, pis(7), false, ['pibak']],
    ['피박 아님: 패자 피 8장(맞고)', 'matgo', withPi, pis(8), false, []],
    ['피박 아님: 패자 피 0장', 'matgo', withPi, ['m01-ribbon'], false, []],
    ['피박: 고스톱 5장', 'gostop', withPi, pis(5), false, ['pibak']],
    ['피박 아님: 고스톱 6장', 'gostop', withPi, pis(6), false, []],
    ['피박 아님: 승자가 피로 점수를 못 냄', 'matgo', [...RIBBONS.hong, ...RIBBONS.cho, ...pis(9)], pis(3), false, []],
    ['쌍피는 2장으로 센다', 'matgo', withPi, ['m11-ssangpi', ...pis(6)], false, []],
    ['광박: 광으로 났고 패자 광 0장', 'matgo', ['m01-gwang', 'm03-gwang', 'm08-gwang', ...RIBBONS.hong, 'm04-ribbon'], pis(9), false, ['gwangbak']],
    ['광박 아님: 패자 비광 1장', 'matgo', ['m01-gwang', 'm03-gwang', 'm08-gwang', ...RIBBONS.hong, 'm04-ribbon'], ['m12-gwang', ...pis(9)], false, []],
    ['멍박: 승자 열끗 7장(패자 열끗 있어도)', 'matgo', ['m02-animal', 'm04-animal', 'm05-animal', 'm06-animal', 'm07-animal', 'm10-animal', 'm12-animal'], ['m08-animal', ...pis(9)], false, ['meongbak']],
    ['멍박 아님: 열끗 6장', 'matgo', ['m02-animal', 'm04-animal', 'm05-animal', 'm06-animal', 'm07-animal', 'm10-animal', ...RIBBONS.hong], pis(9), false, []],
    ['고박', 'matgo', withPi, pis(9), true, ['gobak']],
  ];
  for (const [name, mode, w, l, went, expected] of cases) {
    assert.deepEqual(scoring.baks({ mode, winner: winner(w), loser: loser(l), loserWent: went }), expected, name);
  }
});

test('배수 중첩은 정수 곱이고 결과 표시와 정산 금액이 같다', () => {
  // 기본 8점(17피) + 2고 → 10점, 고 ×4 · 흔들기 ×2 · 나가리 ×2 · 피박 ×2 · 광박 ×2 → ×64
  const game = setup({ hands: { 1: [], 2: [] }, nagari: 1, stake: 50,
    captured: { 1: [...pis(17)], 2: [PI(9), PI2(9)] } });
  game.captured['1'].push('m01-gwang', 'm03-gwang', 'm08-gwang');
  game.goCount['1'] = 2; game.shakes['1'] = 1;
  const base = scoring.scoreBreakdown(game.captured['1']).total; // 8 + 3
  gostop.finish(game, '1', 'stop');
  const [loser] = game.result.losers;
  assert.deepEqual(loser.baks, ['pibak', 'gwangbak']);
  assert.equal(game.result.score, base + 2);
  assert.equal(loser.multiplier, 4 * 2 * 2 * 2 * 2);
  assert.equal(loser.amount, (base + 2) * 64 * 50);
  assert.ok(Number.isSafeInteger(loser.amount));
  assert.equal(loser.factors.reduce((product, item) => product * item.multiplier, 1), loser.multiplier);
  assert.equal(game.nagariStreak, 0, '승리로 나가리 배수를 소비');
});

// ---- 23. 나가리 ------------------------------------------------------------------------------

test('나가리 1회·2회 연속·다음 판 승리 시 누적 배수 적용 후 초기화', () => {
  const game = setup({ hands: { 1: [PI(5)], 2: [PI(6)] }, floor: ['m01-gwang'], deck: [PI(7), PI(8)] });
  const signature = 'a|b';
  game.nagariSignature = signature;
  gostop.play(game, '1', PI(5)); gostop.play(game, '2', PI(6));
  assert.deepEqual([game.status, game.nagariStreak, game.result.nextMultiplier], ['draw', 1, 2]);
  gostop.reset(game);
  gostop.start(game, ['1', '2'], { random: seeded(3), signature });
  assert.equal(game.nagariStreak, 1);
  Object.assign(game, { hands: { 1: [PI(5)], 2: [PI(6)] }, floor: ['m01-gwang'], deck: [PI(7), PI(8)], captured: { 1: [], 2: [] }, status: 'playing', phase: 'play', turn: game.firstSeat });
  gostop.play(game, game.turn, game.hands[game.turn][0]);
  gostop.play(game, game.turn, game.hands[game.turn][0]);
  assert.deepEqual([game.status, game.nagariStreak, game.result.nextMultiplier], ['draw', 2, 4]);
  gostop.reset(game);
  gostop.start(game, ['1', '2'], { random: seeded(4), signature });
  game.captured = { 1: pis(17), 2: [PI(9), PI2(9), 'm01-gwang', 'm03-gwang'] }; game.hands = { 1: [], 2: [] };
  game.status = 'playing';
  gostop.finish(game, '1', 'stop');
  assert.ok(game.result.losers[0].factors.some(item => item.key === 'nagari' && item.multiplier === 4));
  assert.equal(game.nagariStreak, 0);
  // 참가자 구성이 바뀌면 초기화
  const other = gostop.create(); other.nagariStreak = 3; other.nagariSignature = signature;
  gostop.start(other, ['1', '2'], { random: seeded(5), signature: 'a|c' });
  assert.equal(other.nagariStreak, 0);
});

// ---- 2. 보너스피 ----------------------------------------------------------------------------

test('보너스피: 손에서 내면 즉시 획득·산에서 1장 보충·계속 진행·상대 피 1장(3인은 각자)', () => {
  const game = setup({ seats: ['1', '2', '3'], hands: { 1: ['bonus-3', PI(5)], 2: [PI(6)], 3: [PI(7)] }, floor: ['m11-gwang'], deck: [PI(4), PI(8)],
    captured: { 2: [PI(10)], 3: [PI2(10)] } });
  gostop.play(game, '1', 'bonus-3');
  assert.deepEqual([game.turn, game.phase], ['1', 'play']);
  assert.ok(game.captured['1'].includes('bonus-3'));
  assert.deepEqual(sorted(game.hands['1']), sorted([PI(5), PI(4)]));
  assert.deepEqual(sorted(game.lastEvent.stolen.map(entry => entry.id)), sorted([PI(10), PI2(10)]));
  assert.equal(JSON.stringify(gostop.publicState(game)).includes(PI(4)), false, '보충한 패는 공개되지 않는다');
});

test('보너스피: 산에서 나오면 뒤집은 사람이 갖고 한 장 더 뒤집으며 상대 피 1장, 뻑에 묻히면 먹을 때까지 보류', () => {
  const flipped = setup({ hands: { 1: [PI(5), PI(6)], 2: [PI(7)] }, floor: [PI2(5), 'm11-gwang'], deck: ['bonus-2', PI(4)], captured: { 2: [PI(10)] } });
  gostop.play(flipped, '1', PI(5));
  assert.ok(flipped.captured['1'].includes('bonus-2'));
  assert.ok(flipped.floor.includes(PI(4)), '다음 장을 뒤집었다');
  assert.ok(flipped.lastEvent.tags.includes('bonus'));
  assert.deepEqual(flipped.lastEvent.stolen.map(entry => entry.id), [PI(10)]);
  // 뒤집어 나온 보너스 뒤에 뻑: 보너스도 뻑 더미에 묻히고 피를 뺏지 않는다.
  const buried = setup({ hands: { 1: [PI(5), PI(6)], 2: [PI(7)] }, floor: [PI2(5)], deck: ['bonus-2', 'm05-animal'], captured: { 2: [PI(10)] } });
  gostop.play(buried, '1', PI(5));
  assert.deepEqual(buried.floorBonus[5], ['bonus-2']);
  assert.deepEqual(buried.lastEvent.stolen, []);
  // 손패가 없고 산패도 보너스뿐이면 다음 장이 없다.
  const last = setup({ hands: { 1: [PI(5)], 2: [PI(7)] }, floor: [PI2(5), 'm11-gwang'], deck: ['bonus-3'] });
  gostop.play(last, '1', PI(5));
  assert.ok(last.captured['1'].includes('bonus-3'));
  assert.equal(last.deck.length, 0);
});

test('보너스피가 피로 뺏겨 넘어갈 때는 추가로 피를 뺏지 않는다', () => {
  const game = setup({ hands: { 1: [PI(3), PI(5)], 2: [PI(6)] }, floor: [], deck: [PI2(3)], captured: { 2: ['bonus-2'] } });
  gostop.play(game, '1', PI(3)); // 쪽
  assert.deepEqual(game.lastEvent.stolen.map(entry => entry.id), ['bonus-2']);
  assert.ok(game.captured['1'].includes('bonus-2'));
});

test('시작 바닥의 보너스피는 선이 갖고 바닥은 보충된다', () => {
  for (let seed = 1; seed < 400; seed += 1) {
    const game = gostop.create();
    gostop.start(game, ['1', '2'], { random: seeded(seed) });
    const firstBonus = game.lastEvent?.tags?.includes('bonus') ? game.lastEvent.captured : [];
    if (!firstBonus.length || game.status !== 'playing') continue;
    assert.ok(firstBonus.every(id => game.captured[game.firstSeat].includes(id)));
    assert.equal(game.floor.length, 8);
    assert.ok(game.floor.every(id => !getCard(id).bonus));
    return;
  }
  assert.fail('시작 바닥 보너스 분배를 찾지 못함');
});

// ---- v1.6.88: public move steps ---------------------------------------------------------------

test('이동 단계(lastEvent.steps)에는 공개된 카드만 들어간다(무작위 400판)', () => {
  let checked = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const random = seeded(seed * 7919);
    const game = gostop.create();
    gostop.start(game, seed % 3 ? ['1', '2'] : ['1', '2', '3'], { random });
    for (let guard = 0; guard < 400 && game.status === 'playing'; guard += 1) {
      const seat = game.turn;
      if (game.phase === 'play') {
        const hand = gostop.handFor(game, seat);
        if (!hand.length) gostop.flipOnly(game, seat);
        else { const card = hand[Math.floor(random() * hand.length)]; gostop.play(game, seat, card.id, { bomb: card.bomb, shake: card.shake && random() < 0.5 }); }
      } else if (game.phase === 'choose-floor') gostop.chooseFloor(game, seat, game.ctx.options[0]);
      else if (game.phase === 'choose-flip') gostop.chooseFlip(game, seat, game.ctx.flipOptions[0]);
      else if (game.phase === 'gukjin') gostop.chooseGukjin(game, seat, random() < 0.5);
      else if (game.phase === 'go-stop') gostop.decide(game, seat, random() < 0.5 ? 'go' : 'stop');
      const ev = game.lastEvent;
      const hidden = new Set([...game.deck, ...Object.values(game.hands).flat()]);
      const visible = new Set([...game.floor, ...Object.values(game.captured).flat(), ...Object.values(game.floorBonus).flat(), ...(ev?.revealed || []),
        ...(game.ctx?.played || []), ...(game.ctx?.flipped ? [game.ctx.flipped] : []), ...(gostop.publicState(game).choice?.pending || [])]);
      for (const step of ev?.steps || []) {
        for (const id of step.cards || [step.card]) {
          // 흔들기 공개 3장은 규칙상 공개(그중 2장은 손에 남음); 그 밖의 손패·산패는 절대 없다.
          if (!(step.k === 'reveal' && (ev.revealed || []).includes(id))) assert.equal(hidden.has(id), false, `seed ${seed}: ${step.k} ${id} 비공개 카드`);
          assert.ok(visible.has(id), `seed ${seed}: ${step.k} ${id} 위치 불명`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 1000);
});
