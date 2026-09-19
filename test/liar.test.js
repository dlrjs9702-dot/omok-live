'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const liar = require('../lib/games/liar');
const SEATS = ['1', '2', '3'];

function started(count = 3, rounds = 1) {
  const game = liar.create({ totalRounds: rounds });
  const seats = Array.from({ length: count }, (_, i) => String(i + 1));
  assert.equal(liar.start(game, seats).legal, true);
  return game;
}
function hints(game) {
  for (let i = 0; i < game.players.length * 2; i += 1) {
    const seat = liar.currentSpeaker(game);
    assert.equal(liar.submitHint(game, seat, `힌트 ${i}`, game.phaseId).legal, true);
  }
  assert.equal(game.phase, 'vote');
}
function voteForLiar(game) {
  const liarSeat = game.liarSeat;
  const alternative = game.players.find(s => s !== liarSeat);
  for (const s of game.players) {
    const target = s === liarSeat ? alternative : liarSeat;
    assert.equal(liar.submitVote(game, s, target, game.phaseId).legal, true);
  }
  return liarSeat;
}

test('3-8 players only, one liar, start and settings locked', () => {
  const g = liar.create();
  assert.equal(liar.start(g, ['1', '2']).legal, false);
  assert.equal(liar.setRounds(g, 3).legal, true);
  assert.equal(liar.start(g, Array.from({ length: 8 }, (_, i) => String(i + 1))).legal, true);
  assert.equal(g.players.length, 8);
  assert.ok(g.players.includes(g.liarSeat));
  assert.equal(liar.setRounds(g, 1).legal, false);
  assert.equal(liar.start(g, SEATS).legal, false);
  assert.equal(liar.start(liar.create(), ['1','2','3','4','5','6','7','8','9']).legal, true); // invalid ninth seat is never admitted by the room
});

test('private word and roles are scoped per viewer; spectator sees no secret', () => {
  const g = started();
  const citizen = g.players.find(s => s !== g.liarSeat);
  const liarView = liar.publicState(g, g.liarSeat);
  const citizenView = liar.publicState(g, citizen);
  const spectatorView = liar.publicState(g, null);
  assert.equal(liarView.role, 'liar');
  assert.equal(liarView.myWord, null);
  assert.equal(citizenView.role, 'citizen');
  assert.equal(citizenView.myWord, g.word);
  assert.equal(spectatorView.role, null);
  assert.equal(spectatorView.myWord, null);
  assert.ok(!JSON.stringify(liarView).includes(g.word));
  assert.ok(!JSON.stringify(spectatorView).includes(g.word));
  assert.equal(liar.publicState(g, '7').role, null);
});

test('two full hint rotations; actor, spectator, stale and duplicate requests rejected', () => {
  const g = started();
  const first = liar.currentSpeaker(g);
  const wrong = g.players.find(s => s !== first);
  assert.equal(liar.submitHint(g, wrong, '나 먼저', g.phaseId).legal, false);
  assert.equal(liar.submitHint(g, '8', '관전', g.phaseId).legal, false);
  const phaseId = g.phaseId;
  assert.equal(liar.submitHint(g, first, '첫 번째', phaseId).legal, true);
  assert.equal(liar.submitHint(g, first, '중복', phaseId).legal, false);
  for (let i = 1; i < 6; i += 1) assert.equal(liar.submitHint(g, liar.currentSpeaker(g), `힌트 ${i}`, g.phaseId).legal, true);
  assert.equal(g.phase, 'vote');
  assert.equal(g.hints.length, 6);
  assert.deepEqual(g.hints.map(h => h.stage), ['hint1','hint1','hint1','hint2','hint2','hint2']);
});

test('hint timeout records omission; expired voting abstains and yields liar victory', () => {
  const g = started();
  g.deadlineAt = Date.now() - 1;
  assert.equal(liar.tick(g), true);
  assert.equal(g.hints.length, 1);
  assert.equal(g.hints[0].timedOut, true);
  assert.equal(g.hints[0].text, '시간 초과 — 힌트 없음');
  assert.equal(liar.submitHint(g, g.hints[0].seat, '늦게', g.phaseId - 1).legal, false);
  hintsAfterFirstTimeout(g);
  g.deadlineAt = Date.now() - 1;
  assert.equal(liar.tick(g), true);
  assert.equal(g.status, 'finished');
  assert.equal(g.lastResult.reason, 'no-votes');
});
function hintsAfterFirstTimeout(g) {
  while (g.phase !== 'vote') assert.equal(liar.submitHint(g, liar.currentSpeaker(g), '정상 힌트', g.phaseId).legal, true);
}

test('voting remains secret until closing, blocks self-vote/duplicates/outsider', () => {
  const g = started(); hints(g);
  const one = g.players[0]; const other = g.players[1];
  assert.equal(liar.submitVote(g, one, one, g.phaseId).legal, false);
  assert.equal(liar.submitVote(g, '8', one, g.phaseId).legal, false);
  assert.equal(liar.submitVote(g, one, other, g.phaseId).legal, true);
  assert.equal(liar.submitVote(g, one, other, g.phaseId).legal, false);
  const state = liar.publicState(g, other);
  assert.equal(state.voteHistory.length, 0);
  assert.ok(!JSON.stringify(state).includes('"votes"'));
  assert.ok(state.votedSeats.includes(one));
  assert.equal(state.myVoted, false);
});

test('first tie -> tied candidates add hints -> restricted revote -> second tie liar wins', () => {
  const g = started(); hints(g);
  for (let i = 0; i < 3; i += 1) {
    assert.equal(liar.submitVote(g, g.players[i], g.players[(i + 1) % 3], g.phaseId).legal, true);
  }
  assert.equal(g.phase, 'extraHint');
  assert.deepEqual(g.tiedCandidates, SEATS);
  for (const s of g.hintOrder) assert.equal(liar.submitHint(g, s, `추가 ${s}`, g.phaseId).legal, true);
  assert.equal(g.phase, 'revote');
  assert.equal(g.voteHistory.length, 1);
  const oldId = g.phaseId;
  assert.equal(liar.submitVote(g, '1', '2', oldId).legal, true);
  assert.equal(liar.submitVote(g, '2', '3', oldId).legal, true);
  assert.equal(liar.submitVote(g, '3', '1', oldId).legal, true);
  assert.equal(g.status, 'finished');
  assert.equal(g.lastResult.reason, 'revote-tie');
  assert.equal(g.lastResult.voteHistory.length, 2);
});

test('identifying liar leads to one guess; correct gives liar victory', () => {
  const g = started(); hints(g);
  const liarSeat = voteForLiar(g);
  assert.equal(g.phase, 'guess');
  assert.equal(liar.publicState(g, liarSeat).myWord, null);
  assert.equal(liar.submitGuess(g, g.players.find(s => s !== liarSeat), '가짜', g.phaseId).legal, false);
  assert.equal(liar.submitGuess(g, liarSeat, ` ${g.word} `, g.phaseId).legal, true);
  assert.equal(g.status, 'finished');
  assert.equal(g.lastResult.winningSide, 'liar');
  assert.equal(g.scores[liarSeat], 1);
  assert.equal(liar.submitGuess(g, liarSeat, '중복', g.phaseId).legal, false);
});

test('wrong or expired final guess gives citizens victory', () => {
  const g = started(); hints(g); const seat = voteForLiar(g);
  assert.equal(liar.submitGuess(g, seat, '존재하지않는제시어', g.phaseId).legal, true);
  assert.equal(g.lastResult.winningSide, 'citizen');
  assert.equal(g.scores[seat], 0);
  const timed = started(); hints(timed); voteForLiar(timed);
  timed.deadlineAt = Date.now() - 1;
  liar.tick(timed);
  assert.equal(timed.lastResult.reason, 'guess-timeout');
  assert.equal(timed.lastResult.winningSide, 'citizen');
});

test('three rounds retain scores, reveal prior round, avoid repeated words, and reset config', () => {
  const g = started(3, 3);
  const words = [];
  for (let round = 1; round <= 3; round += 1) {
    words.push(g.word);
    hints(g);
    g.deadlineAt = Date.now() - 1;
    liar.tick(g); // all abstain: liar victory
    assert.equal(g.lastResult.roundNumber, round);
    if (round < 3) {
      assert.equal(g.phase, 'reveal');
      assert.equal(liar.publicState(g, null).lastResult.word, words.at(-1));
      g.deadlineAt = Date.now() - 1;
      liar.tick(g);
      assert.equal(g.roundNumber, round + 1);
    }
  }
  assert.equal(new Set(words).size, 3);
  assert.equal(g.status, 'finished');
  const max = Math.max(...Object.values(g.scores));
  assert.deepEqual(g.winner, g.players.filter(s => g.scores[s] === max));
  liar.reset(g);
  assert.equal(g.status, 'selecting');
  assert.equal(g.totalRounds, 3);
  assert.equal(g.roundNumber, 0);
  assert.deepEqual(g.results, []);
  assert.deepEqual(g.scores, {});
});

// v1.6.42: client-side chat lock for the liar game's hint phases only -- gated on isLiarGame() so
// no other game's chat can ever be affected, and only while phase is one of the three hint stages.
test('room chat is disabled client-side only during the liar game hint phases', async () => {
  const root = path.join(__dirname, '..');
  const html = await fs.readFile(path.join(root, 'public/index.html'), 'utf8');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  assert.match(html, /id="chatLockNotice"/);
  assert.match(html, /id="chatSendBtn"/);
  assert.match(js, /function chatLockedForHints\(\) \{/);
  assert.match(js, /isLiarGame\(\) && g\?\.status === 'playing' && \['hint1', 'hint2', 'extraHint'\]\.includes\(g\.phase\)/);
  assert.match(js, /chatInput\.disabled = locked/);
  assert.match(js, /chatSendBtn\.disabled = locked/);
  assert.match(js, /chatLockNotice\.classList\.toggle\('hidden', !locked\)/);
  assert.match(js, /if \(chatLockedForHints\(\)\) return;/);
});
