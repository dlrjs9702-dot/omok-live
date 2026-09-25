'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const cityking = require('../lib/games/cityking');
const { getGame } = require('../lib/games');

function dice(...values) {
  let index = 0;
  return () => values[index++] ?? 1;
}

test('Land King is registered as an original 24-space board game supporting 2-4 seats', () => {
  assert.equal(getGame('cityking'), cityking);
  assert.equal(cityking.name, '랜드킹');
  assert.equal(cityking.TILES.length, 24);
  assert.equal(cityking.TILES.filter(tile => tile.type === 'property').length, 10);
  const game = cityking.create();
  assert.equal(cityking.start(game, ['1']).legal, false); // fewer than 2 seats
  assert.equal(game.players['1'], undefined);
  const fourPlayer = cityking.create();
  assert.equal(cityking.start(fourPlayer, ['1', '2', '3', '4']).legal, true);
  assert.equal(fourPlayer.seatOrder.length, 4);
  assert.equal(cityking.start(game, ['1', '2']).legal, true);
  assert.equal(game.players['1'].cash, 1500);
  assert.equal(game.players['2'].properties.length, 0);
  assert.deepEqual(game.seatOrder, ['1', '2']);
  assert.equal(game.turn, '1');
});

test('dice movement resolves events, buys properties, and counts completed rounds', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  const event = cityking.rollDice(game, '1', 'event', dice(1, 1));
  assert.equal(event.total, 2);
  assert.equal(event.double, true);
  assert.equal(game.players['1'].position, 2);
  assert.equal(game.players['1'].cash, 1600);
  assert.equal(game.turn, '1');
  assert.equal(game.turnCount, 0);

  const property = cityking.rollDice(game, '1', 'property', dice(1, 2));
  assert.equal(property.phase, 'buy');
  assert.equal(game.pendingProperty, 5);
  assert.equal(cityking.buyProperty(game, '1', 'buy').legal, true);
  assert.equal(game.owners[5], '1');
  assert.equal(game.players['1'].properties.includes(5), true);
  assert.equal(game.turn, '2');
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, '2', 'complete', dice(1, 3)).legal, true);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, '1');
});

test('a toll payment that cannot be covered opens a liquidation window instead of ending the game instantly', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.owners[3] = '1';
  game.players['1'].properties.push(3);
  game.players['2'].cash = 20;
  game.players['2'].position = 0;
  // Seat 2 owns a property too (even though it alone isn't enough to cover the toll), so the
  // liquidation window has something to wait on instead of bankrupting them immediately.
  game.players['2'].properties = [10];
  game.owners[10] = '2';
  game.turn = '2';
  const result = cityking.rollDice(game, '2', 'toll', dice(1, 2)); // lands exactly on tile 3
  assert.equal(result.legal, true);
  assert.equal(game.status, 'playing'); // not finished yet -- liquidation opens first
  assert.equal(game.phase, 'liquidate');
  assert.equal(game.liquidating, '2');
  assert.equal(game.pendingDebt.amount, 50); // tile 3 toll at level 0
  assert.equal(game.pendingDebt.payee, '1');
  assert.equal(game.players['2'].eliminated, false);
});

test('bankruptcy: nothing left to sell force-liquidates to the creditor first, then the game finishes with the survivor', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.owners[3] = '1';
  game.developments[3] = 3; // hotel, toll 50*5=250
  game.players['2'].cash = 50;
  game.players['2'].position = 0;
  game.turn = '2';
  const result = cityking.rollDice(game, '2', 'toll', dice(1, 2));
  assert.equal(result.legal, true);
  assert.equal(game.players['2'].eliminated, true);
  assert.equal(game.players['2'].cash, 0);
  assert.equal(game.players['1'].cash, 1550); // received the 50 the loser actually had
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, '1');
  assert.deepEqual(game.ranking, ['1', '2']);
});

test('a debt covered by selling assets resolves the liquidation and lets play continue', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2', '3']);
  game.owners[3] = '1';
  game.developments[3] = 1; // toll 50*2=100
  game.players['2'].cash = 50;
  game.players['2'].position = 0;
  game.players['2'].properties = [10];
  game.owners[10] = '2';
  game.turn = '2';
  cityking.rollDice(game, '2', 'toll', dice(1, 2));
  assert.equal(game.phase, 'liquidate');
  assert.equal(game.pendingDebt.amount, 100);
  // Selling the whole property (200 price, 0 buildings) at 50% raises exactly enough.
  const sold = cityking.sellProperty(game, '2', 10, 'now');
  assert.equal(sold.legal, true);
  assert.equal(sold.refund, 100);
  assert.equal(game.phase, 'roll');
  assert.equal(game.liquidating, null);
  assert.equal(game.pendingDebt, null);
  assert.equal(game.players['2'].eliminated, false);
  assert.equal(game.players['2'].cash, 50); // 50 + 100 refund - 100 debt
  assert.equal(game.turn, '3'); // turn moved on to the next active seat
});

test('a building can be sold on its own for half its construction cost, in any order relative to the property', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.owners[3] = '1'; // price 140, build cost 70
  game.developments[3] = 2; // two levels built
  game.players['1'].cash = 0;
  const sellBuilding = cityking.sellBuilding(game, '1', 3, 'now');
  assert.equal(sellBuilding.legal, true);
  assert.equal(sellBuilding.refund, 35); // floor(70 * 0.5)
  assert.equal(game.developments[3], 1);
  assert.equal(game.players['1'].cash, 35);
  assert.equal(game.owners[3], '1'); // still owns the city itself
  // Selling the whole city (with its remaining one building level) refunds both halves at once.
  const sellCity = cityking.sellProperty(game, '1', 3, 'now');
  assert.equal(sellCity.legal, true);
  assert.equal(sellCity.refund, 70 + 35); // floor(140*0.5) + floor(70*0.5)*1
  assert.equal(game.owners[3], undefined);
  assert.equal(game.developments[3], 0);
  assert.equal(game.players['1'].properties.includes(3), false);
});

test('only the owner can sell, and only on their own turn (or while they are the one liquidating)', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.owners[3] = '1';
  // It's seat 1's turn (the default after start); seat 2 acting at all is rejected first.
  assert.equal(cityking.sellProperty(game, '2', 3, 'now').reason, 'not-your-turn');
  // On seat 1's own turn, selling a tile they don't own is rejected as not-owner.
  assert.equal(cityking.sellProperty(game, '1', 5, 'now').reason, 'not-owner');
  game.turn = '2';
  assert.equal(cityking.sellProperty(game, '1', 3, 'now').reason, 'not-your-turn');
});

test('turn limit waits for every active seat, then ranks survivors by net worth and resets', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.turnCount = cityking.TURN_LIMIT - 1;
  game.players['1'].cash = 2000;
  game.players['2'].cash = 1500;
  const first = cityking.rollDice(game, '1', 'penultimate', dice(1, 3));
  assert.equal(first.finished, false);
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  assert.equal(game.turn, '2');
  const doubled = cityking.rollDice(game, '2', 'double', dice(2, 2));
  assert.equal(doubled.finished, false);
  assert.equal(game.turn, '2');
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  const last = cityking.rollDice(game, '2', 'last', dice(1, 2));
  assert.equal(last.phase, 'buy');
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  assert.equal(cityking.skipProperty(game, '2', 'finish').legal, true);
  assert.equal(game.turnCount, cityking.TURN_LIMIT);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, '1');
  assert.deepEqual(game.ranking, ['1', '2']);
  cityking.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.turnCount, 0);
  assert.equal(game.extraRoll, false);
  assert.equal(Object.keys(game.players).length, 0);
  assert.equal(Object.keys(game.owners).length, 0);
});

test('3-4 player games rank every survivor by net worth at the turn limit', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2', '3', '4']);
  game.turnCount = cityking.TURN_LIMIT - 1;
  game.completedTurns = { '1': true, '2': true, '3': true, '4': false };
  game.players['1'].cash = 1000;
  game.players['2'].cash = 4000;
  game.players['3'].cash = 2000;
  game.players['4'].cash = 3000;
  game.turn = '4';
  const result = cityking.rollDice(game, '4', 'last', dice(1, 3)); // total 4 -> tile 4 (tax, non-property, not a double)
  assert.equal(result.finished, true);
  assert.equal(game.status, 'finished');
  assert.deepEqual(game.ranking, ['2', '4', '3', '1']);
  assert.equal(game.winner, '2');
});

test('declining an unaffordable property advances turn instead of deadlocking', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.players['1'].position = 10;
  game.players['1'].cash = 0;
  const landed = cityking.rollDice(game, '1', 'land', dice(1, 1));
  assert.equal(landed.phase, 'buy');
  assert.equal(game.pendingProperty, 12);
  assert.equal(cityking.buyProperty(game, '1', 'buy').legal, false);
  assert.equal(cityking.skipProperty(game, '2', 'skip').legal, false);
  assert.equal(cityking.skipProperty(game, '1', 'skip').legal, true);
  assert.equal(game.turn, '1'); // double permits another roll after declining
  assert.equal(game.pendingProperty, null);
  assert.equal(game.owners[12], undefined);
});

test('consecutive doubles retain the turn and apply each landing before the next roll', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  const first = cityking.rollDice(game, '1', 'first', dice(1, 1), 0);
  assert.equal(first.double, true);
  assert.equal(game.players['1'].cash, 1600); // event at tile 2
  assert.equal(game.turn, '1');
  assert.equal(cityking.publicState(game).extraRoll, true);
  assert.equal(cityking.rollDice(game, '2', 'wrong', dice(1, 1)).reason, 'not-your-turn');
  assert.equal(cityking.rollDice(game, '1', 'duplicate', dice(1, 1), 0).reason, 'stale-roll');
  assert.equal(game.moves.length, 1);
  assert.equal(cityking.rollDice(game, '1', 'second', dice(1, 1), 1).double, true);
  assert.equal(game.players['1'].cash, 1480); // tax at tile 4
  assert.equal(game.turnCount, 0);
  const third = cityking.rollDice(game, '1', 'third', dice(1, 2), 2);
  assert.equal(third.double, false);
  assert.equal(third.phase, 'buy');
  assert.equal(game.pendingProperty, 7);
  assert.equal(cityking.rollDice(game, '1', 'during-buy', dice(1, 1)).reason, 'must-buy');
  assert.equal(cityking.buyProperty(game, '1', 'bought').legal, true);
  assert.equal(game.turn, '2');
  assert.equal(game.turnCount, 0);
  assert.deepEqual(game.completedTurns, { '1': true, '2': false });
  assert.equal(cityking.rollDice(game, '2', 'fourth', dice(2, 2)).double, true);
  assert.equal(game.players['2'].cash, 1380);
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, '2', 'fifth', dice(1, 2)).double, false);
  assert.equal(game.players['2'].cash, 1320); // opponent property toll at tile 7
  assert.equal(game.players['1'].cash, 1360);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, '1');
  assert.deepEqual(game.completedTurns, { '1': false, '2': false });
});

test('double landing on own city requires building decision before an extra roll', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.players['1'].position = 1;
  game.players['1'].properties.push(3);
  game.owners[3] = '1';
  const result = cityking.rollDice(game, '1', 'build', dice(1, 1));
  assert.equal(result.phase, 'build');
  assert.equal(game.extraRoll, true);
  assert.equal(cityking.rollDice(game, '1', 'premature', dice(1, 2)).reason, 'must-buy');
  assert.equal(cityking.buildProperty(game, '1', 'built').legal, true);
  assert.equal(game.developments[3], 1);
  assert.equal(game.players['1'].cash, 1430);
  assert.equal(game.turn, '1');
  assert.equal(game.phase, 'roll');
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, '1', 'not-double', dice(1, 2)).legal, true);
  assert.equal(game.players['1'].cash, 1630); // event at tile 6
  assert.equal(game.turn, '2');
  assert.equal(game.turnCount, 0);
});

test('eliminated seats do not block completed-round counting', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2', '3']);
  game.players['2'].eliminated = true;
  game.completedTurns['2'] = false;
  assert.equal(cityking.rollDice(game, '1', 'solo', dice(1, 3)).legal, true); // total 4 -> tax tile, resolves immediately
  assert.equal(game.turn, '3'); // skips the eliminated seat 2
  assert.equal(cityking.rollDice(game, '3', 'solo2', dice(1, 3)).legal, true); // total 4 -> tax tile again
  assert.equal(game.turnCount, 1); // both active seats (1 and 3) completed their turn
  assert.equal(game.turn, '1');
});

test('Land King UI and protected action routes are wired for up to four seats', async () => {
  const root = path.join(__dirname, '..');
  const [html, js, server] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
  ]);
  assert.match(html, /data-game="cityking"/);
  assert.match(html, /랜드킹/);
  assert.doesNotMatch(html, /도시왕/);
  assert.match(js, /랜드킹/);
  assert.doesNotMatch(js, /도시왕/);
  assert.doesNotMatch(server, /도시왕/);
  assert.match(html, /id="cityRollBtn"/);
  assert.match(html, /id="citySkipBtn"/);
  assert.match(html, /id="cityStartBtn"/);
  assert.match(html, /id="citySellBuildingBtn"/);
  assert.match(html, /id="citySellPropertyBtn"/);
  assert.match(js, /function drawCityBoard\(/);
  assert.match(js, /roomAction\('roll-city', \{ expectedMoveCount \}\)/);
  assert.match(js, /roomAction\('start-city'\)/);
  assert.match(js, /roomAction\('sell-property-city', \{ tileIndex: citySelectedTileIndex \}\)/);
  assert.match(js, /roomAction\('sell-building-city', \{ tileIndex: citySelectedTileIndex \}\)/);
  assert.match(server, /roll-city\|buy-city\|skip-city/);
  assert.match(server, /start-city/);
  assert.match(server, /sell-property-city\|sell-building-city/);
  assert.match(html, /app\.js\?v=1\.6\.79/);
  assert.match(js, /더블 추가 굴림/);
  assert.match(server, /Number\(body\.expectedMoveCount\)/);
  // Land King now joins the numbered-seat (2-4) family instead of a hardcoded black/white pair.
  assert.match(server, /isCityKing\(room\)/);
  assert.match(js, /function isCityKingGame\(\)/);
});

// v1.6.36: confirmed rule -- a tied net worth at the turn limit keeps seat order (no co-ranking).
test('a net-worth tie at the turn limit is broken by seat order, lower seat number ranks higher', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2', '3']);
  game.turnCount = cityking.TURN_LIMIT - 1;
  game.completedTurns = { '1': true, '2': true, '3': false };
  game.players['1'].cash = 1500;
  game.players['2'].cash = 1500; // tied with seat 1
  game.players['3'].cash = 500;
  game.turn = '3';
  const result = cityking.rollDice(game, '3', 'last', dice(1, 3)); // tile 4, tax, non-double
  assert.equal(result.finished, true);
  assert.deepEqual(game.ranking, ['1', '2', '3']); // 1 and 2 tied at 1500 -> seat 1 ranks first
  assert.equal(game.winner, '1');
});

// v1.6.36: confirmed rule -- 3-4 player Land King matches never count as a 1:1 result.
test('a 3+ player Land King match is excluded from head-to-head even though it has a single winner', () => {
  const { matchSeats } = require('../lib/match-result');
  const room = { gameType: 'cityking', game: { seatOrder: ['1', '2', '3'] } };
  assert.equal(matchSeats(room).length, 3);
});

// v1.6.36: a double that lands on a toll the player can't afford must still grant the extra roll
// once the resulting liquidation is settled -- the asset-sale detour doesn't eat the double.
test('settling a liquidation triggered by a double roll still leaves the extra roll available', () => {
  const game = cityking.create();
  cityking.start(game, ['1', '2']);
  game.players['2'].cash = 20;
  game.players['2'].properties = [10];
  game.owners[10] = '2';
  game.turn = '2';
  // Simulate the state right after a double roll triggered a liquidation mid-landing (rollDice
  // itself is exercised by other tests; this isolates the settle+extraRoll interaction).
  game.extraRoll = true;
  game.phase = 'liquidate';
  game.liquidating = '2';
  game.pendingDebt = { amount: 50, payee: '1' };
  const sold = cityking.sellProperty(game, '2', 10, 'now');
  assert.equal(sold.legal, true);
  assert.equal(game.phase, 'roll');
  assert.equal(game.liquidating, null);
  assert.equal(game.turn, '2'); // still seat 2's turn -- the double's extra roll was preserved
});

// v1.6.36: usability pass -- buy/build/sell previews show the resulting cash, not just the cost.
test('buy, build and sell offers preview the resulting cash balance', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /매입 시 현금 \$\{myCashNow\} → \$\{myCashNow - offer\.price\}/);
  assert.match(app, /건설 시 현금 \$\{myCashNow\} → \$\{myCashNow - cost\}/);
  assert.match(app, /매각 시 현금 \$\{myCash\} → \$\{myCash \+ sellValue\}/);
});

// v1.6.36: common dice-roll animation -- a reusable function/component, not a Land King-only effect.
// v1.6.55: animateDiceRoll is now a thin wrapper over the shared animateTumble core (also used by
// animateYutThrow), so the reduced-motion bypass, the hop/wobble loop and the .settling transition
// now live in animateTumble itself, not duplicated per widget.
test('the dice-roll animation is a generic reusable function driven by prefers-reduced-motion', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /function animateTumble\(els, spins, buildFrame, finalTransforms, \{ duration = 700, settleMs = 420, decorate, onDone \} = \{\}\)/);
  assert.match(app, /function animateDiceRoll\(dieEls, finalValues/);
  assert.match(app, /function reducedMotionActive\(\)/);
  assert.match(app, /if \(reducedMotionActive\(\) \|\| !els\.length\) \{ settle\(false\); return; \}/);
  // Each die is a static 3D cube (fixed faces in the markup); settling only ever sets the cube's
  // transform to the rotation for the server-confirmed value, never a random one, and never
  // touches face content -- so the number shown can't drift from what the cube's own faces say.
  const settleBlock = app.slice(app.indexOf('function animateTumble'), app.indexOf('function animateTumble') + 900);
  assert.match(settleBlock, /el\.style\.transform = finalTransforms\[i\];/);
  const diceBlock = app.slice(app.indexOf('function animateDiceRoll'), app.indexOf('function animateYutThrow'));
  assert.match(diceBlock, /dieEls\.map\(\(_, i\) => DICE_CUBE_ROTATIONS\[finalValues\[i\]\] \|\| DICE_CUBE_ROTATIONS\[1\]\)/);
  // Doubles get a brief shared emphasis effect, applied via animateTumble's decorate hook right as
  // each die settles (never mid-flight, since it's purely a result-confirmed visual, not a guess).
  assert.match(diceBlock, /const isDouble = finalValues\.length > 1 && finalValues\.every\(v => v === finalValues\[0\]\);/);
  assert.match(diceBlock, /decorate: isDouble \? \(el\) => el\.classList\.add\('diceDouble'\) : null/);
  assert.match(settleBlock, /if \(decorate\) decorate\(el, i\);/);
});

// v1.6.39: the dice roll now hops and wobbles like the yut-stick toss (animateYutThrow), instead
// of only spinning in place -- purely a flight-phase flourish, since settle() above still only
// ever sets each element's transform to its finalTransforms entry, so it can't change which face
// lands. v1.6.55: both widgets now share animateTumble's hop math; only each widget's own transform
// string (rotation axes/order) and hop height differ.
test('dice rolling now bounces (multiple decaying hops) and wobbles like the yut-stick toss, without affecting which face lands', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  const tumbleBody = app.slice(app.indexOf('function animateTumble'), app.indexOf('function animateDiceRoll'));
  assert.match(tumbleBody, /const wobbleDecay = 1 - progress \* 0\.6;/);
  // v1.6.57: spin now eases out (friction slowing it toward rest) instead of growing linearly with
  // elapsed time, and each element gets its own decaying multi-bounce height (bounceHeight) with a
  // per-element phase/scale jitter so several elements don't bounce in perfect lockstep.
  assert.match(tumbleBody, /const eased = 1 - \(1 - progress\) \*\* 3;/);
  assert.match(tumbleBody, /const bounce = bounceHeight\(localProgress\) \* \(spin\.bounceScale \?\? 1\);/);
  assert.match(tumbleBody, /el\.style\.transform = buildFrame\(spin, t, wobbleDecay, progress, bounce\);/);
  const diceBlock = app.slice(app.indexOf('function animateDiceRoll'), app.indexOf('function animateYutThrow'));
  assert.match(diceBlock, /const hop = -bounce \* 38;/);
  assert.match(diceBlock, /return `translateY\(\$\{hop\}px\) rotateX\(\$\{s\.x \* t\}deg\) rotateY\(\$\{s\.y \* t\}deg\) rotateZ\(\$\{s\.z \* t \* wobbleDecay\}deg\)`;/);
  // settle() (inside animateTumble) never includes translateY/rotateZ in finalTransforms -- a fresh
  // transform string always clears them once a die/stick actually lands.
  assert.doesNotMatch(diceBlock, /finalTransforms.*translateY|finalTransforms.*rotateZ/);
});

test('Land King wires its two dice into the common animation only on a genuinely new roll', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  // cityRollTrackingStarted (not "cityLastRollKey !== null") gates the animation: a reconnect that
  // lands on an already-existing roll must not replay it, but a fresh game's own first roll -- which
  // also takes cityLastRollKey from null to a real key -- must still animate.
  assert.match(app, /const isNewRoll = Boolean\(rollKey && cityRollTrackingStarted && cityLastRollKey !== rollKey\);/);
  assert.match(app, /animateDiceRoll\(\[cityDieFirst, cityDieSecond\], \[roll\.first, roll\.second\]/);
  // While the animation is in flight, unrelated re-renders must not stomp the spinning cubes.
  assert.match(app, /\} else if \(!cityDiceAnimating\) \{\s*\n\s*cityDieFirst\.style\.transform/);
  // Leaving the Land King screen resets the tracking flag so the next room starts clean too.
  assert.match(app, /cityRollTrackingStarted = false;/);
});

test('the dice animation respects prefers-reduced-motion in CSS as well as JS', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /@keyframes diceDoubleGlow/);
  assert.match(css, /\.diceCube\.settling\{transition:transform/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.diceCube\{transition:none!important\}\.diceCube\.diceDouble \.cf\{animation:none\}\}/);
});

test('each die is a fixed 6-face 3D cube -- rolling never swaps face content, only spins the cube', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(html, /<div id="cityDieFirst" class="diceCube">/);
  assert.match(html, /<div id="cityDieSecond" class="diceCube">/);
  for (const face of ['cf1', 'cf2', 'cf3', 'cf4', 'cf5', 'cf6']) {
    const count = (html.match(new RegExp(`class="cf ${face}"`, 'g')) || []).length;
    assert.equal(count, 2, `expected both dice to have a ${face} face`);
  }
  // The container rotation for each value is the exact inverse of that face's own CSS placement.
  assert.match(app, /1: 'rotateX\(0deg\) rotateY\(0deg\)'/);
  assert.match(app, /6: 'rotateX\(0deg\) rotateY\(180deg\)'/);
});

// v1.6.37: the board is now 7 rows x 11 columns, but the 24 real tiles and their index order are
// exactly what the engine already had -- only display coordinates moved.
test('the 7x11 board keeps exactly the 24 real tiles at their original index order', () => {
  assert.equal(cityking.TILES.length, 24);
  assert.deepEqual(cityking.TILES.map(t => t.index), Array.from({ length: 24 }, (_, i) => i));
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  // Rows (7) are untouched from the original layout; only the two 11-wide columns rows changed.
  assert.match(app, /const CITY_TOP_COLS = \[0, 1, 3, 5, 7, 9, 10\];/);
  assert.match(app, /const CITY_BOTTOM_COLS = \[10, 9, 7, 5, 3, 1, 0\];/);
  assert.match(app, /const CITY_CANVAS_W = 980;/);
  assert.match(app, /const CITY_CANVAS_H = 720;/);
  // The canvas resizes to the wider board only for Land King, and resets when leaving it.
  assert.match(app, /canvas\.width = CITY_CANVAS_W;/);
  assert.match(app, /if \(canvas\.width !== 720 \|\| canvas\.height !== 720\) \{ canvas\.width = 720; canvas\.height = 720; \}/);
});

// v1.6.37 put every actionable Land King control in a board-center panel; v1.6.56 moved that whole
// panel into the sidebar's #gameActionsPanel (below chat, alongside every other game's controls),
// since it overlaid the board's own canvas and blocked relocating the board itself. Either way,
// nothing should be duplicated between the action panel and the below-board info section.
test('roll, buy/skip, build/skip and sell controls all live inside #gameActionsPanel, not below the board', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const panelStart = html.indexOf('id="cityActionPanel"');
  const panelEnd = html.indexOf('id="baseballSecretForm"', panelStart);
  const panel = html.slice(panelStart, panelEnd);
  const gameActionsStart = html.indexOf('id="gameActionsPanel"');
  assert.ok(gameActionsStart >= 0 && gameActionsStart < panelStart, '#cityActionPanel should live inside #gameActionsPanel');
  const below = html.slice(html.indexOf('id="cityControls"'), html.indexOf('</section>', html.indexOf('id="cityControls"')));
  for (const id of ['cityRollBtn', 'cityBuyBtn', 'citySkipBtn', 'cityBuildBtn', 'cityBuildSkipBtn', 'citySellPropertyBtn', 'citySellBuildingBtn']) {
    assert.ok(panel.includes(`id="${id}"`), `${id} should be inside the central panel`);
    assert.ok(!below.includes(`id="${id}"`), `${id} must not be duplicated below the board`);
  }
  // Only supplementary info stays below the board, per spec.
  assert.ok(below.includes('id="cityAssets"'));
  assert.ok(below.includes('id="cityEvent"'));
});

// v1.6.56: #cityActionPanel no longer overlays the canvas (it moved into the sidebar), so
// drawCityBoard() now fills that interior with a canvas-drawn status readout instead of leaving a
// blank hole where the DOM overlay used to sit -- reusing #cityTurnSummary/#cityLastRoll's own
// already-computed text rather than recomputing the same turn/phase logic a second time.
test("the board's center is redrawn with a status readout now that the action panel no longer overlays it", () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.doesNotMatch(css, /\.cityActionPanel\{position:absolute/);
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /ctx\.fillText\(cityTurnSummary\.textContent, cityCenterX, cityCenterY \+ 6\);/);
  assert.match(app, /ctx\.fillText\(cityLastRoll\.textContent, cityCenterX, cityCenterY \+ 30\);/);
});

// v1.6.37: the tile browser/sell tool is collapsed by default (declutters the roll/buy/build
// phases) but force-opens itself for a required liquidation sale or an explicit tile click.
test('the tile info/sell panel is collapsible and force-opens only when actually needed', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  assert.match(html, /<details id="cityTileDetailsToggle" class="cityTileDetailsToggle">/);
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /if \(g\.liquidating === seat\) cityTileDetailsToggle\.open = true;/);
  assert.match(app, /citySelectedTileIndex = selected;\s*\n\s*cityTileDetailsToggle\.open = true;/);
});

// v1.6.37: a wider board must not push the room chat off-screen again (the exact bug v1.6.36 fixed
// for the old 7x7 board) -- the chat float button stays reachable even when the board scrolls.
test('the widened board scrolls horizontally on narrow screens without hiding the chat button', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  assert.match(html, /<div id="boardScroll" class="boardScroll">/);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /\.boardScroll\{overflow-x:auto/);
  assert.match(css, /@media\(max-width:640px\)\{\.canvasWrap\.cityBoard\{min-width:640px\}/);
  // chatFloatBtn lives outside #boardScroll entirely, so it's never affected by the board's own scroll.
  const boardScrollBlock = html.slice(html.indexOf('id="boardScroll"'), html.indexOf('id="boardScroll"') + 3000);
  assert.ok(!boardScrollBlock.includes('id="chatFloatBtn"'));
  assert.ok(html.includes('id="chatFloatBtn"'));
});
